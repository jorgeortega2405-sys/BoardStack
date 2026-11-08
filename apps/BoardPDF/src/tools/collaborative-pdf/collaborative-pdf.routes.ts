import { optionalAuth, requireAuth, requireFeature } from '../../middlewares/auth.middleware.js';
import { removeBackgroundLimiter } from '../../middlewares/rate-limit.middleware.js';
import { addCollaborativeDocMemberHandler, deleteCollaborativeDocHandler, downloadCollaborativeDocPdfHandler, getCollaborativeDocHandler, getCollaborativeDocMembersHandler, listCollaborativeDocsHandler, listCollaborativeUploadsHandler, removeBackgroundHandler, removeCollaborativeDocMemberHandler, saveCollaborativeDocHandler, searchCollaborativeUsersHandler, updateCollaborativeDocAccessLevelHandler, uploadCollaborativeAssetHandler } from './collaborative-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = Router();

router.post('/collaborative-docs/remove-background', requireAuth, requireFeature('pro'), removeBackgroundLimiter, upload.single('file'), removeBackgroundHandler);
router.get('/collaborative-docs/uploads', requireAuth, listCollaborativeUploadsHandler);
router.post('/collaborative-docs/upload', optionalAuth, upload.array('files', 10), uploadCollaborativeAssetHandler);
router.get('/collaborative-docs/users/search', optionalAuth, searchCollaborativeUsersHandler);
router.get('/collaborative-docs', requireAuth, listCollaborativeDocsHandler);
router.get('/collaborative-docs/:id/members', optionalAuth, getCollaborativeDocMembersHandler);
router.post('/collaborative-docs/:id/members', optionalAuth, addCollaborativeDocMemberHandler);
router.delete('/collaborative-docs/:id/members/:userId', optionalAuth, removeCollaborativeDocMemberHandler);
router.patch('/collaborative-docs/:id/access-level', optionalAuth, updateCollaborativeDocAccessLevelHandler);
router.get('/collaborative-docs/:id', optionalAuth, getCollaborativeDocHandler);
router.get('/collaborative-docs/:id/pdf', optionalAuth, downloadCollaborativeDocPdfHandler);
router.post('/collaborative-docs', requireAuth, saveCollaborativeDocHandler);
router.put('/collaborative-docs/:id', optionalAuth, saveCollaborativeDocHandler);
router.delete('/collaborative-docs/:id', requireAuth, deleteCollaborativeDocHandler);

export default router;
