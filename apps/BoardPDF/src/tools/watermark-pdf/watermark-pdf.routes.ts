import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { addWatermarkHandler } from './watermark-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 1000 * 1024 * 1024,
  },
  storage: multer.memoryStorage(),
});

router.post(
  '/tools/watermark-pdf/process',
  optionalAuth,
  upload.fields([
    { maxCount: 1, name: 'file' },
    { maxCount: 1, name: 'watermarkImage' },
  ]),
  addWatermarkHandler
);

router.get('/tools/watermark-pdf/download/:fileId', handleToolDownload);

export default router;
