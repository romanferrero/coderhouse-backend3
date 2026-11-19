import logger from './logger/index.js';

// Se completa recién cuando se carga el módulo de la conexión: si la config es inválida
// nunca se llega a abrir una conexión y no hay nada que cerrar.
let disconnectDB = null;
let server = null;

// Si el cierre no termina en este tiempo (ej. una request que no responde), se corta igual.
const SHUTDOWN_TIMEOUT_MS = 10_000;

// La config y la app se importan recién acá: si falta o es inválida una variable de entorno,
// el error queda registrado como fatal (consola y logs/error.log) en lugar de cortar el
// arranque antes de que exista el logger.
const start = async () => {
  const { default: config } = await import('./config/index.js');
  const { default: app } = await import('./app.js');
  const connection = await import('./db/connection.js');
  disconnectDB = connection.disconnectDB;

  await connection.connectDB();
  await new Promise((resolve, reject) => {
    // Express 5 le pasa al callback el error de listen (ej. puerto ocupado).
    server = app.listen(config.port, (error) => (error ? reject(error) : resolve()));
  });
  logger.info(`Servidor ShipNow escuchando en el puerto ${config.port} (${config.nodeEnv})`);
};

// Cierre ordenado: docker stop (y los orquestadores) mandan SIGTERM; Ctrl+C manda SIGINT.
// Se deja de aceptar conexiones, se terminan las requests en curso y se cierra MongoDB.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Señal ${signal} recibida: cerrando el servidor`);

  const forceExit = setTimeout(() => {
    logger.error(`El cierre tardó más de ${SHUTDOWN_TIMEOUT_MS / 1000} s: se fuerza la salida`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) {
      server.closeIdleConnections();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    await disconnectDB?.();
    logger.info('Servidor detenido');
  } catch (error) {
    logger.error(`Error durante el cierre: ${error.message}`, { stack: error.stack });
    process.exitCode = 1;
  }
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

// Si el arranque falla después de conectar a MongoDB (ej. puerto ocupado), la conexión
// abierta mantendría vivo el proceso: se cierra para que termine con código 1.
// El stack va en las líneas siguientes del log, igual que en los errores 5xx del errorHandler.
start().catch(async (error) => {
  logger.fatal(`No se pudo iniciar la aplicación: ${error.message}`, { stack: error.stack ?? String(error) });
  process.exitCode = 1;
  try {
    await disconnectDB?.();
  } catch (disconnectError) {
    logger.error(`No se pudo cerrar la conexión con MongoDB: ${disconnectError.message}`, {
      stack: disconnectError.stack,
    });
  }
});
