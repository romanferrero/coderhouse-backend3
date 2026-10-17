import { Router } from 'express';
import loggerController from '../controllers/logger.controller.js';

const router = Router();

// Endpoint de prueba del logger: genera un log de cada nivel.
router.get('/', loggerController.test);

export default router;
