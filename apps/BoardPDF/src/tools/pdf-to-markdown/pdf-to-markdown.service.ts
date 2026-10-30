import { config } from '../../config/env.config.js';
import { logger } from '../../services/logger.service.js';
import { storeTempFile } from '../../services/temp-storage.service.js';
import { extractPdfText } from '../../utils/pdf.util.js';
import { executeProcessWithTimeout, findPythonWorkerScript, getPythonCommand } from '../../utils/process.util.js';
import { MarkdownConversionMode, PdfToMarkdownParams, PdfToMarkdownResponse } from './pdf-to-markdown.types.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MODE_INSTRUCTIONS: Record<MarkdownConversionMode, string> = {
  academic: `Enfócate en la conversión de documentos técnicos, científicos o académicos.
- Detecta y representa todas las fórmulas y ecuaciones matemáticas utilizando sintaxis LaTeX estándar ($...$ para fórmulas inline y $$...$$ para bloques de ecuaciones en líneas independientes).
- Identifica fragmentos de código fuente, pseudo-código o comandos y enciérralos en bloques delimitados con tres acentos graves e indica el lenguaje respectivo.
- Preserva la estructura de citas académicas, referencias bibliográficas, notas al pie y secciones numeradas.`,

  clean: `Convierte el documento a un formato Markdown limpio, fluido y altamente legible.
- Elimina encabezados recurrentes de página, números de página repetitivos (como "Pág. 1 de 20") y notas al margen superfluas.
- Unifica párrafos fragmentados causados por saltos de página y conserva solo las divisiones estructurales principales.
- Transforma el contenido en una lectura continua, limpia y agradable.`,

  structured: `Convierte la totalidad del documento PDF a formato Markdown de alta fidelidad estructural.
- Respeta estrictamente la jerarquía visual de títulos (usa # para el título principal, ## para secciones, ### para subsecciones).
- Convierte cualquier tabla a sintaxis de tablas Markdown GitHub Flavored Markdown (| Encabezado 1 | Encabezado 2 |), alineando columnas y preservando el contenido íntegro de cada celda.
- Preserva listas ordenadas y listas con viñetas, respetando sus niveles de anidamiento.
- Emplea **negrita** para términos destacados y *cursiva* para énfasis o anotaciones contextuales.`,

  tables: `Prioriza la detección, extracción y formateo riguroso de tablas y datos tabulares del documento.
- Todas las tablas, cuadros comparativos o listas de datos tabulares deben convertirse a tablas Markdown GFM completas con cabeceras explícitas y separadores (| --- | --- |).
- Si hay cifras, unidades o porcentajes, mantenlos ordenados y alineados correctamente.
- Acompaña cada tabla con su título o pie explicativo correspondiente si está presente en el documento.`,
};

function sanitizeFilename(originalName?: string): string {
  if (!originalName) return 'documento.md';
  const parsed = path.parse(originalName);
  const base = parsed.name.replace(/[^a-zA-Z0-9_\-\. ]/g, '_').trim() || 'documento';
  return `${base}.md`;
}

function stripMarkdownCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(11, -3).trim();
  } else if (cleaned.startsWith('```md') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(5, -3).trim();
  } else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(3, -3).trim();
  }
  return cleaned;
}

async function runPythonMarkdownWorker(
  inputPdfPath: string,
  outputMdPath: string,
  mode: MarkdownConversionMode
): Promise<string | null> {
  try {
    const pythonCmd = await getPythonCommand();
    const scriptPath = findPythonWorkerScript('markdown_worker.py', 'pdf-to-markdown');
    const result = await executeProcessWithTimeout(
      pythonCmd,
      [scriptPath, inputPdfPath, outputMdPath, mode],
      { timeoutMs: 60000 }
    );
    if (result.code === 0 && fs.existsSync(outputMdPath)) {
      const content = await fs.promises.readFile(outputMdPath, 'utf-8');
      if (content && content.trim().length > 0) {
        return content;
      }
    }
  } catch (err) {
    logger.app.warn('Error al invocar markdown_worker.py local', { error: err });
  }
  return null;
}


async function callGeminiApi(
  systemInstruction: string,
  userPrompt: string,
  pdfBuffer: Buffer | null,
  rawText: string,
  modelName: string,
  apiKey: string
): Promise<string> {
  const parts: any[] = [];
  const canUseMultimodal = pdfBuffer && pdfBuffer.length > 0 && pdfBuffer.length <= 18 * 1024 * 1024;

  if (rawText && rawText.length >= 20) {
    parts.push({
      text: `${userPrompt}\n\n--- INICIO DEL CONTENIDO DEL DOCUMENTO ---\n${rawText}\n--- FIN DEL CONTENIDO DEL DOCUMENTO ---`,
    });
  } else if (canUseMultimodal) {
    parts.push({
      inlineData: {
        data: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });
    parts.push({
      text: userPrompt,
    });
  } else {
    parts.push({
      text: `${userPrompt}\n\n--- INICIO DEL CONTENIDO DEL DOCUMENTO ---\n${rawText}\n--- FIN DEL CONTENIDO DEL DOCUMENTO ---`,
    });
  }

  const requestBody = {
    contents: [
      {
        parts,
        role: 'user',
      },
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.2,
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }],
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
    logger.app.error('Error de respuesta en Gemini API al convertir PDF a Markdown', {
      errorBody,
      model: modelName,
      status: response.status,
    });
    throw new Error(`GEMINI_API_ERROR_${response.status}`);
  }

  const data = (await response.json()) as any;
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidateText) {
    throw new Error('NO_CONTENT_GENERATED');
  }

  return stripMarkdownCodeFences(candidateText);
}

export async function convertPdfToMarkdown(params: PdfToMarkdownParams): Promise<PdfToMarkdownResponse> {
  const startTime = Date.now();
  const {
    buffer,
    customPrompt,
    includeMathLatex = false,
    mode = 'structured',
    originalname = 'documento.pdf',
    preserveTables = true,
    removeHeadersFooters = true,
  } = params;

  if (!buffer || buffer.length === 0) {
    throw new Error('EMPTY_PDF_BUFFER');
  }

  let markdownResult = '';
  let usedModel = 'local-structural-extractor';

  const apiKey = config.gemini?.apiKey;
  if (apiKey) {
    const extracted = await extractPdfText(buffer);
    const rawExtractedText = extracted?.fullText || '';
    const isMultimodalEligible = buffer.length <= 18 * 1024 * 1024;

    const systemInstruction = `Eres un motor experto de conversión de documentos PDF a Markdown de alta fidelidad.
Respeta la estructura, tablas GFM y formato semántico del documento sin preámbulos.`;
    const modeInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.structured;
    const additionalDirectives: string[] = [];
    if (includeMathLatex) additionalDirectives.push('- Transcribe expresiones matemáticas en formato LaTeX ($...$ o $$...$$).');
    if (removeHeadersFooters) additionalDirectives.push('- Omite encabezados y pies de página recurrentes.');
    if (preserveTables) additionalDirectives.push('- Formatea cualquier tabla como tabla Markdown estándar.');
    if (customPrompt?.trim()) additionalDirectives.push(`- Instrucción del usuario: ${customPrompt.trim()}`);

    const userPrompt = `Convierte este documento PDF completo a formato Markdown (.md):\n${modeInstruction}\n${additionalDirectives.join('\n')}`;
    const primaryModel = config.gemini.model || 'gemini-flash-lite-latest';
    const fallbackModels = ['gemini-flash-lite-latest', 'gemini-2.0-flash'];

    for (const modelCandidate of [primaryModel, ...fallbackModels]) {
      try {
        markdownResult = await callGeminiApi(
          systemInstruction,
          userPrompt,
          isMultimodalEligible ? buffer : null,
          rawExtractedText,
          modelCandidate,
          apiKey
        );
        if (markdownResult) {
          usedModel = modelCandidate;
          break;
        }
      } catch (err) {
        logger.app.warn('Error con Gemini API fallback en PDF a Markdown', { error: err, model: modelCandidate });
      }
    }
  }

  if (!markdownResult) {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf_md_'));
    const inputPdfPath = path.join(tempDir, 'document.pdf');
    const outputMdPath = path.join(tempDir, 'output.md');

    try {
      await fs.promises.writeFile(inputPdfPath, buffer);
      const localResult = await runPythonMarkdownWorker(inputPdfPath, outputMdPath, mode);
      if (localResult) {
        markdownResult = localResult;
        usedModel = 'local-structural-extractor';
      }
    } finally {
      try {
        await fs.promises.rm(tempDir, { force: true, recursive: true });
      } catch {}
    }
  }

  if (!markdownResult) {
    const { fullText: fallbackText } = await extractPdfText(buffer);
    markdownResult = fallbackText || '# Documento\n\nNo se detectó contenido de texto en el documento.';
    usedModel = 'fallback-text-extractor';
  }

  const cleanedMarkdown = stripMarkdownCodeFences(markdownResult);
  const outFilename = sanitizeFilename(originalname);
  const fileId = `md_${Date.now()}_${randomUUID().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
  const mdBuffer = Buffer.from(cleanedMarkdown, 'utf-8');

  const tokenResult = await storeTempFile(fileId, {
    buffer: mdBuffer,
    contentType: 'text/markdown; charset=utf-8',
    createdAt: Date.now(),
    fileId,
    filename: outFilename,
    fileSize: mdBuffer.length,
    markdown: cleanedMarkdown,
  });

  const wordCount = cleanedMarkdown.split(/\s+/).filter(Boolean).length;
  const lineCount = cleanedMarkdown.split('\n').length;
  const characterCount = cleanedMarkdown.length;
  const processingTimeMs = Date.now() - startTime;

  return {
    characterCount,
    downloadUrl: tokenResult.downloadUrl,
    fileId: tokenResult.fullToken,
    filename: outFilename,
    lineCount,
    markdown: cleanedMarkdown,
    mode,
    model: usedModel,
    processingTimeMs,
    wordCount,
  };
}
