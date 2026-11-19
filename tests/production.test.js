import request from 'supertest';
import { expect } from 'chai';
import { createApp } from '../src/app.js';
import { expectError, expectSuccess } from './helpers/assertions.js';
import { clearDatabase } from './helpers/db.js';

// La app se arma con las mismas opciones que usa en producción (NODE_ENV=production), sin cambiar
// el entorno de los tests: sin endpoints internos y con Swagger, que también se puede apagar.
describe('Producción — endpoints internos y Swagger', () => {
  const production = request(createApp({ internalEndpoints: false, swagger: true }));

  after(clearDatabase);

  describe('Endpoints internos deshabilitados', () => {
    const internal = [
      ['get', '/api/mocks/users'],
      ['post', '/api/mocks/seed'],
      ['delete', '/api/mocks/seed'],
      ['get', '/api/loggerTest'],
    ];

    internal.forEach(([method, path]) => {
      it(`${method.toUpperCase()} ${path} responde 404 ROUTE_NOT_FOUND`, async () => {
        expectError(await production[method](path), 404, 'ROUTE_NOT_FOUND');
      });
    });

    it('los endpoints del negocio y el health check siguen disponibles', async () => {
      expect((await production.get('/api/health')).status).to.equal(200);
      expectSuccess(await production.get('/api/users'), 200);
      expectSuccess(await production.get('/api/orders'), 200);
    });
  });

  describe('Swagger', () => {
    it('sirve la documentación sin las rutas ni los tags internos', async () => {
      const res = await production.get('/api/docs.json');

      expect(res.status).to.equal(200);
      const paths = Object.keys(res.body.paths);
      expect(paths).to.include.members(['/api/health', '/api/users', '/api/orders', '/api/deliveries']);
      expect(paths.filter((path) => /^\/api\/(mocks|loggerTest)\b/.test(path))).to.deep.equal([]);
      expect(res.body.tags.map((tag) => tag.name)).to.not.include.members(['Mocks', 'Logger']);
    });

    it('GET /api/docs/ sirve Swagger UI', async () => {
      const res = await production.get('/api/docs/');

      expect(res.status).to.equal(200);
      expect(res.text).to.include('swagger-ui');
    });

    it('con SWAGGER_ENABLED=false la documentación no existe', async () => {
      const withoutDocs = request(createApp({ internalEndpoints: false, swagger: false }));

      expectError(await withoutDocs.get('/api/docs.json'), 404, 'ROUTE_NOT_FOUND');
      expectError(await withoutDocs.get('/api/docs/'), 404, 'ROUTE_NOT_FOUND');
    });
  });
});
