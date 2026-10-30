import { config } from '../../config/env.config.js';
import { logger } from '../../services/logger.service.js';
import { getTempFile, storeTempFile } from '../../services/temp-storage.service.js';
import { executeProcessWithTimeout, findPythonWorkerScript, getPythonCommand } from '../../utils/process.util.js';
import { StoredTranslatedPdf, TranslatePdfParams, TranslatePdfResponse } from './translate-pdf.types.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const LANGUAGE_NAMES: Record<string, string> = {
  AF: 'Afrikaans',
  AFR: 'Afrikaans',
  AR: 'Arabic',
  ARA: 'Arabic',
  CA: 'Catalan',
  CAT: 'Catalan',
  CS: 'Czech',
  CES: 'Czech',
  DA: 'Danish',
  DAN: 'Danish',
  DE: 'German',
  DEU: 'German',
  EL: 'Greek',
  ELL: 'Greek',
  EN: 'English',
  'EN-GB': 'British English',
  'EN-US': 'American English',
  ENG: 'English',
  ES: 'Spanish',
  SPA: 'Spanish',
  FI: 'Finnish',
  FIN: 'Finnish',
  FR: 'French',
  FRA: 'French',
  HE: 'Hebrew',
  HEB: 'Hebrew',
  HI: 'Hindi',
  HIN: 'Hindi',
  HR: 'Croatian',
  HRV: 'Croatian',
  HU: 'Hungarian',
  HUN: 'Hungarian',
  ID: 'Indonesian',
  IND: 'Indonesian',
  IT: 'Italian',
  ITA: 'Italian',
  JA: 'Japanese',
  JPN: 'Japanese',
  KO: 'Korean',
  KOR: 'Korean',
  NL: 'Dutch',
  NLD: 'Dutch',
  NO: 'Norwegian',
  NOR: 'Norwegian',
  PL: 'Polish',
  POL: 'Polish',
  PT: 'Portuguese',
  'PT-BR': 'Brazilian Portuguese',
  'PT-PT': 'European Portuguese',
  POR: 'Portuguese',
  RO: 'Romanian',
  RON: 'Romanian',
  RU: 'Russian',
  RUS: 'Russian',
  SK: 'Slovak',
  SLK: 'Slovak',
  SV: 'Swedish',
  SWE: 'Swedish',
  TR: 'Turkish',
  TUR: 'Turkish',
  UK: 'Ukrainian',
  UKR: 'Ukrainian',
  ZH: 'Simplified Chinese',
  ZHO: 'Simplified Chinese',
};

export async function getTranslatedPdf(fileId: string): Promise<StoredTranslatedPdf | null> {
  return getTempFile<StoredTranslatedPdf>(fileId);
}

async function extractPagesText(buffer: Buffer): Promise<Array<{ pageIndex: number; text: string }>> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: Array<{ pageIndex: number; text: string }> = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter(Boolean);
      pages.push({
        pageIndex: pageNum - 1,
        text: pageStrings.join(' ').trim(),
      });
    }

    return pages;
  } catch (err) {
    logger.app.warn('Error al extraer texto por páginas con pdfjs en translate-pdf', { error: err });
    return [];
  }
}

async function callGeminiTranslate(
  text: string,
  targetLangName: string,
  sourceLangName: string | undefined,
  modelName: string,
  apiKey: string
): Promise<string> {
  const sourceInstruction = sourceLangName ? `from ${sourceLangName}` : 'from its original language';
  const prompt = `You are a professional document translator. Translate the following text ${sourceInstruction} into ${targetLangName}.
Preserve numbers, formatting, paragraphs, bullet points and line structure faithfully.
Return ONLY the translation, without notes, explanations, or quotes.

--- TEXT TO TRANSLATE ---
${text}
--- END TEXT ---`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
        role: 'user',
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    body: JSON.stringify(requestBody),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.app.error('Error de respuesta en Gemini API al traducir', {
      errorBody,
      model: modelName,
      status: response.status,
    });
    throw new Error(`GEMINI_API_ERROR_${response.status}`);
  }

  const data = (await response.json()) as any;
  const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!translated) {
    throw new Error('NO_CONTENT_GENERATED');
  }

  return translated.trim();
}

async function translateWithDeepL(params: TranslatePdfParams): Promise<Buffer | null> {
  const { buffer, originalname = 'document.pdf', sourceLang, targetLang } = params;
  const apiKey = config.deepl.apiKey;
  if (!apiKey) {
    return null;
  }

  const isFree = apiKey.endsWith(':fx');
  const baseUrl = isFree ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), originalname);
  formData.append('target_lang', targetLang.toUpperCase());
  if (sourceLang && sourceLang.trim().length > 0 && sourceLang.trim().toLowerCase() !== 'auto') {
    formData.append('source_lang', sourceLang.trim().toUpperCase());
  }

  const uploadResponse = await fetch(`${baseUrl}/v2/document`, {
    body: formData,
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    method: 'POST',
  });

  if (!uploadResponse.ok) {
    return null;
  }

  const uploadData = (await uploadResponse.json()) as { document_id: string; document_key: string };
  const documentId = uploadData.document_id;
  const documentKey = uploadData.document_key;

  if (!documentId || !documentKey) {
    return null;
  }

  const statusEndpoint = `${baseUrl}/v2/document/${documentId}`;
  let isDone = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const statusResponse = await fetch(statusEndpoint, {
      body: new URLSearchParams({ document_key: documentKey }),
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    if (!statusResponse.ok) break;

    const statusData = (await statusResponse.json()) as {
      status: 'done' | 'error' | 'queued' | 'translating';
    };

    if (statusData.status === 'done') {
      isDone = true;
      break;
    }
    if (statusData.status === 'error') {
      break;
    }
  }

  if (!isDone) return null;

  const resultResponse = await fetch(`${baseUrl}/v2/document/${documentId}/result`, {
    body: new URLSearchParams({ document_key: documentKey }),
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!resultResponse.ok) return null;

  const arrayBuf = await resultResponse.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function renderTranslatedPdfWithPython(
  inputBuffer: Buffer,
  translationsMap: Record<string, string>
): Promise<Buffer | null> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trans_pdf_'));
  const inputPdfPath = path.join(tempDir, 'input.pdf');
  const outputPdfPath = path.join(tempDir, 'output.pdf');
  const jsonPath = path.join(tempDir, 'translations.json');

  try {
    await fs.writeFile(inputPdfPath, inputBuffer);
    await fs.writeFile(jsonPath, JSON.stringify(translationsMap), 'utf-8');

    const pythonCmd = await getPythonCommand();
    const scriptPath = findPythonWorkerScript('translate_worker.py', 'translate-pdf');
    const result = await executeProcessWithTimeout(
      pythonCmd,
      [scriptPath, inputPdfPath, outputPdfPath, jsonPath],
      { timeoutMs: 90000 }
    );

    if (result.code === 0) {
      try {
        const outStat = await fs.stat(outputPdfPath);
        if (outStat.size > 0) {
          const outBuf = await fs.readFile(outputPdfPath);
          return outBuf;
        }
      } catch {}
    }
  } catch (err) {
    logger.app.warn('Error al ejecutar translate_worker.py en translate-pdf', { error: err });
  } finally {
    try {
      await fs.rm(tempDir, { force: true, recursive: true });
    } catch {}
  }

  return null;
}

async function renderTranslatedPdfWithPdfLib(
  inputBuffer: Buffer,
  translationsMap: Record<string, string>
): Promise<Buffer> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
  } catch {
    doc = await PDFDocument.create();
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pageCount = doc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const translatedText = translationsMap[String(i)];
    if (!translatedText) continue;

    const page = doc.getPage(i);
    const { height, width } = page.getSize();

    page.drawRectangle({
      color: rgb(1, 1, 1),
      height: height - 60,
      width: width - 60,
      x: 30,
      y: 30,
    });

    const lines = translatedText.split('\n');
    let currentY = height - 50;
    const fontSize = 10;
    const lineHeight = 14;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        currentY -= lineHeight;
        continue;
      }
      if (currentY < 40) break;

      const words = line.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > width - 80) {
          page.drawText(currentLine, { color: rgb(0.1, 0.1, 0.1), font, size: fontSize, x: 40, y: currentY });
          currentY -= lineHeight;
          currentLine = word;
          if (currentY < 40) break;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine && currentY >= 40) {
        page.drawText(currentLine, { color: rgb(0.1, 0.1, 0.1), font, size: fontSize, x: 40, y: currentY });
        currentY -= lineHeight;
      }
    }
  }

  const saved = await doc.save();
  return Buffer.from(saved);
}

export async function translatePdf(params: TranslatePdfParams): Promise<TranslatePdfResponse> {
  const { buffer, filename, layoutMode = 'preserve', originalname = 'document.pdf', sourceLang, targetLang } = params;

  let resultBuffer: Buffer | null = null;

  if (config.deepl.apiKey) {
    try {
      resultBuffer = await translateWithDeepL(params);
    } catch (err) {
      logger.app.warn('DeepL falló o no está disponible, cambiando a Google Gemini AI', { error: err });
    }
  }

  if (!resultBuffer) {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      throw new Error('CONFIG_GEMINI_KEY_MISSING');
    }

    const pages = await extractPagesText(buffer);
    if (!pages || pages.length === 0) {
      throw new Error('EMPTY_PDF_TEXT');
    }

    const targetLangName = LANGUAGE_NAMES[targetLang.toUpperCase()] || targetLang;
    const sourceLangName = sourceLang ? LANGUAGE_NAMES[sourceLang.toUpperCase()] || sourceLang : undefined;
    const model = config.gemini.model || 'gemini-flash-lite-latest';

    const translationsMap: Record<string, string> = {};

    for (const pageItem of pages) {
      if (!pageItem.text || pageItem.text.length < 3) {
        translationsMap[String(pageItem.pageIndex)] = '';
        continue;
      }

      try {
        const translatedPage = await callGeminiTranslate(
          pageItem.text,
          targetLangName,
          sourceLangName,
          model,
          apiKey
        );
        translationsMap[String(pageItem.pageIndex)] = translatedPage;
      } catch (geminiErr) {
        logger.app.warn('Error al traducir página con Gemini, conservando texto original', {
          error: geminiErr,
          page: pageItem.pageIndex,
        });
        translationsMap[String(pageItem.pageIndex)] = pageItem.text;
      }
    }

    if (layoutMode === 'text_only') {
      resultBuffer = await renderTranslatedPdfWithPdfLib(buffer, translationsMap);
    } else {
      const pythonResult = await renderTranslatedPdfWithPython(buffer, translationsMap);
      if (pythonResult && pythonResult.length > 0) {
        resultBuffer = pythonResult;
      } else {
        resultBuffer = await renderTranslatedPdfWithPdfLib(buffer, translationsMap);
      }
    }
  }

  if (!resultBuffer || resultBuffer.length === 0) {
    throw new Error('TRANSLATION_FAILED');
  }

  const fileId = randomUUID();
  const baseName = originalname.replace(/\.[^/.]+$/, '');
  const langSuffix = targetLang.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const finalFilename = `${baseName}_${langSuffix}.pdf`;

  const tokenResult = await storeTempFile(fileId, {
    buffer: resultBuffer,
    contentType: 'application/pdf',
    createdAt: Date.now(),
    filename: finalFilename,
    format: 'application/pdf',
    originalname,
    size: resultBuffer.length,
    sourceLang,
    targetLang,
  });

  return {
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename: finalFilename,
    format: 'application/pdf',
    originalname,
    size: resultBuffer.length,
    sourceLang,
    targetLang,
  };
}
