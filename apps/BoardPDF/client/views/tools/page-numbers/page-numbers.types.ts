type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

type PageNumberMargin = 'large' | 'recommended' | 'small';

type PageNumberMode = 'double' | 'single';

interface PageThumbnailItem {
  id: string;
  originalIndex: number;
  pageNum: number;
}

interface PageNumberResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

export type { PageNumberMargin, PageNumberMode, PageNumberPosition, PageNumberResponseData, PageThumbnailItem };
