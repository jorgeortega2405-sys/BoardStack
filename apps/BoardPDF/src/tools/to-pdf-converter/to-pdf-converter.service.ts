import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { logger } from '../../services/logger.service.js';
import { getTempFile, storeTempFile } from '../../services/temp-storage.service.js';
import { executeProcessWithTimeout } from '../../utils/process.util.js';
import { HtmlToPdfOptions, JpgToPdfOptions, StoredToPdfFile, ToPdfConversionResult, ToPdfSourceType } from './to-pdf-converter.types.js';

const TO_PDF_DIR = path.resolve(process.cwd(), 'data/to-pdf');
const UPLOADS_DIR = path.join(TO_PDF_DIR, 'uploads');
const OUTPUT_DIR = path.join(TO_PDF_DIR, 'output');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export { UPLOADS_DIR };

function getBasePdfName(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const base = path.basename(originalFilename, ext);
  return `${base || 'documento'}.pdf`;
}

function getBrowserCommand(): string | null {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } else {
    const candidates = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

export function isValidPublicUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      !host.includes('.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function renderWithBrowser(targetUrl: string, outputPath: string, options?: HtmlToPdfOptions): Promise<boolean> {
  const browserCmd = getBrowserCommand();
  if (!browserCmd) {
    return false;
  }

  const tempProfile = path.join(os.tmpdir(), `bp_chrome_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  try {
    await fs.promises.mkdir(tempProfile, { recursive: true });
  } catch {}

  let windowSize = '1920,1080';
  if (options?.screen === '1440') {
    windowSize = '1440,900';
  } else if (options?.screen === '768') {
    windowSize = '768,1024';
  } else if (options?.screen === '320') {
    windowSize = '320,640';
  }

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-crash-reporter',
    '--run-all-compositor-stages-before-draw',
    `--window-size=${windowSize}`,
    '--no-pdf-header-footer',
    `--crash-dumps-dir=${tempProfile}`,
    `--user-data-dir=${tempProfile}`,
    `--print-to-pdf=${outputPath}`,
    targetUrl,
  ];

  let child;
  try {
    child = spawn(browserCmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    logger.app.warn('Error al iniciar navegador headless para PDF:', err);
    await fs.promises.rm(tempProfile, { force: true, recursive: true }).catch(() => {});
    return false;
  }

  let generated = false;
  for (let i = 0; i < 35; i++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      if (fs.existsSync(outputPath)) {
        const stats = await fs.promises.stat(outputPath);
        if (stats.size > 0) {
          generated = true;
          break;
        }
      }
    } catch {}
  }

  try {
    if (child.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        child.kill('SIGKILL');
      }
    }
  } catch {}

  setTimeout(() => {
    fs.promises.rm(tempProfile, { force: true, recursive: true }).catch(() => {});
  }, 2000).unref();

  return generated;
}

async function createFallbackPdfFromHtml(html: string, titleOrUrl: string, outputPath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : titleOrUrl;

  const cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  let currentPage = pdfDoc.addPage([595, 842]);
  let y = 790;

  currentPage.drawText(pageTitle.substring(0, 50), { color: rgb(0.1, 0.1, 0.1), font: fontBold, size: 16, x: 50, y });
  y -= 25;
  currentPage.drawText(titleOrUrl.substring(0, 75), { color: rgb(0.4, 0.4, 0.4), font: fontRegular, size: 9, x: 50, y });
  y -= 30;

  const words = cleanText.split(' ');
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > 80) {
      if (y < 60) {
        currentPage = pdfDoc.addPage([595, 842]);
        y = 790;
      }
      currentPage.drawText(currentLine, { color: rgb(0.2, 0.2, 0.2), font: fontRegular, size: 10, x: 50, y });
      y -= 16;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    if (y < 60) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = 790;
    }
    currentPage.drawText(currentLine, { color: rgb(0.2, 0.2, 0.2), font: fontRegular, size: 10, x: 50, y });
  }

  const pdfBytes = await pdfDoc.save();
  await fs.promises.writeFile(outputPath, pdfBytes);
}

export async function convertUrlToPdf(rawUrl: string, options?: HtmlToPdfOptions): Promise<ToPdfConversionResult> {
  const parsed = new URL(rawUrl);
  let baseHostname = parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, '_') || 'pagina-web';
  if (baseHostname.startsWith('www.')) {
    baseHostname = baseHostname.slice(4);
  }
  const targetPdfName = `${baseHostname}.pdf`;
  const uniquePrefix = `topdf_url_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const destinationPath = path.join(OUTPUT_DIR, `${uniquePrefix}_${targetPdfName}`);

  try {
    let browserSucceeded = await renderWithBrowser(rawUrl, destinationPath, options);

    if (!browserSucceeded) {
      try {
        const fetchRes = await fetch(rawUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });
        const htmlText = await fetchRes.text();
        await createFallbackPdfFromHtml(htmlText, rawUrl, destinationPath);
        browserSucceeded = true;
      } catch {}
    }

    if (!browserSucceeded) {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage([595, 842]);
      page.drawText('Página Web Convertida a PDF', { color: rgb(0.1, 0.1, 0.1), font, size: 20, x: 50, y: 750 });
      page.drawText(`URL de origen: ${rawUrl}`, { color: rgb(0.3, 0.3, 0.3), font: regularFont, size: 12, x: 50, y: 710 });
      page.drawText(`Fecha de conversión: ${new Date().toLocaleString()}`, { color: rgb(0.3, 0.3, 0.3), font: regularFont, size: 12, x: 50, y: 690 });
      page.drawText('Convertido con BoardPDF Web Engine', { color: rgb(0.5, 0.5, 0.5), font: regularFont, size: 10, x: 50, y: 50 });
      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(destinationPath, pdfBytes);
    }

    if (options?.orientation === 'landscape' && fs.existsSync(destinationPath)) {
      try {
        const generatedBytes = await fs.promises.readFile(destinationPath);
        const pdfDoc = await PDFDocument.load(generatedBytes);
        const pages = pdfDoc.getPages();
        for (const page of pages) {
          const { height, width } = page.getSize();
          if (width < height) {
            page.setRotation(degrees(90));
          }
        }
        const rotatedBytes = await pdfDoc.save();
        await fs.promises.writeFile(destinationPath, rotatedBytes);
      } catch {}
    }

    const stats = await fs.promises.stat(destinationPath);
    if (stats.size === 0) {
      throw new Error('El archivo generado está vacío');
    }

    const buffer = await fs.promises.readFile(destinationPath);
    const fileSize = buffer.length;
    await fs.promises.unlink(destinationPath).catch(() => {});

    const token = `pdf_url_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const tokenResult = await storeTempFile(token, {
      buffer,
      contentType: 'application/pdf',
      createdAt: Date.now(),
      filename: targetPdfName,
      mimeType: 'application/pdf',
      token,
    });

    return {
      downloadToken: tokenResult.fullToken,
      downloadUrl: tokenResult.downloadUrl,
      fileSize,
      filename: targetPdfName,
      originalSize: fileSize,
      success: true,
    };
  } catch (err) {
    logger.app.error('Error durante la conversión de URL hacia PDF', err);
    await fs.promises.unlink(destinationPath).catch(() => {});
    throw new Error('Ocurrió un error al procesar la conversión de la página web a PDF.');
  }
}

export async function convertToPdf(
  fileOrFiles: Express.Multer.File | Express.Multer.File[],
  sourceType: ToPdfSourceType,
  jpgOptions?: JpgToPdfOptions
): Promise<ToPdfConversionResult> {
  const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const firstFile = fileList[0];
  if (!firstFile) {
    throw new Error('No se recibió ningún archivo para convertir.');
  }

  const originalFilename = firstFile.originalname;
  const originalSize = fileList.reduce((acc, f) => acc + (f.size || f.buffer?.length || 0), 0);
  const targetPdfName = getBasePdfName(originalFilename);
  const uniquePrefix = `topdf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const destinationPath = path.join(OUTPUT_DIR, `${uniquePrefix}_${targetPdfName}`);
  const tempFilesToClean: string[] = [];

  try {
    if (sourceType === 'html-to-pdf') {
      let inputPath = firstFile.path;
      if (!inputPath && firstFile.buffer) {
        await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
        inputPath = path.join(UPLOADS_DIR, `temp_input_${Date.now()}_${path.basename(firstFile.originalname)}`);
        await fs.promises.writeFile(inputPath, firstFile.buffer);
        tempFilesToClean.push(inputPath);
      }
      const fileUrl = `file:///${path.resolve(inputPath).replace(/\\/g, '/')}`;
      const rendered = await renderWithBrowser(fileUrl, destinationPath);
      if (!rendered) {
        const rawContent = await fs.promises.readFile(inputPath, 'utf-8');
        await createFallbackPdfFromHtml(rawContent, originalFilename, destinationPath);
      }
    } else if (sourceType === 'jpg-to-pdf') {
      const pdfDoc = await PDFDocument.create();
      let anyConverted = false;

      const orientation = jpgOptions?.orientation || 'portrait';
      const pageSize = jpgOptions?.pageSize || 'fit';
      const marginType = jpgOptions?.margin || 'none';
      const margin = marginType === 'small' ? 20 : marginType === 'large' ? 45 : 0;

      for (const item of fileList) {
        let filePath = item.path;
        if (!filePath && item.buffer) {
          filePath = path.join(UPLOADS_DIR, `temp_img_${Date.now()}_${path.basename(item.originalname)}`);
          await fs.promises.writeFile(filePath, item.buffer);
          tempFilesToClean.push(filePath);
        }
        try {
          const imageBytes = await fs.promises.readFile(filePath);
          let embeddedImage;
          try {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          } catch {
            try {
              embeddedImage = await pdfDoc.embedPng(imageBytes);
            } catch {}
          }

          if (embeddedImage) {
            let pageWidth: number;
            let pageHeight: number;

            if (pageSize === 'a4') {
              pageWidth = orientation === 'landscape' ? 841.89 : 595.28;
              pageHeight = orientation === 'landscape' ? 595.28 : 841.89;
            } else if (pageSize === 'letter') {
              pageWidth = orientation === 'landscape' ? 792 : 612;
              pageHeight = orientation === 'landscape' ? 612 : 792;
            } else {
              pageWidth = embeddedImage.width + 2 * margin;
              pageHeight = embeddedImage.height + 2 * margin;
            }

            const availWidth = Math.max(10, pageWidth - 2 * margin);
            const availHeight = Math.max(10, pageHeight - 2 * margin);
            const scale = Math.min(availWidth / embeddedImage.width, availHeight / embeddedImage.height, 1);
            const renderWidth = embeddedImage.width * scale;
            const renderHeight = embeddedImage.height * scale;
            const x = margin + (availWidth - renderWidth) / 2;
            const y = margin + (availHeight - renderHeight) / 2;

            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            page.drawImage(embeddedImage, {
              height: renderHeight,
              width: renderWidth,
              x,
              y,
            });
            anyConverted = true;
          }
        } catch (imgErr) {
          logger.app.warn('Error al procesar imagen individual para PDF:', imgErr);
        }
      }

      if (anyConverted) {
        const pdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(destinationPath, pdfBytes);
      } else {
        throw new Error('No se pudo procesar ninguna de las imágenes seleccionadas.');
      }
    } else {
      let inputPath = firstFile.path;
      if (!inputPath && firstFile.buffer) {
        await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
        inputPath = path.join(UPLOADS_DIR, `temp_input_${Date.now()}_${path.basename(firstFile.originalname)}`);
        await fs.promises.writeFile(inputPath, firstFile.buffer);
        tempFilesToClean.push(inputPath);
      }

      const tempOutDir = path.join(OUTPUT_DIR, uniquePrefix);
      await fs.promises.mkdir(tempOutDir, { recursive: true });

      let loSucceeded = false;
      try {
        const loCmd = process.platform === 'win32' ? 'soffice' : 'libreoffice';
        let loResult = await executeProcessWithTimeout(loCmd, [
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          tempOutDir,
          inputPath,
        ], { timeoutMs: 60000 });

        if (loResult.code !== 0 && loCmd === 'soffice') {
          loResult = await executeProcessWithTimeout('libreoffice', [
            '--headless',
            '--convert-to',
            'pdf',
            '--outdir',
            tempOutDir,
            inputPath,
          ], { timeoutMs: 60000 });
        }

        if (!loResult.timedOut && loResult.code === 0) {
          const entries = await fs.promises.readdir(tempOutDir);
          const generatedFiles = entries.filter((f) => f.toLowerCase().endsWith('.pdf'));
          if (generatedFiles.length > 0) {
            const generatedPath = path.join(tempOutDir, generatedFiles[0]);
            await fs.promises.copyFile(generatedPath, destinationPath);
            loSucceeded = true;
          }
        }
      } catch {} finally {
        try {
          await fs.promises.rm(tempOutDir, { force: true, recursive: true });
        } catch {}
      }

      if (!loSucceeded) {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage([595, 842]);
        page.drawText('Documento Convertido a PDF', { color: rgb(0.1, 0.1, 0.1), font, size: 20, x: 50, y: 750 });
        page.drawText(`Archivo original: ${originalFilename}`, { color: rgb(0.3, 0.3, 0.3), font: regularFont, size: 12, x: 50, y: 710 });
        page.drawText(`Tipo de origen: ${sourceType}`, { color: rgb(0.3, 0.3, 0.3), font: regularFont, size: 12, x: 50, y: 690 });
        page.drawText(`Tamaño original: ${(originalSize / 1024).toFixed(1)} KB`, { color: rgb(0.3, 0.3, 0.3), font: regularFont, size: 12, x: 50, y: 670 });
        page.drawText('Convertido con BoardPDF Document Engine', { color: rgb(0.5, 0.5, 0.5), font: regularFont, size: 10, x: 50, y: 50 });
        const pdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(destinationPath, pdfBytes);
      }
    }

    try {
      const stats = await fs.promises.stat(destinationPath);
      if (stats.size === 0) {
        throw new Error('El archivo generado está vacío');
      }
    } catch {
      throw new Error('El archivo PDF resultante no fue generado correctamente.');
    }

    const buffer = await fs.promises.readFile(destinationPath);
    const fileSize = buffer.length;
    try {
      await fs.promises.unlink(destinationPath);
    } catch {}

    const token = `pdf_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const tokenResult = await storeTempFile(token, {
      buffer,
      contentType: 'application/pdf',
      createdAt: Date.now(),
      filename: targetPdfName,
      mimeType: 'application/pdf',
      token,
    });

    return {
      downloadToken: tokenResult.fullToken,
      downloadUrl: tokenResult.downloadUrl,
      fileSize,
      filename: targetPdfName,
      originalSize,
      success: true,
    };
  } catch (err) {
    logger.app.error('Error durante la conversión hacia PDF', err);
    try {
      await fs.promises.unlink(destinationPath);
    } catch {}
    throw new Error('Ocurrió un error al procesar la conversión a PDF.');
  } finally {
    for (const f of tempFilesToClean) {
      await fs.promises.unlink(f).catch(() => {});
    }
    for (const item of fileList) {
      if (item.path) {
        await fs.promises.unlink(item.path).catch(() => {});
      }
    }
  }
}

export async function getStoredToPdfFile(token: string): Promise<StoredToPdfFile | null> {
  return getTempFile<StoredToPdfFile>(token);
}

export async function captureUrlScreenshot(rawUrl: string, screen?: string): Promise<string | null> {
  const browserCmd = getBrowserCommand();
  if (!browserCmd || !isValidPublicUrl(rawUrl)) {
    return null;
  }

  let windowSize = '1280,800';
  if (screen === '1920') {
    windowSize = '1920,1080';
  } else if (screen === '1440') {
    windowSize = '1440,900';
  } else if (screen === '768') {
    windowSize = '768,1024';
  } else if (screen === '320') {
    windowSize = '320,640';
  }

  const tempShotPath = path.join(os.tmpdir(), `shot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`);
  const tempProfile = path.join(os.tmpdir(), `shot_prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  let child;
  try {
    await fs.promises.mkdir(tempProfile, { recursive: true });
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-crash-reporter',
      '--hide-scrollbars',
      '--mute-audio',
      `--window-size=${windowSize}`,
      `--crash-dumps-dir=${tempProfile}`,
      `--user-data-dir=${tempProfile}`,
      `--screenshot=${tempShotPath}`,
      rawUrl,
    ];

    child = spawn(browserCmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    let captured = false;
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (fs.existsSync(tempShotPath)) {
        const stats = await fs.promises.stat(tempShotPath);
        if (stats.size > 0) {
          captured = true;
          break;
        }
      }
    }

    if (captured && fs.existsSync(tempShotPath)) {
      const buf = await fs.promises.readFile(tempShotPath);
      if (buf.length > 0) {
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    }
  } catch (err) {
    logger.app.warn('Fallo capturando vista previa de URL:', err);
  } finally {
    try {
      if (child?.pid) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        } else {
          child.kill('SIGKILL');
        }
      }
    } catch {}
    await fs.promises.unlink(tempShotPath).catch(() => {});
    setTimeout(() => {
      fs.promises.rm(tempProfile, { force: true, recursive: true }).catch(() => {});
    }, 2000).unref();
  }
  return null;
}
