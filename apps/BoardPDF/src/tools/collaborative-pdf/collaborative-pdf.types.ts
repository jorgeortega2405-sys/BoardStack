export interface CollaborativeElementText {
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize: number;
  height?: number;
  id: string;
  isBold?: boolean;
  isStickyNote?: boolean;
  pageIndex: number;
  rotation?: number;
  text: string;
  type: 'text';
  width?: number;
  x: number;
  y: number;
}

export interface CollaborativeElementShape {
  fillColor?: string;
  height: number;
  id: string;
  pageIndex: number;
  rotation?: number;
  shapeType: 'arrow' | 'circle' | 'diamond' | 'line' | 'line-flexible' | 'line-multiconnect' | 'rect' | 'star' | 'triangle';
  strokeColor: string;
  strokeWidth: number;
  type: 'shape';
  width: number;
  x: number;
  x2?: number;
  y: number;
  y2?: number;
}

export interface CollaborativeElementDrawing {
  color: string;
  id: string;
  opacity?: number;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  type: 'drawing';
  width: number;
}

export interface CollaborativeElementImage {
  height: number;
  id: string;
  name?: string;
  pageIndex: number;
  rotation?: number;
  type: 'image';
  url: string;
  width: number;
  x: number;
  y: number;
}

export type CollaborativeElement =
  | CollaborativeElementText
  | CollaborativeElementShape
  | CollaborativeElementDrawing
  | CollaborativeElementImage;

export interface CollaborativePdfPageSource {
  pageNumber: number;
  pdfUrl: string;
}

export interface CollaborativeDocumentContent {
  elements: CollaborativeElement[];
  pageBackgrounds?: string[];
  pageCount: number;
  pagePdfSources?: Array<CollaborativePdfPageSource | null>;
  pageSize?: { height: number; width: number };
  pageTitles?: string[];
}

export interface CollaborativeDocumentRecord {
  content: CollaborativeDocumentContent;
  created_at: string;
  id: string;
  page_count: number;
  pdf_filename?: string | null;
  title: string;
  updated_at: string;
  user_id?: number | null;
}
