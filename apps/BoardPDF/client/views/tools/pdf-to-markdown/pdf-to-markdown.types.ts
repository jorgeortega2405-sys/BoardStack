type ClientMarkdownMode = 'academic' | 'clean' | 'structured' | 'tables';

interface PdfToMarkdownResultData {
  characterCount: number;
  downloadUrl: string;
  fileId: string;
  filename: string;
  lineCount: number;
  markdown: string;
  mode: ClientMarkdownMode;
  model: string;
  processingTimeMs: number;
  wordCount: number;
}

export type { ClientMarkdownMode, PdfToMarkdownResultData };
