import { createProjectFolderHandler, deleteProjectFolderHandler, deleteUploadAssetHandler, getProjectFolderHandler, listProjectFoldersHandler, moveDocFolderHandler, moveUploadFolderHandler, renameProjectFolderHandler } from '../controllers/project-folders.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/project-folders', requireAuth, listProjectFoldersHandler);
router.post('/project-folders', requireAuth, createProjectFolderHandler);
router.get('/project-folders/:id', requireAuth, getProjectFolderHandler);
router.patch('/project-folders/:id', requireAuth, renameProjectFolderHandler);
router.delete('/project-folders/:id', requireAuth, deleteProjectFolderHandler);

router.patch('/collaborative-docs/:id/folder', requireAuth, moveDocFolderHandler);
router.patch('/collaborative-docs/uploads/:id/folder', requireAuth, moveUploadFolderHandler);
router.delete('/collaborative-docs/uploads/:id', requireAuth, deleteUploadAssetHandler);

export default router;
