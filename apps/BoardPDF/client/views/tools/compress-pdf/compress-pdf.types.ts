type ClientPdfCompressLevel = 'extreme' | 'recommended' | 'low';

interface CompressResultData {
  compressedSize: number;
  downloadUrl: string;
  fileId: string;
  filename: string;
  originalSize: number;
  pageCount: number;
  savingsBytes: number;
  savingsPercent: number;
}

export type { ClientPdfCompressLevel, CompressResultData };
