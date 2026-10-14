import mongoose from 'mongoose';
import config from '../config/index.js';

// Si MongoDB no responde, las operaciones fallan a los 5 s en lugar de los 30 s por defecto
// del driver: el cliente recibe antes el error controlado.
const SERVER_SELECTION_TIMEOUT_MS = 5000;

export const connectDB = async () => {
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  console.log('[db] Conectado a MongoDB');
};

export const disconnectDB = () => mongoose.disconnect();
