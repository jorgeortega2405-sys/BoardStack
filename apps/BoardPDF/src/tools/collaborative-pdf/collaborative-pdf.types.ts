export interface CollaborativeElementText {
  color?: string;
  fontFamily?: string;
  fontSize: number;
  height?: number;
  id: string;
  isBold?: boolean;
  pageIndex: number;
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
  shapeType: 'circle' | 'line' | 'rect';
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
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  type: 'drawing';
  width: number;
}

export type CollaborativeElement =
  | CollaborativeElementText
  | CollaborativeElementShape
  | CollaborativeElementDrawing;

export interface CollaborativeDocumentContent {
  elements: CollaborativeElement[];
  pageCount: number;
  pageSize?: { height: number; width: number };
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
