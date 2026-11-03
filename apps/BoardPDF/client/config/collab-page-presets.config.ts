export interface PageDimension {
  height: number;
  width: number;
}

export interface PagePreset {
  category: 'document';
  defaultOrientation?: 'landscape' | 'portrait';
  description: string;
  height: number;
  icon: string;
  id: string;
  name: string;
  unitLabel: string;
  width: number;
}

export const COLLAB_DOCUMENT_DEFAULT_SIZE: PageDimension = {
  height: 1123,
  width: 794,
};

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
