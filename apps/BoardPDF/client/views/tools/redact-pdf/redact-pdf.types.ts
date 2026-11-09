interface ClientRedactionBox {
  height: number;
  id: string;
  pageIndex: number;
  text?: string;
  width: number;
  x: number;
  y: number;
}

type ClientRedactTool = 'draw-box' | 'select-text';

interface RedactPdfResultData {
  downloadUrl: string;
  fileId: string;
  fileSize: number;
  filename: string;
  redactedBoxesCount: number;
  redactedPagesCount: number;
  totalPages: number;
}

export type { ClientRedactTool, ClientRedactionBox, RedactPdfResultData };
