import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfRepairLimiter } from '../../middlewares/rate-limit.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { handleRepairPdf } from './repair-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdf',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

router.post('/tools/repair-pdf/repair', optionalAuth, pdfRepairLimiter, uploadMiddleware, handleRepairPdf);
router.get('/tools/repair-pdf/download/:fileId', handleToolDownload);

export default router;

