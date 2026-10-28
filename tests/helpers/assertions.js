import { expect } from 'chai';
import { ERROR_DICTIONARY } from '../../src/errors/index.js';

// Respuesta exitosa: { status: 'success', payload }. Devuelve el payload para seguir validándolo.
export const expectSuccess = (res, httpStatus) => {
  expect(res.status).to.equal(httpStatus);
  expect(res.headers['content-type']).to.match(/application\/json/);
  expect(res.body).to.have.all.keys('status', 'payload');
  expect(res.body.status).to.equal('success');
  return res.body.payload;
};

// Respuesta de error con el formato del módulo de errores: { status: 'error', code, message, details }.
// Además del status esperado, comprueba que coincida con el que define el diccionario para ese code.
export const expectError = (res, httpStatus, code) => {
  expect(ERROR_DICTIONARY, `"${code}" no está en el diccionario de errores`).to.have.property(code);
  expect(res.status).to.equal(httpStatus);
  expect(ERROR_DICTIONARY[code].status).to.equal(httpStatus);
  expect(res.headers['content-type']).to.match(/application\/json/);
  expect(res.body).to.have.all.keys('status', 'code', 'message', 'details');
  expect(res.body.status).to.equal('error');
  expect(res.body.code).to.equal(code);
  expect(res.body.message).to.be.a('string').that.is.not.empty;
  return res.body;
};

// Estructura de los listados paginados.
export const expectPaginated = (payload, { total, page = 1, limit = 10 }) => {
  expect(payload).to.have.all.keys('docs', 'total', 'page', 'limit', 'totalPages', 'hasPrevPage', 'hasNextPage');
  expect(payload.docs).to.be.an('array');
  expect(payload.total).to.equal(total);
  expect(payload.page).to.equal(page);
  expect(payload.limit).to.equal(limit);
  expect(payload.totalPages).to.equal(Math.max(Math.ceil(total / limit), 1));
  expect(payload.hasPrevPage).to.equal(page > 1);
  expect(payload.hasNextPage).to.equal(page < payload.totalPages);
};

// Un usuario tal como lo expone la API: nunca con la contraseña.
export const expectPublicUser = (user) => {
  expect(user).to.include.all.keys('_id', 'first_name', 'last_name', 'email', 'role');
  expect(user).to.not.have.property('password');
};
