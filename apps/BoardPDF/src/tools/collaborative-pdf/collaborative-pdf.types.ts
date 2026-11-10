interface CollaborativeElementText {
  align?: 'center' | 'justify' | 'left' | 'right';
  authorName?: string;
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize: number;
  fontStyle?: 'italic' | 'normal';
  fontWeight?: number | string;
  height?: number;
  id: string;
  isBold?: boolean;
  isItalic?: boolean;
  isStickyNote?: boolean;
  isStrikethrough?: boolean;
  isUnderline?: boolean;
  isUppercase?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  listType?: 'bullet' | 'none' | 'numbered';
  opacity?: number;
  pageIndex: number;
  rotation?: number;
  text: string;
  type: 'text';
  verticalAlign?: 'bottom' | 'middle' | 'top';
  width?: number;
  x: number;
  y: number;
}

interface CollaborativeElementShape {
  borderRadius?: number;
  fillColor?: string;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  height: number;
  id: string;
  opacity?: number;
  pageIndex: number;
  rotation?: number;
  shapeType: string;
  sides?: number;
  strokeColor: string;
  strokeStyle?: 'dashed' | 'dotted' | 'long-dash' | 'none' | 'solid';
  strokeWidth: number;
  type: 'shape';
  width: number;
  x: number;
  x2?: number;
  y: number;
  y2?: number;
}

interface CollaborativeElementDrawing {
  color: string;
  id: string;
  opacity?: number;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  type: 'drawing';
  width: number;
}

interface CollaborativeElementImage {
  borderColor?: string;
  borderRadius?: number;
  borderStyle?: 'dashed' | 'dotted' | 'long-dash' | 'none' | 'solid';
  borderWidth?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  height: number;
  id: string;
  name?: string;
  opacity?: number;
  pageIndex: number;
  rotation?: number;
  type: 'image';
  url: string;
  width: number;
  x: number;
  y: number;
}

interface CollaborativeElementTableCell {
  align?: 'center' | 'left' | 'right';
  backgroundColor?: string;
  color?: string;
  isBold?: boolean;
  text: string;
}

interface CollaborativeElementTable {
  borderColor?: string;
  borderWidth?: number;
  cellPadding?: number;
  cellSpacing?: number;
  cells: CollaborativeElementTableCell[][];
  cols: number;
  headerColor?: string;
  height: number;
  id: string;
  pageIndex: number;
  rotation?: number;
  rowHeights?: number[];
  rows: number;
  tableStyle?: 'cards' | 'grid' | 'header-accent';
  themeColor?: string;
  type: 'table';
  width: number;
  x: number;
  y: number;
}

type ChartType =
  | 'area-overlap'
  | 'area-stacked'
  | 'bar-grouped'
  | 'bar-horizontal'
  | 'bar-stacked'
  | 'bar-vertical'
  | 'donut'
  | 'line'
  | 'line-multi'
  | 'pie'
  | 'progress-bar'
  | 'progress-gauge'
  | 'progress-ring'
  | 'scatter';

interface ChartDataSeries {
  color?: string;
  name: string;
  values: number[];
}

interface ChartOptions {
  colorPalette?: string[];
  colorScheme?: 'amber' | 'blue' | 'emerald' | 'gray' | 'purple' | 'red';
  currencyOrUnit?: string;
  dataLabelDecimals?: number;
  dataLabelPrefix?: string;
  dataLabelSuffix?: string;
  donutHolePercent?: number;
  labelColumnName?: string;
  legendPosition?: 'bottom' | 'right' | 'top';
  orientation?: 'horizontal' | 'vertical';
  percentageValue?: number;
  showDataLabels?: boolean;
  showGridLines?: boolean;
  showLegend?: boolean;
  showXLabels?: boolean;
  showYLabels?: boolean;
  stackedMode?: 'grouped' | 'normal' | 'percent';
  subtitle?: string;
  title?: string;
  xAxisTitle?: string;
  yAxisMax?: number | null;
  yAxisMin?: number | null;
  yAxisTitle?: string;
}

interface CollaborativeElementChart {
  chartType: ChartType;
  height: number;
  id: string;
  labels: string[];
  options: ChartOptions;
  pageIndex: number;
  rotation?: number;
  series: ChartDataSeries[];
  type: 'chart';
  width: number;
  x: number;
  y: number;
}

type CollaborativeElement =
  | CollaborativeElementChart
  | CollaborativeElementDrawing
  | CollaborativeElementImage
  | CollaborativeElementShape
  | CollaborativeElementTable
  | CollaborativeElementText;

interface CollaborativePdfPageSource {
  pageNumber: number;
  pdfUrl: string;
}

interface CollaborativeDocumentContent {
  elements: CollaborativeElement[];
  pageBackgrounds?: string[];
  pageCount: number;
  pagePdfSources?: Array<CollaborativePdfPageSource | null>;
  pageSize?: { height: number; width: number };
  pageSizes?: Array<{ height: number; width: number }>;
  pageTitles?: string[];
}

interface CollaborativeMember {
  avatar_url?: string | null;
  created_at?: string;
  email?: string;
  id?: number;
  role: 'editor' | 'viewer';
  user_id: number;
  username: string;
}

interface CollaborativeAiLockInfo {
  locked: boolean;
  lockedBy?: string;
  lockedByUserId?: number;
  startedAt?: string;
}

interface CollaborativeDocumentRecord {
  access_level?: 'anyone_with_link' | 'restricted';
  content: CollaborativeDocumentContent;
  created_at: string;
  folder_id?: string | null;
  id: string;
  members?: CollaborativeMember[];
  page_count: number;
  pdf_filename?: string | null;
  title: string;
  updated_at: string;
  user_id?: number | null;
}

export type { ChartDataSeries, ChartOptions, ChartType, CollaborativeAiLockInfo, CollaborativeDocumentContent, CollaborativeDocumentRecord, CollaborativeElement, CollaborativeElementChart, CollaborativeElementDrawing, CollaborativeElementImage, CollaborativeElementShape, CollaborativeElementTable, CollaborativeElementTableCell, CollaborativeElementText, CollaborativeMember, CollaborativePdfPageSource };
