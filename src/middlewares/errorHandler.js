import { HTTP_STATUS } from '../constants/index.js';
import config from '../config/index.js';

export const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    status: 'error',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

const MONGO_DUPLICATE_KEY = 11000;

// Traduce los errores de Mongoose que llegan hasta acá a errores del cliente:
// son datos inválidos, no fallas del servidor.
const normalizeError = (err) => {
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((error) => `${error.path}: ${error.message}`);
    return { statusCode: HTTP_STATUS.BAD_REQUEST, message: `Datos inválidos. ${details.join(' | ')}` };
  }
  if (err.name === 'CastError') {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: `Valor inválido para "${err.path}": ${JSON.stringify(err.value)}.`,
    };
  }
  if (err.code === MONGO_DUPLICATE_KEY) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ');
    return { statusCode: HTTP_STATUS.CONFLICT, message: `Ya existe un registro con ese valor de ${fields}.` };
  }
  return { statusCode: err.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR, message: err.message };
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const { statusCode, message } = normalizeError(err);
  const isServerError = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;

  if (isServerError) console.error(err);

  res.status(statusCode).json({
    status: 'error',
    message: isServerError && config.isProduction ? 'Error interno del servidor' : message,
  });
};
