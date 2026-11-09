interface ProtectPdfOptions {
  filename?: string;
  password: string;
}

interface ProtectPdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

interface StoredProtectPdfResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pagesCount: number;
  size: number;
}

export type { ProtectPdfOptions, ProtectPdfResponse, StoredProtectPdfResult };
