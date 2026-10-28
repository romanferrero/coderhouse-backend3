import { expect } from 'chai';
import { api } from './helpers/api.js';
import { expectError } from './helpers/assertions.js';

// Rutas generales de la app. No usan la base de datos: no hay nada que limpiar.
describe('App — health y rutas inexistentes', () => {
  it('GET /api/health responde que el servidor está levantado', async () => {
    const res = await api.get('/api/health');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ status: 'ok' });
  });

  it('404 ROUTE_NOT_FOUND con una ruta inexistente', async () => {
    const body = expectError(await api.get('/api/no-existe'), 404, 'ROUTE_NOT_FOUND');

    expect(body.message).to.equal('Ruta no encontrada: GET /api/no-existe');
    expect(body.details).to.deep.equal({ method: 'GET', path: '/api/no-existe' });
  });

  it('404 ROUTE_NOT_FOUND fuera de /api', async () => {
    const body = expectError(await api.delete('/usuarios?x=1'), 404, 'ROUTE_NOT_FOUND');

    expect(body.details).to.deep.equal({ method: 'DELETE', path: '/usuarios?x=1' });
  });

  it('400 BAD_REQUEST con un parámetro de URL mal codificado', async () => {
    expectError(await api.get('/api/users/%E0%A4%A'), 400, 'BAD_REQUEST');
  });
});
