import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { editPdfHandler } from './edit-pdf.controller.js';
import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  storage: multer.memoryStorage(),
});

router.post(
  '/tools/edit-pdf/process',
  optionalAuth,
  upload.fields([
    { maxCount: 1, name: 'file' },
    { maxCount: 20, name: 'images' },
  ]),
  editPdfHandler
);

router.get('/tools/edit-pdf/download/:fileId', handleToolDownload);

export default router;

