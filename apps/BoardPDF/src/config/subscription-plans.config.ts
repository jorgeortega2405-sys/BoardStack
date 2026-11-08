export type SubscriptionTierKey = 'business' | 'free' | 'pro';

export interface ToolLimitTierConfig {
  maxFiles: number;
  maxFileSizeMB: number;
  maxTotalSizeMB: number;
  requiredPermission?: string;
}

export interface ToolTierLimits {
  business: ToolLimitTierConfig;
  free: ToolLimitTierConfig;
  pro: ToolLimitTierConfig;
}

export type AllPdfToolsLimits = Record<string, ToolTierLimits>;

export interface PlanFeatureItem {
  description: string;
  highlight?: boolean;
  icon?: string;
  title: string;
}

export interface PlanBenefitsDefinition {
  badge?: string;
  buttonText: string;
  category: 'general';
  description: string;
  features: PlanFeatureItem[];
  hasAdvancedAi: boolean;
  hasBatchProcessing: boolean;
  hasOrganization: boolean;
  hasSaml: boolean;
  hasSso: boolean;
  id: SubscriptionTierKey;
  isPopular?: boolean;
  maxWorkflows: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  storageGB: number;
  storageLabel: string;
  supportLevel: 'community' | 'priority' | 'dedicated_24_7';
  tagline: string;
}

export const WORKFLOW_LIMITS: Record<SubscriptionTierKey, number> = {
  business: 200,
  free: 5,
  pro: 50,
};

export const ALL_TOOLS_LIMITS: AllPdfToolsLimits = {
  'collaborative-pdf': {
    business: { maxFiles: 50, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'subscription:feature:business' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'subscription:feature:pro' },
  },
  'compare-pdf': {
    business: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 2, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 2, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'compress-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:high_size_limit' },
  },
  'crop-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'edit-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'excel-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'extract-pdf-pages': {
    business: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:split:by_size' },
  },
  'html-to-pdf': {
    business: { maxFiles: 50, maxFileSizeMB: 200, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 20, maxFileSizeMB: 200, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'jpg-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'merge-pdf': {
    business: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
    free: { maxFiles: 25, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
  },
  'ocr-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'organize-pdf': {
    business: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
    free: { maxFiles: 25, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 500, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'tools:merge:batch_500' },
  },
  'page-numbers': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-converter': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-excel': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-jpg': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-markdown': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-pdfa': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-powerpoint': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'pdf-to-word': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'powerpoint-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'protect-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'redact-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 5, maxFileSizeMB: 500, maxTotalSizeMB: 500, requiredPermission: 'tools:high_size_limit' },
  },
  'remove-pdf-pages': {
    business: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 1, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'repair-pdf': {
    business: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'rotate-pdf': {
    business: { maxFiles: 50, maxFileSizeMB: 1000, maxTotalSizeMB: 1500, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 20, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'split-pdf': {
    business: { maxFiles: 5, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 1, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:split:by_size' },
  },
  'summarize-pdf': {
    business: { maxFiles: 3, maxFileSizeMB: 200, maxTotalSizeMB: 300, requiredPermission: 'tools:ai:advanced' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 1, maxFileSizeMB: 200, maxTotalSizeMB: 200, requiredPermission: 'tools:ai:advanced' },
  },
  'to-pdf-converter': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'translate-pdf': {
    business: { maxFiles: 3, maxFileSizeMB: 200, maxTotalSizeMB: 300, requiredPermission: 'tools:ai:advanced' },
    free: { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 1, maxFileSizeMB: 200, maxTotalSizeMB: 200, requiredPermission: 'tools:ai:advanced' },
  },
  'unlock-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'watermark-pdf': {
    business: { maxFiles: 25, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 1, maxFileSizeMB: 100, maxTotalSizeMB: 100 },
    pro: { maxFiles: 10, maxFileSizeMB: 1000, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'word-to-pdf': {
    business: { maxFiles: 100, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 100 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'tools:high_size_limit' },
  },
  'workflows': {
    business: { maxFiles: 200, maxFileSizeMB: 1000, maxTotalSizeMB: 2000, requiredPermission: 'subscription:feature:business' },
    free: { maxFiles: 5, maxFileSizeMB: 50, maxTotalSizeMB: 50 },
    pro: { maxFiles: 50, maxFileSizeMB: 500, maxTotalSizeMB: 1000, requiredPermission: 'subscription:feature:pro' },
  },
};

export const PLAN_TIER_BENEFITS: Record<SubscriptionTierKey, PlanBenefitsDefinition> = {
  business: {
    badge: 'Para Equipos',
    buttonText: 'Obtener Negocios',
    category: 'general',
    description: 'Almacenamiento corporativo, edición colaborativa simultánea y flujos compartidos.',
    features: [
      {
        description: 'Espacio ampliado en la nube para centralizar y compartir archivos con tu grupo.',
        title: '500 GB de almacenamiento para equipos',
      },
      {
        description: 'Lotes de hasta 500 archivos simultáneos y soporte total de archivos hasta 1,000 MB.',
        title: 'Capacidad ultra alta de procesamiento',
      },
      {
        description: 'Edición conjunta de documentos interactivos con control y trazabilidad de cambios.',
        title: 'Colaboración en tiempo real',
      },
      {
        description: 'Crea, estandariza y distribuye cadenas de automatización entre miembros del equipo.',
        title: 'Flujos de trabajo compartidos',
      },
      {
        description: 'Administración centralizada de integrantes, consumo de recursos y permisos.',
        title: 'Panel de control y gestión de licencias',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: true,
    hasSaml: false,
    hasSso: false,
    id: 'business',
    maxWorkflows: 200,
    name: 'BoardPDF Negocios',
    priceMonthly: 19.99,
    priceYearly: 15.99,
    storageGB: 500,
    storageLabel: '500 GB de almacenamiento',
    supportLevel: 'priority',
    tagline: 'Máxima potencia, automatización y colaboración avanzada para despachos y equipos en crecimiento.',
  },
  free: {
    buttonText: 'Plan actual',
    category: 'general',
    description: 'Herramientas esenciales para procesar y gestionar documentos sin costo.',
    features: [
      {
        description: 'Combina, organiza y rota documentos con límites de 50 MB por archivo.',
        title: 'Lotes estándar de hasta 25 archivos',
      },
      {
        description: 'Espacio personal sincronizado para respaldar y gestionar tus documentos.',
        title: '5 GB de almacenamiento en nube',
      },
      {
        description: 'Convierte archivos JPG, Word, Excel y PowerPoint a formato PDF sin marca de agua.',
        title: 'Herramientas de conversión esenciales',
      },
      {
        description: 'Aplica contraseñas, bloqueos y marcas de agua personalizadas en tus PDFs.',
        title: 'Seguridad y protección básica',
      },
      {
        description: 'Automatiza secuencias básicas de procesamiento documental en tu navegador.',
        title: '5 flujos de trabajo locales',
      },
    ],
    hasAdvancedAi: false,
    hasBatchProcessing: false,
    hasOrganization: false,
    hasSaml: false,
    hasSso: false,
    id: 'free',
    maxWorkflows: 5,
    name: 'BoardPDF Free',
    priceMonthly: 0,
    priceYearly: 0,
    storageGB: 5,
    storageLabel: '5 GB de almacenamiento',
    supportLevel: 'community',
    tagline: 'Ideal para comenzar a explorar y procesar documentos sin costo.',
  },
  pro: {
    badge: 'Más Popular',
    buttonText: 'Obtener BoardPDF Pro',
    category: 'general',
    description: 'El plan más equilibrado para profesionales, investigadores y creadores independientes.',
    features: [
      {
        description: 'Convierte, une y organiza hasta 500 archivos por tarea sin límites de espera.',
        title: 'Procesamiento masivo por lotes',
      },
      {
        description: 'Procesa documentos extensos con soporte de alta fidelidad y máxima compresión.',
        title: 'Archivos de gran capacidad (1,000 MB)',
      },
      {
        description: 'Sincronización instantánea, respaldo seguro y acceso desde cualquier dispositivo.',
        title: '100 GB de almacenamiento en nube',
      },
      {
        description: 'Reconocimiento óptico de texto, resumen inteligente y traducción con IA.',
        title: 'OCR y herramientas de Inteligencia Artificial',
      },
      {
        description: 'Guarda y encadena automatizaciones personalizadas para optimizar tu tiempo.',
        title: '50 flujos de trabajo avanzados',
      },
    ],
    hasAdvancedAi: true,
    hasBatchProcessing: true,
    hasOrganization: false,
    hasSaml: false,
    hasSso: false,
    id: 'pro',
    isPopular: true,
    maxWorkflows: 50,
    name: 'BoardPDF Pro',
    priceMonthly: 9.99,
    priceYearly: 7.99,
    storageGB: 100,
    storageLabel: '100 GB de almacenamiento',
    supportLevel: 'priority',
    tagline: 'El plan más equilibrado para profesionales, investigadores y creadores independientes.',
  },
};

export function normalizeTierKey(tier?: string | null): SubscriptionTierKey {
  const clean = (tier || 'free').toLowerCase().trim();
  if (clean === 'negocios' || clean === 'business') {
    return 'business';
  }
  if (clean === 'pro') {
    return 'pro';
  }
  return 'free';
}

export function getPlanBenefits(tier?: string | null): PlanBenefitsDefinition {
  const norm = normalizeTierKey(tier);
  return PLAN_TIER_BENEFITS[norm];
}

export function getToolTierLimits(toolId: string, tier: SubscriptionTierKey = 'free'): ToolLimitTierConfig {
  const tool = ALL_TOOLS_LIMITS[toolId];
  if (!tool) {
    return { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 };
  }
  const norm = normalizeTierKey(tier);
  return tool[norm];
}

export function resolveToolLimits(toolId: string, permissions: string[] = []): ToolLimitTierConfig {
  const tool = ALL_TOOLS_LIMITS[toolId];
  if (!tool) {
    return { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 };
  }

  const perms = permissions ?? [];

  if (perms.includes('subscription:feature:business')) {
    return tool.business;
  }
  if (perms.includes('subscription:feature:pro')) {
    return tool.pro;
  }

  if (tool.pro.requiredPermission && perms.includes(tool.pro.requiredPermission)) {
    return tool.pro;
  }
  if (tool.business.requiredPermission && perms.includes(tool.business.requiredPermission)) {
    return tool.business;
  }

  return tool.free;
}
