import { optionalAuth, requireAuth } from '../../middlewares/auth.middleware.js';
import { addCollaborativeDocMemberHandler, deleteCollaborativeDocHandler, downloadCollaborativeDocPdfHandler, getCollaborativeDocHandler, getCollaborativeDocMembersHandler, listCollaborativeDocsHandler, listCollaborativeUploadsHandler, removeCollaborativeDocMemberHandler, saveCollaborativeDocHandler, searchCollaborativeUsersHandler, updateCollaborativeDocAccessLevelHandler, uploadCollaborativeAssetHandler } from './collaborative-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = Router();

router.get('/collaborative-docs/uploads', optionalAuth, listCollaborativeUploadsHandler);
router.post('/collaborative-docs/upload', optionalAuth, upload.array('files', 10), uploadCollaborativeAssetHandler);
router.get('/collaborative-docs/users/search', optionalAuth, searchCollaborativeUsersHandler);
router.get('/collaborative-docs', optionalAuth, listCollaborativeDocsHandler);
router.get('/collaborative-docs/:id/members', optionalAuth, getCollaborativeDocMembersHandler);
router.post('/collaborative-docs/:id/members', optionalAuth, addCollaborativeDocMemberHandler);
router.delete('/collaborative-docs/:id/members/:userId', optionalAuth, removeCollaborativeDocMemberHandler);
router.patch('/collaborative-docs/:id/access-level', optionalAuth, updateCollaborativeDocAccessLevelHandler);
router.get('/collaborative-docs/:id', optionalAuth, getCollaborativeDocHandler);
router.get('/collaborative-docs/:id/pdf', optionalAuth, downloadCollaborativeDocPdfHandler);
router.post('/collaborative-docs', optionalAuth, saveCollaborativeDocHandler);
router.put('/collaborative-docs/:id', optionalAuth, saveCollaborativeDocHandler);
router.delete('/collaborative-docs/:id', requireAuth, deleteCollaborativeDocHandler);

export default router;
