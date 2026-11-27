import { arrayBufferToBase64, base64ToUint8Array, formatBytes, getFileIcon } from '../utils/format.util.js';
import { copyToClipboard, escapeHtml, setButtonLoading, setupDropdown } from '../utils/dom.util.js';
import { currentUser, deleteApi, getApi, patchApi } from '../services/api.service.js';
import { getGuestPersona } from '../utils/guest-personas.util.js';
import { getUserAvatarUrl } from '../utils/avatar.util.js';
import { i18n } from '../i18n/i18n.service.js';
import { openConfirmModal, openCustomModal, openModal } from '../components/modal.component.js';
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
  expires_at?: number | null;
  file?: any;
  file_id?: string;
  folder_id?: string;
  folder_name?: string;
  is_limit_reached?: boolean;
  is_persistent?: boolean;
  max_downloads?: number | null;
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
  slug?: string | null;
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

interface StandaloneFileItem {
  downloadCount?: number;
  downloadUrl?: string;
  fileId: string;
  isCloud?: boolean;
  isLimitReached?: boolean;
  maxDownloads?: number | null;
  mimeType?: string;
  name: string;
  progress: number;
  senderAvatar?: string;
  senderUsername: string;
  size: number;
  status: 'uploading' | 'downloading' | 'complete' | 'error';
}

interface FolderFileItem {
  downloadCount?: number;
  downloadUrl?: string;
  fileId: string;
  isCloud?: boolean;
  isLimitReached?: boolean;
  maxDownloads?: number | null;
  mimeType: string;
  name: string;
  progress: number;
  relativePath: string;
  size: number;
}

interface LocalPendingCloudFile {
  blob: Blob;
  fileId: string;
  folderId?: string;
  folderName?: string;
  mimeType: string;
  name: string;
  relativePath?: string;
  senderAvatar?: string;
  senderUsername: string;
  size: number;
}

interface FolderState {
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
      saveToCloud = meta.save_to_cloud !== undefined
        ? Boolean(meta.save_to_cloud)
        : (sessionStorage.getItem(`room_save_to_cloud_${resolvedRoomId}`) === 'true' ||
          (currentSlug ? sessionStorage.getItem(`room_save_to_cloud_${currentSlug}`) === 'true' : false));
      roomExpiresAt = meta.expires_at ?? null;
      roomMaxDownloads = meta.max_downloads ?? null;
      roomUploadPermission = meta.upload_permission ||
                            sessionStorage.getItem(`room_upload_permission_${resolvedRoomId}`) ||
                            (currentSlug ? sessionStorage.getItem(`room_upload_permission_${currentSlug}`) : null) ||
                            'all';

      if (saveToCloud) {
        sessionStorage.setItem(`room_save_to_cloud_${resolvedRoomId}`, 'true');
        if (currentSlug) {
          sessionStorage.setItem(`room_save_to_cloud_${currentSlug}`, 'true');
        }
      } else {
        sessionStorage.removeItem(`room_save_to_cloud_${resolvedRoomId}`);
        if (currentSlug) {
          sessionStorage.removeItem(`room_save_to_cloud_${currentSlug}`);
        }
      }

      sessionStorage.setItem(`room_upload_permission_${resolvedRoomId}`, roomUploadPermission);
      if (currentSlug) {
        sessionStorage.setItem(`room_upload_permission_${currentSlug}`, roomUploadPermission);
      }

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

  const peerStorageKey = `room_peer_id_${resolvedRoomId}`;
  let myPeerId = sessionStorage.getItem(peerStorageKey) || '';
  if (!myPeerId) {
    myPeerId = `peer_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    sessionStorage.setItem(peerStorageKey, myPeerId);
  }

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
  let hasLoadedCloudFiles = false;

  const peers = new Map<string, PeerState>();
  const activeDownloads = new Map<string, ActiveDownload>();
  const activeFolders = new Map<string, FolderState>();
  const standaloneFiles = new Map<string, StandaloneFileItem>();
  const localFileBlobs = new Map<string, LocalPendingCloudFile>();
  const cloudFileIds = new Set<string>();
  let currentFolderId: string | null = null;
  let currentParticipants: RoomParticipant[] = [];

  const topEl = document.createElement('div');
  topEl.className = 'component-top';
  topEl.setAttribute('data-ref', 'room-top');
  topEl.innerHTML = `
    <div class="component-top__left" data-ref="top-left">
      <button type="button" class="component-button component-button--icon-only component-button--h40" data-ref="btn-connection-mode" data-tooltip="${i18n.t('room.connecting_p2p')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.connecting_p2p')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
      </button>
      ${isOwner ? `
      <button type="button" class="component-button component-button--icon-only component-button--h40" data-ref="btn-room-settings" data-tooltip="${i18n.t('room.settings_tooltip')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.settings_tooltip')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#settings"></use></svg>
      </button>
      ` : ''}
      <button type="button" class="component-button component-button--icon-only component-button--h40 component-button--destructive" data-ref="btn-leave-room" data-tooltip="${isOwner ? i18n.t('room.close_room') : i18n.t('room.leave_room')}" data-tooltip-placement="bottom" aria-label="${isOwner ? i18n.t('room.close_room') : i18n.t('room.leave_room')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
      </button>
      <span class="component-badge component-badge--sm is-hidden" data-ref="room-selected-badge"></span>
    </div>

    <div class="component-top__right" data-ref="top-right">
      <div class="component-group component-group--actions is-hidden" data-ref="room-selection-actions">
        <button type="button" class="component-button component-button--h40 component-button--black component-button--icon-only" data-ref="btn-room-download-selected" data-tooltip="${i18n.t('room.download_selected')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_selected')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
        </button>
      </div>

      <div class="component-avatar-group" data-ref="participants-avatar-group"></div>

      <div class="component-dropdown" data-ref="add-more-wrapper">
        <button type="button" class="component-button component-button--icon-only component-button--h40 is-hidden" data-ref="btn-add-more" data-tooltip="${i18n.t('room.add_files')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.add_files')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
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
  bottomEl.className = 'component-bottom component-bottom--full';
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

    <div class="component-block__scrollable is-hidden" data-ref="room-table-container" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      <div class="component-top is-hidden" data-ref="folder-header-bar">
        <div class="component-top__left" data-ref="folder-header-left">
          <button type="button" class="component-button component-button--icon-only component-button--h40" data-ref="btn-back-to-root" data-tooltip="${i18n.t('room.back_to_root')}" aria-label="${i18n.t('room.back_to_root')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <div class="component-top__title-box" data-ref="folder-title-box">
            <span class="component-top__title-text" data-ref="folder-header-title"></span>
            <span class="component-badge component-badge--sm" data-ref="folder-header-desc"></span>
            <span class="component-badge component-badge--sm is-hidden" data-ref="folder-selected-badge"></span>
          </div>
        </div>
        <div class="component-top__right" data-ref="folder-header-actions">
          <div class="component-group component-group--actions is-hidden" data-ref="folder-selection-actions">
            <button type="button" class="component-button component-button--h40 component-button--black component-button--icon-only" data-ref="btn-folder-download-selected" data-tooltip="${i18n.t('room.download_selected')}" data-tooltip-placement="bottom" aria-label="${i18n.t('room.download_selected')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="component-table-wrapper component-table-wrapper--flush" data-ref="room-files-table-wrapper">
        <table class="component-table component-table--flush" data-ref="room-files-table">
          <thead class="component-table__head" data-ref="room-files-thead">
            <tr>
              <th data-ref="th-name">${i18n.t('room.col_name')}</th>
              <th data-ref="th-size">${i18n.t('room.col_size')}</th>
              <th data-ref="th-sender">${i18n.t('room.col_sender')}</th>
              <th data-ref="th-status">${i18n.t('room.col_status')}</th>
            </tr>
          </thead>
          <tbody class="component-table__body" data-ref="room-files-tbody">
          </tbody>
        </table>
      </div>
    </div>
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
  const btnRoomSettings = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-room-settings"]');
  const roomSelectedBadge = topEl.querySelector<HTMLElement>('[data-ref="room-selected-badge"]');
  const roomSelectionActions = topEl.querySelector<HTMLElement>('[data-ref="room-selection-actions"]');
  const btnRoomDownloadSelected = topEl.querySelector<HTMLButtonElement>('[data-ref="btn-room-download-selected"]');
  const addMoreWrapper = topEl.querySelector<HTMLElement>('[data-ref="add-more-wrapper"]');
  const shareWrapper = topEl.querySelector<HTMLElement>('[data-ref="share-wrapper"]');

  const roomBottomEl = bottomEl;
  const tableContainerEl = bottomEl.querySelector<HTMLElement>('[data-ref="room-table-container"]');
  const folderHeaderBar = bottomEl.querySelector<HTMLElement>('[data-ref="folder-header-bar"]');
  const folderHeaderTitle = bottomEl.querySelector<HTMLElement>('[data-ref="folder-header-title"]');
  const folderHeaderDesc = bottomEl.querySelector<HTMLElement>('[data-ref="folder-header-desc"]');
  const folderSelectedBadge = bottomEl.querySelector<HTMLElement>('[data-ref="folder-selected-badge"]');
  const folderSelectionActions = bottomEl.querySelector<HTMLElement>('[data-ref="folder-selection-actions"]');
  const btnFolderDownloadSelected = bottomEl.querySelector<HTMLButtonElement>('[data-ref="btn-folder-download-selected"]');
  const btnBackToRoot = bottomEl.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-root"]');
  const filesTbody = bottomEl.querySelector<HTMLElement>('[data-ref="room-files-tbody"]');
  const dropzoneArea = bottomEl.querySelector<HTMLElement>('[data-ref="dropzone-area"]');
  const inputFiles = bottomEl.querySelector<HTMLInputElement>('[data-ref="input-files"]');
  const inputFolder = bottomEl.querySelector<HTMLInputElement>('[data-ref="input-folder"]');
  const btnSelectFiles = bottomEl.querySelector<HTMLButtonElement>('[data-ref="btn-select-files"]');
  const btnSelectFolder = bottomEl.querySelector<HTMLButtonElement>('[data-ref="btn-select-folder"]');

  const selectedItemIds = new Set<string>();

  const updateSelectionUI = (): void => {
    const count = selectedItemIds.size;
    const countText = count === 1
      ? i18n.t('room.selected_count', { count: 1 })
      : i18n.t('room.selected_count_plural', { count });

    if (currentFolderId) {
      if (count > 0) {
        if (folderSelectedBadge) {
          folderSelectedBadge.textContent = countText;
          folderSelectedBadge.classList.remove('is-hidden');
        }
        folderSelectionActions?.classList.remove('is-hidden');
      } else {
        folderSelectedBadge?.classList.add('is-hidden');
        folderSelectionActions?.classList.add('is-hidden');
      }
      roomSelectedBadge?.classList.add('is-hidden');
      roomSelectionActions?.classList.add('is-hidden');
    } else {
      if (count > 0) {
        if (roomSelectedBadge) {
          roomSelectedBadge.textContent = countText;
          roomSelectedBadge.classList.remove('is-hidden');
        }
        roomSelectionActions?.classList.remove('is-hidden');
        addMoreWrapper?.classList.add('is-hidden');
        shareWrapper?.classList.add('is-hidden');
      } else {
        roomSelectedBadge?.classList.add('is-hidden');
        roomSelectionActions?.classList.add('is-hidden');
        addMoreWrapper?.classList.remove('is-hidden');
        shareWrapper?.classList.remove('is-hidden');
      }
      folderSelectedBadge?.classList.add('is-hidden');
      folderSelectionActions?.classList.add('is-hidden');
    }
  };

  const downloadSelectedFiles = (): void => {
    if (selectedItemIds.size === 0) return;
    const filesToDownload: { downloadUrl: string; name: string }[] = [];

    if (currentFolderId) {
      const folder = activeFolders.get(currentFolderId);
      if (folder) {
        selectedItemIds.forEach((fileId) => {
          const item = folder.files.get(fileId);
          if (item && item.downloadUrl && !item.isLimitReached) {
            filesToDownload.push({ downloadUrl: item.downloadUrl, name: item.name });
          }
        });
      }
    } else {
      selectedItemIds.forEach((fileId) => {
        const item = standaloneFiles.get(fileId);
        if (item && item.downloadUrl && !item.isLimitReached) {
          filesToDownload.push({ downloadUrl: item.downloadUrl, name: item.name });
        }
      });
    }

    if (filesToDownload.length === 0) {
      toast.info(i18n.t('room.files_not_ready_to_download'));
      return;
    }

    let delay = 0;
    filesToDownload.forEach((file) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = file.downloadUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, delay);
      delay += 200;
    });
  };

  btnRoomDownloadSelected?.addEventListener('click', downloadSelectedFiles);
  btnFolderDownloadSelected?.addEventListener('click', downloadSelectedFiles);

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && selectedItemIds.size > 0) {
      selectedItemIds.clear();
      updateSelectionUI();
      renderTableRows();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  btnBackToRoot?.addEventListener('click', () => {
    currentFolderId = null;
    selectedItemIds.clear();
    updateSelectionUI();
    renderTableRows();
  });

  const checkDropzoneVisibility = () => {
    const hasItems = standaloneFiles.size > 0 || activeFolders.size > 0;
    if (hasItems) {
      dropzoneArea?.classList.add('is-hidden');
      tableContainerEl?.classList.remove('is-hidden');
      if (canUpload) {
        btnAddMore?.classList.remove('is-hidden');
      } else {
        btnAddMore?.classList.add('is-hidden');
      }
    } else {
      dropzoneArea?.classList.remove('is-hidden');
      tableContainerEl?.classList.add('is-hidden');
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

  const getFilesFromDirectoryHandle = async (dirHandle: any, parentPath = ''): Promise<File[]> => {
    const collected: File[] = [];
    for await (const entry of dirHandle.values()) {
      const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        const f = await entry.getFile();
        Object.defineProperty(f, 'webkitRelativePath', {
          configurable: true,
          value: `${dirHandle.name}/${relativePath}`,
        });
        collected.push(f);
      } else if (entry.kind === 'directory') {
        const sub = await getFilesFromDirectoryHandle(entry, relativePath);
        collected.push(...sub);
      }
    }
    return collected;
  };

  const promptConfirmFolderUpload = (folderName: string, files: File[]): void => {
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    openConfirmModal({
      cancelText: i18n.t('common.cancel'),
      confirmText: i18n.t('room.folder_upload_confirm_btn'),
      description: i18n.t('room.folder_upload_confirm_desc', {
        count: files.length,
        folder: folderName,
        size: formatBytes(totalBytes),
      }),
      onConfirm: () => {
        void handleFilesSelected(files);
      },
      title: i18n.t('room.folder_upload_confirm_title'),
    });
  };

  const selectFolderWithPicker = async (): Promise<void> => {
    if (!canUpload) {
      toast.error(i18n.t('room.no_upload_permission'));
      return;
    }

    if (typeof (window as any).showDirectoryPicker === 'function') {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (!dirHandle) return;
        const files = await getFilesFromDirectoryHandle(dirHandle);
        if (files.length === 0) {
          toast.info(i18n.t('room.folder_empty'));
          return;
        }
        promptConfirmFolderUpload(dirHandle.name, files);
        return;
      } catch (err: any) {
        if (err && err.name === 'AbortError') {
          return;
        }
      }
    }

    inputFolder?.click();
  };

  btnAddFolderItem?.addEventListener('click', () => {
    addMoreDropdown?.classList.remove('is-open');
    void selectFolderWithPicker();
  });

  const handleDocumentClick = (e: MouseEvent) => {
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
  };
  document.addEventListener('click', handleDocumentClick);

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

  const clearRoomSession = () => {
    sessionStorage.removeItem(`room_owner_${roomId}`);
    sessionStorage.removeItem(`room_owner_${resolvedRoomId}`);
    sessionStorage.removeItem(`room_owner_token_${resolvedRoomId}`);
    sessionStorage.removeItem(peerStorageKey);
    if (currentSlug) {
      sessionStorage.removeItem(`room_owner_${currentSlug}`);
      sessionStorage.removeItem(`room_owner_token_${currentSlug}`);
    }
  };

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
          clearRoomSession();
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
          clearRoomSession();
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
          clearRoomSession();
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

  const openRoomSettingsModal = () => {
    const isPro = Boolean(currentUser && (currentUser.subscription_tier === 'pro' || currentUser.subscription_tier === 'business' || currentUser.subscription_tier === 'enterprise'));

    let initialExpVal = '0';
    if (roomExpiresAt) {
      const nowSec = Math.floor(Date.now() / 1000);
      const diffHours = Math.round((roomExpiresAt - nowSec) / 3600);
      if (diffHours <= 2) {
        initialExpVal = '1';
      } else if (diffHours <= 36) {
        initialExpVal = '24';
      } else if (diffHours <= 200) {
        initialExpVal = '168';
      } else {
        initialExpVal = '720';
      }
    }

    let initialLimitMode = '0';
    let hasLegacyCustomLimit = false;
    if (roomMaxDownloads !== null && roomMaxDownloads !== undefined && roomMaxDownloads > 0) {
      if (roomMaxDownloads === 1 || roomMaxDownloads === 5 || roomMaxDownloads === 10) {
        initialLimitMode = String(roomMaxDownloads);
      } else {
        hasLegacyCustomLimit = true;
        initialLimitMode = String(roomMaxDownloads);
      }
    }

    let selectedUploadPerm = roomUploadPermission || 'all';
    let selectedExpiration = initialExpVal;
    let expirationModified = false;
    let downloadLimitMode = initialLimitMode;
    let downloadLimitModified = false;

    const modalInstance = openCustomModal({
      contentHtml: `
        <div class="modal-container" data-ref="modal-container">
          <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="${i18n.t('common.close')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
          <div class="modal-card modal-card--split-config" data-ref="modal-card">
            <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
              <div class="modal-card__drag-handle"></div>
            </div>

            <div class="component-sidebar" data-ref="modal-sidebar">
              <div class="component-sidebar__top">
                <div class="component-header">
                  <h2 class="component-title" style="font-size: 18px; font-weight: 600; line-height: 1.3;">${i18n.t('room.settings_modal_title')}</h2>
                  <p class="component-subtitle" style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.4;">${i18n.t('room.settings_modal_desc')}</p>
                </div>
                <div class="component-menu component-menu--padded" data-ref="modal-categories-menu">
                  <button type="button" class="component-menu__item is-active" data-ref="tab-general" data-tab="general">
                    <span class="component-menu__item-icon">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
                    </span>
                    <span class="component-menu__item-text">${i18n.t('room.cat_general')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-ref="tab-security" data-tab="security">
                    <span class="component-menu__item-icon">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
                    </span>
                    <span class="component-menu__item-text">${i18n.t('room.cat_security')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-ref="tab-storage" data-tab="storage">
                    <span class="component-menu__item-icon">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
                    </span>
                    <span class="component-menu__item-text">${i18n.t('room.cat_storage')}</span>
                  </button>
                  <button type="button" class="component-menu__item" data-ref="tab-limits" data-tab="limits">
                    <span class="component-menu__item-icon">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#speed"></use></svg>
                    </span>
                    <span class="component-menu__item-text">${i18n.t('room.cat_limits')}</span>
                  </button>
                </div>
              </div>
              <div class="component-sidebar__bottom">
                <button type="button" class="component-button component-button--black" style="width: 100%; height: 38px; font-weight: 500;" data-ref="btn-confirm-save-settings">
                  ${i18n.t('room.btn_save_settings')}
                </button>
                <button type="button" class="component-button component-button--outline" style="width: 100%; height: 38px; font-weight: 500;" data-ref="btn-cancel-settings">
                  ${i18n.t('common.cancel')}
                </button>
              </div>
            </div>

            <div class="component-container--content" data-ref="modal-panes-container">
              <div class="component-pane" data-ref="pane-general" data-pane="general">
                <div class="component-header">
                  <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_general')}</h3>
                  <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_general_desc')}</p>
                </div>
                <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="component-item" data-ref="item-room-code-info">
                    <div class="component-item__text">
                      <p class="component-item__title">${i18n.t('room.current_code_label')}</p>
                      <p class="component-item__desc">${i18n.t('room.cant_modify_code')}</p>
                    </div>
                    <div class="component-item__actions">
                      <span class="component-dropdown-menu__code-pill" style="user-select: text;" data-ref="badge-static-code">${escapeHtml(currentCode)}</span>
                    </div>
                  </div>

                  <hr class="component-divider" />

                  <div class="component-item" data-ref="item-custom-slug-toggle">
                    <div class="component-item__text">
                      <p class="component-item__title">
                        ${i18n.t('room.slug_toggle_title')}
                        ${!isPro ? `<span class="component-badge component-badge--sm" style="margin-left: 6px;">${i18n.t('room.pro_badge')}</span>` : ''}
                      </p>
                      <p class="component-item__desc">${i18n.t('room.slug_toggle_desc')}</p>
                    </div>
                    <div class="component-item__actions">
                      <label class="component-switch" data-ref="switch-custom-slug-label">
                        <input type="checkbox" data-ref="switch-custom-slug" ${currentSlug ? 'checked' : ''} ${!isPro ? 'disabled' : ''} />
                        <span class="component-switch__slider"></span>
                      </label>
                    </div>
                  </div>

                  <hr class="component-divider ${!currentSlug ? 'is-hidden' : ''}" data-ref="divider-custom-slug" />

                  <div class="component-item component-item--stacked ${!currentSlug ? 'is-hidden' : ''}" data-ref="item-custom-slug">
                    <div class="component-item__text">
                      <label class="component-item__title" for="field-settings-custom-slug">${i18n.t('room.slug_label')}</label>
                      <p class="component-item__desc">${i18n.t('room.slug_desc')}</p>
                    </div>
                    <input
                      type="text"
                      id="field-settings-custom-slug"
                      class="field__input--simple"
                      style="width: 100%; height: 38px; font-size: 13.5px;"
                      data-ref="input-custom-slug"
                      value="${escapeHtml(currentSlug || '')}"
                      placeholder="${!isPro ? i18n.t('room.pro_feature_notice') : i18n.t('room.slug_placeholder')}"
                      autocomplete="off"
                      spellcheck="false"
                      maxlength="40"
                      ${!isPro ? 'disabled' : ''}
                    />
                  </div>

                  <hr class="component-divider" />

                  <div class="component-item" data-ref="item-persistent-room">
                    <div class="component-item__text">
                      <p class="component-item__title">
                        ${i18n.t('room.persistent_title')}
                        ${!isPro ? `<span class="component-badge component-badge--sm" style="margin-left: 6px;">${i18n.t('room.pro_badge')}</span>` : ''}
                      </p>
                      <p class="component-item__desc">${i18n.t('room.persistent_desc')}</p>
                    </div>
                    <div class="component-item__actions">
                      <label class="component-switch" data-ref="switch-persistent-label">
                        <input type="checkbox" data-ref="switch-persistent" ${isPersistentRoom || saveToCloud ? 'checked' : ''} ${!isPro || saveToCloud ? 'disabled' : ''} />
                        <span class="component-switch__slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div class="component-pane is-hidden" data-ref="pane-security" data-pane="security">
                <div class="component-header">
                  <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_security')}</h3>
                  <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_security_desc')}</p>
                </div>
                <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="component-item" data-ref="item-password-protect">
                    <div class="component-item__text">
                      <p class="component-item__title">${i18n.t('room.password_protect_title')}</p>
                      <p class="component-item__desc">${i18n.t('room.password_protect_desc')}</p>
                    </div>
                    <div class="component-item__actions">
                      <label class="component-switch" data-ref="switch-password-label">
                        <input type="checkbox" data-ref="switch-password" ${hasPassword ? 'checked' : ''} />
                        <span class="component-switch__slider"></span>
                      </label>
                    </div>
                  </div>

                  <hr class="component-divider ${!hasPassword ? 'is-hidden' : ''}" data-ref="divider-room-password" />

                  <div class="component-item component-item--stacked ${!hasPassword ? 'is-hidden' : ''}" data-ref="item-room-password">
                    <div class="component-item__text">
                      <label class="component-item__title" for="field-settings-room-password">${i18n.t('room.password_label')}</label>
                    </div>
                    <input
                      type="password"
                      id="field-settings-room-password"
                      class="field__input--simple"
                      style="width: 100%; height: 38px; font-size: 13.5px;"
                      data-ref="input-room-password"
                      placeholder="${hasPassword ? i18n.t('room.password_action_keep') : i18n.t('room.password_placeholder')}"
                      autocomplete="new-password"
                      maxlength="50"
                    />
                  </div>

                  <hr class="component-divider" />

                  <div class="component-item component-item--stacked" data-ref="item-upload-permissions">
                    <div class="component-item__text">
                      <h4 class="component-item__title">${i18n.t('room.upload_perm_title')}</h4>
                      <p class="component-item__desc">${i18n.t('room.upload_perm_desc')}</p>
                    </div>
                    <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-upload-perm">
                      <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-upload-perm" aria-label="${i18n.t('room.upload_perm_title')}">
                        <div class="component-dropdown__trigger-left dropdown-trigger__left">
                          <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#${selectedUploadPerm === 'owner_only' ? 'person' : (selectedUploadPerm === 'specific' ? 'key' : 'groups')}"></use></svg>
                          <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="upload-perm-selected-text">${selectedUploadPerm === 'owner_only' ? i18n.t('room.upload_perm_owner_only') : (selectedUploadPerm === 'specific' ? i18n.t('room.upload_perm_specific') : i18n.t('room.upload_perm_all'))}</span>
                        </div>
                        <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                      </button>
                      <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-upload-perm">
                        <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-upload-perm">
                          <div class="component-menu__list menu-panel__list">
                            <button type="button" class="component-menu__item menu-item ${selectedUploadPerm === 'all' ? 'is-active' : ''}" data-ref="option-perm-all" data-value="all">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.upload_perm_all')}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${selectedUploadPerm === 'owner_only' ? 'is-active' : ''}" data-ref="option-perm-owner" data-value="owner_only">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.upload_perm_owner_only')}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${selectedUploadPerm === 'specific' ? 'is-active' : ''}" data-ref="option-perm-specific" data-value="specific">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#key"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.upload_perm_specific')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="component-pane is-hidden" data-ref="pane-storage" data-pane="storage">
                <div class="component-header">
                  <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_storage')}</h3>
                  <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_storage_desc')}</p>
                </div>
                <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="component-item" data-ref="item-cloud-storage">
                    <div class="component-item__text">
                      <p class="component-item__title">
                        ${i18n.t('room.cloud_storage_title')}
                        ${!isPro ? `<span class="component-badge component-badge--sm" style="margin-left: 6px;">${i18n.t('room.pro_badge')}</span>` : ''}
                      </p>
                      <p class="component-item__desc">${i18n.t('room.cloud_storage_desc')}</p>
                    </div>
                    <div class="component-item__actions">
                      <label class="component-switch" data-ref="switch-cloud-label">
                        <input type="checkbox" data-ref="switch-cloud" ${saveToCloud ? 'checked' : ''} ${!isPro ? 'disabled' : ''} />
                        <span class="component-switch__slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="component-banner" data-ref="banner-cloud-info" style="margin-top: 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <svg class="component-icon" style="color: #3b82f6;" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
                    <span style="font-weight: 600; font-size: 13px;">${i18n.t('room.cloud_badge')}</span>
                  </div>
                  <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 0;">${i18n.t('room.cloud_offline_ready')}</p>
                </div>
              </div>

              <div class="component-pane is-hidden" data-ref="pane-limits" data-pane="limits">
                <div class="component-header">
                  <h3 class="component-title" style="font-size: 17px; font-weight: 600; line-height: 1.3;">${i18n.t('room.cat_limits')}</h3>
                  <p class="component-subtitle" style="font-size: 13px; color: var(--text-secondary);">${i18n.t('room.cat_limits_desc')}</p>
                </div>
                <div class="component-group" style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="component-item component-item--stacked" data-ref="item-expiration">
                    <div class="component-item__text">
                      <h4 class="component-item__title">${i18n.t('room.expiration_title')}</h4>
                      <p class="component-item__desc">${i18n.t('room.expiration_desc')}</p>
                    </div>
                    <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-expiration">
                      <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-expiration" aria-label="${i18n.t('room.expiration_title')}">
                        <div class="component-dropdown__trigger-left dropdown-trigger__left">
                          <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                          <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="exp-selected-text">
                            ${selectedExpiration === '1' ? i18n.t('room.expiration_1h') : (selectedExpiration === '24' ? i18n.t('room.expiration_24h') : (selectedExpiration === '168' ? i18n.t('room.expiration_7d') : (selectedExpiration === '720' ? i18n.t('room.expiration_30d') : i18n.t('room.expiration_never'))))}
                          </span>
                        </div>
                        <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                      </button>
                      <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-expiration">
                        <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-expiration">
                          <div class="component-menu__list menu-panel__list">
                            <button type="button" class="component-menu__item menu-item ${selectedExpiration === '1' ? 'is-active' : ''}" data-ref="option-exp-1" data-value="1">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_1h')}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${selectedExpiration === '24' ? 'is-active' : ''} ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-24" data-value="24" ${!isPro ? 'disabled' : ''}>
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_24h')}${!isPro ? ` (${i18n.t('room.pro_badge')})` : ''}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${selectedExpiration === '168' ? 'is-active' : ''} ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-168" data-value="168" ${!isPro ? 'disabled' : ''}>
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_7d')}${!isPro ? ` (${i18n.t('room.pro_badge')})` : ''}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${selectedExpiration === '720' ? 'is-active' : ''} ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-720" data-value="720" ${!isPro ? 'disabled' : ''}>
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_30d')}${!isPro ? ` (${i18n.t('room.pro_badge')})` : ''}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${selectedExpiration === '0' ? 'is-active' : ''} ${!isPro ? 'is-disabled' : ''}" data-ref="option-exp-0" data-value="0" ${!isPro ? 'disabled' : ''}>
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.expiration_never')}${!isPro ? ` (${i18n.t('room.pro_badge')})` : ''}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr class="component-divider" />

                  <div class="component-item component-item--stacked" data-ref="item-download-limit">
                    <div class="component-item__text">
                      <h4 class="component-item__title">${i18n.t('room.download_limit_title')}</h4>
                      <p class="component-item__desc">${i18n.t('room.download_limit_desc')}</p>
                    </div>
                    <div class="component-dropdown dropdown-wrapper" data-ref="dropdown-wrapper-download-limit">
                      <button type="button" class="component-dropdown__trigger dropdown-trigger" data-ref="btn-trigger-download-limit" aria-label="${i18n.t('room.download_limit_title')}">
                        <div class="component-dropdown__trigger-left dropdown-trigger__left">
                          <svg class="component-icon component-dropdown__trigger-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                          <span class="component-dropdown__trigger-text dropdown-trigger__text" data-ref="download-limit-selected-text">
                            ${downloadLimitMode === '1' ? i18n.t('room.download_limit_1') : (downloadLimitMode === '5' ? i18n.t('room.download_limit_5') : (downloadLimitMode === '10' ? i18n.t('room.download_limit_10') : (hasLegacyCustomLimit ? i18n.t('room.download_limit_legacy', { count: downloadLimitMode }) : i18n.t('room.download_limit_unlimited'))))}
                          </span>
                        </div>
                        <svg class="component-icon component-dropdown__trigger-chevron dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                      </button>
                      <div class="component-menu-backdrop dropdown-backdrop" data-ref="dropdown-backdrop-download-limit">
                        <div class="component-menu component-menu--dropdown component-menu--w-full component-menu--h-auto menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-download-limit">
                          <div class="component-menu__list menu-panel__list">
                            <button type="button" class="component-menu__item menu-item ${downloadLimitMode === '0' ? 'is-active' : ''}" data-ref="option-limit-0" data-value="0">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_unlimited')}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${downloadLimitMode === '1' ? 'is-active' : ''}" data-ref="option-limit-1" data-value="1">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_1')}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${downloadLimitMode === '5' ? 'is-active' : ''}" data-ref="option-limit-5" data-value="5">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_5')}</span>
                            </button>
                            <button type="button" class="component-menu__item menu-item ${downloadLimitMode === '10' ? 'is-active' : ''}" data-ref="option-limit-10" data-value="10">
                              <svg class="component-icon component-menu__item-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                              <span class="component-menu__item-text menu-item__text">${i18n.t('room.download_limit_10')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    const modalEl = modalInstance.backdrop;
    const tabBtns = modalEl.querySelectorAll<HTMLButtonElement>('[data-tab]');
    const panes = modalEl.querySelectorAll<HTMLElement>('[data-pane]');
    const btnCancelEl = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-settings"]');
    const btnConfirmEl = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-confirm-save-settings"]');

    tabBtns.forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const targetTab = tabBtn.getAttribute('data-tab');
        if (!targetTab) return;

        tabBtns.forEach((b) => b.classList.remove('is-active'));
        tabBtn.classList.add('is-active');

        panes.forEach((pane) => {
          if (pane.getAttribute('data-pane') === targetTab) {
            pane.classList.remove('is-hidden');
          } else {
            pane.classList.add('is-hidden');
          }
        });
      });
    });

    btnCancelEl?.addEventListener('click', () => {
      modalInstance.close();
    });

    const switchCustomSlugEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-custom-slug"]');
    const dividerCustomSlugEl = modalEl.querySelector<HTMLElement>('[data-ref="divider-custom-slug"]');
    const itemCustomSlugEl = modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug"]');
    const inputCustomSlugEl = modalEl.querySelector<HTMLInputElement>('[data-ref="input-custom-slug"]');
    const switchCloudEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-cloud"]');
    const switchPersistentEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-persistent"]');
    const switchPasswordEl = modalEl.querySelector<HTMLInputElement>('[data-ref="switch-password"]');
    const dividerPasswordEl = modalEl.querySelector<HTMLElement>('[data-ref="divider-room-password"]');
    const itemPasswordEl = modalEl.querySelector<HTMLElement>('[data-ref="item-room-password"]');
    const inputPasswordEl = modalEl.querySelector<HTMLInputElement>('[data-ref="input-room-password"]');

    const uploadPermWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-upload-perm"]');
    setupDropdown(uploadPermWrapper, {
      onSelect: (val) => {
        selectedUploadPerm = val;
        uploadPermWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
          item.classList.toggle('is-active', item.getAttribute('data-value') === val);
        });
        const triggerIcon = uploadPermWrapper?.querySelector<SVGUseElement>('.dropdown-trigger__icon use');
        if (triggerIcon) {
          triggerIcon.setAttribute('href', `/icons.svg#${val === 'owner_only' ? 'person' : (val === 'specific' ? 'key' : 'groups')}`);
        }
      },
    });

    const expirationWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-expiration"]');
    setupDropdown(expirationWrapper, {
      onSelect: (val) => {
        selectedExpiration = val;
        expirationModified = true;
        expirationWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
          item.classList.toggle('is-active', item.getAttribute('data-value') === val);
        });
      },
    });

    const downloadLimitWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-limit"]');
    setupDropdown(downloadLimitWrapper, {
      onSelect: (val) => {
        downloadLimitMode = val;
        downloadLimitModified = true;
        downloadLimitWrapper?.querySelectorAll('.component-menu__item, .menu-item').forEach((item) => {
          item.classList.toggle('is-active', item.getAttribute('data-value') === val);
        });
      },
    });

    if (!isPro) {
      modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug-toggle"]')?.addEventListener('click', () => {
        toast.info(i18n.t('room.pro_feature_notice'));
      });
      modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug"]')?.addEventListener('click', () => {
        toast.info(i18n.t('room.pro_feature_notice'));
      });
      modalEl.querySelector<HTMLElement>('[data-ref="item-persistent-room"]')?.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        toast.info(i18n.t('room.pro_feature_notice'));
      });
      modalEl.querySelector<HTMLElement>('[data-ref="item-cloud-storage"]')?.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        toast.info(i18n.t('room.pro_feature_notice'));
      });
    } else {
      modalEl.querySelector<HTMLElement>('[data-ref="item-custom-slug-toggle"]')?.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
        if (switchCustomSlugEl && !switchCustomSlugEl.disabled) {
          switchCustomSlugEl.checked = !switchCustomSlugEl.checked;
          switchCustomSlugEl.dispatchEvent(new Event('change'));
        }
      });
      modalEl.querySelector<HTMLElement>('[data-ref="item-persistent-room"]')?.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
        if (switchPersistentEl && !switchPersistentEl.disabled) {
          switchPersistentEl.checked = !switchPersistentEl.checked;
          switchPersistentEl.dispatchEvent(new Event('change'));
        }
      });
      modalEl.querySelector<HTMLElement>('[data-ref="item-cloud-storage"]')?.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
        if (switchCloudEl) {
          switchCloudEl.checked = !switchCloudEl.checked;
          switchCloudEl.dispatchEvent(new Event('change'));
        }
      });
    }

    switchCustomSlugEl?.addEventListener('change', () => {
      if (switchCustomSlugEl.checked) {
        dividerCustomSlugEl?.classList.remove('is-hidden');
        itemCustomSlugEl?.classList.remove('is-hidden');
        inputCustomSlugEl?.focus();
      } else {
        dividerCustomSlugEl?.classList.add('is-hidden');
        itemCustomSlugEl?.classList.add('is-hidden');
      }
    });

    modalEl.querySelector<HTMLElement>('[data-ref="item-password-protect"]')?.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.component-switch') || target.tagName === 'INPUT') return;
      if (switchPasswordEl) {
        switchPasswordEl.checked = !switchPasswordEl.checked;
        switchPasswordEl.dispatchEvent(new Event('change'));
      }
    });

    switchCloudEl?.addEventListener('change', () => {
      if (switchCloudEl.checked) {
        if (switchPersistentEl) {
          switchPersistentEl.checked = true;
          switchPersistentEl.disabled = true;
        }
      } else {
        if (switchPersistentEl && isPro) {
          switchPersistentEl.disabled = false;
        }
      }
    });

    switchPersistentEl?.addEventListener('change', () => {
      if (!switchPersistentEl.checked && switchCloudEl) {
        switchCloudEl.checked = false;
      }
    });

    switchPasswordEl?.addEventListener('change', () => {
      if (switchPasswordEl.checked) {
        dividerPasswordEl?.classList.remove('is-hidden');
        itemPasswordEl?.classList.remove('is-hidden');
        inputPasswordEl?.focus();
      } else {
        dividerPasswordEl?.classList.add('is-hidden');
        itemPasswordEl?.classList.add('is-hidden');
        if (inputPasswordEl) inputPasswordEl.value = '';
      }
    });

    btnConfirmEl?.addEventListener('click', async () => {
      const payload: Record<string, any> = {};

      if (switchCustomSlugEl) {
        if (switchCustomSlugEl.checked) {
          const val = inputCustomSlugEl?.value.trim().toLowerCase() || '';
          if (!val || val.length < 3 || val.length > 40 || !/^[a-z0-9-]+$/.test(val)) {
            toast.error(i18n.t('room.slug_invalid'));
            tabBtns[0]?.click();
            inputCustomSlugEl?.focus();
            return;
          }
          if (val !== (currentSlug || '')) {
            payload.custom_slug = val;
          }
        } else if (currentSlug) {
          payload.clear_slug = true;
        }
      }

      const targetSaveToCloud = Boolean(switchCloudEl?.checked);
      const targetIsPersistent = targetSaveToCloud ? true : Boolean(switchPersistentEl?.checked);

      if (switchCloudEl && targetSaveToCloud !== saveToCloud) {
        payload.save_to_cloud = targetSaveToCloud;
      }

      if (switchPersistentEl && targetIsPersistent !== isPersistentRoom) {
        payload.is_persistent = targetIsPersistent;
      }

      if (switchPasswordEl) {
        if (switchPasswordEl.checked) {
          const val = inputPasswordEl?.value.trim() || '';
          if (!hasPassword && val.length === 0) {
            toast.error(i18n.t('room.password_empty_error'));
            tabBtns[1]?.click();
            inputPasswordEl?.focus();
            return;
          }
          if (val.length > 0) {
            payload.password = val;
          }
        } else if (hasPassword) {
          payload.clear_password = true;
        }
      }

      if (selectedUploadPerm !== roomUploadPermission) {
        payload.upload_permission = selectedUploadPerm;
      }

      if (expirationModified) {
        if (selectedExpiration === '0') {
          payload.clear_expiration = true;
        } else if (selectedExpiration) {
          payload.expires_in_hours = Number(selectedExpiration);
        }
      }

      if (downloadLimitModified) {
        if (downloadLimitMode === '0') {
          payload.clear_max_downloads = true;
        } else if (downloadLimitMode) {
          payload.max_downloads = Number(downloadLimitMode);
        }
      }

      if (Object.keys(payload).length === 0) {
        toast.success(i18n.t('room.settings_saved'));
        modalInstance.close();
        return;
      }

      setButtonLoading(btnConfirmEl, true);

      try {
        const res = await patchApi<{ error?: string; ok: boolean; requires_pro?: boolean; room?: any }>(
          `/api/rooms/${encodeURIComponent(resolvedRoomId)}`,
          payload
        );

        if (res && res.ok && res.room) {
          const prevSlug = currentSlug;
          const wasSaveToCloud = saveToCloud;

          if (res.room.slug !== undefined) {
            currentSlug = res.room.slug || '';
          }
          if (res.room.is_persistent !== undefined) {
            isPersistentRoom = Boolean(res.room.is_persistent);
          }
          if (res.room.requires_password !== undefined) {
            hasPassword = Boolean(res.room.requires_password);
          }
          if (res.room.save_to_cloud !== undefined) {
            saveToCloud = Boolean(res.room.save_to_cloud);
          }
          if (res.room.upload_permission) {
            roomUploadPermission = res.room.upload_permission;
          }
          if (res.room.expires_at !== undefined) {
            roomExpiresAt = res.room.expires_at;
          }
          if (res.room.max_downloads !== undefined) {
            roomMaxDownloads = res.room.max_downloads;
          }

          if (prevSlug && prevSlug !== currentSlug) {
            sessionStorage.removeItem(`room_owner_${prevSlug}`);
            sessionStorage.removeItem(`room_owner_token_${prevSlug}`);
            sessionStorage.removeItem(`room_save_to_cloud_${prevSlug}`);
            sessionStorage.removeItem(`room_upload_permission_${prevSlug}`);
            sessionStorage.removeItem(`room_password_${prevSlug}`);
          }

          const existingOwnerToken = sessionStorage.getItem(`room_owner_token_${resolvedRoomId}`);
          sessionStorage.setItem(`room_owner_${resolvedRoomId}`, 'true');
          sessionStorage.setItem(`room_upload_permission_${resolvedRoomId}`, roomUploadPermission);
          if (saveToCloud) {
            sessionStorage.setItem(`room_save_to_cloud_${resolvedRoomId}`, 'true');
          } else {
            sessionStorage.removeItem(`room_save_to_cloud_${resolvedRoomId}`);
          }

          if (payload.clear_password) {
            sessionStorage.removeItem(`room_password_${resolvedRoomId}`);
          } else if (typeof payload.password === 'string' && payload.password.length > 0) {
            sessionStorage.setItem(`room_password_${resolvedRoomId}`, payload.password);
          }

          const effectivePassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`);
          if (currentSlug) {
            sessionStorage.setItem(`room_owner_${currentSlug}`, 'true');
            sessionStorage.setItem(`room_upload_permission_${currentSlug}`, roomUploadPermission);
            if (existingOwnerToken) {
              sessionStorage.setItem(`room_owner_token_${currentSlug}`, existingOwnerToken);
            }
            if (saveToCloud) {
              sessionStorage.setItem(`room_save_to_cloud_${currentSlug}`, 'true');
            } else {
              sessionStorage.removeItem(`room_save_to_cloud_${currentSlug}`);
            }
            if (effectivePassword) {
              sessionStorage.setItem(`room_password_${currentSlug}`, effectivePassword);
            }
          }

          if (prevSlug !== currentSlug) {
            const targetCleanPath = currentSlug ? `/room/${currentSlug}` : `/room/${resolvedRoomId}`;
            window.history.replaceState({}, '', i18n.localizePath(targetCleanPath));
          }

          if (shareCodeDisplayEl) {
            shareCodeDisplayEl.textContent = currentSlug ? `/r/${currentSlug}` : currentCode;
          }
          syncCloudFilesMaxDownloads();
          updateUploadUiState();
          window.dispatchEvent(new CustomEvent('boardstack:rooms-updated'));
          toast.success(i18n.t('room.settings_saved'));
          modalInstance.close();

          if (!wasSaveToCloud && saveToCloud) {
            const pendingFiles = Array.from(localFileBlobs.values()).filter((f) => !cloudFileIds.has(f.fileId));
            if (pendingFiles.length > 0) {
              const totalSize = pendingFiles.reduce((acc, f) => acc + f.size, 0);
              openConfirmModal({
                cancelText: i18n.t('room.cloud_sync_existing_skip'),
                confirmText: i18n.t('room.cloud_sync_existing_confirm'),
                description: i18n.t('room.cloud_sync_existing_desc', {
                  count: pendingFiles.length,
                  size: formatBytes(totalSize),
                }),
                onCancel: () => {
                  toast.info(i18n.t('room.cloud_sync_skipped'));
                },
                onConfirm: () => {
                  void uploadPendingFilesToCloud(pendingFiles);
                  return true;
                },
                title: i18n.t('room.cloud_sync_existing_title'),
              });
            }
          } else if (wasSaveToCloud && !saveToCloud && cloudFileIds.size > 0) {
            toast.info(i18n.t('room.cloud_disabled_existing_kept'));
          }
        } else {
          setButtonLoading(btnConfirmEl, false);
          if (res?.requires_pro) {
            toast.info(i18n.t('room.pro_feature_notice'));
          } else if (res?.error && res.error.includes('already in use')) {
            toast.error(i18n.t('room.slug_in_use'));
          } else {
            toast.error(res?.error || i18n.t('common.error'));
          }
        }
      } catch (err: any) {
        setButtonLoading(btnConfirmEl, false);
        toast.error(err?.message || i18n.t('common.error'));
      }
    });
  };

  btnRoomSettings?.addEventListener('click', openRoomSettingsModal);

  const renderTableRows = (): void => {
    checkDropzoneVisibility();
    if (!filesTbody) return;
    filesTbody.innerHTML = '';

    if (currentFolderId) {
      const folder = activeFolders.get(currentFolderId);
      if (!folder) {
        currentFolderId = null;
        renderTableRows();
        return;
      }

      folderHeaderBar?.classList.remove('is-hidden');
      let totalBytes = 0;
      folder.files.forEach((f) => {
        totalBytes += f.size;
      });

      if (folderHeaderTitle) {
        folderHeaderTitle.textContent = folder.name;
      }
      if (folderHeaderDesc) {
        folderHeaderDesc.textContent = `${i18n.t('room.files_count', { count: folder.files.size })} • ${formatBytes(totalBytes)} • ${folder.senderUsername}`;
      }

      folder.files.forEach((f) => {
        const isSelected = selectedItemIds.has(f.fileId);
        const row = document.createElement('tr');
        row.className = `component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}`;
        row.setAttribute('data-ref', `file-row-${f.fileId}`);

        const statusBadge = f.isLimitReached
          ? `<span class="component-badge component-badge--sm" data-ref="badge-limit-${f.fileId}">${i18n.t('room.download_limit_reached')}</span>`
          : (f.progress >= 100
            ? `<span class="component-badge component-badge--sm" data-ref="progress-badge-${f.fileId}">${i18n.t('room.status_ready')}</span>`
            : `<span class="component-badge component-badge--sm" data-ref="progress-badge-${f.fileId}">${f.progress}%</span>`);

        const downloadCountHtml = (f.maxDownloads !== undefined && f.maxDownloads !== null)
          ? `<span class="component-badge component-badge--sm" style="margin-right: 6px;" data-ref="downloads-count-${f.fileId}">${f.downloadCount || 0}/${f.maxDownloads}</span>`
          : '';

        row.innerHTML = `
          <td class="component-table__cell" data-ref="cell-name-${f.fileId}">
            <div class="component-table__cell-content">
              <div class="component-table__icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${getFileIcon(f.name)}"></use></svg>
              </div>
              <span class="component-badge component-badge--sm" title="${escapeHtml(f.relativePath || f.name)}">${escapeHtml(f.name)}</span>
            </div>
          </td>
          <td class="component-table__cell" data-ref="cell-size-${f.fileId}">
            <span class="component-badge component-badge--sm">${formatBytes(f.size)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-sender-${f.fileId}">
            <span class="component-badge component-badge--sm">${escapeHtml(folder.senderUsername)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-status-${f.fileId}">
            ${downloadCountHtml}
            ${statusBadge}
          </td>
        `;

        row.addEventListener('click', (e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            if (selectedItemIds.has(f.fileId)) {
              selectedItemIds.delete(f.fileId);
            } else {
              selectedItemIds.add(f.fileId);
            }
          } else {
            if (selectedItemIds.has(f.fileId) && selectedItemIds.size === 1) {
              selectedItemIds.clear();
            } else {
              selectedItemIds.clear();
              selectedItemIds.add(f.fileId);
            }
          }
          updateSelectionUI();
          renderTableRows();
        });

        renderIcons(row);
        filesTbody.appendChild(row);
      });
    } else {
      folderHeaderBar?.classList.add('is-hidden');

      activeFolders.forEach((folder) => {
        let folderBytes = 0;
        let allComplete = folder.files.size > 0;
        let transferredBytes = 0;
        folder.files.forEach((f) => {
          folderBytes += f.size;
          transferredBytes += Math.round((f.progress / 100) * f.size);
          if (f.progress < 100) allComplete = false;
        });

        const overallProgress = folderBytes > 0
          ? Math.min(100, Math.round((transferredBytes / folderBytes) * 100))
          : 100;

        const folderRow = document.createElement('tr');
        folderRow.className = 'component-table__row component-cursor-pointer';
        folderRow.setAttribute('data-ref', `folder-row-${folder.id}`);

        const statusBadge = allComplete
          ? `<span class="component-badge component-badge--sm" data-ref="folder-badge-${folder.id}">${i18n.t('room.status_ready')}</span>`
          : `<span class="component-badge component-badge--sm" data-ref="folder-badge-${folder.id}">${overallProgress}%</span>`;

        folderRow.innerHTML = `
          <td class="component-table__cell" data-ref="cell-name-${folder.id}">
            <div class="component-table__cell-content">
              <div class="component-table__icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="component-badge component-badge--sm" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
                <span class="component-badge component-badge--sm">${i18n.t('room.folder')}</span>
              </div>
            </div>
          </td>
          <td class="component-table__cell" data-ref="cell-size-${folder.id}">
            <span class="component-badge component-badge--sm" data-ref="folder-size-${folder.id}">${formatBytes(folderBytes)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-sender-${folder.id}">
            <span class="component-badge component-badge--sm">${escapeHtml(folder.senderUsername)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-status-${folder.id}">
            <span class="component-badge component-badge--sm" style="margin-right: 6px;" data-ref="folder-count-${folder.id}">${i18n.t('room.files_count', { count: folder.files.size })}</span>
            ${statusBadge}
          </td>
        `;

        folderRow.addEventListener('click', () => {
          currentFolderId = folder.id;
          selectedItemIds.clear();
          updateSelectionUI();
          renderTableRows();
        });

        renderIcons(folderRow);
        filesTbody.appendChild(folderRow);
      });

      standaloneFiles.forEach((file) => {
        const isSelected = selectedItemIds.has(file.fileId);
        const fileRow = document.createElement('tr');
        fileRow.className = `component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}`;
        fileRow.setAttribute('data-ref', `file-row-${file.fileId}`);

        const statusBadge = file.isLimitReached
          ? `<span class="component-badge component-badge--sm" data-ref="badge-limit-${file.fileId}">${i18n.t('room.download_limit_reached')}</span>`
          : (file.progress >= 100
            ? `<span class="component-badge component-badge--sm" data-ref="progress-badge-${file.fileId}">${i18n.t('room.status_ready')}</span>`
            : `<span class="component-badge component-badge--sm" data-ref="progress-badge-${file.fileId}">${file.progress}%</span>`);

        const downloadCountHtml = (file.maxDownloads !== undefined && file.maxDownloads !== null)
          ? `<span class="component-badge component-badge--sm" style="margin-right: 6px;" data-ref="downloads-count-${file.fileId}">${file.downloadCount || 0}/${file.maxDownloads}</span>`
          : '';

        fileRow.innerHTML = `
          <td class="component-table__cell" data-ref="cell-name-${file.fileId}">
            <div class="component-table__cell-content">
              <div class="component-table__icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${getFileIcon(file.name)}"></use></svg>
              </div>
              <span class="component-badge component-badge--sm" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            </div>
          </td>
          <td class="component-table__cell" data-ref="cell-size-${file.fileId}">
            <span class="component-badge component-badge--sm">${formatBytes(file.size)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-sender-${file.fileId}">
            <span class="component-badge component-badge--sm">${escapeHtml(file.senderUsername)}</span>
          </td>
          <td class="component-table__cell" data-ref="cell-status-${file.fileId}">
            ${downloadCountHtml}
            ${statusBadge}
          </td>
        `;

        fileRow.addEventListener('click', (e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            if (selectedItemIds.has(file.fileId)) {
              selectedItemIds.delete(file.fileId);
            } else {
              selectedItemIds.add(file.fileId);
            }
          } else {
            if (selectedItemIds.has(file.fileId) && selectedItemIds.size === 1) {
              selectedItemIds.clear();
            } else {
              selectedItemIds.clear();
              selectedItemIds.add(file.fileId);
            }
          }
          updateSelectionUI();
          renderTableRows();
        });

        renderIcons(fileRow);
        filesTbody.appendChild(fileRow);
      });
    }
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
    cloudFileIds.add(file.file_id);
    localFileBlobs.delete(file.file_id);

    const activeDl = activeDownloads.get(file.file_id);
    if (activeDl?.downloadUrl && activeDl.downloadUrl.startsWith('blob:')) {
      URL.revokeObjectURL(activeDl.downloadUrl);
      activeDl.downloadUrl = undefined;
    }

    const senderName = file.sender_username || myUsername;
    const savedPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                          (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) ||
                          '';
    const fileDlUrl = savedPassword && !file.download_url.includes('password=')
      ? `${file.download_url}?password=${encodeURIComponent(savedPassword)}`
      : file.download_url;

    if (file.folder_id && file.folder_name) {
      let folder = activeFolders.get(file.folder_id);
      if (!folder) {
        folder = {
          files: new Map(),
          id: file.folder_id,
          name: file.folder_name,
          senderAvatar: file.sender_avatar || undefined,
          senderUsername: senderName,
        };
        activeFolders.set(file.folder_id, folder);
      }
      const prevFolderFile = folder.files.get(file.file_id);
      if (prevFolderFile?.downloadUrl && prevFolderFile.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevFolderFile.downloadUrl);
      }
      folder.files.set(file.file_id, {
        downloadCount: file.download_count,
        downloadUrl: fileDlUrl,
        fileId: file.file_id,
        isCloud: true,
        isLimitReached: file.is_limit_reached,
        maxDownloads: file.max_downloads,
        mimeType: file.mime_type,
        name: file.name,
        progress: 100,
        relativePath: file.relative_path || file.name,
        size: file.size,
      });
      if (currentFolderId === file.folder_id) {
        renderTableRows();
      } else {
        updateFolderProgress(file.folder_id);
      }
    } else {
      const prevStandalone = standaloneFiles.get(file.file_id);
      if (prevStandalone?.downloadUrl && prevStandalone.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevStandalone.downloadUrl);
      }
      standaloneFiles.set(file.file_id, {
        downloadCount: file.download_count,
        downloadUrl: fileDlUrl,
        fileId: file.file_id,
        isCloud: true,
        isLimitReached: file.is_limit_reached,
        maxDownloads: file.max_downloads,
        mimeType: file.mime_type,
        name: file.name,
        progress: 100,
        senderAvatar: file.sender_avatar || undefined,
        senderUsername: senderName,
        size: file.size,
        status: 'complete',
      });
      renderTableRows();
    }
  };

  function syncCloudFilesMaxDownloads(): void {
    let changed = false;
    standaloneFiles.forEach((item) => {
      if (item.isCloud) {
        item.maxDownloads = roomMaxDownloads;
        item.isLimitReached = roomMaxDownloads !== null && (item.downloadCount || 0) >= roomMaxDownloads;
        changed = true;
      }
    });
    activeFolders.forEach((folder) => {
      folder.files.forEach((fItem) => {
        if (fItem.isCloud) {
          fItem.maxDownloads = roomMaxDownloads;
          fItem.isLimitReached = roomMaxDownloads !== null && (fItem.downloadCount || 0) >= roomMaxDownloads;
          changed = true;
        }
      });
    });
    if (changed) {
      renderTableRows();
    }
  }

  async function uploadFileToCloud(item: LocalPendingCloudFile): Promise<{ error?: string; ok: boolean }> {
    try {
      const formData = new FormData();
      const fileObj = item.blob instanceof File
        ? item.blob
        : new File([item.blob], item.name, { type: item.mimeType || 'application/octet-stream' });
      formData.append('file', fileObj);
      formData.append('file_id', item.fileId);
      formData.append('peer_id', myPeerId);
      if (item.folderId) formData.append('folder_id', item.folderId);
      if (item.folderName) formData.append('folder_name', item.folderName);
      if (item.relativePath) formData.append('relative_path', item.relativePath);
      if (roomMaxDownloads) formData.append('max_downloads', String(roomMaxDownloads));
      formData.append('sender_username', item.senderUsername);
      if (item.senderAvatar) formData.append('sender_avatar', item.senderAvatar);

      const savedPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                            (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) || '';
      const headers: Record<string, string> = {};
      if (savedPassword) {
        headers['x-room-password'] = savedPassword;
        formData.append('password', savedPassword);
      }

      const res = await fetch(`/api/rooms/${encodeURIComponent(resolvedRoomId)}/files/upload`, {
        body: formData,
        headers,
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (json && json.ok && json.file) {
        renderCloudFileCard(json.file);
        return { ok: true };
      }
      return { error: json?.error || i18n.t('common.error'), ok: false };
    } catch {
      return { error: i18n.t('common.error'), ok: false };
    }
  }

  async function uploadPendingFilesToCloud(pendingFiles: LocalPendingCloudFile[]): Promise<void> {
    if (pendingFiles.length === 0) return;

    toast.info(i18n.t('room.cloud_sync_in_progress', { count: pendingFiles.length }));
    let uploadedCount = 0;
    let failedCount = 0;
    let lastError = '';

    for (const item of pendingFiles) {
      if (isCleanedUp) break;
      const badge = filesTbody?.querySelector<HTMLElement>(`[data-ref="progress-badge-${item.fileId}"]`);
      if (badge) {
        badge.className = 'component-badge component-badge--sm';
        badge.textContent = i18n.t('room.status_uploading');
      }

      const result = await uploadFileToCloud(item);
      if (result.ok) {
        uploadedCount++;
      } else {
        failedCount++;
        if (result.error) {
          lastError = result.error;
        }
        const errBadge = filesTbody?.querySelector<HTMLElement>(`[data-ref="progress-badge-${item.fileId}"]`);
        if (errBadge) {
          errBadge.className = 'component-badge component-badge--sm';
          errBadge.textContent = i18n.t('room.status_error');
        }
      }
    }

    if (uploadedCount > 0) {
      window.dispatchEvent(new CustomEvent('boardstack:rooms-updated'));
    }

    if (failedCount === 0 && uploadedCount > 0) {
      toast.success(i18n.t('room.cloud_sync_complete', { count: uploadedCount }));
    } else if (uploadedCount > 0 && failedCount > 0) {
      toast.info(i18n.t('room.cloud_sync_partial', { failed: failedCount, uploaded: uploadedCount }));
    } else if (failedCount > 0) {
      toast.error(lastError || i18n.t('room.cloud_sync_failed'));
    }
  }

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
        hasLoadedCloudFiles = true;
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
    const existingFile = standaloneFiles.get(fileId);
    if (!existingFile) {
      if (name && size !== undefined) {
        const newFile: StandaloneFileItem = {
          downloadUrl,
          fileId,
          name,
          progress,
          senderUsername: senderUsername || myUsername,
          size,
          status: progress >= 100 ? 'complete' : 'uploading',
        };
        standaloneFiles.set(fileId, newFile);
        renderTableRows();
      }
      return;
    }

    existingFile.progress = progress;
    if (downloadUrl) {
      existingFile.downloadUrl = downloadUrl;
      existingFile.status = 'complete';
    }

    const badge = filesTbody?.querySelector<HTMLElement>(`[data-ref="progress-badge-${fileId}"]`);
    if (badge) {
      if (progress >= 100) {
        badge.className = 'component-badge component-badge--sm';
        badge.textContent = i18n.t('room.status_ready');
      } else {
        badge.textContent = `${progress}%`;
      }
    }
  };

  const updateFolderProgress = (folderId: string) => {
    const folder = activeFolders.get(folderId);
    if (!folder) return;

    if (currentFolderId === folderId) {
      folder.files.forEach((f) => {
        const badge = filesTbody?.querySelector<HTMLElement>(`[data-ref="progress-badge-${f.fileId}"]`);
        if (badge) {
          if (f.progress >= 100) {
            badge.className = 'component-badge component-badge--sm';
            badge.textContent = i18n.t('room.status_ready');
          } else {
            badge.textContent = `${f.progress}%`;
          }
        }
      });

      let totalBytes = 0;
      folder.files.forEach((f) => {
        totalBytes += f.size;
      });
      if (folderHeaderDesc) {
        folderHeaderDesc.textContent = `${i18n.t('room.files_count', { count: folder.files.size })} • ${formatBytes(totalBytes)} • ${folder.senderUsername}`;
      }
    } else if (!currentFolderId) {
      const row = filesTbody?.querySelector<HTMLElement>(`[data-ref="folder-row-${folderId}"]`);
      if (!row) {
        renderTableRows();
        return;
      }

      let folderBytes = 0;
      let transferredBytes = 0;
      let allComplete = folder.files.size > 0;
      folder.files.forEach((f) => {
        folderBytes += f.size;
        transferredBytes += Math.round((f.progress / 100) * f.size);
        if (f.progress < 100) allComplete = false;
      });

      const overallProgress = folderBytes > 0
        ? Math.min(100, Math.round((transferredBytes / folderBytes) * 100))
        : 100;

      const countEl = row.querySelector<HTMLElement>(`[data-ref="folder-count-${folderId}"]`);
      const sizeEl = row.querySelector<HTMLElement>(`[data-ref="folder-size-${folderId}"]`);
      const badgeEl = row.querySelector<HTMLElement>(`[data-ref="folder-badge-${folderId}"]`);

      if (countEl) countEl.textContent = i18n.t('room.files_count', { count: folder.files.size });
      if (sizeEl) sizeEl.textContent = formatBytes(folderBytes);
      if (badgeEl) {
        if (allComplete) {
          badgeEl.className = 'component-badge component-badge--sm';
          badgeEl.textContent = i18n.t('room.status_ready');
        } else {
          badgeEl.textContent = `${overallProgress}%`;
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

    const otherParticipants = currentParticipants.filter((p) => p.peer_id !== myPeerId);
    const needRelay = !sentP2P ||
      otherParticipants.some((p) => {
        const peer = peers.get(p.peer_id);
        return !peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open';
      });
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

            if (!cloudFileIds.has(item.metadata.file_id)) {
              localFileBlobs.set(item.metadata.file_id, {
                blob,
                fileId: item.metadata.file_id,
                folderId: item.metadata.folder_id,
                folderName: item.metadata.folder_name,
                mimeType: item.metadata.mime_type || 'application/octet-stream',
                name: item.metadata.name,
                relativePath: item.metadata.relative_path,
                senderAvatar: item.metadata.sender_avatar,
                senderUsername: item.metadata.sender_username || i18n.t('room.guest_badge'),
                size: item.metadata.size,
              });
            }

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

    const pendingEntry: LocalPendingCloudFile = {
      blob: file,
      fileId,
      folderId,
      folderName,
      mimeType: file.type || 'application/octet-stream',
      name: file.name,
      relativePath,
      senderAvatar: myAvatarUrl,
      senderUsername: myUsername,
      size: file.size,
    };
    localFileBlobs.set(fileId, pendingEntry);

    if (saveToCloud) {
      const uploadRes = await uploadFileToCloud(pendingEntry);
      if (uploadRes.ok) {
        window.dispatchEvent(new CustomEvent('boardstack:rooms-updated'));
        toast.success(i18n.t('room.cloud_saved_success'));
      } else {
        const fileItem = standaloneFiles.get(fileId);
        if (fileItem) {
          fileItem.status = 'error';
        }
        const badge = filesTbody?.querySelector<HTMLElement>(`[data-ref="progress-badge-${fileId}"]`);
        if (badge) {
          badge.className = 'component-badge component-badge--sm';
          badge.textContent = i18n.t('room.status_error');
        }
        toast.error(uploadRes.error || i18n.t('common.error'));
      }
    } else {
      const localUrl = URL.createObjectURL(file);
      if (isFolder && folderId) {
        const folder = activeFolders.get(folderId);
        const fItem = folder?.files.get(fileId);
        if (fItem) {
          fItem.progress = 100;
          fItem.downloadUrl = localUrl;
          updateFolderProgress(folderId);
        } else {
          URL.revokeObjectURL(localUrl);
        }
      } else {
        updateFileCardProgress(
          fileId,
          file.name,
          file.size,
          100,
          0,
          i18n.t('room.transfer_completed'),
          myUsername,
          localUrl
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
    void selectFolderWithPicker();
  });

  inputFiles?.addEventListener('change', () => {
    if (inputFiles.files && inputFiles.files.length > 0) {
      void handleFilesSelected(inputFiles.files);
      inputFiles.value = '';
    }
  });

  inputFolder?.addEventListener('change', () => {
    if (inputFolder.files && inputFolder.files.length > 0) {
      const files = Array.from(inputFolder.files);
      const relPath = (files[0] as any).webkitRelativePath || '';
      const folderName = relPath.split('/')[0] || i18n.t('room.folder');
      promptConfirmFolderUpload(folderName, files);
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
        const hasFolder = files.some((f) => (f as any).webkitRelativePath?.includes('/'));
        if (hasFolder) {
          const folderName = ((files[0] as any).webkitRelativePath || '').split('/')[0] || i18n.t('room.folder');
          promptConfirmFolderUpload(folderName, files);
        } else {
          void handleFilesSelected(files);
        }
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
        const hasFolder = files.some((f) => (f as any).webkitRelativePath?.includes('/'));
        if (hasFolder) {
          const folderName = ((files[0] as any).webkitRelativePath || '').split('/')[0] || i18n.t('room.folder');
          promptConfirmFolderUpload(folderName, files);
        } else {
          void handleFilesSelected(files);
        }
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
    const uniqueParticipantsMap = new Map<string, RoomParticipant>();
    participants.forEach((p) => {
      uniqueParticipantsMap.set(p.peer_id, p);
    });
    const uniqueParticipants = Array.from(uniqueParticipantsMap.values());
    currentParticipants = uniqueParticipants;
    const activePeerIds = new Set(uniqueParticipants.map((p) => p.peer_id));

    let removedStalePeer = false;
    peers.forEach((peer, peerId) => {
      if (!activePeerIds.has(peerId)) {
        try {
          if (peer.dataChannel) peer.dataChannel.close();
          peer.pc.close();
        } catch {}
        peers.delete(peerId);
        removedStalePeer = true;
      }
    });
    if (removedStalePeer) {
      updateConnectionModeBadge();
    }

    if (isOwner) {
      uniqueParticipants.forEach((p) => {
        if (p.peer_id !== myPeerId && !peers.has(p.peer_id)) {
          void initiatePeerConnection(p.peer_id);
        }
      });
    }

    if (!avatarGroupEl) return;

    avatarGroupEl.innerHTML = uniqueParticipants.map((p) => {
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
      uniqueParticipants.forEach((p) => {
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

  function closeSocketOnUnload(): void {
    cleanup();
  }

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    window.removeEventListener('beforeunload', closeSocketOnUnload);
    window.removeEventListener('pagehide', closeSocketOnUnload);
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleDocumentClick);

    peers.forEach((peer) => {
      try {
        if (peer.dataChannel) peer.dataChannel.close();
        peer.pc.close();
      } catch {}
    });
    peers.clear();

    activeDownloads.forEach((item) => {
      if (item.downloadUrl && item.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.downloadUrl);
      }
    });
    activeDownloads.clear();
    standaloneFiles.forEach((item) => {
      if (item.downloadUrl && item.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.downloadUrl);
      }
    });
    standaloneFiles.clear();
    localFileBlobs.clear();
    cloudFileIds.clear();
    currentFolderId = null;

    activeFolders.forEach((folder) => {
      folder.files.forEach((fileItem) => {
        if (fileItem.downloadUrl && fileItem.downloadUrl.startsWith('blob:')) {
          URL.revokeObjectURL(fileItem.downloadUrl);
        }
      });
    });
    activeFolders.clear();

    if (ws) {
      try {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
      ws = null;
    }
  };

  window.addEventListener('beforeunload', closeSocketOnUnload);
  window.addEventListener('pagehide', closeSocketOnUnload);

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
    if (isCleanedUp) return;

    if (ws) {
      try {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {}
      ws = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const savedPassword = sessionStorage.getItem(`room_password_${resolvedRoomId}`) ||
                          (currentSlug ? sessionStorage.getItem(`room_password_${currentSlug}`) : null) ||
                          '';
    const ownerToken = sessionStorage.getItem(`room_owner_token_${resolvedRoomId}`) ||
                       (currentSlug ? sessionStorage.getItem(`room_owner_token_${currentSlug}`) : null) ||
                       '';
    const userIdParam = currentUser?.id ? `&user_id=${encodeURIComponent(String(currentUser.id))}` : '';

    const wsUrl = `${protocol}//${host}/ws/room/${encodeURIComponent(resolvedRoomId)}?peer_id=${encodeURIComponent(myPeerId)}&username=${encodeURIComponent(myUsername)}&avatar_url=${encodeURIComponent(myAvatarUrl)}&is_owner=${isOwner}&owner_token=${encodeURIComponent(ownerToken)}&password=${encodeURIComponent(savedPassword)}${userIdParam}`;

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
          if (data.slug !== undefined) {
            currentSlug = data.slug || '';
          }
          if (data.is_persistent !== undefined) {
            isPersistentRoom = Boolean(data.is_persistent);
          }
          if (data.requires_password !== undefined) {
            hasPassword = Boolean(data.requires_password);
          }
          if (data.save_to_cloud !== undefined) {
            saveToCloud = Boolean(data.save_to_cloud);
          }
          if (data.expires_at !== undefined) {
            roomExpiresAt = data.expires_at ?? null;
          }
          if (data.max_downloads !== undefined) {
            const prevLimit = roomMaxDownloads;
            roomMaxDownloads = data.max_downloads ?? null;
            if (prevLimit !== roomMaxDownloads) {
              syncCloudFilesMaxDownloads();
            }
          }
          if (data.upload_permission) {
            roomUploadPermission = data.upload_permission;
          }
          if (data.code) {
            currentCode = data.code;
          }
          if (shareCodeDisplayEl) {
            shareCodeDisplayEl.textContent = currentSlug ? `/r/${currentSlug}` : currentCode;
          }
          if (!hasLoadedCloudFiles) {
            void loadCloudFiles();
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
            clearRoomSession();
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
          const dlCount = (data as any).download_count;
          const maxDl = (data as any).max_downloads;
          const limitReached = Boolean((data as any).is_limit_reached);
          const file = standaloneFiles.get(data.file_id);
          if (file) {
            file.downloadCount = dlCount;
            file.maxDownloads = maxDl;
            if (limitReached) {
              file.isLimitReached = true;
            }
          } else {
            activeFolders.forEach((folder) => {
              const fItem = folder.files.get(data.file_id!);
              if (fItem) {
                fItem.downloadCount = dlCount;
                fItem.maxDownloads = maxDl;
                if (limitReached) {
                  fItem.isLimitReached = true;
                }
              }
            });
          }
          const countBadge = filesTbody?.querySelector<HTMLElement>(`[data-ref="downloads-count-${data.file_id}"]`);
          if (countBadge && maxDl !== null && maxDl !== undefined) {
            countBadge.textContent = `${dlCount}/${maxDl}`;
          }
          if (limitReached) {
            const badge = filesTbody?.querySelector<HTMLElement>(`[data-ref="progress-badge-${data.file_id}"]`);
            if (badge) {
              badge.className = 'component-badge component-badge--sm';
              badge.textContent = i18n.t('room.download_limit_reached');
            }
          }
        } else if (data.type === 'room_closed') {
          if (data.reason && data.reason.includes('expired')) {
            toast.error(i18n.t('room.room_expired_desc'));
          } else {
            toast.info(i18n.t('room.closed_notice'));
          }
          clearRoomSession();
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
    void loadCloudFiles();
  }

  (fragment as DocumentFragment & { cleanup?: () => void }).cleanup = cleanup;

  return fragment;
}

export {
  createRoomView
};
