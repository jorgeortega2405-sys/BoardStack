import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { protectPdfHandler } from './protect-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'file',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

router.post('/tools/protect-pdf/process', optionalAuth, uploadMiddleware, protectPdfHandler);
router.get('/tools/protect-pdf/download/:fileId', handleToolDownload);

export default router;
