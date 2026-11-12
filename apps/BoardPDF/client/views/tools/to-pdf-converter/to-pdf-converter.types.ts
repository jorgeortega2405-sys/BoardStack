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
  actionTextKey: string;
  browseTextKey: string;
  convertingTextKey: string;
  formatBadge: string;
  hintTextKey: string;
  icon: string;
  isUrlMode?: boolean;
  sourceType: ToPdfSourceType;
  subtitleKey: string;
  titleKey: string;
}

const TO_PDF_CONFIGS: Record<string, ToPdfRouteConfig> = {
  '/excel-to-pdf': {
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    actionTextKey: 'tools.to_pdf_convert_btn',
    browseTextKey: 'tools.select_file_btn',
    convertingTextKey: 'ui.convirtiendo_hojas_de_calculo_a_pdf',
    formatBadge: 'XLSX / XLS',
    hintTextKey: 'common.drop_file_hint',
    icon: 'table_chart',
    sourceType: 'excel-to-pdf',
    subtitleKey: 'ui.convierte_tus_libros_y_hojas_de_excel_en',
    titleKey: 'tools.excel_to_pdf_title',
  },
  '/html-a-pdf': {
    accept: '.html,.htm,text/html',
    actionTextKey: 'tools.to_pdf_convert_btn',
    browseTextKey: 'tools.html_to_pdf.add_url_btn',
    convertingTextKey: 'tools.html_to_pdf_converting',
    formatBadge: 'URL / HTML',
    hintTextKey: 'ui.pega_la_url_de_cualquier_pagina_web_para',
    icon: 'language',
    isUrlMode: true,
    sourceType: 'html-to-pdf',
    subtitleKey: 'ui.transforma_paginas_web_y_archivos_html_e',
    titleKey: 'tools.html_to_pdf_title',
  },
  '/html-to-pdf': {
    accept: '.html,.htm,text/html',
    actionTextKey: 'tools.to_pdf_convert_btn',
    browseTextKey: 'tools.html_to_pdf.add_url_btn',
    convertingTextKey: 'tools.html_to_pdf_converting',
    formatBadge: 'URL / HTML',
    hintTextKey: 'ui.pega_la_url_de_cualquier_pagina_web_para',
    icon: 'language',
    isUrlMode: true,
    sourceType: 'html-to-pdf',
    subtitleKey: 'ui.transforma_paginas_web_y_archivos_html_e',
    titleKey: 'tools.html_to_pdf_title',
  },
  '/jpg-to-pdf': {
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    actionTextKey: 'tools.to_pdf_convert_btn',
    browseTextKey: 'tools.select_files_btn',
    convertingTextKey: 'tools.jpg_to_pdf_converting',
    formatBadge: 'JPG / PNG',
    hintTextKey: 'common.drop_files_hint',
    icon: 'photo_library',
    sourceType: 'jpg-to-pdf',
    subtitleKey: 'ui.convierte_tus_imagenes_jpg_jpeg_o_png_en',
    titleKey: 'tools.jpg_to_pdf_title',
  },
  '/powerpoint-to-pdf': {
    accept: '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint',
    actionTextKey: 'tools.to_pdf_convert_btn',
    browseTextKey: 'tools.select_file_btn',
    convertingTextKey: 'tools.powerpoint_to_pdf_converting',
    formatBadge: 'PPTX / PPT',
    hintTextKey: 'common.drop_file_hint',
    icon: 'slideshow',
    sourceType: 'powerpoint-to-pdf',
    subtitleKey: 'ui.convierte_tus_presentaciones_de_powerpoi',
    titleKey: 'tools.powerpoint_to_pdf_title',
  },
  '/word-to-pdf': {
    accept: '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword',
    actionTextKey: 'tools.to_pdf_convert_btn',
    browseTextKey: 'tools.select_file_btn',
    convertingTextKey: 'tools.word_to_pdf_converting',
    formatBadge: 'DOCX / DOC',
    hintTextKey: 'common.drop_file_hint',
    icon: 'description',
    sourceType: 'word-to-pdf',
    subtitleKey: 'ui.convierte_tus_documentos_de_word_a_archi',
    titleKey: 'tools.word_to_pdf_title',
  },
};

export { TO_PDF_CONFIGS };
export type { HtmlMargin, HtmlOrientation, HtmlScreenSize, JpgOrientation, JpgPageMargin, JpgPageSize, ToPdfRouteConfig, ToPdfSourceType };
