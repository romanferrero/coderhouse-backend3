// Valores inmutables del dominio de ShipNow

// USER es el cliente que hace pedidos; COURIER es el repartidor.
export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
  COURIER: 'COURIER',
});

export const PRODUCT_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  DISCONTINUED: 'DISCONTINUED',
});

export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

export const ORDER_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const DELIVERY_STATUS = Object.freeze({
  WAITING_COURIER: 'WAITING_COURIER',
  ASSIGNED: 'ASSIGNED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

// Estado que debe tener la entrega según el estado de su pedido.
export const DELIVERY_STATUS_BY_ORDER_STATUS = Object.freeze({
  [ORDER_STATUS.PENDING]: DELIVERY_STATUS.WAITING_COURIER,
  [ORDER_STATUS.ASSIGNED]: DELIVERY_STATUS.ASSIGNED,
  [ORDER_STATUS.IN_TRANSIT]: DELIVERY_STATUS.IN_TRANSIT,
  [ORDER_STATUS.DELIVERED]: DELIVERY_STATUS.DELIVERED,
  [ORDER_STATUS.CANCELLED]: DELIVERY_STATUS.CANCELLED,
});

// Una entrega en estos estados siempre tiene un repartidor asignado.
export const DELIVERY_STATUSES_WITH_COURIER = Object.freeze([
  DELIVERY_STATUS.ASSIGNED,
  DELIVERY_STATUS.IN_TRANSIT,
  DELIVERY_STATUS.DELIVERED,
]);

export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
});

export const PAGINATION = Object.freeze({
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

export const PASSWORD_SALT_ROUNDS = 10;

export const MOCKS = Object.freeze({
  DEFAULT_QTY: 10,
  MAX_QTY: 100,
  // Todos los usuarios generados comparten este dominio: así se los identifica para limpiarlos.
  EMAIL_DOMAIN: 'shipnow.test',
  PASSWORD: 'coder123',
  // Roles que se generan al azar si no se pide uno en particular.
  RANDOM_ROLES: Object.freeze([USER_ROLES.USER, USER_ROLES.COURIER]),
});
