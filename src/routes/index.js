import { Router } from 'express';
import productsRouter from './products.router.js';
import usersRouter from './users.router.js';
import ordersRouter from './orders.router.js';
import deliveriesRouter from './deliveries.router.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/products', productsRouter);
router.use('/users', usersRouter);
router.use('/orders', ordersRouter);
router.use('/deliveries', deliveriesRouter);

export default router;
