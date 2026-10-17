import { HTTP_STATUS } from '../constants/index.js';
import config from '../config/index.js';
import logger from '../logger/index.js';
import { AppError, ERROR_DICTIONARY as ERRORS, RouteNotFoundError } from '../errors/index.js';

// Una ruta inexistente es un error más: se deriva al errorHandler en lugar de responder acá.
export const notFoundHandler = (req, res, next) => {
  next(new RouteNotFoundError(req.method, req.originalUrl));
};

const MONGO_DUPLICATE_KEY = 11000;

// Convierte cualquier error que llegue al middleware en un AppError del diccionario.
// Los de Mongoose y los del parseo del body son datos inválidos del cliente, no fallas
// del servidor; todo lo que no se reconoce termina como INTERNAL_SERVER_ERROR.
const toAppError = (err) => {
  if (err instanceof AppError) return err;

  if (err?.name === 'ValidationError' && err.errors) {
    const fields = Object.fromEntries(Object.values(err.errors).map((error) => [error.path, error.message]));
    const summary = Object.entries(fields).map(([path, message]) => `${path}: ${message}`);
    return new AppError(ERRORS.VALIDATION_ERROR, {
      message: `Datos inválidos. ${summary.join(' | ')}`,
      details: { fields },
    });
  }
  if (err?.name === 'CastError') {
    return new AppError(ERRORS.VALIDATION_ERROR, {
      message: `Valor inválido para "${err.path}": ${JSON.stringify(err.value)}.`,
      details: { field: err.path, received: err.value },
    });
  }
  if (err?.code === MONGO_DUPLICATE_KEY) {
    const fields = Object.keys(err.keyValue ?? {});
    return new AppError(ERRORS.DUPLICATE_KEY, {
      message: `Ya existe un registro con ese valor de ${fields.join(', ')}.`,
      details: { fields },
    });
  }
  if (err?.type === 'entity.parse.failed') return new AppError(ERRORS.INVALID_JSON, { cause: err });
  if (err?.type === 'entity.too.large') return new AppError(ERRORS.PAYLOAD_TOO_LARGE);

  // Otros errores 4xx que genera Express (ej. un parámetro de URL mal codificado).
  const status = err?.status ?? err?.statusCode;
  if (status >= HTTP_STATUS.BAD_REQUEST && status < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return new AppError(ERRORS.BAD_REQUEST, { cause: err });
  }

  return new AppError(ERRORS.INTERNAL_SERVER_ERROR, { cause: err });
};

// La causa técnica de un error solo se expone fuera de producción, para depurar.
const buildDetails = ({ details, cause }) => {
  if (!cause || config.isProduction) return details;
  return { ...details, cause: cause.message ?? String(cause) };
};

// Los errores esperados (4xx: datos inválidos, recurso o ruta inexistente) se registran como
// warning; las fallas del servidor (5xx), como error y con el stack de la causa original.
const logError = (req, error) => {
  const summary = `${req.method} ${req.originalUrl} → ${error.statusCode} ${error.code}: ${error.message}`;
  const meta = error.details ? { details: error.details } : {};

  if (error.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    const origin = error.cause ?? error;
    logger.error(summary, { ...meta, stack: origin.stack ?? String(origin) });
    return;
  }
  logger.warning(summary, meta);
};

// Único punto de la API que construye respuestas de error. Todas tienen la misma forma:
// { status: 'error', code, message, details }
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const error = toAppError(err);
  logError(req, error);

  res.status(error.statusCode).json({
    status: 'error',
    code: error.code,
    message: error.message,
    details: buildDetails(error),
  });
};
