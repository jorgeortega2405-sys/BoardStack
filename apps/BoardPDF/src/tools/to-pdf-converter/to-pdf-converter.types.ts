type ToPdfSourceType =
  | 'excel-to-pdf'
  | 'html-to-pdf'
  | 'jpg-to-pdf'
  | 'powerpoint-to-pdf'
  | 'word-to-pdf';

type JpgOrientation = 'portrait' | 'landscape';
type JpgPageSize = 'fit' | 'a4' | 'letter';
type JpgPageMargin = 'none' | 'small' | 'large';

interface JpgToPdfOptions {
  margin?: JpgPageMargin;
  merge?: boolean;
  orientation?: JpgOrientation;
  pageSize?: JpgPageSize;
}

type HtmlScreenSize = 'screen' | '1920' | '1440' | '768' | '320';
type HtmlOrientation = 'portrait' | 'landscape';
type HtmlMargin = 'none' | 'small' | 'large';

interface HtmlToPdfOptions {
  blockAds?: boolean;
  margin?: HtmlMargin;
  orientation?: HtmlOrientation;
  removePopups?: boolean;
  screen?: HtmlScreenSize;
  singlePage?: boolean;
}

interface ToPdfConversionResult {
  downloadToken: string;
  downloadUrl: string;
  fileSize: number;
  filename: string;
  originalSize: number;
  success: boolean;
}

interface StoredToPdfFile {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filePath?: string;
  filename: string;
  mimeType: string;
  token: string;
}

export type { HtmlMargin, HtmlOrientation, HtmlScreenSize, HtmlToPdfOptions, JpgOrientation, JpgPageMargin, JpgPageSize, JpgToPdfOptions, StoredToPdfFile, ToPdfConversionResult, ToPdfSourceType };
