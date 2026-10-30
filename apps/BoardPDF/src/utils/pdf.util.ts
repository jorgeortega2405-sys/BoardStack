import { logger } from '../services/logger.service.js';
import { spawnSync } from 'child_process';
import path from 'path';

let resolvedGsCommand: string | null = null;

export function isPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

export function sanitizePdfFilename(rawName?: string, defaultName = 'document.pdf'): string {
  if (!rawName || typeof rawName !== 'string') {
    return defaultName;
  }
  const base = path.basename(rawName).replace(/^[\.\/\\]+/, '').trim();
  const clean = base.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  if (!clean || clean === '.pdf' || clean === '.' || clean === '..') {
    return defaultName;
  }
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

export async function extractPdfText(buffer: Buffer): Promise<{ fullText: string; pages: string[] }> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageStrings = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter(Boolean);
      pages.push(pageStrings.join(' ').replace(/\s+/g, ' ').trim());
    }

    const fullText = pages.join('\n\n').trim();
    return { fullText, pages };
  } catch (err) {
    logger.app.warn('Error al extraer texto de documento PDF', { error: err });
    return { fullText: '', pages: [] };
  }
}

export function cleanTextForWinAnsi(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const str = text.replace(/\uFFFD/g, '');
  let result = '';
  for (const char of str) {
    const code = char.charCodeAt(0);
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      result += char;
    } else {
      const decomposed = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const d of decomposed) {
        const dCode = d.charCodeAt(0);
        if (dCode >= 0x20 && dCode <= 0x7e) {
          result += d;
        }
      }
    }
  }
  return result;
}

export function parseHexColor(hex?: string): { b: number; g: number; r: number } {
  if (!hex || typeof hex !== 'string' || hex === 'transparent' || hex === 'none') {
    return { b: 0, g: 0, r: 0 };
  }
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return {
      b: Number.isNaN(b) ? 0 : b,
      g: Number.isNaN(g) ? 0 : g,
      r: Number.isNaN(r) ? 0 : r,
    };
  }
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return {
      b: Number.isNaN(b) ? 0 : b,
      g: Number.isNaN(g) ? 0 : g,
      r: Number.isNaN(r) ? 0 : r,
    };
  }
  return { b: 0, g: 0, r: 0 };
}

export function getGhostscriptCommand(): string {
  if (resolvedGsCommand) return resolvedGsCommand;
  const candidates = process.platform === 'win32'
    ? ['gswin64c', 'gswin32c', 'gs']
    : ['gs'];
  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ['-version']);
      if (!res.error) {
        resolvedGsCommand = cmd;
        return cmd;
      }
    } catch {
      continue;
    }
  }
  resolvedGsCommand = 'gs';
  return resolvedGsCommand;
}
