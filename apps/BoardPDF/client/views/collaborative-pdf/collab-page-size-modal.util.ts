import { openModal } from '../../components/modal.component.js';
import { COLLAB_PAGE_PRESETS, inToPx, mmToPx, PageDimension, PagePreset, pxToIn, pxToMm } from '../../config/collab-page-presets.config.js';
import { renderIcons } from '../../services/icon.service.js';

export interface CollabPageSizeResult {
  applyToAll?: boolean;
  dimensions: PageDimension;
  title?: string;
}

export interface CollabPageSizeModalOptions {
  currentDimensions?: PageDimension;
  initialTitle?: string;
  mode: 'create' | 'resize';
  onConfirm: (result: CollabPageSizeResult) => Promise<void> | void;
  pageIndex?: number;
}

interface TemplateOption {
  desc: string;
  height: number;
  id: string;
  name: string;
  orientation: 'landscape' | 'portrait';
  presetId: string;
  svgIcon: string;
  width: number;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    desc: '210 × 297 mm • Estructura clásica',
    height: 1123,
    id: 'tpl-cv',
    name: 'Currículum Vitae',
    orientation: 'portrait',
    presetId: 'a4',
    svgIcon: `
      <svg class="collab-tpl-preview-svg" viewBox="0 0 120 160" width="100%" height="100%" fill="none">
        <rect x="0" y="0" width="120" height="160" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5"></rect>
        <rect x="14" y="16" width="28" height="28" rx="14" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="48" y="18" width="56" height="8" rx="2" fill="var(--text-primary)" opacity="0.8"></rect>
        <rect x="48" y="30" width="38" height="5" rx="1.5" fill="var(--text-secondary)" opacity="0.4"></rect>
        <line x1="14" y1="56" x2="106" y2="56" stroke="var(--border-color)" stroke-width="1"></line>
        <rect x="14" y="66" width="30" height="6" rx="1.5" fill="var(--text-primary)" opacity="0.7"></rect>
        <rect x="14" y="78" width="92" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="86" width="86" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="94" width="70" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="108" width="30" height="6" rx="1.5" fill="var(--text-primary)" opacity="0.7"></rect>
        <rect x="14" y="120" width="92" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="128" width="80" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
      </svg>
    `,
    width: 794,
  },
  {
    desc: '1280 × 720 px • Presentación 16:9',
    height: 720,
    id: 'tpl-presentation',
    name: 'Presentación Ejecutiva',
    orientation: 'landscape',
    presetId: 'slides-16-9',
    svgIcon: `
      <svg class="collab-tpl-preview-svg" viewBox="0 0 160 100" width="100%" height="100%" fill="none">
        <rect x="0" y="0" width="160" height="100" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5"></rect>
        <rect x="14" y="14" width="70" height="10" rx="2" fill="var(--text-primary)" opacity="0.85"></rect>
        <rect x="14" y="28" width="45" height="5" rx="1.5" fill="var(--text-secondary)" opacity="0.45"></rect>
        <rect x="14" y="44" width="40" height="42" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <rect x="60" y="44" width="40" height="42" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <rect x="106" y="44" width="40" height="42" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <rect x="20" y="52" width="28" height="4" rx="1" fill="var(--text-primary)" opacity="0.6"></rect>
        <rect x="66" y="52" width="28" height="4" rx="1" fill="var(--text-primary)" opacity="0.6"></rect>
        <rect x="112" y="52" width="28" height="4" rx="1" fill="var(--text-primary)" opacity="0.6"></rect>
      </svg>
    `,
    width: 1280,
  },
  {
    desc: '8.5 × 11 in • Documento formal',
    height: 1056,
    id: 'tpl-report',
    name: 'Reporte Corporativo',
    orientation: 'portrait',
    presetId: 'letter',
    svgIcon: `
      <svg class="collab-tpl-preview-svg" viewBox="0 0 120 160" width="100%" height="100%" fill="none">
        <rect x="0" y="0" width="120" height="160" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5"></rect>
        <rect x="14" y="16" width="92" height="18" rx="3" fill="var(--text-primary)" opacity="0.85"></rect>
        <rect x="14" y="44" width="44" height="6" rx="1.5" fill="var(--text-primary)" opacity="0.6"></rect>
        <rect x="14" y="56" width="92" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="64" width="88" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="78" width="92" height="36" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <line x1="14" y1="90" x2="106" y2="90" stroke="var(--border-color)" stroke-width="1"></line>
        <line x1="14" y1="102" x2="106" y2="102" stroke="var(--border-color)" stroke-width="1"></line>
        <rect x="14" y="124" width="92" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
        <rect x="14" y="132" width="76" height="4" rx="1" fill="var(--text-secondary)" opacity="0.3"></rect>
      </svg>
    `,
    width: 816,
  },
  {
    desc: '210 × 297 mm • Diseño promocional',
    height: 1123,
    id: 'tpl-flyer',
    name: 'Folleto Comercial',
    orientation: 'portrait',
    presetId: 'a4',
    svgIcon: `
      <svg class="collab-tpl-preview-svg" viewBox="0 0 120 160" width="100%" height="100%" fill="none">
        <rect x="0" y="0" width="120" height="160" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5"></rect>
        <rect x="14" y="14" width="92" height="52" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <circle cx="60" cy="40" r="14" fill="var(--text-secondary)" opacity="0.25"></circle>
        <rect x="14" y="76" width="70" height="8" rx="2" fill="var(--text-primary)" opacity="0.8"></rect>
        <rect x="14" y="88" width="92" height="4" rx="1" fill="var(--text-secondary)" opacity="0.35"></rect>
        <rect x="14" y="96" width="84" height="4" rx="1" fill="var(--text-secondary)" opacity="0.35"></rect>
        <rect x="14" y="112" width="42" height="34" rx="3" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <rect x="64" y="112" width="42" height="34" rx="3" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
      </svg>
    `,
    width: 794,
  },
  {
    desc: '8.5 × 11 in • Resumen de cobro',
    height: 1056,
    id: 'tpl-invoice',
    name: 'Factura Comercial',
    orientation: 'portrait',
    presetId: 'letter',
    svgIcon: `
      <svg class="collab-tpl-preview-svg" viewBox="0 0 120 160" width="100%" height="100%" fill="none">
        <rect x="0" y="0" width="120" height="160" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5"></rect>
        <rect x="14" y="16" width="40" height="8" rx="2" fill="var(--text-primary)" opacity="0.85"></rect>
        <rect x="80" y="16" width="26" height="8" rx="2" fill="var(--text-secondary)" opacity="0.5"></rect>
        <line x1="14" y1="36" x2="106" y2="36" stroke="var(--border-color)" stroke-width="1"></line>
        <rect x="14" y="46" width="30" height="5" rx="1.5" fill="var(--text-secondary)" opacity="0.4"></rect>
        <rect x="14" y="60" width="92" height="54" rx="3" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <line x1="14" y1="74" x2="106" y2="74" stroke="var(--border-color)" stroke-width="1"></line>
        <line x1="14" y1="88" x2="106" y2="88" stroke="var(--border-color)" stroke-width="1"></line>
        <line x1="14" y1="102" x2="106" y2="102" stroke="var(--border-color)" stroke-width="1"></line>
        <rect x="64" y="124" width="42" height="14" rx="2" fill="var(--text-primary)" opacity="0.85"></rect>
      </svg>
    `,
    width: 816,
  },
  {
    desc: '1280 × 720 px • Galería de trabajos',
    height: 720,
    id: 'tpl-portfolio',
    name: 'Portafolio Creativo',
    orientation: 'landscape',
    presetId: 'slides-16-9',
    svgIcon: `
      <svg class="collab-tpl-preview-svg" viewBox="0 0 160 100" width="100%" height="100%" fill="none">
        <rect x="0" y="0" width="160" height="100" rx="6" fill="var(--bg-surface)" stroke="var(--border-color)" stroke-width="1.5"></rect>
        <rect x="14" y="14" width="55" height="8" rx="2" fill="var(--text-primary)" opacity="0.85"></rect>
        <rect x="14" y="28" width="60" height="58" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <rect x="80" y="28" width="66" height="26" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
        <rect x="80" y="60" width="66" height="26" rx="4" fill="var(--bg-hover)" stroke="var(--border-color)" stroke-width="1"></rect>
      </svg>
    `,
    width: 1280,
  },
];

export type CollabSizeTab = 'custom' | 'for-you' | 'presets' | 'templates';

export function openCollabPageSizeModal(options: CollabPageSizeModalOptions): void {
  const isCreate = options.mode === 'create';
  const initialDim = options.currentDimensions || { height: 1123, width: 794 };

  const matchingPreset = COLLAB_PAGE_PRESETS.find((p) => {
    return (p.width === initialDim.width && p.height === initialDim.height) ||
      (p.width === initialDim.height && p.height === initialDim.width);
  });

  let selectedPresetId = matchingPreset?.id || (isCreate ? 'a4' : 'custom');
  let activeTab: string = (!isCreate && !matchingPreset) ? 'custom' : 'presets';
  let currentOrientation: 'landscape' | 'portrait' = initialDim.width > initialDim.height ? 'landscape' : 'portrait';
  let customUnit: 'in' | 'mm' | 'px' = 'px';
  let customW = initialDim.width;
  let customH = initialDim.height;

  const modalBody = document.createElement('div');
  modalBody.className = 'collab-size-split';
  modalBody.setAttribute('data-ref', 'collab-size-split');

  modalBody.innerHTML = `
    <aside class="collab-size-split__sidebar" data-ref="collab-size-sidebar">
      <div class="collab-size-split__sidebar-header" data-ref="collab-size-sidebar-header">
        <h2 class="collab-size-split__sidebar-title" data-ref="txt-sidebar-title">${isCreate ? 'Crear nuevo PDF' : 'Modificar tamaño'}</h2>
        <p class="collab-size-split__sidebar-desc" data-ref="txt-sidebar-desc">${isCreate ? 'Elige el formato de tu nuevo documento' : `Página ${(options.pageIndex ?? 0) + 1}`}</p>
      </div>

      <nav class="collab-size-split__nav" data-ref="collab-size-nav">
        <button type="button" class="collab-size-nav-item ${activeTab === 'for-you' ? 'is-active' : ''}" data-ref="nav-tab-for-you" data-tab="for-you">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
          <span class="collab-size-nav-item__text">Para ti</span>
        </button>

        <button type="button" class="collab-size-nav-item ${activeTab === 'templates' ? 'is-active' : ''}" data-ref="nav-tab-templates" data-tab="templates">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#dashboard"></use></svg>
          <span class="collab-size-nav-item__text">Explorar plantillas</span>
        </button>

        <button type="button" class="collab-size-nav-item ${activeTab === 'presets' ? 'is-active' : ''}" data-ref="nav-tab-presets" data-tab="presets">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
          <span class="collab-size-nav-item__text">Tamaños predeterminados</span>
        </button>

        <button type="button" class="collab-size-nav-item ${activeTab === 'custom' ? 'is-active' : ''}" data-ref="nav-tab-custom" data-tab="custom">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
          <span class="collab-size-nav-item__text">Elegir tamaño</span>
        </button>
      </nav>
    </aside>

    <main class="collab-size-split__content" data-ref="collab-size-content">
      <header class="collab-size-split__content-header" data-ref="collab-size-content-header">
        <div class="collab-size-split__content-header-info">
          <h3 class="collab-size-split__content-title" data-ref="txt-content-title">Tamaños predeterminados</h3>
          <p class="collab-size-split__content-desc" data-ref="txt-content-desc">Formatos estándar para documentos, presentaciones y redes</p>
        </div>
      </header>

      <div class="collab-size-split__body" data-ref="collab-size-body">
        <section class="collab-size-tab-pane ${activeTab === 'for-you' ? '' : 'is-hidden'}" data-ref="tab-pane-for-you" data-pane="for-you">
          <div class="collab-size-empty-state" data-ref="collab-size-empty-for-you">
            <div class="collab-size-empty-state__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            </div>
            <h4 class="collab-size-empty-state__title">Para ti</h4>
            <p class="collab-size-empty-state__desc">Tus plantillas recomendadas y diseños recientes aparecerán aquí próximamente.</p>
          </div>
        </section>

        <section class="collab-size-tab-pane ${activeTab === 'templates' ? '' : 'is-hidden'}" data-ref="tab-pane-templates" data-pane="templates">
          <div class="collab-templates-grid" data-ref="grid-templates">
            ${TEMPLATE_OPTIONS.map((tpl) => `
              <div class="collab-template-card" data-ref="template-card-${tpl.id}" data-template-id="${tpl.id}" data-preset-id="${tpl.presetId}" data-orient="${tpl.orientation}">
                <div class="collab-template-card__preview" data-ref="template-preview-${tpl.id}">
                  ${tpl.svgIcon}
                </div>
                <div class="collab-template-card__info" data-ref="template-info-${tpl.id}">
                  <span class="collab-template-card__name">${tpl.name}</span>
                  <span class="collab-template-card__desc">${tpl.desc}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <section class="collab-size-tab-pane ${activeTab === 'presets' ? '' : 'is-hidden'}" data-ref="tab-pane-presets" data-pane="presets">
          <div class="collab-presets-grid" data-ref="grid-presets">
            ${COLLAB_PAGE_PRESETS.filter((p) => p.id !== 'custom').map((p) => `
              <div class="collab-size-card${p.id === selectedPresetId ? ' is-selected' : ''}" data-ref="preset-card-${p.id}" data-preset-id="${p.id}">
                <div class="collab-size-card__paper-preview" data-ref="paper-preview-${p.id}">
                  <div class="collab-size-card__paper ${p.defaultOrientation === 'landscape' ? 'collab-size-card__paper--landscape' : 'collab-size-card__paper--portrait'}">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${p.icon}"></use></svg>
                  </div>
                </div>
                <div class="collab-size-card__info" data-ref="info-${p.id}">
                  <span class="collab-size-card__name">${p.name}</span>
                  <span class="collab-size-card__desc">${p.description}</span>
                  <span class="collab-size-card__pixels">${p.width} × ${p.height} px</span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <section class="collab-size-tab-pane ${activeTab === 'custom' ? '' : 'is-hidden'}" data-ref="tab-pane-custom" data-pane="custom">
          <div class="collab-custom-split" data-ref="collab-custom-split">
            <div class="collab-custom-form" data-ref="collab-custom-form">
              <div class="collab-custom-row">
                <label class="field" data-ref="field-custom-w">
                  <input class="field__input field__input--h40" data-ref="input-custom-w" type="number" min="50" max="8000" value="${customW}" />
                  <span class="field__label">Ancho</span>
                </label>

                <label class="field" data-ref="field-custom-h">
                  <input class="field__input field__input--h40" data-ref="input-custom-h" type="number" min="50" max="8000" value="${customH}" />
                  <span class="field__label">Alto</span>
                </label>

                <div class="field" data-ref="field-custom-unit">
                  <select class="field__select field__select--h40" data-ref="select-custom-unit">
                    <option value="px" selected>Píxeles (px)</option>
                    <option value="mm">Milímetros (mm)</option>
                    <option value="in">Pulgadas (in)</option>
                  </select>
                </div>
              </div>

              <div class="collab-orientation-block" data-ref="collab-orientation-block">
                <span class="collab-section-mini-title">Orientación</span>
                <div class="collab-orientation-toggle" data-ref="toggle-orientation">
                  <button type="button" class="collab-orientation-btn ${currentOrientation === 'portrait' ? 'is-active' : ''}" data-ref="btn-orient-portrait" data-orient="portrait">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
                    <span>Vertical</span>
                  </button>
                  <button type="button" class="collab-orientation-btn ${currentOrientation === 'landscape' ? 'is-active' : ''}" data-ref="btn-orient-landscape" data-orient="landscape">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
                    <span>Horizontal</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="collab-custom-preview-area" data-ref="collab-custom-preview-area">
              <span class="collab-section-mini-title">Vista previa de proporción</span>
              <div class="collab-custom-paper-stage" data-ref="collab-paper-stage">
                <div class="collab-custom-paper-box" data-ref="custom-paper-box">
                  <span class="collab-custom-paper-tag" data-ref="txt-paper-box-dim">${customW} × ${customH}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer class="collab-size-split__footer" data-ref="collab-size-footer">
        <div class="collab-size-split__footer-left" data-ref="footer-left">
          ${isCreate ? `
            <label class="field collab-size-title-field" data-ref="field-new-doc-title">
              <input class="field__input field__input--h40" data-ref="input-new-doc-title" type="text" placeholder=" " value="${options.initialTitle || 'Documento sin título'}" />
              <span class="field__label">Título del documento</span>
            </label>
          ` : `
            <label class="collab-resize-checkbox-label" data-ref="label-apply-all">
              <input class="checkbox" data-ref="chk-apply-all" type="checkbox" />
              <span>Aplicar a todas las páginas</span>
            </label>
          `}

          <div class="collab-size-selected-badge" data-ref="badge-selected-size">
            <span class="collab-size-selected-badge__name" data-ref="txt-badge-name">A4 Internacional</span>
            <span class="collab-size-selected-badge__dim" data-ref="txt-badge-dim">794 × 1123 px</span>
          </div>
        </div>

        <div class="collab-size-split__footer-actions" data-ref="footer-actions">
          <button type="button" class="component-button component-button--secondary component-button--h40" data-ref="btn-modal-cancel">Cancelar</button>
          <button type="button" class="component-button component-button--black component-button--h40" data-ref="btn-modal-confirm">${isCreate ? 'Crear documento' : 'Aplicar tamaño'}</button>
        </div>
      </footer>
    </main>
  `;

  renderIcons(modalBody);

  const txtContentTitle = modalBody.querySelector<HTMLElement>('[data-ref="txt-content-title"]');
  const txtContentDesc = modalBody.querySelector<HTMLElement>('[data-ref="txt-content-desc"]');
  const navItems = modalBody.querySelectorAll<HTMLButtonElement>('[data-tab]');
  const tabPanes = modalBody.querySelectorAll<HTMLElement>('[data-pane]');

  const presetCards = modalBody.querySelectorAll<HTMLElement>('[data-preset-id]');
  const templateCards = modalBody.querySelectorAll<HTMLElement>('[data-template-id]');

  const inputCustomW = modalBody.querySelector<HTMLInputElement>('[data-ref="input-custom-w"]');
  const inputCustomH = modalBody.querySelector<HTMLInputElement>('[data-ref="input-custom-h"]');
  const selectUnit = modalBody.querySelector<HTMLSelectElement>('[data-ref="select-custom-unit"]');
  const btnPortrait = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-orient-portrait"]');
  const btnLandscape = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-orient-landscape"]');
  const paperBox = modalBody.querySelector<HTMLElement>('[data-ref="custom-paper-box"]');
  const txtPaperBoxDim = modalBody.querySelector<HTMLElement>('[data-ref="txt-paper-box-dim"]');

  const txtBadgeName = modalBody.querySelector<HTMLElement>('[data-ref="txt-badge-name"]');
  const txtBadgeDim = modalBody.querySelector<HTMLElement>('[data-ref="txt-badge-dim"]');
  const inputTitle = modalBody.querySelector<HTMLInputElement>('[data-ref="input-new-doc-title"]');
  const chkApplyAll = modalBody.querySelector<HTMLInputElement>('[data-ref="chk-apply-all"]');

  const btnCancel = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-modal-cancel"]');
  const btnConfirm = modalBody.querySelector<HTMLButtonElement>('[data-ref="btn-modal-confirm"]');

  const tabMeta: Record<string, { desc: string; title: string }> = {
    'custom': {
      desc: 'Introduce dimensiones personalizadas y ajusta la orientación libremente',
      title: 'Elegir tamaño personalizado',
    },
    'for-you': {
      desc: 'Sugerencias personalizadas basadas en tus formatos frecuentes',
      title: 'Para ti',
    },
    'presets': {
      desc: 'Formatos estándar para documentos, presentaciones y redes sociales',
      title: 'Tamaños predeterminados',
    },
    'templates': {
      desc: 'Plantillas prediseñadas listas para editar y colaborar',
      title: 'Explorar plantillas',
    },
  };

  const switchTab = (tab: 'custom' | 'for-you' | 'presets' | 'templates') => {
    activeTab = tab;
    navItems.forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle('is-hidden', pane.getAttribute('data-pane') !== tab);
    });
    if (txtContentTitle) txtContentTitle.textContent = tabMeta[tab]?.title || '';
    if (txtContentDesc) txtContentDesc.textContent = tabMeta[tab]?.desc || '';
  };

  const calculateCurrentDimensions = (): PageDimension => {
    let w = 794;
    let h = 1123;

    if (activeTab === 'custom' || selectedPresetId === 'custom') {
      const rawW = parseFloat(inputCustomW?.value || '794') || 794;
      const rawH = parseFloat(inputCustomH?.value || '1123') || 1123;
      if (customUnit === 'mm') {
        w = mmToPx(rawW);
        h = mmToPx(rawH);
      } else if (customUnit === 'in') {
        w = inToPx(rawW);
        h = inToPx(rawH);
      } else {
        w = Math.round(rawW);
        h = Math.round(rawH);
      }
    } else {
      const p = COLLAB_PAGE_PRESETS.find((item) => item.id === selectedPresetId);
      if (p) {
        if (currentOrientation === 'landscape') {
          w = Math.max(p.width, p.height);
          h = Math.min(p.width, p.height);
        } else {
          w = Math.min(p.width, p.height);
          h = Math.max(p.width, p.height);
        }
      }
    }

    return { height: Math.max(50, h), width: Math.max(50, w) };
  };

  const updateSummary = () => {
    const dims = calculateCurrentDimensions();

    let name = 'Personalizado';
    if (selectedPresetId !== 'custom') {
      const p = COLLAB_PAGE_PRESETS.find((item) => item.id === selectedPresetId);
      if (p) name = p.name;
    }

    if (txtBadgeName) txtBadgeName.textContent = name;
    if (txtBadgeDim) {
      txtBadgeDim.textContent = `${dims.width} × ${dims.height} px (${currentOrientation === 'landscape' ? 'Horizontal' : 'Vertical'})`;
    }

    if (paperBox) {
      const maxBoxW = 160;
      const maxBoxH = 120;
      const scale = Math.min(maxBoxW / dims.width, maxBoxH / dims.height);
      const scaledW = Math.max(30, Math.round(dims.width * scale));
      const scaledH = Math.max(30, Math.round(dims.height * scale));
      paperBox.style.width = `${scaledW}px`;
      paperBox.style.height = `${scaledH}px`;
    }

    if (txtPaperBoxDim) {
      txtPaperBoxDim.textContent = `${dims.width} × ${dims.height} px`;
    }

    return dims;
  };

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') as any;
      if (tab) switchTab(tab);
    });
  });

  presetCards.forEach((card) => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-preset-id');
      if (!pid) return;
      selectedPresetId = pid;
      presetCards.forEach((c) => c.classList.toggle('is-selected', c.getAttribute('data-preset-id') === pid));

      const p = COLLAB_PAGE_PRESETS.find((item) => item.id === pid);
      if (p?.defaultOrientation) {
        currentOrientation = p.defaultOrientation;
        btnPortrait?.classList.toggle('is-active', currentOrientation === 'portrait');
        btnLandscape?.classList.toggle('is-active', currentOrientation === 'landscape');
      }

      if (inputCustomW) inputCustomW.value = String(p?.width || 794);
      if (inputCustomH) inputCustomH.value = String(p?.height || 1123);

      updateSummary();
    });
  });

  templateCards.forEach((card) => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-preset-id') || 'a4';
      const orient = (card.getAttribute('data-orient') || 'portrait') as 'landscape' | 'portrait';
      selectedPresetId = pid;
      currentOrientation = orient;

      templateCards.forEach((c) => c.classList.toggle('is-selected', c === card));
      presetCards.forEach((c) => c.classList.toggle('is-selected', c.getAttribute('data-preset-id') === pid));

      btnPortrait?.classList.toggle('is-active', currentOrientation === 'portrait');
      btnLandscape?.classList.toggle('is-active', currentOrientation === 'landscape');

      const p = COLLAB_PAGE_PRESETS.find((item) => item.id === pid);
      if (p) {
        if (inputCustomW) inputCustomW.value = String(p.width);
        if (inputCustomH) inputCustomH.value = String(p.height);
      }

      updateSummary();
    });
  });

  btnPortrait?.addEventListener('click', () => {
    currentOrientation = 'portrait';
    btnPortrait.classList.add('is-active');
    btnLandscape?.classList.remove('is-active');
    updateSummary();
  });

  btnLandscape?.addEventListener('click', () => {
    currentOrientation = 'landscape';
    btnLandscape.classList.add('is-active');
    btnPortrait?.classList.remove('is-active');
    updateSummary();
  });

  inputCustomW?.addEventListener('input', () => {
    selectedPresetId = 'custom';
    presetCards.forEach((c) => c.classList.remove('is-selected'));
    updateSummary();
  });

  inputCustomH?.addEventListener('input', () => {
    selectedPresetId = 'custom';
    presetCards.forEach((c) => c.classList.remove('is-selected'));
    updateSummary();
  });

  selectUnit?.addEventListener('change', () => {
    customUnit = (selectUnit.value as 'in' | 'mm' | 'px') || 'px';
    updateSummary();
  });

  updateSummary();

  const modal = openModal({
    bodyHtml: modalBody,
    showCancel: false,
    showConfirm: false,
    size: 'collab-size',
    title: '',
  });

  btnCancel?.addEventListener('click', () => {
    modal.close();
  });

  btnConfirm?.addEventListener('click', async () => {
    const finalDims = updateSummary();
    modal.close();
    await options.onConfirm({
      applyToAll: Boolean(chkApplyAll?.checked),
      dimensions: finalDims,
      title: inputTitle?.value?.trim() || 'Documento sin título',
    });
  });
}
