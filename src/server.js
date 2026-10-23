import logger from './logger/index.js';

// Se completa recién cuando se carga el módulo de la conexión: si la config es inválida
// nunca se llega a abrir una conexión y no hay nada que cerrar.
let disconnectDB = null;

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
    app.listen(config.port, (error) => (error ? reject(error) : resolve()));
  });
  logger.info(`Servidor ShipNow escuchando en el puerto ${config.port} (${config.nodeEnv})`);
};

// Si el arranque falla después de conectar a MongoDB (ej. puerto ocupado), la conexión
// abierta mantendría vivo el proceso: se cierra para que termine con código 1.
start().catch(async (error) => {
  logger.fatal(`No se pudo iniciar la aplicación: ${error.message}`);
  process.exitCode = 1;
  try {
    await disconnectDB?.();
  } catch (disconnectError) {
    logger.error(`No se pudo cerrar la conexión con MongoDB: ${disconnectError.message}`);
  }
});
