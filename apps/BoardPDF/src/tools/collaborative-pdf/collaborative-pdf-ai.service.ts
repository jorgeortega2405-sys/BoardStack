import { config } from '../../config/env.config.js';
import { logger } from '../../services/logger.service.js';
import { ChartType, CollaborativeDocumentContent, CollaborativeElement, CollaborativeElementChart, CollaborativeElementShape, CollaborativeElementTable, CollaborativeElementTableCell, CollaborativeElementText } from './collaborative-pdf.types.js';
import crypto from 'crypto';

type AiPaletteKey = 'amber' | 'blue' | 'emerald' | 'gray' | 'purple' | 'red';

interface AiCalloutCard {
  color?: string;
  text: string;
  title?: string;
}

interface AiBlueprintSection {
  align?: 'center' | 'justify' | 'left' | 'right';
  cards?: AiCalloutCard[];
  chartType?: ChartType;
  color?: string;
  colorScheme?: AiPaletteKey;
  headers?: string[];
  items?: string[];
  labels?: string[];
  level?: 1 | 2;
  percentageValue?: number;
  rows?: string[][];
  series?: Array<{ name: string; values: number[] }>;
  subtitle?: string;
  tableStyle?: 'cards' | 'grid' | 'header-accent';
  text?: string;
  title?: string;
  type:
    | 'bullet_list'
    | 'callout_row'
    | 'chart'
    | 'cover_header'
    | 'divider'
    | 'heading'
    | 'numbered_list'
    | 'page_break'
    | 'paragraph'
    | 'sticky_note'
    | 'subheading'
    | 'table';
}

interface AiDocumentBlueprint {
  palette?: {
    accent?: string;
    primary?: string;
    scheme?: AiPaletteKey;
    tint?: string;
  };
  sections: AiBlueprintSection[];
  title: string;
}

interface CompileBlueprintOptions {
  authorName?: string;
  defaultPageSize?: { height: number; width: number };
  existingContent?: CollaborativeDocumentContent | null;
  mode?: 'append' | 'replace';
}

interface CompiledDocumentResult {
  addedCount: number;
  content: CollaborativeDocumentContent;
  generatedPageCount: number;
  title: string;
}

type GeminiFetchFn = (url: string, init: RequestInit) => Promise<{
  json: () => Promise<any>;
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

interface GenerateDocWithAiParams {
  authorName?: string;
  currentContent?: CollaborativeDocumentContent | null;
  currentTitle?: string;
  geminiFetcher?: GeminiFetchFn;
  mode?: 'append' | 'replace';
  prompt: string;
}

interface GenerateDocWithAiResult {
  addedCount: number;
  blueprint: AiDocumentBlueprint;
  content: CollaborativeDocumentContent;
  geminiTokens: number;
  generatedPageCount: number;
  model: string;
  pageCount: number;
  title: string;
}

const SCHEME_PALETTES: Record<AiPaletteKey, { accent: string; chart: string[]; primary: string; tint: string }> = {
  amber: { accent: '#d97706', chart: ['#d97706', '#f59e0b', '#fbbf24', '#fde68a'], primary: '#b45309', tint: '#fef3c7' },
  blue: { accent: '#2563eb', chart: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'], primary: '#1e3a8a', tint: '#dbeafe' },
  emerald: { accent: '#059669', chart: ['#059669', '#10b981', '#34d399', '#a7f3d0'], primary: '#065f46', tint: '#d1fae5' },
  gray: { accent: '#475569', chart: ['#374151', '#4b5563', '#9ca3af', '#cbd5e1'], primary: '#1e293b', tint: '#f1f5f9' },
  purple: { accent: '#7c3aed', chart: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'], primary: '#5b21b6', tint: '#ede9fe' },
  red: { accent: '#dc2626', chart: ['#dc2626', '#ef4444', '#f87171', '#fecaca'], primary: '#991b1b', tint: '#fee2e2' },
};

const STICKY_NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];

const SUPPORTED_CHART_TYPES = new Set<ChartType>([
  'bar-grouped',
  'bar-horizontal',
  'bar-stacked',
  'bar-vertical',
  'donut',
  'line',
  'line-multi',
  'pie',
  'progress-bar',
  'progress-ring',
]);

function nextId(prefix: string): string {
  return `ai_${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function resolvePalette(palette?: AiDocumentBlueprint['palette']) {
  const schemeKey: AiPaletteKey = palette?.scheme && SCHEME_PALETTES[palette.scheme] ? palette.scheme : 'blue';
  const base = SCHEME_PALETTES[schemeKey];
  return {
    accent: normalizeHexColor(palette?.accent, base.accent),
    chart: base.chart,
    primary: normalizeHexColor(palette?.primary, base.primary),
    scheme: schemeKey,
    tint: normalizeHexColor(palette?.tint, base.tint),
  };
}

function estimateWrappedLines(
  text: string,
  maxWidthPx: number,
  fontSize: number,
  isBold = false,
  isUppercase = false
): string[] {
  const safeWidth = Math.max(80, maxWidthPx);
  const avgFactor = isUppercase ? (isBold ? 0.68 : 0.62) : (isBold ? 0.58 : 0.53);
  const charWidth = Math.max(4, fontSize * avgFactor);
  const maxCharsPerLine = Math.max(10, Math.floor(safeWidth / charWidth));

  const paragraphs = String(text || '').replace(/\r/g, '').split('\n');
  const wrapped: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      wrapped.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        if (word.length > maxCharsPerLine) {
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            wrapped.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        } else {
          currentLine = word;
        }
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine = `${currentLine} ${word}`;
      } else {
        wrapped.push(currentLine);
        if (word.length > maxCharsPerLine) {
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            wrapped.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      wrapped.push(currentLine);
    }
  }

  return wrapped.length > 0 ? wrapped : [''];
}

function computeElementBottom(el: CollaborativeElement): number {
  if (el.type === 'drawing') {
    let maxY = 0;
    for (const pt of el.points || []) {
      if (pt.y > maxY) maxY = pt.y;
    }
    return maxY;
  }
  const y = Number(el.y) || 0;
  const h = Number(el.height) || (el.type === 'text' ? (el.fontSize || 16) * 2 : 60);
  return y + h;
}

function compileAiBlueprintToDocument(
  blueprint: AiDocumentBlueprint,
  options: CompileBlueprintOptions = {}
): CompiledDocumentResult {
  const mode = options.mode === 'append' ? 'append' : 'replace';
  const existing = options.existingContent;
  const basePageSize = options.defaultPageSize || existing?.pageSize || { height: 1123, width: 794 };
  const pageW = Math.max(360, Number(basePageSize.width) || 794);
  const pageH = Math.max(480, Number(basePageSize.height) || 1123);

  const marginX = Math.round(Math.min(56, pageW * 0.072));
  const marginTop = 52;
  const marginBottom = 56;
  const contentWidth = Math.max(240, pageW - marginX * 2);
  const maxContentY = pageH - marginBottom;

  const elements: CollaborativeElement[] = [];
  const pageBackgrounds: string[] = [];
  const pagePdfSources: Array<{ pageNumber: number; pdfUrl: string } | null> = [];
  const pageSizes: Array<{ height: number; width: number }> = [];
  const pageTitles: string[] = [];

  let currentPageIndex = 0;
  let cursorY = marginTop;
  let startGeneratedPageIndex = 0;

  if (mode === 'append' && existing) {
    const existingPages = Math.max(1, existing.pageCount || 1);
    for (const el of existing.elements || []) {
      elements.push(JSON.parse(JSON.stringify(el)));
    }
    for (let i = 0; i < existingPages; i++) {
      pageBackgrounds.push(existing.pageBackgrounds?.[i] || '#ffffff');
      pagePdfSources.push(existing.pagePdfSources?.[i] || null);
      pageSizes.push(existing.pageSizes?.[i] ? { ...existing.pageSizes[i] } : { height: pageH, width: pageW });
      pageTitles.push(existing.pageTitles?.[i] || '');
    }

    const lastIdx = existingPages - 1;
    const lastPageElements = elements.filter((el) => (el.pageIndex ?? 0) === lastIdx);
    let maxExistingY = 0;
    for (const el of lastPageElements) {
      const bottom = computeElementBottom(el);
      if (bottom > maxExistingY) maxExistingY = bottom;
    }

    if (lastPageElements.length === 0) {
      currentPageIndex = lastIdx;
      cursorY = marginTop;
      startGeneratedPageIndex = lastIdx;
    } else if (maxExistingY < pageH * 0.52) {
      currentPageIndex = lastIdx;
      cursorY = Math.max(marginTop, Math.round(maxExistingY + 26));
      startGeneratedPageIndex = lastIdx;
    } else {
      currentPageIndex = existingPages;
      cursorY = marginTop;
      pageBackgrounds.push('#ffffff');
      pagePdfSources.push(null);
      pageSizes.push({ height: pageH, width: pageW });
      pageTitles.push('');
      startGeneratedPageIndex = existingPages;
    }
  } else {
    pageBackgrounds.push('#ffffff');
    pagePdfSources.push(null);
    pageSizes.push({ height: pageH, width: pageW });
    pageTitles.push('');
  }

  const palette = resolvePalette(blueprint.palette);
  const authorName = (options.authorName || 'BoardPDF AI').trim();
  const initialElementCount = elements.length;

  const ensureCurrentPageMeta = (preferredTitle?: string) => {
    while (pageSizes.length <= currentPageIndex) {
      pageBackgrounds.push('#ffffff');
      pagePdfSources.push(null);
      pageSizes.push({ height: pageH, width: pageW });
      pageTitles.push('');
    }
    if (preferredTitle && !pageTitles[currentPageIndex]) {
      pageTitles[currentPageIndex] = preferredTitle.slice(0, 80);
    }
  };

  const advanceToNextPage = (preferredTitle?: string) => {
    currentPageIndex += 1;
    cursorY = marginTop;
    ensureCurrentPageMeta(preferredTitle);
  };

  const ensureVerticalSpace = (requiredHeight: number, forceIfCurrentHasContent = true): boolean => {
    if (cursorY + requiredHeight <= maxContentY) {
      return false;
    }
    if (forceIfCurrentHasContent || cursorY > marginTop + 8) {
      advanceToNextPage();
      return true;
    }
    return false;
  };

  const pushGeneratedElement = (el: CollaborativeElement) => {
    ensureCurrentPageMeta();
    elements.push(el);
  };

  const emitWrappedTextBlock = (params: {
    align?: 'center' | 'justify' | 'left' | 'right';
    color?: string;
    fontSize: number;
    gapAfter: number;
    isBold?: boolean;
    lineHeight: number;
    listType?: 'bullet' | 'none' | 'numbered';
    lines: string[];
    width: number;
    x: number;
  }) => {
    const linePx = Math.max(12, params.fontSize * params.lineHeight);
    let idx = 0;

    while (idx < params.lines.length) {
      let availH = maxContentY - cursorY;
      if (availH < linePx * 2 + 10) {
        advanceToNextPage();
        availH = maxContentY - cursorY;
      }

      const maxLinesHere = Math.max(1, Math.floor((availH - 8) / linePx));
      const chunk = params.lines.slice(idx, idx + maxLinesHere);
      const chunkText = chunk.join('\n').trimEnd();

      if (chunkText.length > 0) {
        const blockHeight = Math.ceil(chunk.length * linePx + 10);
        const textEl: CollaborativeElementText = {
          align: params.align || 'left',
          color: params.color || '#1e293b',
          fontFamily: 'Inter',
          fontSize: params.fontSize,
          height: blockHeight,
          id: nextId('txt'),
          isBold: !!params.isBold,
          lineHeight: params.lineHeight,
          listType: params.listType || 'none',
          pageIndex: currentPageIndex,
          rotation: 0,
          text: chunkText,
          type: 'text',
          width: params.width,
          x: params.x,
          y: Math.round(cursorY),
        };
        pushGeneratedElement(textEl);
        cursorY += blockHeight + (idx + maxLinesHere >= params.lines.length ? params.gapAfter : 10);
      }

      idx += maxLinesHere;
      if (idx < params.lines.length) {
        advanceToNextPage();
      }
    }
  };

  const sections = Array.isArray(blueprint.sections) ? blueprint.sections : [];

  for (const section of sections) {
    if (!section || !section.type) continue;

    if (section.type === 'page_break') {
      if (cursorY > marginTop + 8) {
        advanceToNextPage(section.title);
      }
      continue;
    }

    if (section.type === 'cover_header') {
      const titleText = String(section.title || blueprint.title || '').trim();
      const subtitleText = String(section.subtitle || '').trim();
      const titleFontSize = 24;
      const subtitleFontSize = 13;
      const innerWidth = contentWidth - 48;
      const titleLines = estimateWrappedLines(titleText || 'Documento generado con IA', innerWidth, titleFontSize, true);
      const subtitleLines = subtitleText ? estimateWrappedLines(subtitleText, innerWidth, subtitleFontSize, false) : [];
      const titleH = Math.ceil(titleLines.length * (titleFontSize * 1.25) + 6);
      const subtitleH = subtitleLines.length > 0 ? Math.ceil(subtitleLines.length * (subtitleFontSize * 1.38) + 6) : 0;
      const bannerHeight = Math.max(104, 24 + titleH + (subtitleH > 0 ? 8 + subtitleH : 0) + 22);

      ensureVerticalSpace(bannerHeight + 18);
      ensureCurrentPageMeta(titleText);

      const bannerColor = normalizeHexColor(section.color, palette.primary);
      const bannerShape: CollaborativeElementShape = {
        borderRadius: 12,
        fillColor: bannerColor,
        height: bannerHeight,
        id: nextId('banner'),
        pageIndex: currentPageIndex,
        rotation: 0,
        shapeType: 'rounded-rect',
        strokeColor: 'transparent',
        strokeStyle: 'none',
        strokeWidth: 0,
        type: 'shape',
        width: contentWidth,
        x: marginX,
        y: Math.round(cursorY),
      };
      pushGeneratedElement(bannerShape);

      const bannerTitleEl: CollaborativeElementText = {
        align: 'left',
        color: '#ffffff',
        fontFamily: 'Inter',
        fontSize: titleFontSize,
        height: titleH,
        id: nextId('hdrtitle'),
        isBold: true,
        lineHeight: 1.25,
        pageIndex: currentPageIndex,
        rotation: 0,
        text: titleLines.join('\n'),
        type: 'text',
        width: innerWidth,
        x: marginX + 24,
        y: Math.round(cursorY + 22),
      };
      pushGeneratedElement(bannerTitleEl);

      if (subtitleLines.length > 0) {
        const bannerSubEl: CollaborativeElementText = {
          align: 'left',
          color: '#e2e8f0',
          fontFamily: 'Inter',
          fontSize: subtitleFontSize,
          height: subtitleH,
          id: nextId('hdrsub'),
          isBold: false,
          lineHeight: 1.38,
          pageIndex: currentPageIndex,
          rotation: 0,
          text: subtitleLines.join('\n'),
          type: 'text',
          width: innerWidth,
          x: marginX + 24,
          y: Math.round(cursorY + 22 + titleH + 6),
        };
        pushGeneratedElement(bannerSubEl);
      }

      cursorY += bannerHeight + 22;
      continue;
    }

    if (section.type === 'heading' || section.type === 'subheading') {
      const headingText = String(section.text || section.title || '').trim();
      if (!headingText) continue;

      const isSub = section.type === 'subheading' || section.level === 2;
      const fontSize = isSub ? 16 : 20;
      const lineHeight = 1.28;
      const lines = estimateWrappedLines(headingText, contentWidth, fontSize, true);
      const headingHeight = Math.ceil(lines.length * fontSize * lineHeight + 8);
      const accentHeight = isSub ? 0 : 3;
      const orphanSafeReserve = headingHeight + accentHeight + 68;

      ensureVerticalSpace(orphanSafeReserve);
      if (!isSub) {
        ensureCurrentPageMeta(headingText);
      }

      const headingEl: CollaborativeElementText = {
        align: section.align || 'left',
        color: isSub ? '#1e293b' : palette.primary,
        fontFamily: 'Inter',
        fontSize,
        height: headingHeight,
        id: nextId('hdg'),
        isBold: true,
        lineHeight,
        pageIndex: currentPageIndex,
        rotation: 0,
        text: lines.join('\n'),
        type: 'text',
        width: contentWidth,
        x: marginX,
        y: Math.round(cursorY),
      };
      pushGeneratedElement(headingEl);
      cursorY += headingHeight + (isSub ? 8 : 6);

      if (!isSub) {
        const barEl: CollaborativeElementShape = {
          borderRadius: 2,
          fillColor: palette.accent,
          height: 3,
          id: nextId('hbar'),
          pageIndex: currentPageIndex,
          rotation: 0,
          shapeType: 'rect',
          strokeColor: 'transparent',
          strokeStyle: 'none',
          strokeWidth: 0,
          type: 'shape',
          width: Math.min(180, Math.round(contentWidth * 0.28)),
          x: marginX,
          y: Math.round(cursorY),
        };
        pushGeneratedElement(barEl);
        cursorY += 14;
      }
      continue;
    }

    if (section.type === 'paragraph') {
      const rawText = String(section.text || '').trim();
      if (!rawText) continue;
      const fontSize = 13;
      const lineHeight = 1.48;
      const lines = estimateWrappedLines(rawText, contentWidth, fontSize, false);
      emitWrappedTextBlock({
        align: section.align || 'left',
        color: '#334155',
        fontSize,
        gapAfter: 14,
        isBold: false,
        lineHeight,
        lines,
        listType: 'none',
        width: contentWidth,
        x: marginX,
      });
      continue;
    }

    if (section.type === 'bullet_list' || section.type === 'numbered_list') {
      const rawItems = Array.isArray(section.items) && section.items.length > 0
        ? section.items
        : String(section.text || '').split('\n').filter((s) => s.trim().length > 0);
      if (rawItems.length === 0) continue;

      const isNumbered = section.type === 'numbered_list';
      const fontSize = 13;
      const lineHeight = 1.48;
      const prefixedLines: string[] = [];

      rawItems.forEach((item, index) => {
        const cleaned = String(item || '').replace(/^([•\-\*]|\d+[\.\)])\s*/, '').trim();
        if (!cleaned) return;
        const prefix = isNumbered ? `${index + 1}. ` : '• ';
        const wrappedItem = estimateWrappedLines(`${prefix}${cleaned}`, contentWidth - 16, fontSize, false);
        prefixedLines.push(...wrappedItem);
      });

      if (prefixedLines.length > 0) {
        emitWrappedTextBlock({
          align: 'left',
          color: '#334155',
          fontSize,
          gapAfter: 14,
          isBold: false,
          lineHeight,
          lines: prefixedLines,
          listType: isNumbered ? 'numbered' : 'bullet',
          width: contentWidth - 16,
          x: marginX + 12,
        });
      }
      continue;
    }

    if (section.type === 'sticky_note') {
      const bodyText = [section.title, section.text].filter((s) => typeof s === 'string' && s.trim().length > 0).join('\n\n').trim();
      if (!bodyText) continue;
      const cardW = Math.min(280, Math.round(contentWidth * 0.45));
      const lines = estimateWrappedLines(bodyText, cardW - 28, 14, false);
      const cardH = Math.max(150, Math.min(280, Math.ceil(lines.length * 20 + 62)));

      ensureVerticalSpace(cardH + 16);

      const stickyEl: CollaborativeElementText = {
        authorName,
        backgroundColor: normalizeHexColor(section.color, STICKY_NOTE_COLORS[0]),
        color: '#1e293b',
        fontFamily: 'Inter',
        fontSize: 14,
        height: cardH,
        id: nextId('sticky'),
        isStickyNote: true,
        lineHeight: 1.4,
        pageIndex: currentPageIndex,
        rotation: 0,
        text: bodyText,
        type: 'text',
        width: cardW,
        x: marginX,
        y: Math.round(cursorY),
      };
      pushGeneratedElement(stickyEl);
      cursorY += cardH + 16;
      continue;
    }

    if (section.type === 'callout_row') {
      const cards = Array.isArray(section.cards) ? section.cards.slice(0, 3) : [];
      if (cards.length === 0) continue;

      const gap = 16;
      const cardCount = cards.length;
      const cardW = Math.floor((contentWidth - gap * (cardCount - 1)) / cardCount);
      const cardHeights = cards.map((card) => {
        const combined = [card.title, card.text].filter((s) => typeof s === 'string' && s.trim().length > 0).join('\n').trim();
        const wrapped = estimateWrappedLines(combined, cardW - 28, 13, false);
        return Math.max(136, Math.min(260, Math.ceil(wrapped.length * 19 + 54)));
      });
      const rowHeight = Math.max(...cardHeights);

      ensureVerticalSpace(rowHeight + 18);

      cards.forEach((card, idx) => {
        const combined = [card.title, card.text].filter((s) => typeof s === 'string' && s.trim().length > 0).join('\n\n').trim();
        const stickyCard: CollaborativeElementText = {
          authorName,
          backgroundColor: normalizeHexColor(card.color, STICKY_NOTE_COLORS[idx % STICKY_NOTE_COLORS.length]),
          color: '#1e293b',
          fontFamily: 'Inter',
          fontSize: 13,
          height: rowHeight,
          id: nextId('card'),
          isStickyNote: true,
          lineHeight: 1.38,
          pageIndex: currentPageIndex,
          rotation: 0,
          text: combined,
          type: 'text',
          width: cardW,
          x: Math.round(marginX + idx * (cardW + gap)),
          y: Math.round(cursorY),
        };
        pushGeneratedElement(stickyCard);
      });

      cursorY += rowHeight + 18;
      continue;
    }

    if (section.type === 'table') {
      const rawHeaders = Array.isArray(section.headers) ? section.headers.map((h) => String(h || '').trim()) : [];
      const rawRows = Array.isArray(section.rows) ? section.rows : [];
      const cols = Math.max(2, Math.min(6, rawHeaders.length || rawRows[0]?.length || 2));
      const headers = Array.from({ length: cols }, (_, c) => rawHeaders[c] || `Columna ${c + 1}`);
      const bodyRows = rawRows.map((row) => Array.from({ length: cols }, (_, c) => String(row?.[c] ?? '').trim()));

      if (bodyRows.length === 0 && rawHeaders.length === 0) continue;

      const style: 'cards' | 'grid' | 'header-accent' =
        section.tableStyle === 'cards' || section.tableStyle === 'grid' || section.tableStyle === 'header-accent'
          ? section.tableStyle
          : 'header-accent';

      const cellSpacing = style === 'cards' ? 6 : 0;
      const cellPadding = 8;
      const borderWidth = style === 'cards' ? 0 : 1;
      const borderColor = style === 'cards' ? 'transparent' : '#cbd5e1';
      const headerColor = style === 'grid' ? 'transparent' : palette.primary;
      const colW = (contentWidth - cellSpacing * (cols + 1)) / cols;

      const measureRowHeight = (cellsText: string[], isHeader: boolean): number => {
        let maxLines = 1;
        for (const txt of cellsText) {
          const wrapped = estimateWrappedLines(txt, colW - cellPadding * 2, 12, isHeader);
          if (wrapped.length > maxLines) maxLines = wrapped.length;
        }
        return Math.max(isHeader ? 40 : 34, maxLines * 17 + cellPadding * 2 + 4);
      };

      const headerHeight = measureRowHeight(headers, true);
      const measuredBodyHeights = bodyRows.map((row) => measureRowHeight(row, false));

      let rowCursor = 0;
      const totalBodyRows = bodyRows.length;

      do {
        const minFirstChunkH = headerHeight + (measuredBodyHeights[rowCursor] || 36) + cellSpacing * 3;
        ensureVerticalSpace(minFirstChunkH);

        const availableH = maxContentY - cursorY;
        const chunkRowIndices: number[] = [];
        let accHeight = headerHeight + cellSpacing * 2;

        while (rowCursor < totalBodyRows) {
          const rH = measuredBodyHeights[rowCursor];
          if (chunkRowIndices.length > 0 && accHeight + rH + cellSpacing > availableH) {
            break;
          }
          accHeight += rH + cellSpacing;
          chunkRowIndices.push(rowCursor);
          rowCursor += 1;
        }

        const chunkRowHeights = [headerHeight, ...chunkRowIndices.map((idx) => measuredBodyHeights[idx])];
        const totalRows = chunkRowHeights.length;
        const tableHeight = chunkRowHeights.reduce((sum, h) => sum + h, 0) + (totalRows + 1) * cellSpacing;

        const cells: CollaborativeElementTableCell[][] = [];
        cells.push(
          headers.map((hText) => ({
            align: 'left',
            backgroundColor: style === 'grid' ? '#f8fafc' : palette.primary,
            color: style === 'grid' ? '#0f172a' : '#ffffff',
            isBold: true,
            text: hText,
          }))
        );

        chunkRowIndices.forEach((origRowIdx, localIdx) => {
          const rowValues = bodyRows[origRowIdx];
          const zebraBg = style === 'cards' ? palette.tint : (localIdx % 2 === 1 ? '#f8fafc' : '#ffffff');
          cells.push(
            rowValues.map((val) => ({
              align: 'left',
              backgroundColor: zebraBg,
              color: '#334155',
              isBold: false,
              text: val,
            }))
          );
        });

        const tableEl: CollaborativeElementTable = {
          borderColor,
          borderWidth,
          cellPadding,
          cellSpacing,
          cells,
          cols,
          headerColor,
          height: tableHeight,
          id: nextId('tbl'),
          pageIndex: currentPageIndex,
          rotation: 0,
          rowHeights: chunkRowHeights,
          rows: totalRows,
          tableStyle: style,
          themeColor: palette.accent,
          type: 'table',
          width: contentWidth,
          x: marginX,
          y: Math.round(cursorY),
        };
        pushGeneratedElement(tableEl);
        cursorY += tableHeight + 18;

        if (rowCursor < totalBodyRows) {
          advanceToNextPage();
        }
      } while (rowCursor < totalBodyRows);

      continue;
    }

    if (section.type === 'chart') {
      const requestedType = section.chartType && SUPPORTED_CHART_TYPES.has(section.chartType)
        ? section.chartType
        : 'bar-vertical';
      const labels = Array.isArray(section.labels) && section.labels.length > 0
        ? section.labels.slice(0, 8).map((l) => String(l || '').trim() || 'Item')
        : ['Q1', 'Q2', 'Q3', 'Q4'];
      const scheme: AiPaletteKey = section.colorScheme && SCHEME_PALETTES[section.colorScheme] ? section.colorScheme : palette.scheme;
      const chartPalette = SCHEME_PALETTES[scheme].chart;

      const rawSeries = Array.isArray(section.series) && section.series.length > 0
        ? section.series
        : [{ name: section.title || 'Serie', values: labels.map((_, i) => (i + 1) * 20) }];

      const normalizedSeries = rawSeries.slice(0, 3).map((s, idx) => ({
        color: chartPalette[idx % chartPalette.length],
        name: String(s?.name || `Serie ${idx + 1}`).trim(),
        values: labels.map((_, valIdx) => {
          const v = Number(s?.values?.[valIdx]);
          return Number.isFinite(v) ? v : 0;
        }),
      }));

      const isProgress = requestedType === 'progress-bar' || requestedType === 'progress-ring';
      const chartWidth = isProgress ? Math.min(360, contentWidth) : Math.min(540, contentWidth);
      const chartHeight = isProgress ? 200 : 270;
      const chartX = Math.round(marginX + (contentWidth - chartWidth) / 2);

      ensureVerticalSpace(chartHeight + 20);

      const chartEl: CollaborativeElementChart = {
        chartType: requestedType,
        height: chartHeight,
        id: nextId('chart'),
        labels,
        options: {
          colorPalette: chartPalette,
          colorScheme: scheme,
          percentageValue: typeof section.percentageValue === 'number' ? Math.max(0, Math.min(100, section.percentageValue)) : 75,
          showDataLabels: true,
          showGridLines: !isProgress,
          showLegend: !isProgress,
          showXLabels: true,
          showYLabels: true,
          subtitle: section.subtitle ? String(section.subtitle).trim() : undefined,
          title: section.title ? String(section.title).trim() : undefined,
        },
        pageIndex: currentPageIndex,
        rotation: 0,
        series: normalizedSeries,
        type: 'chart',
        width: chartWidth,
        x: chartX,
        y: Math.round(cursorY),
      };
      pushGeneratedElement(chartEl);
      cursorY += chartHeight + 20;
      continue;
    }

    if (section.type === 'divider') {
      ensureVerticalSpace(18);
      const dividerEl: CollaborativeElementShape = {
        borderRadius: 1,
        fillColor: '#e2e8f0',
        height: 2,
        id: nextId('div'),
        pageIndex: currentPageIndex,
        rotation: 0,
        shapeType: 'rect',
        strokeColor: 'transparent',
        strokeStyle: 'none',
        strokeWidth: 0,
        type: 'shape',
        width: contentWidth,
        x: marginX,
        y: Math.round(cursorY + 4),
      };
      pushGeneratedElement(dividerEl);
      cursorY += 18;
    }
  }

  const finalTitle = String(blueprint.title || '').trim() || 'Documento generado con IA';
  const totalPages = Math.max(1, pageSizes.length);
  const generatedPageCount = mode === 'append'
    ? Math.max(1, totalPages - startGeneratedPageIndex)
    : totalPages;

  return {
    addedCount: elements.length - initialElementCount,
    content: {
      elements,
      pageBackgrounds,
      pageCount: totalPages,
      pagePdfSources,
      pageSize: { height: pageH, width: pageW },
      pageSizes,
      pageTitles,
    },
    generatedPageCount,
    title: finalTitle,
  };
}

function extractJsonFromGeminiText(rawText: string): AiDocumentBlueprint {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: any = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    } else {
      throw new Error('INVALID_GEMINI_JSON');
    }
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections)) {
    throw new Error('INVALID_GEMINI_BLUEPRINT');
  }

  return {
    palette: parsed.palette && typeof parsed.palette === 'object' ? parsed.palette : undefined,
    sections: parsed.sections,
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Documento generado con IA',
  };
}

async function callGeminiBlueprintApi(params: {
  currentSummary: string;
  fetcher: GeminiFetchFn;
  mode: 'append' | 'replace';
  modelName: string;
  prompt: string;
  apiKey: string;
}): Promise<{ blueprint: AiDocumentBlueprint; geminiTokens: number }> {
  const systemInstruction = `You are a senior document designer inside BoardPDF. Generate a complete, well-structured, realistic document blueprint as strict JSON ONLY (no markdown, no explanation) matching the language requested by the user's prompt.

Output JSON schema:
{
  "title": "Short document title",
  "palette": {
    "scheme": "blue" | "emerald" | "purple" | "amber" | "red" | "gray",
    "primary": "#1e3a8a",
    "accent": "#2563eb",
    "tint": "#dbeafe"
  },
  "sections": [
    { "type": "cover_header", "title": "...", "subtitle": "..." },
    { "type": "heading", "text": "..." },
    { "type": "subheading", "text": "..." },
    { "type": "paragraph", "text": "..." },
    { "type": "bullet_list", "items": ["...", "..."] },
    { "type": "numbered_list", "items": ["...", "..."] },
    { "type": "callout_row", "cards": [{ "title": "...", "text": "..." }, { "title": "...", "text": "..." }] },
    { "type": "sticky_note", "title": "...", "text": "..." },
    { "type": "table", "tableStyle": "header-accent" | "cards" | "grid", "headers": ["..."], "rows": [["..."]] },
    { "type": "chart", "chartType": "bar-vertical" | "bar-horizontal" | "bar-grouped" | "pie" | "donut" | "line", "title": "...", "labels": ["..."], "series": [{ "name": "...", "values": [10, 20] }] },
    { "type": "divider" },
    { "type": "page_break" }
  ]
}

Design guidelines:
- Start with cover_header when creating a fresh document (mode="replace"), or start directly with the next logical section when mode="append".
- Use tables whenever comparative, financial, schedule, KPI, pricing, or tabular data fits naturally (keep 2-5 concise columns so cells stay readable).
- Use charts only when quantitative metrics or trends enrich the document.
- Use callout_row (2-3 key highlight cards) or sticky_note for key takeaways, executive insights, or action items.
- Write substantive, specific, rich content — not generic placeholders. The engine paginates automatically across as many pages as needed.`;

  const userMessage = `Mode: ${params.mode}
Existing document context: ${params.currentSummary || 'Empty document'}
User request:
${params.prompt}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: userMessage }],
        role: 'user',
      },
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      temperature: 0.35,
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.modelName}:generateContent?key=${params.apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  let response: Awaited<ReturnType<GeminiFetchFn>>;
  try {
    response = await params.fetcher(url, {
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.app.error('Error de respuesta en Gemini API para generador colaborativo', {
      errorBody,
      model: params.modelName,
      status: response.status,
    });
    throw new Error(`GEMINI_API_ERROR_${response.status}`);
  }

  const data = await response.json();
  const rawParts: Array<{ text?: string; thought?: boolean }> = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];
  const nonThoughtTexts = rawParts
    .filter((p) => !p?.thought && typeof p?.text === 'string' && p.text.trim().length > 0)
    .map((p) => (p.text as string).trim());
  const generatedText = nonThoughtTexts.length > 0
    ? nonThoughtTexts.join('\n')
    : (typeof rawParts[0]?.text === 'string' ? rawParts[0].text : '');

  if (!generatedText || typeof generatedText !== 'string') {
    logger.app.warn('Gemini devolvio respuesta vacia para generador colaborativo', {
      finishReason: data?.candidates?.[0]?.finishReason,
      model: params.modelName,
      partsCount: rawParts.length,
    });
    throw new Error('NO_CONTENT_GENERATED');
  }

  const blueprint = extractJsonFromGeminiText(generatedText);
  const totalTokens = Number(data?.usageMetadata?.totalTokenCount) || Math.ceil((userMessage.length + generatedText.length) / 4);

  return {
    blueprint,
    geminiTokens: totalTokens,
  };
}

function summarizeExistingDoc(content?: CollaborativeDocumentContent | null, currentTitle?: string): string {
  if (!content || !Array.isArray(content.elements) || content.elements.length === 0) {
    return currentTitle ? `Title: ${currentTitle} (no elements yet)` : 'Empty document';
  }
  const snippets: string[] = [];
  for (const el of content.elements) {
    if (el.type === 'text' && el.text) {
      snippets.push(el.text.trim().slice(0, 120));
    }
    if (snippets.length >= 6) break;
  }
  return `Title: ${currentTitle || 'Untitled'}, Pages: ${content.pageCount || 1}, Sample content: ${snippets.join(' | ')}`;
}

function isTransientGeminiError(err: unknown): boolean {
  if (!err) return false;
  const errObj = err as { message?: string; name?: string };
  const msg = typeof errObj.message === 'string' ? errObj.message : '';
  const name = typeof errObj.name === 'string' ? errObj.name : '';
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    msg.includes('GEMINI_API_ERROR_503') ||
    msg.includes('GEMINI_API_ERROR_429') ||
    msg.includes('NO_CONTENT_GENERATED') ||
    msg.includes('fetch failed')
  );
}

async function generateCollaborativeDocumentWithAi(params: GenerateDocWithAiParams): Promise<GenerateDocWithAiResult> {
  const apiKey = config.gemini.apiKey;
  if (!apiKey && !params.geminiFetcher) {
    throw new Error('CONFIG_GEMINI_KEY_MISSING');
  }

  const mode = params.mode === 'append' ? 'append' : 'replace';
  const fetcher: GeminiFetchFn = params.geminiFetcher || (fetch as unknown as GeminiFetchFn);
  const primaryModel = config.gemini.model || 'gemini-flash-lite-latest';
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ])
  );
  const currentSummary = summarizeExistingDoc(params.currentContent, params.currentTitle);

  let blueprintResult: { blueprint: AiDocumentBlueprint; geminiTokens: number } | null = null;
  let usedModel = primaryModel;
  let sawTransientError = false;

  for (const modelName of candidateModels) {
    try {
      blueprintResult = await callGeminiBlueprintApi({
        apiKey,
        currentSummary,
        fetcher,
        mode,
        modelName,
        prompt: params.prompt,
      });
      usedModel = modelName;
      break;
    } catch (err) {
      if (isTransientGeminiError(err)) {
        sawTransientError = true;
      }
      logger.app.warn('Intento fallido generando documento con modelo Gemini', { error: err, model: modelName });
    }
  }

  if (!blueprintResult && sawTransientError) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const retryModels = Array.from(new Set([primaryModel, 'gemini-3.5-flash-lite', 'gemini-3.8-flash']));
    for (const modelName of retryModels) {
      try {
        blueprintResult = await callGeminiBlueprintApi({
          apiKey,
          currentSummary,
          fetcher,
          mode,
          modelName,
          prompt: params.prompt,
        });
        usedModel = modelName;
        break;
      } catch (err) {
        logger.app.warn('Reintento fallido generando documento con modelo Gemini', { error: err, model: modelName });
      }
    }
  }

  if (!blueprintResult) {
    throw new Error('GEMINI_UNAVAILABLE');
  }

  const compiled = compileAiBlueprintToDocument(blueprintResult.blueprint, {
    authorName: params.authorName,
    defaultPageSize: params.currentContent?.pageSize,
    existingContent: params.currentContent,
    mode,
  });

  const finalTitle =
    mode === 'append' && params.currentTitle && params.currentTitle !== 'Documento sin título'
      ? params.currentTitle
      : compiled.title;

  return {
    addedCount: compiled.addedCount,
    blueprint: blueprintResult.blueprint,
    content: compiled.content,
    geminiTokens: blueprintResult.geminiTokens,
    generatedPageCount: compiled.generatedPageCount,
    model: usedModel,
    pageCount: compiled.content.pageCount,
    title: finalTitle,
  };
}

export { compileAiBlueprintToDocument, estimateWrappedLines, extractJsonFromGeminiText, generateCollaborativeDocumentWithAi };
export type { AiBlueprintSection, AiCalloutCard, AiDocumentBlueprint, CompiledDocumentResult, GeminiFetchFn, GenerateDocWithAiParams, GenerateDocWithAiResult };
