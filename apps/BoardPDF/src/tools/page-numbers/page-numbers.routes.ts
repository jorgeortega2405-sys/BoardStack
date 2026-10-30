import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { createPdfUploadMiddleware } from '../../utils/upload.util.js';
import { addPageNumbersHandler } from './page-numbers.controller.js';
import { Router } from 'express';

const router = Router();
const uploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'file',
  maxFileSizeMB: 1000,
  maxFiles: 1,
});

router.post('/tools/page-numbers/process', optionalAuth, uploadMiddleware, addPageNumbersHandler);
router.get('/tools/page-numbers/download/:fileId', handleToolDownload);

export default router;
