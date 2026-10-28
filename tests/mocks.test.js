import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectSuccess, expectError } from './helpers/assertions.js';
import { buildUserPayload, createCustomer } from './helpers/fixtures.js';
import { UserModel } from '../src/models/user.model.js';
import { OrderModel } from '../src/models/order.model.js';
import { DeliveryModel } from '../src/models/delivery.model.js';

const MOCK_EMAIL = /@shipnow\.test$/;

const expectMockUser = (user) => {
  expect(user).to.have.all.keys('_id', 'first_name', 'last_name', 'email', 'age', 'role');
  expect(user._id).to.match(/^[a-f0-9]{24}$/);
  expect(user.email).to.match(MOCK_EMAIL);
  expect(user.age).to.be.within(18, 75);
};

const countCollections = async () => ({
  users: await UserModel.countDocuments(),
  orders: await OrderModel.countDocuments(),
  deliveries: await DeliveryModel.countDocuments(),
});

const EMPTY = { users: 0, orders: 0, deliveries: 0 };

describe('Mocks — /api/mocks', () => {
  beforeEach(clearDatabase);
  after(clearDatabase);

  describe('GET (solo generan datos, no escriben en la base)', () => {
    it('GET /api/mocks/users genera la cantidad pedida de usuarios sin contraseña', async () => {
      const payload = expectSuccess(await api.get('/api/mocks/users').query({ qty: 5 }), 200);

      expect(payload).to.be.an('array').with.lengthOf(5);
      payload.forEach((user) => {
        expectMockUser(user);
        expect(['USER', 'COURIER']).to.include(user.role);
      });
      expect(await countCollections()).to.deep.equal(EMPTY);
    });

    it('GET /api/mocks/users usa 10 por defecto y respeta el rol pedido', async () => {
      const payload = expectSuccess(await api.get('/api/mocks/users').query({ role: 'courier' }), 200);

      expect(payload).to.have.lengthOf(10);
      payload.forEach((user) => expect(user.role).to.equal('COURIER'));
    });

    it('GET /api/mocks/couriers genera repartidores', async () => {
      const payload = expectSuccess(await api.get('/api/mocks/couriers').query({ qty: 3 }), 200);

      expect(payload).to.have.lengthOf(3);
      payload.forEach((user) => {
        expectMockUser(user);
        expect(user.role).to.equal('COURIER');
      });
    });

    it('GET /api/mocks/orders genera pedidos relacionados con sus clientes', async () => {
      const payload = expectSuccess(await api.get('/api/mocks/orders').query({ qty: 4 }), 200);

      expect(payload).to.have.all.keys('customers', 'orders');
      expect(payload.customers).to.have.lengthOf(2); // un cliente cada 3 pedidos, redondeando hacia arriba
      expect(payload.orders).to.have.lengthOf(4);
      const customerIds = payload.customers.map((customer) => customer._id);
      payload.orders.forEach((order) => {
        expect(order.code).to.match(/^ORD-[A-Z0-9]{8}$/);
        expect(customerIds).to.include(order.customer);
        const total = order.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
        expect(order.total).to.equal(total);
      });
      expect(await countCollections()).to.deep.equal(EMPTY);
    });

    it('GET /api/mocks/deliveries genera entregas coherentes con sus pedidos', async () => {
      const payload = expectSuccess(await api.get('/api/mocks/deliveries').query({ qty: 6 }), 200);

      expect(payload).to.have.all.keys('customers', 'couriers', 'orders', 'deliveries');
      expect(payload.deliveries).to.have.lengthOf(6);
      const orderIds = payload.orders.map((order) => order._id);
      const courierIds = payload.couriers.map((courier) => courier._id);
      payload.deliveries.forEach((delivery) => {
        expect(orderIds).to.include(delivery.order);
        if (delivery.courier !== null) expect(courierIds).to.include(delivery.courier);
        expect(delivery.trackingCode).to.match(/^TRK-[A-Z0-9]{10}$/);
      });
    });

    it('400 MOCK_INVALID_QUANTITY si la cantidad no es un entero', async () => {
      const body = expectError(await api.get('/api/mocks/users').query({ qty: 'abc' }), 400, 'MOCK_INVALID_QUANTITY');

      expect(body.details).to.deep.equal({ param: 'qty', received: 'abc', min: 1, max: 100 });
    });

    it('400 MOCK_INVALID_QUANTITY si la cantidad es decimal o viene repetida', async () => {
      expectError(await api.get('/api/mocks/couriers').query({ qty: '2.5' }), 400, 'MOCK_INVALID_QUANTITY');
      expectError(await api.get('/api/mocks/users?qty=1&qty=2'), 400, 'MOCK_INVALID_QUANTITY');
    });

    it('400 MOCK_NEGATIVE_QUANTITY si la cantidad es negativa', async () => {
      const body = expectError(await api.get('/api/mocks/users').query({ qty: -5 }), 400, 'MOCK_NEGATIVE_QUANTITY');

      expect(body.details).to.deep.equal({ param: 'qty', received: '-5', min: 1, max: 100 });
    });

    it('400 MOCK_QUANTITY_OUT_OF_RANGE si la cantidad es 0 o supera el máximo', async () => {
      expectError(await api.get('/api/mocks/orders').query({ qty: 0 }), 400, 'MOCK_QUANTITY_OUT_OF_RANGE');
      const body = expectError(
        await api.get('/api/mocks/deliveries').query({ qty: 1000 }),
        400,
        'MOCK_QUANTITY_OUT_OF_RANGE'
      );

      expect(body.details).to.deep.equal({ param: 'qty', received: '1000', min: 1, max: 100 });
    });

    it('400 INVALID_ROLE si el rol no existe', async () => {
      const body = expectError(await api.get('/api/mocks/users').query({ qty: 2, role: 'jefe' }), 400, 'INVALID_ROLE');

      expect(body.details).to.deep.equal({ received: 'JEFE', allowed: ['ADMIN', 'USER', 'COURIER'] });
    });
  });

  describe('POST /api/mocks/seed (carga completa en MongoDB)', () => {
    it('inserta clientes, repartidores, pedidos y entregas relacionados', async () => {
      const res = await api.post('/api/mocks/seed').query({ users: 3, couriers: 2, orders: 5 });

      const payload = expectSuccess(res, 201);

      expect(payload).to.deep.equal({ insertados: { users: 3, couriers: 2, orders: 5, deliveries: 5 } });
      expect(await countCollections()).to.deep.equal({ users: 5, orders: 5, deliveries: 5 });
      expect(await UserModel.countDocuments({ email: MOCK_EMAIL })).to.equal(5);
      const listed = expectSuccess(await api.get('/api/orders'), 200);
      expect(listed.total).to.equal(5);
    });

    it('400 MOCK_NEGATIVE_QUANTITY indica qué parámetro es inválido y no inserta nada', async () => {
      const body = expectError(await api.post('/api/mocks/seed').query({ users: -1 }), 400, 'MOCK_NEGATIVE_QUANTITY');

      expect(body.details).to.deep.equal({ param: 'users', received: '-1', min: 1, max: 100 });
      expect(await countCollections()).to.deep.equal(EMPTY);
    });

    it('400 MOCK_QUANTITY_OUT_OF_RANGE si se piden demasiados pedidos', async () => {
      const body = expectError(
        await api.post('/api/mocks/seed').query({ orders: 999 }),
        400,
        'MOCK_QUANTITY_OUT_OF_RANGE'
      );

      expect(body.details.param).to.equal('orders');
    });
  });

  describe('POST /api/mocks/seed/{users,couriers,orders}', () => {
    it('carga usuarios con el rol pedido', async () => {
      const payload = expectSuccess(await api.post('/api/mocks/seed/users').query({ qty: 4, role: 'user' }), 201);

      expect(payload).to.deep.equal({ insertados: 4, coleccion: 'users' });
      expect(await UserModel.countDocuments({ role: 'USER', email: MOCK_EMAIL })).to.equal(4);
    });

    it('carga repartidores', async () => {
      const payload = expectSuccess(await api.post('/api/mocks/seed/couriers').query({ qty: 2 }), 201);

      expect(payload).to.deep.equal({ insertados: 2, coleccion: 'users', rol: 'COURIER' });
      expect(await UserModel.countDocuments({ role: 'COURIER' })).to.equal(2);
    });

    it('carga pedidos con sus entregas para los usuarios de prueba ya cargados', async () => {
      await api.post('/api/mocks/seed/users').query({ qty: 2, role: 'USER' });
      await api.post('/api/mocks/seed/couriers').query({ qty: 1 });

      const payload = expectSuccess(await api.post('/api/mocks/seed/orders').query({ qty: 3 }), 201);

      expect(payload).to.deep.equal({ insertados: 3, coleccion: 'orders', entregas: 3 });
      expect(await countCollections()).to.deep.equal({ users: 3, orders: 3, deliveries: 3 });
    });

    it('409 MOCK_SEED_REQUIREMENTS_NOT_MET si no hay usuarios de prueba', async () => {
      const body = expectError(
        await api.post('/api/mocks/seed/orders').query({ qty: 5 }),
        409,
        'MOCK_SEED_REQUIREMENTS_NOT_MET'
      );

      expect(body.details).to.deep.equal({ customers: 0, couriers: 0 });
    });

    it('400 MOCK_INVALID_QUANTITY en la carga de usuarios', async () => {
      expectError(await api.post('/api/mocks/seed/users').query({ qty: 'diez' }), 400, 'MOCK_INVALID_QUANTITY');
      expect(await countCollections()).to.deep.equal(EMPTY);
    });
  });

  describe('DELETE /api/mocks/seed', () => {
    it('borra solo los datos de prueba y conserva el resto', async () => {
      await api.post('/api/mocks/seed').query({ users: 2, couriers: 1, orders: 3 });
      const real = expectSuccess(
        await api.post('/api/users').send(buildUserPayload({ email: 'real@mail.com' })),
        201
      );

      const payload = expectSuccess(await api.delete('/api/mocks/seed'), 200);

      expect(payload).to.deep.equal({ eliminados: { users: 3, orders: 3, deliveries: 3 } });
      expect(await countCollections()).to.deep.equal({ users: 1, orders: 0, deliveries: 0 });
      expectSuccess(await api.get(`/api/users/${real._id}`), 200);
    });

    it('responde 200 con todo en 0 si no hay datos de prueba', async () => {
      await createCustomer({ email: 'otro@mail.com' });

      const payload = expectSuccess(await api.delete('/api/mocks/seed'), 200);

      expect(payload).to.deep.equal({ eliminados: { users: 0, orders: 0, deliveries: 0 } });
      expect((await countCollections()).users).to.equal(1);
    });
  });
});
