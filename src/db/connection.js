import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../logger/index.js';

// Si MongoDB no responde, las operaciones fallan a los 5 s en lugar de los 30 s por defecto
// del driver: el cliente recibe antes el error controlado.
const SERVER_SELECTION_TIMEOUT_MS = 5000;

const onDisconnected = () => logger.warning('Se perdió la conexión con MongoDB');

// Cambios de estado de la conexión una vez que la app ya está corriendo.
const watchConnection = () => {
  mongoose.connection.on('disconnected', onDisconnected);
  mongoose.connection.on('reconnected', () => logger.info('Conexión con MongoDB restablecida'));
  mongoose.connection.on('error', (error) => logger.error(`Error en la conexión con MongoDB: ${error.message}`));
};

// Sin base de datos la API no puede funcionar: si falla la conexión inicial, server.js
// registra el error como fatal y corta el arranque.
export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  } catch (error) {
    throw new Error(`Error al conectar con MongoDB: ${error.message}`, { cause: error });
  }
  const { host, port, name } = mongoose.connection;
  logger.info(`Conexión a MongoDB establecida (${host}:${port}/${name})`);
  watchConnection();
};

// Cierre intencional: se quita el aviso de desconexión para no registrarlo como una caída.
export const disconnectDB = async () => {
  const wasConnected = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
  mongoose.connection.off('disconnected', onDisconnected);
  await mongoose.disconnect();
  if (wasConnected) logger.info('Conexión a MongoDB cerrada');
};
