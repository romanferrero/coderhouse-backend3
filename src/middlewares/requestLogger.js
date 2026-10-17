import logger from '../logger/index.js';

// Registra cada request en nivel http cuando termina: método, ruta, status y duración.
// En producción el nivel mínimo es info, así que estos registros no aparecen.
export const requestLogger = (req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const ms = (performance.now() - start).toFixed(1);
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms} ms`);
  });
  next();
};
