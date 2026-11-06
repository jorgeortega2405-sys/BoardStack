import { t } from '../services/i18n.service.js';

export interface CollabGuestIdentity {
  animalKey?: string;
  avatarUrl: string;
  isGuest: true;
  userId: null;
  username: string;
}

export interface AnonymousAnimalDefinition {
  avatarKey: string;
  fallback: string;
  key: string;
}

export const ANONYMOUS_ANIMAL_ITEMS: AnonymousAnimalDefinition[] = [
  { avatarKey: 'bear', fallback: 'Ardilla Ágil', key: 'collab.animals.squirrel_agile' },
  { avatarKey: 'owl', fallback: 'Búho Sabio', key: 'collab.animals.owl_wise' },
  { avatarKey: 'frog', fallback: 'Camaleón Mágico', key: 'collab.animals.chameleon_magic' },
  { avatarKey: 'rabbit', fallback: 'Canguro Rebelde', key: 'collab.animals.kangaroo_rebel' },
  { avatarKey: 'otter', fallback: 'Castor Ingenioso', key: 'collab.animals.beaver_clever' },
  { avatarKey: 'penguin', fallback: 'Cisne Noble', key: 'collab.animals.swan_noble' },
  { avatarKey: 'owl', fallback: 'Colibrí Veloz', key: 'collab.animals.hummingbird_swift' },
  { avatarKey: 'otter', fallback: 'Delfín Saltarín', key: 'collab.animals.dolphin_playful' },
  { avatarKey: 'raccoon', fallback: 'Erizo Amable', key: 'collab.animals.hedgehog_kind' },
  { avatarKey: 'penguin', fallback: 'Flamenco Zen', key: 'collab.animals.flamingo_zen' },
  { avatarKey: 'otter', fallback: 'Foca Juguetona', key: 'collab.animals.seal_playful' },
  { avatarKey: 'cat', fallback: 'Gato Cósmico', key: 'collab.animals.cat_cosmic' },
  { avatarKey: 'tiger', fallback: 'Gepardo Rápido', key: 'collab.animals.cheetah_fast' },
  { avatarKey: 'owl', fallback: 'Halcón Certero', key: 'collab.animals.falcon_sharp' },
  { avatarKey: 'tiger', fallback: 'Jaguar Místico', key: 'collab.animals.jaguar_mystic' },
  { avatarKey: 'giraffe', fallback: 'Jirafa Curiosa', key: 'collab.animals.giraffe_curious' },
  { avatarKey: 'koala', fallback: 'Koala Feliz', key: 'collab.animals.koala_happy' },
  { avatarKey: 'monkey', fallback: 'Lémur Travieso', key: 'collab.animals.lemur_playful' },
  { avatarKey: 'lion', fallback: 'León Radiante', key: 'collab.animals.lion_radiant' },
  { avatarKey: 'cat', fallback: 'Lince Ártico', key: 'collab.animals.lynx_arctic' },
  { avatarKey: 'giraffe', fallback: 'Llama Mágica', key: 'collab.animals.llama_magic' },
  { avatarKey: 'dog', fallback: 'Lobo Veloz', key: 'collab.animals.wolf_swift' },
  { avatarKey: 'raccoon', fallback: 'Mapache Creativo', key: 'collab.animals.raccoon_creative' },
  { avatarKey: 'monkey', fallback: 'Mono Alegre', key: 'collab.animals.monkey_cheerful' },
  { avatarKey: 'otter', fallback: 'Nutria Ágil', key: 'collab.animals.otter_agile' },
  { avatarKey: 'bear', fallback: 'Oso Amigable', key: 'collab.animals.bear_friendly' },
  { avatarKey: 'panda', fallback: 'Panda Curioso', key: 'collab.animals.panda_curious' },
  { avatarKey: 'koala', fallback: 'Perezoso Relajado', key: 'collab.animals.sloth_chill' },
  { avatarKey: 'dog', fallback: 'Perro Leal', key: 'collab.animals.dog_loyal' },
  { avatarKey: 'penguin', fallback: 'Pingüino Elegante', key: 'collab.animals.penguin_elegant' },
  { avatarKey: 'frog', fallback: 'Pulpo Genio', key: 'collab.animals.octopus_genius' },
  { avatarKey: 'frog', fallback: 'Rana Saltarina', key: 'collab.animals.frog_jumping' },
  { avatarKey: 'bear', fallback: 'Rinoceronte Fuerte', key: 'collab.animals.rhino_strong' },
  { avatarKey: 'otter', fallback: 'Suricato Atento', key: 'collab.animals.meerkat_alert' },
  { avatarKey: 'raccoon', fallback: 'Tejón Audaz', key: 'collab.animals.badger_bold' },
  { avatarKey: 'tiger', fallback: 'Tigre Valiente', key: 'collab.animals.tiger_brave' },
  { avatarKey: 'frog', fallback: 'Tortuga Sabia', key: 'collab.animals.turtle_wise' },
  { avatarKey: 'owl', fallback: 'Tucán Colorido', key: 'collab.animals.toucan_colorful' },
  { avatarKey: 'fox', fallback: 'Zorro Astuto', key: 'collab.animals.fox_clever' },
];

export const ANONYMOUS_ANIMAL_NAMES: string[] = ANONYMOUS_ANIMAL_ITEMS.map((item) => t(item.key, item.fallback));

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

const STORAGE_KEY = 'boardpdf_collab_guest_identity';

export function getOrCreateGuestIdentity(): CollabGuestIdentity {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CollabGuestIdentity;
      if (parsed?.username && parsed?.avatarUrl && parsed?.isGuest) {
        if (parsed.animalKey) {
          const item = ANONYMOUS_ANIMAL_ITEMS.find((it) => it.key === parsed.animalKey);
          if (item) {
            parsed.username = t(item.key, item.fallback);
          }
        }
        return parsed;
      }
    }
  } catch {}

  const chosen = ANONYMOUS_ANIMAL_ITEMS[Math.floor(Math.random() * ANONYMOUS_ANIMAL_ITEMS.length)];
  const username = t(chosen.key, chosen.fallback);
  const avatarUrl = ANONYMOUS_ANIMAL_AVATARS[chosen.avatarKey] || ANONYMOUS_ANIMAL_AVATARS.panda;

  const identity: CollabGuestIdentity = {
    animalKey: chosen.key,
    avatarUrl,
    isGuest: true,
    userId: null,
    username,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {}

  return identity;
}
