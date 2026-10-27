import { handleDeleteDownloadFile, handleDownloadFile, handleDownloadInfo } from '../controllers/download.controller.js';
import { Router } from 'express';

const router = Router();

router.delete(['/download/:token', '/download/:token/:shard'], handleDeleteDownloadFile);
router.delete(['/download/:token/file', '/download/:token/:shard/file'], handleDeleteDownloadFile);
router.get(['/download/:token/info', '/download/:token/:shard/info'], handleDownloadInfo);
router.get(['/download/:token/file', '/download/:token/:shard/file'], handleDownloadFile);
router.get(['/download/:token', '/download/:token/:shard'], handleDownloadFile);

export default router;
