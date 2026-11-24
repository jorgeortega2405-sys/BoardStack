import { i18n } from '../i18n/i18n.service.js';

interface GuestPersona {
  avatarUrl: string;
  name: string;
}

const GUEST_PERSONAS_COUNT = 12;

const GUEST_RAW_SVGS: string[] = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g0" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g0)"/><circle cx="68" cy="32" r="14" fill="#e0e7ff" opacity="0.35"/><path d="M30 65 L40 40 L50 55 L60 40 L70 65 Z" fill="#ffffff"/><circle cx="43" cy="52" r="3" fill="#312e81"/><circle cx="57" cy="52" r="3" fill="#312e81"/><polygon points="50,57 46,62 54,62" fill="#312e81"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g1)"/><polygon points="26,30 38,58 24,58" fill="#ffffff"/><polygon points="74,30 62,58 76,58" fill="#ffffff"/><polygon points="34,48 66,48 50,78" fill="#ffffff"/><circle cx="42" cy="54" r="3" fill="#7c2d12"/><circle cx="58" cy="54" r="3" fill="#7c2d12"/><circle cx="50" cy="65" r="4" fill="#7c2d12"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#0d9488"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g2)"/><circle cx="32" cy="34" r="12" fill="#111827"/><circle cx="68" cy="34" r="12" fill="#111827"/><circle cx="50" cy="56" r="28" fill="#ffffff"/><ellipse cx="40" cy="52" rx="7" ry="9" fill="#111827"/><ellipse cx="60" cy="52" rx="7" ry="9" fill="#111827"/><circle cx="41" cy="50" r="2.5" fill="#ffffff"/><circle cx="59" cy="50" r="2.5" fill="#ffffff"/><ellipse cx="50" cy="64" rx="5" ry="3.5" fill="#111827"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#b45309"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g3)"/><polygon points="50,22 64,48 50,42 36,48" fill="#fef3c7"/><path d="M22 46 Q50 32 78 46 L68 68 Q50 78 32 68 Z" fill="#ffffff"/><circle cx="42" cy="52" r="3.5" fill="#78350f"/><circle cx="58" cy="52" r="3.5" fill="#78350f"/><polygon points="50,56 46,64 54,64" fill="#b45309"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g4)"/><path d="M24 62 Q36 34 66 38 Q78 40 82 52 Q72 50 60 56 Q40 66 24 62 Z" fill="#ffffff"/><circle cx="62" cy="45" r="3" fill="#1e3a8a"/><path d="M60 52 Q64 55 68 53" stroke="#1e3a8a" stroke-width="1.5" fill="none"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d946ef"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g5)"/><polygon points="28,24 38,52 26,52" fill="#ffffff"/><polygon points="72,24 62,52 74,52" fill="#ffffff"/><path d="M28 24 L26 16" stroke="#3b0764" stroke-width="2.5"/><path d="M72 24 L74 16" stroke="#3b0764" stroke-width="2.5"/><circle cx="50" cy="58" r="22" fill="#ffffff"/><circle cx="43" cy="54" r="3.5" fill="#581c87"/><circle cx="57" cy="54" r="3.5" fill="#581c87"/><polygon points="50,61 47,65 53,65" fill="#581c87"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g6)"/><circle cx="38" cy="48" r="15" fill="#ffffff"/><circle cx="62" cy="48" r="15" fill="#ffffff"/><circle cx="38" cy="48" r="7" fill="#0284c7"/><circle cx="62" cy="48" r="7" fill="#0284c7"/><circle cx="40" cy="46" r="2.5" fill="#ffffff"/><circle cx="64" cy="46" r="2.5" fill="#ffffff"/><polygon points="50,54 46,64 54,64" fill="#f59e0b"/><path d="M30 30 Q38 38 48 36 M70 30 Q62 38 52 36" stroke="#f8fafc" stroke-width="2.5" fill="none"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#84cc16"/><stop offset="100%" stop-color="#15803d"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g7)"/><circle cx="28" cy="40" r="14" fill="#64748b"/><circle cx="72" cy="40" r="14" fill="#64748b"/><circle cx="28" cy="40" r="8" fill="#cbd5e1"/><circle cx="72" cy="40" r="8" fill="#cbd5e1"/><circle cx="50" cy="56" r="24" fill="#f1f5f9"/><circle cx="41" cy="50" r="3" fill="#0f172a"/><circle cx="59" cy="50" r="3" fill="#0f172a"/><ellipse cx="50" cy="58" rx="6" ry="9" fill="#0f172a"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g8)"/><circle cx="50" cy="54" r="26" fill="#ffffff"/><path d="M28 42 L38 48 M28 54 L36 56 M72 42 L62 48 M72 54 L64 56 M50 32 L50 42" stroke="#991b1b" stroke-width="2.5"/><circle cx="42" cy="52" r="3" fill="#991b1b"/><circle cx="58" cy="52" r="3" fill="#991b1b"/><polygon points="50,58 47,62 53,62" fill="#991b1b"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g9" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g9)"/><circle cx="50" cy="52" r="24" fill="#ffffff"/><circle cx="30" cy="40" r="5" fill="#0f766e"/><circle cx="70" cy="40" r="5" fill="#0f766e"/><circle cx="42" cy="48" r="3" fill="#0f766e"/><circle cx="58" cy="48" r="3" fill="#0f766e"/><ellipse cx="50" cy="56" rx="5" ry="3.5" fill="#0f766e"/><circle cx="44" cy="58" r="1" fill="#0f766e"/><circle cx="56" cy="58" r="1" fill="#0f766e"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g10" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#e11d48"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g10)"/><circle cx="50" cy="50" r="32" fill="#d97706" opacity="0.4"/><circle cx="50" cy="52" r="22" fill="#ffffff"/><circle cx="42" cy="48" r="3" fill="#78350f"/><circle cx="58" cy="48" r="3" fill="#78350f"/><polygon points="50,54 46,59 54,59" fill="#78350f"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g11" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g11)"/><polygon points="26,30 38,52 26,52" fill="#ffffff"/><polygon points="74,30 62,52 74,52" fill="#ffffff"/><circle cx="50" cy="56" r="22" fill="#ffffff"/><circle cx="42" cy="52" r="3" fill="#581c87"/><circle cx="58" cy="52" r="3" fill="#581c87"/><polygon points="50,58 47,61 53,61" fill="#f472b6"/><path d="M36 58 L28 56 M36 62 L28 64 M64 58 L72 56 M64 62 L72 64" stroke="#d8b4fe" stroke-width="1.5"/></svg>',
];

const GUEST_AVATARS: string[] = GUEST_RAW_SVGS.map((svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);

function getGuestPersona(roomId: string): GuestPersona {
  const cachedName = sessionStorage.getItem(`guest_name_${roomId}`);
  const cachedAvatar = sessionStorage.getItem(`guest_avatar_${roomId}`);

  if (cachedName && cachedAvatar) {
    return {
      avatarUrl: cachedAvatar,
      name: cachedName,
    };
  }

  let cachedIdxStr = sessionStorage.getItem(`guest_persona_idx_${roomId}`);
  let idx = cachedIdxStr ? parseInt(cachedIdxStr, 10) : NaN;

  if (isNaN(idx) || idx < 0 || idx >= GUEST_PERSONAS_COUNT) {
    idx = Math.floor(Math.random() * GUEST_PERSONAS_COUNT);
    sessionStorage.setItem(`guest_persona_idx_${roomId}`, String(idx));
  }

  const name = i18n.t(`room.guest_persona_${idx}`);
  const avatarUrl = GUEST_AVATARS[idx];

  sessionStorage.setItem(`guest_name_${roomId}`, name);
  sessionStorage.setItem(`guest_avatar_${roomId}`, avatarUrl);

  return {
    avatarUrl,
    name,
  };
}

export {
  GUEST_AVATARS,
  GUEST_PERSONAS_COUNT,
  getGuestPersona
};

export type {
  GuestPersona
};
