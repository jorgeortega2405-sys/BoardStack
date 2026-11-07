interface WorkerRenderRequest {
  dpr?: number;
  id: string;
  pageNum: number;
  source: ArrayBuffer | string;
  targetWidth: number;
}

interface WorkerRenderResponse {
  bitmap?: ImageBitmap;
  error?: string;
  height: number;
  id: string;
  success: boolean;
  width: number;
}

const docCache = new Map<string, any>();

async function getDocument(source: ArrayBuffer | string): Promise<any> {
  const isUrl = typeof source === 'string';
  const cacheKey = isUrl ? source : null;
  if (cacheKey && docCache.has(cacheKey)) {
    return docCache.get(cacheKey);
  }

  const pdfjs = await import('pdfjs-dist');
  const task = isUrl
    ? pdfjs.getDocument({
        cMapPacked: true,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
        url: source,
      })
    : pdfjs.getDocument({
        cMapPacked: true,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        data: new Uint8Array(source),
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
      });

  const doc = await task.promise;
  if (cacheKey) {
    docCache.set(cacheKey, doc);
  }
  return doc;
}

self.onmessage = async (e: MessageEvent<WorkerRenderRequest>) => {
  const { dpr = 1, id, pageNum, source, targetWidth } = e.data;
  try {
    const doc = await getDocument(source);
    const page = await doc.getPage(pageNum);
    const origViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / Math.max(origViewport.width, 1);
    const viewport = page.getViewport({ scale });

    const pixelWidth = Math.floor(viewport.width * dpr);
    const pixelHeight = Math.floor(viewport.height * dpr);

    if (typeof OffscreenCanvas !== 'undefined') {
      const offscreen = new OffscreenCanvas(pixelWidth, pixelHeight);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }
      if (dpr !== 1) {
        ctx.scale(dpr, dpr);
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      const bitmap = offscreen.transferToImageBitmap();
      const res: WorkerRenderResponse = {
        bitmap,
        height: viewport.height,
        id,
        success: true,
        width: viewport.width,
      };
      (self as any).postMessage(res, [bitmap]);
    } else {
      throw new Error('OffscreenCanvas unsupported in worker');
    }
  } catch (err: any) {
    const res: WorkerRenderResponse = {
      error: err?.message || 'Render failed',
      height: 0,
      id,
      success: false,
      width: 0,
    };
    (self as any).postMessage(res);
  }
};
