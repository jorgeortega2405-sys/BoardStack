import { createLabelHandler, deleteLabelHandler, listLabelsHandler, updateDocumentLabelsHandler } from '../controllers/document-labels.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/document-labels', requireAuth, listLabelsHandler);
router.post('/document-labels', requireAuth, createLabelHandler);
router.delete('/document-labels/:id', requireAuth, deleteLabelHandler);
router.put('/collaborative-docs/:id/labels', requireAuth, updateDocumentLabelsHandler);

export default router;
