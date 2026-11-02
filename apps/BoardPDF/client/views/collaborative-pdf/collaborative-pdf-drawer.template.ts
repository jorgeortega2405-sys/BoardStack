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

export function createCollaborativeDrawerElement(): HTMLElement {
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

  const drawer = document.createElement('div');
  drawer.className = 'layout-drawer';
  drawer.setAttribute('data-ref', 'layout-drawer');
  drawer.innerHTML = `
  <div class="layout-drawer__header collaborative-drawer-header" data-ref="drawer-header">
    <div class="collaborative-drawer-header__left" data-ref="drawer-header-left">
      <button type="button" class="component-button component-button--icon-only component-button--ghost component-button--h32 collaborative-drawer-back-btn is-hidden" data-ref="btn-drawer-back" data-tooltip="Volver" aria-label="Volver">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
      </button>
      <span class="collaborative-drawer-header__title" data-ref="side-panel-title">Elementos</span>
    </div>
  </div>

  <div class="layout-drawer__body" data-ref="side-panel-body">
    <div class="collaborative-panel-section" data-ref="panel-section-elements">
      <div class="collaborative-elements-main" data-ref="elements-main-view">
        <div class="collaborative-panel-grid collaborative-panel-grid--4" data-ref="list-elements">
          <button type="button" class="collaborative-element-card" data-ref="btn-elem-shapes" data-tooltip="Formas" aria-label="Formas">
            <div class="collaborative-element-card__icon-wrap">
              <svg class="collaborative-element-svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                <rect x="7" y="3" width="50" height="50" rx="14" fill="#c084fc" transform="rotate(-3 32 28)"></rect>
                <rect x="7" y="7" width="50" height="50" rx="14" fill="#7e22ce"></rect>
                <rect x="8" y="8" width="48" height="48" rx="13" fill="#9333ea"></rect>
                <rect x="17" y="17" width="13" height="13" rx="3" fill="#38bdf8"></rect>
                <circle cx="42" cy="23" r="7" fill="#fbbf24"></circle>
                <polygon points="24,47 16,33 32,33" fill="#f43f5e"></polygon>
                <path d="M42 35l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" fill="#34d399"></path>
              </svg>
            </div>
            <span class="collaborative-element-card__text">Formas</span>
          </button>
          <button type="button" class="collaborative-element-card" data-ref="btn-elem-tables" data-tooltip="Tablas" aria-label="Tablas">
            <div class="collaborative-element-card__icon-wrap">
              <svg class="collaborative-element-svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                <rect x="7" y="3" width="50" height="50" rx="14" fill="#fb923c" transform="rotate(3 32 28)"></rect>
                <rect x="7" y="7" width="50" height="50" rx="14" fill="#ea580c"></rect>
                <rect x="8" y="8" width="48" height="48" rx="13" fill="#f97316"></rect>
                <rect x="16" y="16" width="32" height="32" rx="4" fill="#fb923c" stroke="#ffffff" stroke-width="2.5"></rect>
                <line x1="16" y1="25" x2="48" y2="25" stroke="#ffffff" stroke-width="2.5"></line>
                <line x1="16" y1="35" x2="48" y2="35" stroke="#ffffff" stroke-width="2.5"></line>
                <line x1="26" y1="16" x2="26" y2="48" stroke="#ffffff" stroke-width="2.5"></line>
                <line x1="38" y1="16" x2="38" y2="48" stroke="#ffffff" stroke-width="2.5"></line>
              </svg>
            </div>
            <span class="collaborative-element-card__text">Tablas</span>
          </button>

          <button type="button" class="collaborative-element-card" data-ref="btn-elem-photos" data-tooltip="Fotos" aria-label="Fotos">
            <div class="collaborative-element-card__icon-wrap">
              <svg class="collaborative-element-svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                <rect x="7" y="3" width="50" height="50" rx="14" fill="#60a5fa" transform="rotate(-3 32 28)"></rect>
                <rect x="7" y="7" width="50" height="50" rx="14" fill="#1d4ed8"></rect>
                <rect x="8" y="8" width="48" height="48" rx="13" fill="#3b82f6"></rect>
                <rect x="16" y="16" width="32" height="32" rx="5" fill="#ffffff"></rect>
                <rect x="19" y="19" width="26" height="26" rx="3" fill="#38bdf8"></rect>
                <circle cx="38" cy="24" r="3" fill="#facc15"></circle>
                <polygon points="19,45 28,33 34,39 40,32 45,38 45,45" fill="#22c55e"></polygon>
                <polygon points="26,45 33,37 40,45" fill="#15803d"></polygon>
              </svg>
            </div>
            <span class="collaborative-element-card__text">Fotos</span>
          </button>

          <button type="button" class="collaborative-element-card" data-ref="btn-elem-charts" data-tooltip="Gráficas" aria-label="Gráficas">
            <div class="collaborative-element-card__icon-wrap">
              <svg class="collaborative-element-svg" viewBox="0 0 64 64" width="56" height="56" fill="none">
                <rect x="7" y="3" width="50" height="50" rx="14" fill="#2dd4bf" transform="rotate(3 32 28)"></rect>
                <rect x="7" y="7" width="50" height="50" rx="14" fill="#0f766e"></rect>
                <rect x="8" y="8" width="48" height="48" rx="13" fill="#14b8a6"></rect>
                <rect x="16" y="16" width="32" height="32" rx="4" fill="#ffffff" fill-opacity="0.2"></rect>
                <line x1="32" y1="18" x2="32" y2="46" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="2 2"></line>
                <path d="M 17 40 L 24 28 L 32 34 L 40 24 L 47 31 L 47 46 L 17 46 Z" fill="#c084fc" fill-opacity="0.7"></path>
                <path d="M 17 46 L 23 36 L 31 40 L 39 31 L 47 37 L 47 46 Z" fill="#9333ea" fill-opacity="0.9"></path>
                <polyline points="17,40 24,28 32,34 40,24 47,31" fill="none" stroke="#fdf4ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
                <circle cx="24" cy="28" r="2.5" fill="#ffffff"></circle>
                <circle cx="40" cy="24" r="2.5" fill="#ffffff"></circle>
              </svg>
            </div>
            <span class="collaborative-element-card__text">Gráficas</span>
          </button>
        </div>

        <div class="collaborative-drawer-subheading">
          <span class="collaborative-drawer-subheading__title">Líneas y formas</span>
        </div>
        <div class="collaborative-shapes-grid" data-ref="drawer-shapes-grid">
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-rect" data-shape="rect" data-tooltip="Cuadrado" aria-label="Cuadrado">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#crop_square"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-circle" data-shape="circle" data-tooltip="Círculo" aria-label="Círculo">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#radio_button_unchecked"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-triangle" data-shape="triangle" data-tooltip="Triángulo" aria-label="Triángulo">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#change_history"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-diamond" data-shape="diamond" data-tooltip="Rombo" aria-label="Rombo">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#diamond"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-star" data-shape="star" data-tooltip="Estrella" aria-label="Estrella">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#star"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-arrow" data-shape="arrow" data-tooltip="Flecha" aria-label="Flecha">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-cloud" data-shape="cloud" data-tooltip="Nube" aria-label="Nube">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
          </button>
          <button type="button" class="collaborative-shape-item-btn" data-ref="btn-shape-line" data-shape="line" data-tooltip="Línea recta" aria-label="Línea recta">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#horizontal_rule"></use></svg>
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
          <div class="collaborative-shapes-section">
            <span class="collaborative-shapes-section__title">Formas básicas</span>
            <div class="collaborative-shapes-grid" data-ref="shapes-grid-basic">
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-rect" data-shape="rect" data-tooltip="Cuadrado" aria-label="Cuadrado">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><rect x="2" y="2" width="36" height="36" fill="#000000"></rect></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-rounded-rect" data-shape="rounded-rect" data-tooltip="Rectángulo redondeado" aria-label="Rectángulo redondeado">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><rect x="2" y="2" width="36" height="36" rx="8" fill="#000000"></rect></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-circle" data-shape="circle" data-tooltip="Círculo" aria-label="Círculo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="18" fill="#000000"></circle></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-triangle" data-shape="triangle" data-tooltip="Triángulo" aria-label="Triángulo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 38,38 2,38" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-triangle-down" data-shape="triangle-down" data-tooltip="Triángulo invertido" aria-label="Triángulo invertido">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,2 38,2 20,38" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-diamond" data-shape="diamond" data-tooltip="Rombo" aria-label="Rombo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 38,20 20,38 2,20" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-cross" data-shape="cross" data-tooltip="Cruz" aria-label="Cruz">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="13,2 27,2 27,13 38,13 38,27 27,27 27,38 13,38 13,27 2,27 2,13 13,13" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-plaque" data-shape="plaque" data-tooltip="Placa" aria-label="Placa">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 8 Q 20 2 38 8 V 32 Q 20 38 2 32 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-scalloped-rect" data-shape="scalloped-rect" data-tooltip="Cuadrado festoneado" aria-label="Cuadrado festoneado">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 8 2 H 32 A 6 6 0 0 0 38 8 V 32 A 6 6 0 0 0 32 38 H 8 A 6 6 0 0 0 2 32 V 8 A 6 6 0 0 0 8 2 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-parallelogram-right" data-shape="parallelogram-right" data-tooltip="Paralelogramo" aria-label="Paralelogramo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="10,4 38,4 30,36 2,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-parallelogram-left" data-shape="parallelogram-left" data-tooltip="Paralelogramo invertido" aria-label="Paralelogramo invertido">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,4 30,4 38,36 10,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-trapezoid" data-shape="trapezoid" data-tooltip="Trapecio" aria-label="Trapecio">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="8,4 32,4 38,36 2,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-trapezoid-inverted" data-shape="trapezoid-inverted" data-tooltip="Trapecio invertido" aria-label="Trapecio invertido">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,4 38,4 32,36 8,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-shield" data-shape="shield" data-tooltip="Escudo" aria-label="Escudo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 4 2 H 36 V 22 C 36 34 20 38 20 38 C 20 38 4 34 4 22 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arch" data-shape="arch" data-tooltip="Arco" aria-label="Arco">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 4 38 V 18 C 4 7 36 7 36 18 V 38 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-right-triangle" data-shape="right-triangle" data-tooltip="Triángulo rectángulo" aria-label="Triángulo rectángulo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,2 2,38 38,38" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-semicircle" data-shape="semicircle" data-tooltip="Semicírculo" aria-label="Semicírculo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 34 A 18 18 0 0 1 38 34 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-quarter-circle" data-shape="quarter-circle" data-tooltip="Cuarto de círculo" aria-label="Cuarto de círculo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 38 V 2 A 36 36 0 0 1 38 38 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-quarter-circle-arc" data-shape="quarter-circle-arc" data-tooltip="Banda de cuarto de círculo" aria-label="Banda de cuarto de círculo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 38 H 16 A 22 22 0 0 1 38 16 V 2 A 36 36 0 0 0 2 38 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-semicircle-arc" data-shape="semicircle-arc" data-tooltip="Arco puente" aria-label="Arco puente">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 34 H 14 A 6 6 0 0 1 26 34 H 38 A 18 18 0 0 0 2 34 Z" fill="#000000"></path></svg>
              </button>
            </div>
          </div>

          <div class="collaborative-shapes-section">
            <span class="collaborative-shapes-section__title">Polígonos</span>
            <div class="collaborative-shapes-grid" data-ref="shapes-grid-polygons">
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-pentagon" data-shape="pentagon" data-tooltip="Pentágono" aria-label="Pentágono">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 39,15 32,38 8,38 1,15" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-hexagon-vertical" data-shape="hexagon-vertical" data-tooltip="Hexágono vertical" aria-label="Hexágono vertical">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-hexagon" data-shape="hexagon" data-tooltip="Hexágono horizontal" aria-label="Hexágono horizontal">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="10,2 30,2 39,20 30,38 10,38 1,20" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-octagon" data-shape="octagon" data-tooltip="Octógono" aria-label="Octógono">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="12,2 28,2 38,12 38,28 28,38 12,38 2,28 2,12" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-chamfered-rect" data-shape="chamfered-rect" data-tooltip="Rectángulo achaflanado" aria-label="Rectángulo achaflanado">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="7,2 33,2 38,7 38,33 33,38 7,38 2,33 2,7" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-heptagon" data-shape="heptagon" data-tooltip="Heptágono" aria-label="Heptágono">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 36,9 39,27 28,38 12,38 1,27 4,9" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-decagon" data-shape="decagon" data-tooltip="Decágono" aria-label="Decágono">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 31,5 38,14 38,26 31,35 20,38 9,35 2,26 2,14 9,5" fill="#000000"></polygon></svg>
              </button>
            </div>
          </div>

          <div class="collaborative-shapes-section">
            <span class="collaborative-shapes-section__title">Estrellas y sellos</span>
            <div class="collaborative-shapes-grid" data-ref="shapes-grid-stars">
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-4" data-shape="star-4" data-tooltip="Estrella de 4 puntas" aria-label="Estrella de 4 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 24,16 38,20 24,24 20,38 16,24 2,20 16,16" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-5" data-shape="star-5" data-tooltip="Estrella de 5 puntas" aria-label="Estrella de 5 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 24.5,14 38,15 27,24 31,38 20,29.5 9,38 13,24 2,15 15.5,14" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-6" data-shape="star-6" data-tooltip="Estrella de 6 puntas" aria-label="Estrella de 6 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 25,11 36,11 30,20 36,29 25,29 20,38 15,29 4,29 10,20 4,11 15,11" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-8" data-shape="star-8" data-tooltip="Estrella de 8 puntas" aria-label="Estrella de 8 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 24,9 33,5 31,14 38,20 31,26 33,35 24,31 20,38 16,31 7,35 9,26 2,20 9,14 7,5 16,9" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-10" data-shape="star-10" data-tooltip="Estrella de 10 puntas" aria-label="Estrella de 10 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 23,8 29,4 30,11 37,11 34,17 39,22 33,25 35,32 28,31 26,38 20,34 14,38 12,31 5,32 7,25 1,22 6,17 3,11 10,11 11,4 17,8" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-12" data-shape="star-12" data-tooltip="Estrella de 12 puntas" aria-label="Estrella de 12 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 23,7 29,4 30,10 36,9 34,15 39,17 35,22 38,26 33,28 34,34 29,33 27,38 22,35 20,38 18,35 13,38 11,33 6,34 7,28 2,26 5,22 1,17 6,15 4,9 10,10 11,4 17,7" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-16" data-shape="star-16" data-tooltip="Estrella de 16 puntas" aria-label="Estrella de 16 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 22,6 26,4 27,8 31,7 31,11 35,12 33,16 37,18 34,21 37,24 33,26 35,30 31,31 31,35 27,34 26,38 22,36 20,38 18,36 14,38 13,34 9,35 9,31 5,30 7,26 3,24 6,21 3,18 7,16 5,12 9,11 9,7 13,8 14,4 18,6" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-24" data-shape="star-24" data-tooltip="Estrella de 24 puntas" aria-label="Estrella de 24 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="18" fill="#000000" stroke-dasharray="2.35 2.35" stroke-width="4" stroke="#000000"></circle></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-32" data-shape="star-32" data-tooltip="Estrella de 32 puntas" aria-label="Estrella de 32 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="18" fill="#000000" stroke-dasharray="1.76 1.76" stroke-width="3" stroke="#000000"></circle></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-star-7" data-shape="star-7" data-tooltip="Estrella de 7 puntas" aria-label="Estrella de 7 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 23,12 34,7 30,17 39,23 29,26 31,37 22,31 18,37 20,26 10,23 19,17 15,7 26,12" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flare-8" data-shape="flare-8" data-tooltip="Destello de 8 puntas" aria-label="Destello de 8 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 21,17 32,7 22,19 38,20 22,21 32,33 21,23 20,38 19,23 8,33 18,21 2,20 18,19 8,7 19,17" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flare-10" data-shape="flare-10" data-tooltip="Destello de 10 puntas" aria-label="Destello de 10 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 21,17 29,6 23,18 36,13 24,20 38,20 24,21 36,27 23,22 29,34 21,23 20,38 19,23 11,34 17,22 4,27 16,21 2,20 16,20 4,13 17,18 11,6 19,17" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flare-12" data-shape="flare-12" data-tooltip="Destello de 12 puntas" aria-label="Destello de 12 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 21,17 27,6 22,18 33,10 23,19 37,17 24,20 38,20 24,21 37,23 23,21 33,30 22,22 27,34 21,23 20,38 19,23 13,34 18,22 7,30 17,21 3,23 16,21 2,20 16,20 3,17 17,19 7,10 18,18 13,6 19,17" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-badge-20" data-shape="badge-20" data-tooltip="Sello de 20 puntas" aria-label="Sello de 20 puntas">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><circle cx="20" cy="20" r="18" fill="#000000" stroke-dasharray="2.8 2.8" stroke-width="4.5" stroke="#000000"></circle></svg>
              </button>
            </div>
          </div>

          <div class="collaborative-shapes-section">
            <span class="collaborative-shapes-section__title">Flechas</span>
            <div class="collaborative-shapes-grid" data-ref="shapes-grid-arrows">
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-block-right" data-shape="arrow-block-right" data-tooltip="Flecha derecha" aria-label="Flecha derecha">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,13 22,13 22,3 38,20 22,37 22,27 2,27" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-block-left" data-shape="arrow-block-left" data-tooltip="Flecha izquierda" aria-label="Flecha izquierda">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="38,13 18,13 18,3 2,20 18,37 18,27 38,27" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-block-up" data-shape="arrow-block-up" data-tooltip="Flecha arriba" aria-label="Flecha arriba">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="13,38 13,18 3,18 20,2 37,18 27,18 27,38" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-block-down" data-shape="arrow-block-down" data-tooltip="Flecha abajo" aria-label="Flecha abajo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="13,2 13,22 3,22 20,38 37,22 27,22 27,2" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-double-horizontal" data-shape="arrow-double-horizontal" data-tooltip="Flecha doble horizontal" aria-label="Flecha doble horizontal">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="10,3 2,20 10,37 10,27 30,27 30,37 38,20 30,3 30,13 10,13" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-double-vertical" data-shape="arrow-double-vertical" data-tooltip="Flecha doble vertical" aria-label="Flecha doble vertical">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="3,10 20,2 37,10 27,10 27,30 37,30 20,38 3,30 13,30 13,10" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-pentagon-right" data-shape="arrow-pentagon-right" data-tooltip="Flecha pentagonal" aria-label="Flecha pentagonal">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,4 26,4 38,20 26,36 2,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-chevron-right" data-shape="arrow-chevron-right" data-tooltip="Flecha cheurón" aria-label="Flecha cheurón">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,4 26,4 38,20 26,36 2,36 14,20" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-notched-left" data-shape="arrow-notched-left" data-tooltip="Flecha con muesca" aria-label="Flecha con muesca">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="38,4 16,4 16,11 2,20 16,29 16,36 38,36 28,20" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-arrow-bidirectional-bold" data-shape="arrow-bidirectional-bold" data-tooltip="Flecha bidireccional ancha" aria-label="Flecha bidireccional ancha">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="11,6 2,20 11,34 11,26 29,26 29,34 38,20 29,6 29,14 11,14" fill="#000000"></polygon></svg>
              </button>
            </div>
          </div>

          <div class="collaborative-shapes-section">
            <span class="collaborative-shapes-section__title">Diagrama de flujo</span>
            <div class="collaborative-shapes-grid" data-ref="shapes-grid-flowchart">
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-preparation" data-shape="flowchart-preparation" data-tooltip="Preparación" aria-label="Preparación">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="9,4 31,4 38,20 31,36 9,36 2,20" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-terminator" data-shape="flowchart-terminator" data-tooltip="Terminador" aria-label="Terminador">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><rect x="2" y="7" width="36" height="26" rx="13" fill="#000000"></rect></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-process-rounded" data-shape="flowchart-process-rounded" data-tooltip="Proceso redondeado" aria-label="Proceso redondeado">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><rect x="2" y="6" width="36" height="28" rx="6" fill="#000000"></rect></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-decision" data-shape="flowchart-decision" data-tooltip="Decisión" aria-label="Decisión">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="20,2 38,20 20,38 2,20" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-document" data-shape="flowchart-document" data-tooltip="Documento" aria-label="Documento">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 4 H 38 V 28 C 30 34 26 24 18 30 C 12 34 6 30 2 32 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-data" data-shape="flowchart-data" data-tooltip="Entrada / Salida de datos" aria-label="Entrada / Salida de datos">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="9,4 38,4 31,36 2,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-manual" data-shape="flowchart-manual" data-tooltip="Operación manual" aria-label="Operación manual">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,4 38,4 32,36 8,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-delay" data-shape="flowchart-delay" data-tooltip="Retardo" aria-label="Retardo">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 2 4 H 22 A 16 16 0 0 1 22 36 H 2 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-merge" data-shape="flowchart-merge" data-tooltip="Fusión" aria-label="Fusión">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="2,4 38,4 20,36" fill="#000000"></polygon></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-display" data-shape="flowchart-display" data-tooltip="Pantalla / Tarjeta" aria-label="Pantalla / Tarjeta">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><path d="M 11 4 H 38 V 36 H 11 L 2 20 Z" fill="#000000"></path></svg>
              </button>
              <button type="button" class="collaborative-shape-card" data-ref="btn-panel-shape-flowchart-offpage" data-shape="flowchart-offpage" data-tooltip="Conector fuera de página" aria-label="Conector fuera de página">
                <svg class="collaborative-shape-card__svg" viewBox="0 0 40 40" width="32" height="32"><polygon points="4,2 36,2 36,24 20,38 4,24" fill="#000000"></polygon></svg>
              </button>
            </div>
          </div>
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
          <div class="collaborative-colors-grid collaborative-colors-grid--actions" data-ref="grid-category-colors">
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--gradient-picker" data-ref="btn-color-custom-picker" data-tooltip="Color personalizado" aria-label="Color personalizado">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            </button>
            <button type="button" class="collaborative-color-swatch collaborative-color-swatch--eyedropper" data-ref="btn-color-eyedropper" data-tooltip="Gotero con zoom" aria-label="Gotero con zoom">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#colorize"></use></svg>
            </button>
          </div>
          <div class="collaborative-colors-grid collaborative-colors-grid--recent is-hidden" data-ref="grid-recent-colors"></div>
        </div>

        <div class="collaborative-color-section">
          <span class="collaborative-color-section__title">Colores sólidos</span>
          <div class="collaborative-colors-grid" data-ref="grid-solid-colors">
            ${solidColorSwatches}
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

            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)" data-tooltip="Melocotón suave" aria-label="Melocotón suave" style="background-image: linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" data-tooltip="Pétalo de rosa" aria-label="Pétalo de rosa" style="background-image: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #2af598 0%, #009efd 100%)" data-tooltip="Resplandor turquesa" aria-label="Resplandor turquesa" style="background-image: linear-gradient(135deg, #2af598 0%, #009efd 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #f12711 0%, #f5af19 100%)" data-tooltip="Fuego" aria-label="Fuego" style="background-image: linear-gradient(135deg, #f12711 0%, #f5af19 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #b3ffab 0%, #12fff7 100%)" data-tooltip="Aurora boreal" aria-label="Aurora boreal" style="background-image: linear-gradient(135deg, #b3ffab 0%, #12fff7 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)" data-tooltip="Crepúsculo" aria-label="Crepúsculo" style="background-image: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);"></button>
            <button type="button" class="collaborative-color-swatch" data-ref="swatch-color" data-color="linear-gradient(135deg, #232526 0%, #414345 100%)" data-tooltip="Grafito" aria-label="Grafito" style="background-image: linear-gradient(135deg, #232526 0%, #414345 100%);"></button>
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

    <div class="collaborative-panel-section is-hidden" data-ref="panel-section-uploads">
      <div class="collaborative-uploads-main" data-ref="uploads-main-view">
        <button type="button" class="component-button component-button--black component-button--h44 component-button--w-full" data-ref="btn-upload-file">
          <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#upload"></use></svg>
          <span class="component-button__text">Subir archivos</span>
        </button>
        <input class="is-hidden" data-ref="input-file-upload" type="file" accept="image/*,.pdf,application/pdf" multiple style="display: none;" />

        <div class="collaborative-upload-tabs" data-ref="upload-tabs">
          <button type="button" class="collaborative-upload-tab is-active" data-ref="tab-upload-all" data-tab="all">Todos</button>
          <button type="button" class="collaborative-upload-tab" data-ref="tab-upload-images" data-tab="images">Imágenes</button>
          <button type="button" class="collaborative-upload-tab" data-ref="tab-upload-pdfs" data-tab="pdfs">PDFs</button>
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
          <button type="button" class="component-button component-button--ghost component-button--h36 component-button--w-full is-disabled" data-ref="btn-embed-design" disabled data-tooltip="Próximamente">
            <svg class="component-icon component-button__icon-left" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            <span class="component-button__text">Incrustar diseño</span>
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
        <div class="component-toggle-pill component-toggle-pill--2" data-ref="chart-tabs-toggle" data-active="0">
          <div class="component-toggle-pill-glider"></div>
          <button type="button" class="component-button is-active" data-ref="btn-tab-chart-data">Datos</button>
          <button type="button" class="component-button" data-ref="btn-tab-chart-customize">Personalizar</button>
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
