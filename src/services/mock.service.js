import config from '../config/index.js';
import userRepository from '../repositories/user.repository.js';
import orderRepository from '../repositories/order.repository.js';
import deliveryRepository from '../repositories/delivery.repository.js';
import userService from './user.service.js';
import { USER_ROLES, MOCKS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { generateUsers, generateCouriers } from '../mocks/user.mock.js';
import { generateOrders } from '../mocks/order.mock.js';
import { generateDeliveries } from '../mocks/delivery.mock.js';

const VALID_ROLES = Object.values(USER_ROLES);

// Proporción usada en las respuestas simuladas para que los clientes
// tengan varios pedidos y los repartidores varias entregas.
const ORDERS_PER_CUSTOMER = 3;
const DELIVERIES_PER_COURIER = 4;

const toCollectionIds = (docs) => docs.map((doc) => doc._id);

class MockService {
  constructor({ userRepository, orderRepository, deliveryRepository, hashPassword }) {
    this.userRepository = userRepository;
    this.orderRepository = orderRepository;
    this.deliveryRepository = deliveryRepository;
    this.hashPassword = hashPassword;
  }

  // ---------- Validaciones ----------

  parseQty(value, { name = 'qty', fallback = MOCKS.DEFAULT_QTY, min = 1 } = {}) {
    if (value === undefined || value === '') return fallback;
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < min || qty > MOCKS.MAX_QTY) {
      throw AppError.badRequest(`"${name}" debe ser un entero entre ${min} y ${MOCKS.MAX_QTY}.`);
    }
    return qty;
  }

  parseRole(role) {
    if (!role) return undefined;
    const normalizedRole = String(role).toUpperCase();
    if (!VALID_ROLES.includes(normalizedRole)) {
      throw AppError.badRequest(`Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}.`);
    }
    return normalizedRole;
  }

  // La carga en la base solo se permite fuera de producción.
  ensureSeedAllowed() {
    if (config.isProduction) {
      throw AppError.forbidden('La carga de datos de prueba está deshabilitada en producción.');
    }
  }

  // ---------- Armado de datos (sin tocar la base) ----------

  // Todos los usuarios simulados comparten la contraseña MOCKS.PASSWORD, ya hasheada.
  async buildUsers(qty, role) {
    const passwordHash = await this.hashPassword(MOCKS.PASSWORD);
    return generateUsers(qty, { role, passwordHash });
  }

  async buildCouriers(qty) {
    const passwordHash = await this.hashPassword(MOCKS.PASSWORD);
    return generateCouriers(qty, { passwordHash });
  }

  // Cada pedido pertenece a un cliente existente en `customerIds` y tiene
  // exactamente una entrega, asignada a un repartidor de `courierIds` si corresponde.
  buildOrdersWithDeliveries(qty, { customerIds, courierIds }) {
    const orders = generateOrders(qty, { customerIds });
    const deliveries = generateDeliveries(orders, { courierIds });
    return { orders, deliveries };
  }

  // ---------- Endpoints que solo devuelven datos simulados ----------

  async getMockUsers({ qty, role } = {}) {
    return this.buildUsers(this.parseQty(qty), this.parseRole(role));
  }

  async getMockCouriers({ qty } = {}) {
    return this.buildCouriers(this.parseQty(qty));
  }

  // Devuelve también los clientes para que las referencias de los pedidos se puedan seguir.
  async getMockOrders({ qty } = {}) {
    const orderQty = this.parseQty(qty);
    const customers = await this.buildUsers(Math.ceil(orderQty / ORDERS_PER_CUSTOMER), USER_ROLES.USER);
    const orders = generateOrders(orderQty, { customerIds: toCollectionIds(customers) });
    return { customers, orders };
  }

  async getMockDeliveries({ qty } = {}) {
    const deliveryQty = this.parseQty(qty);
    const customers = await this.buildUsers(Math.ceil(deliveryQty / ORDERS_PER_CUSTOMER), USER_ROLES.USER);
    const couriers = await this.buildCouriers(Math.ceil(deliveryQty / DELIVERIES_PER_COURIER));
    const { orders, deliveries } = this.buildOrdersWithDeliveries(deliveryQty, {
      customerIds: toCollectionIds(customers),
      courierIds: toCollectionIds(couriers),
    });
    return { customers, couriers, orders, deliveries };
  }

  // ---------- Endpoints que insertan en MongoDB ----------

  async seedUsers({ qty, role } = {}) {
    this.ensureSeedAllowed();
    const users = await this.buildUsers(this.parseQty(qty), this.parseRole(role));
    const inserted = await this.userRepository.createMany(users);
    return { insertados: inserted, coleccion: 'users' };
  }

  async seedCouriers({ qty } = {}) {
    this.ensureSeedAllowed();
    const couriers = await this.buildCouriers(this.parseQty(qty));
    const inserted = await this.userRepository.createMany(couriers);
    return { insertados: inserted, coleccion: 'users', rol: USER_ROLES.COURIER };
  }

  // Genera pedidos (con su entrega) para clientes y repartidores de prueba que ya están en la base.
  // Nunca usa usuarios reales: así los datos de prueba no se mezclan y se pueden limpiar.
  async seedOrders({ qty } = {}) {
    this.ensureSeedAllowed();
    const orderQty = this.parseQty(qty);

    const [customerIds, courierIds] = await Promise.all([
      this.userRepository.findIdsByEmailDomain(MOCKS.EMAIL_DOMAIN, { role: USER_ROLES.USER }),
      this.userRepository.findIdsByEmailDomain(MOCKS.EMAIL_DOMAIN, { role: USER_ROLES.COURIER }),
    ]);
    if (customerIds.length === 0 || courierIds.length === 0) {
      throw AppError.conflict(
        'Se necesitan clientes (USER) y repartidores (COURIER) de prueba en la base. ' +
          'Cargalos antes con POST /api/mocks/seed/users y POST /api/mocks/seed/couriers.'
      );
    }

    const { orders, deliveries } = this.buildOrdersWithDeliveries(orderQty, { customerIds, courierIds });
    const insertedOrders = await this.orderRepository.createMany(orders);
    const insertedDeliveries = await this.deliveryRepository.createMany(deliveries);
    return { insertados: insertedOrders, coleccion: 'orders', entregas: insertedDeliveries };
  }

  // Carga completa y coherente: clientes, repartidores, pedidos de esos clientes
  // y entregas de esos pedidos, todo relacionado entre sí.
  async seedDataset({ users, couriers, orders } = {}) {
    this.ensureSeedAllowed();
    const usersQty = this.parseQty(users, { name: 'users', fallback: MOCKS.DATASET.USERS });
    const couriersQty = this.parseQty(couriers, { name: 'couriers', fallback: MOCKS.DATASET.COURIERS });
    const ordersQty = this.parseQty(orders, { name: 'orders', fallback: MOCKS.DATASET.ORDERS });

    const customers = await this.buildUsers(usersQty, USER_ROLES.USER);
    const courierDocs = await this.buildCouriers(couriersQty);
    const { orders: orderDocs, deliveries } = this.buildOrdersWithDeliveries(ordersQty, {
      customerIds: toCollectionIds(customers),
      courierIds: toCollectionIds(courierDocs),
    });

    // Se insertan en orden de dependencia: primero los referenciados.
    const insertedUsers = await this.userRepository.createMany(customers);
    const insertedCouriers = await this.userRepository.createMany(courierDocs);
    const insertedOrders = await this.orderRepository.createMany(orderDocs);
    const insertedDeliveries = await this.deliveryRepository.createMany(deliveries);

    return {
      insertados: {
        users: insertedUsers,
        couriers: insertedCouriers,
        orders: insertedOrders,
        deliveries: insertedDeliveries,
      },
    };
  }

  // Elimina solo lo generado por el módulo de mocks: usuarios con el dominio de prueba,
  // sus pedidos y las entregas de esos pedidos o de esos repartidores.
  async clearMockData() {
    this.ensureSeedAllowed();
    const userIds = await this.userRepository.findIdsByEmailDomain(MOCKS.EMAIL_DOMAIN);
    const orderIds = await this.orderRepository.findIdsByCustomers(userIds);

    const deliveries = await this.deliveryRepository.deleteByOrdersOrCouriers({ orderIds, courierIds: userIds });
    const orders = await this.orderRepository.deleteByIds(orderIds);
    const users = await this.userRepository.deleteByIds(userIds);
    return { eliminados: { users, orders, deliveries } };
  }
}

export default new MockService({
  userRepository,
  orderRepository,
  deliveryRepository,
  hashPassword: (password) => userService.hashPassword(password),
});
