import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectSuccess, expectError, expectPaginated } from './helpers/assertions.js';
import { NON_EXISTENT_ID, createProduct } from './helpers/fixtures.js';

const PRODUCT_KEYS = ['_id', 'title', 'description', 'code', 'price', 'stock', 'category', 'status'];

const validProduct = (overrides = {}) => ({
  title: 'Caja chica',
  code: 'BOX-S',
  price: 1500,
  stock: 10,
  category: 'Embalaje',
  ...overrides,
});

describe('Productos — /api/products', () => {
  beforeEach(clearDatabase);
  after(clearDatabase);

  describe('GET /api/products', () => {
    it('lista solo los productos con stock por defecto', async () => {
      await createProduct();
      await createProduct({ stock: 0, status: 'OUT_OF_STOCK' });
      await createProduct({ status: 'DISCONTINUED' });

      const payload = expectSuccess(await api.get('/api/products'), 200);

      expectPaginated(payload, { total: 1 });
      expect(payload.docs[0]).to.have.all.keys(...PRODUCT_KEYS);
      expect(payload.docs[0].status).to.equal('AVAILABLE');
    });

    it('lista los productos sin stock si se piden', async () => {
      await createProduct({ stock: 0, status: 'OUT_OF_STOCK' });

      const payload = expectSuccess(await api.get('/api/products').query({ status: 'out_of_stock' }), 200);

      expectPaginated(payload, { total: 1 });
      expect(payload.docs[0].status).to.equal('OUT_OF_STOCK');
    });

    it('400 INVALID_STATUS si se piden los discontinuados', async () => {
      const body = expectError(
        await api.get('/api/products').query({ status: 'DISCONTINUED' }),
        400,
        'INVALID_STATUS'
      );

      expect(body.details).to.deep.equal({ received: 'DISCONTINUED', allowed: ['AVAILABLE', 'OUT_OF_STOCK'] });
    });
  });

  describe('GET /api/products/:pid', () => {
    it('devuelve el producto', async () => {
      const product = await createProduct();

      const payload = expectSuccess(await api.get(`/api/products/${product._id}`), 200);

      expect(payload).to.have.all.keys(...PRODUCT_KEYS);
      expect(payload).to.include({ _id: product._id, code: product.code, price: product.price });
    });

    it('404 PRODUCT_NOT_FOUND si el producto no existe', async () => {
      const body = expectError(await api.get(`/api/products/${NON_EXISTENT_ID}`), 404, 'PRODUCT_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });
  });

  describe('POST /api/products', () => {
    it('crea el producto con el estado derivado del stock', async () => {
      const payload = expectSuccess(await api.post('/api/products').send(validProduct({ stock: 0 })), 201);

      expect(payload).to.have.all.keys(...PRODUCT_KEYS);
      expect(payload).to.include({ code: 'BOX-S', price: 1500, stock: 0, category: 'embalaje' });
      expect(payload.status).to.equal('OUT_OF_STOCK');
    });

    it('400 MISSING_REQUIRED_FIELDS si faltan campos obligatorios', async () => {
      const body = expectError(
        await api.post('/api/products').send({ title: 'Caja' }),
        400,
        'MISSING_REQUIRED_FIELDS'
      );

      expect(body.details).to.deep.equal({ fields: ['code', 'price', 'category'] });
    });

    it('400 INVALID_FIELD_TYPE si el código llega como objeto', async () => {
      const body = expectError(
        await api.post('/api/products').send(validProduct({ code: { $ne: null } })),
        400,
        'INVALID_FIELD_TYPE'
      );

      expect(body.details).to.deep.equal({ fields: ['code'], expected: 'string' });
    });

    it('400 VALIDATION_ERROR con un precio negativo', async () => {
      const body = expectError(
        await api.post('/api/products').send(validProduct({ price: -1 })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'price' });
    });

    it('409 PRODUCT_CODE_ALREADY_EXISTS si el código está repetido', async () => {
      const existing = await createProduct();

      const body = expectError(
        await api.post('/api/products').send(validProduct({ code: existing.code })),
        409,
        'PRODUCT_CODE_ALREADY_EXISTS'
      );

      expect(body.details).to.deep.equal({ code: existing.code });
    });
  });

  describe('PUT /api/products/:pid', () => {
    it('actualiza los campos y recalcula el estado según el stock', async () => {
      const product = await createProduct();

      const payload = expectSuccess(await api.put(`/api/products/${product._id}`).send({ price: 1800, stock: 0 }), 200);

      expect(payload).to.include({ _id: product._id, price: 1800, stock: 0, status: 'OUT_OF_STOCK' });
    });

    it('400 NO_FIELDS_TO_UPDATE si no se envía ningún campo editable', async () => {
      const product = await createProduct();

      expectError(await api.put(`/api/products/${product._id}`).send({}), 400, 'NO_FIELDS_TO_UPDATE');
    });

    it('404 PRODUCT_NOT_FOUND si el producto no existe', async () => {
      expectError(await api.put(`/api/products/${NON_EXISTENT_ID}`).send({ price: 10 }), 404, 'PRODUCT_NOT_FOUND');
    });
  });

  describe('DELETE /api/products/:pid', () => {
    it('da de baja el producto (204) y deja de encontrarse', async () => {
      const product = await createProduct();

      const res = await api.delete(`/api/products/${product._id}`);

      expect(res.status).to.equal(204);
      expect(res.body).to.deep.equal({});
      expectError(await api.get(`/api/products/${product._id}`), 404, 'PRODUCT_NOT_FOUND');
    });

    it('404 PRODUCT_NOT_FOUND si el producto no existe', async () => {
      expectError(await api.delete(`/api/products/${NON_EXISTENT_ID}`), 404, 'PRODUCT_NOT_FOUND');
    });
  });
});
