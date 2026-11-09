type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';

type PageNumberMargin = 'large' | 'recommended' | 'small';

type PageNumberMode = 'double' | 'single';

interface PageNumberOptions {
  filename?: string;
  firstPageIsCover?: boolean;
  fontFamily?: 'Courier' | 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman';
  fontSize?: number;
  format?: string;
  fromPage?: number;
  margin?: PageNumberMargin;
  mode?: PageNumberMode;
  position?: PageNumberPosition;
  startNumber?: number;
  toPage?: number;
}

interface PageNumberResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

interface StoredPageNumberResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pagesCount: number;
  size: number;
}

export type { PageNumberMargin, PageNumberMode, PageNumberOptions, PageNumberPosition, PageNumberResponse, StoredPageNumberResult };
