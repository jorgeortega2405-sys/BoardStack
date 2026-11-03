# Project: BoardPDF Tool UI Layout Standardization

## Architecture
- **Application**: BoardPDF (`apps/BoardPDF`)
- **SPA Routing & Client Engine**: Vite + TypeScript in `apps/BoardPDF/client/`
- **Views & Templates**: HTML partials in `apps/BoardPDF/public/views/`
- **Styles**: Modular BEM stylesheets in `apps/BoardPDF/public/css/`
- **Design Reference**: Document Viewer (`/d/:id` / `apps/BoardPDF/public/views/collaborative-pdf/collaborative-pdf-editor.html`)
  - Top Bar: `component-top` / `collaborative-top-bar` with `linear-gradient(90deg, #6366F1 0%, #A8C0FF 100%)`, height 56px.
  - Document Title Input: `.collaborative-title-input` (translucent frosted glass, white text).
  - Dynamic Action Button: `.collaborative-share-btn` / `.tool-action-btn` (frosted glass button with state transition).
  - Footer: `.collaborative-footer` (44px height, page indicator `1 de N`, zoom slider, reset button).

### Base Layout System (2 Core Layouts)
1. **Layout 1 (Grid & Direct-Action Tools — 16 Tools)**:
   - Unified gradient top bar (`linear-gradient(90deg, #6366F1 0%, #A8C0FF 100%)`).
   - Translucent document title input (`data-ref="input-doc-title"`).
   - Dynamic action button ("Procesar" -> "Descargar" state machine).
   - Options dropdown (`data-ref="dropdown-wrapper-options"`) for tools with modifiable settings; static sidebar completely removed.
   - Cards grid occupies **100% width** at bottom.
   - **NO footer** (suppressed to maximize workspace).
2. **Layout 2 (Interactive Viewer / Canvas Tools — 5 Tools)**:
   - Unified gradient top bar (`linear-gradient(90deg, #6366F1 0%, #A8C0FF 100%)`) with document title input, action button, and mode/tool controls.
   - Workspace with interactive PDF canvas / pages viewport.
   - Static sidebar removed; options moved to top dropdown/subtoolbar.
   - **HAS footer**: Preserved 44px `.collaborative-footer` with page indicator (`data-ref="txt-footer-page-info"`), zoom slider (`data-ref="slider-zoom"`), and zoom reset (`data-ref="btn-zoom-reset"`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Gradient Top Bar CSS | CSS rules for `.tool-top-bar` / `.component-top` with gradient `linear-gradient(90deg, #6366F1 0%, #A8C0FF 100%)`, 56px height | M1 | R1, Survey 1 |
| F2 | Title Input CSS | Translucent styling for `.tool-title-input` / `.collaborative-title-input` with backdrop-filter, white text, and hover/focus states | M1 | R1, Survey 1 |
| F3 | Action Button CSS | Frosted-glass action button `.tool-action-btn` with hover, active, and disabled states | M1 | R1, Survey 1 |
| F4 | Popover Dropdown CSS | Dropdown panel styling `.tool-options-popover` for relocated sidebar options | M1 | R3, Survey 1 |
| F5 | 100% Width Cards Grid CSS | Styles for `.pdf-items-view--full-width` and `.tool-layout--grid` eliminating 1000px max-width cap | M1 | R2, Survey 1 |
| F6 | Viewer Footer CSS | Styles for `.tool-footer.collaborative-footer` matching 44px document viewer footer | M1 | R2, Survey 1 |
| F7 | Template Migration: Grid Tools Group 1 (Organize, Merge, Split, Rotate, Remove, Extract) | Redesign HTML templates: add gradient top bar, remove sidebar, remove footer, 100% bottom grid | M2 | R1, R2, R3, Survey 2 |
| F8 | Template Migration: Grid Tools Group 2 (Compress, OCR, Protect, Unlock, Repair, Markdown) | Redesign HTML templates: add gradient top bar, options popover, remove sidebar, remove footer, 100% bottom grid | M2 | R1, R2, R3, Survey 2 |
| F9 | Template Migration: Grid Tools Group 3 (Page Numbers, Watermark, Converters, Translate) | Redesign HTML templates: add gradient top bar, options popover, remove sidebar, remove footer, 100% bottom grid | M2 | R1, R2, R3, Survey 2 |
| F10 | Template Migration: Interactive Viewer Tools (Edit, Crop, Redact, Compare, Summarize) | Redesign HTML templates: add gradient top bar, remove fixed sidebar, preserve collaborative footer with zoom/page | M2 | R1, R2, R3, Survey 2 |
| F11 | Controller Document Title Unification | Update controllers to bind and populate `[data-ref="input-doc-title"]` (with alias `[data-ref="input-output-name"]`) | M3 | R1, Survey 3 |
| F12 | Controller Action Button Dynamic Transition | Ensure action button state transitions from "Procesar" to "Descargar" upon completion across tools | M3 | R1, Survey 3 |
| F13 | Controller Options Dropdown Wiring | Bind `setupDropdown` for options trigger buttons (`data-ref="btn-toggle-options"`) and clean up sidebar modal handlers | M3 | R3, Survey 3 |
| F14 | Build & Typecheck Verification | Execute `npm run typecheck` and `npm run build:client` verifying zero compilation/type errors | M4 | Criteria, Survey 3 |
| F15 | Forensic Integrity & Directives Audit | Validate zero IDs (`id="`), button `type` attribute first, zero `console.*`, authentic UI behavior | M4 | Criteria, AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Base Layout Architecture & CSS Standardization | Create/update CSS tokens and rules for gradient top bar, title input, frosted buttons, options popover, full-width bottom grid, and viewer footer in `tool-base.css` and related styles | none | DONE |
| M2 | HTML Templates Standardization (All 21 Tools) | Migrate all 21 tool HTML templates in `public/views/tools/*` to Layout 1 (16 grid tools) and Layout 2 (5 viewer tools) | M1 | DONE |
| M3 | TypeScript Controllers & Interaction Alignment | Update tool controllers in `client/views/tools/*` to wire title input (`input-doc-title`), action button ("Procesar" -> "Descargar"), and options dropdowns | M2 | DONE |
| M4 | Verification & Adversarial Hardening | Run builds/typecheck, Reviewers, Challengers, and Forensic Auditor for full compliance and zero regressions | M3 | DONE |

## Interface Contracts

### Top Bar Contract (`component-top` / `tool-top-bar`)
```html
<header class="component-top tool-top-bar" data-ref="component-top">
  <div class="tool-top-bar__left" data-ref="tool-top-left">
    <a class="component-button component-button--icon-only component-button--h40 collaborative-top-icon-btn" data-ref="btn-top-home" href="/" data-tooltip="Inicio" aria-label="Inicio">
      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#home"></use></svg>
    </a>
    <input class="collaborative-title-input" data-ref="input-doc-title" type="text" placeholder="Nombre del documento" autocomplete="off" />
  </div>
  <div class="tool-top-bar__right" data-ref="tool-top-right">
    <!-- Optional: Tool Options Popover Dropdown (when tool has configurable settings) -->
    <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-options">
      <button type="button" class="component-button component-button--h40 tool-top-btn" data-ref="btn-toggle-options" data-tooltip="Opciones" aria-label="Opciones">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
        <span class="component-button__text">Opciones</span>
      </button>
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-options"></div>
      <div class="menu-panel menu-panel--dropdown tool-options-popover" data-ref="dropdown-menu-options">
        <div class="menu-panel__list">
          <!-- Modifiable inputs/selects ONLY, zero static text -->
        </div>
      </div>
    </div>
    <!-- Dynamic Main Action Button -->
    <button type="button" class="component-button component-button--h40 tool-action-btn" data-ref="btn-main-action" disabled>
      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
      <span class="component-button__text" data-ref="txt-main-action">Procesar</span>
    </button>
  </div>
</header>
```

### Viewer Footer Contract (`collaborative-footer`)
```html
<footer class="tool-footer collaborative-footer" data-ref="tool-footer">
  <div class="collaborative-footer__right" data-ref="footer-right">
    <span class="collaborative-footer__page-text" data-ref="txt-footer-page-info">1 de 1</span>
    <div class="collaborative-footer__divider"></div>
    <input class="collaborative-zoom-slider" data-ref="slider-zoom" type="range" min="10" max="300" step="1" value="100" aria-label="Nivel de zoom" />
    <button type="button" class="collaborative-zoom-level-btn" data-ref="btn-zoom-reset" data-tooltip="Restablecer zoom" aria-label="Restablecer zoom">
      <span data-ref="txt-zoom-level">100%</span>
    </button>
  </div>
</footer>
```

## Code Layout
- `apps/BoardPDF/public/css/tools/tool-base.css`: Shared tool styles, top bar gradient, title input, action buttons, popovers.
- `apps/BoardPDF/public/css/tools/tool-grid.css`: Full-width 100% grid layout styles.
- `apps/BoardPDF/public/css/tools/tool-viewer.css`: Interactive viewer styles with collaborative-footer.
- `apps/BoardPDF/public/views/tools/*`: The 21 tool HTML templates.
- `apps/BoardPDF/client/views/tools/*`: The 21 TypeScript view controllers and types.
