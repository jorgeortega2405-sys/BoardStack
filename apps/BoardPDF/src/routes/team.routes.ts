import { handleAcceptInvitation, handleCancelTeamSubscriptionImmediate, handleConfirmTeamSeatUpgrade, handleCreateTeam, handleGetCurrentTeam, handleGetTeamBilling, handleInspectInvitation, handleInviteTeamMember, handleLeaveCurrentTeam, handleListMyTeams, handlePreviewTeamSeats, handleRemoveTeamMember, handleRevokeInvitation, handleSearchTeamMembers, handleUpdateCurrentTeam, handleUpdateMemberRole, handleUpdateTeamRenewal, handleUpdateTeamSeats } from '../controllers/team.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { paymentLimiter, teamActionLimiter, teamInspectLimiter, teamInviteLimiter } from '../middlewares/rate-limit.middleware.js';
import { requireTeamPermission, requireTeamWorkspace } from '../middlewares/workspace.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/teams', requireAuth, handleListMyTeams);
router.post('/teams', requireAuth, teamActionLimiter, handleCreateTeam);
router.get('/teams/invitations/inspect', optionalAuth, teamInspectLimiter, handleInspectInvitation);
router.post('/teams/invitations/accept', requireAuth, teamActionLimiter, handleAcceptInvitation);

router.get('/teams/current', requireAuth, requireTeamWorkspace, requireTeamPermission('team:read'), handleGetCurrentTeam);
router.patch('/teams/current', requireAuth, requireTeamWorkspace, requireTeamPermission('team:settings:manage'), teamActionLimiter, handleUpdateCurrentTeam);
router.get('/teams/current/members/search', requireAuth, requireTeamWorkspace, requireTeamPermission('team:read'), handleSearchTeamMembers);
router.post('/teams/current/invitations', requireAuth, requireTeamWorkspace, requireTeamPermission('team:members:invite'), teamInviteLimiter, handleInviteTeamMember);
router.delete('/teams/current/invitations/:invitationId', requireAuth, requireTeamWorkspace, requireTeamPermission('team:members:invite'), teamActionLimiter, handleRevokeInvitation);
router.patch('/teams/current/members/:userId/role', requireAuth, requireTeamWorkspace, requireTeamPermission('team:members:manage'), teamActionLimiter, handleUpdateMemberRole);
router.delete('/teams/current/members/:userId', requireAuth, requireTeamWorkspace, requireTeamPermission('team:members:manage'), teamActionLimiter, handleRemoveTeamMember);
router.post('/teams/current/leave', requireAuth, requireTeamWorkspace, teamActionLimiter, handleLeaveCurrentTeam);

router.get('/teams/current/billing', requireAuth, requireTeamWorkspace, requireTeamPermission('team:billing:manage'), handleGetTeamBilling);
router.post('/teams/current/seats/preview', requireAuth, requireTeamWorkspace, requireTeamPermission('team:billing:manage'), teamActionLimiter, handlePreviewTeamSeats);
router.post('/teams/current/seats', requireAuth, requireTeamWorkspace, requireTeamPermission('team:billing:manage'), paymentLimiter, handleUpdateTeamSeats);
router.post('/teams/current/seats/confirm-intent', requireAuth, requireTeamWorkspace, requireTeamPermission('team:billing:manage'), paymentLimiter, handleConfirmTeamSeatUpgrade);
router.post('/teams/current/billing/renewal', requireAuth, requireTeamWorkspace, requireTeamPermission('team:billing:manage'), paymentLimiter, handleUpdateTeamRenewal);
router.post('/teams/current/billing/cancel-immediate', requireAuth, requireTeamWorkspace, requireTeamPermission('team:billing:manage'), paymentLimiter, handleCancelTeamSubscriptionImmediate);

export default router;
