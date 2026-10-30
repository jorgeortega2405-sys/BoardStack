import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfToMarkdownLimiter } from '../../middlewares/rate-limit.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { handleConvertPdfToMarkdown } from './pdf-to-markdown.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 500,
  maxFiles: 1,
});

router.post('/tools/pdf-to-markdown/convert', optionalAuth, pdfToMarkdownLimiter, uploadMiddleware, handleConvertPdfToMarkdown);
router.get('/tools/pdf-to-markdown/download/:fileId', handleToolDownload);

export default router;

