import { fakerES as faker } from '@faker-js/faker';
import {
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  DELIVERY_STATUS_BY_ORDER_STATUS,
  DELIVERY_STATUSES_WITH_COURIER,
} from '../constants/index.js';

// Plazo máximo de entrega (en días) según la prioridad del pedido.
const MAX_DAYS_BY_PRIORITY = Object.freeze({
  [ORDER_PRIORITY.URGENT]: 1,
  [ORDER_PRIORITY.HIGH]: 2,
  [ORDER_PRIORITY.NORMAL]: 5,
  [ORDER_PRIORITY.LOW]: 10,
});

const RECENT_DAYS = 7;

// Genera la entrega de un pedido con la misma forma que DeliveryModel:
// - el estado se deriva del estado del pedido (no se elige al azar),
// - solo lleva repartidor si el estado lo requiere,
// - la fecha estimada depende de la prioridad.
export const generateDelivery = ({ order, courierIds }) => {
  const status = DELIVERY_STATUS_BY_ORDER_STATUS[order.status];
  const needsCourier = DELIVERY_STATUSES_WITH_COURIER.includes(status);

  if (needsCourier && courierIds.length === 0) {
    throw new Error(`No hay repartidores para asignar a la entrega del pedido ${order.code}.`);
  }

  return {
    _id: faker.database.mongodbObjectId(),
    order: order._id,
    courier: needsCourier ? faker.helpers.arrayElement(courierIds) : null,
    trackingCode: `TRK-${faker.string.alphanumeric({ length: 10, casing: 'upper' })}`,
    status,
    estimatedAt: faker.date.soon({ days: MAX_DAYS_BY_PRIORITY[order.priority] }),
    deliveredAt: status === DELIVERY_STATUS.DELIVERED ? faker.date.recent({ days: RECENT_DAYS }) : null,
  };
};

export const generateDeliveries = (orders, { courierIds }) =>
  orders.map((order) => generateDelivery({ order, courierIds }));
