import { HTTP_STATUS } from '../constants/index.js';
import config from '../config/index.js';

export const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    status: 'error',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const isServerError = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;

  if (isServerError) console.error(err);

  res.status(statusCode).json({
    status: 'error',
    message: isServerError && config.isProduction ? 'Error interno del servidor' : err.message,
  });
};
