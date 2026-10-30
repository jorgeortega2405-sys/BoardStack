import { handleToolDownload } from '../../controllers/download.controller.js';
import { optionalAuth } from '../../middlewares/auth.middleware.js';
import { pdfOrganizeLimiter } from '../../middlewares/rate-limit.middleware.js';
import { handleOrganizePdf, handleOrganizePdfUploadMiddleware } from './organize-pdf.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/tools/organize-pdf/organize', optionalAuth, pdfOrganizeLimiter, handleOrganizePdfUploadMiddleware, handleOrganizePdf);
router.get('/tools/organize-pdf/download/:fileId', handleToolDownload);

export default router;
