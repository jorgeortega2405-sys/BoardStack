import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getWorkspaceTeam } from '../middlewares/workspace.middleware.js';
import { purchaseService } from '../services/purchase.service.js';
import { cancelTeamSubscription, confirmTeamSeatUpgradeIntent, getTeamBillingDetails, previewTeamSeatChange, updateTeamRenewal, updateTeamSeats } from '../services/stripe-team.service.js';
import { acceptTeamInvitation, createTeamFromPersonalBusiness, getTeamById, getTeamMembersAndInvitations, inspectInvitationByToken, inviteMemberToTeam, leaveTeam, listPendingInvitationsForUser, listUserTeams, removeTeamMember, revokeInvitation, searchTeamMembers, TeamServiceError, updateTeamMemberRole, updateTeamProfile } from '../services/team.service.js';
import { sendBadRequest, sendForbidden, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

function maskEmailAddress(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const domain = parts[1];
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function handleTeamControllerError(res: Response, error: unknown, context: string, fallbackMsg: string): void {
  if (error instanceof TeamServiceError) {
    res.status(error.statusCode).json({
      code: error.code,
      error: error.message,
      success: false,
    });
    return;
  }
  sendInternalError(res, context, error, fallbackMsg);
}

async function handleListMyTeams(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const [teams, pendingInvitations] = await Promise.all([
      listUserTeams(user.id),
      listPendingInvitationsForUser(user.email),
    ]);

    sendSuccess(res, {
      pendingInvitations,
      success: true,
      teams,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al listar equipos del usuario', 'No se pudieron cargar los equipos.');
  }
}

async function handleCreateTeam(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { name } = req.body || {};
    const team = await createTeamFromPersonalBusiness(user.id, String(name || ''));

    sendSuccess(res, {
      success: true,
      team,
    }, 201);
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al crear equipo', 'No se pudo crear el equipo.');
  }
}

async function handleInspectInvitation(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) {
      sendBadRequest(res, 'Token de invitación requerido.');
      return;
    }

    const invitation = await inspectInvitationByToken(token);
    if (!invitation) {
      res.status(404).json({ error: 'Invitación no encontrada o expirada.', success: false });
      return;
    }

    const user = getCurrentUser(req);
    const matchesCurrentUser = user
      ? user.email.trim().toLowerCase() === invitation.email.trim().toLowerCase()
      : false;

    sendSuccess(res, {
      invitation: {
        emailHint: maskEmailAddress(invitation.email),
        expires_at: invitation.expires_at,
        invited_by_name: invitation.invited_by_name,
        matchesCurrentUser,
        role: invitation.role,
        status: invitation.status,
        team_id: invitation.team_id,
        team_name: invitation.team_name,
      },
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al inspeccionar invitación de equipo', 'No se pudo verificar la invitación.');
  }
}

async function handleAcceptInvitation(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      sendBadRequest(res, 'Token de invitación obligatorio.');
      return;
    }

    const result = await acceptTeamInvitation(token, user.id, user.email);
    sendSuccess(res, {
      message: `Te has unido exitosamente al equipo ${result.team.name}.`,
      success: true,
      team: result.team,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al aceptar invitación de equipo', 'No se pudo aceptar la invitación.');
  }
}

async function handleGetCurrentTeam(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const [team, snapshot] = await Promise.all([
      getTeamById(teamCtx.id),
      getTeamMembersAndInvitations(teamCtx.id),
    ]);

    if (!team) {
      sendForbidden(res, 'Equipo no encontrado.');
      return;
    }

    sendSuccess(res, {
      invitations: teamCtx.permissions.includes('team:members:invite') ? snapshot.invitations : [],
      members: snapshot.members,
      pendingCount: snapshot.pendingCount,
      permissions: teamCtx.permissions,
      role: teamCtx.role,
      seatLimit: snapshot.seatLimit,
      seatsAvailable: snapshot.seatsAvailable,
      seatsUsed: snapshot.seatsUsed,
      success: true,
      team: {
        ...team,
        permissions: teamCtx.permissions,
        role: teamCtx.role,
      },
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al cargar detalles del equipo', 'No se pudo cargar la información del equipo.');
  }
}

async function handleUpdateCurrentTeam(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const { name } = req.body || {};
    const updated = await updateTeamProfile(teamCtx.id, { name });

    sendSuccess(res, {
      message: 'Datos del equipo actualizados exitosamente.',
      success: true,
      team: updated,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al actualizar equipo', 'No se pudo actualizar el equipo.');
  }
}

async function handleSearchTeamMembers(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const members = await searchTeamMembers(teamCtx.id, q);

    sendSuccess(res, {
      members,
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al buscar miembros del equipo', 'No se pudieron buscar miembros.');
  }
}

async function handleInviteTeamMember(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const { email, role } = req.body || {};
    const cleanRole: 'admin' | 'member' = role === 'admin' ? 'admin' : 'member';

    const result = await inviteMemberToTeam({
      email: String(email || ''),
      invitedByUserId: user.id,
      inviterName: user.username,
      role: cleanRole,
      teamId: teamCtx.id,
    });

    sendSuccess(res, {
      emailSent: result.emailSent,
      invitation: result.invitation,
      inviteUrl: result.inviteUrl,
      success: true,
    }, 201);
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al invitar miembro al equipo', 'No se pudo enviar la invitación.');
  }
}

async function handleRevokeInvitation(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const invitationId = Number(req.params.invitationId);
    if (!Number.isInteger(invitationId) || invitationId <= 0) {
      sendBadRequest(res, 'Identificador de invitación no válido.');
      return;
    }

    await revokeInvitation(teamCtx.id, invitationId);
    sendSuccess(res, {
      message: 'Invitación revocada. El asiento ha quedado disponible.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al revocar invitación', 'No se pudo revocar la invitación.');
  }
}

async function handleUpdateMemberRole(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      sendBadRequest(res, 'Usuario inválido.');
      return;
    }

    const role: 'admin' | 'member' = req.body?.role === 'admin' ? 'admin' : 'member';
    await updateTeamMemberRole(teamCtx.id, targetUserId, role, user.id);

    sendSuccess(res, {
      message: 'Rol de miembro actualizado exitosamente.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al actualizar rol de miembro', 'No se pudo actualizar el rol.');
  }
}

async function handleRemoveTeamMember(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      sendBadRequest(res, 'Usuario inválido.');
      return;
    }

    await removeTeamMember(teamCtx.id, targetUserId, user.id);
    sendSuccess(res, {
      message: 'Miembro eliminado del equipo. El asiento vuelve a estar disponible.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al eliminar miembro del equipo', 'No se pudo eliminar al miembro.');
  }
}

async function handleLeaveCurrentTeam(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    await leaveTeam(teamCtx.id, user.id);
    sendSuccess(res, {
      message: 'Has salido del equipo correctamente.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al abandonar equipo', 'No se pudo abandonar el equipo.');
  }
}

async function handleGetTeamBilling(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const [billing, purchases] = await Promise.all([
      getTeamBillingDetails(teamCtx.id),
      purchaseService.getPurchasesByTeamId(teamCtx.id),
    ]);

    sendSuccess(res, {
      billing,
      purchases,
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al obtener facturación de equipo', 'No se pudo consultar la facturación del equipo.');
  }
}

async function handlePreviewTeamSeats(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const seats = Number(req.body?.seats || 1);
    const preview = await previewTeamSeatChange(teamCtx.id, seats);

    sendSuccess(res, {
      preview,
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al previsualizar cambio de asientos', 'No se pudo calcular el ajuste de asientos.');
  }
}

async function handleUpdateTeamSeats(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const seats = Number(req.body?.seats || 1);
    const result = await updateTeamSeats(teamCtx.id, user.id, user.email, seats);

    sendSuccess(res, {
      ...result,
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al actualizar asientos del equipo', 'No se pudo actualizar los asientos del equipo.');
  }
}

async function handleConfirmTeamSeatUpgrade(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const teamCtx = getWorkspaceTeam(req);
    if (!user || !teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const paymentIntentId = typeof req.body?.paymentIntentId === 'string' ? req.body.paymentIntentId.trim() : '';
    if (!paymentIntentId) {
      sendBadRequest(res, 'ID de intento de pago requerido.');
      return;
    }

    const result = await confirmTeamSeatUpgradeIntent(teamCtx.id, user.id, paymentIntentId);
    sendSuccess(res, {
      ...result,
      message: 'Asientos ampliados exitosamente.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al confirmar ampliación de asientos', 'No se pudo confirmar la compra de asientos.');
  }
}

async function handleUpdateTeamRenewal(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    const cancelAtPeriodEnd = Boolean(req.body?.cancelAtPeriodEnd);
    const result = await updateTeamRenewal(teamCtx.id, cancelAtPeriodEnd);

    sendSuccess(res, {
      ...result,
      message: cancelAtPeriodEnd
        ? 'Renovación automática del equipo cancelada. El equipo seguirá activo hasta finalizar el período.'
        : 'Renovación automática del equipo reactivada exitosamente.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al actualizar renovación del equipo', 'No se pudo actualizar la renovación del equipo.');
  }
}

async function handleCancelTeamSubscriptionImmediate(req: Request, res: Response): Promise<void> {
  try {
    const teamCtx = getWorkspaceTeam(req);
    if (!teamCtx) {
      sendUnauthorized(res);
      return;
    }

    await cancelTeamSubscription(teamCtx.id);
    sendSuccess(res, {
      message: 'La suscripción del equipo ha sido cancelada.',
      success: true,
    });
  } catch (error) {
    handleTeamControllerError(res, error, 'Error al cancelar suscripción del equipo', 'No se pudo cancelar la suscripción del equipo.');
  }
}

export { handleAcceptInvitation, handleCancelTeamSubscriptionImmediate, handleConfirmTeamSeatUpgrade, handleCreateTeam, handleGetCurrentTeam, handleGetTeamBilling, handleInspectInvitation, handleInviteTeamMember, handleLeaveCurrentTeam, handleListMyTeams, handlePreviewTeamSeats, handleRemoveTeamMember, handleRevokeInvitation, handleSearchTeamMembers, handleUpdateCurrentTeam, handleUpdateMemberRole, handleUpdateTeamRenewal, handleUpdateTeamSeats };
