import { currentUser, escapeHtml } from '../../services/api.service.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { RemotePeer } from './collaborative-pdf.types.js';

function addPeerPresenceBubble(container: HTMLElement, peer: RemotePeer): void {
  const presenceContainer = container.querySelector<HTMLElement>('[data-ref="collab-presence-container"]');
  if (!presenceContainer) return;

  let bubble = presenceContainer.querySelector<HTMLElement>(`[data-client-id="${peer.clientId}"]`);
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'collab-presence-bubble collab-presence-bubble--enter';
    bubble.setAttribute('data-client-id', peer.clientId);
    bubble.style.backgroundColor = peer.color;
    applyAvatarTier(bubble, (peer as any).subscription_tier || (peer as any).subscriptionTier || 'free');
    const peerLabel = `${peer.username}${peer.isGuest ? ' (Invitado)' : ''}`;
    bubble.setAttribute('data-tooltip', peerLabel);
    bubble.setAttribute('aria-label', peerLabel);
    const peerAvatar = peer.avatarUrl || (peer.username ? `/api/avatar?name=${encodeURIComponent(peer.username)}&size=80` : null);
    if (peerAvatar) {
      bubble.innerHTML = `<img src="${peerAvatar}" alt="${peer.username}" />`;
    } else {
      bubble.textContent = peer.username.substring(0, 2).toUpperCase();
    }
    presenceContainer.appendChild(bubble);
  }
}

function removePeerPresenceBubble(container: HTMLElement, clientId: string): void {
  const presenceContainer = container.querySelector<HTMLElement>('[data-ref="collab-presence-container"]');
  if (!presenceContainer) return;
  const bubble = presenceContainer.querySelector<HTMLElement>(`[data-client-id="${clientId}"]`);
  if (bubble) {
    bubble.classList.remove('collab-presence-bubble--enter');
    bubble.classList.add('collab-presence-bubble--leave');
    setTimeout(() => {
      bubble.remove();
    }, 360);
  }
}

function renderPresenceList(
  container: HTMLElement,
  remotePeers: Map<string, RemotePeer>,
  myColor: string,
  isCollabRoomFull: boolean,
  guestIdentity: { avatarUrl: string; username: string } | null
): void {
  const presenceContainer = container.querySelector<HTMLElement>('[data-ref="collab-presence-container"]');
  if (!presenceContainer) return;

  presenceContainer.innerHTML = '';

  const myName = currentUser?.username || guestIdentity?.username || 'Tú';
  const myAvatar = currentUser?.avatar_url || (currentUser?.username ? `/api/avatar?name=${encodeURIComponent(currentUser.username)}&size=80` : (guestIdentity?.avatarUrl || null));
  const myInitials = myName.substring(0, 2).toUpperCase();
  const myBubble = document.createElement('div');
  myBubble.className = 'collab-presence-bubble';
  myBubble.setAttribute('data-client-id', 'me');
  myBubble.style.backgroundColor = myColor;
  applyAvatarTier(myBubble, currentUser?.subscription_tier || 'free');
  const fullSuffix = isCollabRoomFull ? ' (Sala llena)' : '';
  myBubble.setAttribute('data-tooltip', `${myName} (Tú)${fullSuffix}`);
  myBubble.setAttribute('aria-label', `${myName} (Tú)${fullSuffix}`);
  if (myAvatar) {
    myBubble.innerHTML = `<img src="${myAvatar}" alt="${myName}" />`;
  } else {
    myBubble.textContent = myInitials;
  }
  presenceContainer.appendChild(myBubble);

  for (const peer of remotePeers.values()) {
    const peerBubble = document.createElement('div');
    peerBubble.className = 'collab-presence-bubble';
    peerBubble.setAttribute('data-client-id', peer.clientId);
    peerBubble.style.backgroundColor = peer.color;
    applyAvatarTier(peerBubble, (peer as any).subscription_tier || (peer as any).subscriptionTier || 'free');
    const peerLabel = `${peer.username}${peer.isGuest ? ' (Invitado)' : ''}`;
    peerBubble.setAttribute('data-tooltip', peerLabel);
    peerBubble.setAttribute('aria-label', peerLabel);
    const peerAvatar = peer.avatarUrl || (peer.username ? `/api/avatar?name=${encodeURIComponent(peer.username)}&size=80` : null);
    if (peerAvatar) {
      peerBubble.innerHTML = `<img src="${peerAvatar}" alt="${peer.username}" />`;
    } else {
      peerBubble.textContent = peer.username.substring(0, 2).toUpperCase();
    }
    presenceContainer.appendChild(peerBubble);
  }
}

function renderRemoteCursor(
  container: HTMLElement,
  remoteCursorElements: Map<string, HTMLElement>,
  remoteCursorTimers: Map<string, ReturnType<typeof setTimeout>>,
  remotePeers: Map<string, RemotePeer>,
  msg: any
): void {
  const pageIndex = msg.page_index ?? msg.pageIndex ?? 0;
  const pageEl = container.querySelector<HTMLElement>(`.collaborative-page-sheet[data-page-index="${pageIndex}"]`);
  if (!pageEl) return;

  let cursorEl = remoteCursorElements.get(msg.clientId);
  if (!cursorEl || cursorEl.parentElement !== pageEl) {
    if (cursorEl) cursorEl.remove();
    cursorEl = document.createElement('div');
    cursorEl.className = 'collab-remote-cursor';
    cursorEl.setAttribute('data-ref', `collab-cursor-${msg.clientId}`);
    const peer = remotePeers.get(msg.clientId);
    const peerAvatar = peer?.avatarUrl || msg.avatarUrl || null;
    cursorEl.innerHTML = `
      <svg class="collab-cursor-pointer" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="${msg.color}" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
      <div class="collab-cursor-badge" style="background-color: ${msg.color};">
        ${peerAvatar ? `<img class="collab-cursor-avatar" src="${peerAvatar}" alt="" />` : ''}
        <span>${escapeHtml(msg.username)}</span>
      </div>
    `;
    pageEl.appendChild(cursorEl);
    remoteCursorElements.set(msg.clientId, cursorEl);
  }

  cursorEl.style.transform = `translate(${msg.x}px, ${msg.y}px)`;
  cursorEl.style.opacity = '1';

  const prevTimer = remoteCursorTimers.get(msg.clientId);
  if (prevTimer) clearTimeout(prevTimer);
  const newTimer = setTimeout(() => {
    if (cursorEl) cursorEl.style.opacity = '0';
  }, 4000);
  remoteCursorTimers.set(msg.clientId, newTimer);
}

export { addPeerPresenceBubble, removePeerPresenceBubble, renderPresenceList, renderRemoteCursor };
