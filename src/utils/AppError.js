import { HTTP_STATUS } from '../constants/index.js';

// Error de negocio con status HTTP asociado. Lo lanzan los Services
// y lo traduce a respuesta el middleware de errores.
export default class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }

  static badRequest(message) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST);
  }

  static forbidden(message) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN);
  }

  static notFound(message) {
    return new AppError(message, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(message) {
    return new AppError(message, HTTP_STATUS.CONFLICT);
  }
}
