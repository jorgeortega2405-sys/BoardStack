import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { handleConvertPdf, uploadPdf } from './pdf-converter.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/tools/pdf-converter/convert', optionalAuth, uploadPdf.single('file'), handleConvertPdf);
router.get('/tools/pdf-converter/download/:token', handleToolDownload);

export default router;

