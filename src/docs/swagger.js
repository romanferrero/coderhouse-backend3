import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import swaggerJSDoc from 'swagger-jsdoc';
import config from '../config/index.js';

// Configuración única de la documentación (OpenAPI 3). Los routers no tienen nada de Swagger:
// los endpoints se describen en docs/paths/*.yaml y los schemas, respuestas, parámetros y
// ejemplos reutilizables en docs/components/*.yaml.

const { version } = createRequire(import.meta.url)('../../package.json');

// Las rutas de los YAML se resuelven desde esta carpeta (no dependen del directorio desde el
// que se ejecute node). glob necesita barras "/" también en Windows.
const DOCS_DIR = path.dirname(fileURLToPath(import.meta.url)).replaceAll('\\', '/');

const DESCRIPTION = `
API REST de **ShipNow** para gestionar usuarios (clientes y repartidores), pedidos, entregas y productos,
con un módulo de mocking para generar y cargar datos de prueba.

Esta documentación sirve para consultar y probar los endpoints desde el navegador: cada uno indica
sus parámetros, el body que espera, la respuesta exitosa y los errores que puede devolver.

**Formato de las respuestas**

- Éxito: \`{ "status": "success", "payload": ... }\` (los \`DELETE\` de usuarios y productos responden \`204\` sin body).
- Error: \`{ "status": "error", "code", "message", "details" }\`. El \`code\` sale del diccionario de errores
  y es lo que el cliente debería leer para decidir qué hacer.

**Para tener en cuenta**

- La API no tiene autenticación: ningún endpoint pide token ni sesión.
- Los filtros de estado, prioridad y rol aceptan mayúsculas o minúsculas (\`pending\` = \`PENDING\`).
- Un id con formato inválido responde igual que uno inexistente (\`404\`).
- Cualquier ruta inexistente responde \`404 ROUTE_NOT_FOUND\` y cualquier falla no prevista \`500 INTERNAL_SERVER_ERROR\`.
- Fuera de producción, los errores \`500\` agregan la causa técnica en \`details.cause\`.
`;

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'ShipNow API',
    version,
    description: DESCRIPTION,
  },
  servers: [{ url: `http://localhost:${config.port}`, description: `Servidor local (${config.nodeEnv})` }],
  tags: [
    { name: 'Users', description: 'Usuarios: clientes (USER), repartidores (COURIER) y administradores (ADMIN)' },
    { name: 'Orders', description: 'Pedidos de los clientes (solo lectura)' },
    { name: 'Deliveries', description: 'Entregas de los pedidos, asignadas a un repartidor (solo lectura)' },
    {
      name: 'Mocks',
      description: 'Generación de datos simulados (GET) y carga o limpieza de datos de prueba en MongoDB (POST / DELETE)',
    },
    { name: 'Logger', description: 'Herramienta interna para validar el logging. No es una funcionalidad del negocio' },
    { name: 'Products', description: 'Catálogo de productos' },
    { name: 'Health', description: 'Estado del servidor' },
  ],
};

export const swaggerSpec = swaggerJSDoc({
  definition,
  apis: [`${DOCS_DIR}/components/*.yaml`, `${DOCS_DIR}/paths/*.yaml`],
  failOnErrors: true,
});

export const swaggerUiOptions = {
  customSiteTitle: 'ShipNow API — Documentación',
  swaggerOptions: {
    // Muestra los tags con sus operaciones listadas y cuánto tardó cada request de prueba.
    docExpansion: 'list',
    displayRequestDuration: true,
  },
};
