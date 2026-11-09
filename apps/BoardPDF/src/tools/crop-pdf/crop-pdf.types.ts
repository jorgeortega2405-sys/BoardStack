interface CropBoxPercent {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface CropPdfOptions {
  applyToAll?: boolean;
  cropBox: CropBoxPercent;
  filename?: string;
  targetPageIndex?: number;
}

interface CropPdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

interface StoredCropPdfResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pagesCount: number;
  size: number;
}

export type { CropBoxPercent, CropPdfOptions, CropPdfResponse, StoredCropPdfResult };
