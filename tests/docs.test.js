import { createRequire } from 'node:module';
import { expect } from 'chai';
import { api } from './helpers/api.js';
import { clearDatabase } from './helpers/db.js';
import { expectError } from './helpers/assertions.js';
import { NON_EXISTENT_ID } from './helpers/fixtures.js';
import { ERROR_DICTIONARY } from '../src/errors/index.js';

const { version } = createRequire(import.meta.url)('../package.json');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Sigue los $ref internos de la spec ('#/components/examples/OrderNotFound').
const resolveRef = (spec, node) => {
  let current = node;
  while (current?.$ref) {
    current = current.$ref
      .replace('#/', '')
      .split('/')
      .reduce((acc, key) => acc[key], spec);
  }
  return current;
};

// Lista plana de operaciones documentadas: [{ path, method, operation }].
const listOperations = (spec) =>
  Object.entries(spec.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => item[method]).map((method) => ({ path, method, operation: item[method] }))
  );

describe('Swagger — /api/docs', () => {
  let spec;

  before(async () => {
    const res = await api.get('/api/docs.json');
    spec = res.body;
  });

  describe('Rutas de la documentación', () => {
    it('GET /api/docs/ sirve Swagger UI', async () => {
      const res = await api.get('/api/docs/');

      expect(res.status).to.equal(200);
      expect(res.headers['content-type']).to.match(/text\/html/);
      expect(res.text).to.include('swagger-ui').and.to.include('<title>ShipNow API — Documentación</title>');
    });

    it('GET /api/docs.json devuelve la especificación OpenAPI', async () => {
      const res = await api.get('/api/docs.json');

      expect(res.status).to.equal(200);
      expect(res.headers['content-type']).to.match(/application\/json/);
      expect(res.body).to.include.all.keys('openapi', 'info', 'servers', 'tags', 'paths', 'components');
      expect(res.body.openapi).to.equal('3.0.3');
      expect(res.body.info).to.include({ title: 'ShipNow API', version });
      expect(res.body.tags.map((tag) => tag.name)).to.include.members([
        'Users',
        'Orders',
        'Deliveries',
        'Uploads',
        'Mocks',
        'Logger',
        'Products',
        'Health',
      ]);
    });

    it('documenta los endpoints principales', () => {
      expect(spec.paths['/api/users']).to.include.all.keys('get', 'post');
      expect(spec.paths['/api/orders']).to.include.all.keys('get', 'post');
      expect(spec.paths['/api/orders/{oid}']).to.have.property('get');
      expect(spec.paths['/api/orders/{oid}/status']).to.have.property('patch');
      expect(spec.paths['/api/mocks/users']).to.have.property('get');
      expect(spec.paths['/api/mocks/seed']).to.include.all.keys('post', 'delete');
      expect(spec.paths['/api/loggerTest']).to.have.property('get');
      expect(spec.paths['/api/users/{uid}/documents']).to.include.all.keys('post', 'get');
      expect(spec.paths['/api/deliveries/{did}/proofs']).to.include.all.keys('post', 'get');
    });

    it('documenta las cargas de archivos como multipart/form-data con el campo del archivo', () => {
      const uploads = [
        { path: '/api/users/{uid}/documents', field: 'document', required: ['document', 'documentType'] },
        { path: '/api/deliveries/{did}/proofs', field: 'proof', required: ['proof'] },
      ];
      uploads.forEach(({ path, field, required }) => {
        const { content } = spec.paths[path].post.requestBody;
        expect(content, path).to.have.all.keys('multipart/form-data');
        const schema = resolveRef(spec, content['multipart/form-data'].schema);
        expect(schema.properties[field], path).to.include({ type: 'string', format: 'binary' });
        expect(schema.required, path).to.deep.equal(required);
        expect(spec.paths[path].post.responses, path).to.include.all.keys('201', '400', '404', '413', '500');
      });
    });

    it('404 ROUTE_NOT_FOUND con un método que no existe sobre la spec', async () => {
      const body = expectError(await api.post('/api/docs.json'), 404, 'ROUTE_NOT_FOUND');

      expect(body.details).to.deep.equal({ method: 'POST', path: '/api/docs.json' });
    });
  });

  describe('Coherencia entre la documentación y la API', () => {
    beforeEach(clearDatabase);
    after(clearDatabase);

    it('los códigos de error documentados son los del diccionario', () => {
      expect(spec.components.schemas.ErrorCode.enum).to.have.members(Object.keys(ERROR_DICTIONARY));
    });

    it('cada ejemplo de error usa el status HTTP que le asigna el diccionario', () => {
      const checked = [];
      listOperations(spec).forEach(({ path, method, operation }) => {
        Object.entries(operation.responses)
          .filter(([httpStatus]) => Number(httpStatus) >= 400)
          .forEach(([httpStatus, response]) => {
            const examples = resolveRef(spec, response).content?.['application/json']?.examples ?? {};
            Object.values(examples).forEach((example) => {
              const { value } = resolveRef(spec, example);
              const where = `${method.toUpperCase()} ${path} → ${httpStatus} ${value.code}`;
              expect(value, where).to.have.all.keys('status', 'code', 'message', 'details');
              expect(ERROR_DICTIONARY, where).to.have.property(value.code);
              expect(ERROR_DICTIONARY[value.code].status, where).to.equal(Number(httpStatus));
              checked.push(where);
            });
          });
      });
      expect(checked).to.not.be.empty;
    });

    // Llama a cada endpoint documentado (con un id inexistente y sin body) y comprueba que la ruta
    // existe y que responde uno de los status que figuran en su documentación.
    it('cada endpoint documentado existe y responde un status documentado', async () => {
      for (const { path, method, operation } of listOperations(spec)) {
        const url = path.replace(/\{[^}]+\}/g, NON_EXISTENT_ID);
        const req = api[method](url);
        const res = ['post', 'put', 'patch'].includes(method) ? await req.send({}) : await req;
        const where = `${method.toUpperCase()} ${path} respondió ${res.status} ${res.body?.code ?? ''}`;

        expect(res.body?.code, where).to.not.equal('ROUTE_NOT_FOUND');
        expect(Object.keys(operation.responses), where).to.include(String(res.status));
      }
    });
  });
});
