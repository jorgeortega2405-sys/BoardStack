import { loadPdfDocument, loadPdfJs } from './pdf-loader.service.js';

interface RenderCacheEntry {
  canvasBuffer: HTMLCanvasElement;
  height: number;
  width: number;
}

const renderCache = new Map<string, RenderCacheEntry>();
const MAX_CACHE_ENTRIES = 60;
let renderWorker: Worker | null = null;
let workerTaskId = 0;
const pendingWorkerTasks = new Map<string, { reject: (err: any) => void; resolve: (bitmap: ImageBitmap) => void }>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!renderWorker) {
    try {
      renderWorker = new Worker(new URL('../workers/pdf-render.worker.js', import.meta.url), { type: 'module' });
      renderWorker.onmessage = (e: MessageEvent) => {
        const { bitmap, error, id, success } = e.data;
        const task = pendingWorkerTasks.get(id);
        if (!task) return;
        pendingWorkerTasks.delete(id);
        if (success && bitmap) {
          task.resolve(bitmap);
        } else {
          task.reject(new Error(error || 'Worker render failed'));
        }
      };
      renderWorker.onerror = () => {
        for (const [, task] of pendingWorkerTasks) {
          task.reject(new Error('Worker error'));
        }
        pendingWorkerTasks.clear();
        renderWorker?.terminate();
        renderWorker = null;
      };
    } catch {
      renderWorker = null;
    }
  }
  return renderWorker;
}

function getCacheKey(source: any, pageNum: number, targetWidth: number, dpr: number): string | null {
  if (typeof source === 'string') {
    return `${source}:${pageNum}:${targetWidth}:${dpr}`;
  }
  if (source instanceof File) {
    return `${source.name}:${source.size}:${source.lastModified}:${pageNum}:${targetWidth}:${dpr}`;
  }
  return null;
}

function addToCache(key: string, canvasBuffer: HTMLCanvasElement, width: number, height: number): void {
  if (renderCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = renderCache.keys().next().value;
    if (firstKey) renderCache.delete(firstKey);
  }
  renderCache.set(key, { canvasBuffer, height, width });
}

function clearPdfThumbnailCache(): void {
  renderCache.clear();
}

async function renderPdfThumbnail(
  fileOrDoc: File | any,
  canvas: HTMLCanvasElement,
  options: { dpr?: boolean; pageNum?: number; targetWidth?: number } = {}
): Promise<void> {
  const pageNum = options.pageNum || 1;
  const targetWidth = options.targetWidth || 180;
  const useDpr = options.dpr !== false;
  const dpr = useDpr ? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) : 1;

  const cacheKey = getCacheKey(fileOrDoc, pageNum, targetWidth, dpr);
  if (cacheKey && renderCache.has(cacheKey)) {
    const cached = renderCache.get(cacheKey)!;
    canvas.width = cached.width;
    canvas.height = cached.height;
    canvas.style.width = `${cached.width / dpr}px`;
    canvas.style.height = `${cached.height / dpr}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(cached.canvasBuffer, 0, 0);
    }
    return;
  }

  const worker = getWorker();
  if (worker && (typeof fileOrDoc === 'string' || fileOrDoc instanceof File)) {
    try {
      const taskId = `task_${++workerTaskId}_${Date.now()}`;
      let sourcePayload: ArrayBuffer | string;
      let transferList: Transferable[] = [];

      if (typeof fileOrDoc === 'string') {
        sourcePayload = fileOrDoc;
      } else {
        sourcePayload = await fileOrDoc.arrayBuffer();
        transferList = [sourcePayload];
      }

      const bitmapPromise = new Promise<ImageBitmap>((resolve, reject) => {
        pendingWorkerTasks.set(taskId, { reject, resolve });
      });

      worker.postMessage(
        {
          dpr,
          id: taskId,
          pageNum,
          source: sourcePayload,
          targetWidth,
        },
        transferList
      );

      const bitmap = await bitmapPromise;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.style.width = `${bitmap.width / dpr}px`;
      canvas.style.height = `${bitmap.height / dpr}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
      }

      if (cacheKey) {
        const offscreenCopy = document.createElement('canvas');
        offscreenCopy.width = bitmap.width;
        offscreenCopy.height = bitmap.height;
        const copyCtx = offscreenCopy.getContext('2d');
        if (copyCtx) {
          copyCtx.drawImage(bitmap, 0, 0);
          addToCache(cacheKey, offscreenCopy, bitmap.width, bitmap.height);
        }
      }

      bitmap.close();
      return;
    } catch {
    }
  }

  let pdfDoc: any = null;
  let shouldDestroy = false;

  try {
    if (fileOrDoc instanceof File || fileOrDoc instanceof Blob) {
      const arrayBuffer = await fileOrDoc.arrayBuffer();
      pdfDoc = await loadPdfDocument(arrayBuffer);
      shouldDestroy = true;
    } else if (fileOrDoc && typeof fileOrDoc.getPage === 'function') {
      pdfDoc = fileOrDoc;
    } else if (typeof fileOrDoc === 'string') {
      pdfDoc = await loadPdfDocument(fileOrDoc);
      shouldDestroy = false;
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

    const pixelW = Math.floor(viewport.width * dpr);
    const pixelH = Math.floor(viewport.height * dpr);

    canvas.width = pixelW;
    canvas.height = pixelH;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (useDpr && dpr !== 1) {
        ctx.scale(dpr, dpr);
      }
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (cacheKey) {
        const offscreenCopy = document.createElement('canvas');
        offscreenCopy.width = pixelW;
        offscreenCopy.height = pixelH;
        const copyCtx = offscreenCopy.getContext('2d');
        if (copyCtx) {
          copyCtx.drawImage(canvas, 0, 0);
          addToCache(cacheKey, offscreenCopy, pixelW, pixelH);
        }
      }
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

async function generateThumbnailDataUrl(
  pdfDocument: any,
  pageNum = 1,
  targetWidth = 200,
  quality = 0.85
): Promise<string> {
  const cacheKey = getCacheKey(pdfDocument, pageNum, targetWidth, 1);
  if (cacheKey && renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey)!.canvasBuffer.toDataURL('image/jpeg', quality);
  }

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
    } else if (typeof pdfDocument === 'string') {
      doc = await loadPdfDocument(pdfDocument);
      shouldDestroy = false;
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
    if (!ctx) return '';

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    if (cacheKey) {
      addToCache(cacheKey, canvas, canvas.width, canvas.height);
    }

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

export { clearPdfThumbnailCache, generateThumbnailDataUrl, renderPdfThumbnail };
