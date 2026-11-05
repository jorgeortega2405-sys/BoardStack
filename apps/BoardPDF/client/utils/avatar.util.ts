import { API_ROUTES } from '../config/api-routes.js';
import { currentUser } from '../services/api.service.js';
import { applyAvatarTier, getFallbackTierColor } from './tier.util.js';

export interface AvatarUserLike {
  avatar_url?: string | null;
  email?: string | null;
  id?: number | string | null;
  subscription_tier?: string | null;
  user_id?: number | string | null;
  username?: string | null;
}

export interface RenderAvatarOptions {
  className?: string;
  dataRef?: string;
  size?: number;
}

export function getUserAvatarUrl(user: AvatarUserLike): string {
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
  return API_ROUTES.avatar(displayName);
}

export function renderUserAvatarHtml(user: AvatarUserLike, options?: RenderAvatarOptions): string {
  const url = getUserAvatarUrl(user);
  const displayName = user.username || user.email || 'User';
  const tier = (user.subscription_tier || 'free').toLowerCase();
  const tierColor = getFallbackTierColor(tier);
  const className = options?.className || 'table-user-avatar';
  const dataRefAttr = options?.dataRef ? ` data-ref="${options.dataRef}"` : '';
  const fallbackSvg = API_ROUTES.avatar(displayName);

  return `<div class="${className}"${dataRefAttr} data-tier="${tier}" style="--avatar-tier-bg: ${tierColor};"><img src="${url}" alt="${displayName}" onerror="if(this.src!=='${fallbackSvg}'){this.src='${fallbackSvg}';}" /></div>`;
}

export function createAvatarElement(user: AvatarUserLike, options?: RenderAvatarOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = options?.className || 'table-user-avatar';
  if (options?.dataRef) {
    container.setAttribute('data-ref', options.dataRef);
  }
  const tier = user.subscription_tier || 'free';
  applyAvatarTier(container, tier);

  const url = getUserAvatarUrl(user);
  const displayName = user.username || user.email || 'User';
  const fallbackSvg = API_ROUTES.avatar(displayName);

  const img = document.createElement('img');
  img.src = url;
  img.alt = displayName;
  img.onerror = () => {
    if (img.src !== fallbackSvg) {
      img.src = fallbackSvg;
    }
  };
  container.appendChild(img);
  return container;
}

export { applyAvatarTier, getFallbackTierColor } from './tier.util.js';
