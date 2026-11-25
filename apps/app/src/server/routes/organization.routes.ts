import {
  addMemberHandler,
  getMembersHandler,
  getMyOrganizationHandler,
  getSamlMetadataHandler,
  loginSsoHandler,
  removeMemberHandler,
  resolveSsoHandler,
  samlAcsHandler,
  updateMyOrganizationHandler,
  updateSeatsHandler,
} from '../controllers/organization.controller.js';
import { asyncHandler } from '../middlewares/async.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/organization', requireAuth, asyncHandler(getMyOrganizationHandler));
router.put('/organization', requireAuth, asyncHandler(updateMyOrganizationHandler));
router.put('/organization/seats', requireAuth, asyncHandler(updateSeatsHandler));
router.get('/organization/members', requireAuth, asyncHandler(getMembersHandler));
router.post('/organization/members', requireAuth, asyncHandler(addMemberHandler));
router.delete('/organization/members/:id', requireAuth, asyncHandler(removeMemberHandler));

router.post('/auth/sso/resolve', asyncHandler(resolveSsoHandler));
router.post('/auth/sso/login', asyncHandler(loginSsoHandler));
router.get('/auth/sso/saml/metadata', asyncHandler(getSamlMetadataHandler));
router.post('/auth/sso/saml/acs', asyncHandler(samlAcsHandler));

export default router;
