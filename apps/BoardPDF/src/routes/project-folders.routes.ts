import { addFolderMemberHandler, createProjectFolderHandler, deleteProjectFolderHandler, deleteUploadAssetHandler, getFolderMembersHandler, getProjectFolderHandler, listProjectFoldersHandler, moveDocFolderHandler, moveUploadFolderHandler, removeFolderMemberHandler, renameProjectFolderHandler, updateFolderVisibilityHandler } from '../controllers/project-folders.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/project-folders', requireAuth, listProjectFoldersHandler);
router.post('/project-folders', requireAuth, createProjectFolderHandler);
router.get('/project-folders/:id', requireAuth, getProjectFolderHandler);
router.patch('/project-folders/:id', requireAuth, renameProjectFolderHandler);
router.delete('/project-folders/:id', requireAuth, deleteProjectFolderHandler);
router.get('/project-folders/:id/members', requireAuth, getFolderMembersHandler);
router.patch('/project-folders/:id/visibility', requireAuth, updateFolderVisibilityHandler);
router.post('/project-folders/:id/members', requireAuth, addFolderMemberHandler);
router.delete('/project-folders/:id/members/:userId', requireAuth, removeFolderMemberHandler);

router.patch('/collaborative-docs/:id/folder', requireAuth, moveDocFolderHandler);
router.patch('/collaborative-docs/uploads/:id/folder', requireAuth, moveUploadFolderHandler);
router.delete('/collaborative-docs/uploads/:id', requireAuth, deleteUploadAssetHandler);

export default router;
