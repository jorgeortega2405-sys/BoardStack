import { getCurrentLanguage } from '../services/i18n.service.js';
import { loadStylesheet } from '../utils/dom.util.js';
import { isSupportedLanguage, normalizeLanguageCode } from '../utils/languages.util.js';
import { SEO_ROUTES, getLocalizedPath, resolveRouteFromSlug } from './seo.config.js';

interface RouteContext {
  params: Record<string, string>;
  path: string;
  previousPath: string;
  query: URLSearchParams;
}

type RouteHandler = (ctx: RouteContext) => Promise<HTMLElement | null>;

interface RouteDefinition {
  handler: RouteHandler;
  id: string;
  match: (path: string) => boolean | Record<string, string>;
}

const APP_ROUTES: RouteDefinition[] = [
  {
    handler: async (ctx) => {
      const { createHomeView } = await import('../views/home.view.js');
      return await createHomeView();
    },
    id: 'home',
    match: (path) => path === '/' || path === '',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPdfToMarkdownView } = await import('../views/tools/pdf-to-markdown/pdf-to-markdown.view.js');
      return await createPdfToMarkdownView();
    },
    id: 'pdf-to-markdown',
    match: (path) => path === '/pdf-to-markdown' || path.startsWith('/pdf-to-markdown'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createSummarizePdfView } = await import('../views/tools/summarize-pdf/summarize-pdf.view.js');
      return await createSummarizePdfView();
    },
    id: 'summarize-pdf',
    match: (path) => path === '/summarize-pdf' || path.startsWith('/summarize-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createTranslatePdfView } = await import('../views/tools/translate-pdf/translate-pdf.view.js');
      return await createTranslatePdfView();
    },
    id: 'translate-pdf',
    match: (path) => path === '/translate-pdf' || path.startsWith('/translate-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createMergePdfView } = await import('../views/tools/merge-pdf/merge-pdf.view.js');
      return await createMergePdfView();
    },
    id: 'merge-pdf',
    match: (path) => path === '/merge-pdf' || path.startsWith('/merge-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createSplitPdfView } = await import('../views/tools/split-pdf/split-pdf.view.js');
      return await createSplitPdfView();
    },
    id: 'split-pdf',
    match: (path) => path === '/split-pdf' || path.startsWith('/split-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createSplitPdfView } = await import('../views/tools/split-pdf/split-pdf.view.js');
      return await createSplitPdfView('pages');
    },
    id: 'extract-pdf-pages',
    match: (path) => path === '/extract-pdf-pages' || path.startsWith('/extract-pdf-pages'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createRemovePdfPagesView } = await import('../views/tools/remove-pdf-pages/remove-pdf-pages.view.js');
      return await createRemovePdfPagesView();
    },
    id: 'remove-pdf-pages',
    match: (path) => path === '/remove-pdf-pages' || path.startsWith('/remove-pdf-pages'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createOrganizePdfView } = await import('../views/tools/organize-pdf/organize-pdf.view.js');
      return await createOrganizePdfView();
    },
    id: 'organize-pdf',
    match: (path) => path === '/organize-pdf' || path.startsWith('/organize-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createRotatePdfView } = await import('../views/tools/rotate-pdf/rotate-pdf.view.js');
      return await createRotatePdfView();
    },
    id: 'rotate-pdf',
    match: (path) => path === '/rotate-pdf' || path.startsWith('/rotate-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPageNumbersView } = await import('../views/tools/page-numbers/page-numbers.view.js');
      return await createPageNumbersView();
    },
    id: 'page-numbers',
    match: (path) => path === '/page-numbers' || path.startsWith('/page-numbers') || path === '/add-page-numbers' || path.startsWith('/add-page-numbers'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createCropPdfView } = await import('../views/tools/crop-pdf/crop-pdf.view.js');
      return await createCropPdfView();
    },
    id: 'crop-pdf',
    match: (path) => path === '/crop-pdf' || path.startsWith('/crop-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createWatermarkPdfView } = await import('../views/tools/watermark-pdf/watermark-pdf.view.js');
      return await createWatermarkPdfView();
    },
    id: 'watermark-pdf',
    match: (path) => path === '/watermark-pdf' || path.startsWith('/watermark-pdf') || path === '/add-watermark' || path.startsWith('/add-watermark'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createEditPdfView } = await import('../views/tools/edit-pdf/edit-pdf.view.js');
      return await createEditPdfView();
    },
    id: 'edit-pdf',
    match: (path) => path === '/edit-pdf' || path.startsWith('/edit-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createProtectPdfView } = await import('../views/tools/protect-pdf/protect-pdf.view.js');
      return await createProtectPdfView();
    },
    id: 'protect-pdf',
    match: (path) => path === '/protect-pdf' || path.startsWith('/protect-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createRedactPdfView } = await import('../views/tools/redact-pdf/redact-pdf.view.js');
      return await createRedactPdfView();
    },
    id: 'redact-pdf',
    match: (path) => path === '/redact-pdf' || path.startsWith('/redact-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createUnlockPdfView } = await import('../views/tools/unlock-pdf/unlock-pdf.view.js');
      return await createUnlockPdfView();
    },
    id: 'unlock-pdf',
    match: (path) => path === '/unlock-pdf' || path.startsWith('/unlock-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPdfConverterView } = await import('../views/tools/pdf-converter/pdf-converter.view.js');
      return await createPdfConverterView('pdf-to-jpg');
    },
    id: 'pdf-to-jpg',
    match: (path) => path === '/pdf-to-jpg' || path.startsWith('/pdf-to-jpg'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPdfConverterView } = await import('../views/tools/pdf-converter/pdf-converter.view.js');
      return await createPdfConverterView('pdf-to-word');
    },
    id: 'pdf-to-word',
    match: (path) => path === '/pdf-to-word' || path.startsWith('/pdf-to-word'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPdfConverterView } = await import('../views/tools/pdf-converter/pdf-converter.view.js');
      return await createPdfConverterView('pdf-to-powerpoint');
    },
    id: 'pdf-to-powerpoint',
    match: (path) => path === '/pdf-to-powerpoint' || path.startsWith('/pdf-to-powerpoint'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPdfConverterView } = await import('../views/tools/pdf-converter/pdf-converter.view.js');
      return await createPdfConverterView('pdf-to-excel');
    },
    id: 'pdf-to-excel',
    match: (path) => path === '/pdf-to-excel' || path.startsWith('/pdf-to-excel'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createPdfConverterView } = await import('../views/tools/pdf-converter/pdf-converter.view.js');
      return await createPdfConverterView('pdf-to-pdfa');
    },
    id: 'pdf-to-pdfa',
    match: (path) => path === '/pdf-to-pdfa' || path.startsWith('/pdf-to-pdfa'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createToPdfConverterView } = await import('../views/tools/to-pdf-converter/to-pdf-converter.view.js');
      return await createToPdfConverterView('jpg-to-pdf');
    },
    id: 'jpg-to-pdf',
    match: (path) => path === '/jpg-to-pdf' || path.startsWith('/jpg-to-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createToPdfConverterView } = await import('../views/tools/to-pdf-converter/to-pdf-converter.view.js');
      return await createToPdfConverterView('word-to-pdf');
    },
    id: 'word-to-pdf',
    match: (path) => path === '/word-to-pdf' || path.startsWith('/word-to-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createToPdfConverterView } = await import('../views/tools/to-pdf-converter/to-pdf-converter.view.js');
      return await createToPdfConverterView('powerpoint-to-pdf');
    },
    id: 'powerpoint-to-pdf',
    match: (path) => path === '/powerpoint-to-pdf' || path.startsWith('/powerpoint-to-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createToPdfConverterView } = await import('../views/tools/to-pdf-converter/to-pdf-converter.view.js');
      return await createToPdfConverterView('excel-to-pdf');
    },
    id: 'excel-to-pdf',
    match: (path) => path === '/excel-to-pdf' || path.startsWith('/excel-to-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createToPdfConverterView } = await import('../views/tools/to-pdf-converter/to-pdf-converter.view.js');
      return await createToPdfConverterView('html-to-pdf');
    },
    id: 'html-to-pdf',
    match: (path) => path === '/html-to-pdf' || path.startsWith('/html-to-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createComparePdfView } = await import('../views/tools/compare-pdf/compare-pdf.view.js');
      return await createComparePdfView();
    },
    id: 'compare-pdf',
    match: (path) => path === '/compare-pdf' || path.startsWith('/compare-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createCompressPdfView } = await import('../views/tools/compress-pdf/compress-pdf.view.js');
      return await createCompressPdfView();
    },
    id: 'compress-pdf',
    match: (path) => path === '/compress-pdf' || path.startsWith('/compress-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createRepairPdfView } = await import('../views/tools/repair-pdf/repair-pdf.view.js');
      return await createRepairPdfView();
    },
    id: 'repair-pdf',
    match: (path) => path === '/repair-pdf' || path.startsWith('/repair-pdf'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createOcrPdfView } = await import('../views/tools/ocr-pdf/ocr-pdf.view.js');
      return await createOcrPdfView();
    },
    id: 'ocr-pdf',
    match: (path) => path === '/ocr-pdf' || path.startsWith('/ocr-pdf'),
  },
  {
    handler: async ({ params }) => {
      await Promise.all([
        loadStylesheet('/css/components/component-views.css'),
        loadStylesheet('/css/tools/tool-workspace.css'),
      ]);
      const { createDownloadReadyView } = await import('../views/download-ready/download-ready.view.js');
      return await createDownloadReadyView(params.token);
    },
    id: 'download-ready',
    match: (path) => {
      const downloadMatch = path.match(/^\/download\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
      if (downloadMatch) return { token: downloadMatch[2] ? `${downloadMatch[1]}/${downloadMatch[2]}` : downloadMatch[1] };
      const readyMatch = path.match(/^\/download-ready\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
      if (readyMatch) return { token: readyMatch[2] ? `${readyMatch[1]}/${readyMatch[2]}` : readyMatch[1] };
      if (path === '/download-ready' || path === '/download') return { token: '' };
      return false;
    },
  },
  {
    handler: async ({ params, query }) => {
      const docId = params.id || query.get('id') || '';
      const { currentUser } = await import('../services/api.service.js');
      if (!docId && !currentUser) {
        const { navigate } = await import('../services/navigation.service.js');
        navigate(`/login?redirect=${encodeURIComponent('/projects')}`, true);
        return null;
      }
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createCollaborativePdfEditorView } = await import('../views/collaborative-pdf/collaborative-pdf-editor.view.js');
      return await createCollaborativePdfEditorView(docId, query);
    },
    id: 'collaborative-pdf-editor',
    match: (path) => {
      const match = path.match(/^\/d\/([a-zA-Z0-9_-]+)\/?$/);
      if (match) return { id: match[1] };
      if (path === '/d' || path === '/d/') return { id: '' };
      if (path === '/collaborative-pdf/editor' || path.startsWith('/collaborative-pdf/editor')) return true;
      return false;
    },
  },
  {
    handler: async ({ params }) => {
      const slug = params?.slug;
      const { navigate } = await import('../services/navigation.service.js');
      if (!slug) {
        navigate('/');
        return null;
      }
      const { getApi } = await import('../services/api.service.js');
      try {
        const res = await getApi(`/api/collaborative-docs/resolve-slug/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            navigate(`/d/${data.id}`, true);
            return null;
          }
        }
      } catch {}
      navigate('/');
      return null;
    },
    id: 'collab-custom-link-resolver',
    match: (path) => {
      const match = path.match(/^\/l\/([a-zA-Z0-9_-]+)\/?$/);
      return match ? { slug: match[1] } : false;
    },
  },
  {
    handler: async ({ params }) => {
      const { currentUser } = await import('../services/api.service.js');
      if (!currentUser) {
        const { navigate } = await import('../services/navigation.service.js');
        const targetPath = window.location.pathname || '/projects';
        navigate(`/login?redirect=${encodeURIComponent(targetPath)}`, true);
        return null;
      }
      await loadStylesheet('/css/tools/tool-workspace.css');
      await loadStylesheet('/css/components/component-views.css');
      const { createProjectsView } = await import('../views/projects/projects.view.js');
      return await createProjectsView(params?.folderId || null);
    },
    id: 'projects',
    match: (path) => {
      if (path === '/projects' || path === '/projects/') {
        return { folderId: '' };
      }
      const match = path.match(/^\/projects\/([a-zA-Z0-9_\-]+)\/?$/);
      if (match) {
        return { folderId: match[1] };
      }
      return false;
    },
  },
  {
    handler: async (ctx) => {
      const { currentUser } = await import('../services/api.service.js');
      const { navigate } = await import('../services/navigation.service.js');
      if (!currentUser) {
        navigate('/login?redirect=%2Fprojects', true);
      } else {
        navigate('/projects', true);
      }
      return null;
    },
    id: 'collaborative-pdf',
    match: (path) => path === '/collaborative-pdf' || (path.startsWith('/collaborative-pdf') && !path.startsWith('/collaborative-pdf/editor')),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      await loadStylesheet('/css/tools/tool-workspace.css');
      const { createWorkflowsPageView } = await import('../views/workflows.view.js');
      return await createWorkflowsPageView();
    },
    id: 'workflows',
    match: (path) => path === '/workflows' || path.startsWith('/workflows'),
  },
  {
    handler: async (ctx) => {
      const { getWorkflow } = await import('../services/workflow-storage.service.js');
      const { getActiveWorkflowSession, startWorkflowSession } = await import('../services/workflow-session.service.js');
      const { navigate } = await import('../services/navigation.service.js');
      const { showToast } = await import('../services/toast.service.js');
      const { t } = await import('../services/i18n.service.js');

      const wf = getWorkflow(ctx.params.id || '');
      if (!wf || !wf.steps || wf.steps.length === 0) {
        showToast(t('workflows.workflow_not_found'), 'danger');
        navigate('/workflows', true);
        return null;
      }

      let session = getActiveWorkflowSession();
      if (!session || session.workflowId !== wf.id) {
        startWorkflowSession(wf);
        session = getActiveWorkflowSession();
      }

      const currentStep = session?.steps[session.currentStepIndex] || wf.steps[0];
      const toolRoute = APP_ROUTES.find((r) => r.id === currentStep.tool);
      if (!toolRoute) {
        showToast(t('workflows.workflow_not_found'), 'danger');
        navigate('/workflows', true);
        return null;
      }

      return await toolRoute.handler({
        params: {},
        path: `/${currentStep.tool}`,
        previousPath: ctx.previousPath,
        query: ctx.query,
      });
    },
    id: 'workflow-runner',
    match: (path) => {
      const match = path.match(/^\/workflow\/([a-zA-Z0-9_-]+)$/);
      return match ? { id: match[1] } : false;
    },
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createHelpFaqView } = await import('../views/help.view.js');
      return await createHelpFaqView();
    },
    id: 'help-faq',
    match: (path) => path === '/help/faq' || path === '/help-faq' || path === '/faq' || path === '/preguntas-frecuentes',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createHelpPrivacyView } = await import('../views/help.view.js');
      return await createHelpPrivacyView();
    },
    id: 'help-privacy',
    match: (path) => path === '/help/privacy' || path === '/help-privacy' || path === '/privacy' || path === '/privacy-policy' || path === '/privacidad',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createHelpTermsView } = await import('../views/help.view.js');
      return await createHelpTermsView();
    },
    id: 'help-terms',
    match: (path) => path === '/help/terms' || path === '/help-terms' || path === '/terms' || path === '/terms-and-conditions' || path === '/terminos',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createHelpCookiesView } = await import('../views/help.view.js');
      return await createHelpCookiesView();
    },
    id: 'help-cookies',
    match: (path) => path === '/help/cookies' || path === '/help-cookies' || path === '/cookies' || path === '/cookie-policy',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createHelpSecurityView } = await import('../views/help.view.js');
      return await createHelpSecurityView();
    },
    id: 'help-security',
    match: (path) => path === '/help/security' || path === '/help-security' || path === '/security' || path === '/security-policy' || path === '/seguridad',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createAboutView } = await import('../views/about.view.js');
      return await createAboutView();
    },
    id: 'about',
    match: (path) => path === '/about' || path === '/sobre-nosotros' || path === '/help/about' || path.startsWith('/about'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createContactView } = await import('../views/contact.view.js');
      return await createContactView();
    },
    id: 'contact',
    match: (path) => path === '/contact' || path === '/contacto' || path === '/help/contact' || path.startsWith('/contact'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createPricingView } = await import('../views/pricing.view.js');
      return await createPricingView();
    },
    id: 'pricing',
    match: (path) => path === '/pricing' || path === '/precios' || path === '/precio' || path.startsWith('/pricing') || path.startsWith('/precios') || path.startsWith('/precio'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createCheckoutView } = await import('../views/checkout.view.js');
      return await createCheckoutView(ctx?.query);
    },
    id: 'checkout',
    match: (path) => path === '/checkout' || path.startsWith('/checkout'),
  },
  {
    handler: async ({ path }) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createHelpCookiesView, createHelpFaqView, createHelpPrivacyView, createHelpSecurityView, createHelpTermsView } = await import('../views/help.view.js');

      switch (path) {
        case '/help/faq':
        case '/help-faq':
        case '/faq':
        case '/preguntas-frecuentes':
          return await createHelpFaqView();
        case '/help/about':
        case '/about':
        case '/sobre-nosotros': {
          const { createAboutView } = await import('../views/about.view.js');
          return await createAboutView();
        }
        case '/help/contact':
        case '/contact':
        case '/contacto': {
          const { createContactView } = await import('../views/contact.view.js');
          return await createContactView();
        }
        case '/help/privacy':
        case '/help-privacy':
        case '/privacy':
        case '/privacy-policy':
        case '/privacidad':
          return await createHelpPrivacyView();
        case '/help/terms':
        case '/help-terms':
        case '/terms':
        case '/terms-and-conditions':
        case '/terminos':
          return await createHelpTermsView();
        case '/help/cookies':
        case '/help-cookies':
        case '/cookies':
        case '/cookie-policy':
          return await createHelpCookiesView();
        case '/help/security':
        case '/help-security':
        case '/security':
        case '/security-policy':
        case '/seguridad':
          return await createHelpSecurityView();
        default:
          if (path === '/help' || path === '/help/') {
            window.history.replaceState({}, '', '/help/security');
          }
          return await createHelpSecurityView();
      }
    },
    id: 'help',
    match: (path) => path === '/help' || path === '/help/' || path.startsWith('/help/') || path.startsWith('/help-'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createLoginView } = await import('../views/auth.view.js');
      return await createLoginView();
    },
    id: 'login',
    match: (path) => path === '/login' || path.startsWith('/login'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createRegisterView } = await import('../views/auth.view.js');
      return await createRegisterView();
    },
    id: 'register',
    match: (path) => path === '/register' || path.startsWith('/register'),
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createForgotPasswordView } = await import('../views/auth.view.js');
      return await createForgotPasswordView();
    },
    id: 'forgot-password',
    match: (path) => path === '/forgot-password',
  },
  {
    handler: async (ctx) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createResetPasswordView } = await import('../views/auth.view.js');
      return await createResetPasswordView();
    },
    id: 'reset-password',
    match: (path) => path === '/reset-password',
  },
  {
    handler: async ({ path }) => {
      await loadStylesheet('/css/components/component-views.css');
      const { createBillingView, createPurchasesView, createSecurityView, createYourAccountView } = await import('../views/settings.view.js');
      if (path === '/settings' || path === '/settings/' || path === '/settings/your-account') {
        if (path === '/settings' || path === '/settings/') {
          window.history.replaceState({}, '', '/settings/your-account');
        }
        return await createYourAccountView();
      }
      if (path === '/settings/security') {
        return await createSecurityView();
      }
      if (path === '/settings/billing') {
        return await createBillingView();
      }
      if (path === '/settings/purchases' || path === '/settings/purchase-history') {
        return await createPurchasesView();
      }
      return await createYourAccountView();
    },
    id: 'settings',
    match: (path) => path === '/settings' || path === '/settings/' || path.startsWith('/settings/'),
  },
  {
    handler: async () => {
      await loadStylesheet('/css/components/component-views.css');
      await loadStylesheet('/css/components/component-overlays.css');
      const { createModalTestView } = await import('../views/modaltest.view.js');
      return await createModalTestView();
    },
    id: 'modaltest',
    match: (path) => path === '/modaltest' || path === '/modaltest/',
  },
  {
    handler: async (ctx) => {
      const { createNotFoundView } = await import('../views/not-found.view.js');
      return await createNotFoundView();
    },
    id: 'not-found',
    match: (path) => path === '/404',
  },
];

interface MatchedRoute {
  canonicalPath: string;
  hasLangPrefix: boolean;
  internalPath: string;
  isCanonical: boolean;
  lang: string;
  params: Record<string, string>;
  rawPath: string;
  route: RouteDefinition;
  routeId: string;
}

function parseRoutePath(rawPath: string): {
  hasLangPrefix: boolean;
  internalPath: string;
  lang: string;
  resolvedRouteId: string | null;
  slug: string;
} {
  const clean = (rawPath || '').split('?')[0].replace(/^\/+|\/+$/g, '');
  const activeLang = getCurrentLanguage();

  if (!clean) {
    return {
      hasLangPrefix: false,
      internalPath: '/',
      lang: activeLang,
      resolvedRouteId: 'home',
      slug: '',
    };
  }

  const parts = clean.split('/');
  const first = parts[0].toLowerCase();

  if (isSupportedLanguage(first) || first === 'es' || first === 'en') {
    const lang = first === 'es' || first === 'en' ? first : normalizeLanguageCode(first);
    const subPath = parts.slice(1).join('/');

    if (!subPath) {
      return {
        hasLangPrefix: true,
        internalPath: '/',
        lang,
        resolvedRouteId: 'home',
        slug: '',
      };
    }

    const resolved = resolveRouteFromSlug(subPath, lang);
    if (resolved) {
      return {
        hasLangPrefix: true,
        internalPath: `/${resolved.routeId}`,
        lang,
        resolvedRouteId: resolved.routeId,
        slug: subPath,
      };
    }

    return {
      hasLangPrefix: true,
      internalPath: `/${subPath}`,
      lang,
      resolvedRouteId: null,
      slug: subPath,
    };
  }

  const resolved = resolveRouteFromSlug(clean, activeLang);
  if (resolved) {
    return {
      hasLangPrefix: false,
      internalPath: `/${resolved.routeId}`,
      lang: activeLang,
      resolvedRouteId: resolved.routeId,
      slug: clean,
    };
  }

  return {
    hasLangPrefix: false,
    internalPath: `/${clean}`,
    lang: activeLang,
    resolvedRouteId: null,
    slug: clean,
  };
}

function findRoute(path: string): MatchedRoute | null {
  const parsed = parseRoutePath(path);

  const resolveMatched = (routeDef: RouteDefinition, routeId: string, params: Record<string, string>): MatchedRoute => {
    const isWorkflowRunner = routeId === 'workflow-runner' && Boolean(params.id);
    const isSeo = routeId in SEO_ROUTES;
    let canonicalPath = path;
    let isCanonical = true;

    if (isWorkflowRunner) {
      canonicalPath = `/${parsed.lang}/workflow/${params.id}`;
      isCanonical = parsed.hasLangPrefix && path.replace(/\/+$/, '') === canonicalPath;
    } else if (isSeo) {
      canonicalPath = getLocalizedPath(routeId, parsed.lang);
      isCanonical = parsed.hasLangPrefix && path.replace(/\/+$/, '') === canonicalPath.replace(/\/+$/, '');
    }

    return {
      canonicalPath,
      hasLangPrefix: parsed.hasLangPrefix,
      internalPath: parsed.internalPath,
      isCanonical,
      lang: parsed.lang,
      params,
      rawPath: path,
      route: routeDef,
      routeId,
    };
  };

  if (parsed.resolvedRouteId) {
    const routeDef = APP_ROUTES.find((r) => r.id === parsed.resolvedRouteId);
    if (routeDef) {
      const matchResult = routeDef.match(parsed.internalPath);
      const params = typeof matchResult === 'object' && matchResult !== null ? matchResult : {};
      return resolveMatched(routeDef, parsed.resolvedRouteId, params);
    }
  }

  for (const route of APP_ROUTES) {
    const matchResult = route.match(parsed.internalPath);
    if (matchResult) {
      const params = typeof matchResult === 'object' && matchResult !== null ? matchResult : {};
      return resolveMatched(route, route.id, params);
    }
  }

  return null;
}

export { APP_ROUTES, findRoute, parseRoutePath };
export type { MatchedRoute, RouteContext, RouteDefinition, RouteHandler };
