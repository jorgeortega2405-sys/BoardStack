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

export function createCollaborativeDrawerElement(): HTMLElement {
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
  </div>
  `;
  return drawer;
}
