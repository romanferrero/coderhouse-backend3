import express from 'express';
import swaggerUi from 'swagger-ui-express';
import config from './config/index.js';
import { createApiRouter, INTERNAL_ROUTES } from './routes/index.js';
import { createSwaggerSpec, swaggerUiOptions } from './docs/swagger.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';

// Tamaño máximo de un body JSON o urlencoded. Ningún endpoint necesita más (los archivos van por
// multipart, con su propio límite en multer.config.js): un body mayor responde 413 PAYLOAD_TOO_LARGE
// sin llegar a procesarse.
export const BODY_LIMIT = '100kb';

// Crea la app con las opciones de la config del entorno. Los tests pueden pasar otras para
// comprobar cómo queda en producción (sin endpoints internos, sin Swagger) sin cambiar NODE_ENV.
export const createApp = ({
  internalEndpoints = config.internalEndpointsEnabled,
  swagger = config.swaggerEnabled,
} = {}) => {
  const app = express();

  // No anunciar el framework en cada respuesta (header X-Powered-By: Express).
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

  // Documentación interactiva (Swagger UI) y la especificación OpenAPI en JSON.
  if (swagger) {
    const spec = createSwaggerSpec({
      includeInternal: internalEndpoints,
      internalPathPrefixes: Object.keys(INTERNAL_ROUTES).map((path) => `/api${path}`),
    });
    app.get('/api/docs.json', (req, res) => res.json(spec));
    // serveFiles (y no serve) deja la spec en esta app: varias apps en el mismo proceso (los tests)
    // no se pisan la documentación.
    app.use('/api/docs', swaggerUi.serveFiles(spec, swaggerUiOptions), swaggerUi.setup(spec, swaggerUiOptions));
  }

  app.use('/api', createApiRouter({ internalEndpoints }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp();
