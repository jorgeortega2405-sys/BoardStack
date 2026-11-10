import { currentUser } from '../services/api.service.js';
import { applyAvatarTier, getFallbackTierColor } from './tier.util.js';

interface AvatarUserLike {
  avatar_url?: string | null;
  email?: string | null;
  id?: number | string | null;
  subscription_tier?: string | null;
  user_id?: number | string | null;
  username?: string | null;
}

interface RenderAvatarOptions {
  className?: string;
  dataRef?: string;
  size?: number;
}

const GRADIENT_PALETTES = [
  ['#1e293b', '#0f172a'],
  ['#3b82f6', '#1d4ed8'],
  ['#3f3f46', '#18181b'],
  ['#52525b', '#27272a'],
  ['#71717a', '#3f3f46'],
  ['#059669', '#047857'],
  ['#d97706', '#b45309'],
  ['#0891b2', '#0e7490'],
  ['#475569', '#334155'],
  ['#18181b', '#27272a'],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getInitial(name: string): string {
  const clean = String(name || '').trim().replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/, '');
  if (!clean) return 'U';
  return clean.charAt(0).toUpperCase();
}

function getAvatarDataUri(name: string, sizeInput?: number): string {
  const initial = escapeXml(getInitial(name));
  const hash = Math.floor(Math.abs(hashString(name))) || 0;
  const palette = GRADIENT_PALETTES[hash % GRADIENT_PALETTES.length];
  const [color1, color2] = palette;

  const size = Math.min(Math.max(Number(sizeInput) || 80, 32), 256);
  const fontSize = Math.round(size * 0.44);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs><linearGradient id="avatar-grad-${hash}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs><rect width="${size}" height="${size}" rx="${size / 2}" fill="url(#avatar-grad-${hash})"/><text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff" letter-spacing="-0.5">${initial}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getUserAvatarUrl(user: AvatarUserLike, size?: number): string {
  const currentUserId = currentUser?.id !== undefined ? String(currentUser.id) : null;
  const targetId = user.id !== undefined && user.id !== null ? String(user.id) : user.user_id !== undefined && user.user_id !== null ? String(user.user_id) : null;

  if (currentUserId && targetId && currentUserId === targetId) {
    if (currentUser?.avatar_url && currentUser.avatar_url.trim() !== '') {
      return currentUser.avatar_url;
    }
  }

  if (user.avatar_url && user.avatar_url.trim() !== '') {
    return user.avatar_url;
  }

  const displayName = user.username || user.email || 'User';
  return getAvatarDataUri(displayName, size);
}

function renderUserAvatarHtml(user: AvatarUserLike, options?: RenderAvatarOptions): string {
  const url = getUserAvatarUrl(user, options?.size);
  const displayName = user.username || user.email || 'User';
  const tier = (user.subscription_tier || 'free').toLowerCase();
  const baseClassName = options?.className || 'table-user-avatar';
  const tierClass = `table-user-avatar--${tier}`;
  const className = `${baseClassName} ${tierClass}`;
  const dataRefAttr = options?.dataRef ? ` data-ref="${options.dataRef}"` : '';

  return `<div class="${className}"${dataRefAttr} data-tier="${tier}"><img src="${url}" alt="${displayName}" /></div>`;
}

function createAvatarElement(user: AvatarUserLike, options?: RenderAvatarOptions): HTMLElement {
  const container = document.createElement('div');
  const baseClassName = options?.className || 'table-user-avatar';
  const tier = (user.subscription_tier || 'free').toLowerCase();
  container.className = `${baseClassName} table-user-avatar--${tier}`;
  if (options?.dataRef) {
    container.setAttribute('data-ref', options.dataRef);
  }
  container.setAttribute('data-tier', tier);

  const url = getUserAvatarUrl(user, options?.size);
  const displayName = user.username || user.email || 'User';

  const img = document.createElement('img');
  img.src = url;
  img.alt = displayName;
  container.appendChild(img);
  return container;
}

export { applyAvatarTier, getFallbackTierColor } from './tier.util.js';

export { createAvatarElement, escapeXml, getAvatarDataUri, getInitial, getUserAvatarUrl, hashString, renderUserAvatarHtml };
export type { AvatarUserLike, RenderAvatarOptions };
