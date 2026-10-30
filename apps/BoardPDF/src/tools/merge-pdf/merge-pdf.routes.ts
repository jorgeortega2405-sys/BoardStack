import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfMergeLimiter } from '../../middlewares/rate-limit.middleware.js';
import { handleMergePdf, handleUploadMiddleware } from './merge-pdf.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/tools/merge-pdf/merge', optionalAuth, pdfMergeLimiter, handleUploadMiddleware, handleMergePdf);
router.get('/tools/merge-pdf/download/:fileId', handleToolDownload);

export default router;
