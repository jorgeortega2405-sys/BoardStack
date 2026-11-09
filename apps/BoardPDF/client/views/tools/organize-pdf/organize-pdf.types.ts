interface OrganizePageItem {
  id: string;
  originalIndex: number;
  pageNum: number;
  rotation: number;
  thumbnailDataUrl?: string;
}

interface OrganizePdfResponseData {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

export type { OrganizePageItem, OrganizePdfResponseData };
