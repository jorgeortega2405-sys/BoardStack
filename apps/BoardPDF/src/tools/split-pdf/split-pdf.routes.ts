import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfSplitLimiter } from '../../middlewares/rate-limit.middleware.js';
import { handleSplitPdf, handleSplitUploadMiddleware } from './split-pdf.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/tools/split-pdf/split', optionalAuth, pdfSplitLimiter, handleSplitUploadMiddleware, handleSplitPdf);
router.get('/tools/split-pdf/download/:fileId', handleToolDownload);

export default router;
