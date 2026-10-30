export type ConversionType =
  | 'pdf-to-jpg'
  | 'pdf-to-word'
  | 'pdf-to-powerpoint'
  | 'pdf-to-excel'
  | 'pdf-to-pdfa';

export type JpgConversionMode = 'pages' | 'extract';
export type JpgQuality = 'normal' | 'high';
export type OcrOption = 'no' | 'yes';
export type ExcelSheetsOption = 'single' | 'multiple';
export type PdfALevel = '1b' | '1a' | '2b' | '2u' | '2a' | '3b' | '3u' | '3a';

export interface PdfConversionOptions {
  allowDowngrade?: boolean;
  excelSheets?: ExcelSheetsOption;
  jpgMode?: JpgConversionMode;
  jpgQuality?: JpgQuality;
  ocr?: OcrOption;
  pdfaLevel?: PdfALevel;
}

export interface ConversionTypeConfig {
  actionBtnKey: string;
  badgeLabel: string;
  colorClass: string;
  descKey: string;
  icon: string;
  mimeType: string;
  nameKey: string;
  outputExt: string;
  type: ConversionType;
}

export interface ConvertJobResult {
  downloadToken: string;
  downloadUrl: string;
  fileSize: number;
  filename: string;
  isZip: boolean;
  mimeType: string;
  success: boolean;
}

export interface StoredConversionFile {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filePath?: string;
  filename: string;
  isZip?: boolean;
  mimeType: string;
  token: string;
}
