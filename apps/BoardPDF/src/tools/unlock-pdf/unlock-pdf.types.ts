interface UnlockPdfOptions {
  filename?: string;
  password?: string;
}

interface UnlockPdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

interface StoredUnlockPdfResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pagesCount: number;
  size: number;
}

export type { StoredUnlockPdfResult, UnlockPdfOptions, UnlockPdfResponse };
