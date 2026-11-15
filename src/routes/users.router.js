import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import { uploadUserDocument } from '../config/multer.config.js';

const router = Router();

router.get('/', userController.getAll);
router.get('/:uid', userController.getById);
router.post('/', userController.create);
router.put('/:uid', userController.update);
router.patch('/:uid/role', userController.changeRole);
router.delete('/:uid', userController.delete);

// Documentos del usuario (multipart/form-data, campo "document")
router.post('/:uid/documents', uploadUserDocument, userController.uploadDocument);
router.get('/:uid/documents', userController.getDocuments);
router.get('/:uid/documents/:docId/file', userController.downloadDocument);

export default router;
