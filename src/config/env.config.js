import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const REQUIRED_VARS = ['PORT', 'MONGODB_URI', 'NODE_ENV'];
const VALID_ENVIRONMENTS = ['development', 'production', 'test'];

const validateEnv = (env) => {
  const missing = REQUIRED_VARS.filter((key) => !env[key] || env[key].trim() === '');
  if (missing.length > 0) {
    throw new Error(
      `[config] Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        'Revisá tu archivo .env (podés tomar .env.example como referencia).'
    );
  }

  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`[config] PORT debe ser un número entre 1 y 65535. Valor recibido: "${env.PORT}".`);
  }

  if (!VALID_ENVIRONMENTS.includes(env.NODE_ENV)) {
    throw new Error(
      `[config] NODE_ENV debe ser uno de: ${VALID_ENVIRONMENTS.join(', ')}. Valor recibido: "${env.NODE_ENV}".`
    );
  }

  if (!/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI)) {
    throw new Error('[config] MONGODB_URI debe comenzar con "mongodb://" o "mongodb+srv://".');
  }

  return Object.freeze({
    port,
    mongodbUri: env.MONGODB_URI,
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
  });
};

// Único lugar del proyecto que lee process.env
const config = validateEnv(process.env);

export default config;
