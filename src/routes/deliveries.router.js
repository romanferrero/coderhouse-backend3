import { Router } from 'express';
import deliveryController from '../controllers/delivery.controller.js';
import { uploadDeliveryProof } from '../config/multer.config.js';

const router = Router();

router.get('/', deliveryController.getAll);
router.get('/:did', deliveryController.getById);

// Comprobantes de la entrega (multipart/form-data, campo "proof")
router.post('/:did/proofs', uploadDeliveryProof, deliveryController.uploadProof);
router.get('/:did/proofs', deliveryController.getProofs);
router.get('/:did/proofs/:proofId/file', deliveryController.downloadProof);

export default router;
