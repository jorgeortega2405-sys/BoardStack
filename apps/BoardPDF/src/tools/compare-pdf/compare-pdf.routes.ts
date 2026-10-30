import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { comparePdfLimiter } from '../../middlewares/rate-limit.middleware.js';
import { handleComparePdf } from './compare-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  storage: multer.memoryStorage(),
});

const router = Router();

router.post(
  '/tools/compare-pdf/compare',
  optionalAuth,
  comparePdfLimiter,
  upload.fields([
    { maxCount: 1, name: 'file1' },
    { maxCount: 1, name: 'file2' },
  ]),
  handleComparePdf
);

router.get('/tools/compare-pdf/download/:fileId', handleToolDownload);

export default router;

