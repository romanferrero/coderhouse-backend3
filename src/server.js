import config from './config/index.js';
import app from './app.js';
import { connectDB } from './db/connection.js';

const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`[server] ShipNow API escuchando en http://localhost:${config.port} (${config.nodeEnv})`);
  });
};

start().catch((error) => {
  console.error('[server] No se pudo iniciar la aplicación:', error.message);
  process.exit(1);
});
