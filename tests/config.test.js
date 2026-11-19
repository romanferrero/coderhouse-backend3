import { expect } from 'chai';
import { validateEnv } from '../src/config/env.config.js';

// Validación de las variables de entorno al arrancar. No usa la base ni la app: se le pasa
// un objeto con las variables, como si fuera process.env.
const VALID_ENV = Object.freeze({
  PORT: '8080',
  MONGODB_URI: 'mongodb://localhost:27017/shipnow',
  NODE_ENV: 'production',
});

const validate = (overrides = {}) => validateEnv({ ...VALID_ENV, ...overrides }, { envFile: '.env.production' });

describe('Config — validación de variables de entorno', () => {
  it('arma la config con las obligatorias y valores por defecto en las opcionales', () => {
    expect(validate()).to.deep.equal({
      port: 8080,
      mongodbUri: VALID_ENV.MONGODB_URI,
      nodeEnv: 'production',
      isProduction: true,
      logLevel: null,
      publicUrl: 'http://localhost:8080',
      swaggerEnabled: true,
      internalEndpointsEnabled: false,
    });
  });

  it('los endpoints internos solo se habilitan fuera de producción', () => {
    expect(validate({ NODE_ENV: 'development' }).internalEndpointsEnabled).to.equal(true);
    expect(validate({ NODE_ENV: 'test' }).internalEndpointsEnabled).to.equal(true);
    expect(validate({ NODE_ENV: 'production' }).internalEndpointsEnabled).to.equal(false);
  });

  it('lee las opcionales LOG_LEVEL, PUBLIC_URL y SWAGGER_ENABLED', () => {
    const config = validate({ LOG_LEVEL: 'HTTP', PUBLIC_URL: 'https://api.shipnow.com/', SWAGGER_ENABLED: 'false' });

    expect(config).to.include({ logLevel: 'http', publicUrl: 'https://api.shipnow.com', swaggerEnabled: false });
  });

  ['PORT', 'MONGODB_URI', 'NODE_ENV'].forEach((key) => {
    it(`falla con un mensaje claro si falta ${key}`, () => {
      expect(() => validate({ [key]: undefined })).to.throw(
        `[config] Faltan variables de entorno obligatorias: ${key}. Revisá tu archivo .env.production`
      );
      expect(() => validate({ [key]: '   ' })).to.throw(`obligatorias: ${key}`);
    });
  });

  it('informa todas las obligatorias que faltan juntas', () => {
    expect(() => validateEnv({})).to.throw('obligatorias: PORT, MONGODB_URI, NODE_ENV');
  });

  const invalid = [
    [{ PORT: 'abc' }, 'PORT debe ser un número entre 1 y 65535'],
    [{ PORT: '70000' }, 'PORT debe ser un número entre 1 y 65535'],
    [{ NODE_ENV: 'staging' }, 'NODE_ENV debe ser uno de: development, production, test'],
    [{ MONGODB_URI: 'localhost:27017/shipnow' }, 'MONGODB_URI debe comenzar con "mongodb://" o "mongodb+srv://"'],
    [{ LOG_LEVEL: 'verbose' }, 'LOG_LEVEL debe ser uno de: fatal, error, warning, info, http, debug'],
    [{ PUBLIC_URL: 'no-es-una-url' }, 'PUBLIC_URL debe ser una URL válida'],
    [{ PUBLIC_URL: 'ftp://shipnow.com' }, 'PUBLIC_URL debe empezar con http:// o https://'],
    [{ SWAGGER_ENABLED: 'si' }, 'SWAGGER_ENABLED debe ser "true" o "false"'],
  ];

  invalid.forEach(([overrides, message]) => {
    it(`falla si ${Object.keys(overrides)[0]}=${Object.values(overrides)[0]}`, () => {
      expect(() => validate(overrides)).to.throw(`[config] ${message}`);
    });
  });
});
