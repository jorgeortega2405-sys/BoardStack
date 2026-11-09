type CompareViewMode = 'semantic' | 'overlay';

interface ClientDiffItem {
  diffCount: number;
  id: string;
  newText?: string;
  oldText?: string;
  pageIndex: number;
  type: 'addition' | 'deletion' | 'modification' | 'unchanged';
}

interface ClientPageComparison {
  changes: ClientDiffItem[];
  differencesCount: number;
  hasDifferences: boolean;
  pageIndex: number;
}

interface ComparePdfResultData {
  additionsCount: number;
  deletionsCount: number;
  downloadUrl: string;
  fileId: string;
  fileSize: number;
  filename: string;
  pageComparisons: ClientPageComparison[];
  pagesCompared: number;
  similarityPercentage: number;
  totalChanges: number;
}

export type { ClientDiffItem, ClientPageComparison, ComparePdfResultData, CompareViewMode };
