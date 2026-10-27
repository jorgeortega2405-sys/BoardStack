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

export async function loadPdfDocument(source: ArrayBuffer | Uint8Array, options: Record<string, any> = {}): Promise<any> {
  const pdfjs = await loadPdfJs();
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const loadingTask = pdfjs.getDocument({
    cMapPacked: true,
    cMapUrl: '/vendor/pdfjs/cmaps/',
    data,
    standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
    ...options,
  });
  return loadingTask.promise;
}
