import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectSuccess, expectError, expectPaginated } from './helpers/assertions.js';
import { NON_EXISTENT_ID, createCustomer, createCourier, createOrder, createDelivery } from './helpers/fixtures.js';

const ALL_STATUSES = ['WAITING_COURIER', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

describe('Entregas — /api/deliveries', () => {
  let customer;
  let courier;

  beforeEach(async () => {
    await clearDatabase();
    customer = await createCustomer();
    courier = await createCourier();
  });

  after(clearDatabase);

  describe('GET /api/deliveries', () => {
    it('lista las entregas con el pedido y el repartidor populados', async () => {
      const order = await createOrder({ customer, status: 'IN_TRANSIT' });
      await createDelivery({ order, courier });

      const payload = expectSuccess(await api.get('/api/deliveries'), 200);

      expectPaginated(payload, { total: 1 });
      const [delivery] = payload.docs;
      expect(delivery).to.include.all.keys('_id', 'order', 'courier', 'trackingCode', 'status', 'estimatedAt');
      expect(delivery.status).to.equal('IN_TRANSIT');
      expect(delivery.trackingCode).to.match(/^TRK-[A-Z0-9]{10}$/);
      expect(delivery.order).to.include({ _id: order._id, code: order.code, status: 'IN_TRANSIT' });
      expect(delivery.courier).to.include({ _id: courier._id, email: courier.email, role: 'COURIER' });
      expect(delivery.courier).to.not.have.property('password');
      // Los comprobantes no viajan en el listado: se consultan con GET /api/deliveries/:did/proofs.
      expect(delivery).to.not.have.property('proofs');
    });

    it('filtra por estado (acepta minúsculas)', async () => {
      await createDelivery({ order: await createOrder({ customer, status: 'PENDING' }) });
      await createDelivery({ order: await createOrder({ customer, status: 'DELIVERED' }), courier });

      const payload = expectSuccess(await api.get('/api/deliveries').query({ status: 'waiting_courier' }), 200);

      expectPaginated(payload, { total: 1 });
      expect(payload.docs[0].status).to.equal('WAITING_COURIER');
      expect(payload.docs[0].courier).to.equal(null);
    });

    it('400 INVALID_STATUS con un estado inexistente', async () => {
      const body = expectError(await api.get('/api/deliveries').query({ status: 'perdida' }), 400, 'INVALID_STATUS');

      expect(body.details).to.deep.equal({ received: 'perdida', allowed: ALL_STATUSES });
    });
  });

  describe('GET /api/deliveries/:did', () => {
    it('devuelve la entrega', async () => {
      const order = await createOrder({ customer, status: 'ASSIGNED' });
      const delivery = await createDelivery({ order, courier });

      const payload = expectSuccess(await api.get(`/api/deliveries/${delivery._id}`), 200);

      expect(payload).to.include({ _id: delivery._id, trackingCode: delivery.trackingCode, status: 'ASSIGNED' });
      expect(payload.order._id).to.equal(order._id);
      expect(payload.courier._id).to.equal(courier._id);
    });

    it('404 DELIVERY_NOT_FOUND si la entrega no existe', async () => {
      const body = expectError(await api.get(`/api/deliveries/${NON_EXISTENT_ID}`), 404, 'DELIVERY_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });
  });
});
