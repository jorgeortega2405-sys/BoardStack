import { COMPACT_GRADIENT_COLORS, COMPACT_SOLID_COLORS, EXPANDED_GRADIENT_GROUPS, FULL_SOLID_COLORS, formatGradientLabel } from './collab-colors.config.js';
import { SHAPES_CATALOG } from './collab-shapes.config.js';

function renderSolidSwatch(colorHex: string): string {
  return `<button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="${colorHex}" data-tooltip="${colorHex}" aria-label="${colorHex}"><span class="collaborative-color-swatch__fill" style="background-color: ${colorHex};"></span></button>`;
}

function renderGradientSwatch(gradientCss: string): string {
  const label = formatGradientLabel(gradientCss);
  return `<button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="${gradientCss}" data-tooltip="${label}" aria-label="${label}"><span class="collaborative-color-swatch__fill" style="background-image: ${gradientCss};"></span></button>`;
}

const TABLE_THEMES = [
  { accent: '#4b5563', colorName: 'gray', tint: '#4b5563b3' },
  { accent: '#ef4444', colorName: 'red', tint: '#fee2e2' },
  { accent: '#f59e0b', colorName: 'amber', tint: '#fef3c7' },
  { accent: '#3b82f6', colorName: 'blue', tint: '#dbeafe' },
  { accent: '#8b5cf6', colorName: 'purple', tint: '#ede9fe' },
];

function createCollaborativeDrawerElement(): HTMLElement {
  const tablePresetButtons = TABLE_THEMES.map((t) => `
    <button type="button" class="collaborative-table-card" data-ref="btn-table-preset" data-table-preset="grid" data-table-color="${t.colorName}" data-tooltip="Cuadrícula" aria-label="Cuadrícula">
      <svg class="collaborative-table-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
        <rect x="3" y="3" width="58" height="58" stroke="${t.accent}" stroke-width="2.5"></rect>
        <line x1="3" y1="18" x2="61" y2="18" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="3" y1="32" x2="61" y2="32" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="3" y1="46" x2="61" y2="46" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="22" y1="3" x2="22" y2="61" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="42" y1="3" x2="42" y2="61" stroke="${t.accent}" stroke-width="2.5"></line>
      </svg>
    </button>
    <button type="button" class="collaborative-table-card" data-ref="btn-table-preset" data-table-preset="header-accent" data-table-color="${t.colorName}" data-tooltip="Encabezado con color" aria-label="Encabezado con color">
      <svg class="collaborative-table-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
        <rect x="3" y="3" width="58" height="15" fill="${t.accent}"></rect>
        <rect x="3" y="3" width="58" height="58" stroke="${t.accent}" stroke-width="2.5"></rect>
        <line x1="3" y1="18" x2="61" y2="18" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="3" y1="32" x2="61" y2="32" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="3" y1="46" x2="61" y2="46" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="22" y1="3" x2="22" y2="61" stroke="${t.accent}" stroke-width="2.5"></line>
        <line x1="42" y1="3" x2="42" y2="61" stroke="${t.accent}" stroke-width="2.5"></line>
      </svg>
    </button>
    <button type="button" class="collaborative-table-card" data-ref="btn-table-preset" data-table-preset="cards" data-table-color="${t.colorName}" data-tooltip="Celdas separadas" aria-label="Celdas separadas">
      <svg class="collaborative-table-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
        <rect x="3" y="3" width="16" height="13" rx="1.5" fill="${t.accent}"></rect>
        <rect x="24" y="3" width="16" height="13" rx="1.5" fill="${t.accent}"></rect>
        <rect x="45" y="3" width="16" height="13" rx="1.5" fill="${t.accent}"></rect>
        <rect x="3" y="19" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="24" y="19" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="45" y="19" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="3" y="33" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="24" y="33" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="45" y="33" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="3" y="47" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="24" y="47" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
        <rect x="45" y="47" width="16" height="12" rx="1.5" fill="${t.tint}"></rect>
      </svg>
    </button>
  `).join('');
  const compactSolidSwatches = COMPACT_SOLID_COLORS.map(renderSolidSwatch).join('');
  const fullSolidSwatches = FULL_SOLID_COLORS.map(renderSolidSwatch).join('');
  const compactGradientSwatches = COMPACT_GRADIENT_COLORS.map(renderGradientSwatch).join('');
  const expandedGradientSectionsHtml = EXPANDED_GRADIENT_GROUPS.map((group) => `
    <div class="collaborative-color-subsection" data-gradient-group="${group.id}">
      <span class="collaborative-color-subsection__title" data-i18n="${group.titleKey}"></span>
      <div class="collaborative-colors-grid">
        ${group.gradients.map(renderGradientSwatch).join('')}
      </div>
    </div>
  `).join('');

  
  const shapesSectionsHtml = Object.values(SHAPES_CATALOG).map((cat) => `
    <div class="collaborative-shapes-section">
      <div class="collaborative-shapes-section__header">
        <span class="collaborative-shapes-section__title">${cat.title}</span>
        <button type="button" class="collaborative-shapes-section__more-btn" data-ref="btn-shapes-more-${cat.id}" data-shape-cat="${cat.id}">Mostrar más</button>
      </div>
      <div class="collaborative-shapes-grid" data-ref="shapes-grid-${cat.id}">
        ${cat.shapes.slice(0, 6).map((s) => s.cardHtml).join('')}
      </div>
    </div>
  `).join('');

  const drawer = document.createElement('div');
  drawer.className = 'layout-drawer';
  drawer.setAttribute('data-ref', 'layout-drawer');
  drawer.innerHTML = `
  <div class="layout-drawer__collapse-wrapper">
    <button type="button" class="layout-drawer__collapse-pill" data-ref="btn-drawer-collapse" data-tooltip="Cerrar menú" data-i18n-tooltip="common.close" data-i18n-aria="common.close" aria-label="Cerrar menú">
      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
    </button>
  </div>
  <div class="layout-drawer__header collaborative-drawer-header" data-ref="drawer-header">
    <div class="collaborative-drawer-header__left" data-ref="drawer-header-left">
      <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-drawer-back-btn is-hidden" data-ref="btn-drawer-back" data-tooltip="Volver" aria-label="Volver">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
      </button>
      <svg class="component-icon collaborative-drawer-header__icon" data-ref="drawer-header-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
      <span class="collaborative-drawer-header__title" data-ref="side-panel-title">Elementos</span>
    </div>
  </div>

  <div class="layout-drawer__body" data-ref="side-panel-body">
    <div class="collaborative-panel-section" data-ref="panel-section-elements">
      <div class="collaborative-elements-main" data-ref="elements-main-view">
        <div class="menu-list" data-ref="list-elements">
          <button type="button" class="menu-item menu-item--bordered" data-ref="btn-elem-shapes">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#layers"></use></svg>
            <span class="menu-item__text">Formas</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
          </button>
          <button type="button" class="menu-item menu-item--bordered" data-ref="btn-elem-tables">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
            <span class="menu-item__text">Tablas</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
          </button>
          <button type="button" class="menu-item menu-item--bordered" data-ref="btn-elem-photos">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#photo_library"></use></svg>
            <span class="menu-item__text">Fotos</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
          </button>
          <button type="button" class="menu-item menu-item--bordered" data-ref="btn-elem-charts">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#show_chart"></use></svg>
            <span class="menu-item__text">Gráficas</span>
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
          </button>
        </div>
      </div>

      <div class="collaborative-shapes-view is-hidden" data-ref="elements-shapes-view">
        <div class="collaborative-shapes-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-shapes-back-btn" data-ref="btn-shapes-back" data-tooltip="Volver a elementos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-shapes-title">Formas</span>
        </div>

        <div class="collaborative-shapes-content" data-ref="shapes-content">
          ${shapesSectionsHtml}
        </div>
      </div>

      <div class="collaborative-shapes-category-view is-hidden" data-ref="elements-shapes-category-view">
        <div class="collaborative-shapes-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-shapes-back-btn" data-ref="btn-shapes-cat-back" data-tooltip="Volver" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-shapes-title" data-ref="shapes-cat-title">Formas</span>
        </div>

        <div class="collaborative-shapes-content" data-ref="shapes-cat-content">
          <div class="collaborative-shapes-grid" data-ref="shapes-cat-grid"></div>
        </div>
      </div>

      <div class="collaborative-tables-view is-hidden" data-ref="elements-tables-view">
        <div class="collaborative-shapes-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-shapes-back-btn" data-ref="btn-tables-back" data-tooltip="Volver a elementos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-shapes-title">Tablas</span>
        </div>

        <div class="collaborative-tables-content" data-ref="tables-content">
          <div class="collaborative-tables-grid" data-ref="tables-grid">
            ${tablePresetButtons}
          </div>
        </div>
      </div>

      <div class="collaborative-charts-view is-hidden" data-ref="elements-charts-view">
        <div class="collaborative-shapes-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-shapes-back-btn" data-ref="btn-charts-back" data-tooltip="Volver a elementos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-shapes-title">Gráficas</span>
        </div>

        <div class="collaborative-charts-content" data-ref="charts-content">
          <div class="collaborative-charts-section">
            <span class="collaborative-charts-section__title">Gráficas de barras</span>
            <div class="collaborative-charts-grid">
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="bar-vertical" data-tooltip="Barras verticales" aria-label="Barras verticales">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <rect x="8" y="24" width="10" height="32" rx="2" fill="#3b82f6"></rect>
                  <rect x="23" y="14" width="10" height="42" rx="2" fill="#3b82f6"></rect>
                  <rect x="38" y="32" width="10" height="24" rx="2" fill="#3b82f6"></rect>
                  <rect x="53" y="20" width="10" height="36" rx="2" fill="#3b82f6"></rect>
                </svg>
                <span class="collaborative-chart-card__label">Barras verticales</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="bar-horizontal" data-tooltip="Barras horizontales" aria-label="Barras horizontales">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <rect x="6" y="8" width="46" height="9" rx="2" fill="#3b82f6"></rect>
                  <rect x="6" y="22" width="36" height="9" rx="2" fill="#3b82f6"></rect>
                  <rect x="6" y="36" width="50" height="9" rx="2" fill="#3b82f6"></rect>
                  <rect x="6" y="50" width="26" height="9" rx="2" fill="#3b82f6"></rect>
                </svg>
                <span class="collaborative-chart-card__label">Barras horizontales</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="bar-grouped" data-tooltip="Columnas agrupadas" aria-label="Columnas agrupadas">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <rect x="6" y="26" width="6" height="30" rx="1.5" fill="#3b82f6"></rect>
                  <rect x="13" y="16" width="6" height="40" rx="1.5" fill="#64748b"></rect>
                  <rect x="20" y="34" width="6" height="22" rx="1.5" fill="#f59e0b"></rect>
                  <rect x="34" y="20" width="6" height="36" rx="1.5" fill="#3b82f6"></rect>
                  <rect x="41" y="28" width="6" height="28" rx="1.5" fill="#64748b"></rect>
                  <rect x="48" y="12" width="6" height="44" rx="1.5" fill="#f59e0b"></rect>
                </svg>
                <span class="collaborative-chart-card__label">Columnas agrupadas</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="bar-stacked" data-tooltip="Barras apiladas" aria-label="Barras apiladas">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <rect x="12" y="38" width="14" height="18" rx="2" fill="#3b82f6"></rect>
                  <rect x="12" y="22" width="14" height="14" rx="2" fill="#64748b"></rect>
                  <rect x="12" y="10" width="14" height="10" rx="2" fill="#f59e0b"></rect>
                  <rect x="38" y="32" width="14" height="24" rx="2" fill="#3b82f6"></rect>
                  <rect x="38" y="18" width="14" height="12" rx="2" fill="#64748b"></rect>
                  <rect x="38" y="6" width="14" height="10" rx="2" fill="#f59e0b"></rect>
                </svg>
                <span class="collaborative-chart-card__label">Barras apiladas</span>
              </button>
            </div>
          </div>

          <div class="collaborative-charts-section">
            <span class="collaborative-charts-section__title">Líneas y tendencias</span>
            <div class="collaborative-charts-grid">
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="line" data-tooltip="Líneas" aria-label="Líneas">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <polyline points="8,48 22,34 36,40 54,14" stroke="#3b82f6" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
                  <circle cx="8" cy="48" r="3.5" fill="#3b82f6"></circle>
                  <circle cx="22" cy="34" r="3.5" fill="#3b82f6"></circle>
                  <circle cx="36" cy="40" r="3.5" fill="#3b82f6"></circle>
                  <circle cx="54" cy="14" r="3.5" fill="#3b82f6"></circle>
                </svg>
                <span class="collaborative-chart-card__label">Líneas</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="line-multi" data-tooltip="Varias líneas" aria-label="Varias líneas">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <polyline points="8,44 24,38 40,24 56,12" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
                  <polyline points="8,50 24,30 40,34 56,22" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
                  <polyline points="8,54 24,52 40,40 56,32" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
                <span class="collaborative-chart-card__label">Varias líneas</span>
              </button>
            </div>
          </div>

          <div class="collaborative-charts-section">
            <span class="collaborative-charts-section__title">Pastel y anillos</span>
            <div class="collaborative-charts-grid">
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="pie" data-tooltip="Pastel" aria-label="Pastel">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <circle cx="32" cy="32" r="26" fill="#3b82f6"></circle>
                  <path d="M 32 32 L 32 6 A 26 26 0 0 0 7 24 Z" fill="#f59e0b"></path>
                  <path d="M 32 32 L 7 24 A 26 26 0 0 0 16 52 Z" fill="#64748b"></path>
                </svg>
                <span class="collaborative-chart-card__label">Pastel</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="donut" data-tooltip="Anillos" aria-label="Anillos">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <circle cx="32" cy="32" r="26" fill="#3b82f6"></circle>
                  <path d="M 32 32 L 32 6 A 26 26 0 0 0 7 24 Z" fill="#f59e0b"></path>
                  <path d="M 32 32 L 7 24 A 26 26 0 0 0 16 52 Z" fill="#64748b"></path>
                  <circle cx="32" cy="32" r="14" fill="var(--bg-surface, #ffffff)"></circle>
                </svg>
                <span class="collaborative-chart-card__label">Anillos</span>
              </button>
            </div>
          </div>

          <div class="collaborative-charts-section">
            <span class="collaborative-charts-section__title">Gráficas de área</span>
            <div class="collaborative-charts-grid">
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="area-stacked" data-tooltip="Área apilada" aria-label="Área apilada">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <path d="M 8 52 L 24 38 L 40 44 L 56 22 L 56 52 Z" fill="#3b82f6" opacity="0.85"></path>
                  <path d="M 8 38 L 24 24 L 40 30 L 56 12 L 56 22 L 40 44 L 24 38 L 8 52 Z" fill="#64748b" opacity="0.85"></path>
                </svg>
                <span class="collaborative-chart-card__label">Área apilada</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="area-overlap" data-tooltip="Área sin apilar" aria-label="Área sin apilar">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <path d="M 8 52 L 20 22 L 36 34 L 56 16 L 56 52 Z" fill="#3b82f6" fill-opacity="0.65"></path>
                  <path d="M 8 52 L 24 34 L 42 18 L 56 28 L 56 52 Z" fill="#64748b" fill-opacity="0.65"></path>
                </svg>
                <span class="collaborative-chart-card__label">Área sin apilar</span>
              </button>
            </div>
          </div>

          <div class="collaborative-charts-section">
            <span class="collaborative-charts-section__title">Dispersión e infografía</span>
            <div class="collaborative-charts-grid">
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="scatter" data-tooltip="Dispersión" aria-label="Dispersión">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <circle cx="12" cy="46" r="4.5" fill="#3b82f6"></circle>
                  <circle cx="24" cy="34" r="4.5" fill="#3b82f6"></circle>
                  <circle cx="28" cy="44" r="3.5" fill="#3b82f6"></circle>
                  <circle cx="36" cy="22" r="5" fill="#3b82f6"></circle>
                  <circle cx="44" cy="30" r="4" fill="#3b82f6"></circle>
                  <circle cx="52" cy="14" r="4.5" fill="#3b82f6"></circle>
                </svg>
                <span class="collaborative-chart-card__label">Dispersión</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="progress-ring" data-tooltip="Anillo de progreso" aria-label="Anillo de progreso">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <circle cx="32" cy="32" r="22" stroke="#e2e8f0" stroke-width="8"></circle>
                  <circle cx="32" cy="32" r="22" stroke="#3b82f6" stroke-width="8" stroke-dasharray="138" stroke-dashoffset="40" stroke-linecap="round" transform="rotate(-90 32 32)"></circle>
                </svg>
                <span class="collaborative-chart-card__label">Progreso circular</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="progress-bar" data-tooltip="Barra de progreso" aria-label="Barra de progreso">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <rect x="6" y="24" width="52" height="16" rx="8" fill="#e2e8f0"></rect>
                  <rect x="6" y="24" width="36" height="16" rx="8" fill="#3b82f6"></rect>
                </svg>
                <span class="collaborative-chart-card__label">Barra progreso</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="progress-gauge" data-tooltip="Indicador radial" aria-label="Indicador radial">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <path d="M 10 44 A 24 24 0 0 1 54 44" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round"></path>
                  <path d="M 10 44 A 24 24 0 0 1 44 20" stroke="#3b82f6" stroke-width="8" stroke-linecap="round"></path>
                  <line x1="32" y1="44" x2="42" y2="24" stroke="#1e293b" stroke-width="3" stroke-linecap="round"></line>
                  <circle cx="32" cy="44" r="4" fill="#1e293b"></circle>
                </svg>
                <span class="collaborative-chart-card__label">Indicador radial</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-colors">
      <div class="collaborative-colors-container" data-ref="colors-container">
        <div class="collaborative-color-section">
          <span class="collaborative-color-section__title" data-ref="txt-color-section-first-title" data-i18n="collaborative.colors_section_title"></span>
          <div class="collaborative-colors-grid" data-ref="grid-category-colors">
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--action collaborative-color-swatch--gradient-picker" data-ref="btn-color-custom-picker" data-i18n-tooltip="collaborative.color_custom_picker" data-i18n-aria="collaborative.color_custom_picker">
              <span class="collaborative-color-swatch__picker-center">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              </span>
            </button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--action collaborative-color-swatch--eyedropper" data-ref="btn-color-eyedropper" data-i18n-tooltip="collaborative.color_eyedropper" data-i18n-aria="collaborative.color_eyedropper">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#colorize"></use></svg>
            </button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--transparent is-hidden" data-ref="btn-color-transparent" data-color="transparent" data-i18n-tooltip="collaborative.color_transparent" data-i18n-aria="collaborative.color_transparent">
              <svg class="collaborative-transparent-swatch-icon" viewBox="0 0 24 24" width="24" height="24" fill="none"><circle cx="12" cy="12" r="9.5" fill="#ffffff" stroke="rgba(0, 0, 0, 0.15)" stroke-width="1.5"/><line x1="5.2" y1="5.2" x2="18.8" y2="18.8" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="collaborative-color-section">
          <div class="collaborative-color-section__header">
            <span class="collaborative-color-section__title" data-i18n="collaborative.colors_default_solids"></span>
            <button type="button" class="collaborative-shapes-section__more-btn" data-ref="btn-solid-colors-more" data-i18n="collaborative.show_more"></button>
          </div>
          <div class="collaborative-colors-grid" data-ref="grid-solid-colors-compact">
            ${compactSolidSwatches}
          </div>
        </div>

        <div class="collaborative-color-section">
          <div class="collaborative-color-section__header">
            <span class="collaborative-color-section__title" data-i18n="collaborative.colors_default_gradients"></span>
            <button type="button" class="collaborative-shapes-section__more-btn" data-ref="btn-gradient-colors-more" data-i18n="collaborative.show_more"></button>
          </div>
          <div class="collaborative-colors-grid" data-ref="grid-gradient-colors-compact">
            ${compactGradientSwatches}
          </div>
        </div>
      </div>

      <div class="collaborative-colors-category-view is-hidden" data-ref="colors-category-view">
        <div class="collaborative-shapes-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-shapes-back-btn" data-ref="btn-colors-cat-back" data-tooltip="Volver" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-shapes-title" data-ref="colors-cat-title"></span>
        </div>
        <div class="collaborative-shapes-content" data-ref="colors-cat-content"></div>
      </div>

      <input class="is-hidden" data-ref="input-custom-color" type="color" value="#000000" style="display: none;" />
    </div>

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-text">
      <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-add-text-box">
        <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        <span class="component-button__text">Agregar caja de texto</span>
      </button>

      <div class="collaborative-text-presets" data-ref="text-presets-container">
        <button type="button" class="collaborative-text-preset collaborative-text-preset--title" data-ref="btn-preset-title">
          <span class="collaborative-preset-title">Agregar un título</span>
        </button>
        <button type="button" class="collaborative-text-preset collaborative-text-preset--subtitle" data-ref="btn-preset-subtitle">
          <span class="collaborative-preset-subtitle">Agregar un subtítulo</span>
        </button>
        <button type="button" class="collaborative-text-preset collaborative-text-preset--body" data-ref="btn-preset-body">
          <span class="collaborative-preset-body">Agregar algo de texto</span>
        </button>
      </div>
    </div>

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-fonts">
      <div class="collaborative-fonts-panel" data-ref="fonts-panel-wrapper">
        <div class="collaborative-fonts-search" data-ref="fonts-search-container">
          <div class="component-search component-search--full" data-ref="fonts-search-box">
            <div class="component-search__icon" data-ref="fonts-search-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            </div>
            <div class="component-search__input-box" data-ref="fonts-search-input-box">
              <input class="component-search__input" data-ref="input-search-fonts" placeholder="Buscar fuentes..." type="text" autocomplete="off" />
            </div>
            <button type="button" class="component-button component-button--h34 component-button--icon-only" data-ref="btn-clear-fonts-search" style="display: none;" aria-label="Limpiar búsqueda">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        </div>

        <div class="collaborative-font-list" data-ref="font-list-container"></div>
      </div>
    </div>

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-uploads">
      <div class="collaborative-uploads-main" data-ref="uploads-main-view">
        <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-upload-file">
          <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#upload"></use></svg>
          <span class="component-button__text">Subir archivos</span>
        </button>
        <input class="is-hidden" data-ref="input-file-upload" type="file" accept="image/*,.pdf,application/pdf" multiple style="display: none;" />

        <div class="component-tabs" data-ref="upload-tabs">
          <button type="button" class="component-tab is-active" data-ref="tab-upload-all" data-tab="all">Todos</button>
          <button type="button" class="component-tab" data-ref="tab-upload-images" data-tab="images">Imágenes</button>
          <button type="button" class="component-tab" data-ref="tab-upload-pdfs" data-tab="pdfs">PDFs</button>
        </div>

        <div class="collaborative-upload-progress is-hidden" data-ref="upload-progress-indicator">
          <div class="collaborative-upload-spinner"></div>
          <span class="collaborative-upload-progress__text">Subiendo archivos...</span>
        </div>

        <div class="collaborative-uploads-grid" data-ref="uploads-grid"></div>

        <div class="collaborative-empty-state" data-ref="empty-uploads">
          <svg class="component-icon collaborative-empty-state__icon" aria-hidden="true"><use href="/icons.svg#upload_file"></use></svg>
          <span class="collaborative-empty-state__title">Sin archivos subidos</span>
          <span class="collaborative-empty-state__subtitle">Sube imágenes o documentos PDF para usarlos aquí</span>
        </div>
      </div>

      <div class="collaborative-pdf-apply-panel is-hidden" data-ref="pdf-apply-panel">
        <div class="collaborative-pdf-apply-header">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-pdf-back-btn" data-ref="btn-pdf-apply-back" data-tooltip="Volver a subidos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-pdf-apply-title" data-ref="txt-pdf-apply-name">documento.pdf</span>
        </div>

        <div class="collaborative-pdf-apply-actions">
          <button type="button" class="component-button component-button--ghost component-button--h36 component-button--w-full" data-ref="btn-embed-design" data-tooltip=t('ui.insertar_como_diseno_editable_en_la_pagi')>
            <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            <span class="component-button__text">Incrustar en página actual</span>
          </button>
          <button type="button" class="component-button component-button--black component-button--h40 component-button--w-full" data-ref="btn-apply-all-pages">
            <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#auto_stories"></use></svg>
            <span class="component-button__text" data-ref="txt-apply-all-pages">Aplicar todas las páginas</span>
          </button>
        </div>

        <div class="collaborative-pdf-pages-hint">
          <span>O haz clic en una página para aplicarla a la actual:</span>
        </div>

        <div class="collaborative-pdf-pages-grid" data-ref="pdf-pages-thumbnails-grid"></div>
      </div>
    </div>

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-chart-inspector">
      <div class="collaborative-shapes-header">
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-shapes-back-btn" data-ref="btn-chart-inspector-back" data-i18n-tooltip="collaborative.back_to_elements" data-i18n-aria="common.back">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        </button>
        <span class="collaborative-shapes-title" data-i18n="collaborative.chart_title"></span>
      </div>

      <div class="collaborative-chart-inspector-content" data-ref="chart-inspector-content">
        <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-chart-type">
          <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-chart-type-dropdown" data-i18n-aria="collaborative.chart_type_select">
            <div class="dropdown-trigger__left" data-ref="dropdown-trigger-left-chart-type">
              <svg class="component-icon dropdown-trigger__icon" data-ref="icon-current-chart-type" aria-hidden="true"><use href="/icons.svg#show_chart"></use></svg>
              <span class="dropdown-trigger__text" data-ref="label-current-chart-type" data-i18n="collaborative.chart_type_bar_vertical"></span>
            </div>
            <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>

          <div class="dropdown-backdrop" data-ref="dropdown-backdrop-chart-type">
            <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="chart-type-popup">
              <div class="menu-panel__drag-zone" data-ref="drag-zone-chart-type">
                <span class="menu-panel__drag-handle"></span>
              </div>
              <div class="menu-panel__list menu-panel__list--grid menu-panel__list--cols-4">
                <button type="button" class="menu-item menu-item--card is-active is-selected" data-ref="btn-pick-chart-type" data-value="bar-vertical" data-chart-type="bar-vertical" data-i18n-tooltip="collaborative.chart_type_bar_vertical" data-i18n-aria="collaborative.chart_type_bar_vertical">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="4" y="14" width="6" height="14" rx="1.5"></rect><rect x="13" y="6" width="6" height="22" rx="1.5"></rect><rect x="22" y="10" width="6" height="18" rx="1.5"></rect></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_bar_vertical"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="bar-horizontal" data-chart-type="bar-horizontal" data-i18n-tooltip="collaborative.chart_type_bar_horizontal" data-i18n-aria="collaborative.chart_type_bar_horizontal">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="18" height="6" rx="1.5"></rect><rect x="4" y="13" width="24" height="6" rx="1.5"></rect><rect x="4" y="22" width="14" height="6" rx="1.5"></rect></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_bar_horizontal"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="bar-grouped" data-chart-type="bar-grouped" data-i18n-tooltip="collaborative.chart_type_bar_grouped" data-i18n-aria="collaborative.chart_type_bar_grouped">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="4" y="12" width="4" height="16" rx="1"></rect><rect x="9" y="8" width="4" height="20" rx="1" opacity="0.6"></rect><rect x="18" y="6" width="4" height="22" rx="1"></rect><rect x="23" y="14" width="4" height="14" rx="1" opacity="0.6"></rect></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_bar_grouped"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="bar-stacked" data-chart-type="bar-stacked" data-i18n-tooltip="collaborative.chart_type_bar_stacked" data-i18n-aria="collaborative.chart_type_bar_stacked">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="6" y="18" width="7" height="10" rx="1"></rect><rect x="6" y="10" width="7" height="7" rx="1" opacity="0.6"></rect><rect x="6" y="4" width="7" height="5" rx="1" opacity="0.3"></rect><rect x="18" y="14" width="7" height="14" rx="1"></rect><rect x="18" y="6" width="7" height="7" rx="1" opacity="0.6"></rect></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_bar_stacked"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="line" data-chart-type="line" data-i18n-tooltip="collaborative.chart_type_line" data-i18n-aria="collaborative.chart_type_line">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4,24 12,16 20,20 28,8"></polyline><circle cx="12" cy="16" r="2" fill="currentColor"></circle><circle cx="20" cy="20" r="2" fill="currentColor"></circle></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_line"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="line-multi" data-chart-type="line-multi" data-i18n-tooltip="collaborative.chart_type_line_multi" data-i18n-aria="collaborative.chart_type_line_multi">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4,22 12,18 20,10 28,6"></polyline><polyline points="4,26 12,24 20,16 28,14" opacity="0.6"></polyline></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_line_multi"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="pie" data-chart-type="pie" data-i18n-tooltip="collaborative.chart_type_pie" data-i18n-aria="collaborative.chart_type_pie">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="16" cy="16" r="12"></circle><path d="M 16 16 L 16 4 A 12 12 0 0 1 27 21 Z" fill="currentColor" opacity="0.5"></path><path d="M 16 16 L 27 21 A 12 12 0 0 1 7 22 Z" fill="currentColor"></path></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_pie"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="donut" data-chart-type="donut" data-i18n-tooltip="collaborative.chart_type_donut" data-i18n-aria="collaborative.chart_type_donut">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="5" aria-hidden="true"><circle cx="16" cy="16" r="10"></circle><path d="M 16 6 A 10 10 0 0 1 26 16" stroke="currentColor" opacity="0.4"></path></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_donut"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="area-stacked" data-chart-type="area-stacked" data-i18n-tooltip="collaborative.chart_type_area_stacked" data-i18n-aria="collaborative.chart_type_area_stacked">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M 4 26 L 12 18 L 20 22 L 28 12 L 28 26 Z" opacity="0.8"></path><path d="M 4 26 L 12 22 L 20 24 L 28 18 L 28 26 Z" opacity="0.4"></path></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_area_stacked"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="scatter" data-chart-type="scatter" data-i18n-tooltip="collaborative.chart_type_scatter" data-i18n-aria="collaborative.chart_type_scatter">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="8" cy="22" r="2.5"></circle><circle cx="14" cy="16" r="2.5"></circle><circle cx="18" cy="24" r="2"></circle><circle cx="20" cy="12" r="3"></circle><circle cx="26" cy="8" r="2.5"></circle></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_scatter"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="progress-ring" data-chart-type="progress-ring" data-i18n-tooltip="collaborative.chart_type_progress_ring" data-i18n-aria="collaborative.chart_type_progress_ring">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="4" aria-hidden="true"><circle cx="16" cy="16" r="11" stroke-dasharray="69" stroke-dashoffset="20" stroke-linecap="round"></circle></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_progress_ring"></span>
                </button>
                <button type="button" class="menu-item menu-item--card" data-ref="btn-pick-chart-type" data-value="progress-bar" data-chart-type="progress-bar" data-i18n-tooltip="collaborative.chart_type_progress_bar" data-i18n-aria="collaborative.chart_type_progress_bar">
                  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" aria-hidden="true"><rect x="4" y="12" width="24" height="8" rx="4" fill="currentColor" opacity="0.25"></rect><rect x="4" y="12" width="16" height="8" rx="4" fill="currentColor"></rect></svg>
                  <span class="menu-item__text" data-i18n="collaborative.chart_type_progress_bar"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="collaborative-chart-tabs-nav">
          <div class="component-tabs" data-ref="chart-tabs-toggle" data-active="0">
            <button type="button" class="component-tab is-active" data-ref="btn-tab-chart-data" data-i18n="collaborative.chart_tab_data"></button>
            <button type="button" class="component-tab" data-ref="btn-tab-chart-customize" data-i18n="collaborative.chart_tab_customize"></button>
          </div>
        </div>

        <div class="collaborative-chart-tab-content" data-ref="chart-tab-content-data">
          <div class="collaborative-chart-spreadsheet-wrap" data-ref="chart-spreadsheet-container">
            <table class="collaborative-chart-table" data-ref="chart-data-table">
              <thead data-ref="chart-table-head"></thead>
              <tbody data-ref="chart-table-body"></tbody>
            </table>
          </div>

          <div class="collaborative-chart-sheet-actions">
            <button type="button" class="component-button component-button--secondary component-button--h36 collaborative-chart-sheet-action-btn" data-ref="btn-chart-add-row">
              <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span class="component-button__text" data-i18n="collaborative.chart_add_row"></span>
            </button>
            <button type="button" class="component-button component-button--secondary component-button--h36 collaborative-chart-sheet-action-btn" data-ref="btn-chart-add-col">
              <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span class="component-button__text" data-i18n="collaborative.chart_add_col"></span>
            </button>
            <button type="button" class="component-button component-button--icon-only component-button--secondary component-button--h36" data-ref="btn-chart-transpose" data-i18n-tooltip="collaborative.chart_transpose" data-i18n-aria="collaborative.chart_transpose">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#swap_horiz"></use></svg>
            </button>
            <button type="button" class="component-button component-button--icon-only component-button--secondary component-button--h36" data-ref="btn-chart-clear-data" data-i18n-tooltip="collaborative.chart_clear_data" data-i18n-aria="collaborative.chart_clear_data">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>

          <div class="collaborative-color-section">
            <span class="collaborative-color-section__title" data-i18n="collaborative.chart_palette_label"></span>
            <div class="collaborative-colors-grid" data-ref="chart-palettes-grid">
              <button type="button" class="collaborative-color-swatch collaborative-chart-palette-swatch collaborative-chart-palette-swatch--blue is-active" data-ref="btn-chart-palette-opt" data-palette="blue" data-i18n-tooltip="collaborative.chart_palette_blue" data-i18n-aria="collaborative.chart_palette_blue"><span class="collaborative-color-swatch__fill"></span></button>
              <button type="button" class="collaborative-color-swatch collaborative-chart-palette-swatch collaborative-chart-palette-swatch--purple" data-ref="btn-chart-palette-opt" data-palette="purple" data-i18n-tooltip="collaborative.chart_palette_purple" data-i18n-aria="collaborative.chart_palette_purple"><span class="collaborative-color-swatch__fill"></span></button>
              <button type="button" class="collaborative-color-swatch collaborative-chart-palette-swatch collaborative-chart-palette-swatch--coral" data-ref="btn-chart-palette-opt" data-palette="coral" data-i18n-tooltip="collaborative.chart_palette_coral" data-i18n-aria="collaborative.chart_palette_coral"><span class="collaborative-color-swatch__fill"></span></button>
              <button type="button" class="collaborative-color-swatch collaborative-chart-palette-swatch collaborative-chart-palette-swatch--amber" data-ref="btn-chart-palette-opt" data-palette="amber" data-i18n-tooltip="collaborative.chart_palette_amber" data-i18n-aria="collaborative.chart_palette_amber"><span class="collaborative-color-swatch__fill"></span></button>
              <button type="button" class="collaborative-color-swatch collaborative-chart-palette-swatch collaborative-chart-palette-swatch--emerald" data-ref="btn-chart-palette-opt" data-palette="emerald" data-i18n-tooltip="collaborative.chart_palette_emerald" data-i18n-aria="collaborative.chart_palette_emerald"><span class="collaborative-color-swatch__fill"></span></button>
              <button type="button" class="collaborative-color-swatch collaborative-chart-palette-swatch collaborative-chart-palette-swatch--gray" data-ref="btn-chart-palette-opt" data-palette="gray" data-i18n-tooltip="collaborative.chart_palette_gray" data-i18n-aria="collaborative.chart_palette_gray"><span class="collaborative-color-swatch__fill"></span></button>
            </div>
          </div>
        </div>

        <div class="collaborative-chart-tab-content is-hidden" data-ref="chart-tab-content-customize">
          <div class="collaborative-chart-customize-section">
            <span class="collaborative-shapes-section__title" data-i18n="collaborative.chart_text_heading"></span>
            <label class="split-option-card" data-ref="switch-chart-legend">
              <div class="split-option-card__content">
                <span class="split-option-card__title" data-i18n="collaborative.chart_legend_label"></span>
                <span class="split-option-card__subtitle" data-i18n="collaborative.chart_legend_desc"></span>
              </div>
              <input class="component-checkbox" data-ref="input-chart-legend" type="checkbox" checked />
            </label>
            <label class="split-option-card" data-ref="switch-chart-datalabels">
              <div class="split-option-card__content">
                <span class="split-option-card__title" data-i18n="collaborative.chart_datalabels_label"></span>
                <span class="split-option-card__subtitle" data-i18n="collaborative.chart_datalabels_desc"></span>
              </div>
              <input class="component-checkbox" data-ref="input-chart-datalabels" type="checkbox" />
            </label>
            <label class="field" data-ref="field-chart-title">
              <input class="field__input" data-ref="input-chart-title" type="text" placeholder=" " />
              <span class="field__label" data-i18n="collaborative.chart_title_label"></span>
            </label>
            <label class="field" data-ref="field-chart-subtitle">
              <input class="field__input" data-ref="input-chart-subtitle" type="text" placeholder=" " />
              <span class="field__label" data-i18n="collaborative.chart_subtitle_label"></span>
            </label>
          </div>

          <div class="collaborative-chart-axis-section">
            <div class="component-tabs" data-ref="chart-axis-tabs-toggle" data-active="0">
              <button type="button" class="component-tab is-active" data-ref="btn-tab-chart-xaxis" data-i18n="collaborative.chart_tab_xaxis"></button>
              <button type="button" class="component-tab" data-ref="btn-tab-chart-yaxis" data-i18n="collaborative.chart_tab_yaxis"></button>
            </div>

            <div class="collaborative-chart-axis-content" data-ref="chart-tab-content-xaxis">
              <label class="field" data-ref="field-chart-xaxis-title">
                <input class="field__input" data-ref="input-chart-xaxis-title" type="text" placeholder=" " />
                <span class="field__label" data-i18n="collaborative.chart_xaxis_title_label"></span>
              </label>
              <label class="split-option-card" data-ref="switch-chart-xlabels">
                <div class="split-option-card__content">
                  <span class="split-option-card__title" data-i18n="collaborative.chart_xlabels_label"></span>
                  <span class="split-option-card__subtitle" data-i18n="collaborative.chart_xlabels_desc"></span>
                </div>
                <input class="component-checkbox" data-ref="input-chart-xlabels" type="checkbox" checked />
              </label>
            </div>

            <div class="collaborative-chart-axis-content is-hidden" data-ref="chart-tab-content-yaxis">
              <label class="field" data-ref="field-chart-yaxis-title">
                <input class="field__input" data-ref="input-chart-yaxis-title" type="text" placeholder=" " />
                <span class="field__label" data-i18n="collaborative.chart_yaxis_title_label"></span>
              </label>
              <label class="split-option-card" data-ref="switch-chart-ylabels">
                <div class="split-option-card__content">
                  <span class="split-option-card__title" data-i18n="collaborative.chart_ylabels_label"></span>
                  <span class="split-option-card__subtitle" data-i18n="collaborative.chart_ylabels_desc"></span>
                </div>
                <input class="component-checkbox" data-ref="input-chart-ylabels" type="checkbox" checked />
              </label>
              <label class="split-option-card" data-ref="switch-chart-gridlines">
                <div class="split-option-card__content">
                  <span class="split-option-card__title" data-i18n="collaborative.chart_gridlines_label"></span>
                  <span class="split-option-card__subtitle" data-i18n="collaborative.chart_gridlines_desc"></span>
                </div>
                <input class="component-checkbox" data-ref="input-chart-gridlines" type="checkbox" checked />
              </label>
              <div class="collaborative-field-row">
                <label class="field" data-ref="field-chart-prefix">
                  <input class="field__input" data-ref="input-chart-prefix" type="text" placeholder=" " />
                  <span class="field__label" data-i18n="collaborative.chart_prefix_label"></span>
                </label>
                <label class="field" data-ref="field-chart-suffix">
                  <input class="field__input" data-ref="input-chart-suffix" type="text" placeholder=" " />
                  <span class="field__label" data-i18n="collaborative.chart_suffix_label"></span>
                </label>
              </div>
              <div class="collaborative-field-row">
                <label class="field" data-ref="field-chart-min">
                  <input class="field__input" data-ref="input-chart-min" type="number" placeholder=" " />
                  <span class="field__label" data-i18n="collaborative.chart_min_label"></span>
                </label>
                <label class="field" data-ref="field-chart-max">
                  <input class="field__input" data-ref="input-chart-max" type="number" placeholder=" " />
                  <span class="field__label" data-i18n="collaborative.chart_max_label"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
  return drawer;
}

function renderFullSolidSwatchesHtml(): string {
  return `<div class="collaborative-colors-grid">${FULL_SOLID_COLORS.map(renderSolidSwatch).join('')}</div>`;
}

function renderFullGradientSwatchesHtml(): string {
  return `<div class="collaborative-color-subsections">${EXPANDED_GRADIENT_GROUPS.map((group) => `
    <div class="collaborative-color-subsection" data-gradient-group="${group.id}">
      <span class="collaborative-color-subsection__title" data-i18n="${group.titleKey}"></span>
      <div class="collaborative-colors-grid">
        ${group.gradients.map(renderGradientSwatch).join('')}
      </div>
    </div>
  `).join('')}</div>`;
}

export { createCollaborativeDrawerElement, renderFullGradientSwatchesHtml, renderFullSolidSwatchesHtml };
