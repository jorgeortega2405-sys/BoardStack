import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { redactPdfLimiter } from '../../middlewares/rate-limit.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { handleRedactPdf } from './redact-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 500,
  maxFiles: 1,
});

router.post('/tools/redact-pdf/redact', optionalAuth, redactPdfLimiter, uploadMiddleware, handleRedactPdf);
router.get('/tools/redact-pdf/download/:fileId', handleToolDownload);

export default router;

