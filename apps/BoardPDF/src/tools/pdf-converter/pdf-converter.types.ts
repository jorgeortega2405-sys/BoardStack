type ConversionType =
  | 'pdf-to-jpg'
  | 'pdf-to-word'
  | 'pdf-to-powerpoint'
  | 'pdf-to-excel'
  | 'pdf-to-pdfa';

type JpgConversionMode = 'pages' | 'extract';
type JpgQuality = 'normal' | 'high';
type OcrOption = 'no' | 'yes';
type ExcelSheetsOption = 'single' | 'multiple';
type PdfALevel = '1b' | '1a' | '2b' | '2u' | '2a' | '3b' | '3u' | '3a';

interface PdfConversionOptions {
  allowDowngrade?: boolean;
  excelSheets?: ExcelSheetsOption;
  jpgMode?: JpgConversionMode;
  jpgQuality?: JpgQuality;
  ocr?: OcrOption;
  pdfaLevel?: PdfALevel;
}

interface ConversionTypeConfig {
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

interface ConvertJobResult {
  downloadToken: string;
  downloadUrl: string;
  fileSize: number;
  filename: string;
  isZip: boolean;
  mimeType: string;
  success: boolean;
}

interface StoredConversionFile {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filePath?: string;
  filename: string;
  isZip?: boolean;
  mimeType: string;
  token: string;
}

export type { ConversionType, ConversionTypeConfig, ConvertJobResult, ExcelSheetsOption, JpgConversionMode, JpgQuality, OcrOption, PdfALevel, PdfConversionOptions, StoredConversionFile };
