type SplitMode = 'range' | 'pages' | 'size';

interface RangeItem {
  from: number;
  id: string;
  to: number;
}

interface PageItem {
  id: string;
  num: number;
  thumbnailDataUrl?: string;
}

interface SplitPdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  isZip: boolean;
  partsCount: number;
  totalPages: number;
}

export type { PageItem, RangeItem, SplitMode, SplitPdfResponseData };
