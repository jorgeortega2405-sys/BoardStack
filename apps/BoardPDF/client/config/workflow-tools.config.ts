import { t } from '../services/i18n.service.js';
import { ToolDefinition } from '../types/workflow.types.js';

const WORKFLOW_TOOLS: ToolDefinition[] = [
  { category: 'pdf', groupKey: 'home.cat_organize', icon: 'picture_as_pdf', id: 'merge-pdf', nameKey: 'home.tool_merge_pdf_title' },
  { category: 'pdf', groupKey: 'home.cat_organize', icon: 'call_split', id: 'split-pdf', nameKey: 'home.tool_split_pdf_title' },
  { category: 'pdf', groupKey: 'home.cat_organize', icon: 'layers', id: 'organize-pdf', nameKey: 'home.tool_organize_pdf_title' },
  { category: 'pdf', groupKey: 'home.cat_optimize', icon: 'compress', id: 'compress-pdf', nameKey: 'home.tool_compress_pdf_title' },
  { category: 'pdf', groupKey: 'home.cat_optimize', icon: 'auto_stories', id: 'ocr-pdf', nameKey: 'home.tool_ocr_pdf_title' },
  { category: 'pdf', groupKey: 'home.cat_convert_to_pdf', icon: 'description', id: 'word-to-pdf', nameKey: 'home.tool_word_to_pdf_title', targetType: 'pdf' },
  { category: 'pdf', groupKey: 'home.cat_convert_to_pdf', icon: 'table_chart', id: 'excel-to-pdf', nameKey: 'home.tool_excel_to_pdf_title', targetType: 'pdf' },
  { category: 'pdf', groupKey: 'home.cat_convert_to_pdf', icon: 'slideshow', id: 'powerpoint-to-pdf', nameKey: 'home.tool_powerpoint_to_pdf_title', targetType: 'pdf' },
  { category: 'image', groupKey: 'home.cat_convert_to_pdf', icon: 'photo_library', id: 'jpg-to-pdf', nameKey: 'home.tool_jpg_to_pdf_title', targetType: 'pdf' },
  { category: 'pdf', groupKey: 'home.cat_convert_from_pdf', icon: 'verified', id: 'pdf-to-pdfa', nameKey: 'home.tool_pdf_to_pdfa_title', targetType: 'pdf' },
  { category: 'pdf', groupKey: 'home.cat_convert_from_pdf', icon: 'description', id: 'pdf-to-word', isTerminal: true, nameKey: 'home.tool_pdf_to_word_title', targetType: 'docx' },
  { category: 'pdf', groupKey: 'home.cat_convert_from_pdf', icon: 'table_chart', id: 'pdf-to-excel', isTerminal: true, nameKey: 'home.tool_pdf_to_excel_title', targetType: 'xlsx' },
  { category: 'pdf', groupKey: 'home.cat_convert_from_pdf', icon: 'slideshow', id: 'pdf-to-powerpoint', isTerminal: true, nameKey: 'home.tool_pdf_to_powerpoint_title', targetType: 'pptx' },
  { category: 'pdf', groupKey: 'home.cat_convert_from_pdf', icon: 'photo_library', id: 'pdf-to-jpg', isTerminal: true, nameKey: 'home.tool_pdf_to_jpg_title', targetType: 'jpg' },
  { category: 'pdf', groupKey: 'home.cat_security', icon: 'lock_open', id: 'unlock-pdf', nameKey: 'home.tool_unlock_pdf_title' },
  { category: 'pdf', groupKey: 'home.cat_security', icon: 'lock', id: 'protect-pdf', nameKey: 'home.tool_protect_pdf_title' },
];

function getWorkflowToolName(toolId: string): string {
  const def = WORKFLOW_TOOLS.find((item) => item.id === toolId);
  return def ? t(def.nameKey) : toolId;
}

export { WORKFLOW_TOOLS, getWorkflowToolName };
