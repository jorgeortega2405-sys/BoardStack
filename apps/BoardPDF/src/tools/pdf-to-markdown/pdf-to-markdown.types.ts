type MarkdownConversionMode = 'academic' | 'clean' | 'structured' | 'tables';

interface PdfToMarkdownParams {
  buffer: Buffer;
  customPrompt?: string;
  includeMathLatex?: boolean;
  mode?: MarkdownConversionMode;
  originalname?: string;
  preserveTables?: boolean;
  removeHeadersFooters?: boolean;
}

interface PdfToMarkdownResponse {
  characterCount: number;
  downloadUrl: string;
  fileId: string;
  filename: string;
  lineCount: number;
  markdown: string;
  mode: MarkdownConversionMode;
  model: string;
  processingTimeMs: number;
  wordCount: number;
}

interface StoredMarkdownFile {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  fileId: string;
  filename: string;
  fileSize: number;
  markdown: string;
}

export type { MarkdownConversionMode, PdfToMarkdownParams, PdfToMarkdownResponse, StoredMarkdownFile };
