export interface LocalCollabDraft {
  content: {
    elements: any[];
    pageBackgrounds: string[];
    pageCount: number;
    pagePdfSources: any[];
    pageSize?: { height: number; width: number };
    pageSizes?: Array<{ height: number; width: number }>;
    pageTitles: string[];
  };
  createdAt: string;
  id: string;
  isLocalOnly: true;
  title: string;
  updatedAt: string;
  userId?: number | string | null;
}

const STORAGE_PREFIX = 'boardpdf_local_draft_';
const PENDING_SYNC_KEY = 'boardpdf_pending_cloud_sync_draft';

export function saveLocalDraft(id: string, data: Partial<LocalCollabDraft>, userId?: number | string | null): LocalCollabDraft {
  const existing = getLocalDraft(id);
  const now = new Date().toISOString();
  const effectiveUserId = data.userId !== undefined ? data.userId : (existing?.userId !== undefined ? existing.userId : (userId ?? null));
  const draft: LocalCollabDraft = {
    content: data.content || existing?.content || {
      elements: [],
      pageBackgrounds: ['#ffffff'],
      pageCount: 1,
      pagePdfSources: [null],
      pageSize: { height: 1123, width: 794 },
      pageTitles: [''],
    },
    createdAt: existing?.createdAt || now,
    id,
    isLocalOnly: true,
    title: data.title || existing?.title || 'Documento sin título',
    updatedAt: now,
    userId: effectiveUserId,
  };

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(draft));
  } catch {}

  return draft;
}

export function getLocalDraft(id: string): LocalCollabDraft | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw) {
      return JSON.parse(raw) as LocalCollabDraft;
    }
  } catch {}
  return null;
}

export function removeLocalDraft(id: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
    localStorage.removeItem(`boardpdf_wal_${id}`);
  } catch {}
}

export function clearAllLocalDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith('boardpdf_wal_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

export function listLocalDrafts(forUserId?: number | string | null): LocalCollabDraft[] {
  const drafts: LocalCollabDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as LocalCollabDraft;
          if (forUserId != null) {
            if (parsed.userId === undefined || parsed.userId === null || String(parsed.userId) === String(forUserId)) {
              drafts.push(parsed);
            }
          } else {
            if (parsed.userId === undefined || parsed.userId === null) {
              drafts.push(parsed);
            }
          }
        }
      }
    }
  } catch {}
  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function setPendingCloudSyncDraft(draft: LocalCollabDraft | null): void {
  try {
    if (draft) {
      sessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(draft));
    } else {
      sessionStorage.removeItem(PENDING_SYNC_KEY);
    }
  } catch {}
}

export function getPendingCloudSyncDraft(): LocalCollabDraft | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SYNC_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalCollabDraft;
    }
  } catch {}
  return null;
}
