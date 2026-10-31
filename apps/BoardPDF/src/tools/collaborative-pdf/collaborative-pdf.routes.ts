import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { deleteCollaborativeDocHandler, downloadCollaborativeDocPdfHandler, getCollaborativeDocHandler, listCollaborativeDocsHandler, saveCollaborativeDocHandler } from './collaborative-pdf.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/collaborative-docs', optionalAuth, listCollaborativeDocsHandler);
router.get('/collaborative-docs/:id', optionalAuth, getCollaborativeDocHandler);
router.get('/collaborative-docs/:id/pdf', optionalAuth, downloadCollaborativeDocPdfHandler);
router.post('/collaborative-docs', optionalAuth, saveCollaborativeDocHandler);
router.put('/collaborative-docs/:id', optionalAuth, saveCollaborativeDocHandler);
router.delete('/collaborative-docs/:id', optionalAuth, deleteCollaborativeDocHandler);

export default router;
