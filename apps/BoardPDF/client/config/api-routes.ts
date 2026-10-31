export const API_ROUTES = {
  auth: {
    forgotPassword: '/api/forgot-password',
    login: '/api/login',
    logout: '/api/logout',
    logoutAll: '/api/auth/logout-all',
    me: '/api/me',
    registerResendCode: '/api/register/resend-code',
    registerSendCode: '/api/register/send-code',
    registerStage1: '/api/register/stage1-validate',
    registerVerifyCode: '/api/register/verify-code',
    resetPassword: '/api/reset-password',
    switchAccount: '/api/auth/switch-account',
  },
  avatar: (name: string) => `/api/avatar?name=${encodeURIComponent(name)}`,
  avatarBase: '/api/avatar',
  download: {
    delete: (token: string) => `/api/download/${token.split('/').map(encodeURIComponent).join('/')}`,
    file: (token: string) => `/api/download/${token.split('/').map(encodeURIComponent).join('/')}`,
    info: (token: string) => `/api/download/${token.split('/').map(encodeURIComponent).join('/')}/info`,
  },
  health: '/api/health',
  settings: {
    accountDelete: '/api/settings/account/delete',
    avatar: '/api/settings/avatar',
    email: '/api/settings/email',
    emailRequestCode: '/api/settings/email/request-code',
    emailVerifyCode: '/api/settings/email/verify-code',
    password: '/api/settings/password',
    passwordStatus: '/api/settings/password/status',
    passwordVerify: '/api/settings/password/verify',
    preferences: '/api/settings/preferences',
    twoFactorDisable: '/api/settings/2fa/disable',
    twoFactorEnable: '/api/settings/2fa/enable',
    twoFactorGenerate: '/api/settings/2fa/generate',
    twoFactorStatus: '/api/settings/2fa/status',
    username: '/api/settings/username',
  },
  subscription: {
    billing: '/api/subscription/billing',
    cancelImmediate: '/api/subscription/cancel-immediate',
    checkout: '/api/subscription/checkout',
    plans: '/api/subscription/plans',
    purchases: '/api/subscription/purchases',
    renewal: '/api/subscription/renewal',
    verifySession: (sessionId: string) => `/api/subscription/verify-session?session_id=${encodeURIComponent(sessionId)}`,
  },
  tools: {
    comparePdf: {
      compare: '/api/tools/compare-pdf/compare',
      download: (fileId: string) => `/api/tools/compare-pdf/download/${encodeURIComponent(fileId)}`,
    },
    compressPdf: {
      compress: '/api/tools/compress-pdf/compress',
      download: (fileId: string) => `/api/tools/compress-pdf/download/${encodeURIComponent(fileId)}`,
    },
    cropPdf: {
      download: (fileId: string) => `/api/tools/crop-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/crop-pdf/process',
    },
    editPdf: {
      download: (fileId: string) => `/api/tools/edit-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/edit-pdf/process',
    },
    mergePdf: {
      download: (fileId: string) => `/api/tools/merge-pdf/download/${encodeURIComponent(fileId)}`,
      merge: '/api/tools/merge-pdf/merge',
    },
    ocrPdf: {
      download: (fileId: string) => `/api/tools/ocr-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/ocr-pdf/process',
    },
    organizePdf: {
      download: (fileId: string) => `/api/tools/organize-pdf/download/${encodeURIComponent(fileId)}`,
      organize: '/api/tools/organize-pdf/organize',
    },
    pageNumbers: {
      download: (fileId: string) => `/api/tools/page-numbers/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/page-numbers/process',
    },
    pdfConverter: {
      convert: '/api/tools/pdf-converter/convert',
      download: (token: string) => `/api/tools/pdf-converter/download/${encodeURIComponent(token)}`,
    },
    pdfToMarkdown: {
      convert: '/api/tools/pdf-to-markdown/convert',
      download: (fileId: string) => `/api/tools/pdf-to-markdown/download/${encodeURIComponent(fileId)}`,
    },
    protectPdf: {
      download: (fileId: string) => `/api/tools/protect-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/protect-pdf/process',
    },
    redactPdf: {
      download: (fileId: string) => `/api/tools/redact-pdf/download/${encodeURIComponent(fileId)}`,
      redact: '/api/tools/redact-pdf/redact',
    },
    removePdfPages: {
      download: (fileId: string) => `/api/tools/remove-pdf-pages/download/${encodeURIComponent(fileId)}`,
      remove: '/api/tools/remove-pdf-pages/remove',
    },
    repairPdf: {
      download: (fileId: string) => `/api/tools/repair-pdf/download/${encodeURIComponent(fileId)}`,
      repair: '/api/tools/repair-pdf/repair',
    },
    rotatePdf: {
      download: (fileId: string) => `/api/tools/rotate-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/rotate-pdf/process',
    },
    splitPdf: {
      download: (fileId: string) => `/api/tools/split-pdf/download/${encodeURIComponent(fileId)}`,
      split: '/api/tools/split-pdf/split',
    },
    summarizePdf: {
      summarize: '/api/tools/summarize-pdf/summarize',
    },
    toPdfConverter: {
      convert: '/api/tools/to-pdf/convert',
      download: (token: string) => `/api/tools/to-pdf/download/${encodeURIComponent(token)}`,
      preview: '/api/tools/to-pdf/preview',
    },
    translatePdf: {
      download: (fileId: string) => `/api/tools/translate-pdf/download/${encodeURIComponent(fileId)}`,
      translate: '/api/tools/translate-pdf/translate',
    },
    unlockPdf: {
      download: (fileId: string) => `/api/tools/unlock-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/unlock-pdf/process',
    },
    watermarkPdf: {
      download: (fileId: string) => `/api/tools/watermark-pdf/download/${encodeURIComponent(fileId)}`,
      process: '/api/tools/watermark-pdf/process',
    },
  },
} as const;

export default API_ROUTES;
