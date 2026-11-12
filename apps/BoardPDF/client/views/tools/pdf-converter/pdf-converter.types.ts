type ConversionType =
  | 'pdf-to-jpg'
  | 'pdf-to-word'
  | 'pdf-to-powerpoint'
  | 'pdf-to-excel'
  | 'pdf-to-pdfa';

type JpgConversionMode = 'pages' | 'extract';
type JpgQuality = 'normal' | 'high';
type OcrOption = 'no' | 'yes';
type ExcelSheetsOption = 'single' | 'multiple';
type PdfALevel = '1b' | '1a' | '2b' | '2u' | '2a' | '3b' | '3u' | '3a';

interface ConversionRouteConfig {
  actionTextKey: string;
  convertingTextKey: string;
  icon: string;
  path: string;
  subtitleKey: string;
  targetBadge: string;
  targetExtension: string;
  targetType: ConversionType;
  titleKey: string;
}

const CONVERSION_CONFIGS: Record<string, ConversionRouteConfig> = {
  '/pdf-to-excel': {
    actionTextKey: 'tools.pdf_to_excel_btn_action',
    convertingTextKey: 'tools.pdf_to_excel_converting',
    icon: 'table_chart',
    path: '/pdf-to-excel',
    subtitleKey: 'ui.extrae_tablas_y_datos_estructurados_de_t',
    targetBadge: 'XLSX',
    targetExtension: '.xlsx',
    targetType: 'pdf-to-excel',
    titleKey: 'tools.pdf_to_excel_title',
  },
  '/pdf-to-jpg': {
    actionTextKey: 'tools.pdf_to_jpg_btn_action',
    convertingTextKey: 'tools.pdf_to_jpg_converting',
    icon: 'photo_library',
    path: '/pdf-to-jpg',
    subtitleKey: 'ui.convierte_cada_pagina_de_tu_archivo_pdf_',
    targetBadge: 'JPG',
    targetExtension: '.jpg',
    targetType: 'pdf-to-jpg',
    titleKey: 'tools.pdf_to_jpg_title',
  },
  '/pdf-to-pdfa': {
    actionTextKey: 'tools.pdf_to_pdfa_btn_action',
    convertingTextKey: 'tools.pdf_to_pdfa_converting',
    icon: 'verified',
    path: '/pdf-to-pdfa',
    subtitleKey: 'tools.pdf_to_pdfa_subtitle',
    targetBadge: 'PDF/A',
    targetExtension: '_pdfa.pdf',
    targetType: 'pdf-to-pdfa',
    titleKey: 'tools.pdf_to_pdfa_title',
  },
  '/pdf-to-powerpoint': {
    actionTextKey: 'tools.pdf_to_powerpoint_btn_action',
    convertingTextKey: 'tools.pdf_to_powerpoint_converting',
    icon: 'slideshow',
    path: '/pdf-to-powerpoint',
    subtitleKey: 'ui.transforma_tus_presentaciones_pdf_en_dia',
    targetBadge: 'PPTX',
    targetExtension: '.pptx',
    targetType: 'pdf-to-powerpoint',
    titleKey: 'tools.pdf_to_powerpoint_title',
  },
  '/pdf-to-word': {
    actionTextKey: 'tools.pdf_to_word_btn_action',
    convertingTextKey: 'tools.pdf_to_word_converting',
    icon: 'description',
    path: '/pdf-to-word',
    subtitleKey: 'tools.pdf_to_word_subtitle',
    targetBadge: 'DOCX',
    targetExtension: '.docx',
    targetType: 'pdf-to-word',
    titleKey: 'tools.pdf_to_word_title',
  },
};

export { CONVERSION_CONFIGS };
export type { ConversionRouteConfig, ConversionType, ExcelSheetsOption, JpgConversionMode, JpgQuality, OcrOption, PdfALevel };
