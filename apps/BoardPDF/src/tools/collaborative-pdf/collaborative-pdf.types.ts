interface CollaborativeElementText {
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

interface CollaborativeElementShape {
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

export type { ChartDataSeries, ChartOptions, ChartType, CollaborativeDocumentContent, CollaborativeDocumentRecord, CollaborativeElement, CollaborativeElementChart, CollaborativeElementDrawing, CollaborativeElementImage, CollaborativeElementShape, CollaborativeElementTable, CollaborativeElementTableCell, CollaborativeElementText, CollaborativeMember, CollaborativePdfPageSource };
