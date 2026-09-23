import { Router } from 'express';
import orderController from '../controllers/order.controller.js';

const router = Router();

router.get('/', orderController.getAll);
router.get('/:oid', orderController.getById);

export default router;
