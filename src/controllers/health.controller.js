import { HTTP_STATUS } from '../constants/index.js';

// Responde que el servidor está levantado. No consulta la base de datos.
class HealthController {
  check = (req, res) => {
    res.status(HTTP_STATUS.OK).json({ status: 'ok' });
  };
}

export default new HealthController();
