import { HTTP_STATUS } from '../constants/index.js';

const define = (code, status, message) => Object.freeze({ code, status, message });

// Diccionario de errores: único lugar donde se define el código, el status HTTP
// y el mensaje por defecto de cada error que la API puede responder.
export const ERROR_DICTIONARY = Object.freeze({
  // ---------- Validación de datos de entrada ----------
  VALIDATION_ERROR: define('VALIDATION_ERROR', HTTP_STATUS.BAD_REQUEST, 'Los datos enviados no son válidos.'),
  MISSING_REQUIRED_FIELDS: define(
    'MISSING_REQUIRED_FIELDS',
    HTTP_STATUS.BAD_REQUEST,
    'Faltan campos obligatorios.'
  ),
  BLANK_REQUIRED_FIELDS: define(
    'BLANK_REQUIRED_FIELDS',
    HTTP_STATUS.BAD_REQUEST,
    'Hay campos obligatorios que no pueden quedar vacíos.'
  ),
  NO_FIELDS_TO_UPDATE: define(
    'NO_FIELDS_TO_UPDATE',
    HTTP_STATUS.BAD_REQUEST,
    'No se enviaron campos para actualizar.'
  ),
  INVALID_ROLE: define('INVALID_ROLE', HTTP_STATUS.BAD_REQUEST, 'El rol indicado no es válido.'),
  INVALID_STATUS: define('INVALID_STATUS', HTTP_STATUS.BAD_REQUEST, 'El estado indicado no es válido.'),
  INVALID_PRIORITY: define('INVALID_PRIORITY', HTTP_STATUS.BAD_REQUEST, 'La prioridad indicada no es válida.'),

  // ---------- Usuarios ----------
  USER_NOT_FOUND: define('USER_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'Usuario no encontrado.'),
  USER_EMAIL_ALREADY_REGISTERED: define(
    'USER_EMAIL_ALREADY_REGISTERED',
    HTTP_STATUS.CONFLICT,
    'El email ya está registrado.'
  ),
  LAST_ADMIN_REQUIRED: define(
    'LAST_ADMIN_REQUIRED',
    HTTP_STATUS.CONFLICT,
    'No se puede quitar o eliminar al último usuario ADMIN.'
  ),

  // ---------- Productos ----------
  PRODUCT_NOT_FOUND: define('PRODUCT_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'Producto no encontrado.'),
  PRODUCT_CODE_ALREADY_EXISTS: define(
    'PRODUCT_CODE_ALREADY_EXISTS',
    HTTP_STATUS.CONFLICT,
    'Ya existe un producto con ese código.'
  ),

  // ---------- Pedidos y entregas ----------
  ORDER_NOT_FOUND: define('ORDER_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'Pedido no encontrado.'),
  DELIVERY_NOT_FOUND: define('DELIVERY_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'Entrega no encontrada.'),

  // ---------- Módulo de mocks ----------
  MOCK_INVALID_QUANTITY: define(
    'MOCK_INVALID_QUANTITY',
    HTTP_STATUS.BAD_REQUEST,
    'La cantidad de datos a generar debe ser un número entero.'
  ),
  MOCK_NEGATIVE_QUANTITY: define(
    'MOCK_NEGATIVE_QUANTITY',
    HTTP_STATUS.BAD_REQUEST,
    'La cantidad de datos a generar no puede ser negativa.'
  ),
  MOCK_QUANTITY_OUT_OF_RANGE: define(
    'MOCK_QUANTITY_OUT_OF_RANGE',
    HTTP_STATUS.BAD_REQUEST,
    'La cantidad de datos a generar está fuera del rango permitido.'
  ),
  MOCK_SEED_FORBIDDEN: define(
    'MOCK_SEED_FORBIDDEN',
    HTTP_STATUS.FORBIDDEN,
    'La carga de datos de prueba está deshabilitada en producción.'
  ),
  MOCK_SEED_REQUIREMENTS_NOT_MET: define(
    'MOCK_SEED_REQUIREMENTS_NOT_MET',
    HTTP_STATUS.CONFLICT,
    'Faltan datos de prueba previos para realizar la carga.'
  ),
  MOCK_GENERATION_FAILED: define(
    'MOCK_GENERATION_FAILED',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'No se pudieron generar los datos de prueba.'
  ),
  MOCK_SEED_FAILED: define(
    'MOCK_SEED_FAILED',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'No se pudieron cargar los datos de prueba en la base de datos.'
  ),
  MOCK_CLEAR_FAILED: define(
    'MOCK_CLEAR_FAILED',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'No se pudieron eliminar los datos de prueba de la base de datos.'
  ),

  // ---------- Errores de la request y de infraestructura ----------
  ROUTE_NOT_FOUND: define('ROUTE_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'Ruta no encontrada.'),
  INVALID_JSON: define('INVALID_JSON', HTTP_STATUS.BAD_REQUEST, 'El cuerpo de la solicitud no es un JSON válido.'),
  PAYLOAD_TOO_LARGE: define(
    'PAYLOAD_TOO_LARGE',
    HTTP_STATUS.PAYLOAD_TOO_LARGE,
    'El cuerpo de la solicitud supera el tamaño permitido.'
  ),
  BAD_REQUEST: define('BAD_REQUEST', HTTP_STATUS.BAD_REQUEST, 'La solicitud no pudo procesarse.'),
  DUPLICATE_KEY: define('DUPLICATE_KEY', HTTP_STATUS.CONFLICT, 'Ya existe un registro con ese valor.'),
  INTERNAL_SERVER_ERROR: define(
    'INTERNAL_SERVER_ERROR',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'Error interno del servidor.'
  ),
});
