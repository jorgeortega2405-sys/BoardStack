import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfOcrLimiter } from '../../middlewares/rate-limit.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { handleProcessOcrPdf } from './ocr-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 500,
  maxFiles: 1,
});

router.post('/tools/ocr-pdf/process', optionalAuth, pdfOcrLimiter, uploadMiddleware, handleProcessOcrPdf);
router.get('/tools/ocr-pdf/download/:fileId', handleToolDownload);

export default router;

