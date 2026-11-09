type WatermarkType = 'image' | 'text';

type WatermarkPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'center-left'
  | 'center-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

interface PageThumbnailItem {
  id: string;
  originalIndex: number;
  pageNum: number;
}

interface WatermarkPdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

export type { PageThumbnailItem, WatermarkPdfResponseData, WatermarkPosition, WatermarkType };
