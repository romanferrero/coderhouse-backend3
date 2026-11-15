// Root hooks de Mocha: se carga antes que los archivos de test (ver .mocharc.json).
//
// NODE_ENV se fija acá, antes de que cualquier test importe la app: así src/config lee
// .env.test (base de datos de testing) y nunca el .env de desarrollo.
process.env.NODE_ENV = 'test';

// Import dinámico a propósito: un import estático se evaluaría antes de la línea de arriba,
// y la config se cargaría con el entorno equivocado.
const { fakerES } = await import('@faker-js/faker');
const { default: config } = await import('../src/config/index.js');
const { connectDB, disconnectDB } = await import('../src/db/connection.js');
const { clearDatabase, getDatabaseName } = await import('./helpers/db.js');
const { clearUploads } = await import('./helpers/uploads.js');

// Semilla fija: los datos que generan los mocks salen iguales en cada corrida.
const FAKER_SEED = 2026;

// Solo se limpia al final si el control de la base pasó (Mocha corre afterAll aunque falle beforeAll).
let isTestDatabase = false;

export const mochaHooks = {
  async beforeAll() {
    if (config.nodeEnv !== 'test') {
      throw new Error(`Los tests tienen que correr con NODE_ENV=test (se recibió "${config.nodeEnv}").`);
    }
    await connectDB();

    // Los tests vacían la base: si MONGODB_URI no apunta a una base de testing, se corta acá
    // antes de borrar nada.
    const dbName = getDatabaseName();
    if (!/test/i.test(dbName)) {
      await disconnectDB();
      throw new Error(
        `La base "${dbName}" no parece de testing (el nombre tiene que contener "test"). Revisá MONGODB_URI en .env.test.`
      );
    }

    isTestDatabase = true;

    fakerES.seed(FAKER_SEED);
    await clearDatabase();
    await clearUploads();
  },

  async afterAll() {
    if (isTestDatabase) await clearDatabase();
    // Los archivos subidos durante las pruebas (uploads/test/) no quedan en el proyecto.
    await clearUploads();
    await disconnectDB();
  },
};
