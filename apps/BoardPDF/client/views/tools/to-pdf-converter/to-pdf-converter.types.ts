import { t } from '../../../services/i18n.service.js';
type ToPdfSourceType =
  | 'excel-to-pdf'
  | 'html-to-pdf'
  | 'jpg-to-pdf'
  | 'powerpoint-to-pdf'
  | 'word-to-pdf';

type JpgOrientation = 'portrait' | 'landscape';
type JpgPageSize = 'fit' | 'a4' | 'letter';
type JpgPageMargin = 'none' | 'small' | 'large';

type HtmlScreenSize = 'screen' | '1920' | '1440' | '768' | '320';
type HtmlOrientation = 'portrait' | 'landscape';
type HtmlMargin = 'none' | 'small' | 'large';

interface ToPdfRouteConfig {
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

const TO_PDF_CONFIGS: Record<string, ToPdfRouteConfig> = {
  '/excel-to-pdf': {
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    actionText: 'Convertir a PDF',
    browseText: 'Seleccionar Archivo',
    convertingText: t('ui.convirtiendo_hojas_de_calculo_a_pdf'),
    formatBadge: 'XLSX / XLS',
    hintText: 'o arrastra y suelta tu archivo aquí',
    icon: 'table_chart',
    sourceType: 'excel-to-pdf',
    subtitle: t('ui.convierte_tus_libros_y_hojas_de_excel_en'),
    title: 'Excel a PDF',
  },
  '/html-a-pdf': {
    accept: '.html,.htm,text/html',
    actionText: 'Convertir a PDF',
    browseText: 'Ingresar URL',
    convertingText: 'Renderizando página web a PDF...',
    formatBadge: 'URL / HTML',
    hintText: t('ui.pega_la_url_de_cualquier_pagina_web_para'),
    icon: 'language',
    isUrlMode: true,
    sourceType: 'html-to-pdf',
    subtitle: t('ui.transforma_paginas_web_y_archivos_html_e'),
    title: 'HTML a PDF',
  },
  '/html-to-pdf': {
    accept: '.html,.htm,text/html',
    actionText: 'Convertir a PDF',
    browseText: 'Ingresar URL',
    convertingText: 'Renderizando página web a PDF...',
    formatBadge: 'URL / HTML',
    hintText: t('ui.pega_la_url_de_cualquier_pagina_web_para'),
    icon: 'language',
    isUrlMode: true,
    sourceType: 'html-to-pdf',
    subtitle: t('ui.transforma_paginas_web_y_archivos_html_e'),
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
    subtitle: t('ui.convierte_tus_imagenes_jpg_jpeg_o_png_en'),
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
    subtitle: t('ui.convierte_tus_presentaciones_de_powerpoi'),
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
    subtitle: t('ui.convierte_tus_documentos_de_word_a_archi'),
    title: 'Word a PDF',
  },
};

export { TO_PDF_CONFIGS };
export type { HtmlMargin, HtmlOrientation, HtmlScreenSize, JpgOrientation, JpgPageMargin, JpgPageSize, ToPdfRouteConfig, ToPdfSourceType };
