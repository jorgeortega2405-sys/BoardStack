import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { cropPdfHandler } from './crop-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'file',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

router.post('/tools/crop-pdf/process', optionalAuth, uploadMiddleware, cropPdfHandler);
router.get('/tools/crop-pdf/download/:fileId', handleToolDownload);

export default router;

