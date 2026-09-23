import { Router } from 'express';
import mockController from '../controllers/mock.controller.js';

const router = Router();

// Solo generan datos simulados (no se guardan)
router.get('/users', mockController.getUsers);
router.get('/couriers', mockController.getCouriers);
router.get('/orders', mockController.getOrders);
router.get('/deliveries', mockController.getDeliveries);

// Insertan datos de prueba en MongoDB
router.post('/seed', mockController.seedDataset);
router.post('/seed/users', mockController.seedUsers);
router.post('/seed/couriers', mockController.seedCouriers);
router.post('/seed/orders', mockController.seedOrders);
router.delete('/seed', mockController.clear);

export default router;
