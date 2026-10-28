import config from '../config/index.js';
import logger from '../logger/index.js';
import userRepository from '../repositories/user.repository.js';
import orderRepository from '../repositories/order.repository.js';
import deliveryRepository from '../repositories/delivery.repository.js';
import userService from './user.service.js';
import { USER_ROLES, MOCKS } from '../constants/index.js';
import {
  InvalidRoleError,
  InvalidMockQuantityError,
  NegativeMockQuantityError,
  MockQuantityOutOfRangeError,
  MockSeedForbiddenError,
  MockSeedRequirementsError,
  MockGenerationError,
  MockSeedFailedError,
  MockClearFailedError,
} from '../errors/index.js';
import { generateUsers, generateCouriers } from '../mocks/user.mock.js';
import { generateOrders } from '../mocks/order.mock.js';
import { generateDeliveries } from '../mocks/delivery.mock.js';

const VALID_ROLES = Object.values(USER_ROLES);
// Un entero escrito como tal: "10" o "-3". No lo son "abc", "2.5" ni "1e2".
const INTEGER_REGEX = /^[+-]?\d+$/;

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

  // Cada motivo de rechazo tiene su propio error: no es un entero, es negativo o está fuera de rango.
  parseQty(value, { name = 'qty', fallback = MOCKS.DEFAULT_QTY, min = 1 } = {}) {
    if (value === undefined || value === '') return fallback;
    const context = { param: name, received: value, min, max: MOCKS.MAX_QTY };

    // Un parámetro repetido (?qty=1&qty=2) llega como array y tampoco es una cantidad válida.
    const isIntegerText = ['string', 'number'].includes(typeof value) && INTEGER_REGEX.test(String(value).trim());
    if (!isIntegerText) throw new InvalidMockQuantityError(context);

    const qty = Number(value);
    if (qty < 0) throw new NegativeMockQuantityError(context);
    if (qty < min || qty > MOCKS.MAX_QTY) throw new MockQuantityOutOfRangeError(context);
    return qty;
  }

  parseRole(role) {
    if (!role) return undefined;
    const normalizedRole = String(role).toUpperCase();
    if (!VALID_ROLES.includes(normalizedRole)) throw new InvalidRoleError(normalizedRole, VALID_ROLES);
    return normalizedRole;
  }

  // La carga en la base solo se permite fuera de producción.
  ensureSeedAllowed() {
    if (config.isProduction) throw new MockSeedForbiddenError();
  }

  // ---------- Fallas controladas ----------

  // Cualquier falla al generar (Faker, hash de la contraseña, relaciones incompletas)
  // sale como un error del dominio en lugar de un error genérico.
  async generate(build) {
    try {
      return await build();
    } catch (error) {
      throw new MockGenerationError(error);
    }
  }

  // Ejecuta un paso de la carga contra MongoDB. Si falla, deshace lo que esta carga haya
  // llegado a insertar (`created`) y lanza un error controlado en lugar del de Mongoose.
  async runSeedStep(collection, operation, created = {}) {
    try {
      return await operation();
    } catch (error) {
      const rolledBack = await this.rollback(created);
      throw new MockSeedFailedError({ collection, rolledBack, cause: error });
    }
  }

  // Borra por id solo los documentos de esta carga: nunca toca lo que ya estaba en la base.
  async rollback({ userIds = [], orderIds = [] }) {
    if (userIds.length === 0 && orderIds.length === 0) return true;
    try {
      await this.deliveryRepository.deleteByOrdersOrCouriers({ orderIds });
      await this.orderRepository.deleteByIds(orderIds);
      await this.userRepository.deleteByIds(userIds);
      logger.warning('Carga de datos de prueba fallida: se deshizo lo insertado', {
        users: userIds.length,
        orders: orderIds.length,
      });
      return true;
    } catch (error) {
      logger.error('No se pudo deshacer la carga parcial de datos de prueba: pueden quedar datos a medias', {
        stack: error.stack,
      });
      return false;
    }
  }

  // ---------- Armado de datos (sin tocar la base) ----------

  // Los usuarios simulados salen sin contraseña: los GET no la devuelven.
  async buildUsers(qty, role) {
    return this.generate(() => generateUsers(qty, { role }));
  }

  async buildCouriers(qty) {
    return this.generate(() => generateCouriers(qty));
  }

  // Solo los seed guardan usuarios: recién ahí se agrega la contraseña MOCKS.PASSWORD hasheada,
  // que el modelo exige. El hash se calcula una vez y lo comparten todos.
  async withPassword(users) {
    return this.generate(async () => {
      const password = await this.hashPassword(MOCKS.PASSWORD);
      return users.map((user) => ({ ...user, password }));
    });
  }

  async buildOrders(qty, { customerIds }) {
    return this.generate(() => generateOrders(qty, { customerIds }));
  }

  // Cada pedido pertenece a un cliente existente en `customerIds` y tiene
  // exactamente una entrega, asignada a un repartidor de `courierIds` si corresponde.
  async buildOrdersWithDeliveries(qty, { customerIds, courierIds }) {
    return this.generate(() => {
      const orders = generateOrders(qty, { customerIds });
      const deliveries = generateDeliveries(orders, { courierIds });
      return { orders, deliveries };
    });
  }

  // ---------- Endpoints que solo devuelven datos simulados ----------

  async getMockUsers({ qty, role } = {}) {
    const users = await this.buildUsers(this.parseQty(qty), this.parseRole(role));
    logger.debug(`Mocks: generados ${users.length} usuarios simulados${role ? ` (${role})` : ''}`);
    return users;
  }

  async getMockCouriers({ qty } = {}) {
    const couriers = await this.buildCouriers(this.parseQty(qty));
    logger.debug(`Mocks: generados ${couriers.length} repartidores simulados`);
    return couriers;
  }

  // Devuelve también los clientes para que las referencias de los pedidos se puedan seguir.
  async getMockOrders({ qty } = {}) {
    const orderQty = this.parseQty(qty);
    const customers = await this.buildUsers(Math.ceil(orderQty / ORDERS_PER_CUSTOMER), USER_ROLES.USER);
    const orders = await this.buildOrders(orderQty, { customerIds: toCollectionIds(customers) });
    logger.debug(`Mocks: generados ${orders.length} pedidos simulados para ${customers.length} clientes`);
    return { customers, orders };
  }

  async getMockDeliveries({ qty } = {}) {
    const deliveryQty = this.parseQty(qty);
    const customers = await this.buildUsers(Math.ceil(deliveryQty / ORDERS_PER_CUSTOMER), USER_ROLES.USER);
    const couriers = await this.buildCouriers(Math.ceil(deliveryQty / DELIVERIES_PER_COURIER));
    const { orders, deliveries } = await this.buildOrdersWithDeliveries(deliveryQty, {
      customerIds: toCollectionIds(customers),
      courierIds: toCollectionIds(couriers),
    });
    logger.debug(`Mocks: generadas ${deliveries.length} entregas simuladas con sus pedidos y usuarios`);
    return { customers, couriers, orders, deliveries };
  }

  // ---------- Endpoints que insertan en MongoDB ----------

  async seedUsers({ qty, role } = {}) {
    this.ensureSeedAllowed();
    const users = await this.withPassword(await this.buildUsers(this.parseQty(qty), this.parseRole(role)));
    const inserted = await this.runSeedStep('users', () => this.userRepository.createMany(users), {
      userIds: toCollectionIds(users),
    });
    logger.info(`Mocks: cargados ${inserted} usuarios de prueba en MongoDB`);
    return { insertados: inserted, coleccion: 'users' };
  }

  async seedCouriers({ qty } = {}) {
    this.ensureSeedAllowed();
    const couriers = await this.withPassword(await this.buildCouriers(this.parseQty(qty)));
    const inserted = await this.runSeedStep('users', () => this.userRepository.createMany(couriers), {
      userIds: toCollectionIds(couriers),
    });
    logger.info(`Mocks: cargados ${inserted} repartidores de prueba en MongoDB`);
    return { insertados: inserted, coleccion: 'users', rol: USER_ROLES.COURIER };
  }

  // Genera pedidos (con su entrega) para clientes y repartidores de prueba que ya están en la base.
  // Nunca usa usuarios reales: así los datos de prueba no se mezclan y se pueden limpiar.
  async seedOrders({ qty } = {}) {
    this.ensureSeedAllowed();
    const orderQty = this.parseQty(qty);

    const [customerIds, courierIds] = await this.runSeedStep('users', () =>
      Promise.all([
        this.userRepository.findIdsByEmailDomain(MOCKS.EMAIL_DOMAIN, { role: USER_ROLES.USER }),
        this.userRepository.findIdsByEmailDomain(MOCKS.EMAIL_DOMAIN, { role: USER_ROLES.COURIER }),
      ])
    );
    if (customerIds.length === 0 || courierIds.length === 0) {
      throw new MockSeedRequirementsError(
        'Se necesitan clientes (USER) y repartidores (COURIER) de prueba en la base. ' +
          'Cargalos antes con POST /api/mocks/seed/users y POST /api/mocks/seed/couriers.',
        { customers: customerIds.length, couriers: courierIds.length }
      );
    }

    const { orders, deliveries } = await this.buildOrdersWithDeliveries(orderQty, { customerIds, courierIds });
    // Los usuarios ya estaban en la base: si algo falla solo se deshacen los pedidos de esta carga.
    const created = { orderIds: toCollectionIds(orders) };
    const insertedOrders = await this.runSeedStep('orders', () => this.orderRepository.createMany(orders), created);
    const insertedDeliveries = await this.runSeedStep(
      'deliveries',
      () => this.deliveryRepository.createMany(deliveries),
      created
    );
    logger.info(`Mocks: creados ${insertedOrders} pedidos de prueba con ${insertedDeliveries} entregas`);
    return { insertados: insertedOrders, coleccion: 'orders', entregas: insertedDeliveries };
  }

  // Carga completa y coherente: clientes, repartidores, pedidos de esos clientes
  // y entregas de esos pedidos, todo relacionado entre sí.
  async seedDataset({ users, couriers, orders } = {}) {
    this.ensureSeedAllowed();
    const usersQty = this.parseQty(users, { name: 'users', fallback: MOCKS.DATASET.USERS });
    const couriersQty = this.parseQty(couriers, { name: 'couriers', fallback: MOCKS.DATASET.COURIERS });
    const ordersQty = this.parseQty(orders, { name: 'orders', fallback: MOCKS.DATASET.ORDERS });

    const customers = await this.withPassword(await this.buildUsers(usersQty, USER_ROLES.USER));
    const courierDocs = await this.withPassword(await this.buildCouriers(couriersQty));
    const { orders: orderDocs, deliveries } = await this.buildOrdersWithDeliveries(ordersQty, {
      customerIds: toCollectionIds(customers),
      courierIds: toCollectionIds(courierDocs),
    });

    // Se insertan en orden de dependencia: primero los referenciados.
    // Si un paso falla, se deshace todo lo insertado por esta carga para no dejarla a medias.
    const created = {
      userIds: toCollectionIds([...customers, ...courierDocs]),
      orderIds: toCollectionIds(orderDocs),
    };
    const insertedUsers = await this.runSeedStep('users', () => this.userRepository.createMany(customers), created);
    const insertedCouriers = await this.runSeedStep(
      'users',
      () => this.userRepository.createMany(courierDocs),
      created
    );
    const insertedOrders = await this.runSeedStep(
      'orders',
      () => this.orderRepository.createMany(orderDocs),
      created
    );
    const insertedDeliveries = await this.runSeedStep(
      'deliveries',
      () => this.deliveryRepository.createMany(deliveries),
      created
    );

    const inserted = {
      users: insertedUsers,
      couriers: insertedCouriers,
      orders: insertedOrders,
      deliveries: insertedDeliveries,
    };
    logger.info('Mocks: carga completa de datos de prueba en MongoDB', inserted);
    return { insertados: inserted };
  }

  // Elimina solo lo generado por el módulo de mocks: usuarios con el dominio de prueba,
  // sus pedidos y las entregas de esos pedidos o de esos repartidores.
  async clearMockData() {
    this.ensureSeedAllowed();
    try {
      const userIds = await this.userRepository.findIdsByEmailDomain(MOCKS.EMAIL_DOMAIN);
      const orderIds = await this.orderRepository.findIdsByCustomers(userIds);

      const deliveries = await this.deliveryRepository.deleteByOrdersOrCouriers({ orderIds, courierIds: userIds });
      const orders = await this.orderRepository.deleteByIds(orderIds);
      const users = await this.userRepository.deleteByIds(userIds);
      logger.info('Mocks: datos de prueba eliminados de MongoDB', { users, orders, deliveries });
      return { eliminados: { users, orders, deliveries } };
    } catch (error) {
      throw new MockClearFailedError(error);
    }
  }
}

export default new MockService({
  userRepository,
  orderRepository,
  deliveryRepository,
  hashPassword: (password) => userService.hashPassword(password),
});
