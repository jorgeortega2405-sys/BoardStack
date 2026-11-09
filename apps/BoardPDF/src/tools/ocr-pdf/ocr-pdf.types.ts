type OcrLanguage = string;

interface OcrPdfParams {
  buffer: Buffer;
  deskew?: boolean;
  filename?: string;
  language?: OcrLanguage;
  originalname: string;
}

interface OcrPdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  language: string;
  originalSize: number;
  pageCount: number;
  processedSize: number;
}

interface StoredOcrPdf {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  language: string;
  originalSize: number;
  pageCount: number;
  size: number;
}

export type { OcrLanguage, OcrPdfParams, OcrPdfResponse, StoredOcrPdf };
