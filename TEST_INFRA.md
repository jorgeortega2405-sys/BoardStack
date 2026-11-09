# Standards & Architectural Compliance Test Infrastructure (TEST_INFRA.md)

## 1. Executive Summary & Testing Objectives
This document establishes the test architecture, methodologies, and verification matrix for the **Monorepo Standards & Acceptance Testing Suite (Requirements R1 through R7)** across the BoardStack monorepo and the BoardPDF application.

The primary objective is to provide an authoritative, automated, opaque-box test harness that strictly enforces architectural invariants, code quality, security rules, and design standards defined in:
- `ORIGINAL_REQUEST.md` (Approved Task Prompt, Requirements R1 to R7)
- `PROJECT.md` (Features F1 through F22, Interface Contracts, Code Layout)
- Master System Directives: `AGENTS.md` and `GEMINI.md`

The suite runs natively using Node.js Test Runner (`node:test`, `node:assert/strict`) via `tsx`, requiring zero third-party testing overhead or browser binaries while executing 96 comprehensive tests in ~13 seconds.

---

## 2. Test Architecture & Execution Framework

### 2.1 Runner & Runtime Environment
- **Test Runner**: Built-in Node.js Test Runner (`node:test`, `node:assert/strict`).
- **Loader**: `tsx` (TypeScript Execute v4.23+ with ESM module loader).
- **Compilation**: Clean TypeScript compilation verified via `tsc`.
- **Execution Commands**:
  ```bash
  # Execute entire master standards test suite (96 tests across R1-R7)
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/all-standards.test.ts

  # Or execute individual requirement suites
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r1-legal-pricing.test.ts
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r2-stripe-initialization.test.ts
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r3-env-fallback-elimination.test.ts
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r4-typescript-structure-cleanliness.test.ts
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r5-centralized-logging-deduplication.test.ts
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r6-internationalization-zero-spanish.test.ts
  npx --prefix apps/BoardPDF tsx apps/BoardPDF/test/standards/r7-css-modularization-and-rules.test.ts
  ```

### 2.2 Directory Structure
```
apps/BoardPDF/test/standards/
├── helpers/
│   └── standards-test-utils.ts                 # Monorepo path resolution, AST parsing, regex & tokenizers
├── r1-legal-pricing.test.ts                    # R1: Legal policies, Terms Section 10, FAQ, pricing disclaimer (15 tests)
├── r2-stripe-initialization.test.ts            # R2: Stripe setup script, Pro ($4.99) & Business ($9.99), idempotency (14 tests)
├── r3-env-fallback-elimination.test.ts         # R3: Monorepo-wide zero process.env.* || fallbacks (13 tests)
├── r4-typescript-structure-cleanliness.test.ts # R4: Clean bottom exports, zero JSDoc, 100% English non-web (14 tests)
├── r5-centralized-logging-deduplication.test.ts# R5: Centralized Logger, safe HTTP 500s, shared tool validator (14 tests)
├── r6-internationalization-zero-spanish.test.ts# R6: Full web i18n, zero hardcoded Spanish, dictionary parity (13 tests)
├── r7-css-modularization-and-rules.test.ts     # R7: BEM modularization, zero inline styles, zero IDs, button type (13 tests)
└── all-standards.test.ts                       # Integrated master runner aggregating all 96 test cases
```

---

## 3. Four-Tier Testing Methodology

The test suite is structured into four distinct verification tiers across all requirements:

### Tier 1: Primary Feature Coverage
Validates the presence and expected core functionality of each requirement:
- **R1**: Existence of 4 legal policy templates (`terms.html`, `privacy.html`, `cookies.html`, `security.html`) and `faq.html`. Replaces obsolete "Gratuidad del Servicio" in Section 10 with active subscription terms, auto-renewal, and cancellation policies. Pricing disclaimer replaces placeholder lorem text. Privacy policy excludes low-level engine details ("Node.js Sandbox Engine").
- **R2**: Existence of `scripts/init-stripe-products.ts`. Configuration of Pro tier ($4.99/mo, $47.90/yr, $99.00 one-time) and Business tier ($9.99/mo, $95.90/yr, $199.00 one-time). Direct access to `STRIPE_SECRET_KEY` without fallback defaults. Idempotent API queries.
- **R3**: Zero `process.env.* ||` fallback patterns in `env.config.ts`, `process.util.ts`, and `to-pdf-converter.service.ts`. Zero fallback credentials in TypeScript code.
- **R4**: Clean bottom exports in all `.ts` files. Zero JSDoc (`/** ... */`) or decorative comment banners. 100% English non-web code (Rust, Python, Dockerfiles).
- **R5**: Centralized backend logging exclusively through `logger.app`, `logger.db`, `logger.security`. Zero raw `console.*` in backend. Safe HTTP error responses. Existence of shared `validatePdfUpload` helper.
- **R6**: Zero hardcoded inner text inside HTML elements having `data-i18n`. All `<input>` placeholders use `data-i18n-placeholder`. Client `showToast` calls use `t(...)`. Existence of `en/` dictionary bundle.
- **R7**: Zero inline style attributes in HTML templates. Zero `style="display: none;"` (enforces `.is-hidden`). Zero `id="..."` attributes (Rule 9). Button `type` attribute listed first (Rule 10).

### Tier 2: Boundary & Corner Cases
Stresses edge conditions, formatting boundaries, and defensive constraints:
- Substantive length thresholds on legal policy sections (preventing empty stub text).
- Rejection of missing/empty `STRIPE_SECRET_KEY` with immediate fail-fast error exit.
- Amount boundaries in integer cents (e.g. 499, 4790, 9900) without floating-point errors.
- Multiline, bracketed, and optional chaining syntax variations of `process.env` access.
- Detection of forbidden nullish coalescing on sensitive credentials (`process.env.DB_PASSWORD ?? 'pass'`).
- Validation of PDF buffer magic bytes (`%PDF-`), rejecting GIF, PNG, or empty buffers.
- Verification that translation dictionary keys do not contain empty or null values, and all `{param}` braces are balanced.
- Absence of `window.alert`, `window.confirm`, or `window.prompt` in client code.

### Tier 3: Cross-Feature Combinations & Architectural Invariants
Verifies end-to-end coherence across separate layers of the monorepo:
- Parity between Stripe script pricing, legal terms Section 10, and `plans.config.ts`.
- Resolution of 100% of `data-i18n*` attributes across all 50 HTML templates against `public/translations/es/`.
- Integration between 21 tool controllers and the shared `validatePdfUpload` helper in `src/utils/tool-handler.util.ts`.
- Single-line horizontal imports sorted alphabetically coexisting with bottom exports.
- Decoupling of client DOM queries from view-specific CSS classes, using semantic `[data-ref="..."]` selectors.

### Tier 4: Monorepo-Wide Real-World Scenarios & Full Audits
Conducts exhaustive AST and token scans across the entire production codebase:
- Automated scan across all 327+ TypeScript files verifying zero `process.env.* ||`.
- Automated scan across all 327+ TypeScript files verifying zero JSDoc and clean bottom exports.
- Automated scan across all 50 HTML templates verifying zero inline styles, zero IDs, and correct attribute ordering.
- Automated scan across all client TypeScript files verifying zero hardcoded Spanish user messages.
- Verification of 100% English code across Rust microservices (`collab-server`), Python workers (`scripts/*.py`), SQL schemas, and Dockerfiles.

---

## 4. Test Suite Inventory & Matrix

| Requirement | Test Suite File | Tiers Covered | Test Count | Key Invariants Verified |
|---|---|---|---|---|
| **R1** | `r1-legal-pricing.test.ts` | Tiers 1-4 | 15 | 4 legal policies exist; Terms Sec 10 subscription & refund terms; zero free claims; pricing disclaimer; no low-level engine leaks |
| **R2** | `r2-stripe-initialization.test.ts` | Tiers 1-4 | 14 | `scripts/init-stripe-products.ts` exists; Pro ($4.99/mo, $47.90/yr, $99); Business ($9.99/mo, $95.90/yr, $199); idempotency; zero fallbacks |
| **R3** | `r3-env-fallback-elimination.test.ts` | Tiers 1-4 | 13 | Monorepo-wide zero `process.env.* \|\|`; zero fallback credentials; `env.config.ts`, `process.util.ts`, `to-pdf-converter.ts` audit |
| **R4** | `r4-typescript-structure-cleanliness.test.ts` | Tiers 1-4 | 14 | Clean exports at bottom; zero JSDoc (`/** ... */`); zero decorative banners; 100% English non-web code (Rust, Python, Dockerfiles) |
| **R5** | `r5-centralized-logging-deduplication.test.ts` | Tiers 1-4 | 14 | Logger service exclusive backend routing; zero raw `console.*`; generic user-safe 500 errors; shared `validatePdfUpload` helper |
| **R6** | `r6-internationalization-zero-spanish.test.ts` | Tiers 1-4 | 13 | Zero hardcoded Spanish in HTML/TS; elements with `data-i18n` empty; `showToast(t(...))`; dictionary key resolution & bilingual parity |
| **R7** | `r7-css-modularization-and-rules.test.ts` | Tiers 1-4 | 13 | Generic BEM classes; zero inline styles (Rule 6); zero IDs (Rule 9); button `type` first (Rule 10); `.is-hidden` utility |
| **MASTER** | `all-standards.test.ts` | Tiers 1-4 | **96** | Integrated test harness executing all 7 requirements in a single unified run |

---

## 5. Escalation & Milestone Alignment Protocol

As an opaque-box test suite adhering to progressive milestone testability:
1. **Pass Status (M1 Complete)**: R1 (Legal Policies & Pricing Disclaimer) and R2 (Stripe Setup Script) pass 100% (29/29 tests pass).
2. **Planned Milestones (M2 through M6)**:
   - **M2 (Security & Env Fallbacks)**: Monorepo scan in `r3-env-fallback-elimination.test.ts` tracks 48 remaining `process.env.* ||` fallbacks to be eliminated by M2 workers.
   - **M3 (TypeScript Exports & Cleanliness)**: `r4-typescript-structure-cleanliness.test.ts` tracks export reorganization to bottom and comment stripping across monorepo.
   - **M4 (Centralized Logging & Deduplication)**: `r5-centralized-logging-deduplication.test.ts` tracks creation of `src/utils/tool-handler.util.ts` and controller unification.
   - **M5 (Full Web Internationalization)**: `r6-internationalization-zero-spanish.test.ts` tracks extraction of hardcoded Spanish strings into translations and `en/` dictionary bundle.
   - **M6 (CSS Modularization & Rule 6)**: `r7-css-modularization-and-rules.test.ts` tracks removal of 222 inline style attributes in HTML templates.
3. **Escalation Policy**: Implementation defects are documented and reported to the orchestrator for assignment to the appropriate milestone workers without modifying production implementation code from the test track.
