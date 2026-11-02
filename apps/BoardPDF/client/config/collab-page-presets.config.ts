export interface PageDimension {
  height: number;
  width: number;
}

export interface PagePreset {
  category: 'custom' | 'document' | 'presentation' | 'social';
  defaultOrientation?: 'landscape' | 'portrait';
  description: string;
  height: number;
  icon: string;
  id: string;
  name: string;
  unitLabel: string;
  width: number;
}

export const COLLAB_PAGE_PRESETS: PagePreset[] = [
  {
    category: 'document',
    defaultOrientation: 'portrait',
    description: '210 × 297 mm',
    height: 1123,
    icon: 'description',
    id: 'a4',
    name: 'A4 Internacional',
    unitLabel: '210 × 297 mm',
    width: 794,
  },
  {
    category: 'document',
    defaultOrientation: 'portrait',
    description: '8.5 × 11 pulgadas',
    height: 1056,
    icon: 'description',
    id: 'letter',
    name: 'Carta (Letter)',
    unitLabel: '8.5 × 11 in',
    width: 816,
  },
  {
    category: 'document',
    defaultOrientation: 'portrait',
    description: '8.5 × 14 pulgadas',
    height: 1344,
    icon: 'description',
    id: 'legal',
    name: 'Oficio (Legal)',
    unitLabel: '8.5 × 14 in',
    width: 816,
  },
  {
    category: 'presentation',
    defaultOrientation: 'landscape',
    description: '1280 × 720 px (16:9)',
    height: 720,
    icon: 'slideshow',
    id: 'slides-16-9',
    name: 'Presentación 16:9',
    unitLabel: '1280 × 720 px',
    width: 1280,
  },
  {
    category: 'presentation',
    defaultOrientation: 'landscape',
    description: '1024 × 768 px (4:3)',
    height: 768,
    icon: 'slideshow',
    id: 'slides-4-3',
    name: 'Presentación 4:3',
    unitLabel: '1024 × 768 px',
    width: 1024,
  },
  {
    category: 'social',
    defaultOrientation: 'portrait',
    description: '1080 × 1080 px (1:1)',
    height: 1080,
    icon: 'crop_square',
    id: 'square',
    name: 'Cuadrado (1:1)',
    unitLabel: '1080 × 1080 px',
    width: 1080,
  },
  {
    category: 'social',
    defaultOrientation: 'portrait',
    description: '1080 × 1920 px (9:16)',
    height: 1920,
    icon: 'devices',
    id: 'story',
    name: 'Vertical Móvil (9:16)',
    unitLabel: '1080 × 1920 px',
    width: 1080,
  },
  {
    category: 'custom',
    defaultOrientation: 'portrait',
    description: 'Dimensiones libres',
    height: 800,
    icon: 'tune',
    id: 'custom',
    name: 'Personalizado',
    unitLabel: 'A medida',
    width: 800,
  },
];

export function mmToPx(mm: number): number {
  return Math.round(mm * (96 / 25.4));
}

export function inToPx(inches: number): number {
  return Math.round(inches * 96);
}

export function pxToMm(px: number): number {
  return Math.round((px * 25.4) / 96);
}

export function pxToIn(px: number): number {
  return parseFloat(((px) / 96).toFixed(2));
}
