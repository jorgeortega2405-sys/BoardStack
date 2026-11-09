interface RedactionBox {
  height: number;
  text?: string;
  width: number;
  x: number;
  y: number;
}

interface PageRedaction {
  boxes: RedactionBox[];
  fullPage?: boolean;
  pageIndex: number;
}

interface RedactPdfParams {
  buffer: Buffer;
  originalFilename?: string;
  redactions: PageRedaction[];
  redactionStyle?: 'solid' | 'strike';
  sanitizeMetadata?: boolean;
}

interface RedactPdfResponse {
  downloadUrl: string;
  fileId: string;
  fileSize: number;
  filename: string;
  redactedBoxesCount: number;
  redactedPagesCount: number;
  totalPages: number;
}

interface StoredRedactedPdf {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  fileId: string;
  filename: string;
  fileSize: number;
}

export type { PageRedaction, RedactPdfParams, RedactPdfResponse, RedactionBox, StoredRedactedPdf };
