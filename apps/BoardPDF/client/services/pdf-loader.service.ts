const docPromiseCache = new Map<string, Promise<any>>();
let pdfjsPromise: Promise<any> | null = null;

export async function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
      if (typeof window !== 'undefined') {
        (window as any).pdfjsLib = pdfjsLib;
        if ((pdfjsLib as any).GlobalWorkerOptions) {
          const v = (pdfjsLib as any).version || '5.7.284';
          (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `/vendor/pdfjs/pdf.worker.min.mjs?v=${v}`;
        }
      }
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

export async function loadPdfDocument(source: ArrayBuffer | string | Uint8Array, options: Record<string, any> = {}): Promise<any> {
  const cacheKey = typeof source === 'string' ? source : null;
  if (cacheKey && docPromiseCache.has(cacheKey)) {
    return docPromiseCache.get(cacheKey)!;
  }

  const promise = (async () => {
    const pdfjs = await loadPdfJs();
    let loadingTask: any;

    if (typeof source === 'string') {
      loadingTask = pdfjs.getDocument({
        cMapPacked: true,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
        url: source,
        ...options,
      });
    } else {
      const data = source instanceof Uint8Array ? source : new Uint8Array(source);
      loadingTask = pdfjs.getDocument({
        cMapPacked: true,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        data,
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
        ...options,
      });
    }

    return loadingTask.promise;
  })();

  if (cacheKey) {
    docPromiseCache.set(cacheKey, promise);
  }

  return promise;
}

export function clearPdfDocumentCache(sourceKey?: string): void {
  if (sourceKey) {
    docPromiseCache.delete(sourceKey);
  } else {
    docPromiseCache.clear();
  }
}
