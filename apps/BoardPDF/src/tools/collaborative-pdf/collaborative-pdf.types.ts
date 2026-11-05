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
  shapeType: string;
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

export interface CollaborativeElementTableCell {
  align?: 'center' | 'left' | 'right';
  backgroundColor?: string;
  color?: string;
  isBold?: boolean;
  text: string;
}

export interface CollaborativeElementTable {
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

export type ChartType =
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

export interface ChartDataSeries {
  color?: string;
  name: string;
  values: number[];
}

export interface ChartOptions {
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

export interface CollaborativeElementChart {
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

export type CollaborativeElement =
  | CollaborativeElementChart
  | CollaborativeElementDrawing
  | CollaborativeElementImage
  | CollaborativeElementShape
  | CollaborativeElementTable
  | CollaborativeElementText;

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
  pageSizes?: Array<{ height: number; width: number }>;
  pageTitles?: string[];
}

export interface CollaborativeMember {
  avatar_url?: string | null;
  created_at?: string;
  email?: string;
  id?: number;
  role: 'editor' | 'viewer';
  user_id: number;
  username: string;
}

export interface CollaborativeDocumentRecord {
  access_level?: 'anyone_with_link' | 'restricted';
  content: CollaborativeDocumentContent;
  created_at: string;
  id: string;
  members?: CollaborativeMember[];
  page_count: number;
  pdf_filename?: string | null;
  title: string;
  updated_at: string;
  user_id?: number | null;
}
