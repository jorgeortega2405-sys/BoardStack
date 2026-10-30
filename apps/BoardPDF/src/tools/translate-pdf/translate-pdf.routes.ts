import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { translatePdfLimiter } from '../../middlewares/rate-limit.middleware.js';
import { translatePdfHandler } from './translate-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
  storage: multer.memoryStorage(),
});

const router = Router();

router.post(
  '/tools/translate-pdf/translate',
  optionalAuth,
  translatePdfLimiter,
  upload.fields([
    { maxCount: 1, name: 'file' },
    { maxCount: 1, name: 'pdf' },
  ]),
  translatePdfHandler
);
router.get('/tools/translate-pdf/download/:fileId', handleToolDownload);

export default router;

