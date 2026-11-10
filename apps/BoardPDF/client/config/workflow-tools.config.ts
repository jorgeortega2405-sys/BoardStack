import { ToolDefinition } from '../types/workflow.types.js';

const WORKFLOW_TOOLS: ToolDefinition[] = [
  { category: 'pdf', group: 'Organizar PDF', icon: 'picture_as_pdf', id: 'merge-pdf', name: 'Unir PDF' },
  { category: 'pdf', group: 'Organizar PDF', icon: 'call_split', id: 'split-pdf', name: 'Dividir PDF' },
  { category: 'pdf', group: 'Organizar PDF', icon: 'layers', id: 'organize-pdf', name: 'Ordenar páginas PDF' },
  { category: 'pdf', group: 'Optimizar PDF', icon: 'compress', id: 'compress-pdf', name: 'Comprimir PDF' },
  { category: 'pdf', group: 'Optimizar PDF', icon: 'auto_stories', id: 'ocr-pdf', name: 'OCR a PDF' },
  { category: 'pdf', group: 'Convertir a PDF', icon: 'description', id: 'word-to-pdf', name: 'Word a PDF', targetType: 'pdf' },
  { category: 'pdf', group: 'Convertir a PDF', icon: 'table_chart', id: 'excel-to-pdf', name: 'Excel a PDF', targetType: 'pdf' },
  { category: 'pdf', group: 'Convertir a PDF', icon: 'slideshow', id: 'powerpoint-to-pdf', name: 'PowerPoint a PDF', targetType: 'pdf' },
  { category: 'image', group: 'Convertir a PDF', icon: 'photo_library', id: 'jpg-to-pdf', name: 'Imagen a PDF', targetType: 'pdf' },
  { category: 'pdf', group: 'Convertir PDF', icon: 'verified', id: 'pdf-to-pdfa', name: 'PDF a PDF/A', targetType: 'pdf' },
  { category: 'pdf', group: 'Convertir PDF', icon: 'description', id: 'pdf-to-word', isTerminal: true, name: 'PDF a Word', targetType: 'docx' },
  { category: 'pdf', group: 'Convertir PDF', icon: 'table_chart', id: 'pdf-to-excel', isTerminal: true, name: 'PDF a Excel', targetType: 'xlsx' },
  { category: 'pdf', group: 'Convertir PDF', icon: 'slideshow', id: 'pdf-to-powerpoint', isTerminal: true, name: 'PDF a PowerPoint', targetType: 'pptx' },
  { category: 'pdf', group: 'Convertir PDF', icon: 'photo_library', id: 'pdf-to-jpg', isTerminal: true, name: 'PDF a JPG', targetType: 'jpg' },
  { category: 'pdf', group: 'Seguridad PDF', icon: 'lock_open', id: 'unlock-pdf', name: 'Desbloquear PDF' },
  { category: 'pdf', group: 'Seguridad PDF', icon: 'lock', id: 'protect-pdf', name: 'Proteger PDF' },
];

export { WORKFLOW_TOOLS };
