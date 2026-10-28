import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectSuccess, expectError, expectPaginated, expectPublicUser } from './helpers/assertions.js';
import {
  NON_EXISTENT_ID,
  ORDER_PAYLOAD_TOTAL,
  buildOrderPayload,
  createCustomer,
  createCourier,
  createOrder,
  createDelivery,
} from './helpers/fixtures.js';

const ALL_STATUSES = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
const ALL_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const expectOrderShape = (order) => {
  expect(order).to.include.all.keys(
    '_id',
    'code',
    'customer',
    'items',
    'total',
    'shippingAddress',
    'status',
    'priority',
    'createdAt',
    'updatedAt'
  );
  expect(order.code).to.match(/^ORD-[A-Z0-9]{8}$/);
  expect(order.items).to.be.an('array').that.is.not.empty;
  expect(ALL_STATUSES).to.include(order.status);
  expect(ALL_PRIORITIES).to.include(order.priority);
  // El cliente viene populado con sus datos de contacto, sin la contraseña.
  expectPublicUser(order.customer);
};

describe('Pedidos — /api/orders', () => {
  let customer;

  // Cada test arranca con la base vacía y un cliente válido creado para él.
  beforeEach(async () => {
    await clearDatabase();
    customer = await createCustomer();
  });

  after(clearDatabase);

  describe('GET /api/orders', () => {
    it('lista los pedidos paginados con el cliente populado', async () => {
      await createOrder({ customer });
      await createOrder({ customer });

      const payload = expectSuccess(await api.get('/api/orders'), 200);

      expectPaginated(payload, { total: 2 });
      expect(payload.docs).to.have.lengthOf(2);
      payload.docs.forEach((order) => {
        expectOrderShape(order);
        expect(order.customer._id).to.equal(customer._id);
        expect(order.customer.email).to.equal(customer.email);
      });
    });

    it('devuelve una página vacía si no hay pedidos', async () => {
      const payload = expectSuccess(await api.get('/api/orders'), 200);

      expectPaginated(payload, { total: 0 });
      expect(payload.docs).to.deep.equal([]);
    });

    it('filtra por estado y prioridad (acepta minúsculas)', async () => {
      await createOrder({ customer, status: 'PENDING', priority: 'HIGH' });
      await createOrder({ customer, status: 'PENDING', priority: 'LOW' });
      await createOrder({ customer, status: 'CANCELLED', priority: 'HIGH' });

      const payload = expectSuccess(await api.get('/api/orders').query({ status: 'pending', priority: 'high' }), 200);

      expectPaginated(payload, { total: 1 });
      expect(payload.docs[0].status).to.equal('PENDING');
      expect(payload.docs[0].priority).to.equal('HIGH');
    });

    it('respeta page y limit', async () => {
      await Promise.all([1, 2, 3].map(() => createOrder({ customer })));

      const payload = expectSuccess(await api.get('/api/orders').query({ page: 2, limit: 2 }), 200);

      expectPaginated(payload, { total: 3, page: 2, limit: 2 });
      expect(payload.docs).to.have.lengthOf(1);
    });

    it('400 INVALID_STATUS con un estado inexistente', async () => {
      const body = expectError(await api.get('/api/orders').query({ status: 'volando' }), 400, 'INVALID_STATUS');

      expect(body.details).to.deep.equal({ received: 'volando', allowed: ALL_STATUSES });
    });

    it('400 INVALID_PRIORITY con una prioridad inexistente', async () => {
      const body = expectError(await api.get('/api/orders').query({ priority: 'ya' }), 400, 'INVALID_PRIORITY');

      expect(body.details).to.deep.equal({ received: 'ya', allowed: ALL_PRIORITIES });
    });
  });

  describe('GET /api/orders/:oid', () => {
    it('devuelve el pedido con sus datos', async () => {
      const order = await createOrder({ customer });

      const payload = expectSuccess(await api.get(`/api/orders/${order._id}`), 200);

      expectOrderShape(payload);
      expect(payload._id).to.equal(order._id);
      expect(payload.code).to.equal(order.code);
      expect(payload.total).to.equal(order.total);
      expect(payload.items).to.deep.equal(order.items);
      expect(payload.shippingAddress).to.deep.equal(order.shippingAddress);
      expect(payload.customer._id).to.equal(customer._id);
    });

    it('404 ORDER_NOT_FOUND si el pedido no existe', async () => {
      const body = expectError(await api.get(`/api/orders/${NON_EXISTENT_ID}`), 404, 'ORDER_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
      expect(body.message).to.include(NON_EXISTENT_ID);
    });

    it('404 ORDER_NOT_FOUND si el id tiene formato inválido', async () => {
      const body = expectError(await api.get('/api/orders/123'), 404, 'ORDER_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: '123' });
    });
  });

  describe('POST /api/orders', () => {
    it('crea el pedido en PENDING con código y total calculados por la API', async () => {
      const payload = expectSuccess(await api.post('/api/orders').send(buildOrderPayload(customer)), 201);

      expectOrderShape(payload);
      expect(payload.status).to.equal('PENDING');
      expect(payload.priority).to.equal('NORMAL');
      expect(payload.total).to.equal(ORDER_PAYLOAD_TOTAL);
      expect(payload.items).to.deep.equal(buildOrderPayload(customer).items);
      expect(payload.shippingAddress).to.deep.equal(buildOrderPayload(customer).shippingAddress);
      expect(payload.customer._id).to.equal(customer._id);
    });

    it('el pedido creado se puede consultar por id', async () => {
      const created = expectSuccess(await api.post('/api/orders').send(buildOrderPayload(customer)), 201);

      const found = expectSuccess(await api.get(`/api/orders/${created._id}`), 200);

      expect(found).to.deep.equal(created);
    });

    it('acepta la prioridad (en minúsculas) e ignora status, code y total enviados', async () => {
      const body = buildOrderPayload(customer, { priority: 'urgent', status: 'DELIVERED', code: 'MIO', total: 1 });

      const payload = expectSuccess(await api.post('/api/orders').send(body), 201);

      expect(payload.priority).to.equal('URGENT');
      expect(payload.status).to.equal('PENDING');
      expect(payload.code).to.match(/^ORD-[A-Z0-9]{8}$/);
      expect(payload.total).to.equal(ORDER_PAYLOAD_TOTAL);
    });

    it('400 MISSING_REQUIRED_FIELDS si faltan los datos obligatorios', async () => {
      const body = expectError(await api.post('/api/orders').send({}), 400, 'MISSING_REQUIRED_FIELDS');

      expect(body.details).to.deep.equal({ fields: ['customer', 'items', 'shippingAddress'] });
    });

    it('400 MISSING_REQUIRED_FIELDS si la dirección está incompleta', async () => {
      const order = buildOrderPayload(customer, { shippingAddress: { street: 'Av. Corrientes 1234', city: '  ' } });

      const body = expectError(await api.post('/api/orders').send(order), 400, 'MISSING_REQUIRED_FIELDS');

      expect(body.details).to.deep.equal({ fields: ['shippingAddress.city', 'shippingAddress.zipCode'] });
    });

    it('400 VALIDATION_ERROR si el pedido no tiene ítems', async () => {
      const body = expectError(
        await api.post('/api/orders').send(buildOrderPayload(customer, { items: [] })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'items' });
    });

    it('400 VALIDATION_ERROR si un ítem tiene una cantidad inválida', async () => {
      const items = [
        { title: 'Silla', quantity: 1, unitPrice: 100 },
        { title: 'Mesa', quantity: 0, unitPrice: 100 },
      ];

      const body = expectError(
        await api.post('/api/orders').send(buildOrderPayload(customer, { items })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'items[1].quantity' });
    });

    it('400 VALIDATION_ERROR si un ítem tiene un precio negativo', async () => {
      const items = [{ title: 'Silla', quantity: 1, unitPrice: -5 }];

      const body = expectError(
        await api.post('/api/orders').send(buildOrderPayload(customer, { items })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'items[0].unitPrice' });
    });

    it('400 INVALID_FIELD_TYPE si customer no es texto', async () => {
      const order = buildOrderPayload(customer, { customer: { $ne: null } });

      const body = expectError(await api.post('/api/orders').send(order), 400, 'INVALID_FIELD_TYPE');

      expect(body.details).to.deep.equal({ fields: ['customer'], expected: 'string' });
    });

    it('400 INVALID_PRIORITY con una prioridad inexistente', async () => {
      const order = buildOrderPayload(customer, { priority: 'ya' });

      const body = expectError(await api.post('/api/orders').send(order), 400, 'INVALID_PRIORITY');

      expect(body.details).to.deep.equal({ received: 'ya', allowed: ALL_PRIORITIES });
    });

    it('400 VALIDATION_ERROR si el cliente no tiene rol USER', async () => {
      const courier = await createCourier();

      const body = expectError(
        await api.post('/api/orders').send(buildOrderPayload(courier)),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'customer', role: 'COURIER' });
    });

    it('404 USER_NOT_FOUND si el cliente no existe', async () => {
      const order = buildOrderPayload(customer, { customer: NON_EXISTENT_ID });

      const body = expectError(await api.post('/api/orders').send(order), 404, 'USER_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });

    it('400 INVALID_JSON si el body no es un JSON válido', async () => {
      const res = await api.post('/api/orders').set('Content-Type', 'application/json').send('{"customer":');

      const body = expectError(res, 400, 'INVALID_JSON');

      expect(body.details).to.have.property('cause').that.is.a('string');
    });

    it('no guarda nada si los datos son inválidos', async () => {
      await api.post('/api/orders').send(buildOrderPayload(customer, { items: [] }));

      const payload = expectSuccess(await api.get('/api/orders'), 200);

      expect(payload.total).to.equal(0);
    });
  });

  describe('PATCH /api/orders/:oid/status', () => {
    it('cancela un pedido PENDING y el cambio queda guardado', async () => {
      const order = await createOrder({ customer });

      const payload = expectSuccess(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'cancelled' }),
        200
      );

      expectOrderShape(payload);
      expect(payload._id).to.equal(order._id);
      expect(payload.status).to.equal('CANCELLED');
      const found = expectSuccess(await api.get(`/api/orders/${order._id}`), 200);
      expect(found.status).to.equal('CANCELLED');
    });

    it('avanza un pedido con repartidor y actualiza también su entrega', async () => {
      const courier = await createCourier();
      const order = await createOrder({ customer, status: 'IN_TRANSIT' });
      const delivery = await createDelivery({ order, courier });

      const payload = expectSuccess(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'DELIVERED' }),
        200
      );

      expect(payload.status).to.equal('DELIVERED');
      const updatedDelivery = expectSuccess(await api.get(`/api/deliveries/${delivery._id}`), 200);
      expect(updatedDelivery.status).to.equal('DELIVERED');
      expect(updatedDelivery.deliveredAt).to.be.a('string');
      expect(updatedDelivery.courier._id).to.equal(courier._id);
    });

    it('si el pedido ya tiene ese estado lo devuelve sin cambios', async () => {
      const order = await createOrder({ customer });

      const payload = expectSuccess(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'PENDING' }),
        200
      );

      expect(payload.status).to.equal('PENDING');
      expect(payload.updatedAt).to.equal(order.updatedAt);
    });

    it('400 INVALID_STATUS con un estado inexistente', async () => {
      const order = await createOrder({ customer });

      const body = expectError(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'volando' }),
        400,
        'INVALID_STATUS'
      );

      expect(body.details).to.deep.equal({ received: 'volando', allowed: ALL_STATUSES });
    });

    it('400 INVALID_STATUS si el body no trae status', async () => {
      const order = await createOrder({ customer });

      const body = expectError(await api.patch(`/api/orders/${order._id}/status`).send({}), 400, 'INVALID_STATUS');

      expect(body.details).to.deep.equal({ received: null, allowed: ALL_STATUSES });
    });

    it('404 ORDER_NOT_FOUND si el pedido no existe', async () => {
      const body = expectError(
        await api.patch(`/api/orders/${NON_EXISTENT_ID}/status`).send({ status: 'CANCELLED' }),
        404,
        'ORDER_NOT_FOUND'
      );

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });

    it('409 ORDER_STATUS_TRANSITION_NOT_ALLOWED si salta estados', async () => {
      const order = await createOrder({ customer });

      const body = expectError(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'DELIVERED' }),
        409,
        'ORDER_STATUS_TRANSITION_NOT_ALLOWED'
      );

      expect(body.details).to.deep.equal({ from: 'PENDING', to: 'DELIVERED', allowed: ['ASSIGNED', 'CANCELLED'] });
    });

    it('409 ORDER_STATUS_TRANSITION_NOT_ALLOWED si el pedido ya está cancelado', async () => {
      const order = await createOrder({ customer, status: 'CANCELLED' });

      const body = expectError(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'PENDING' }),
        409,
        'ORDER_STATUS_TRANSITION_NOT_ALLOWED'
      );

      expect(body.details).to.deep.equal({ from: 'CANCELLED', to: 'PENDING', allowed: [] });
    });

    it('409 ORDER_COURIER_REQUIRED si se asigna un pedido sin repartidor', async () => {
      const order = await createOrder({ customer });

      const body = expectError(
        await api.patch(`/api/orders/${order._id}/status`).send({ status: 'ASSIGNED' }),
        409,
        'ORDER_COURIER_REQUIRED'
      );

      expect(body.details).to.deep.equal({ id: order._id, status: 'ASSIGNED' });
      const found = expectSuccess(await api.get(`/api/orders/${order._id}`), 200);
      expect(found.status).to.equal('PENDING');
    });
  });
});
