import { Router } from 'express';
import healthRouter from './health.router.js';
import productsRouter from './products.router.js';
import usersRouter from './users.router.js';
import ordersRouter from './orders.router.js';
import deliveriesRouter from './deliveries.router.js';
import mocksRouter from './mocks.router.js';
import loggerRouter from './logger.router.js';

// Rutas internas: herramientas de desarrollo y testing, no funcionalidades del negocio.
// Solo se montan si `internalEndpoints` es true (fuera de producción): en producción no existen
// y responden 404 ROUTE_NOT_FOUND como cualquier ruta inexistente.
export const INTERNAL_ROUTES = Object.freeze({
  '/mocks': mocksRouter,
  '/loggerTest': loggerRouter,
});

export const createApiRouter = ({ internalEndpoints }) => {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/products', productsRouter);
  router.use('/users', usersRouter);
  router.use('/orders', ordersRouter);
  router.use('/deliveries', deliveriesRouter);

  if (internalEndpoints) {
    Object.entries(INTERNAL_ROUTES).forEach(([path, internalRouter]) => router.use(path, internalRouter));
  }

  return router;
};
