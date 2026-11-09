interface RotatePageItem {
  pageIndex: number;
  rotation: number;
}

interface RotatePdfOptions {
  filename?: string;
  globalRotation?: number;
  pages: RotatePageItem[];
}

interface RotatePdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

interface StoredRotatePdfResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pagesCount: number;
  size: number;
}

export type { RotatePageItem, RotatePdfOptions, RotatePdfResponse, StoredRotatePdfResult };
