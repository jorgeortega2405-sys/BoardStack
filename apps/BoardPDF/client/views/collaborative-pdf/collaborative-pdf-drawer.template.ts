import { SHAPES_CATALOG } from './collab-shapes.config.js';
import { t } from '../../services/i18n.service.js';
const SOLID_COLORS: string[] = [
  '#000b3d', '#00167a', '#0025cc', '#1f48ff', '#5271ff', '#99acff', '#c2cdff',
  '#020c45', '#2c0a71', '#4910bc', '#5e17eb', '#8c52ff', '#bea1f7', '#d8c7fa',
  '#200934', '#401268', '#6b1fad', '#9440dd', '#bc3fde', '#cb6ce6', '#e1a8f0', '#edcbf6',
  '#3d0026', '#7a004b', '#cc007e', '#ff1fa9', '#ff66c4', '#ff99d8', '#ffc2e8',
  '#330a0a', '#661414', '#ff2828', '#ff3a3a', '#ff5050', '#ffadad', '#ffd6d6',
  '#3d0000', '#7a0000', '#cc0000', '#ff3131', '#ff5757', '#ff9999', '#ffc2c2',
  '#3d1700', '#7a2f00', '#cc4e00', '#ff751f', '#ff914d', '#ffc099', '#ffd9c2',
  '#3d2500', '#7a4900', '#cc7a00', '#ffa51f', '#ffbd59', '#ffd699', '#ffe7c2',
  '#3d3100', '#7a6200', '#cca300', '#ffd21f', '#ffde59', '#ffeb99', '#fff3c2',
  '#233d00', '#457a00', '#74cc00', '#9eff1f', '#c1ff72', '#d3ff99', '#e4ffc2',
  '#17320b', '#2e6417', '#4ca626', '#7ed957', '#99e17a', '#bfecac', '#d9f4cd',
  '#003d20', '#007a3f', '#00bf63', '#1fff93', '#5cffb0', '#99ffce', '#c2ffe1',
  '#053827', '#0a714e', '#10bb82', '#31edae', '#69f2c4', '#a1f7da', '#c7fae9',
  '#083335', '#11676a', '#1cabb0', '#3ddbe1', '#5ce1e6', '#a7eff1', '#caf5f7',
  '#00343d', '#00687a', '#0097b2', '#0cc0df', '#5ce7ff', '#99f0ff', '#c2f6ff',
  '#00273d', '#004e7a', '#0081cc', '#38b6ff', '#70cbff', '#99daff', '#c2e9ff',
  '#001b3d', '#00357a', '#004aad', '#1f80ff', '#5ca3ff', '#99c5ff', '#c2dcff',
];

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
  const solidColorSwatches = SOLID_COLORS.map(
    (c) => `<button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="${c}" data-tooltip="${c}" aria-label="${c}" style="background-color: ${c};"></button>`
  ).join('');

  
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
          <div class="collaborative-shapes-grid collaborative-shapes-grid--full" data-ref="shapes-cat-grid"></div>
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
                  <rect x="13" y="16" width="6" height="40" rx="1.5" fill="#a855f7"></rect>
                  <rect x="20" y="34" width="6" height="22" rx="1.5" fill="#f59e0b"></rect>
                  <rect x="34" y="20" width="6" height="36" rx="1.5" fill="#3b82f6"></rect>
                  <rect x="41" y="28" width="6" height="28" rx="1.5" fill="#a855f7"></rect>
                  <rect x="48" y="12" width="6" height="44" rx="1.5" fill="#f59e0b"></rect>
                </svg>
                <span class="collaborative-chart-card__label">Columnas agrupadas</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="bar-stacked" data-tooltip="Barras apiladas" aria-label="Barras apiladas">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <rect x="12" y="38" width="14" height="18" rx="2" fill="#3b82f6"></rect>
                  <rect x="12" y="22" width="14" height="14" rx="2" fill="#a855f7"></rect>
                  <rect x="12" y="10" width="14" height="10" rx="2" fill="#f59e0b"></rect>
                  <rect x="38" y="32" width="14" height="24" rx="2" fill="#3b82f6"></rect>
                  <rect x="38" y="18" width="14" height="12" rx="2" fill="#a855f7"></rect>
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
                  <polyline points="8,50 24,30 40,34 56,22" stroke="#a855f7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
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
                  <path d="M 32 32 L 7 24 A 26 26 0 0 0 16 52 Z" fill="#a855f7"></path>
                </svg>
                <span class="collaborative-chart-card__label">Pastel</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="donut" data-tooltip="Anillos" aria-label="Anillos">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <circle cx="32" cy="32" r="26" fill="#3b82f6"></circle>
                  <path d="M 32 32 L 32 6 A 26 26 0 0 0 7 24 Z" fill="#f59e0b"></path>
                  <path d="M 32 32 L 7 24 A 26 26 0 0 0 16 52 Z" fill="#a855f7"></path>
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
                  <path d="M 8 38 L 24 24 L 40 30 L 56 12 L 56 22 L 40 44 L 24 38 L 8 52 Z" fill="#a855f7" opacity="0.85"></path>
                </svg>
                <span class="collaborative-chart-card__label">Área apilada</span>
              </button>
              <button type="button" class="collaborative-chart-card" data-ref="btn-chart-card" data-chart-type="area-overlap" data-tooltip="Área sin apilar" aria-label="Área sin apilar">
                <svg class="collaborative-chart-card__svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                  <path d="M 8 52 L 20 22 L 36 34 L 56 16 L 56 52 Z" fill="#3b82f6" fill-opacity="0.65"></path>
                  <path d="M 8 52 L 24 34 L 42 18 L 56 28 L 56 52 Z" fill="#a855f7" fill-opacity="0.65"></path>
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
          <span class="collaborative-color-section__title" data-ref="txt-color-section-first-title">Colores</span>
          <div class="collaborative-colors-grid" data-ref="grid-category-colors">
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--gradient-picker" data-ref="btn-color-custom-picker" data-tooltip="Color personalizado" aria-label="Color personalizado">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            </button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--eyedropper" data-ref="btn-color-eyedropper" data-tooltip="Gotero con zoom" aria-label="Gotero con zoom">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#colorize"></use></svg>
            </button>
          </div>
        </div>

        <div class="collaborative-color-section">
          <div class="collaborative-color-section__header">
            <span class="collaborative-color-section__title">Colores sólidos predeterminados</span>
            <button type="button" class="collaborative-shapes-section__more-btn" data-ref="btn-solid-colors-more">Mostrar más</button>
          </div>
          <div class="collaborative-colors-grid" data-ref="grid-solid-colors">
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#000b3d" data-tooltip="#000b3d" aria-label="#000b3d" style="background-color: #000b3d;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#00167a" data-tooltip="#00167a" aria-label="#00167a" style="background-color: #00167a;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#0025cc" data-tooltip="#0025cc" aria-label="#0025cc" style="background-color: #0025cc;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#1f48ff" data-tooltip="#1f48ff" aria-label="#1f48ff" style="background-color: #1f48ff;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#5271ff" data-tooltip="#5271ff" aria-label="#5271ff" style="background-color: #5271ff;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#99acff" data-tooltip="#99acff" aria-label="#99acff" style="background-color: #99acff;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#c2cdff" data-tooltip="#c2cdff" aria-label="#c2cdff" style="background-color: #c2cdff;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#020c45" data-tooltip="#020c45" aria-label="#020c45" style="background-color: #020c45;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#2c0a71" data-tooltip="#2c0a71" aria-label="#2c0a71" style="background-color: #2c0a71;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#4910bc" data-tooltip="#4910bc" aria-label="#4910bc" style="background-color: #4910bc;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#5e17eb" data-tooltip="#5e17eb" aria-label="#5e17eb" style="background-color: #5e17eb;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#8c52ff" data-tooltip="#8c52ff" aria-label="#8c52ff" style="background-color: #8c52ff;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#bea1f7" data-tooltip="#bea1f7" aria-label="#bea1f7" style="background-color: #bea1f7;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#d8c7fa" data-tooltip="#d8c7fa" aria-label="#d8c7fa" style="background-color: #d8c7fa;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#200934" data-tooltip="#200934" aria-label="#200934" style="background-color: #200934;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#401268" data-tooltip="#401268" aria-label="#401268" style="background-color: #401268;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#6b1fad" data-tooltip="#6b1fad" aria-label="#6b1fad" style="background-color: #6b1fad;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#9440dd" data-tooltip="#9440dd" aria-label="#9440dd" style="background-color: #9440dd;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#bc3fde" data-tooltip="#bc3fde" aria-label="#bc3fde" style="background-color: #bc3fde;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#cb6ce6" data-tooltip="#cb6ce6" aria-label="#cb6ce6" style="background-color: #cb6ce6;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#e1a8f0" data-tooltip="#e1a8f0" aria-label="#e1a8f0" style="background-color: #e1a8f0;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#edcbf6" data-tooltip="#edcbf6" aria-label="#edcbf6" style="background-color: #edcbf6;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#3d0026" data-tooltip="#3d0026" aria-label="#3d0026" style="background-color: #3d0026;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#7a004b" data-tooltip="#7a004b" aria-label="#7a004b" style="background-color: #7a004b;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#cc007e" data-tooltip="#cc007e" aria-label="#cc007e" style="background-color: #cc007e;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ff1fa9" data-tooltip="#ff1fa9" aria-label="#ff1fa9" style="background-color: #ff1fa9;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ff66c4" data-tooltip="#ff66c4" aria-label="#ff66c4" style="background-color: #ff66c4;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ff99d8" data-tooltip="#ff99d8" aria-label="#ff99d8" style="background-color: #ff99d8;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ffc2e8" data-tooltip="#ffc2e8" aria-label="#ffc2e8" style="background-color: #ffc2e8;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#330a0a" data-tooltip="#330a0a" aria-label="#330a0a" style="background-color: #330a0a;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#661414" data-tooltip="#661414" aria-label="#661414" style="background-color: #661414;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ff2828" data-tooltip="#ff2828" aria-label="#ff2828" style="background-color: #ff2828;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ff3a3a" data-tooltip="#ff3a3a" aria-label="#ff3a3a" style="background-color: #ff3a3a;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ff5050" data-tooltip="#ff5050" aria-label="#ff5050" style="background-color: #ff5050;"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="#ffadad" data-tooltip="#ffadad" aria-label="#ffadad" style="background-color: #ffadad;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffd6d6" data-tooltip="#ffd6d6" aria-label="#ffd6d6" style="background-color: #ffd6d6;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#3d0000" data-tooltip="#3d0000" aria-label="#3d0000" style="background-color: #3d0000;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#7a0000" data-tooltip="#7a0000" aria-label="#7a0000" style="background-color: #7a0000;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#cc0000" data-tooltip="#cc0000" aria-label="#cc0000" style="background-color: #cc0000;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ff3131" data-tooltip="#ff3131" aria-label="#ff3131" style="background-color: #ff3131;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ff5757" data-tooltip="#ff5757" aria-label="#ff5757" style="background-color: #ff5757;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ff9999" data-tooltip="#ff9999" aria-label="#ff9999" style="background-color: #ff9999;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffc2c2" data-tooltip="#ffc2c2" aria-label="#ffc2c2" style="background-color: #ffc2c2;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#3d1700" data-tooltip="#3d1700" aria-label="#3d1700" style="background-color: #3d1700;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#7a2f00" data-tooltip="#7a2f00" aria-label="#7a2f00" style="background-color: #7a2f00;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#cc4e00" data-tooltip="#cc4e00" aria-label="#cc4e00" style="background-color: #cc4e00;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ff751f" data-tooltip="#ff751f" aria-label="#ff751f" style="background-color: #ff751f;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ff914d" data-tooltip="#ff914d" aria-label="#ff914d" style="background-color: #ff914d;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffc099" data-tooltip="#ffc099" aria-label="#ffc099" style="background-color: #ffc099;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffd9c2" data-tooltip="#ffd9c2" aria-label="#ffd9c2" style="background-color: #ffd9c2;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#3d2500" data-tooltip="#3d2500" aria-label="#3d2500" style="background-color: #3d2500;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#7a4900" data-tooltip="#7a4900" aria-label="#7a4900" style="background-color: #7a4900;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#cc7a00" data-tooltip="#cc7a00" aria-label="#cc7a00" style="background-color: #cc7a00;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffa51f" data-tooltip="#ffa51f" aria-label="#ffa51f" style="background-color: #ffa51f;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffbd59" data-tooltip="#ffbd59" aria-label="#ffbd59" style="background-color: #ffbd59;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffd699" data-tooltip="#ffd699" aria-label="#ffd699" style="background-color: #ffd699;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffe7c2" data-tooltip="#ffe7c2" aria-label="#ffe7c2" style="background-color: #ffe7c2;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#3d3100" data-tooltip="#3d3100" aria-label="#3d3100" style="background-color: #3d3100;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#7a6200" data-tooltip="#7a6200" aria-label="#7a6200" style="background-color: #7a6200;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#cca300" data-tooltip="#cca300" aria-label="#cca300" style="background-color: #cca300;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffd21f" data-tooltip="#ffd21f" aria-label="#ffd21f" style="background-color: #ffd21f;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffde59" data-tooltip="#ffde59" aria-label="#ffde59" style="background-color: #ffde59;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#ffeb99" data-tooltip="#ffeb99" aria-label="#ffeb99" style="background-color: #ffeb99;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#fff3c2" data-tooltip="#fff3c2" aria-label="#fff3c2" style="background-color: #fff3c2;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#233d00" data-tooltip="#233d00" aria-label="#233d00" style="background-color: #233d00;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#457a00" data-tooltip="#457a00" aria-label="#457a00" style="background-color: #457a00;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#74cc00" data-tooltip="#74cc00" aria-label="#74cc00" style="background-color: #74cc00;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#9eff1f" data-tooltip="#9eff1f" aria-label="#9eff1f" style="background-color: #9eff1f;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#c1ff72" data-tooltip="#c1ff72" aria-label="#c1ff72" style="background-color: #c1ff72;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#d3ff99" data-tooltip="#d3ff99" aria-label="#d3ff99" style="background-color: #d3ff99;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#e4ffc2" data-tooltip="#e4ffc2" aria-label="#e4ffc2" style="background-color: #e4ffc2;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#17320b" data-tooltip="#17320b" aria-label="#17320b" style="background-color: #17320b;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#2e6417" data-tooltip="#2e6417" aria-label="#2e6417" style="background-color: #2e6417;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#4ca626" data-tooltip="#4ca626" aria-label="#4ca626" style="background-color: #4ca626;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#7ed957" data-tooltip="#7ed957" aria-label="#7ed957" style="background-color: #7ed957;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#99e17a" data-tooltip="#99e17a" aria-label="#99e17a" style="background-color: #99e17a;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#bfecac" data-tooltip="#bfecac" aria-label="#bfecac" style="background-color: #bfecac;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#d9f4cd" data-tooltip="#d9f4cd" aria-label="#d9f4cd" style="background-color: #d9f4cd;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#003d20" data-tooltip="#003d20" aria-label="#003d20" style="background-color: #003d20;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#007a3f" data-tooltip="#007a3f" aria-label="#007a3f" style="background-color: #007a3f;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#00bf63" data-tooltip="#00bf63" aria-label="#00bf63" style="background-color: #00bf63;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#1fff93" data-tooltip="#1fff93" aria-label="#1fff93" style="background-color: #1fff93;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#5cffb0" data-tooltip="#5cffb0" aria-label="#5cffb0" style="background-color: #5cffb0;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#99ffce" data-tooltip="#99ffce" aria-label="#99ffce" style="background-color: #99ffce;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#c2ffe1" data-tooltip="#c2ffe1" aria-label="#c2ffe1" style="background-color: #c2ffe1;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#053827" data-tooltip="#053827" aria-label="#053827" style="background-color: #053827;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#0a714e" data-tooltip="#0a714e" aria-label="#0a714e" style="background-color: #0a714e;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#10bb82" data-tooltip="#10bb82" aria-label="#10bb82" style="background-color: #10bb82;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#31edae" data-tooltip="#31edae" aria-label="#31edae" style="background-color: #31edae;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#69f2c4" data-tooltip="#69f2c4" aria-label="#69f2c4" style="background-color: #69f2c4;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#a1f7da" data-tooltip="#a1f7da" aria-label="#a1f7da" style="background-color: #a1f7da;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#c7fae9" data-tooltip="#c7fae9" aria-label="#c7fae9" style="background-color: #c7fae9;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#083335" data-tooltip="#083335" aria-label="#083335" style="background-color: #083335;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#11676a" data-tooltip="#11676a" aria-label="#11676a" style="background-color: #11676a;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#1cabb0" data-tooltip="#1cabb0" aria-label="#1cabb0" style="background-color: #1cabb0;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#3ddbe1" data-tooltip="#3ddbe1" aria-label="#3ddbe1" style="background-color: #3ddbe1;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#5ce1e6" data-tooltip="#5ce1e6" aria-label="#5ce1e6" style="background-color: #5ce1e6;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#a7eff1" data-tooltip="#a7eff1" aria-label="#a7eff1" style="background-color: #a7eff1;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#caf5f7" data-tooltip="#caf5f7" aria-label="#caf5f7" style="background-color: #caf5f7;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#00343d" data-tooltip="#00343d" aria-label="#00343d" style="background-color: #00343d;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#00687a" data-tooltip="#00687a" aria-label="#00687a" style="background-color: #00687a;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#0097b2" data-tooltip="#0097b2" aria-label="#0097b2" style="background-color: #0097b2;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#0cc0df" data-tooltip="#0cc0df" aria-label="#0cc0df" style="background-color: #0cc0df;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#5ce7ff" data-tooltip="#5ce7ff" aria-label="#5ce7ff" style="background-color: #5ce7ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#99f0ff" data-tooltip="#99f0ff" aria-label="#99f0ff" style="background-color: #99f0ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#c2f6ff" data-tooltip="#c2f6ff" aria-label="#c2f6ff" style="background-color: #c2f6ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#00273d" data-tooltip="#00273d" aria-label="#00273d" style="background-color: #00273d;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#004e7a" data-tooltip="#004e7a" aria-label="#004e7a" style="background-color: #004e7a;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#0081cc" data-tooltip="#0081cc" aria-label="#0081cc" style="background-color: #0081cc;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#38b6ff" data-tooltip="#38b6ff" aria-label="#38b6ff" style="background-color: #38b6ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#70cbff" data-tooltip="#70cbff" aria-label="#70cbff" style="background-color: #70cbff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#99daff" data-tooltip="#99daff" aria-label="#99daff" style="background-color: #99daff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#c2e9ff" data-tooltip="#c2e9ff" aria-label="#c2e9ff" style="background-color: #c2e9ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#001b3d" data-tooltip="#001b3d" aria-label="#001b3d" style="background-color: #001b3d;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#00357a" data-tooltip="#00357a" aria-label="#00357a" style="background-color: #00357a;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#004aad" data-tooltip="#004aad" aria-label="#004aad" style="background-color: #004aad;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#1f80ff" data-tooltip="#1f80ff" aria-label="#1f80ff" style="background-color: #1f80ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#5ca3ff" data-tooltip="#5ca3ff" aria-label="#5ca3ff" style="background-color: #5ca3ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#99c5ff" data-tooltip="#99c5ff" aria-label="#99c5ff" style="background-color: #99c5ff;"></button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--extra is-hidden" data-ref="swatch-color" data-color="#c2dcff" data-tooltip="#c2dcff" aria-label="#c2dcff" style="background-color: #c2dcff;"></button>
          </div>
        </div>

        <div class="collaborative-color-section">
          <span class="collaborative-color-section__title">Colores degradados predeterminados</span>
          <div class="collaborative-colors-grid" data-ref="grid-gradient-colors">
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #f6d365 0%, #fda085 100%)" data-tooltip="Atardecer" aria-label="Atardecer" style="background-image: linear-gradient(135deg, #f6d365 0%, #fda085 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" data-tooltip="Flamingo" aria-label="Flamingo" style="background-image: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)" data-tooltip="Océano" aria-label="Océano" style="background-image: linear-gradient(135deg, #5ee7df 0%, #b490ca 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" data-tooltip="Violeta real" aria-label="Violeta real" style="background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)" data-tooltip="Cielo azul" aria-label="Cielo azul" style="background-image: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #13547a 0%, #80d0c7 100%)" data-tooltip="Aguamarina" aria-label="Aguamarina" style="background-image: linear-gradient(135deg, #13547a 0%, #80d0c7 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #ff0844 0%, #ffb199 100%)" data-tooltip="Amanecer coral" aria-label="Amanecer coral" style="background-image: linear-gradient(135deg, #ff0844 0%, #ffb199 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #b224ef 0%, #7579ff 100%)" data-tooltip="Magia púrpura" aria-label="Magia púrpura" style="background-image: linear-gradient(135deg, #b224ef 0%, #7579ff 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #0ba360 0%, #3cba92 100%)" data-tooltip="Menta fresca" aria-label="Menta fresca" style="background-image: linear-gradient(135deg, #0ba360 0%, #3cba92 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)" data-tooltip="Rubor" aria-label="Rubor" style="background-image: linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" data-tooltip="Neón lima" aria-label="Neón lima" style="background-image: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #fa709a 0%, #fee140 100%)" data-tooltip="Sol de verano" aria-label="Sol de verano" style="background-image: linear-gradient(135deg, #fa709a 0%, #fee140 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #30cfd0 0%, #330867 100%)" data-tooltip="Espacio profundo" aria-label="Espacio profundo" style="background-image: linear-gradient(135deg, #30cfd0 0%, #330867 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" data-tooltip="Algodón de azúcar" aria-label="Algodón de azúcar" style="background-image: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);"></button>
          </div>
        </div>
      </div>
      <input class="is-hidden" data-ref="input-custom-color" type="color" value="#3b82f6" />
    </div>

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-text">
      <button type="button" class="component-button component-button--black component-button--h48 component-button--w-full" data-ref="btn-add-text-box">
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
      <div class="collaborative-chart-inspector-header">
        <div class="collaborative-chart-inspector-header__left">
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-chart-inspector-back-btn" data-ref="btn-chart-inspector-back" data-tooltip="Volver a elementos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="collaborative-drawer-header__title">Gráfica</span>
        </div>
        <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32" data-ref="btn-chart-inspector-close" data-tooltip="Cerrar inspector" aria-label="Cerrar">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>

      <div class="collaborative-chart-type-selector-wrap">
        <button type="button" class="collaborative-chart-type-btn" data-ref="btn-chart-type-dropdown">
          <span class="collaborative-chart-type-btn__current" data-ref="txt-current-chart-type">
            <svg class="component-icon collaborative-chart-type-btn__icon" data-ref="icon-current-chart-type" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
            <span data-ref="label-current-chart-type">Barras verticales</span>
          </span>
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>

        <div class="collaborative-chart-type-popup is-hidden" data-ref="chart-type-popup">
          <div class="collaborative-chart-type-popup__grid">
            <button type="button" class="collaborative-chart-type-item is-selected" data-ref="btn-pick-chart-type" data-chart-type="bar-vertical" data-tooltip="Barras verticales" aria-label="Barras verticales">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><rect x="4" y="14" width="6" height="14" rx="1.5"></rect><rect x="13" y="6" width="6" height="22" rx="1.5"></rect><rect x="22" y="10" width="6" height="18" rx="1.5"></rect></svg>
              <span>Barras vert.</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="bar-horizontal" data-tooltip="Barras horizontales" aria-label="Barras horizontales">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><rect x="4" y="4" width="18" height="6" rx="1.5"></rect><rect x="4" y="13" width="24" height="6" rx="1.5"></rect><rect x="4" y="22" width="14" height="6" rx="1.5"></rect></svg>
              <span>Barras horiz.</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="bar-grouped" data-tooltip="Columnas agrupadas" aria-label="Columnas agrupadas">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><rect x="4" y="12" width="4" height="16" rx="1"></rect><rect x="9" y="8" width="4" height="20" rx="1" opacity="0.6"></rect><rect x="18" y="6" width="4" height="22" rx="1"></rect><rect x="23" y="14" width="4" height="14" rx="1" opacity="0.6"></rect></svg>
              <span>Agrupadas</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="bar-stacked" data-tooltip="Barras apiladas" aria-label="Barras apiladas">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><rect x="6" y="18" width="7" height="10" rx="1"></rect><rect x="6" y="10" width="7" height="7" rx="1" opacity="0.6"></rect><rect x="6" y="4" width="7" height="5" rx="1" opacity="0.3"></rect><rect x="18" y="14" width="7" height="14" rx="1"></rect><rect x="18" y="6" width="7" height="7" rx="1" opacity="0.6"></rect></svg>
              <span>Apiladas</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="line" data-tooltip="Líneas" aria-label="Líneas">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,24 12,16 20,20 28,8"></polyline><circle cx="12" cy="16" r="2" fill="currentColor"></circle><circle cx="20" cy="20" r="2" fill="currentColor"></circle></svg>
              <span>Líneas</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="line-multi" data-tooltip="Varias líneas" aria-label="Varias líneas">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,22 12,18 20,10 28,6"></polyline><polyline points="4,26 12,24 20,16 28,14" opacity="0.6"></polyline></svg>
              <span>Varias líneas</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="pie" data-tooltip="Pastel" aria-label="Pastel">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="12"></circle><path d="M 16 16 L 16 4 A 12 12 0 0 1 27 21 Z" fill="currentColor" opacity="0.5"></path><path d="M 16 16 L 27 21 A 12 12 0 0 1 7 22 Z" fill="currentColor"></path></svg>
              <span>Pastel</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="donut" data-tooltip="Anillos" aria-label="Anillos">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="5"><circle cx="16" cy="16" r="10"></circle><path d="M 16 6 A 10 10 0 0 1 26 16" stroke="currentColor" opacity="0.4"></path></svg>
              <span>Anillos</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="area-stacked" data-tooltip="Área apilada" aria-label="Área apilada">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><path d="M 4 26 L 12 18 L 20 22 L 28 12 L 28 26 Z" opacity="0.8"></path><path d="M 4 26 L 12 22 L 20 24 L 28 18 L 28 26 Z" opacity="0.4"></path></svg>
              <span>Área</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="scatter" data-tooltip="Dispersión" aria-label="Dispersión">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor"><circle cx="8" cy="22" r="2.5"></circle><circle cx="14" cy="16" r="2.5"></circle><circle cx="18" cy="24" r="2"></circle><circle cx="20" cy="12" r="3"></circle><circle cx="26" cy="8" r="2.5"></circle></svg>
              <span>Dispersión</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="progress-ring" data-tooltip="Anillo de progreso" aria-label="Anillo de progreso">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="4"><circle cx="16" cy="16" r="11" stroke-dasharray="69" stroke-dashoffset="20" stroke-linecap="round"></circle></svg>
              <span>Progreso</span>
            </button>
            <button type="button" class="collaborative-chart-type-item" data-ref="btn-pick-chart-type" data-chart-type="progress-bar" data-tooltip="Barra de progreso" aria-label="Barra de progreso">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none"><rect x="4" y="12" width="24" height="8" rx="4" fill="currentColor" opacity="0.25"></rect><rect x="4" y="12" width="16" height="8" rx="4" fill="currentColor"></rect></svg>
              <span>Barra progr.</span>
            </button>
          </div>
        </div>
      </div>

      <div class="collaborative-chart-tabs-nav">
        <div class="component-tabs" data-ref="chart-tabs-toggle" data-active="0">
          <button type="button" class="component-tab is-active" data-ref="btn-tab-chart-data">Datos</button>
          <button type="button" class="component-tab" data-ref="btn-tab-chart-customize">Personalizar</button>
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
          <button type="button" class="component-button component-button--ghost component-button--h32" data-ref="btn-chart-add-row">
            <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span class="component-button__text">Fila</span>
          </button>
          <button type="button" class="component-button component-button--ghost component-button--h32" data-ref="btn-chart-add-col">
            <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span class="component-button__text">Columna</span>
          </button>
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32" data-ref="btn-chart-transpose" data-tooltip="Transponer filas y columnas" aria-label="Transponer">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#swap_horiz"></use></svg>
          </button>
          <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32" data-ref="btn-chart-clear-data" data-tooltip="Limpiar datos" aria-label="Limpiar datos">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>

        <div class="collaborative-drawer-subheading">
          <span class="collaborative-drawer-subheading__title">Configuración de la gráfica</span>
        </div>

        <div class="collaborative-chart-config-group">
          <span class="collaborative-chart-field-label">Paleta de colores</span>
          <div class="collaborative-chart-palettes-grid" data-ref="chart-palettes-grid">
            <button type="button" class="collaborative-chart-palette-btn is-active" data-ref="btn-chart-palette-opt" data-palette="blue" data-tooltip="Azul corporativo" aria-label="Azul">
              <span class="collaborative-chart-palette-preview" style="background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd);"></span>
            </button>
            <button type="button" class="collaborative-chart-palette-btn" data-ref="btn-chart-palette-opt" data-palette="purple" data-tooltip="Púrpura creativo" aria-label="Púrpura">
              <span class="collaborative-chart-palette-preview" style="background: linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd);"></span>
            </button>
            <button type="button" class="collaborative-chart-palette-btn" data-ref="btn-chart-palette-opt" data-palette="coral" data-tooltip="Coral cálido" aria-label="Coral">
              <span class="collaborative-chart-palette-preview" style="background: linear-gradient(90deg, #ef4444, #f87171, #fca5a5);"></span>
            </button>
            <button type="button" class="collaborative-chart-palette-btn" data-ref="btn-chart-palette-opt" data-palette="amber" data-tooltip="Ámbar / Dorado" aria-label="Ámbar">
              <span class="collaborative-chart-palette-preview" style="background: linear-gradient(90deg, #f59e0b, #fbbf24, #fcd34d);"></span>
            </button>
            <button type="button" class="collaborative-chart-palette-btn" data-ref="btn-chart-palette-opt" data-palette="emerald" data-tooltip="Esmeralda / Menta" aria-label="Esmeralda">
              <span class="collaborative-chart-palette-preview" style="background: linear-gradient(90deg, #10b981, #34d399, #6ee7b7);"></span>
            </button>
            <button type="button" class="collaborative-chart-palette-btn" data-ref="btn-chart-palette-opt" data-palette="gray" data-tooltip="Carbón sobrio" aria-label="Carbón">
              <span class="collaborative-chart-palette-preview" style="background: linear-gradient(90deg, #4b5563, #6b7280, #9ca3af);"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="collaborative-chart-tab-content is-hidden" data-ref="chart-tab-content-customize">
        <div class="collaborative-accordion is-open" data-ref="accordion-chart-text">
          <button type="button" class="collaborative-accordion__header" data-ref="btn-accordion-toggle">
            <span class="collaborative-accordion__title">Texto y etiquetas</span>
            <svg class="component-icon collaborative-accordion__icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="collaborative-accordion__content">
            <div class="collaborative-switch-row">
              <span class="collaborative-switch-row__label">Mostrar leyenda</span>
              <label class="component-switch" data-ref="switch-chart-legend">
                <input class="component-switch__input" data-ref="input-chart-legend" type="checkbox" checked />
                <span class="component-switch__slider"></span>
              </label>
            </div>
            <div class="collaborative-switch-row">
              <span class="collaborative-switch-row__label">Etiquetas de datos en gráfica</span>
              <label class="component-switch" data-ref="switch-chart-datalabels">
                <input class="component-switch__input" data-ref="input-chart-datalabels" type="checkbox" />
                <span class="component-switch__slider"></span>
              </label>
            </div>
            <label class="field" data-ref="field-chart-title">
              <input class="field__input" data-ref="input-chart-title" type="text" placeholder=" " />
              <span class="field__label">Título de la gráfica</span>
            </label>
            <label class="field" data-ref="field-chart-subtitle">
              <input class="field__input" data-ref="input-chart-subtitle" type="text" placeholder=" " />
              <span class="field__label">Subtítulo</span>
            </label>
          </div>
        </div>

        <div class="collaborative-accordion" data-ref="accordion-chart-xaxis">
          <button type="button" class="collaborative-accordion__header" data-ref="btn-accordion-toggle">
            <span class="collaborative-accordion__title">Eje X</span>
            <svg class="component-icon collaborative-accordion__icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="collaborative-accordion__content">
            <label class="field" data-ref="field-chart-xaxis-title">
              <input class="field__input" data-ref="input-chart-xaxis-title" type="text" placeholder=" " />
              <span class="field__label">Título del eje X</span>
            </label>
            <div class="collaborative-switch-row">
              <span class="collaborative-switch-row__label">Etiquetas del eje X</span>
              <label class="component-switch" data-ref="switch-chart-xlabels">
                <input class="component-switch__input" data-ref="input-chart-xlabels" type="checkbox" checked />
                <span class="component-switch__slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="collaborative-accordion" data-ref="accordion-chart-yaxis">
          <button type="button" class="collaborative-accordion__header" data-ref="btn-accordion-toggle">
            <span class="collaborative-accordion__title">Eje Y y escalas</span>
            <svg class="component-icon collaborative-accordion__icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
          </button>
          <div class="collaborative-accordion__content">
            <label class="field" data-ref="field-chart-yaxis-title">
              <input class="field__input" data-ref="input-chart-yaxis-title" type="text" placeholder=" " />
              <span class="field__label">Título del eje Y</span>
            </label>
            <div class="collaborative-switch-row">
              <span class="collaborative-switch-row__label">Etiquetas del eje Y</span>
              <label class="component-switch" data-ref="switch-chart-ylabels">
                <input class="component-switch__input" data-ref="input-chart-ylabels" type="checkbox" checked />
                <span class="component-switch__slider"></span>
              </label>
            </div>
            <div class="collaborative-switch-row">
              <span class="collaborative-switch-row__label">Líneas de cuadrícula</span>
              <label class="component-switch" data-ref="switch-chart-gridlines">
                <input class="component-switch__input" data-ref="input-chart-gridlines" type="checkbox" checked />
                <span class="component-switch__slider"></span>
              </label>
            </div>
            <div class="collaborative-field-row">
              <label class="field" data-ref="field-chart-prefix">
                <input class="field__input" data-ref="input-chart-prefix" type="text" placeholder=" " />
                <span class="field__label">Prefijo (ej. $)</span>
              </label>
              <label class="field" data-ref="field-chart-suffix">
                <input class="field__input" data-ref="input-chart-suffix" type="text" placeholder=" " />
                <span class="field__label">Sufijo (ej. %)</span>
              </label>
            </div>
            <div class="collaborative-field-row">
              <label class="field" data-ref="field-chart-min">
                <input class="field__input" data-ref="input-chart-min" type="number" placeholder=" " />
                <span class="field__label">Mínimo</span>
              </label>
              <label class="field" data-ref="field-chart-max">
                <input class="field__input" data-ref="input-chart-max" type="number" placeholder=" " />
                <span class="field__label">Máximo</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
  return drawer;
}

export { createCollaborativeDrawerElement };
