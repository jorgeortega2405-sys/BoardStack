type PdfCompressLevel = 'extreme' | 'recommended' | 'low';

interface CompressPdfParams {
  buffer: Buffer;
  filename?: string;
  level: PdfCompressLevel;
  originalname: string;
}

interface CompressPdfResponse {
  compressedSize: number;
  downloadUrl: string;
  fileId: string;
  filename: string;
  originalSize: number;
  pageCount: number;
  savingsBytes: number;
  savingsPercent: number;
}

interface StoredCompressedPdf {
  buffer: Buffer;
  compressedSize: number;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  originalSize: number;
  pageCount: number;
  savingsPercent: number;
  size: number;
}

export type { CompressPdfParams, CompressPdfResponse, PdfCompressLevel, StoredCompressedPdf };
