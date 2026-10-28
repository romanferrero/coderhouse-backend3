import { expect } from 'chai';
import { api } from './helpers/api.js';
import { expectSuccess, expectError } from './helpers/assertions.js';

// No usa la base de datos: no hay nada que limpiar.
describe('Logger — /api/loggerTest', () => {
  it('GET informa los niveles registrados según el entorno de test', async () => {
    const payload = expectSuccess(await api.get('/api/loggerTest'), 200);

    expect(payload).to.have.all.keys('nivelMinimo', 'registrados', 'omitidos', 'enErrorLog');
    // Con NODE_ENV=test el nivel mínimo es warning.
    expect(payload).to.deep.equal({
      nivelMinimo: 'warning',
      registrados: ['warning', 'error', 'fatal'],
      omitidos: ['debug', 'http', 'info'],
      enErrorLog: ['error', 'fatal'],
    });
  });

  it('cada nivel emitido aparece una sola vez entre registrados y omitidos', async () => {
    const { registrados, omitidos } = expectSuccess(await api.get('/api/loggerTest'), 200);

    expect([...omitidos, ...registrados]).to.deep.equal(['debug', 'http', 'info', 'warning', 'error', 'fatal']);
  });

  it('404 ROUTE_NOT_FOUND con un método que no existe', async () => {
    const body = expectError(await api.post('/api/loggerTest'), 404, 'ROUTE_NOT_FOUND');

    expect(body.details).to.deep.equal({ method: 'POST', path: '/api/loggerTest' });
  });
});
