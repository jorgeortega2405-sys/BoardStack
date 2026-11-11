import type { User } from '../types/auth.types.js';
import type { TeamSummary } from '../types/team.types.js';

const ACTIVE_TEAM_STORAGE_KEY = 'boardpdf_active_team_id';
const workspaceListeners = new Set<(teamId: number | null) => void>();

function getActiveTeamId(): number | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function setActiveTeamId(teamId: number | null): void {
  const normalized = teamId && Number.isInteger(Number(teamId)) && Number(teamId) > 0 ? Number(teamId) : null;
  const previous = getActiveTeamId();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (normalized) {
        window.localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, String(normalized));
      } else {
        window.localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
      }
    }
  } catch {}

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
  const activeId = getActiveTeamId();
  if (!activeId || !user || !Array.isArray(user.teams)) {
    if (activeId && user && !Array.isArray(user.teams)) {
      setActiveTeamId(null);
    }
    return null;
  }

  const found = user.teams.find((t) => Number(t.id) === activeId);
  if (!found) {
    setActiveTeamId(null);
    return null;
  }
  return found;
}

export { getActiveTeamId, onWorkspaceChange, resolveActiveWorkspace, setActiveTeamId };
