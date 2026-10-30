import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfCompressLimiter } from '../../middlewares/rate-limit.middleware.js';
import { handleCompressPdf, handleUploadMiddleware } from './compress-pdf.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/tools/compress-pdf/compress', optionalAuth, pdfCompressLimiter, handleUploadMiddleware, handleCompressPdf);
router.get('/tools/compress-pdf/download/:fileId', handleToolDownload);

export default router;
