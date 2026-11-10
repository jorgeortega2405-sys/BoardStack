interface ElementText {
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

interface ElementShape {
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

interface ElementDrawing {
  color: string;
  id: string;
  opacity?: number;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  type: 'drawing';
  width: number;
}

interface ElementImage {
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

interface ElementTableCell {
  align?: 'center' | 'left' | 'right';
  backgroundColor?: string;
  color?: string;
  isBold?: boolean;
  text: string;
}

interface ElementTable {
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
  cellSpacing: number;
  cells: ElementTableCell[][];
  cols: number;
  headerColor: string;
  height: number;
  id: string;
  pageIndex?: number;
  rotation?: number;
  rowHeights: number[];
  rows: number;
  tableStyle: 'cards' | 'grid' | 'header-accent';
  themeColor: string;
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

interface ElementChartDataSeries {
  color?: string;
  name: string;
  values: number[];
}

interface ElementChartOptions {
  colorPalette?: string[];
  colorScheme?: 'amber' | 'blue' | 'coral' | 'emerald' | 'gray' | 'purple';
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

interface ElementChart {
  chartType: ChartType;
  height: number;
  id: string;
  labels: string[];
  options: ElementChartOptions;
  pageIndex?: number;
  rotation?: number;
  series: ElementChartDataSeries[];
  type: 'chart';
  width: number;
  x: number;
  y: number;
}

type EditorElement = ElementChart | ElementDrawing | ElementImage | ElementShape | ElementTable | ElementText;

interface PagePdfSource {
  pageNumber: number;
  pdfUrl: string;
}

interface UploadedAsset {
  createdAt?: string;
  id: string;
  mimeType?: string;
  name: string;
  pageCount?: number;
  size: number;
  type: 'image' | 'pdf';
  url: string;
}

interface DocMember {
  avatar_url?: string | null;
  email?: string;
  id?: number;
  role: 'editor' | 'viewer';
  user_id: number;
  username: string;
}

interface RemotePeer {
  avatarUrl?: string | null;
  clientId: string;
  color: string;
  isGuest?: boolean;
  userId?: number | null;
  username: string;
}

interface ManualGuide {
  id: string;
  orientation: 'h' | 'v';
  pageIndex: number;
  position: number;
}

const CHART_PALETTES: Record<string, string[]> = {
  amber: ['#d97706', '#f59e0b', '#fbbf24', '#fde68a'],
  blue: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
  coral: ['#e11d48', '#f43f5e', '#fb7185', '#fecdd3'],
  emerald: ['#059669', '#10b981', '#34d399', '#a7f3d0'],
  gray: ['#374151', '#4b5563', '#9ca3af', '#d1d5db'],
  purple: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'],
};

function applyListFormatting(text: string, type: 'bullet' | 'none' | 'numbered'): string {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const cleaned = line.replace(/^([•\-\*]|\d+[\.\)])\s*/, '').trim();
    if (!cleaned) return '';
    if (type === 'bullet') return `• ${cleaned}`;
    if (type === 'numbered') return `${idx + 1}. ${cleaned}`;
    return cleaned;
  }).join('\n');
}

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

export { CHART_PALETTES, PAGE_HEIGHT, PAGE_WIDTH, applyListFormatting };
export type { ChartType, DocMember, EditorElement, ElementChart, ElementChartDataSeries, ElementChartOptions, ElementDrawing, ElementImage, ElementShape, ElementTable, ElementTableCell, ElementText, ManualGuide, PagePdfSource, RemotePeer, UploadedAsset };
