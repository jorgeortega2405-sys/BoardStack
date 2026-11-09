interface PageOrderOption {
  pageIndex: number;
  rotation?: number;
}

interface OrganizePdfOptions {
  filename?: string;
  order?: 'asc' | 'reverse' | 'default';
  pagesOrder?: PageOrderOption[];
}

interface StoredOrganizePdfResult {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  filename: string;
  id: string;
  pagesCount: number;
  size: number;
}

interface OrganizePdfResponse {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalPages: number;
}

export type { OrganizePdfOptions, OrganizePdfResponse, PageOrderOption, StoredOrganizePdfResult };
