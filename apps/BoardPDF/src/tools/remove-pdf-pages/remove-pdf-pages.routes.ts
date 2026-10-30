import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfRemovePagesLimiter } from '../../middlewares/rate-limit.middleware.js';
import { handleRemovePages, handleRemovePagesUploadMiddleware } from './remove-pdf-pages.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/tools/remove-pdf-pages/remove', optionalAuth, pdfRemovePagesLimiter, handleRemovePagesUploadMiddleware, handleRemovePages);
router.get('/tools/remove-pdf-pages/download/:fileId', handleToolDownload);

export default router;
