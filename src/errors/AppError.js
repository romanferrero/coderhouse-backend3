import { ERROR_DICTIONARY } from './errorDictionary.js';

// Error base de la API. Se construye a partir de una entrada del diccionario, que
// aporta el código y el status HTTP. Lo lanzan los Services (a través de las clases
// de customErrors.js) y lo convierte en respuesta el middleware de errores.
export default class AppError extends Error {
  // - message: reemplaza al mensaje por defecto del diccionario.
  // - details: datos extra para quien consume la API (campos, valores permitidos, etc.).
  // - cause: error original, cuando este error envuelve una falla técnica.
  constructor(definition = ERROR_DICTIONARY.INTERNAL_SERVER_ERROR, { message, details = null, cause } = {}) {
    super(message ?? definition.message, { cause });
    this.name = this.constructor.name;
    this.code = definition.code;
    this.statusCode = definition.status;
    this.details = details;
  }
}
