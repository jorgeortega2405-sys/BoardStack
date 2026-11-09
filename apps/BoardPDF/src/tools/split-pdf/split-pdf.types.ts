type SplitMode = 'range' | 'pages' | 'size';

interface SplitRangeItem {
  from: number;
  to: number;
}

interface SplitPdfOptions {
  filename?: string;
  fixedPageCount?: number;
  maxSizeBytes?: number;
  mergeSelected?: boolean;
  mode: SplitMode;
  ranges?: SplitRangeItem[];
  selectedPages?: number[];
  submode?: 'all' | 'custom' | 'fixed';
}

interface StoredSplitResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  isZip: boolean;
  partsCount: number;
  size: number;
  totalPages: number;
}

interface SplitPdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  isZip: boolean;
  partsCount: number;
  totalPages: number;
}

export type { SplitMode, SplitPdfOptions, SplitPdfResponse, SplitRangeItem, StoredSplitResult };
