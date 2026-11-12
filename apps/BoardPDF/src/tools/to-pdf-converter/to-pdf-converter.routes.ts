import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { convertToPdfHandler, previewUrlHandler } from './to-pdf-converter.controller.js';
import { UPLOADS_DIR } from './to-pdf-converter.service.js';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
});

const upload = multer({
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  storage,
});

router.post('/tools/to-pdf/convert', optionalAuth, upload.any(), convertToPdfHandler);
router.post('/tools/to-pdf/preview', previewUrlHandler);
router.get('/tools/to-pdf/download/:token', handleToolDownload);

export default router;
