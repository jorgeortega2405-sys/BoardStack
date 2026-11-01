import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { deleteCollaborativeDocHandler, downloadCollaborativeDocPdfHandler, getCollaborativeDocHandler, listCollaborativeDocsHandler, listCollaborativeUploadsHandler, saveCollaborativeDocHandler, uploadCollaborativeAssetHandler } from './collaborative-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = Router();

router.get('/collaborative-docs/uploads', optionalAuth, listCollaborativeUploadsHandler);
router.post('/collaborative-docs/upload', optionalAuth, upload.array('files', 10), uploadCollaborativeAssetHandler);
router.get('/collaborative-docs', optionalAuth, listCollaborativeDocsHandler);
router.get('/collaborative-docs/:id', optionalAuth, getCollaborativeDocHandler);
router.get('/collaborative-docs/:id/pdf', optionalAuth, downloadCollaborativeDocPdfHandler);
router.post('/collaborative-docs', optionalAuth, saveCollaborativeDocHandler);
router.put('/collaborative-docs/:id', optionalAuth, saveCollaborativeDocHandler);
router.delete('/collaborative-docs/:id', optionalAuth, deleteCollaborativeDocHandler);

export default router;
