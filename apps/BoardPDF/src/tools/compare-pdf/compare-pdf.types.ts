type DiffChangeType = 'addition' | 'deletion' | 'modification' | 'unchanged';

interface DiffChangeItem {
  diffCount: number;
  id: string;
  newText?: string;
  oldText?: string;
  pageIndex: number;
  type: DiffChangeType;
}

interface PageComparison {
  changes: DiffChangeItem[];
  differencesCount: number;
  hasDifferences: boolean;
  pageIndex: number;
}

interface ComparePdfParams {
  buffer1: Buffer;
  buffer2: Buffer;
  comparisonMode?: 'semantic' | 'overlay';
  filename1?: string;
  filename2?: string;
}

interface ComparePdfResponse {
  additionsCount: number;
  deletionsCount: number;
  downloadUrl: string;
  fileId: string;
  fileSize: number;
  filename: string;
  pageComparisons: PageComparison[];
  pagesCompared: number;
  similarityPercentage: number;
  totalChanges: number;
}

interface StoredComparisonReport {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
  fileId: string;
  fileSize: number;
  filename: string;
}

export type { ComparePdfParams, ComparePdfResponse, DiffChangeItem, DiffChangeType, PageComparison, StoredComparisonReport };
