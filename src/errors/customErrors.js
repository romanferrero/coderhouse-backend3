import AppError from './AppError.js';
import { ERROR_DICTIONARY as ERRORS } from './errorDictionary.js';

// Errores personalizados del dominio de ShipNow. Cada clase representa un caso
// concreto, toma su código y status del diccionario y arma el mensaje y los detalles.

const list = (values) => values.join(', ');

// ---------- Validación de datos de entrada ----------

// Un campo con formato o valor incorrecto (email, precio, stock, edad, etc.).
export class InvalidDataError extends AppError {
  constructor(message, details = null) {
    super(ERRORS.VALIDATION_ERROR, { message, details });
  }
}

export class MissingFieldsError extends AppError {
  constructor(fields) {
    super(ERRORS.MISSING_REQUIRED_FIELDS, {
      message: `Faltan campos obligatorios: ${list(fields)}.`,
      details: { fields },
    });
  }
}

export class BlankFieldsError extends AppError {
  constructor(fields) {
    super(ERRORS.BLANK_REQUIRED_FIELDS, {
      message: `Estos campos no pueden quedar vacíos: ${list(fields)}.`,
      details: { fields },
    });
  }
}

export class NoFieldsToUpdateError extends AppError {
  constructor(allowed) {
    super(ERRORS.NO_FIELDS_TO_UPDATE, {
      message: `No se enviaron campos para actualizar. Permitidos: ${list(allowed)}.`,
      details: { allowed },
    });
  }
}

export class InvalidRoleError extends AppError {
  constructor(received, allowed) {
    super(ERRORS.INVALID_ROLE, {
      message: `Rol inválido. Valores permitidos: ${list(allowed)}.`,
      details: { received: received ?? null, allowed },
    });
  }
}

export class InvalidStatusError extends AppError {
  constructor(received, allowed) {
    super(ERRORS.INVALID_STATUS, {
      message: `Estado inválido. Valores permitidos: ${list(allowed)}.`,
      details: { received: received ?? null, allowed },
    });
  }
}

export class InvalidPriorityError extends AppError {
  constructor(received, allowed) {
    super(ERRORS.INVALID_PRIORITY, {
      message: `Prioridad inválida. Valores permitidos: ${list(allowed)}.`,
      details: { received: received ?? null, allowed },
    });
  }
}

// ---------- Usuarios ----------

export class UserNotFoundError extends AppError {
  constructor(id) {
    super(ERRORS.USER_NOT_FOUND, { message: `Usuario con id "${id}" no encontrado.`, details: { id } });
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor(email) {
    super(ERRORS.USER_EMAIL_ALREADY_REGISTERED, {
      message: `El email "${email}" ya está registrado.`,
      details: { email },
    });
  }
}

// Regla de negocio: el sistema nunca puede quedarse sin administradores.
export class LastAdminError extends AppError {
  constructor() {
    super(ERRORS.LAST_ADMIN_REQUIRED);
  }
}

// ---------- Productos ----------

export class ProductNotFoundError extends AppError {
  constructor(id) {
    super(ERRORS.PRODUCT_NOT_FOUND, { message: `Producto con id "${id}" no encontrado.`, details: { id } });
  }
}

export class ProductCodeAlreadyExistsError extends AppError {
  constructor(code) {
    super(ERRORS.PRODUCT_CODE_ALREADY_EXISTS, {
      message: `Ya existe un producto con el código "${code}".`,
      details: { code },
    });
  }
}

// ---------- Pedidos y entregas ----------

export class OrderNotFoundError extends AppError {
  constructor(id) {
    super(ERRORS.ORDER_NOT_FOUND, { message: `Pedido con id "${id}" no encontrado.`, details: { id } });
  }
}

export class DeliveryNotFoundError extends AppError {
  constructor(id) {
    super(ERRORS.DELIVERY_NOT_FOUND, { message: `Entrega con id "${id}" no encontrada.`, details: { id } });
  }
}

// ---------- Módulo de mocks ----------

// La cantidad no es un número entero ("abc", "2.5", un valor repetido, etc.).
export class InvalidMockQuantityError extends AppError {
  constructor({ param, received, min, max }) {
    super(ERRORS.MOCK_INVALID_QUANTITY, {
      message: `"${param}" debe ser un número entero entre ${min} y ${max}.`,
      details: { param, received, min, max },
    });
  }
}

export class NegativeMockQuantityError extends AppError {
  constructor({ param, received, min, max }) {
    super(ERRORS.MOCK_NEGATIVE_QUANTITY, {
      message: `"${param}" no puede ser negativo. Debe ser un entero entre ${min} y ${max}.`,
      details: { param, received, min, max },
    });
  }
}

// La cantidad es un entero, pero es 0 o supera el máximo permitido por request.
export class MockQuantityOutOfRangeError extends AppError {
  constructor({ param, received, min, max }) {
    super(ERRORS.MOCK_QUANTITY_OUT_OF_RANGE, {
      message: `"${param}" debe estar entre ${min} y ${max}.`,
      details: { param, received, min, max },
    });
  }
}

export class MockSeedForbiddenError extends AppError {
  constructor() {
    super(ERRORS.MOCK_SEED_FORBIDDEN);
  }
}

// Se pidió cargar pedidos sin tener antes clientes y repartidores de prueba.
export class MockSeedRequirementsError extends AppError {
  constructor(message, details = null) {
    super(ERRORS.MOCK_SEED_REQUIREMENTS_NOT_MET, { message, details });
  }
}

export class MockGenerationError extends AppError {
  constructor(cause) {
    super(ERRORS.MOCK_GENERATION_FAILED, { cause });
  }
}

// Falla de MongoDB durante la inserción. `rolledBack` indica si se pudo deshacer lo ya insertado.
export class MockSeedFailedError extends AppError {
  constructor({ collection, rolledBack, cause }) {
    super(ERRORS.MOCK_SEED_FAILED, {
      message: `No se pudieron cargar los datos de prueba en la colección "${collection}".`,
      details: { collection, rolledBack },
      cause,
    });
  }
}

export class MockClearFailedError extends AppError {
  constructor(cause) {
    super(ERRORS.MOCK_CLEAR_FAILED, { cause });
  }
}

// ---------- Errores de la request ----------

export class RouteNotFoundError extends AppError {
  constructor(method, path) {
    super(ERRORS.ROUTE_NOT_FOUND, {
      message: `Ruta no encontrada: ${method} ${path}`,
      details: { method, path },
    });
  }
}
