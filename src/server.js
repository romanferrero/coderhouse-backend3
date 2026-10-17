import logger from './logger/index.js';

// La config y la app se importan recién acá: si falta o es inválida una variable de entorno,
// el error queda registrado como fatal (consola y logs/error.log) en lugar de cortar el
// arranque antes de que exista el logger.
const start = async () => {
  const { default: config } = await import('./config/index.js');
  const { default: app } = await import('./app.js');
  const { connectDB } = await import('./db/connection.js');

  await connectDB();
  await new Promise((resolve, reject) => {
    // Express 5 le pasa al callback el error de listen (ej. puerto ocupado).
    app.listen(config.port, (error) => (error ? reject(error) : resolve()));
  });
  logger.info(`Servidor ShipNow escuchando en el puerto ${config.port} (${config.nodeEnv})`);
};

start().catch((error) => {
  logger.fatal(`No se pudo iniciar la aplicación: ${error.message}`);
  process.exitCode = 1;
});
