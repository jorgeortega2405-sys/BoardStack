import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { convertToPdfHandler, previewUrlHandler } from './to-pdf-converter.controller.js';
import { UPLOADS_DIR } from './to-pdf-converter.service.js';
import { Router } from 'express';
import multer from 'multer';

const router = Router();

const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

router.post('/tools/to-pdf/convert', optionalAuth, upload.any(), convertToPdfHandler);
router.post('/tools/to-pdf/preview', previewUrlHandler);
router.get('/tools/to-pdf/download/:token', handleToolDownload);

export default router;

