import express from 'express';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './routes/index.js';
import { swaggerSpec, swaggerUiOptions } from './docs/swagger.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentación interactiva (Swagger UI) y la especificación OpenAPI en JSON.
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
