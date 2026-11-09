interface TranslatePdfParams {
  buffer: Buffer;
  filename: string;
  layoutMode?: 'preserve' | 'text_only';
  originalname?: string;
  sourceLang?: string;
  targetLang: string;
}

interface TranslatePdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  format: string;
  originalname: string;
  size: number;
  sourceLang?: string;
  targetLang: string;
}

interface StoredTranslatedPdf {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  format: string;
  originalname: string;
  size: number;
  sourceLang?: string;
  targetLang: string;
}

export type { StoredTranslatedPdf, TranslatePdfParams, TranslatePdfResponse };
