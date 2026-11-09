type EditShapeType = 'circle' | 'line' | 'rect';

interface EditColorRgb {
  b: number;
  g: number;
  r: number;
}

interface EditTextAddition {
  color?: string;
  fontFamily?: string;
  fontSize: number;
  id: string;
  pageIndex: number;
  text: string;
  x: number;
  y: number;
}

interface EditTextReplacement {
  color?: string;
  fontFamily?: string;
  fontSize: number;
  height: number;
  id: string;
  newText: string;
  originalText: string;
  pageIndex: number;
  width: number;
  x: number;
  y: number;
}

interface EditShapeItem {
  fillColor?: string;
  height?: number;
  id: string;
  pageIndex: number;
  strokeColor: string;
  strokeWidth: number;
  type: EditShapeType;
  width?: number;
  x: number;
  x2?: number;
  y: number;
  y2?: number;
}

interface EditDrawingStroke {
  color: string;
  id: string;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  width: number;
}

interface EditImagePlacement {
  height: number;
  id: string;
  imageIndex: number;
  pageIndex: number;
  width: number;
  x: number;
  y: number;
}

interface EditPdfModifications {
  drawings?: EditDrawingStroke[];
  images?: EditImagePlacement[];
  replacements?: EditTextReplacement[];
  shapes?: EditShapeItem[];
  texts?: EditTextAddition[];
}

interface EditPdfResult {
  downloadUrl: string;
  fileId: string;
  filename: string;
  fileSize: number;
  pageCount: number;
}

export type { EditColorRgb, EditDrawingStroke, EditImagePlacement, EditPdfModifications, EditPdfResult, EditShapeItem, EditShapeType, EditTextAddition, EditTextReplacement };
