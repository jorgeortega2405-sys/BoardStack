# Project: Comprehensive Audit, Legal & Billing Alignment, Architectural Cleanup, and Strict Standards Enforcement

## Architecture
- **Application**: BoardStack Monorepo and BoardPDF Web Application (`apps/BoardPDF`)
- **Backend Architecture (`apps/BoardPDF/src/`)**:
  - Express + TypeScript backend configured with central environment validation in `src/config/env.config.ts`.
  - Zero `process.env.* ||` fallback patterns in TypeScript code. Zero hardcoded secrets/passwords/fallback credentials.
  - Centralized logging service (`src/services/logger.service.ts`): all application, database, and security logs route through `logger.app`, `logger.db`, or `logger.security`.
  - Safe HTTP error responses: 100% of 500/400 error handlers return generic user-safe error messages with zero stack traces, SQL queries, or internal paths.
  - Tool Controller Boilerplate Deduplication: shared request validation helper (`src/utils/tool-handler.util.ts`) unifying file check, PDF buffer validation, and limit checks across 21 tool controllers.
- **Stripe & Billing Architecture**:
  - Standalone setup script (`apps/BoardPDF/scripts/init-stripe-products.ts`) programmatically creating products and prices via Stripe SDK.
  - Pro Tier: $4.99/mo (monthly recurring), $47.90/yr (annual recurring with 20% discount), $99.00 (one-time prepaid pass).
  - Business Tier: $9.99/mo (monthly recurring), $95.90/yr (annual recurring with 20% discount), $199.00 (one-time prepaid pass).
  - Pricing Cards Disclaimer: advance billing, auto-renewal, cancel-anytime policy via user settings, and refund policy accurately described.
- **Legal & Public Documentation Architecture**:
  - Views in `apps/BoardPDF/public/views/help/` (`terms.html`, `privacy.html`, `cookies.html`, `security.html`, `faq.html`).
  - Translations in `apps/BoardPDF/public/translations/` (`es/`, `en/`).
  - Reflects real stateless platform capabilities (AWS S3/MinIO ephemeral object storage with AES-256-GCM, Redis session cache & rate limiting, Cloudflare Turnstile bot verification, TOTP 2FA, zero AI model training).
  - Outdated "100% free with no charges" claims replaced with accurate subscription terms, auto-renewal, and cancellation policies.
- **Code Directives & Quality Standards**:
  - Standard TypeScript structure: imports top (horizontal, sorted), logic middle, exports cleanly grouped at the bottom (`export { ... }`, `export default ...`, `export type { ... }`).
  - 100% self-documenting code: zero JSDoc (`/** ... */`), zero PHPDoc, zero decorative comment banners, zero redundant inline comments.
  - Non-web code (Python, Rust, Dockerfiles, SQL schemas, Shell): 100% English naming, logs, CLI strings, and technical annotations.
  - Full Web Internationalization (AGENTS.md Rule 3): zero hardcoded Spanish in HTML templates and client TypeScript controllers. All user-facing text resolved via `data-i18n*` or `t(...)`.
  - Modular CSS Architecture (AGENTS.md Rule 6, 12): view-specific class names refactored to generic BEM component classes (`component-block`, `component-group`, `component-item`, `view-hero`, `view-container`, etc.).
  - Zero inline styles (`style="..."` or `element.style.*`).
  - Zero HTML IDs (Rule 9: `data-ref="..."` exclusively).
  - Button `type` attribute first (Rule 10).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Legal Policies Real Platform Alignment | Rewrite 4 legal policies (Terms, Privacy, Cookies, Security) in `help/*.html` and `translations/*/` to reflect real stateless architecture (S3/MinIO, Redis, MySQL, Turnstile, 2FA, zero AI training) with professional liability protection | M1 | R1, Survey 1 |
| F2 | Terms of Service Section 10 Alignment | Replace obsolete "Gratuidad del Servicio" in Terms with accurate paid subscription terms, advance recurring billing, auto-renewal, cancel-anytime, and refund policies | M1 | R1, Survey 1 |
| F3 | FAQ Section Billing & Refund Alignment | Rewrite FAQ billing items in `general.json` to accurately explain subscription tiers, auto-renewal, cancel-anytime, and refund conditions matching live payment features | M1 | R1, Survey 1 |
| F4 | Pricing Disclaimer Replacement | Replace placeholder text beneath pricing cards in `pricing.html` and `general.json` with accurate text detailing advance billing, automatic renewal, cancel-anytime policy, and refund terms | M1 | R1, Survey 1 |
| F5 | Stripe Product & Pricing Initialization Script | Create standalone idempotent TypeScript script `scripts/init-stripe-products.ts` registering Pro ($4.99/mo, $47.90/yr, $99.00 one-time) and calibrated Business ($9.99/mo, $95.90/yr, $199.00 one-time) | M1 | R2, Survey 1 |
| F6 | Centralized Env Config Fallback Elimination | Eliminate all 46 `process.env.* \|\|` fallback patterns in `src/config/env.config.ts`, replacing with direct accesses or safe nullish coalescing without fallback credentials/secrets | M2 | R3, Survey 2 |
| F7 | Tool Converter & Process Util Env Fallback Elimination | Guard `process.env.LOCALAPPDATA` in `to-pdf-converter.service.ts` and `process.util.ts` with standard conditionals, eliminating all remaining `process.env.* \|\|` patterns | M2 | R3, Survey 2 |
| F8 | TypeScript Export Structure Standardization | Refactor 214 TypeScript files across monorepo to group all exports cleanly at the bottom of the file (`export { ... }`, `export default ...`, `export type { ... }`) | M3 | R4, Survey 2 |
| F9 | TypeScript Comment & Annotation Stripping | Strip all inline explanatory comments in production files (`collab-fonts.config.ts`) and decorative comment headers in test suites, enforcing 100% self-documenting code | M3 | R4, Survey 2 |
| F10 | Non-Web Code 100% English Remediation | Translate all Spanish logs/messages in Rust `collab-server`, CLI usage/errors in Python workers (`scripts/*.py`), comments in Dockerfiles, and SQL schema documentation to 100% English | M3 | R4, Survey 2 |
| F11 | Centralized Backend Logging Enforcement | Enforce exclusive logging through `Logger` service (`logger.app`, `logger.db`, `logger.security`), maintaining zero raw `console.*` in backend | M4 | R5, Survey 2 |
| F12 | HTTP Error Response Sanitization | Audit and ensure 100% of HTTP error responses return generic, user-safe messages with zero technical details, stack traces, or SQL queries | M4 | R5, Survey 2 |
| F13 | Backend Tool Controller Boilerplate Deduplication | Create shared controller validation helper `src/utils/tool-handler.util.ts` (`validatePdfUpload`) and refactor 21 tool controllers to eliminate redundant validation and error boilerplate | M4 | R5, Survey 2 |
| F14 | Frontend Tool Dropzone & Markup Deduplication | Consolidate duplicate dropzone and top-bar markup across tool views into reusable components and shared templates | M4 | R5, Survey 2 |
| F15 | HTML Templates Internationalization (Zero Hardcoded Spanish) | Eliminate 528 hardcoded text nodes and 673 attribute violations across 44 HTML templates in `public/views/`, leaving elements empty with `data-i18n*` attributes | M5 | R6, Survey 3 |
| F16 | Client TypeScript Internationalization | Migrate 697 Spanish string literals and 185 raw `showToast` calls in client TypeScript to `t(...)` translations | M5 | R6, Survey 3 |
| F17 | Translation Dictionaries Expansion & Parity | Add 17 missing keys to `general.json`, register all newly created translation keys, and scaffold the `en/` dictionary bundle for complete bilingual support | M5 | R6, Survey 3 |
| F18 | View-Specific CSS Classes Refactoring | Refactor 184 view-specific CSS classes across 10 view domains to generic BEM component classes (`component-block`, `component-group`, `component-item`, `view-hero`, `view-container`, etc.) | M6 | R7, Survey 3 |
| F19 | TypeScript DOM Class Query Decoupling | Decouple 106 TypeScript DOM queries by class to use semantic `[data-ref="..."]` selectors to prevent visual or functional regressions | M6 | R7, Survey 3 |
| F20 | HTML Inline Style Elimination (Rule 6) | Eliminate 232 inline styles in HTML templates (especially 31 `style="display: none;"` to `.is-hidden`), maintaining zero inline styles outside strict geometric canvas exceptions | M6 | R7, Survey 3 |
| F21 | E2E Automated Verification Suite (Tiers 1-4) | Comprehensive opaque-box test suite covering all 7 requirements (Tiers 1-4, 85+ test cases) publishing `TEST_READY.md` | M7 | Dual Track, Acceptance |
| F22 | Adversarial Hardening (Tier 5) & Forensic Integrity Audit | Stress-testing, edge cases, white-box coverage hardening, and binary forensic audit verifying zero integrity violations | M7 | Dual Track, Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Legal Policies, FAQs, Pricing Disclaimers Alignment & Stripe Setup Script | F1, F2, F3, F4, F5 | none | DONE |
| M2 | Security & Environment Variable Fallback Elimination | F6, F7 | none | DONE |
| M3 | TypeScript Export Standardization, Annotation Stripping & Non-Web English | F8, F9, F10 | none | IN_PROGRESS |
| M4 | Centralized Logging, Error Response Safety & Code Deduplication | F11, F12, F13, F14 | none | PLANNED |
| M5 | Full Web Internationalization (Zero Hardcoded Spanish) | F15, F16, F17 | M1 | PLANNED |
| M6 | CSS Class Modularization to Generic BEM & Inline Style Elimination | F18, F19, F20 | M5 | PLANNED |
| M7 | Full E2E Test Suite Pass (Tiers 1-4) & Adversarial Hardening (Tier 5) | F21, F22 | M1, M2, M3, M4, M5, M6 | PLANNED |

## Interface Contracts
### 1. Stripe Setup Script (`apps/BoardPDF/scripts/init-stripe-products.ts`)
- Standalone CLI execution via `npx tsx scripts/init-stripe-products.ts`.
- Reads `STRIPE_SECRET_KEY` from environment; exits with error code 1 if absent without fallback values.
- Idempotent API queries via Stripe SDK matching `metadata.tier` ('pro' | 'business').
- Creates/reuses products and prices matching:
  - Pro: $4.99/mo (`499`), $47.90/yr (`4790`), $99.00 one-time (`9900`).
  - Business: $9.99/mo (`999`), $95.90/yr (`9590`), $199.00 one-time (`19900`).
- Prints formatted summary and configuration snippets for `plans.config.ts` and `.env`.

### 2. Environment Configuration (`apps/BoardPDF/src/config/env.config.ts`)
- Direct access to `process.env[key]` or safe nullish coalescing (`?? ''`) for non-secrets.
- Zero occurrences of `process.env.* ||` fallback patterns.
- Zero fallback credentials or passwords.

### 3. Backend Tool Validation Handler (`apps/BoardPDF/src/utils/tool-handler.util.ts`)
- Function `validatePdfUpload(req: Request, res: Response, toolId: string): Express.Multer.File | null`
  - Validates `req.file` presence (returns 400 with user-safe message if missing).
  - Validates PDF buffer magic bytes (returns 400 if invalid).
  - Validates file size against PBAC plan limits (returns 400 if exceeded).
  - Returns sanitized `Express.Multer.File` on success.

### 4. Internationalization Service (`apps/BoardPDF/client/services/i18n.service.ts`)
- All HTML templates: element text nodes are empty, referencing translation keys via `data-i18n="..."`.
- All attributes: `data-i18n-placeholder`, `data-i18n-aria`, `data-i18n-title`, `data-i18n-tooltip`.
- All TypeScript client notifications: `showToast(t('key'), type)`. Zero raw string literals.
- Translation dictionaries: `public/translations/es/` and `public/translations/en/` maintaining complete key parity.

### 5. Modular BEM CSS Component Classes (`apps/BoardPDF/public/css/`)
- `.component-block`, `.component-group`, `.component-item`, `.view-hero`, `.view-container`, `.component-card`.
- Modifier classes: `.component-block--notice`, `.component-grid--pricing`, `.component-card--option`, etc.
- Utility `.is-hidden` replacing inline `style="display: none;"`.

## Code Layout
- `apps/BoardPDF/public/views/help/*.html`: Legal policies and FAQ templates.
- `apps/BoardPDF/public/views/pricing/pricing.html`: Pricing cards and disclaimer template.
- `apps/BoardPDF/public/translations/es/*.json`: Spanish translation dictionaries (`general.json`, `terms.json`, `privacy.json`, `cookies.json`, `security.json`).
- `apps/BoardPDF/public/translations/en/*.json`: English translation dictionaries maintaining full key parity.
- `apps/BoardPDF/scripts/init-stripe-products.ts`: Standalone Stripe initialization script.
- `apps/BoardPDF/src/config/env.config.ts`: Centralized environment configuration (zero fallbacks).
- `apps/BoardPDF/src/services/logger.service.ts`: Centralized backend logging service.
- `apps/BoardPDF/src/utils/tool-handler.util.ts`: Shared tool request validation helper.
- `apps/BoardPDF/src/tools/*/*.controller.ts`: Refactored tool controllers using shared validation.
- `apps/BoardPDF/client/views/**/*.ts`: Client TypeScript controllers with bottom exports and `t(...)` i18n.
- `apps/BoardPDF/public/css/components/`: Modular BEM stylesheets (`component-views.css`, `component-layout.css`, `component-overlays.css`, etc.).
- `apps/BoardPDF/collab-server/`: Rust collaborative WebSocket server (100% English).
- `apps/BoardPDF/scripts/*.py`: Python workers (100% English).
- `apps/BoardPDF/test/e2e/`: Automated E2E verification test suite for R1-R7.
