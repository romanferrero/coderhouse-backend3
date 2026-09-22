import { Router } from 'express';
import productsRouter from './products.router.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/products', productsRouter);

export default router;
