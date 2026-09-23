import { fakerES as faker } from '@faker-js/faker';
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js';

const MAX_ITEMS = 4;
const MAX_QUANTITY = 5;
const MIN_UNIT_PRICE = 500;
const MAX_UNIT_PRICE = 80000;

const generateItem = () => ({
  title: faker.commerce.productName(),
  quantity: faker.number.int({ min: 1, max: MAX_QUANTITY }),
  unitPrice: faker.number.int({ min: MIN_UNIT_PRICE, max: MAX_UNIT_PRICE }),
});

// Genera un pedido con la misma forma que OrderModel, asociado al cliente recibido.
// El total se calcula a partir de los ítems, nunca se inventa.
export const generateOrder = ({ customerId }) => {
  const items = faker.helpers.multiple(generateItem, { count: { min: 1, max: MAX_ITEMS } });
  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  return {
    _id: faker.database.mongodbObjectId(),
    code: `ORD-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`,
    customer: customerId,
    items,
    total,
    shippingAddress: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      zipCode: faker.location.zipCode(),
    },
    status: faker.helpers.arrayElement(Object.values(ORDER_STATUS)),
    priority: faker.helpers.arrayElement(Object.values(ORDER_PRIORITY)),
  };
};

// Reparte los pedidos entre los clientes disponibles (un cliente puede tener varios).
export const generateOrders = (qty, { customerIds }) =>
  Array.from({ length: qty }, () => generateOrder({ customerId: faker.helpers.arrayElement(customerIds) }));
