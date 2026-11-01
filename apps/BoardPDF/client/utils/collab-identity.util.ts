export interface CollabGuestIdentity {
  avatarUrl: string;
  isGuest: true;
  userId: null;
  username: string;
}

export const ANONYMOUS_ANIMAL_NAMES: string[] = [
  'Ardilla Ágil',
  'Búho Sabio',
  'Camaleón Mágico',
  'Canguro Rebelde',
  'Castor Ingenioso',
  'Cisne Noble',
  'Colibrí Veloz',
  'Delfín Saltarín',
  'Erizo Amable',
  'Flamenco Zen',
  'Foca Juguetona',
  'Gato Cósmico',
  'Gepardo Rápido',
  'Halcón Certero',
  'Jaguar Místico',
  'Jirafa Curiosa',
  'Koala Feliz',
  'Lémur Travieso',
  'León Radiante',
  'Lince Ártico',
  'Llama Mágica',
  'Lobo Veloz',
  'Mapache Creativo',
  'Mono Alegre',
  'Nutria Ágil',
  'Oso Amigable',
  'Panda Curioso',
  'Perezoso Relajado',
  'Perro Leal',
  'Pingüino Elegante',
  'Pulpo Genio',
  'Rana Saltarina',
  'Rinoceronte Fuerte',
  'Suricato Atento',
  'Tejón Audaz',
  'Tigre Valiente',
  'Tortuga Sabia',
  'Tucán Colorido',
  'Zorro Astuto',
];

export const ANONYMOUS_ANIMAL_AVATARS: Record<string, string> = {
  bear: '/images/avatars/animals/bear.svg',
  cat: '/images/avatars/animals/cat.svg',
  dog: '/images/avatars/animals/dog.svg',
  fox: '/images/avatars/animals/fox.svg',
  frog: '/images/avatars/animals/frog.svg',
  giraffe: '/images/avatars/animals/giraffe.svg',
  koala: '/images/avatars/animals/koala.svg',
  lion: '/images/avatars/animals/lion.svg',
  monkey: '/images/avatars/animals/monkey.svg',
  otter: '/images/avatars/animals/otter.svg',
  owl: '/images/avatars/animals/owl.svg',
  panda: '/images/avatars/animals/panda.svg',
  penguin: '/images/avatars/animals/penguin.svg',
  rabbit: '/images/avatars/animals/rabbit.svg',
  raccoon: '/images/avatars/animals/raccoon.svg',
  tiger: '/images/avatars/animals/tiger.svg',
};

const ANIMAL_AVATAR_MAP: Record<string, string> = {
  'Búho': '/images/avatars/animals/owl.svg',
  'Gato': '/images/avatars/animals/cat.svg',
  'Jirafa': '/images/avatars/animals/giraffe.svg',
  'Koala': '/images/avatars/animals/koala.svg',
  'León': '/images/avatars/animals/lion.svg',
  'Mapache': '/images/avatars/animals/raccoon.svg',
  'Mono': '/images/avatars/animals/monkey.svg',
  'Nutria': '/images/avatars/animals/otter.svg',
  'Oso': '/images/avatars/animals/bear.svg',
  'Panda': '/images/avatars/animals/panda.svg',
  'Perro': '/images/avatars/animals/dog.svg',
  'Pingüino': '/images/avatars/animals/penguin.svg',
  'Rana': '/images/avatars/animals/frog.svg',
  'Tigre': '/images/avatars/animals/tiger.svg',
  'Zorro': '/images/avatars/animals/fox.svg',
};

const STORAGE_KEY = 'boardpdf_collab_guest_identity';

export function getOrCreateGuestIdentity(): CollabGuestIdentity {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CollabGuestIdentity;
      if (parsed?.username && parsed?.avatarUrl && parsed?.isGuest) {
        return parsed;
      }
    }
  } catch {
  }

  const nameIndex = Math.floor(Math.random() * ANONYMOUS_ANIMAL_NAMES.length);
  const username = ANONYMOUS_ANIMAL_NAMES[nameIndex];
  const firstWord = username.split(' ')[0];
  let avatarUrl = ANIMAL_AVATAR_MAP[firstWord];

  if (!avatarUrl) {
    const avatarList = Object.values(ANONYMOUS_ANIMAL_AVATARS);
    avatarUrl = avatarList[Math.floor(Math.random() * avatarList.length)];
  }

  const identity: CollabGuestIdentity = {
    avatarUrl,
    isGuest: true,
    userId: null,
    username,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
  }

  return identity;
}
