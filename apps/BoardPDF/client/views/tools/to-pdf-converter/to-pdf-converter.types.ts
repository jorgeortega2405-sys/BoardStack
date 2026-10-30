export type ToPdfSourceType =
  | 'excel-to-pdf'
  | 'html-to-pdf'
  | 'jpg-to-pdf'
  | 'powerpoint-to-pdf'
  | 'word-to-pdf';

export type JpgOrientation = 'portrait' | 'landscape';
export type JpgPageSize = 'fit' | 'a4' | 'letter';
export type JpgPageMargin = 'none' | 'small' | 'large';

export type HtmlScreenSize = 'screen' | '1920' | '1440' | '768' | '320';
export type HtmlOrientation = 'portrait' | 'landscape';
export type HtmlMargin = 'none' | 'small' | 'large';

export interface ToPdfRouteConfig {
  accept: string;
  actionText: string;
  browseText?: string;
  convertingText: string;
  formatBadge: string;
  hintText?: string;
  icon: string;
  isUrlMode?: boolean;
  sourceType: ToPdfSourceType;
  subtitle: string;
  title: string;
}

export const TO_PDF_CONFIGS: Record<string, ToPdfRouteConfig> = {
  '/excel-to-pdf': {
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    actionText: 'Convertir a PDF',
    browseText: 'Seleccionar Archivo',
    convertingText: 'Convirtiendo hojas de cálculo a PDF...',
    formatBadge: 'XLSX / XLS',
    hintText: 'o arrastra y suelta tu archivo aquí',
    icon: 'table_chart',
    sourceType: 'excel-to-pdf',
    subtitle: 'Convierte tus libros y hojas de Excel en documentos PDF de alta precisión.',
    title: 'Excel a PDF',
  },
  '/html-a-pdf': {
    accept: '.html,.htm,text/html',
    actionText: 'Convertir a PDF',
    browseText: 'Ingresar URL',
    convertingText: 'Renderizando página web a PDF...',
    formatBadge: 'URL / HTML',
    hintText: 'Pega la URL de cualquier página web para convertirla a PDF',
    icon: 'language',
    isUrlMode: true,
    sourceType: 'html-to-pdf',
    subtitle: 'Transforma páginas web y archivos HTML en documentos PDF formateados.',
    title: 'HTML a PDF',
  },
  '/html-to-pdf': {
    accept: '.html,.htm,text/html',
    actionText: 'Convertir a PDF',
    browseText: 'Ingresar URL',
    convertingText: 'Renderizando página web a PDF...',
    formatBadge: 'URL / HTML',
    hintText: 'Pega la URL de cualquier página web para convertirla a PDF',
    icon: 'language',
    isUrlMode: true,
    sourceType: 'html-to-pdf',
    subtitle: 'Transforma páginas web y archivos HTML en documentos PDF formateados.',
    title: 'HTML a PDF',
  },
  '/jpg-to-pdf': {
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    actionText: 'Convertir a PDF',
    browseText: 'Seleccionar Archivo',
    convertingText: 'Convirtiendo imágenes a PDF...',
    formatBadge: 'JPG / PNG',
    hintText: 'o arrastra y suelta tu archivo aquí',
    icon: 'image',
    sourceType: 'jpg-to-pdf',
    subtitle: 'Convierte tus imágenes JPG, JPEG o PNG en un documento PDF de alta calidad.',
    title: 'JPG a PDF',
  },
  '/powerpoint-to-pdf': {
    accept: '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint',
    actionText: 'Convertir a PDF',
    browseText: 'Seleccionar Archivo',
    convertingText: 'Convirtiendo diapositivas a PDF...',
    formatBadge: 'PPTX / PPT',
    hintText: 'o arrastra y suelta tu archivo aquí',
    icon: 'slideshow',
    sourceType: 'powerpoint-to-pdf',
    subtitle: 'Convierte tus presentaciones de PowerPoint a PDF manteniendo diapositivas y formato.',
    title: 'PowerPoint a PDF',
  },
  '/word-to-pdf': {
    accept: '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword',
    actionText: 'Convertir a PDF',
    browseText: 'Seleccionar Archivo',
    convertingText: 'Convirtiendo documento Word a PDF...',
    formatBadge: 'DOCX / DOC',
    hintText: 'o arrastra y suelta tu archivo aquí',
    icon: 'description',
    sourceType: 'word-to-pdf',
    subtitle: 'Convierte tus documentos de Word a archivos PDF conservando estilos y tipografía.',
    title: 'Word a PDF',
  },
};
