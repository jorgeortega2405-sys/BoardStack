import { loadPdfDocument, loadPdfJs } from './pdf-loader.service.js';

export async function renderPdfThumbnail(
  fileOrDoc: File | any,
  canvas: HTMLCanvasElement,
  options: { dpr?: boolean; pageNum?: number; targetWidth?: number } = {}
): Promise<void> {
  const pageNum = options.pageNum || 1;
  const targetWidth = options.targetWidth || 180;
  const useDpr = options.dpr !== false;
  const dpr = useDpr ? (window.devicePixelRatio || 1) : 1;

  let pdfDoc: any = null;
  let shouldDestroy = false;

  try {
    if (fileOrDoc instanceof File || fileOrDoc instanceof Blob) {
      const arrayBuffer = await fileOrDoc.arrayBuffer();
      pdfDoc = await loadPdfDocument(arrayBuffer);
      shouldDestroy = true;
    } else if (fileOrDoc && typeof fileOrDoc.getPage === 'function') {
      pdfDoc = fileOrDoc;
    } else {
      const pdfjs = await loadPdfJs();
      if (fileOrDoc instanceof ArrayBuffer || fileOrDoc instanceof Uint8Array) {
        pdfDoc = await loadPdfDocument(fileOrDoc);
        shouldDestroy = true;
      } else {
        pdfDoc = await pdfjs.getDocument(fileOrDoc).promise;
        shouldDestroy = true;
      }
    }

    const page = await pdfDoc.getPage(pageNum);
    const origViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / Math.max(origViewport.width, 1);
    const viewport = page.getViewport({ scale });

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (useDpr && dpr !== 1) {
        ctx.scale(dpr, dpr);
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  } catch {
  } finally {
    if (shouldDestroy && pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {}
    }
  }
}

export async function generateThumbnailDataUrl(
  pdfDocument: any,
  pageNum = 1,
  targetWidth = 200,
  quality = 0.85
): Promise<string> {
  let doc = pdfDocument;
  let shouldDestroy = false;

  try {
    if (pdfDocument instanceof File || pdfDocument instanceof Blob) {
      const arrayBuffer = await pdfDocument.arrayBuffer();
      doc = await loadPdfDocument(arrayBuffer);
      shouldDestroy = true;
    } else if (pdfDocument instanceof ArrayBuffer || pdfDocument instanceof Uint8Array) {
      doc = await loadPdfDocument(pdfDocument);
      shouldDestroy = true;
    } else if (!pdfDocument || typeof pdfDocument.getPage !== 'function') {
      const pdfjs = await loadPdfJs();
      doc = await pdfjs.getDocument(pdfDocument).promise;
      shouldDestroy = true;
    }

    const page = await doc.getPage(pageNum);
    const origViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / Math.max(origViewport.width, 1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return '';
    }

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return '';
  } finally {
    if (shouldDestroy && doc) {
      try {
        await doc.destroy();
      } catch {}
    }
  }
}
