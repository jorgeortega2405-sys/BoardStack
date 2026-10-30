# Reporte de Auditoría: Selectores CSS Huérfanos y Código Muerto
**Fecha y Hora de Generación:** 29/10/2026 17:55:10

> [!IMPORTANT]
> **AVISO DE AUDITORÍA Y EVALUACIÓN DE FALSOS POSITIVOS**:
> Este informe recopila detecciones automáticas de código. Sin embargo, en un entorno de producción **siempre existirán falsos positivos legítimos** (por ejemplo: `--layout-scroll-height: 3021px;` que debe ir inline para el cálculo reactivo del layout, o valores de posicionamiento en transformaciones de lienzo, marcas y términos técnicos que no admiten traducción).
> 
> **Antes de aplicar correcciones automáticas o manuales, la Inteligencia Artificial o el desarrollador debe revisar cuidadosamente cada hallazgo** para determinar si efectivamente se puede y debe eliminar el CSS inline, si requiere clave de traducción, o si debe mantenerse intacto.

## Resumen Ejecutivo
Se auditó el código CSS en las **10 hojas de estilo principales** de BoardPDF comparándolo contra **35 archivos HTML** y **92 archivos TypeScript**.

- **Total de selectores de clase CSS evaluados:** 1016
- **Selectores huérfanos / código muerto:** 69
- **Selectores dinámicos validados (BEM / JS Estados):** 10

Esta prueba asegura que las hojas de estilo permanezcan ligeras, libres de estilos obsoletos y con 100% de coherencia con el diseño de la aplicación.

## Métricas Principales
| Parámetro | Valor |
| :--- | :--- |
| Hojas de estilo CSS analizadas | 10 |
| Total clases CSS declaradas | 1016 |
| Selectores activos en uso | 947 |
| Selectores huérfanos (código muerto) | 69 |
| Selectores dinámicos interactivos (whitelist) | 10 |
| Estado del código CSS | 69 selectores no utilizados |

## Selectores Huérfanos Detectados (Código Muerto)
| Hoja de Estilo CSS | Selector de Clase | Diagnóstico |
| :--- | :--- | :--- |
| `public/css/components/component-buttons.css` | `.active` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-buttons.css` | `.card__body` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-buttons.css` | `.component-button--icon` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-buttons.css` | `.footer-note` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-feedback.css` | `.active` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-forms.css` | `.badge--danger` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-forms.css` | `.card__header` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-forms.css` | `.card__title` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-forms.css` | `.field-group` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-forms.css` | `.field-group--mb12` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-layout.css` | `.drawer-section` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-layout.css` | `.layout-wrapper` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-layout.css` | `.no-padding` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-views.css` | `.about-card` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/components/component-views.css` | `.faq-pill` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.crop-mode-radios` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.crop-radio-input` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.crop-radio-label` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.crop-reset-row` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.pdf-viewer-toolbar` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.pn-pos-and-margin__col` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.pn-pos-and-margin__col--flex` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.security-doc-card` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.tool-dropzone` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.tool-sidebar__actions-stack` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.tool-sidebar__section-header` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.wm-checkbox-input` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.wm-checkbox-label` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.wm-column-gap6` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.wm-mosaic-column` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-base.css` | `.wm-pos-and-mosaic` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.is-pos-center` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pdf-repair-info-box` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pdf-repair-info-box__item` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pn-checkbox-input` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pn-checkbox-label` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pn-mode-radios` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pn-pos-and-margin` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pn-radio-input` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.pn-radio-label` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.rotate-card-btn` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.rotate-page-card__actions` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.split-tab` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.wm-layer-card` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.wm-layers-group` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.wm-tab-btn` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-grid.css` | `.wm-tabs` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.crop-page-nav` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--black` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--blue` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--fill-blue` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--fill-red` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--fill-transparent` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--fill-white` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--fill-yellow` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--green` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--purple` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--red` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--white` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatch--yellow` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-color-swatches` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-editor-mode-btn` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-editor-mode-switcher` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-font-size-btn` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.pdf-font-size-options` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.redact-mode-switcher` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.redact-thumbnail__censor-pill` | No se encontró referencia en ninguna vista HTML ni script TypeScript |
| `public/css/tools/tool-viewer.css` | `.tool-preview__page-info` | No se encontró referencia en ninguna vista HTML ni script TypeScript |

## Clases Dinámicas de Interacción Validadas (Whitelist)
| Hoja de Estilo CSS | Clase Dinámica | Justificación |
| :--- | :--- | :--- |
| `public/css/components/component-overlays.css` | `.modal-card--sm` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/components/component-views.css` | `.contact-ticket-msg--agent` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/components/component-views.css` | `.contact-ticket-msg--customer` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/components/component-views.css` | `.contact-ticket-status-badge--open` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/components/component-views.css` | `.contact-ticket-status-badge--resolved` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/components/component-views.css` | `.contact-ticket-status-badge--waiting` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/tools/tool-grid.css` | `.is-pos-bottom-center` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/tools/tool-grid.css` | `.is-pos-center-left` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/tools/tool-grid.css` | `.is-pos-center-right` | Selector dinámico / BEM de estado permitido por whitelist |
| `public/css/tools/tool-grid.css` | `.is-pos-top-center` | Selector dinámico / BEM de estado permitido por whitelist |

---
*Reporte generado automáticamente por la Suite de Pruebas de BoardPDF.*
