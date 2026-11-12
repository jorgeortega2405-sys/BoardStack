import fontkit from '@pdf-lib/fontkit';
import { logger } from '../services/logger.service.js';
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';

interface ResolvedPdfFont {
  font: PDFFont;
  isCustomEmbedded: boolean;
}

const MAX_FONT_CACHE_SIZE = 40;
const registeredFontkitDocs = new WeakSet<PDFDocument>();
const googleFontBufferCache = new Map<string, Buffer>();

const STANDARD_FONT_FAMILY_ALIASES: Record<string, 'courier' | 'helvetica' | 'times'> = {
  arial: 'helvetica',
  'arial / helvetica': 'helvetica',
  courier: 'courier',
  helvetica: 'helvetica',
  'helvetica-bold': 'helvetica',
  'times-roman': 'times',
  'times new roman': 'times',
};

function isStandardFontFamily(family?: string): boolean {
  if (!family) return true;
  return Boolean(STANDARD_FONT_FAMILY_ALIASES[family.trim().toLowerCase()]);
}

function resolveStandardFontEnum(
  family?: string,
  weight = 400,
  style: 'normal' | 'italic' = 'normal'
): StandardFonts {
  const normalized = (family || 'Helvetica').trim().toLowerCase();
  const base = STANDARD_FONT_FAMILY_ALIASES[normalized] || 'helvetica';
  const isBold = normalized === 'helvetica-bold' || weight >= 600;
  const isItalic = style === 'italic';

  if (base === 'times') {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }

  if (base === 'courier') {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }

  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

function isSupportedFontBinary(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const isTtf = buffer[0] === 0x00 && buffer[1] === 0x01 && buffer[2] === 0x00 && buffer[3] === 0x00;
  const headerAscii = buffer.subarray(0, 4).toString('ascii');
  return isTtf || headerAscii === 'OTTO' || headerAscii === 'true' || headerAscii === 'ttcf';
}

function extractPreferredFontUrl(cssText: string): string | null {
  const latinMarker = '/* latin */';
  const latinIndex = cssText.lastIndexOf(latinMarker);
  const searchSlice = latinIndex >= 0 ? cssText.slice(latinIndex) : cssText;
  const urlMatches = Array.from(searchSlice.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(?:ttf|otf))\)/gi));
  if (urlMatches.length > 0) {
    return urlMatches[0][1];
  }
  const allMatches = Array.from(cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(?:ttf|otf))\)/gi));
  if (allMatches.length > 0) {
    return allMatches[allMatches.length - 1][1];
  }
  return null;
}

async function fetchGoogleFontBuffer(
  family: string,
  weight = 400,
  style: 'normal' | 'italic' = 'normal'
): Promise<Buffer | null> {
  const cleanFamily = family.trim();
  const normalizedWeight = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  const italicFlag = style === 'italic' ? 1 : 0;
  const cacheKey = `${cleanFamily.toLowerCase()}__${italicFlag}__${normalizedWeight}`;

  const cached = googleFontBufferCache.get(cacheKey);
  if (cached) return cached;

  const encodedFamily = encodeURIComponent(cleanFamily).replace(/%20/g, '+');
  const cssCandidates = [
    `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@${italicFlag},${normalizedWeight}`,
    `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${normalizedWeight}`,
    `https://fonts.googleapis.com/css2?family=${encodedFamily}`,
  ];

  const headers = {
    'User-Agent': 'okhttp/4.9.3',
  };

  let fontBinaryUrl: string | null = null;
  for (const cssUrl of cssCandidates) {
    try {
      const res = await fetch(cssUrl, { headers, signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const cssText = await res.text();
      fontBinaryUrl = extractPreferredFontUrl(cssText);
      if (fontBinaryUrl) break;
    } catch {
      continue;
    }
  }

  if (!fontBinaryUrl) return null;

  try {
    const fontRes = await fetch(fontBinaryUrl, { signal: AbortSignal.timeout(8000) });
    if (!fontRes.ok) return null;
    const arrayBuffer = await fontRes.arrayBuffer();
    const fontBuffer = Buffer.from(arrayBuffer);
    if (!isSupportedFontBinary(fontBuffer)) return null;

    if (googleFontBufferCache.size >= MAX_FONT_CACHE_SIZE) {
      const oldestKey = googleFontBufferCache.keys().next().value;
      if (oldestKey) {
        googleFontBufferCache.delete(oldestKey);
      }
    }
    googleFontBufferCache.set(cacheKey, fontBuffer);
    return fontBuffer;
  } catch (err) {
    logger.app.warn('Error downloading Google Font binary for PDF embedding', { err, family: cleanFamily });
    return null;
  }
}

async function resolvePdfFont(
  pdfDoc: PDFDocument,
  fontFamily?: string,
  fontWeight = 400,
  fontStyle: 'normal' | 'italic' = 'normal'
): Promise<ResolvedPdfFont> {
  if (!isStandardFontFamily(fontFamily)) {
    try {
      const customBuffer = await fetchGoogleFontBuffer(fontFamily!, fontWeight, fontStyle);
      if (customBuffer) {
        if (!registeredFontkitDocs.has(pdfDoc)) {
          pdfDoc.registerFontkit(fontkit as any);
          registeredFontkitDocs.add(pdfDoc);
        }
        const font = await pdfDoc.embedFont(new Uint8Array(customBuffer), { subset: true });
        return { font, isCustomEmbedded: true };
      }
    } catch (err) {
      logger.app.warn('Failed to embed custom Google Font in PDF, falling back to Helvetica', {
        err,
        fontFamily,
        fontStyle,
        fontWeight,
      });
    }
  }

  const standardFont = resolveStandardFontEnum(fontFamily, fontWeight, fontStyle);
  const font = await pdfDoc.embedFont(standardFont);
  return { font, isCustomEmbedded: false };
}

export { resolvePdfFont };
export type { ResolvedPdfFont };
