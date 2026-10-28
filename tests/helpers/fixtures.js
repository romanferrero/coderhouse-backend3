import bcrypt from 'bcryptjs';
import { generateUser } from '../../src/mocks/user.mock.js';
import { generateOrder } from '../../src/mocks/order.mock.js';
import { generateDelivery } from '../../src/mocks/delivery.mock.js';
import { UserModel } from '../../src/models/user.model.js';
import { OrderModel } from '../../src/models/order.model.js';
import { DeliveryModel } from '../../src/models/delivery.model.js';
import { ProductModel } from '../../src/models/product.model.js';
import { USER_ROLES, ORDER_STATUS, ORDER_PRIORITY, MOCKS, PRODUCT_STATUS } from '../../src/constants/index.js';

// Datos de prueba controlados: cada test crea lo que necesita con estas funciones, a partir
// de los generadores del módulo de mocks (emails @shipnow.test). Se insertan directo con los
// modelos para que la preparación no dependa de otro endpoint.

// Id con formato válido que no existe en la base.
export const NON_EXISTENT_ID = '64b7f0000000000000000000';

// El hash se calcula una sola vez: los modelos exigen contraseña y los tests no hacen login.
let passwordHash;
const getPasswordHash = async () => {
  passwordHash ??= await bcrypt.hash(MOCKS.PASSWORD, 4);
  return passwordHash;
};

const toPlain = (doc) => JSON.parse(JSON.stringify(doc.toObject()));

export const createUser = async ({ role = USER_ROLES.USER, ...overrides } = {}) => {
  const { _id, ...data } = generateUser({ role });
  const user = await UserModel.create({ ...data, password: await getPasswordHash(), ...overrides });
  return toPlain(user);
};

export const createCustomer = (overrides) => createUser({ ...overrides, role: USER_ROLES.USER });
export const createCourier = (overrides) => createUser({ ...overrides, role: USER_ROLES.COURIER });
export const createAdmin = (overrides) => createUser({ ...overrides, role: USER_ROLES.ADMIN });

export const createOrder = async ({ customer, status = ORDER_STATUS.PENDING, priority = ORDER_PRIORITY.NORMAL }) => {
  const { _id, createdAt, ...data } = generateOrder({ customerId: customer._id });
  const order = await OrderModel.create({ ...data, status, priority });
  return toPlain(order);
};

// Entrega del pedido, con el estado que corresponde al del pedido. Si se pasa un repartidor,
// queda asignado cuando el estado lo requiere.
export const createDelivery = async ({ order, courier }) => {
  const data = generateDelivery({
    order: { ...order, createdAt: new Date(order.createdAt) },
    courierIds: courier ? [courier._id] : [],
  });
  const delivery = await DeliveryModel.create(data);
  return toPlain(delivery);
};

let productSequence = 0;
export const createProduct = async (overrides = {}) => {
  productSequence += 1;
  const product = await ProductModel.create({
    title: 'Caja chica',
    code: `BOX-${productSequence}`,
    price: 1500,
    stock: 10,
    category: 'embalaje',
    status: PRODUCT_STATUS.AVAILABLE,
    ...overrides,
  });
  return toPlain(product);
};

// Body válido para POST /api/orders. Total esperado: 2 × 45000 + 1 × 30000.5 = 120000.5.
export const buildOrderPayload = (customer, overrides = {}) => ({
  customer: String(customer._id),
  items: [
    { title: 'Silla de madera', quantity: 2, unitPrice: 45000 },
    { title: 'Mesa ratona', quantity: 1, unitPrice: 30000.5 },
  ],
  shippingAddress: { street: 'Av. Corrientes 1234', city: 'Buenos Aires', zipCode: 'C1043' },
  ...overrides,
});
export const ORDER_PAYLOAD_TOTAL = 120000.5;

// Body válido para POST /api/users. Usa el dominio de prueba para identificar los datos generados.
export const buildUserPayload = (overrides = {}) => ({
  first_name: 'Ana',
  last_name: 'Paz',
  email: 'ana.paz@shipnow.test',
  password: 'secreto123',
  age: 31,
  ...overrides,
});
