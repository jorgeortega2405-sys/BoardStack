import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { rotatePdfHandler } from './rotate-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'file',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

router.post('/tools/rotate-pdf/process', optionalAuth, uploadMiddleware, rotatePdfHandler);
router.get('/tools/rotate-pdf/download/:fileId', handleToolDownload);

export default router;
