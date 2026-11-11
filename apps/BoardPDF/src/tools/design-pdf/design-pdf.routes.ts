import { optionalAuth, requireAuth, requireFeature } from '../../middlewares/auth.middleware.js';
import { removeBackgroundLimiter } from '../../middlewares/rate-limit.middleware.js';
import { addCollaborativeDocMemberHandler, aiGenerateCollaborativeDocHandler, deleteCollaborativeDocHandler, downloadCollaborativeDocPdfHandler, getCollaborativeDocHandler, getCollaborativeDocMembersHandler, listCollaborativeDocsHandler, listCollaborativeUploadsHandler, removeBackgroundHandler, removeCollaborativeDocMemberHandler, resolveCollaborativeDocSlugHandler, saveCollaborativeDocHandler, searchCollaborativeUsersHandler, updateCollaborativeDocAccessLevelHandler, updateCollaborativeDocCustomSlugHandler, uploadCollaborativeAssetHandler } from './design-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

const router = Router();

const endpoints = ['/design-docs', '/collaborative-docs'];

for (const base of endpoints) {
  router.post(`${base}/remove-background`, requireAuth, requireFeature('pro'), removeBackgroundLimiter, upload.single('file'), removeBackgroundHandler);
  router.get(`${base}/uploads`, requireAuth, listCollaborativeUploadsHandler);
  router.post(`${base}/upload`, optionalAuth, upload.array('files', 10), uploadCollaborativeAssetHandler);
  router.get(`${base}/users/search`, optionalAuth, searchCollaborativeUsersHandler);
  router.get(`${base}`, requireAuth, listCollaborativeDocsHandler);
  router.get(`${base}/:id/members`, optionalAuth, getCollaborativeDocMembersHandler);
  router.post(`${base}/:id/members`, optionalAuth, addCollaborativeDocMemberHandler);
  router.delete(`${base}/:id/members/:userId`, optionalAuth, removeCollaborativeDocMemberHandler);
  router.get(`${base}/resolve-slug/:slug`, optionalAuth, resolveCollaborativeDocSlugHandler);
  router.patch(`${base}/:id/access-level`, optionalAuth, updateCollaborativeDocAccessLevelHandler);
  router.patch(`${base}/:id/custom-slug`, optionalAuth, updateCollaborativeDocCustomSlugHandler);
  router.post(`${base}/:id/ai-generate`, requireAuth, aiGenerateCollaborativeDocHandler);
  router.get(`${base}/:id`, optionalAuth, getCollaborativeDocHandler);
  router.post(`${base}/render-pdf`, optionalAuth, downloadCollaborativeDocPdfHandler);
  router.get(`${base}/:id/pdf`, optionalAuth, downloadCollaborativeDocPdfHandler);
  router.post(`${base}/:id/pdf`, optionalAuth, downloadCollaborativeDocPdfHandler);
  router.post(`${base}`, requireAuth, saveCollaborativeDocHandler);
  router.put(`${base}/:id`, optionalAuth, saveCollaborativeDocHandler);
  router.delete(`${base}/:id`, requireAuth, deleteCollaborativeDocHandler);
}

export default router;
