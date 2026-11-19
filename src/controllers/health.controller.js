import config from '../config/index.js';
import { getDatabaseStatus } from '../db/connection.js';
import { HTTP_STATUS } from '../constants/index.js';

// Estado de la API para monitoreo (Docker HEALTHCHECK, balanceadores, uptime checks).
// Responde 200 si la API está lista para atender, o 503 si perdió la conexión con MongoDB.
// Solo expone datos no sensibles: nada de versiones, host, URI de la base ni variables de entorno.
class HealthController {
  check = (req, res) => {
    const database = getDatabaseStatus();
    const healthy = database === 'connected';

    res.status(healthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: healthy ? 'ok' : 'error',
      environment: config.nodeEnv,
      uptime: Math.round(process.uptime()), // segundos desde que arrancó el proceso
      timestamp: new Date().toISOString(),
      database,
    });
  };
}

export default new HealthController();
