import dotenv from 'dotenv';

// Un archivo de variables por entorno. Los tests corren con NODE_ENV=test (lo fija tests/setup.js)
// y leen .env.test, con una base de datos separada; con NODE_ENV=production se lee .env.production.
// dotenv nunca pisa una variable que ya existe: en Docker las variables llegan con --env-file
// (o del orquestador) y ningún archivo .env entra en la imagen.
const ENV_FILES = Object.freeze({ test: '.env.test', production: '.env.production' });
const ENV_FILE = ENV_FILES[process.env.NODE_ENV] ?? '.env';

dotenv.config({ path: ENV_FILE, quiet: true });

const REQUIRED_VARS = ['PORT', 'MONGODB_URI', 'NODE_ENV'];
const VALID_ENVIRONMENTS = ['development', 'production', 'test'];
// Mismos niveles que el logger (src/logger/logger.js), de más a menos grave.
export const VALID_LOG_LEVELS = Object.freeze(['fatal', 'error', 'warning', 'info', 'http', 'debug']);
const BOOLEAN_VALUES = Object.freeze({ true: true, false: false });

const isBlank = (value) => value === undefined || value.trim() === '';

const fail = (message) => {
  throw new Error(`[config] ${message}`);
};

// Variable opcional true/false. Si no está, vale `fallback`.
const parseBoolean = (env, key, fallback) => {
  if (isBlank(env[key])) return fallback;
  const value = BOOLEAN_VALUES[env[key].trim().toLowerCase()];
  if (value === undefined) fail(`${key} debe ser "true" o "false". Valor recibido: "${env[key]}".`);
  return value;
};

// Variable opcional con una URL http(s). Se guarda sin la barra final.
const parseUrl = (env, key) => {
  if (isBlank(env[key])) return null;
  let url;
  try {
    url = new URL(env[key].trim());
  } catch {
    fail(`${key} debe ser una URL válida (ej: https://api.shipnow.com). Valor recibido: "${env[key]}".`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) fail(`${key} debe empezar con http:// o https://.`);
  return url.href.replace(/\/$/, '');
};

export const validateEnv = (env, { envFile = ENV_FILE } = {}) => {
  const missing = REQUIRED_VARS.filter((key) => isBlank(env[key]));
  if (missing.length > 0) {
    fail(
      `Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        `Revisá tu archivo ${envFile} (podés tomar ${envFile}.example como referencia) ` +
        'o las variables que le pasás al contenedor.'
    );
  }

  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    fail(`PORT debe ser un número entre 1 y 65535. Valor recibido: "${env.PORT}".`);
  }

  if (!VALID_ENVIRONMENTS.includes(env.NODE_ENV)) {
    fail(`NODE_ENV debe ser uno de: ${VALID_ENVIRONMENTS.join(', ')}. Valor recibido: "${env.NODE_ENV}".`);
  }

  if (!/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI)) {
    fail('MONGODB_URI debe comenzar con "mongodb://" o "mongodb+srv://".');
  }

  // Opcional: si no se indica, el logger usa el nivel por defecto del entorno.
  const logLevel = isBlank(env.LOG_LEVEL) ? null : env.LOG_LEVEL.trim().toLowerCase();
  if (logLevel && !VALID_LOG_LEVELS.includes(logLevel)) {
    fail(`LOG_LEVEL debe ser uno de: ${VALID_LOG_LEVELS.join(', ')}. Valor recibido: "${env.LOG_LEVEL}".`);
  }

  const isProduction = env.NODE_ENV === 'production';

  return Object.freeze({
    port,
    mongodbUri: env.MONGODB_URI,
    nodeEnv: env.NODE_ENV,
    isProduction,
    logLevel,
    // URL pública de la API (la que figura en Swagger). Por defecto, localhost con el PORT.
    publicUrl: parseUrl(env, 'PUBLIC_URL') ?? `http://localhost:${port}`,
    // Swagger queda habilitado en todos los entornos salvo que se lo apague explícitamente.
    swaggerEnabled: parseBoolean(env, 'SWAGGER_ENABLED', true),
    // Endpoints internos (/api/mocks y /api/loggerTest): nunca se exponen en producción.
    internalEndpointsEnabled: !isProduction,
  });
};

// Único lugar del proyecto que lee process.env.

// Entorno y nivel de logs tal como llegan, sin validar. Los usa el logger, que tiene que funcionar
// aun con una configuración inválida para poder registrar ese error.
export const rawNodeEnv = process.env.NODE_ENV;
export const rawLogLevel = process.env.LOG_LEVEL?.trim().toLowerCase();

// Valida y devuelve la config; lanza un error si falta o es inválida alguna variable.
export const loadConfig = () => validateEnv(process.env);
