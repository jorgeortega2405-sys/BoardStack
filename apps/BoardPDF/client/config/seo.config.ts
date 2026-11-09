import { t } from '../services/i18n.service.js';
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguageCode } from '../utils/languages.util.js';

interface RouteSeoInfo {
  category?: string;
  descriptions: Record<string, string>;
  isTool?: boolean;
  routeId: string;
  slugs: Record<string, string>;
  titles: Record<string, string>;
}

const SEO_ROUTES: Record<string, RouteSeoInfo> = {
  'collaborative-pdf': {
    category: 'collaborative',
    descriptions: {
      en: 'Design, create, and edit PDF documents online with shapes, text, templates, and cloud storage.',
    },
    isTool: true,
    routeId: 'collaborative-pdf',
    slugs: {
      de: 'kollaboratives-pdf',
      en: 'collaborative-pdf',
      fr: 'pdf-collaboratif',
      it: 'pdf-collaborativo',
      pt: 'pdf-colaborativo',
    },
    titles: {
      en: 'Design PDF - Create & Edit PDF Documents Online | BoardPDF',
    },
  },

  home: {
    descriptions: {
      en: 'Free and secure online PDF tools. Merge, split, compress, edit, convert, and protect your PDF documents with ease.',
    },
    routeId: 'home',
    slugs: {
      de: '',
      en: '',
      es: '',
      fr: '',
      it: '',
      pt: '',
    },
    titles: {
      en: 'BoardPDF - Free & Secure Online PDF Tools',
    },
  },
  'merge-pdf': {
    category: 'organize',
    descriptions: {
      en: 'Combine and merge multiple PDF documents into one single file in the exact order you want. Fast, easy, and secure.',
    },
    isTool: true,
    routeId: 'merge-pdf',
    slugs: {
      de: 'pdf-zusammenfuegen',
      en: 'merge-pdf',
      fr: 'fusionner-pdf',
      it: 'unire-pdf',
      pt: 'juntar-pdf',
    },
    titles: {
      en: 'Merge PDF - Combine PDF files online for free | BoardPDF',
    },
  },
  'split-pdf': {
    category: 'organize',
    descriptions: {
      en: 'Split a PDF into multiple files or extract specific pages with ease and high precision.',
    },
    isTool: true,
    routeId: 'split-pdf',
    slugs: {
      de: 'pdf-teilen',
      en: 'split-pdf',
      fr: 'diviser-pdf',
      it: 'dividere-pdf',
      pt: 'dividir-pdf',
    },
    titles: {
      en: 'Split PDF - Separate PDF pages online | BoardPDF',
    },
  },
  'remove-pdf-pages': {
    category: 'organize',
    descriptions: {
      en: 'Remove unwanted pages from your PDF document visually and instantly.',
    },
    isTool: true,
    routeId: 'remove-pdf-pages',
    slugs: {
      de: 'pdf-seiten-loeschen',
      en: 'remove-pdf-pages',
      fr: 'supprimer-pages-pdf',
      it: 'eliminare-pagine-pdf',
      pt: 'remover-paginas-pdf',
    },
    titles: {
      en: 'Remove PDF Pages - Delete unwanted pages | BoardPDF',
    },
  },
  'extract-pdf-pages': {
    category: 'organize',
    descriptions: {
      en: 'Extract specific pages from your PDF document and generate a new file instantly.',
    },
    isTool: true,
    routeId: 'extract-pdf-pages',
    slugs: {
      de: 'pdf-seiten-extrahieren',
      en: 'extract-pdf-pages',
      fr: 'extraire-pages-pdf',
      it: 'estrarre-pagine-pdf',
      pt: 'extrair-paginas-pdf',
    },
    titles: {
      en: 'Extract PDF Pages - Save selected pages | BoardPDF',
    },
  },
  'organize-pdf': {
    category: 'organize',
    descriptions: {
      en: 'Sort, remove and rotate pages in your PDF file easily with interactive visual preview.',
    },
    isTool: true,
    routeId: 'organize-pdf',
    slugs: {
      de: 'pdf-organisieren',
      en: 'organize-pdf',
      fr: 'organiser-pdf',
      it: 'organizzare-pdf',
      pt: 'organizar-pdf',
    },
    titles: {
      en: 'Organize PDF - Reorder, rotate and sort pages | BoardPDF',
    },
  },
  'compress-pdf': {
    category: 'optimize',
    descriptions: {
      en: 'Reduce your PDF file size while maintaining the highest possible document quality.',
    },
    isTool: true,
    routeId: 'compress-pdf',
    slugs: {
      de: 'pdf-verkleinern',
      en: 'compress-pdf',
      fr: 'compresser-pdf',
      it: 'comprimere-pdf',
      pt: 'comprimir-pdf',
    },
    titles: {
      en: 'Compress PDF - Reduce PDF file size online | BoardPDF',
    },
  },
  'repair-pdf': {
    category: 'optimize',
    descriptions: {
      en: 'Repair and recover content from damaged or corrupted PDF documents online.',
    },
    isTool: true,
    routeId: 'repair-pdf',
    slugs: {
      de: 'pdf-reparieren',
      en: 'repair-pdf',
      fr: 'reparer-pdf',
      it: 'riparare-pdf',
      pt: 'reparar-pdf',
    },
    titles: {
      en: 'Repair PDF - Fix corrupt and damaged PDF files | BoardPDF',
    },
  },
  'ocr-pdf': {
    category: 'optimize',
    descriptions: {
      en: 'Recognize text from scanned documents and images to make them searchable and selectable.',
    },
    isTool: true,
    routeId: 'ocr-pdf',
    slugs: {
      de: 'ocr-pdf',
      en: 'ocr-pdf',
      fr: 'ocr-pdf',
      it: 'ocr-pdf',
      pt: 'ocr-pdf',
    },
    titles: {
      en: 'OCR PDF - Convert scanned PDF to searchable text | BoardPDF',
    },
  },
  'jpg-to-pdf': {
    category: 'convert-to-pdf',
    descriptions: {
      en: 'Convert JPG photos and images to PDF format in seconds with optimal quality.',
    },
    isTool: true,
    routeId: 'jpg-to-pdf',
    slugs: {
      de: 'jpg-in-pdf',
      en: 'jpg-to-pdf',
      fr: 'jpg-en-pdf',
      it: 'da-jpg-a-pdf',
      pt: 'jpg-para-pdf',
    },
    titles: {
      en: 'JPG to PDF - Convert images to PDF documents | BoardPDF',
    },
  },
  'word-to-pdf': {
    category: 'convert-to-pdf',
    descriptions: {
      en: 'Convert your Word documents (DOC, DOCX) to PDF keeping original formatting intact.',
    },
    isTool: true,
    routeId: 'word-to-pdf',
    slugs: {
      de: 'word-in-pdf',
      en: 'word-to-pdf',
      fr: 'word-en-pdf',
      it: 'da-word-a-pdf',
      pt: 'word-para-pdf',
    },
    titles: {
      en: 'Word to PDF - Convert DOCX files to PDF | BoardPDF',
    },
  },
  'powerpoint-to-pdf': {
    category: 'convert-to-pdf',
    descriptions: {
      en: 'Convert your PPT and PPTX presentations into PDF files for easy sharing.',
    },
    isTool: true,
    routeId: 'powerpoint-to-pdf',
    slugs: {
      de: 'powerpoint-in-pdf',
      en: 'powerpoint-to-pdf',
      fr: 'powerpoint-en-pdf',
      it: 'da-powerpoint-a-pdf',
      pt: 'powerpoint-para-pdf',
    },
    titles: {
      en: 'PowerPoint to PDF - Convert PPT slides to PDF | BoardPDF',
    },
  },
  'excel-to-pdf': {
    category: 'convert-to-pdf',
    descriptions: {
      en: 'Convert Excel tables and spreadsheets (XLS, XLSX) to print-ready PDF files.',
    },
    isTool: true,
    routeId: 'excel-to-pdf',
    slugs: {
      de: 'excel-in-pdf',
      en: 'excel-to-pdf',
      fr: 'excel-en-pdf',
      it: 'da-excel-a-pdf',
      pt: 'excel-para-pdf',
    },
    titles: {
      en: 'Excel to PDF - Convert XLS spreadsheets to PDF | BoardPDF',
    },
  },
  'html-to-pdf': {
    category: 'convert-to-pdf',
    descriptions: {
      en: 'Convert web pages, HTML code or URLs into high-fidelity PDF documents.',
    },
    isTool: true,
    routeId: 'html-to-pdf',
    slugs: {
      de: 'html-in-pdf',
      en: 'html-to-pdf',
      fr: 'html-en-pdf',
      it: 'da-html-a-pdf',
      pt: 'html-para-pdf',
    },
    titles: {
      en: 'HTML to PDF - Convert web pages and HTML to PDF | BoardPDF',
    },
  },
  'pdf-to-jpg': {
    category: 'convert-from-pdf',
    descriptions: {
      en: 'Convert your PDF pages to high-resolution JPG images or extract all images easily.',
    },
    isTool: true,
    routeId: 'pdf-to-jpg',
    slugs: {
      de: 'pdf-in-jpg',
      en: 'pdf-to-jpg',
      fr: 'pdf-en-jpg',
      it: 'da-pdf-a-jpg',
      pt: 'pdf-para-jpg',
    },
    titles: {
      en: 'PDF to JPG - Extract images or convert pages to JPG | BoardPDF',
    },
  },
  'pdf-to-word': {
    category: 'convert-from-pdf',
    descriptions: {
      en: 'Convert your PDF files to editable Word (DOCX) documents with pinpoint accuracy.',
    },
    isTool: true,
    routeId: 'pdf-to-word',
    slugs: {
      de: 'pdf-in-word',
      en: 'pdf-to-word',
      fr: 'pdf-en-word',
      it: 'da-pdf-a-word',
      pt: 'pdf-para-word',
    },
    titles: {
      en: 'PDF to Word - Convert PDF files to editable DOCX | BoardPDF',
    },
  },
  'pdf-to-powerpoint': {
    category: 'convert-from-pdf',
    descriptions: {
      en: 'Convert your PDF files into editable PowerPoint PPTX slide presentations.',
    },
    isTool: true,
    routeId: 'pdf-to-powerpoint',
    slugs: {
      de: 'pdf-in-powerpoint',
      en: 'pdf-to-powerpoint',
      fr: 'pdf-en-powerpoint',
      it: 'da-pdf-a-powerpoint',
      pt: 'pdf-para-powerpoint',
    },
    titles: {
      en: 'PDF to PowerPoint - Convert PDF to PPTX slides | BoardPDF',
    },
  },
  'pdf-to-excel': {
    category: 'convert-from-pdf',
    descriptions: {
      en: 'Extract tables from your PDF documents directly into Excel spreadsheets in seconds.',
    },
    isTool: true,
    routeId: 'pdf-to-excel',
    slugs: {
      de: 'pdf-in-excel',
      en: 'pdf-to-excel',
      fr: 'pdf-en-excel',
      it: 'da-pdf-a-excel',
      pt: 'pdf-para-excel',
    },
    titles: {
      en: 'PDF to Excel - Extract PDF tables to XLSX spreadsheets | BoardPDF',
    },
  },
  'pdf-to-pdfa': {
    category: 'convert-from-pdf',
    descriptions: {
      en: 'Transform your PDF documents to standard PDF/A format for secure legal and institutional archiving.',
    },
    isTool: true,
    routeId: 'pdf-to-pdfa',
    slugs: {
      de: 'pdf-in-pdfa',
      en: 'pdf-to-pdfa',
      fr: 'pdf-en-pdfa',
      it: 'da-pdf-a-pdfa',
      pt: 'pdf-para-pdfa',
    },
    titles: {
      en: 'PDF to PDF/A - Convert documents for long-term archiving | BoardPDF',
    },
  },
  'rotate-pdf': {
    category: 'edit',
    descriptions: {
      en: 'Rotate your PDF documents horizontally or vertically. Rotate single pages or the entire file.',
    },
    isTool: true,
    routeId: 'rotate-pdf',
    slugs: {
      de: 'pdf-drehen',
      en: 'rotate-pdf',
      fr: 'pivoter-pdf',
      it: 'ruotare-pdf',
      pt: 'rodar-pdf',
    },
    titles: {
      en: 'Rotate PDF - Turn PDF pages online | BoardPDF',
    },
  },
  'page-numbers': {
    category: 'edit',
    descriptions: {
      en: 'Add page numbers to your PDF documents with custom typography, formatting, and positioning.',
    },
    isTool: true,
    routeId: 'page-numbers',
    slugs: {
      de: 'seitenzahlen-pdf',
      en: 'page-numbers',
      fr: 'numeroter-pdf',
      it: 'numeri-di-pagina-pdf',
      pt: 'numerar-pdf',
    },
    titles: {
      en: 'Page Numbers in PDF - Number your PDF pages | BoardPDF',
    },
  },
  'watermark-pdf': {
    category: 'edit',
    descriptions: {
      en: 'Add text or image watermarks to your PDF files with customizable transparency and position.',
    },
    isTool: true,
    routeId: 'watermark-pdf',
    slugs: {
      de: 'pdf-wasserzeichen',
      en: 'watermark-pdf',
      fr: 'filigrane-pdf',
      it: 'filigrana-pdf',
      pt: 'marca-dagua',
    },
    titles: {
      en: 'Watermark PDF - Add watermarks to your documents | BoardPDF',
    },
  },
  'crop-pdf': {
    category: 'edit',
    descriptions: {
      en: 'Trim margins or specific regions of your PDF document with precision and ease.',
    },
    isTool: true,
    routeId: 'crop-pdf',
    slugs: {
      de: 'pdf-zuschneiden',
      en: 'crop-pdf',
      fr: 'recadrer-pdf',
      it: 'ritagliare-pdf',
      pt: 'cortar-pdf',
    },
    titles: {
      en: 'Crop PDF - Trim margins and crop PDF pages | BoardPDF',
    },
  },
  'edit-pdf': {
    category: 'edit',
    descriptions: {
      en: 'Edit PDF documents in your browser by adding text, signatures, annotations, images, and shapes.',
    },
    isTool: true,
    routeId: 'edit-pdf',
    slugs: {
      de: 'pdf-bearbeiten',
      en: 'edit-pdf',
      fr: 'modifier-pdf',
      it: 'modificare-pdf',
      pt: 'editar-pdf',
    },
    titles: {
      en: 'Edit PDF - Add text, shapes and drawings online | BoardPDF',
    },
  },
  'unlock-pdf': {
    category: 'security',
    descriptions: {
      en: 'Remove passwords and restrictions from your PDF files to view, print, and edit them freely.',
    },
    isTool: true,
    routeId: 'unlock-pdf',
    slugs: {
      de: 'pdf-entsperren',
      en: 'unlock-pdf',
      fr: 'deverrouiller-pdf',
      it: 'sbloccare-pdf',
      pt: 'desbloquear-pdf',
    },
    titles: {
      en: 'Unlock PDF - Remove password and permissions | BoardPDF',
    },
  },
  'protect-pdf': {
    category: 'security',
    descriptions: {
      en: 'Protect your confidential PDF files with strong passwords and state-of-the-art encryption.',
    },
    isTool: true,
    routeId: 'protect-pdf',
    slugs: {
      de: 'pdf-schuetzen',
      en: 'protect-pdf',
      fr: 'proteger-pdf',
      it: 'proteggere-pdf',
      pt: 'proteger-pdf',
    },
    titles: {
      en: 'Protect PDF - Encrypt and password protect your PDF | BoardPDF',
    },
  },
  'redact-pdf': {
    category: 'security',
    descriptions: {
      en: 'Permanently blackout and sanitize sensitive information and personal data from your PDF files.',
    },
    isTool: true,
    routeId: 'redact-pdf',
    slugs: {
      de: 'pdf-schwaerzen',
      en: 'redact-pdf',
      fr: 'biffer-pdf',
      it: 'censurare-pdf',
      pt: 'censurar-pdf',
    },
    titles: {
      en: 'Redact PDF - Permanently blackout sensitive info | BoardPDF',
    },
  },
  'compare-pdf': {
    category: 'security',
    descriptions: {
      en: 'Compare two PDF documents visually side by side to instantly spot text and visual changes.',
    },
    isTool: true,
    routeId: 'compare-pdf',
    slugs: {
      de: 'pdf-vergleichen',
      en: 'compare-pdf',
      fr: 'comparer-pdf',
      it: 'confrontare-pdf',
      pt: 'comparar-pdf',
    },
    titles: {
      en: 'Compare PDF - Spot differences between two files | BoardPDF',
    },
  },
  'summarize-pdf': {
    category: 'pdf-intelligence',
    descriptions: {
      en: 'Summarize extensive documents, reports and articles in seconds using advanced artificial intelligence.',
    },
    isTool: true,
    routeId: 'summarize-pdf',
    slugs: {
      de: 'pdf-zusammenfassen',
      en: 'summarize-pdf',
      fr: 'resumer-pdf',
      it: 'riassumere-pdf',
      pt: 'resumir-pdf',
    },
    titles: {
      en: 'Summarize PDF - Smart automatic summaries | BoardPDF',
    },
  },
  'translate-pdf': {
    category: 'pdf-intelligence',
    descriptions: {
      en: 'Translate PDF documents into more than 30 languages while preserving original formatting and layout.',
    },
    isTool: true,
    routeId: 'translate-pdf',
    slugs: {
      de: 'pdf-uebersetzen',
      en: 'translate-pdf',
      fr: 'traduire-pdf',
      it: 'tradurre-pdf',
      pt: 'traduzir-pdf',
    },
    titles: {
      en: 'Translate PDF - Translate complete documents | BoardPDF',
    },
  },
  'pdf-to-markdown': {
    category: 'pdf-intelligence',
    descriptions: {
      en: 'Convert complex PDF files into clean Markdown format ready for Obsidian, Notion, and notes.',
    },
    isTool: true,
    routeId: 'pdf-to-markdown',
    slugs: {
      de: 'pdf-in-markdown',
      en: 'pdf-to-markdown',
      fr: 'pdf-en-markdown',
      it: 'da-pdf-a-markdown',
      pt: 'pdf-para-markdown',
    },
    titles: {
      en: 'PDF to Markdown - Clean text and table extraction | BoardPDF',
    },
  },
  about: {
    descriptions: {
      en: 'Learn about the story, mission, and core values driving BoardPDF.',
    },
    routeId: 'about',
    slugs: {
      en: 'about',
    },
    titles: {
      en: 'About Us - Our Story | BoardPDF',
    },
  },
  checkout: {
    descriptions: {
      en: 'Complete your BoardPDF subscription checkout securely.',
    },
    routeId: 'checkout',
    slugs: {
      de: 'kasse',
      en: 'checkout',
      fr: 'caisse',
      it: 'cassa',
      pt: 'checkout',
    },
    titles: {
      en: 'Checkout | BoardPDF',
    },
  },
  contact: {
    descriptions: {
      en: 'Get in touch with the BoardPDF team for inquiries, support, or partnership opportunities.',
    },
    routeId: 'contact',
    slugs: {
      en: 'contact',
    },
    titles: {
      en: 'Contact Us | BoardPDF',
    },
  },
  pricing: {
    descriptions: {
      en: 'Explore BoardPDF subscription plans and pricing for professionals, teams, and enterprises.',
    },
    routeId: 'pricing',
    slugs: {
      de: 'preise',
      en: 'pricing',
      fr: 'tarifs',
      it: 'prezzi',
      pt: 'precos',
    },
    titles: {
      en: 'Pricing & Plans | BoardPDF',
    },
  },

  'help-faq': {
    descriptions: {
      en: 'Find answers to common questions about BoardPDF PDF tools, security, privacy, pricing, and document lifecycle.',
    },
    routeId: 'help-faq',
    slugs: {
      de: 'faq',
      en: 'faq',
      fr: 'faq',
      it: 'faq',
      pt: 'perguntas-frequentes',
    },
    titles: {
      en: 'Frequently Asked Questions (FAQ) | BoardPDF',
    },
  },
  'help-security': {
    descriptions: {
      en: 'Learn how BoardPDF protects your documents with TLS 1.3, AES-GCM-256 encryption, zero-knowledge architecture, and automated ephemeral deletion.',
    },
    routeId: 'help-security',
    slugs: {
      de: 'sicherheit',
      en: 'security',
      fr: 'securite',
      it: 'sicurezza',
      pt: 'seguranca',
    },
    titles: {
      en: 'Security Policy | BoardPDF',
    },
  },
  'help-privacy': {
    descriptions: {
      en: 'BoardPDF Privacy Policy. 100% ephemeral document processing, max 2-hour retention, zero AI training, and full GDPR & CCPA/CPRA compliance.',
    },
    routeId: 'help-privacy',
    slugs: {
      de: 'datenschutz',
      en: 'privacy',
      fr: 'confidentialite',
      it: 'privacy',
      pt: 'privacidade',
    },
    titles: {
      en: 'Privacy Policy | BoardPDF',
    },
  },
  'help-terms': {
    descriptions: {
      en: 'Terms and conditions for using BoardPDF. Transparent guidelines, service rules, binding individual arbitration, and class action waiver.',
    },
    routeId: 'help-terms',
    slugs: {
      de: 'agb',
      en: 'terms',
      fr: 'conditions',
      it: 'termini',
      pt: 'termos',
    },
    titles: {
      en: 'Terms of Service | BoardPDF',
    },
  },
  'help-cookies': {
    descriptions: {
      en: 'BoardPDF Cookie Policy. Detailed technical breakdown of cookies used, browser management guides, and privacy controls.',
    },
    routeId: 'help-cookies',
    slugs: {
      de: 'cookies',
      en: 'cookies',
      fr: 'cookies',
      it: 'cookie',
      pt: 'cookies',
    },
    titles: {
      en: 'Cookie Policy | BoardPDF',
    },
  },
};

const SLUG_TO_ROUTE_MAP = new Map<string, string>();
for (const [routeId, info] of Object.entries(SEO_ROUTES)) {
  SLUG_TO_ROUTE_MAP.set(routeId.toLowerCase(), routeId);
  for (const slug of Object.values(info.slugs)) {
    if (slug) {
      SLUG_TO_ROUTE_MAP.set(slug.toLowerCase(), routeId);
    }
  }
}

SLUG_TO_ROUTE_MAP.set('add-page-numbers', 'page-numbers');
SLUG_TO_ROUTE_MAP.set('numerar-pdf', 'page-numbers');
SLUG_TO_ROUTE_MAP.set('add-watermark', 'watermark-pdf');
SLUG_TO_ROUTE_MAP.set('marca-de-agua-pdf', 'watermark-pdf');
SLUG_TO_ROUTE_MAP.set('redactar-pdf', 'redact-pdf');
SLUG_TO_ROUTE_MAP.set('faq', 'help-faq');
SLUG_TO_ROUTE_MAP.set('preguntas-frecuentes', 'help-faq');
SLUG_TO_ROUTE_MAP.set('help/faq', 'help-faq');
SLUG_TO_ROUTE_MAP.set('help-faq', 'help-faq');
SLUG_TO_ROUTE_MAP.set('security-policy', 'help-security');
SLUG_TO_ROUTE_MAP.set('security', 'help-security');
SLUG_TO_ROUTE_MAP.set('seguridad', 'help-security');
SLUG_TO_ROUTE_MAP.set('help/security', 'help-security');
SLUG_TO_ROUTE_MAP.set('help-security', 'help-security');
SLUG_TO_ROUTE_MAP.set('privacy-policy', 'help-privacy');
SLUG_TO_ROUTE_MAP.set('privacy', 'help-privacy');
SLUG_TO_ROUTE_MAP.set('privacidad', 'help-privacy');
SLUG_TO_ROUTE_MAP.set('help/privacy', 'help-privacy');
SLUG_TO_ROUTE_MAP.set('help-privacy', 'help-privacy');
SLUG_TO_ROUTE_MAP.set('terms-and-conditions', 'help-terms');
SLUG_TO_ROUTE_MAP.set('terms', 'help-terms');
SLUG_TO_ROUTE_MAP.set('terminos', 'help-terms');
SLUG_TO_ROUTE_MAP.set('help/terms', 'help-terms');
SLUG_TO_ROUTE_MAP.set('help-terms', 'help-terms');
SLUG_TO_ROUTE_MAP.set('cookie-policy', 'help-cookies');
SLUG_TO_ROUTE_MAP.set('cookies', 'help-cookies');
SLUG_TO_ROUTE_MAP.set('help/cookies', 'help-cookies');
SLUG_TO_ROUTE_MAP.set('help-cookies', 'help-cookies');
SLUG_TO_ROUTE_MAP.set('about', 'about');
SLUG_TO_ROUTE_MAP.set('sobre-nosotros', 'about');
SLUG_TO_ROUTE_MAP.set('contact', 'contact');
SLUG_TO_ROUTE_MAP.set('contacto', 'contact');
SLUG_TO_ROUTE_MAP.set('checkout', 'checkout');
SLUG_TO_ROUTE_MAP.set('pricing', 'pricing');
SLUG_TO_ROUTE_MAP.set('precios', 'pricing');
SLUG_TO_ROUTE_MAP.set('precio', 'pricing');
SLUG_TO_ROUTE_MAP.set('planes', 'pricing');
SLUG_TO_ROUTE_MAP.set('plans', 'pricing');
SLUG_TO_ROUTE_MAP.set('preise', 'pricing');
SLUG_TO_ROUTE_MAP.set('tarifs', 'pricing');
SLUG_TO_ROUTE_MAP.set('prezzi', 'pricing');
SLUG_TO_ROUTE_MAP.set('precos', 'pricing');

function getCanonicalSlug(routeId: string, lang = DEFAULT_LANGUAGE): string {
  const cleanLang = (lang || '').trim().toLowerCase();
  const info = SEO_ROUTES[routeId];
  if (!info) return routeId;
  if (routeId === 'home') return '';
  const base = cleanLang.split('-')[0];
  const normLang = normalizeLanguageCode(lang);
  const normBase = normLang.split('-')[0];
  return (
    info.slugs[cleanLang] ||
    info.slugs[base] ||
    info.slugs[normLang] ||
    info.slugs[normBase] ||
    (base === 'es' || normBase === 'es' ? info.slugs.es : info.slugs.en) ||
    info.slugs.es ||
    info.slugs.en ||
    routeId
  );
}

function resolveRouteFromSlug(slug: string, lang = DEFAULT_LANGUAGE): { canonicalSlug: string; isCanonical: boolean; routeId: string } | null {
  const clean = (slug || '').toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!clean) {
    return {
      canonicalSlug: '',
      isCanonical: true,
      routeId: 'home',
    };
  }

  const routeId = SLUG_TO_ROUTE_MAP.get(clean);
  if (!routeId) return null;

  const canonical = getCanonicalSlug(routeId, lang);
  return {
    canonicalSlug: canonical,
    isCanonical: clean === canonical.toLowerCase(),
    routeId,
  };
}

function getLocalizedPath(routeId: string, lang = DEFAULT_LANGUAGE): string {
  const cleanLang = (lang || '').trim().toLowerCase();
  const normLang = normalizeLanguageCode(lang);
  const targetLang = cleanLang === 'es' || cleanLang === 'en' ? cleanLang : normLang;
  if (routeId === 'home') {
    return `/${targetLang}`;
  }
  const slug = getCanonicalSlug(routeId, targetLang);
  return `/${targetLang}/${slug}`;
}

interface PageSeoResult {
  canonicalUrl: string;
  description: string;
  hreflangs: Array<{ href: string; lang: string }>;
  jsonLd: Record<string, unknown>;
  title: string;
}

function getPageSeo(routeId: string, lang = DEFAULT_LANGUAGE, origin = ''): PageSeoResult {
  const normLang = normalizeLanguageCode(lang);
  const info = SEO_ROUTES[routeId] || SEO_ROUTES.home;

  const tTitle = t(`seo.${info.routeId}.title`);
  const tDesc = t(`seo.${info.routeId}.description`);
  const title = (tTitle !== `seo.${info.routeId}.title` ? tTitle : '') || info.titles[normLang] || info.titles.en || `${info.routeId} - BoardPDF`;
  const description = (tDesc !== `seo.${info.routeId}.description` ? tDesc : '') || info.descriptions[normLang] || info.descriptions.en || 'Online and secure PDF tools.';

  const canonicalPath = getLocalizedPath(info.routeId, normLang);
  const baseUrl = origin.replace(/\/+$/, '');
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  const hreflangs: Array<{ href: string; lang: string }> = AVAILABLE_LANGUAGES.map((l) => ({
    href: `${baseUrl}${getLocalizedPath(info.routeId, l.code)}`,
    lang: l.code,
  }));

  hreflangs.push({
    href: `${baseUrl}${getLocalizedPath(info.routeId, 'es')}`,
    lang: 'x-default',
  });

  const jsonLd: Record<string, unknown> = info.isTool
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        applicationCategory: 'BusinessApplication',
        description,
        name: title.split('-')[0].trim(),
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        operatingSystem: 'All',
        url: canonicalUrl,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        description,
        name: 'BoardPDF',
        url: canonicalUrl,
      };

  return {
    canonicalUrl,
    description,
    hreflangs,
    jsonLd,
    title,
  };
}

function updateDomSeo(routeId: string, lang = DEFAULT_LANGUAGE): void {
  const origin = window.location.origin;
  const seo = getPageSeo(routeId, lang, origin);

  document.title = seo.title;
  document.documentElement.lang = normalizeLanguageCode(lang);

  let descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.name = 'description';
    document.head.appendChild(descEl);
  }
  descEl.content = seo.description;

  let canEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canEl) {
    canEl = document.createElement('link');
    canEl.rel = 'canonical';
    document.head.appendChild(canEl);
  }
  canEl.href = seo.canonicalUrl;

  const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingHreflangs.forEach((el) => el.remove());

  for (const h of seo.hreflangs) {
    const linkEl = document.createElement('link');
    linkEl.rel = 'alternate';
    linkEl.setAttribute('hreflang', h.lang);
    linkEl.href = h.href;
    document.head.appendChild(linkEl);
  }

  const setMetaProp = (prop: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  setMetaProp('og:title', seo.title);
  setMetaProp('og:description', seo.description);
  setMetaProp('og:url', seo.canonicalUrl);
  setMetaProp('og:type', 'website');
  setMetaProp('og:locale', lang === 'en' ? 'en_US' : `${lang}_${lang.toUpperCase()}`);

  const setMetaName = (name: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  setMetaName('twitter:card', 'summary_large_image');
  setMetaName('twitter:title', seo.title);
  setMetaName('twitter:description', seo.description);

  let scriptEl = document.querySelector<HTMLScriptElement>('script[data-ref="structured-data-jsonld"]');
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.setAttribute('data-ref', 'structured-data-jsonld');
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(seo.jsonLd);
}

export { SEO_ROUTES, getCanonicalSlug, getLocalizedPath, getPageSeo, resolveRouteFromSlug, updateDomSeo };
export type { PageSeoResult, RouteSeoInfo };
