import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { summarizePdfLimiter } from '../../middlewares/rate-limit.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { handleSummarizePdf } from './summarize-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 200,
  maxFiles: 1,
});

router.post('/tools/summarize-pdf/summarize', optionalAuth, summarizePdfLimiter, uploadMiddleware, handleSummarizePdf);

export default router;

