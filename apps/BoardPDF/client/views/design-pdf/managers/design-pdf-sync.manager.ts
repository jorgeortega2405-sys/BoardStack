import { API_ROUTES } from '../../../config/api-routes.js';
import { PageDimension } from '../../../config/collab-page-presets.config.js';
import { currentUser, getApi } from '../../../services/api.service.js';
import { t } from '../../../services/i18n.service.js';
import { showToast } from '../../../services/toast.service.js';
import { wsService } from '../../../services/websocket.service.js';
import { getOrCreateGuestIdentity } from '../../../utils/collab-identity.util.js';
import { EditorElement, ManualGuide, PagePdfSource, RemotePeer } from '../types/design-pdf.types.js';
import { addPeerPresenceBubble, removePeerPresenceBubble, renderPresenceList, renderRemoteCursor } from '../utils/design-pdf-presence.util.js';

interface SyncManagerHost {
  closeContextMenu: () => void;
  container: HTMLElement;
  docDefaultPageSize: PageDimension;
  docId: string;
  docTitle: string;
  elements: EditorElement[];
  isAiLocked: boolean;
  isCollabRoomFull: boolean;
  isDestroyed: boolean;
  isLocalOnly: boolean;
  manualGuides: ManualGuide[];
  pageBackgrounds: string[];
  pageCount: number;
  pagePdfSources: Array<PagePdfSource | null>;
  pageSizes: PageDimension[];
  pageTitles: string[];
  recordHistory: () => void;
  removeTransformBox: () => void;
  renderPages: () => void;
  renderTransformBox: () => void;
  selectedElementId: string | null;
  selectedElementIds: Set<string>;
  setModified: (val: boolean) => void;
  updateContextToolbar: () => void;
}

class DesignPdfSyncManager {
  private aiLockPollTimer: ReturnType<typeof setInterval> | null = null;
  private aiLockedBy: string | null = null;
  private collabCleanup: (() => void) | null = null;
  private guestIdentity: { avatarUrl: string; username: string } | null = null;
  private host: SyncManagerHost;
  private isLocalAiGenerating = false;
  private lastCursorBroadcast = 0;
  private myClientId = '';
  private myColor = '#111827';
  private remoteCursorElements = new Map<string, HTMLElement>();
  private remoteCursorTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private remotePeers = new Map<string, RemotePeer>();

  constructor(host: SyncManagerHost) {
    this.host = host;
  }

  getMyClientId(): string {
    return this.myClientId;
  }

  getMyColor(): string {
    return this.myColor;
  }

  getRemotePeers(): Map<string, RemotePeer> {
    return this.remotePeers;
  }

  setLocalAiGenerating(val: boolean): void {
    this.isLocalAiGenerating = val;
  }

  destroy(): void {
    if (this.collabCleanup) {
      this.collabCleanup();
      this.collabCleanup = null;
    }
    this.stopAiLockPolling();
    this.remoteCursorTimers.forEach((timer) => clearTimeout(timer));
    this.remoteCursorTimers.clear();
    this.remoteCursorElements.forEach((el) => el.remove());
    this.remoteCursorElements.clear();
    this.remotePeers.clear();
  }

  initCollabWebSocket(): void {
    if (this.host.isLocalOnly) return;

    const user = currentUser;
    const isGuest = !user;
    let username = user?.username;
    let avatarUrl = user?.avatar_url || null;

    if (isGuest) {
      if (!this.guestIdentity) {
        this.guestIdentity = getOrCreateGuestIdentity();
      }
      username = this.guestIdentity.username;
      avatarUrl = this.guestIdentity.avatarUrl;
    }

    this.collabCleanup = wsService.joinCollabRoom({
      avatarUrl,
      docId: this.host.docId,
      isGuest,
      onMessage: (msg: any) => this.handleCollabSocketMessage(msg),
      userId: user?.id || null,
      username: username || t('collaborative.guest_name'),
    });
  }

  handleCollabSocketMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'joined') {
      this.myClientId = msg.clientId;
      this.myColor = msg.color;
      this.remotePeers.clear();
      if (Array.isArray(msg.peers)) {
        for (const p of msg.peers) {
          this.remotePeers.set(p.clientId, p);
        }
      }
      this.renderPresenceList();
    } else if (msg.type === 'userJoined') {
      if (msg.peer && msg.peer.clientId !== this.myClientId) {
        this.remotePeers.set(msg.peer.clientId, msg.peer);
        addPeerPresenceBubble(this.host.container, msg.peer);
        showToast(t('toasts.se_unio_al_diseno'), 'info');
      }
    } else if (msg.type === 'userLeft') {
      removePeerPresenceBubble(this.host.container, msg.clientId);
      this.remotePeers.delete(msg.clientId);
      const curEl = this.remoteCursorElements.get(msg.clientId);
      if (curEl) {
        curEl.remove();
        this.remoteCursorElements.delete(msg.clientId);
      }
    } else if (msg.type === 'cursor') {
      renderRemoteCursor(this.host.container, this.remoteCursorElements, this.remoteCursorTimers, this.remotePeers, msg);
    } else if (msg.type === 'elementChange') {
      this.handleRemoteElementChange(msg.action, msg.element);
    } else if (msg.type === 'docSync') {
      if (msg.title && msg.title !== this.host.docTitle) {
        this.host.docTitle = msg.title;
        const titleInput = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
        if (titleInput) titleInput.value = msg.title;
      }
      if (Array.isArray(msg.elements)) {
        this.host.elements = msg.elements;
        this.host.renderPages();
      }
    } else if (msg.type === 'aiLock') {
      this.setAiLock(Boolean(msg.locked), msg.lockedBy);
    }
  }

  handleRemoteElementChange(action: string, element: any): void {
    if (!element || !element.id) return;

    if (action === 'delete') {
      this.host.elements = this.host.elements.filter((el) => el.id !== element.id);
      const domEl = this.host.container.querySelector(`[data-element-id="${element.id}"]`);
      if (domEl) domEl.remove();
      if (this.host.selectedElementId === element.id) {
        this.host.selectedElementId = null;
        this.host.selectedElementIds.delete(element.id);
        this.host.removeTransformBox();
        this.host.updateContextToolbar();
      }
    } else if (action === 'update' || action === 'add') {
      const idx = this.host.elements.findIndex((el) => el.id === element.id);
      if (idx !== -1) {
        this.host.elements[idx] = element;
      } else {
        this.host.elements.push(element);
      }
      this.host.renderPages();
    }
  }

  renderPresenceList(): void {
    if (!currentUser && !this.guestIdentity) {
      this.guestIdentity = getOrCreateGuestIdentity();
    }
    renderPresenceList(this.host.container, this.remotePeers, this.myColor, this.host.isCollabRoomFull, this.guestIdentity);
  }

  broadcastElementUpdate(el: EditorElement): void {
    if (this.host.isLocalOnly || this.host.isCollabRoomFull) return;
    wsService.send({
      action: 'update',
      element: el,
      type: 'elementChange',
    });
  }

  broadcastElementDelete(id: string, pageIndex: number): void {
    if (this.host.isLocalOnly || this.host.isCollabRoomFull) return;
    wsService.send({
      action: 'delete',
      element: { id, pageIndex },
      type: 'elementChange',
    });
  }

  broadcastDocSync(): void {
    if (this.host.isLocalOnly || this.host.isCollabRoomFull) return;
    wsService.send({
      elements: this.host.elements,
      title: this.host.docTitle,
      type: 'docSync',
    });
  }

  broadcastCursor(clientX: number, clientY: number): void {
    if (this.host.isLocalOnly || this.host.isCollabRoomFull) return;
    const now = Date.now();
    if (now - this.lastCursorBroadcast < 40) return;
    this.lastCursorBroadcast = now;
    wsService.send({
      type: 'cursor',
      x: clientX,
      y: clientY,
    });
  }

  setAiLock(locked: boolean, lockedBy?: string): void {
    this.host.isAiLocked = locked;
    this.aiLockedBy = locked ? (lockedBy?.trim() || null) : null;

    this.host.container.classList.toggle('is-ai-locked', locked);
    const banner = this.host.container.querySelector<HTMLElement>('[data-ref="collab-ai-lock-banner"]');
    const bannerText = this.host.container.querySelector<HTMLElement>('[data-ref="txt-ai-lock-message"]');
    const shield = this.host.container.querySelector<HTMLElement>('[data-ref="collab-ai-lock-shield"]');

    banner?.classList.toggle('is-hidden', !locked);
    shield?.classList.toggle('is-hidden', !locked);

    if (bannerText) {
      bannerText.textContent = locked
        ? (this.aiLockedBy
          ? t('collaborative.ai_lock_active_by', { name: this.aiLockedBy })
          : t('collaborative.ai_lock_active'))
        : '';
    }

    if (locked) {
      this.host.removeTransformBox();
      this.host.closeContextMenu();
      this.startAiLockPolling();
    } else {
      this.stopAiLockPolling();
    }
  }

  startAiLockPolling(): void {
    if (this.aiLockPollTimer || this.host.isDestroyed || this.host.isLocalOnly || !this.host.docId) return;
    this.aiLockPollTimer = setInterval(async () => {
      if (this.host.isDestroyed || !this.host.isAiLocked || this.isLocalAiGenerating) {
        this.stopAiLockPolling();
        return;
      }
      try {
        const res = await getApi(API_ROUTES.collaborativeDocs.byId(this.host.docId));
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.aiLock?.locked && this.host.isAiLocked && !this.isLocalAiGenerating && !this.host.isDestroyed) {
          if (data?.document?.content) {
            this.host.docTitle = data.document.title || this.host.docTitle;
            this.host.pageCount = Math.max(1, data.document.page_count || data.document.content.pageCount || 1);
            this.host.elements = Array.isArray(data.document.content.elements) ? data.document.content.elements : [];
            this.host.manualGuides = Array.isArray(data.document.content.guides) ? data.document.content.guides : [];
            this.host.pageTitles = Array.isArray(data.document.content.pageTitles) && data.document.content.pageTitles.length > 0
              ? data.document.content.pageTitles
              : Array(this.host.pageCount).fill('');
            this.host.pageBackgrounds = Array.isArray(data.document.content.pageBackgrounds) && data.document.content.pageBackgrounds.length > 0
              ? data.document.content.pageBackgrounds
              : Array(this.host.pageCount).fill('#ffffff');
            this.host.pageSizes = Array.isArray(data.document.content.pageSizes) && data.document.content.pageSizes.length > 0
              ? data.document.content.pageSizes
              : Array(this.host.pageCount).fill(this.host.docDefaultPageSize);

            const titleInput = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"]');
            if (titleInput) titleInput.value = this.host.docTitle;
            this.host.renderPages();
            this.host.recordHistory();
          }
          this.setAiLock(false);
        }
      } catch {}
    }, 1200);
  }

  stopAiLockPolling(): void {
    if (this.aiLockPollTimer) {
      clearInterval(this.aiLockPollTimer);
      this.aiLockPollTimer = null;
    }
  }
}

export { DesignPdfSyncManager };
export type { SyncManagerHost };
