import type { User } from '../types/auth.types.js';
import type { TeamSummary } from '../types/team.types.js';

const LEGACY_ACTIVE_TEAM_STORAGE_KEY = 'boardpdf_active_team_id';
const workspaceListeners = new Set<(teamId: number | null) => void>();

let activeTeamId: number | null = null;

function clearLegacyWorkspaceStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_ACTIVE_TEAM_STORAGE_KEY);
    }
  } catch {}
}

clearLegacyWorkspaceStorage();

function getActiveTeamId(): number | null {
  return activeTeamId;
}

function setActiveTeamId(teamId: number | null): void {
  const normalized = teamId && Number.isInteger(Number(teamId)) && Number(teamId) > 0 ? Number(teamId) : null;
  const previous = activeTeamId;
  activeTeamId = normalized;
  clearLegacyWorkspaceStorage();

  if (previous !== normalized) {
    workspaceListeners.forEach((cb) => {
      try {
        cb(normalized);
      } catch {}
    });
  }
}

function onWorkspaceChange(callback: (teamId: number | null) => void): () => void {
  workspaceListeners.add(callback);
  return () => {
    workspaceListeners.delete(callback);
  };
}

function resolveActiveWorkspace(user?: User | null): TeamSummary | null {
  if (!activeTeamId || !user || !Array.isArray(user.teams)) {
    if (activeTeamId && user && !Array.isArray(user.teams)) {
      setActiveTeamId(null);
    }
    return null;
  }

  const found = user.teams.find((t) => Number(t.id) === activeTeamId);
  if (!found) {
    setActiveTeamId(null);
    return null;
  }
  return found;
}

export { getActiveTeamId, onWorkspaceChange, resolveActiveWorkspace, setActiveTeamId };
