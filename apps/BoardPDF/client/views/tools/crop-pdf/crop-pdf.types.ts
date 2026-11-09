interface CropBoxPercent {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface CropPdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

export type { CropBoxPercent, CropPdfResponseData };
