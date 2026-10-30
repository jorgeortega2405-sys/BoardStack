import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { unlockPdfHandler } from './unlock-pdf.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'file',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

router.post('/tools/unlock-pdf/process', optionalAuth, uploadMiddleware, unlockPdfHandler);
router.get('/tools/unlock-pdf/download/:fileId', handleToolDownload);

export default router;
