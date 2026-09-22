import mongoose from 'mongoose';
import config from '../config/index.js';

export const connectDB = async () => {
  await mongoose.connect(config.mongodbUri);
  console.log('[db] Conectado a MongoDB');
};

export const disconnectDB = () => mongoose.disconnect();
