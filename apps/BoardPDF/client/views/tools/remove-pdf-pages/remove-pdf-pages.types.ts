interface RemovePageItem {
  id: string;
  num: number;
  thumbnailDataUrl?: string;
}

interface RemovePdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  originalPages: number;
  remainingPages: number;
  removedPages: number;
}

export type { RemovePageItem, RemovePdfResponseData };
