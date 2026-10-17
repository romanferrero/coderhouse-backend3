import logger, { LOG_LEVELS } from '../logger/index.js';
import { HTTP_STATUS } from '../constants/index.js';

// Herramienta interna, no es una funcionalidad del negocio: emite un log de cada nivel
// para verificar dónde aparece cada uno (consola, logs/error.log, logs/app-AAAA-MM-DD.log).
const SAMPLE_MESSAGES = Object.freeze({
  debug: 'Detalle de depuración: filtro de pedidos { status: "PENDING", page: 1 }',
  http: 'GET /api/orders/A-102 200 - 8.4 ms',
  info: 'Pedido #A-102 creado correctamente',
  warning: 'Pedido #A-102 sin repartidor asignado',
  error: 'Falló la creación del pedido: ValidationError (campo "destino" requerido)',
  fatal: 'Se perdió la conexión con MongoDB y no se pudo restablecer',
});

class LoggerController {
  constructor(log) {
    this.logger = log;
  }

  test = (req, res) => {
    // De menor a mayor gravedad: debug, http, info, warning, error, fatal.
    const levels = Object.keys(LOG_LEVELS).reverse();
    levels.forEach((level) => this.logger[level](`[loggerTest] ${SAMPLE_MESSAGES[level]}`));

    // Un nivel se registra si es igual o más grave que el mínimo del entorno.
    const minimum = LOG_LEVELS[this.logger.level];
    res.status(HTTP_STATUS.OK).json({
      status: 'success',
      payload: {
        nivelMinimo: this.logger.level,
        registrados: levels.filter((level) => LOG_LEVELS[level] <= minimum),
        omitidos: levels.filter((level) => LOG_LEVELS[level] > minimum),
        enErrorLog: levels.filter((level) => LOG_LEVELS[level] <= LOG_LEVELS.error),
      },
    });
  };
}

export default new LoggerController(logger);
