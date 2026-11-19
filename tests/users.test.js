import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectSuccess, expectError, expectPaginated, expectPublicUser } from './helpers/assertions.js';
import {
  NON_EXISTENT_ID,
  buildUserPayload,
  createAdmin,
  createCourier,
  createCustomer,
} from './helpers/fixtures.js';
import { UserModel } from '../src/models/user.model.js';

const ALL_ROLES = ['ADMIN', 'USER', 'COURIER'];

describe('Usuarios — /api/users', () => {
  beforeEach(clearDatabase);
  after(clearDatabase);

  describe('GET /api/users', () => {
    it('lista los usuarios paginados y sin la contraseña', async () => {
      await createCustomer();
      await createCourier();
      await createAdmin();

      const payload = expectSuccess(await api.get('/api/users'), 200);

      expectPaginated(payload, { total: 3 });
      expect(payload.docs).to.have.lengthOf(3);
      payload.docs.forEach((user) => {
        expectPublicUser(user);
        expect(ALL_ROLES).to.include(user.role);
        // Los documentos no viajan en el listado: se consultan con GET /api/users/:uid/documents.
        expect(user).to.not.have.property('documents');
      });
    });

    it('devuelve una página vacía si no hay usuarios', async () => {
      const payload = expectSuccess(await api.get('/api/users'), 200);

      expectPaginated(payload, { total: 0 });
      expect(payload.docs).to.deep.equal([]);
    });

    it('filtra por rol (acepta minúsculas)', async () => {
      await createCustomer();
      await createCourier();
      await createCourier();

      const payload = expectSuccess(await api.get('/api/users').query({ role: 'courier' }), 200);

      expectPaginated(payload, { total: 2 });
      payload.docs.forEach((user) => expect(user.role).to.equal('COURIER'));
    });

    it('respeta page y limit', async () => {
      await Promise.all([1, 2, 3].map(() => createCustomer()));

      const payload = expectSuccess(await api.get('/api/users').query({ page: 1, limit: 2 }), 200);

      expectPaginated(payload, { total: 3, page: 1, limit: 2 });
      expect(payload.docs).to.have.lengthOf(2);
    });

    it('400 INVALID_ROLE con un rol inexistente', async () => {
      const body = expectError(await api.get('/api/users').query({ role: 'jefe' }), 400, 'INVALID_ROLE');

      expect(body.details).to.deep.equal({ received: 'JEFE', allowed: ALL_ROLES });
    });
  });

  describe('GET /api/users/:uid', () => {
    it('devuelve el usuario sin la contraseña', async () => {
      const user = await createCustomer();

      const payload = expectSuccess(await api.get(`/api/users/${user._id}`), 200);

      expectPublicUser(payload);
      expect(payload).to.include({
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: 'USER',
      });
    });

    it('404 USER_NOT_FOUND si el usuario no existe', async () => {
      const body = expectError(await api.get(`/api/users/${NON_EXISTENT_ID}`), 404, 'USER_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });

    it('404 USER_NOT_FOUND si el id tiene formato inválido', async () => {
      const body = expectError(await api.get('/api/users/123'), 404, 'USER_NOT_FOUND');

      expect(body.details).to.deep.equal({ id: '123' });
    });
  });

  describe('POST /api/users', () => {
    it('registra un usuario con rol USER y la contraseña hasheada', async () => {
      const body = buildUserPayload({ email: 'Ana.Paz@ShipNow.test', role: 'ADMIN' });

      const payload = expectSuccess(await api.post('/api/users').send(body), 201);

      expectPublicUser(payload);
      expect(payload).to.include({ first_name: 'Ana', last_name: 'Paz', email: 'ana.paz@shipnow.test', age: 31 });
      expect(payload.role).to.equal('USER');
      const stored = await UserModel.findById(payload._id).lean();
      expect(stored.password).to.not.equal(body.password);
      expect(stored.password).to.match(/^\$2[aby]\$/);
    });

    it('400 MISSING_REQUIRED_FIELDS si faltan campos obligatorios', async () => {
      const body = expectError(
        await api.post('/api/users').send({ first_name: 'Ana' }),
        400,
        'MISSING_REQUIRED_FIELDS'
      );

      expect(body.details).to.deep.equal({ fields: ['last_name', 'email', 'password'] });
    });

    it('400 INVALID_FIELD_TYPE si un campo de texto llega como array', async () => {
      const res = await api.post('/api/users').send(buildUserPayload({ email: ['ana@mail.com'] }));

      const body = expectError(res, 400, 'INVALID_FIELD_TYPE');

      expect(body.details).to.deep.equal({ fields: ['email'], expected: 'string' });
    });

    it('400 VALIDATION_ERROR con un email inválido', async () => {
      const body = expectError(
        await api.post('/api/users').send(buildUserPayload({ email: 'mal' })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'email' });
    });

    it('400 VALIDATION_ERROR con una contraseña corta', async () => {
      const body = expectError(
        await api.post('/api/users').send(buildUserPayload({ password: '123' })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'password' });
    });

    it('400 VALIDATION_ERROR con una edad inválida', async () => {
      const body = expectError(
        await api.post('/api/users').send(buildUserPayload({ age: -3 })),
        400,
        'VALIDATION_ERROR'
      );

      expect(body.details).to.deep.equal({ field: 'age' });
    });

    it('409 USER_EMAIL_ALREADY_REGISTERED si el email ya existe', async () => {
      const existing = await createCustomer();

      const body = expectError(
        await api.post('/api/users').send(buildUserPayload({ email: existing.email })),
        409,
        'USER_EMAIL_ALREADY_REGISTERED'
      );

      expect(body.details).to.deep.equal({ email: existing.email });
    });

    it('413 PAYLOAD_TOO_LARGE si el body supera los 100 KB', async () => {
      const res = await api.post('/api/users').send(buildUserPayload({ first_name: 'a'.repeat(120 * 1024) }));

      const body = expectError(res, 413, 'PAYLOAD_TOO_LARGE');

      expect(body.details).to.equal(null);
    });
  });

  describe('PUT /api/users/:uid', () => {
    it('actualiza solo los campos enviados', async () => {
      const user = await createCustomer();

      const payload = expectSuccess(
        await api.put(`/api/users/${user._id}`).send({ first_name: 'Ana María', age: 40 }),
        200
      );

      expectPublicUser(payload);
      expect(payload).to.include({ _id: user._id, first_name: 'Ana María', age: 40, email: user.email });
    });

    it('400 NO_FIELDS_TO_UPDATE si no se envía ningún campo editable', async () => {
      const user = await createCustomer();

      const body = expectError(
        await api.put(`/api/users/${user._id}`).send({ role: 'ADMIN' }),
        400,
        'NO_FIELDS_TO_UPDATE'
      );

      expect(body.details.allowed).to.deep.equal(['first_name', 'last_name', 'email', 'age', 'password']);
    });

    it('400 BLANK_REQUIRED_FIELDS si se intenta vaciar un campo obligatorio', async () => {
      const user = await createCustomer();

      const body = expectError(
        await api.put(`/api/users/${user._id}`).send({ last_name: '   ' }),
        400,
        'BLANK_REQUIRED_FIELDS'
      );

      expect(body.details).to.deep.equal({ fields: ['last_name'] });
    });

    it('404 USER_NOT_FOUND si el usuario no existe', async () => {
      expectError(await api.put(`/api/users/${NON_EXISTENT_ID}`).send({ first_name: 'Ana' }), 404, 'USER_NOT_FOUND');
    });

    it('409 USER_EMAIL_ALREADY_REGISTERED si el email lo usa otro usuario', async () => {
      const user = await createCustomer();
      const other = await createCustomer();

      expectError(
        await api.put(`/api/users/${user._id}`).send({ email: other.email }),
        409,
        'USER_EMAIL_ALREADY_REGISTERED'
      );
    });
  });

  describe('PATCH /api/users/:uid/role', () => {
    it('cambia el rol (acepta minúsculas)', async () => {
      const user = await createCustomer();

      const payload = expectSuccess(await api.patch(`/api/users/${user._id}/role`).send({ role: 'courier' }), 200);

      expectPublicUser(payload);
      expect(payload._id).to.equal(user._id);
      expect(payload.role).to.equal('COURIER');
    });

    it('400 INVALID_ROLE con un rol inexistente', async () => {
      const user = await createCustomer();

      const body = expectError(
        await api.patch(`/api/users/${user._id}/role`).send({ role: 'jefe' }),
        400,
        'INVALID_ROLE'
      );

      expect(body.details).to.deep.equal({ received: 'JEFE', allowed: ALL_ROLES });
    });

    it('400 INVALID_ROLE si el body no trae role', async () => {
      const user = await createCustomer();

      const body = expectError(await api.patch(`/api/users/${user._id}/role`).send({}), 400, 'INVALID_ROLE');

      expect(body.details).to.deep.equal({ received: null, allowed: ALL_ROLES });
    });

    it('404 USER_NOT_FOUND si el usuario no existe', async () => {
      expectError(
        await api.patch(`/api/users/${NON_EXISTENT_ID}/role`).send({ role: 'ADMIN' }),
        404,
        'USER_NOT_FOUND'
      );
    });

    it('409 LAST_ADMIN_REQUIRED si se quita el rol al último ADMIN', async () => {
      const admin = await createAdmin();

      expectError(
        await api.patch(`/api/users/${admin._id}/role`).send({ role: 'USER' }),
        409,
        'LAST_ADMIN_REQUIRED'
      );
    });
  });

  describe('DELETE /api/users/:uid', () => {
    it('elimina el usuario y responde 204 sin body', async () => {
      const user = await createCustomer();

      const res = await api.delete(`/api/users/${user._id}`);

      expect(res.status).to.equal(204);
      expect(res.body).to.deep.equal({});
      expectError(await api.get(`/api/users/${user._id}`), 404, 'USER_NOT_FOUND');
    });

    it('404 USER_NOT_FOUND si el usuario no existe', async () => {
      expectError(await api.delete(`/api/users/${NON_EXISTENT_ID}`), 404, 'USER_NOT_FOUND');
    });

    it('409 LAST_ADMIN_REQUIRED si es el último ADMIN', async () => {
      const admin = await createAdmin();

      expectError(await api.delete(`/api/users/${admin._id}`), 409, 'LAST_ADMIN_REQUIRED');
    });
  });
});
