type SummaryMode = 'standard' | 'advanced';

interface SummarizePdfParams {
  buffer: Buffer;
  customPrompt?: string;
  filename?: string;
  mode?: SummaryMode;
  originalname: string;
}

interface SummarizePdfResponse {
  characterCount: number;
  extractedChars: number;
  filename: string;
  mode: SummaryMode;
  model: string;
  summary: string;
  wordCount: number;
}

export type { SummarizePdfParams, SummarizePdfResponse, SummaryMode };
