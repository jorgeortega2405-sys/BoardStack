interface StoredMergedPdf {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pageCount: number;
  size: number;
}

interface MergePdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  pageCount: number;
}

export type { MergePdfResponse, StoredMergedPdf };
