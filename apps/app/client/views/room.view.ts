import { arrayBufferToBase64, base64ToUint8Array, formatBytes, getFileIcon } from '../utils/format.util.js';
import { copyToClipboard, escapeHtml } from '../utils/dom.util.js';
import { currentUser, deleteApi, getApi } from '../services/api.service.js';
import { getGuestPersona } from '../utils/guest-personas.util.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { openModal } from '../components/modal.component.js';
import { renderIcons } from '../services/icon.service.js';
import { toast } from '../services/toast.service.js';

interface RoomParticipant {
  avatar_url?: string | null;
  can_upload?: boolean;
  is_owner: boolean;
  joined_at: number;
  peer_id: string;
  username: string;
}

interface WsMessage {
  can_upload?: boolean;
  candidate?: RTCIceCandidateInit;
  chunk_index?: number;
  code?: string;
  data?: string;
  download_count?: number;
  expires_at?: number;
  file?: any;
  file_id?: string;
  folder_id?: string;
  folder_name?: string;
  is_limit_reached?: boolean;
  is_persistent?: boolean;
  max_downloads?: number;
  mime_type?: string;
  name?: string;
  owner_username?: string;
  participants?: RoomParticipant[];
  reason?: string;
  relative_path?: string;
  requires_password?: boolean;
  room_id?: string;
  s3_url?: string;
  save_to_cloud?: boolean;
  sdp?: RTCSessionDescriptionInit;
  sender_avatar?: string;
  sender_peer_id?: string;
  sender_username?: string;
  size?: number;
  slug?: string;
  target_peer_id?: string;
  total_chunks?: number;
  type: string;
  upload_permission?: string;
}

interface ActiveDownload {
  chunks: (Uint8Array | null)[];
  downloadUrl?: string;
  metadata: {
    file_id: string;
    folder_id?: string;
    folder_name?: string;
    mime_type: string;
    name: string;
    relative_path?: string;
    sender_avatar?: string;
    sender_username?: string;
    size: number;
    total_chunks: number;
  };
  receivedBytes: number;
  startTime: number;
}

interface FolderFileItem {
  downloadUrl?: string;
  fileId: string;
  mimeType: string;
  name: string;
  progress: number;
  relativePath: string;
  size: number;
}

interface FolderState {
  cardEl?: HTMLElement;
  files: Map<string, FolderFileItem>;
  id: string;
  name: string;
  senderAvatar?: string;
  senderUsername: string;
}

interface PeerState {
  dataChannel: RTCDataChannel | null;
  isP2P: boolean;
  pc: RTCPeerConnection;
}

const CHUNK_SIZE = 64 * 1024;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const scanEntry = async (entry: any, path = ''): Promise<File[]> => {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((f: File) => {
        const fullPath = path ? `${path}/${f.name}` : f.name;
        Object.defineProperty(f, 'webkitRelativePath', {
          value: fullPath,
          writable: true,
        });
        resolve([f]);
      }, () => resolve([]));
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const dirPath = path ? `${path}/${entry.name}` : entry.name;
    const readAllEntries = async (): Promise<any[]> => {
      const result: any[] = [];
      let batch: any[] = await new Promise((res) => reader.readEntries(res, () => res([])));
      while (batch.length > 0) {
        result.push(...batch);
        batch = await new Promise((res) => reader.readEntries(res, () => res([])));
      }
      return result;
    };
    const entries = await readAllEntries();
    const filesArrays = await Promise.all(entries.map((e) => scanEntry(e, dirPath)));
    return filesArrays.flat();
  }
  return [];
};

const extractFilesFromDataTransfer = async (dt: DataTransfer): Promise<File[]> => {
  const items = Array.from(dt.items || []);
  const entries = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
  if (entries.length > 0) {
    const filePromises = entries.map((e) => scanEntry(e));
    const nestedFiles = await Promise.all(filePromises);
    return nestedFiles.flat();
  }
  return Array.from(dt.files);
};

async function createRoomView(roomId: string, navigate?: (path: string) => void): Promise<DocumentFragment> {
  const fragment = document.createDocumentFragment();

  let resolvedRoomId = roomId;
  let currentCode = '';
  let currentSlug = '';
  let isPersistentRoom = false;
  let hasPassword = false;
  let saveToCloud = false;
  let roomExpiresAt: number | null = null;
  let roomMaxDownloads: number | null = null;
  let roomUploadPermission = 'all';
  let canUpload = true;
  let isOwner = sessionStorage.getItem(`room_owner_${roomId}`) === 'true';

  try {
    const meta = await getApi<{
      code?: string;
      error?: string;
      expired?: boolean;
      expires_at?: number;
      is_persistent?: boolean;
      max_downloads?: number;
      ok: boolean;
      owner_token?: string;
      owner_username?: string;
      requires_password?: boolean;
      room_id?: string;
      save_to_cloud?: boolean;
      slug?: string;
      upload_permission?: string;
    }>(`/api/rooms/resolve/${encodeURIComponent(roomId)}`);

    if (meta && (meta.expired || meta.error?.includes('expired'))) {
      toast.error(i18n.t('room.room_expired_desc'));
      navigate?.('/');
      return fragment;
    }

    if (meta && meta.ok && meta.room_id) {
      resolvedRoomId = meta.room_id;
      currentCode = meta.code || '';
      currentSlug = meta.slug || '';
      isPersistentRoom = Boolean(meta.is_persistent);
      hasPassword = Boolean(meta.requires_password);
      saveToCloud = Boolean(meta.save_to_cloud) ||
                    sessionStorage.getItem(`room_save_to_cloud_${resolvedRoomId}`) === 'true' ||
                    (currentSlug ? sessionStorage.getItem(`room_save_to_cloud_${currentSlug}`) === 'true' : false);
      roomExpiresAt = meta.expires_at || null;
      roomMaxDownloads = meta.max_downloads || null;
      roomUploadPermission = meta.upload_permission ||
                            sessionStorage.getItem(`room_upload_permission_${resolvedRoomId}`) ||
                            (currentSlug ? sessionStorage.getItem(`room_upload_permission_${currentSlug}`) : null) ||
                            'all';

      if (meta.owner_token) {
        sessionStorage.setItem(`room_owner_token_${resolvedRoomId}`, meta.owner_token);
        if (currentSlug) {
          sessionStorage.setItem(`room_owner_token_${currentSlug}`, meta.owner_token);
        }
      }

      if (
        sessionStorage.getItem(`room_owner_${resolvedRoomId}`) === 'true' ||
        (currentSlug && sessionStorage.getItem(`room_owner_${currentSlug}`) === 'true') ||
        (currentUser && currentUser.username === meta.owner_username)
      ) {
        isOwner = true;
        sessionStorage.setItem(`room_owner_${resolvedRoomId}`, 'true');
        if (currentSlug) {
          sessionStorage.setItem(`room_owner_${currentSlug}`, 'true');
        }
      }

      if (isOwner) {
        canUpload = true;
      } else if (roomUploadPermission === 'owner_only' || roomUploadPermission === 'specific') {
        canUpload = false;
      } else {
        canUpload = true;
      }
    } else {
      toast.error(i18n.t('room.not_found'));
      navigate?.('/');
      return fragment;
    }
  } catch {
    toast.error(i18n.t('room.not_found'));
    navigate?.('/');
    return fragment;
  }

  const myPeerId = `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

  let myUsername = '';
  let myAvatarUrl = '';

  if (currentUser) {
    myUsername = currentUser.username || currentUser.email || 'User';
    myAvatarUrl = getUserAvatarUrl(currentUser, 80);
  } else {
    const persona = getGuestPersona(resolvedRoomId);
    myUsername = persona.name;
    myAvatarUrl = persona.avatarUrl;
  }

  let ws: WebSocket | null = null;
  let isCleanedUp = false;
  let isAuthPending = false;

  const peers = new Map<string, PeerState>();
  const activeDownloads = new Map<string, ActiveDownload>();
  const activeFolders = new Map<string, FolderState>();
  const activeTransfersDom = new Map<string, HTMLElement>();

  const topEl = document.createElement('div');
  topEl.className = 'component-top';
  topEl.setAttribute('data-ref', 'room-top');
  topEl.innerHTML = `
    <div class="component-top__left" data-ref="top-left">
      <button type="button" class="component-button component-button--icon-only component-button--h40" data-ref="btn-connection-mode" data-tooltip="${i18n.t('room.connecting_p2p')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.connecting_p2p')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
      </button>
      <button type="button" class="component-button component-button--icon-only component-button--h40 component-button--destructive" data-ref="btn-leave-room" data-tooltip="${isOwner ? i18n.t('room.close_room') : i18n.t('room.leave_room')}" data-tooltip-placement="bottom" aria-label="${isOwner ? i18n.t('room.close_room') : i18n.t('room.leave_room')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
      </button>
    </div>

    <div class="component-top__right" data-ref="top-right">
      <div class="component-avatar-group" data-ref="participants-avatar-group"></div>

      <div class="component-dropdown" data-ref="add-more-wrapper">
        <button type="button" class="component-button component-button--h40 is-hidden" data-ref="btn-add-more">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>${i18n.t('room.add_files')}</span>
        </button>

        <div class="component-dropdown-menu" data-ref="add-more-dropdown">
          <div class="component-dropdown-menu__item">
            <button type="button" class="component-button component-button--h40" data-ref="btn-add-files-item">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#upload_file"></use></svg>
              <span>${i18n.t('room.select_files')}</span>
            </button>
          </div>
          <div class="component-dropdown-menu__item">
            <button type="button" class="component-button component-button--h40" data-ref="btn-add-folder-item">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              <span>${i18n.t('room.select_folder')}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="component-dropdown" data-ref="share-wrapper">
        <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-share">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
          <span>${i18n.t('room.share')}</span>
        </button>

        <div class="component-dropdown-menu" data-ref="share-dropdown">
          <div class="component-dropdown-menu__item">
            <span class="component-dropdown-menu__label">${i18n.t('room.code_label')}</span>
            <div class="component-dropdown-menu__row">
              <span class="component-dropdown-menu__code-pill" data-ref="share-code-display">${i18n.t('room.connecting')}</span>
              <button type="button" class="component-button component-button--icon-only component-button--h40" data-ref="btn-copy-code" data-tooltip="${i18n.t('room.copy_code')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.copy_code')}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
              </button>
            </div>
          </div>
          <div class="component-dropdown-menu__item">
            <button type="button" class="component-button component-button--h40 component-button--outline" data-ref="btn-copy-link">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
              <span>${i18n.t('room.copy_link')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const bottomEl = document.createElement('div');
  bottomEl.className = 'component-bottom';
  bottomEl.setAttribute('data-ref', 'room-bottom');
  bottomEl.innerHTML = `
    <div class="component-dropzone" data-ref="dropzone-area">
      <div class="component-dropzone__icon-box">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
      </div>
      <p class="component-dropzone__title">${i18n.t('room.dropzone_title')}</p>
      <p class="component-dropzone__desc">${i18n.t('room.dropzone_desc')}</p>
      <div class="component-dropzone__actions">
        <input type="file" multiple class="is-hidden" data-ref="input-files" />
        <input type="file" webkitdirectory class="is-hidden" data-ref="input-folder" />
        <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-select-files">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#upload_file"></use></svg>
          <span>${i18n.t('room.select_files')}</span>
        </button>
        <button type="button" class="component-button component-button--h40" data-ref="btn-select-folder">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          <span>${i18n.t('room.select_folder')}</span>
        </button>
      </div>
    </div>

    <div class="component-grid--files is-hidden" data-ref="files-cards-grid"></div>
  `;

  renderIcons(topEl);
  renderIcons(bottomEl);

  fragment.appendChild(topEl);
  fragment.appendChild(bottomEl);

  const shareCodeDisplayEl = topEl.querySelector<HTMLElement>('[data-ref="share-code-display"]');
  const btnConnectionMode = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-connection-mode"]');
  const btnShare = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-share"]');
  const shareDropdown = topEl.querySelector<HTMLElement>('[data-ref="share-dropdown"]');
  const btnAddMore = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-add-more"]');
  const addMoreDropdown = topEl.querySelector<HTMLElement>('[data-ref="add-more-dropdown"]');
  const btnAddFilesItem = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-add-files-item"]');
  const btnAddFolderItem = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-add-folder-item"]');
  const avatarGroupEl = topEl.querySelector<HTMLElement>('[data-ref="participants-avatar-group"]');
  const btnCopyCode = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-copy-code"]');
  const btnCopyLink = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-copy-link"]');
  const btnLeaveRoom = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-leave-room"]');

  const roomBottomEl = bottomEl;
  const filesCardsGridEl = bottomEl.querySelector<HTMLElement>('[data-ref="files-cards-grid"]');
  const dropzoneArea = bottomEl.querySelector<HTMLElement>('[data-ref="dropzone-area"]');
  const inputFiles = bottomEl.querySelector<HTMLInputElement>('[data-ref="input-files"]');
  const inputFolder = bottomEl.querySelector<HTMLInputElement>('[data-ref="input-folder"]');
  const btnSelectFiles = bottomEl.querySelector<HTMLButtonElement>('[data-ref="btn-select-files"]');
  const btnSelectFolder = bottomEl.querySelector<HTMLButtonElement>('[data-ref="btn-select-folder"]');

  const checkDropzoneVisibility = () => {
    const hasItems = activeTransfersDom.size > 0 || activeFolders.size > 0;
    if (hasItems) {
      dropzoneArea?.classList.add('is-hidden');
      filesCardsGridEl?.classList.remove('is-hidden');
      if (canUpload) {
        btnAddMore?.classList.remove('is-hidden');
      } else {
        btnAddMore?.classList.add('is-hidden');
      }
    } else {
      dropzoneArea?.classList.remove('is-hidden');
      filesCardsGridEl?.classList.add('is-hidden');
      btnAddMore?.classList.add('is-hidden');
    }
  };

  const updateUploadUiState = () => {
    const dropzoneDesc = dropzoneArea?.querySelector<HTMLElement>('.component-dropzone__desc');
    if (canUpload) {
      btnSelectFiles?.classList.remove('is-hidden');
      btnSelectFolder?.classList.remove('is-hidden');
      if (dropzoneDesc) {
        dropzoneDesc.textContent = i18n.t('room.dropzone_desc');
      }
    } else {
      btnSelectFiles?.classList.add('is-hidden');
      btnSelectFolder?.classList.add('is-hidden');
      if (dropzoneDesc) {
        dropzoneDesc.textContent = i18n.t('room.no_upload_permission_desc');
      }
    }
    checkDropzoneVisibility();
  };

  updateUploadUiState();

  btnShare?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    addMoreDropdown?.classList.remove('is-open');
    shareDropdown?.classList.toggle('is-open');
  });

  btnAddMore?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    shareDropdown?.classList.remove('is-open');
    addMoreDropdown?.classList.toggle('is-open');
  });

  btnAddFilesItem?.addEventListener('click', () => {
    addMoreDropdown?.classList.remove('is-open');
    inputFiles?.click();
  });

  btnAddFolderItem?.addEventListener('click', () => {
    addMoreDropdown?.classList.remove('is-open');
    inputFolder?.click();
  });

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (shareDropdown?.classList.contains('is-open')) {
      if (!shareDropdown.contains(target) && !btnShare?.contains(target)) {
        shareDropdown.classList.remove('is-open');
      }
    }
    if (addMoreDropdown?.classList.contains('is-open')) {
      if (!addMoreDropdown.contains(target) && !btnAddMore?.contains(target)) {
        addMoreDropdown.classList.remove('is-open');
      }
    }
  });

  const updateConnectionModeBadge = () => {
    if (!btnConnectionMode) return;
    const hasActiveP2P = Array.from(peers.values()).some((p) => p.isP2P);
    if (hasActiveP2P) {
      btnConnectionMode.setAttribute('data-tooltip', i18n.t('room.p2p_active_tooltip'));
      btnConnectionMode.removeAttribute('title');
      btnConnectionMode.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#bolt"></use></svg>`;
    } else {
      btnConnectionMode.setAttribute('data-tooltip', i18n.t('room.relay_active_tooltip'));
      btnConnectionMode.removeAttribute('title');
      btnConnectionMode.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>`;
    }
    renderIcons(btnConnectionMode);
  };

  btnConnectionMode?.addEventListener('click', () => {
    const hasActiveP2P = Array.from(peers.values()).some((p) => p.isP2P);
    toast.info(hasActiveP2P ? i18n.t('room.p2p_direct') : i18n.t('room.relay_mode'));
  });

  btnCopyCode?.addEventListener('click', async () => {
    if (!currentCode) return;
    await copyToClipboard(currentCode, i18n.t('room.code_copied'));
  });

  btnCopyLink?.addEventListener('click', async () => {
    const shareUrl = currentSlug
      ? `${window.location.origin}/r/${currentSlug}`
      : window.location.href;
    await copyToClipboard(shareUrl, i18n.t('room.link_copied'));
  });

  const handleExit = () => {
    if (isOwner && isPersistentRoom) {
      openModal({
        bodyHtml: `
          <div class="component-card component-card--flat" data-ref="exit-persistent-info">
            <p class="component-subtitle">${i18n.t('room.delete_room_confirm_desc')}</p>
          </div>
        `,
        cancelText: i18n.t('room.leave_only'),
        confirmClass: 'component-button--destructive',
        confirmText: i18n.t('room.delete_permanently'),
        description: i18n.t('room.delete_room_confirm_title'),
        onCancel: () => {
          cleanup();
          navigate?.('/');
        },
        onConfirm: async () => {
          try {
            await deleteApi('/api/rooms/' + encodeURIComponent(resolvedRoomId));
          } catch {}
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'close_room' }));
          }
          cleanup();
          navigate?.('/');
        },
        showCancel: true,
        showConfirm: true,
        size: 'sm',
        title: i18n.t('room.confirm_leave_title'),
      });
    } else {
      openModal({
        cancelText: i18n.t('common.cancel'),
        confirmText: i18n.t('common.accept'),
        description: i18n.t('room.confirm_leave_desc'),
        onConfirm: async () => {
          if (isOwner) {
            try {
              await deleteApi('/api/rooms/' + encodeURIComponent(resolvedRoomId));
            } catch {}
          }
          cleanup();
          navigate?.('/');
        },
        showCancel: true,
        showConfirm: true,
        size: 'sm',
        title: i18n.t('room.confirm_leave_title'),
      });
    }
  };

  btnLeaveRoom?.addEventListener('click', handleExit);

  const getOrCreateFileCardEl = (
    fileId: string,
    name: string,
    size: number,
    senderUsername: string
  ): HTMLElement => {
    let cardEl = activeTransfersDom.get(fileId);
    if (!cardEl && filesCardsGridEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'component-card component-card--file';
      cardEl.setAttribute('data-ref', `file-card-${fileId}`);

      cardEl.innerHTML = `
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${getFileIcon(name)}"></use></svg>
        </div>
        <div class="component-card__content">
          <h3 class="component-card__title" data-ref="file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
          <div class="component-card__meta">
            <span class="component-card__desc" data-ref="file-size">${formatBytes(size)}</span>
            <span class="component-card__dot">•</span>
            <span class="component-card__desc" data-ref="file-sender">${escapeHtml(senderUsername)}</span>
            <span class="component-card__desc" data-ref="file-downloads"></span>
          </div>
        </div>
        <div class="component-card__actions" data-ref="file-actions">
          <div class="component-ring-spinner" data-ref="file-spinner">
            <svg viewBox="0 0 32 32">
              <circle class="component-ring-spinner__bg" cx="16" cy="16" r="12"></circle>
              <circle class="component-ring-spinner__val" cx="16" cy="16" r="12" style="stroke-dashoffset: 75.4;"></circle>
            </svg>
            <span class="component-ring-spinner__text" data-ref="file-spinner-text">0%</span>
          </div>
        </div>
      `;

      renderIcons(cardEl);
      filesCardsGridEl.appendChild(cardEl);
      activeTransfersDom.set(fileId, cardEl);
      checkDropzoneVisibility();
    }
    return cardEl!;
  };

  const renderCloudFileCard = (file: {
    download_count?: number;
    download_url: string;
    expires_at?: number | null;
    file_id: string;
    folder_id?: string | null;
    folder_name?: string | null;
    is_limit_reached?: boolean;
    max_downloads?: number | null;
    mime_type: string;
    name: string;
    relative_path?: string | null;
    sender_avatar?: string | null;
    sender_username?: string;
    size: number;
  }) => {
    let cardEl = activeTransfersDom.get(file.file_id);
    if (!cardEl && filesCardsGridEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'component-card component-card--file';
      cardEl.setAttribute('data-ref', `file-card-${file.file_id}`);

      const senderName = file.sender_username || myUsername;
      const downloadText = (file.max_downloads !== undefined && file.max_downloads !== null)
        ? ` • ${file.download_count || 0}/${file.max_downloads}`
        : '';
      const savedPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                            (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) ||
                            '';
      const fileDlUrl = savedPassword && !file.download_url.includes('password=')
        ? `${file.download_url}?password=${encodeURIComponent(savedPassword)}`
        : file.download_url;

      cardEl.innerHTML = `
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${getFileIcon(file.name)}"></use></svg>
        </div>
        <div class="component-card__content">
          <h3 class="component-card__title" data-ref="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</h3>
          <div class="component-card__meta">
            <span class="component-card__desc" data-ref="file-size">${formatBytes(file.size)}</span>
            <span class="component-card__dot">•</span>
            <span class="component-card__desc" data-ref="file-sender">${escapeHtml(senderName)}</span>
            <span class="component-card__desc" data-ref="file-downloads">${escapeHtml(downloadText)}</span>
          </div>
        </div>
        <div class="component-card__actions" data-ref="file-actions">
          ${file.is_limit_reached ? `
            <span class="component-badge component-badge--destructive" data-ref="badge-limit-reached">
              ${i18n.t('room.download_limit_reached')}
            </span>
          ` : `
            <a href="${fileDlUrl}" download="${escapeHtml(file.name)}" class="component-button component-button--icon-only component-button--h34" data-ref="btn-download" data-tooltip="${i18n.t('room.download_file')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_file')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </a>
          `}
        </div>
      `;

      renderIcons(cardEl);
      filesCardsGridEl.appendChild(cardEl);
      activeTransfersDom.set(file.file_id, cardEl);
      checkDropzoneVisibility();
    } else if (cardEl) {
      const actionsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-actions"]');
      const downloadsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-downloads"]');
      if (downloadsEl && file.max_downloads !== undefined && file.max_downloads !== null) {
        downloadsEl.textContent = ` • ${file.download_count || 0}/${file.max_downloads}`;
      }
      if (actionsEl) {
        if (file.is_limit_reached) {
          actionsEl.innerHTML = `
            <span class="component-badge component-badge--destructive" data-ref="badge-limit-reached">
              ${i18n.t('room.download_limit_reached')}
            </span>
          `;
        } else if (!actionsEl.querySelector('[data-ref="btn-download"]')) {
          actionsEl.innerHTML = `
            <a href="${file.download_url}" download="${escapeHtml(file.name)}" class="component-button component-button--icon-only component-button--h34" data-ref="btn-download" data-tooltip="${i18n.t('room.download_file')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_file')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </a>
          `;
          renderIcons(actionsEl);
        }
      }
    }
  };

  const loadCloudFiles = async () => {
    try {
      const savedPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                            (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) ||
                            '';
      const passQuery = savedPassword ? `?password=${encodeURIComponent(savedPassword)}` : '';
      const res = await getApi<{
        files: Array<{
          download_count: number;
          download_url: string;
          expires_at?: number | null;
          file_id: string;
          folder_id?: string | null;
          folder_name?: string | null;
          is_limit_reached: boolean;
          max_downloads?: number | null;
          mime_type: string;
          name: string;
          relative_path?: string | null;
          sender_avatar?: string | null;
          sender_username?: string;
          size: number;
        }>;
        ok: boolean;
      }>(`/api/rooms/${encodeURIComponent(resolvedRoomId)}/files${passQuery}`);

      if (res && res.ok && Array.isArray(res.files)) {
        res.files.forEach((f) => {
          renderCloudFileCard(f);
        });
      }
    } catch {}
  };

  const updateFileCardProgress = (
    fileId: string,
    name: string,
    size: number,
    progress: number,
    _speed: number,
    _statusText: string,
    senderUsername: string,
    downloadUrl?: string
  ) => {
    const cardEl = getOrCreateFileCardEl(fileId, name, size, senderUsername);
    if (!cardEl) return;

    const spinnerVal = cardEl.querySelector<SVGCircleElement>('.component-ring-spinner__val');
    const spinnerText = cardEl.querySelector<HTMLElement>('[data-ref="file-spinner-text"]');
    const actionsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-actions"]');

    if (spinnerVal) {
      const offset = (75.4 - (75.4 * Math.min(100, Math.max(0, progress))) / 100).toFixed(1);
      spinnerVal.style.strokeDashoffset = offset;
    }

    if (spinnerText) {
      spinnerText.textContent = `${progress}%`;
    }

    if (progress >= 100 && actionsEl) {
      if (downloadUrl) {
        if (!actionsEl.querySelector('[data-ref="btn-download"]')) {
          actionsEl.innerHTML = `
            <a href="${downloadUrl}" download="${escapeHtml(name)}" class="component-button component-button--icon-only component-button--h34" data-ref="btn-download" data-tooltip="${i18n.t('room.download_file')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_file')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </a>
          `;
          renderIcons(actionsEl);
        }
      } else {
        if (!actionsEl.querySelector('[data-ref="icon-file-done"]')) {
          actionsEl.innerHTML = `
            <span class="component-badge component-badge--success" data-ref="icon-file-done">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
            </span>
          `;
          renderIcons(actionsEl);
        }
      }
    }
  };

  const downloadAllFolderFiles = (folder: FolderState) => {
    let delay = 0;
    folder.files.forEach((fileItem) => {
      if (fileItem.downloadUrl) {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = fileItem.downloadUrl!;
          a.download = fileItem.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, delay);
        delay += 200;
      }
    });
  };

  const showFolderModal = (folderId: string) => {
    const folder = activeFolders.get(folderId);
    if (!folder) return;

    let totalBytes = 0;
    folder.files.forEach((f) => {
      totalBytes += f.size;
    });

    const listEl = document.createElement('div');
    listEl.className = 'component-group';
    listEl.style.maxHeight = '360px';
    listEl.style.overflowY = 'auto';
    listEl.setAttribute('data-ref', 'folder-modal-list');

    const filesArr = Array.from(folder.files.values());
    listEl.innerHTML = filesArr.map((f) => `
      <div class="component-item" data-ref="folder-modal-item-${f.fileId}">
        <div class="component-item__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${getFileIcon(f.name)}"></use></svg>
        </div>
        <div class="component-item__text">
          <p class="component-item__title" title="${escapeHtml(f.relativePath || f.name)}">${escapeHtml(f.name)}</p>
          <p class="component-item__desc">${formatBytes(f.size)}</p>
        </div>
        <div class="component-item__actions">
          ${f.downloadUrl ? `
            <a href="${f.downloadUrl}" download="${escapeHtml(f.name)}" class="component-button component-button--icon-only component-button--h34" data-ref="btn-modal-file-download" data-tooltip="${i18n.t('room.download_file')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_file')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </a>
          ` : `
            <span class="component-badge">${f.progress}%</span>
          `}
        </div>
      </div>
    `).join('');

    renderIcons(listEl);

    const hasAnyDownloads = filesArr.some((f) => !!f.downloadUrl);

    openModal({
      bodyHtml: listEl,
      cancelText: i18n.t('common.close'),
      confirmText: i18n.t('room.download_all'),
      description: `${folder.files.size} ${i18n.t('room.files_count', { count: folder.files.size })} • ${formatBytes(totalBytes)}`,
      onConfirm: () => {
        downloadAllFolderFiles(folder);
      },
      showCancel: true,
      showConfirm: hasAnyDownloads,
      size: 'md',
      title: folder.name,
    });
  };

  const getOrCreateFolderCardEl = (folder: FolderState): HTMLElement => {
    let cardEl = folder.cardEl;
    if (!cardEl && filesCardsGridEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'component-card component-card--file component-card--folder';
      cardEl.setAttribute('data-ref', `folder-card-${folder.id}`);

      cardEl.innerHTML = `
        <div class="component-card__icon-box">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
        </div>
        <div class="component-card__content">
          <h3 class="component-card__title" data-ref="folder-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</h3>
          <div class="component-card__meta">
            <span class="component-card__desc" data-ref="folder-files-count">0 ${i18n.t('room.files_count', { count: 0 })}</span>
            <span class="component-card__dot">•</span>
            <span class="component-card__desc" data-ref="folder-size">0 B</span>
            <span class="component-card__dot">•</span>
            <span class="component-card__desc" data-ref="folder-sender">${escapeHtml(folder.senderUsername)}</span>
          </div>
        </div>
        <div class="component-card__actions" data-ref="folder-actions">
          <div class="component-ring-spinner" data-ref="folder-spinner">
            <svg viewBox="0 0 32 32">
              <circle class="component-ring-spinner__bg" cx="16" cy="16" r="12"></circle>
              <circle class="component-ring-spinner__val" cx="16" cy="16" r="12" style="stroke-dashoffset: 75.4;"></circle>
            </svg>
            <span class="component-ring-spinner__text" data-ref="folder-spinner-text">0%</span>
          </div>
        </div>
      `;

      cardEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-ref="btn-folder-download"]')) {
          downloadAllFolderFiles(folder);
          return;
        }
        showFolderModal(folder.id);
      });

      renderIcons(cardEl);
      filesCardsGridEl.appendChild(cardEl);
      folder.cardEl = cardEl;
      checkDropzoneVisibility();
    }
    return cardEl!;
  };

  const updateFolderProgress = (folderId: string) => {
    const folder = activeFolders.get(folderId);
    if (!folder) return;

    const cardEl = getOrCreateFolderCardEl(folder);
    if (!cardEl) return;

    let totalBytes = 0;
    let transferredBytes = 0;
    let allComplete = folder.files.size > 0;
    let hasAnyDownload = false;

    folder.files.forEach((fileItem) => {
      totalBytes += fileItem.size;
      transferredBytes += Math.round((fileItem.progress / 100) * fileItem.size);
      if (fileItem.progress < 100) {
        allComplete = false;
      }
      if (fileItem.downloadUrl) {
        hasAnyDownload = true;
      }
    });

    const overallProgress = totalBytes > 0
      ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100))
      : 0;

    const countEl = cardEl.querySelector<HTMLElement>('[data-ref="folder-files-count"]');
    const sizeEl = cardEl.querySelector<HTMLElement>('[data-ref="folder-size"]');
    const spinnerVal = cardEl.querySelector<SVGCircleElement>('.component-ring-spinner__val');
    const spinnerText = cardEl.querySelector<HTMLElement>('[data-ref="folder-spinner-text"]');
    const actionsEl = cardEl.querySelector<HTMLElement>('[data-ref="folder-actions"]');

    if (countEl) {
      countEl.textContent = `${folder.files.size} ${i18n.t('room.files_count', { count: folder.files.size })}`;
    }

    if (sizeEl) {
      sizeEl.textContent = formatBytes(totalBytes);
    }

    if (spinnerVal) {
      const offset = (75.4 - (75.4 * overallProgress) / 100).toFixed(1);
      spinnerVal.style.strokeDashoffset = offset;
    }

    if (spinnerText) {
      spinnerText.textContent = `${overallProgress}%`;
    }

    if (allComplete && actionsEl) {
      if (hasAnyDownload) {
        if (!actionsEl.querySelector('[data-ref="btn-folder-download"]')) {
          actionsEl.innerHTML = `
            <button type="button" class="component-button component-button--icon-only component-button--h34" data-ref="btn-folder-download" data-tooltip="${i18n.t('room.download_all')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_all')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </button>
          `;
          renderIcons(actionsEl);
        }
      } else {
        if (!actionsEl.querySelector('[data-ref="icon-folder-done"]')) {
          actionsEl.innerHTML = `
            <span class="component-badge component-badge--success" data-ref="icon-folder-done">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
            </span>
          `;
          renderIcons(actionsEl);
        }
      }
    }
  };

  const broadcastTransferMessage = (msgObj: object) => {
    const msgStr = JSON.stringify(msgObj);
    let sentP2P = false;

    peers.forEach((peer) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        try {
          peer.dataChannel.send(msgStr);
          sentP2P = true;
        } catch {}
      }
    });

    const needRelay = !sentP2P || Array.from(peers.values()).some((p) => !p.dataChannel || p.dataChannel.readyState !== 'open');
    if (needRelay && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msgStr);
    }
  };

  const handleIncomingMessage = (rawText: string) => {
    try {
      const data: WsMessage = JSON.parse(rawText);

      if (data.type === 'file_start') {
        if (data.sender_peer_id === myPeerId) return;
        if (data.file_id && data.name && typeof data.size === 'number' && typeof data.total_chunks === 'number') {
          if (!activeDownloads.has(data.file_id)) {
            activeDownloads.set(data.file_id, {
              chunks: new Array(data.total_chunks).fill(null),
              metadata: {
                file_id: data.file_id,
                folder_id: data.folder_id,
                folder_name: data.folder_name,
                mime_type: data.mime_type || 'application/octet-stream',
                name: data.name,
                relative_path: data.relative_path,
                sender_avatar: data.sender_avatar,
                sender_username: data.sender_username,
                size: data.size,
                total_chunks: data.total_chunks,
              },
              receivedBytes: 0,
              startTime: Date.now(),
            });

            if (data.folder_id && data.folder_name) {
              let folder = activeFolders.get(data.folder_id);
              if (!folder) {
                folder = {
                  files: new Map(),
                  id: data.folder_id,
                  name: data.folder_name,
                  senderAvatar: data.sender_avatar,
                  senderUsername: data.sender_username || i18n.t('room.guest_badge'),
                };
                activeFolders.set(data.folder_id, folder);
              }
              folder.files.set(data.file_id, {
                fileId: data.file_id,
                mimeType: data.mime_type || 'application/octet-stream',
                name: data.name,
                progress: 0,
                relativePath: data.relative_path || data.name,
                size: data.size,
              });
              updateFolderProgress(data.folder_id);
            } else {
              updateFileCardProgress(
                data.file_id,
                data.name,
                data.size,
                0,
                0,
                '0%',
                data.sender_username || i18n.t('room.guest_badge')
              );
            }
          }
        }
      } else if (data.type === 'file_chunk') {
        if (data.sender_peer_id === myPeerId) return;
        if (data.file_id && typeof data.chunk_index === 'number' && data.data) {
          const item = activeDownloads.get(data.file_id);
          if (item && item.chunks[data.chunk_index] === null) {
            const chunkBytes = base64ToUint8Array(data.data);
            item.chunks[data.chunk_index] = chunkBytes;
            item.receivedBytes += chunkBytes.byteLength;

            const progress = Math.min(100, Math.round((item.receivedBytes / item.metadata.size) * 100));
            const elapsedSec = (Date.now() - item.startTime) / 1000 || 0.001;
            const speedMb = parseFloat(((item.receivedBytes / elapsedSec) / (1024 * 1024)).toFixed(1));

            if (item.metadata.folder_id) {
              const folder = activeFolders.get(item.metadata.folder_id);
              const fItem = folder?.files.get(item.metadata.file_id);
              if (fItem) {
                fItem.progress = progress;
                updateFolderProgress(item.metadata.folder_id);
              }
            } else {
              updateFileCardProgress(
                item.metadata.file_id,
                item.metadata.name,
                item.metadata.size,
                progress,
                speedMb,
                `${progress}%`,
                item.metadata.sender_username || i18n.t('room.guest_badge')
              );
            }
          }
        }
      } else if (data.type === 'file_complete') {
        if (data.sender_peer_id === myPeerId) return;
        if (data.file_id) {
          const item = activeDownloads.get(data.file_id);
          if (item && !item.downloadUrl) {
            const validChunks = item.chunks.filter((c): c is Uint8Array => c !== null);
            const blob = new Blob(validChunks as BlobPart[], { type: item.metadata.mime_type });
            const downloadUrl = URL.createObjectURL(blob);
            item.downloadUrl = downloadUrl;

            if (item.metadata.folder_id) {
              const folder = activeFolders.get(item.metadata.folder_id);
              const fItem = folder?.files.get(item.metadata.file_id);
              if (fItem) {
                fItem.progress = 100;
                fItem.downloadUrl = downloadUrl;
                updateFolderProgress(item.metadata.folder_id);
              }
            } else {
              updateFileCardProgress(
                item.metadata.file_id,
                item.metadata.name,
                item.metadata.size,
                100,
                0,
                i18n.t('room.transfer_completed'),
                item.metadata.sender_username || i18n.t('room.guest_badge'),
                downloadUrl
              );
              toast.success(i18n.t('room.file_received_success', { name: item.metadata.name }));
            }
          }
        }
      }
    } catch {}
  };

  const setupDataChannelEvents = (channel: RTCDataChannel, targetPeerId: string) => {
    channel.onopen = () => {
      const peer = peers.get(targetPeerId);
      if (peer) {
        peer.isP2P = true;
      }
      updateConnectionModeBadge();
    };

    channel.onclose = () => {
      const peer = peers.get(targetPeerId);
      if (peer) {
        peer.isP2P = false;
      }
      updateConnectionModeBadge();
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        handleIncomingMessage(event.data);
      }
    };
  };

  const initiatePeerConnection = async (targetPeerId: string): Promise<void> => {
    if (peers.has(targetPeerId)) return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const dataChannel = pc.createDataChannel(`data_${roomId}`, { ordered: true });
    peers.set(targetPeerId, { dataChannel, isP2P: false, pc });

    setupDataChannelEvents(dataChannel, targetPeerId);

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          candidate: event.candidate,
          sender_peer_id: myPeerId,
          target_peer_id: targetPeerId,
          type: 'webrtc_ice',
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const peer = peers.get(targetPeerId);
      if (peer) {
        peer.isP2P = pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed';
      }
      updateConnectionModeBadge();
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          sdp: offer,
          sender_peer_id: myPeerId,
          target_peer_id: targetPeerId,
          type: 'webrtc_offer',
        }));
      }
    } catch {
      updateConnectionModeBadge();
    }
  };

  const handleRemoteOffer = async (senderPeerId: string, sdp: RTCSessionDescriptionInit): Promise<void> => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerState: PeerState = { dataChannel: null, isP2P: false, pc };
    peers.set(senderPeerId, peerState);

    pc.ondatachannel = (event) => {
      peerState.dataChannel = event.channel;
      setupDataChannelEvents(event.channel, senderPeerId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          candidate: event.candidate,
          sender_peer_id: myPeerId,
          target_peer_id: senderPeerId,
          type: 'webrtc_ice',
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      peerState.isP2P = pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed';
      updateConnectionModeBadge();
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          sdp: answer,
          sender_peer_id: myPeerId,
          target_peer_id: senderPeerId,
          type: 'webrtc_answer',
        }));
      }
    } catch {
      updateConnectionModeBadge();
    }
  };

  const handleRemoteAnswer = async (senderPeerId: string, sdp: RTCSessionDescriptionInit): Promise<void> => {
    const peer = peers.get(senderPeerId);
    if (!peer) return;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch {}
  };

  const handleRemoteIce = async (senderPeerId: string, candidate: RTCIceCandidateInit): Promise<void> => {
    const peer = peers.get(senderPeerId);
    if (!peer) return;

    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  };

  const sendFile = async (file: File): Promise<void> => {
    const fileId = `file_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const relativePath = (file as any).webkitRelativePath || file.name;
    const isFolder = relativePath.includes('/');
    const folderName = isFolder ? relativePath.split('/')[0] : undefined;
    const folderId = isFolder ? `folder_${encodeURIComponent(folderName!)}_${myPeerId}` : undefined;

    if (isFolder && folderId && folderName) {
      let folder = activeFolders.get(folderId);
      if (!folder) {
        folder = {
          files: new Map(),
          id: folderId,
          name: folderName,
          senderAvatar: myAvatarUrl,
          senderUsername: myUsername,
        };
        activeFolders.set(folderId, folder);
      }
      folder.files.set(fileId, {
        fileId,
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
        progress: 0,
        relativePath,
        size: file.size,
      });
      updateFolderProgress(folderId);
    } else {
      updateFileCardProgress(
        fileId,
        file.name,
        file.size,
        0,
        0,
        '0%',
        myUsername
      );
    }

    broadcastTransferMessage({
      file_id: fileId,
      folder_id: folderId,
      folder_name: folderName,
      mime_type: file.type || 'application/octet-stream',
      name: file.name,
      relative_path: relativePath,
      sender_avatar: myAvatarUrl,
      sender_peer_id: myPeerId,
      sender_username: myUsername,
      size: file.size,
      total_chunks: totalChunks,
      type: 'file_start',
    });

    const startTime = Date.now();
    let sentBytes = 0;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (isCleanedUp) break;

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();
      const base64Data = arrayBufferToBase64(buffer);

      broadcastTransferMessage({
        chunk_index: chunkIndex,
        data: base64Data,
        file_id: fileId,
        folder_id: folderId,
        sender_peer_id: myPeerId,
        type: 'file_chunk',
      });

      sentBytes += slice.size;
      const progress = Math.min(100, Math.round((sentBytes / file.size) * 100));
      const elapsedSec = (Date.now() - startTime) / 1000 || 0.001;
      const speedMb = parseFloat(((sentBytes / elapsedSec) / (1024 * 1024)).toFixed(1));

      if (isFolder && folderId) {
        const folder = activeFolders.get(folderId);
        const fItem = folder?.files.get(fileId);
        if (fItem) {
          fItem.progress = progress;
          updateFolderProgress(folderId);
        }
      } else {
        updateFileCardProgress(
          fileId,
          file.name,
          file.size,
          progress,
          speedMb,
          `${progress}%`,
          myUsername
        );
      }

      await new Promise((r) => setTimeout(r, 1));
    }

    broadcastTransferMessage({
      file_id: fileId,
      folder_id: folderId,
      sender_peer_id: myPeerId,
      type: 'file_complete',
    });

    if (saveToCloud) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_id', fileId);
        if (folderId) formData.append('folder_id', folderId);
        if (folderName) formData.append('folder_name', folderName);
        if (relativePath) formData.append('relative_path', relativePath);
        if (roomMaxDownloads) formData.append('max_downloads', String(roomMaxDownloads));
        formData.append('sender_username', myUsername);
        formData.append('sender_avatar', myAvatarUrl);

        const res = await fetch(`/api/rooms/${encodeURIComponent(resolvedRoomId)}/files/upload`, {
          body: formData,
          method: 'POST',
        });
        const json = await res.json().catch(() => ({}));
        if (json && json.ok && json.file) {
          renderCloudFileCard(json.file);
          toast.success(i18n.t('room.cloud_saved_success'));
        } else {
          const cardEl = activeTransfersDom.get(fileId);
          if (cardEl) {
            const actionsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-actions"]');
            if (actionsEl) {
              actionsEl.innerHTML = `
                <span class="component-badge component-badge--destructive" data-ref="badge-upload-error">
                  ${i18n.t('room.transfer_cancelled')}
                </span>
              `;
            }
          }
          toast.error(json?.error || i18n.t('common.error'));
        }
      } catch {
        const cardEl = activeTransfersDom.get(fileId);
        if (cardEl) {
          const actionsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-actions"]');
          if (actionsEl) {
            actionsEl.innerHTML = `
              <span class="component-badge component-badge--destructive" data-ref="badge-upload-error">
                ${i18n.t('room.transfer_cancelled')}
              </span>
            `;
          }
        }
        toast.error(i18n.t('common.error'));
      }
    } else {
      if (isFolder && folderId) {
        const folder = activeFolders.get(folderId);
        const fItem = folder?.files.get(fileId);
        if (fItem) {
          fItem.progress = 100;
          updateFolderProgress(folderId);
        }
      } else {
        updateFileCardProgress(
          fileId,
          file.name,
          file.size,
          100,
          0,
          i18n.t('room.transfer_completed'),
          myUsername
        );
      }
    }
  };

  const handleFilesSelected = async (fileList: FileList | File[]): Promise<void> => {
    if (!canUpload) {
      toast.error(i18n.t('room.no_upload_permission'));
      return;
    }
    const files = Array.from(fileList);
    if (files.length === 0) return;

    for (const file of files) {
      if (isCleanedUp) break;
      await sendFile(file);
    }
  };

  btnSelectFiles?.addEventListener('click', () => {
    inputFiles?.click();
  });

  btnSelectFolder?.addEventListener('click', () => {
    inputFolder?.click();
  });

  inputFiles?.addEventListener('change', () => {
    if (inputFiles.files && inputFiles.files.length > 0) {
      void handleFilesSelected(inputFiles.files);
      inputFiles.value = '';
    }
  });

  inputFolder?.addEventListener('change', () => {
    if (inputFolder.files && inputFolder.files.length > 0) {
      void handleFilesSelected(inputFolder.files);
      inputFolder.value = '';
    }
  });

  dropzoneArea?.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    dropzoneArea.classList.add('is-dragover');
  });

  dropzoneArea?.addEventListener('dragleave', (e: DragEvent) => {
    e.preventDefault();
    dropzoneArea.classList.remove('is-dragover');
  });

  dropzoneArea?.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault();
    dropzoneArea.classList.remove('is-dragover');
    if (e.dataTransfer) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        void handleFilesSelected(files);
      }
    }
  });

  roomBottomEl?.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
  });

  roomBottomEl?.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        void handleFilesSelected(files);
      }
    }
  });

  const openParticipantModerationModal = (p: RoomParticipant) => {
    const avatarSrc = (p.avatar_url && p.avatar_url.trim() !== '')
      ? p.avatar_url
      : getUserAvatarUrl({ username: p.username }, 80);

    const modalInstance = openModal({
      bodyHtml: `
        <div class="component-card component-card--flat" data-ref="participant-moderation-card">
          <div class="component-group" style="gap: 12px;">
            <div class="component-item" data-ref="item-participant-info">
              <div class="component-avatar" data-ref="modal-participant-avatar">
                <img class="component-avatar__img" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(p.username)}" />
              </div>
              <div class="component-item__text">
                <p class="component-item__title">${escapeHtml(p.username)}</p>
                <p class="component-item__desc">${p.can_upload ? i18n.t('room.badge_uploader') : i18n.t('room.badge_read_only')}</p>
              </div>
            </div>
            <div class="component-item" data-ref="item-toggle-permission">
              <div class="component-item__text">
                <p class="component-item__title">${p.can_upload ? i18n.t('room.revoke_upload_perm') : i18n.t('room.grant_upload_perm')}</p>
              </div>
              <div class="component-item__actions">
                <button type="button" class="component-button component-button--h34" data-ref="btn-toggle-perm">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${p.can_upload ? 'block' : 'check'}"></use></svg>
                  <span>${p.can_upload ? i18n.t('room.revoke_upload_perm') : i18n.t('room.grant_upload_perm')}</span>
                </button>
              </div>
            </div>
            <div class="component-item" data-ref="item-kick-user">
              <div class="component-item__text">
                <p class="component-item__title">${i18n.t('room.kick_user')}</p>
              </div>
              <div class="component-item__actions">
                <button type="button" class="component-button component-button--h34 component-button--destructive" data-ref="btn-kick-user">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
                  <span>${i18n.t('room.kick_user')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
      cancelText: i18n.t('common.close'),
      description: p.username,
      showCancel: true,
      showConfirm: false,
      size: 'sm',
      title: i18n.t('room.avatar_menu_title'),
    });

    const modalEl = modalInstance.backdrop;
    renderIcons(modalEl);

    const btnTogglePerm = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-perm"]');
    const btnKick = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-kick-user"]');

    btnTogglePerm?.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          can_upload: !p.can_upload,
          target_peer_id: p.peer_id,
          type: 'update_peer_permission',
        }));
        toast.success(p.can_upload ? i18n.t('room.perm_revoked_toast') : i18n.t('room.perm_granted_toast'));
      }
      modalInstance.close();
    });

    btnKick?.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          target_peer_id: p.peer_id,
          type: 'kick_peer',
        }));
      }
      modalInstance.close();
    });
  };

  const renderParticipants = (participants: RoomParticipant[]) => {
    if (isOwner) {
      participants.forEach((p) => {
        if (p.peer_id !== myPeerId && !peers.has(p.peer_id)) {
          void initiatePeerConnection(p.peer_id);
        }
      });
    }

    if (!avatarGroupEl) return;

    avatarGroupEl.innerHTML = participants.map((p) => {
      const isSelf = p.peer_id === myPeerId;
      const roleText = p.is_owner
        ? ` (${i18n.t('room.host_badge')})`
        : (p.can_upload ? ` (${i18n.t('room.badge_uploader')})` : ` (${i18n.t('room.badge_read_only')})`);
      const tooltipText = `${p.username}${roleText}${isSelf ? ` - ${i18n.t('room.you_indicator')}` : ''}`;

      const avatarSrc = (p.avatar_url && p.avatar_url.trim() !== '')
        ? p.avatar_url
        : getUserAvatarUrl({ username: p.username }, 80);

      return `
        <div class="component-avatar" data-ref="avatar-${escapeHtml(p.peer_id)}" data-tooltip="${escapeHtml(tooltipText)}" data-tooltip-placement="bottom" aria-label="${escapeHtml(tooltipText)}">
          <img class="component-avatar__img" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(p.username)}" referrerpolicy="no-referrer" />
        </div>
      `;
    }).join('');

    if (isOwner) {
      participants.forEach((p) => {
        if (!p.is_owner && p.peer_id !== myPeerId) {
          const avEl = avatarGroupEl.querySelector<HTMLElement>(`[data-ref="avatar-${escapeHtml(p.peer_id)}"]`);
          if (avEl) {
            avEl.style.cursor = 'pointer';
            avEl.addEventListener('click', () => {
              openParticipantModerationModal(p);
            });
          }
        }
      });
    }
  };

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    window.removeEventListener('beforeunload', cleanup);
    sessionStorage.removeItem(`room_owner_${roomId}`);

    peers.forEach((peer) => {
      try {
        if (peer.dataChannel) peer.dataChannel.close();
        peer.pc.close();
      } catch {}
    });
    peers.clear();

    activeDownloads.forEach((item) => {
      if (item.downloadUrl) {
        URL.revokeObjectURL(item.downloadUrl);
      }
    });
    activeDownloads.clear();

    activeFolders.forEach((folder) => {
      folder.files.forEach((fileItem) => {
        if (fileItem.downloadUrl) {
          URL.revokeObjectURL(fileItem.downloadUrl);
        }
      });
    });
    activeFolders.clear();

    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
      ws = null;
    }
  };

  window.addEventListener('beforeunload', cleanup);

  const showPasswordPrompt = () => {
    isAuthPending = true;
    const modalInstance = openModal({
      bodyHtml: `
        <div class="component-card component-card--flat" data-ref="password-prompt-card">
          <div class="component-item component-item--stacked" data-ref="item-prompt-password">
            <div class="component-item__text">
              <label class="component-item__title" for="field-prompt-password-input">${i18n.t('room.password_label')}</label>
            </div>
            <input
              type="password"
              id="field-prompt-password-input"
              class="field__input--simple"
              style="width: 100%; height: 38px; font-size: 13.5px;"
              data-ref="input-prompt-password"
              placeholder="${i18n.t('room.password_placeholder')}"
              autocomplete="current-password"
              maxlength="50"
            />
          </div>
        </div>
      `,
      cancelText: i18n.t('common.cancel'),
      confirmText: i18n.t('room.password_enter'),
      description: i18n.t('room.password_required_desc'),
      onCancel: () => {
        isAuthPending = false;
        cleanup();
        navigate?.('/');
      },
      onConfirm: () => {
        const input = modalInstance.backdrop.querySelector<HTMLInputElement>('[data-ref="input-prompt-password"]');
        const val = input?.value.trim() || '';
        if (!val) {
          input?.focus();
          return false;
        }
        sessionStorage.setItem(`room_password_${resolvedRoomId}`, val);
        if (currentSlug) {
          sessionStorage.setItem(`room_password_${currentSlug}`, val);
        }
        isAuthPending = false;
        initWebSocket();
        return true;
      },
      showCancel: true,
      showConfirm: true,
      size: 'sm',
      title: i18n.t('room.password_required_title'),
    });
  };

  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const savedPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                          (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) ||
                          '';
    const ownerToken = sessionStorage.getItem(`room_owner_token_${resolvedRoomId}`) ||
                       (currentSlug ? sessionStorage.getItem(`room_owner_token_${currentSlug}`) : null) ||
                       '';

    const wsUrl = `${protocol}//${host}/ws/room/${encodeURIComponent(resolvedRoomId)}?peer_id=${encodeURIComponent(myPeerId)}&username=${encodeURIComponent(myUsername)}&avatar_url=${encodeURIComponent(myAvatarUrl)}&is_owner=${isOwner}&owner_token=${encodeURIComponent(ownerToken)}&password=${encodeURIComponent(savedPassword)}`;

    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data);

        if (data.type === 'auth_error' || data.type === 'password_required') {
          isAuthPending = true;
          sessionStorage.removeItem(`room_password_${resolvedRoomId}`);
          if (currentSlug) {
            sessionStorage.removeItem(`room_password_${currentSlug}`);
          }
          if (data.type === 'auth_error') {
            toast.error(i18n.t('room.password_invalid'));
          }
          showPasswordPrompt();
          return;
        }

        if (data.type === 'room_state') {
          isAuthPending = false;
          if (data.slug) {
            currentSlug = data.slug;
          }
          if (data.is_persistent !== undefined) {
            isPersistentRoom = Boolean(data.is_persistent);
          }
          if (data.requires_password !== undefined) {
            hasPassword = Boolean(data.requires_password);
          }
          if (data.upload_permission) {
            roomUploadPermission = data.upload_permission;
          }
          if (data.code && shareCodeDisplayEl) {
            currentCode = data.code;
            shareCodeDisplayEl.textContent = currentSlug ? `/r/${currentSlug}` : data.code;
          }
          if (Array.isArray(data.participants)) {
            const myP = data.participants.find((p) => p.peer_id === myPeerId);
            if (myP) {
              canUpload = isOwner || Boolean(myP.can_upload);
            } else if (isOwner) {
              canUpload = true;
            } else {
              canUpload = roomUploadPermission === 'all';
            }
            updateUploadUiState();
            renderParticipants(data.participants);
          }
        } else if (data.type === 'peer_kicked') {
          if (data.target_peer_id === myPeerId) {
            toast.error(i18n.t('room.user_kicked_notice'));
            cleanup();
            navigate?.('/');
          }
        } else if (data.type === 'webrtc_offer') {
          if (data.target_peer_id === myPeerId && data.sender_peer_id && data.sdp) {
            void handleRemoteOffer(data.sender_peer_id, data.sdp);
          }
        } else if (data.type === 'webrtc_answer') {
          if (data.target_peer_id === myPeerId && data.sender_peer_id && data.sdp) {
            void handleRemoteAnswer(data.sender_peer_id, data.sdp);
          }
        } else if (data.type === 'webrtc_ice') {
          if (data.target_peer_id === myPeerId && data.sender_peer_id && data.candidate) {
            void handleRemoteIce(data.sender_peer_id, data.candidate);
          }
        } else if (data.type === 'file_start' || data.type === 'file_chunk' || data.type === 'file_complete') {
          handleIncomingMessage(event.data);
        } else if (data.type === 'cloud_file_added' && (data as any).file) {
          renderCloudFileCard((data as any).file);
        } else if (data.type === 'file_downloaded' && data.file_id) {
          const cardEl = activeTransfersDom.get(data.file_id);
          if (cardEl) {
            const downloadsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-downloads"]');
            const actionsEl = cardEl.querySelector<HTMLElement>('[data-ref="file-actions"]');
            if (downloadsEl && (data as any).max_downloads !== null && (data as any).max_downloads !== undefined) {
              downloadsEl.textContent = ` • ${(data as any).download_count}/${(data as any).max_downloads}`;
            }
            if ((data as any).is_limit_reached && actionsEl) {
              actionsEl.innerHTML = `
                <span class="component-badge component-badge--destructive" data-ref="badge-limit-reached">
                  ${i18n.t('room.download_limit_reached')}
                </span>
              `;
            }
          }
        } else if (data.type === 'room_closed') {
          if (data.reason && data.reason.includes('expired')) {
            toast.error(i18n.t('room.room_expired_desc'));
          } else {
            toast.info(i18n.t('room.closed_notice'));
          }
          cleanup();
          navigate?.('/');
        }
      } catch {}
    };

    ws.onerror = () => {
      if (!isAuthPending) {
        toast.error(i18n.t('room.connection_error'));
      }
    };

    ws.onclose = () => {
      if (isAuthPending) {
        return;
      }
      if (!isCleanedUp) {
        cleanup();
      }
    };
  };

  const initialPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                          (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) ||
                          '';

  if (hasPassword && !isOwner && !initialPassword) {
    showPasswordPrompt();
  } else {
    initWebSocket();
  }

  void loadCloudFiles();

  return fragment;
}

export {
  createRoomView
};
