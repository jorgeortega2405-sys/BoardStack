import { createProjectFolderHandler, deleteProjectFolderHandler, deleteUploadAssetHandler, getProjectFolderHandler, listProjectFoldersHandler, moveDocFolderHandler, moveUploadFolderHandler, renameProjectFolderHandler } from '../controllers/project-folders.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/project-folders', optionalAuth, listProjectFoldersHandler);
router.post('/project-folders', optionalAuth, createProjectFolderHandler);
router.get('/project-folders/:id', optionalAuth, getProjectFolderHandler);
router.patch('/project-folders/:id', optionalAuth, renameProjectFolderHandler);
router.delete('/project-folders/:id', optionalAuth, deleteProjectFolderHandler);

router.patch('/collaborative-docs/:id/folder', optionalAuth, moveDocFolderHandler);
router.patch('/collaborative-docs/uploads/:id/folder', optionalAuth, moveUploadFolderHandler);
router.delete('/collaborative-docs/uploads/:id', optionalAuth, deleteUploadAssetHandler);

export default router;
