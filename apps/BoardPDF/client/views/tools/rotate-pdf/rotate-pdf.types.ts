interface RotatePageItem {
  id: string;
  originalIndex: number;
  pageNum: number;
  rotation: number;
  thumbnailUrl?: string;
}

interface RotatePdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

export type { RotatePageItem, RotatePdfResponseData };
