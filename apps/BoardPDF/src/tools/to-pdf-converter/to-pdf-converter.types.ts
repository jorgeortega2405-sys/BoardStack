export type ToPdfSourceType =
  | 'excel-to-pdf'
  | 'html-to-pdf'
  | 'jpg-to-pdf'
  | 'powerpoint-to-pdf'
  | 'word-to-pdf';

export type JpgOrientation = 'portrait' | 'landscape';
export type JpgPageSize = 'fit' | 'a4' | 'letter';
export type JpgPageMargin = 'none' | 'small' | 'large';

export interface JpgToPdfOptions {
  margin?: JpgPageMargin;
  merge?: boolean;
  orientation?: JpgOrientation;
  pageSize?: JpgPageSize;
}

export type HtmlScreenSize = 'screen' | '1920' | '1440' | '768' | '320';
export type HtmlOrientation = 'portrait' | 'landscape';
export type HtmlMargin = 'none' | 'small' | 'large';

export interface HtmlToPdfOptions {
  blockAds?: boolean;
  margin?: HtmlMargin;
  orientation?: HtmlOrientation;
  removePopups?: boolean;
  screen?: HtmlScreenSize;
  singlePage?: boolean;
}

export interface ToPdfConversionResult {
  downloadToken: string;
  downloadUrl: string;
  fileSize: number;
  filename: string;
  originalSize: number;
  success: boolean;
}

export interface StoredToPdfFile {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filePath?: string;
  filename: string;
  mimeType: string;
  token: string;
}
