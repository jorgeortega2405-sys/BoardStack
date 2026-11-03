import { getOrganization, getSsoConfig, inviteMember, listMembers, removeMember, revokeInvitation, updateMemberRole, updateOrganization, updateSsoConfig } from '../controllers/organization.controller.js';
import { requireAuth, requireFeature, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/organization', requireAuth, requireFeature('organization'), getOrganization);
router.put('/organization', requireAuth, requireFeature('organization'), requirePermission('org:manage'), updateOrganization);
router.get('/organization/members', requireAuth, requireFeature('organization'), requirePermission('members:view'), listMembers);
router.post('/organization/members/invite', requireAuth, requireFeature('organization'), requirePermission('members:invite'), inviteMember);
router.put('/organization/members/:id/role', requireAuth, requireFeature('organization'), requirePermission('members:modify_role'), updateMemberRole);
router.delete('/organization/members/:id', requireAuth, requireFeature('organization'), requirePermission('members:remove'), removeMember);
router.delete('/organization/invitations/:id', requireAuth, requireFeature('organization'), requirePermission('members:invite'), revokeInvitation);
router.get('/organization/sso', requireAuth, requireFeature('organization'), requirePermission('sso:view'), getSsoConfig);
router.put('/organization/sso', requireAuth, requireFeature('organization'), requirePermission('sso:manage'), updateSsoConfig);

export default router;
