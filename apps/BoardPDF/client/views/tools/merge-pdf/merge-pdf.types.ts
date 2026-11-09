interface SelectedPdfItem {
  file: File;
  id: string;
  isEncrypted?: boolean;
  name: string;
  pageCount: number;
  size: number;
  thumbnailDataUrl?: string;
}

interface MergePdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  pageCount: number;
}

export type { MergePdfResponseData, SelectedPdfItem };
