# Reporte de Auditoría: Código CSS Inline en HTML y TypeScript
**Fecha y Hora de Generación:** 29/10/2026 17:17:57

> [!IMPORTANT]
> **AVISO DE AUDITORÍA Y EVALUACIÓN DE FALSOS POSITIVOS**:
> Este informe recopila detecciones automáticas de código. Sin embargo, en un entorno de producción **siempre existirán falsos positivos legítimos** (por ejemplo: `--layout-scroll-height: 3021px;` que debe ir inline para el cálculo reactivo del layout, o valores de posicionamiento en transformaciones de lienzo, marcas y términos técnicos que no admiten traducción).
> 
> **Antes de aplicar correcciones automáticas o manuales, la Inteligencia Artificial o el desarrollador debe revisar cuidadosamente cada hallazgo** para determinar si efectivamente se puede y debe eliminar el CSS inline, si requiere clave de traducción, o si debe mantenerse intacto.

## Resumen Ejecutivo
Se auditó la presencia de estilos CSS inline en **35 archivos HTML** y **92 archivos TypeScript**.

- **Violaciones estáticas (requieren corrección / clase CSS):** 0
- **Estilos dinámicos calculados (falsos positivos justificados):** 163

Bajo la arquitectura de diseño de BoardPDF, ningún elemento HTML debe portar atributos `style="..."` estáticos, y el código cliente sólo debe mutar estilos inline cuando intervienen coordenadas o variables dinámicas reactivas (ej. `--layout-scroll-height`, zoom, transformaciones matriciales de lienzo o porcentajes de carga).

## Métricas Principales
| Parámetro | Valor |
| :--- | :--- |
| Archivos HTML analizados | 35 |
| Archivos TypeScript analizados | 92 |
| Total mutaciones inline evaluadas | 163 |
| Violaciones estáticas a corregir | 0 |
| Falsos positivos dinámicos validados | 163 |
| Cumplimiento arquitectónico | 100% Conforme |

## Violaciones de CSS Inline Estático Detectadas
Excelente: **0 violaciones estáticas encontradas**. Todos los estilos estáticos residen debidamente en clases CSS modulares.

## Estilos Dinámicos Reactivos Validados (Falsos Positivos Legítimos)
| Archivo | Línea | Propiedad | Valor Dinámico | Justificación Técnica (Falso Positivo) |
| :--- | :--- | :--- | :--- | :--- |
| `client/components/layout.component.ts` | 549 | `setProperty('--layout-scroll-height')` | ``${neededHeight}px`` | Variable CSS reactiva requerida para cálculo dinámico del layout scroll |
| `client/components/modal.component.ts` | 54 | `setProperty('transition')` | `'none', 'important'` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/components/modal.component.ts` | 67 | `setProperty('transform')` | ``translateY(${diff}px` | Transformación geométrica interactiva (rotación/traslación/zoom) |
| `client/components/modal.component.ts` | 69 | `setProperty('transform')` | `'translateY(0` | Transformación geométrica interactiva (rotación/traslación/zoom) |
| `client/components/modal.component.ts` | 96 | `setProperty('transition')` | `'transform 0.22s cubic-bezier(0.16, 1, 0` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/components/modal.component.ts` | 97 | `setProperty('transform')` | `'translateY(100%` | Transformación geométrica interactiva (rotación/traslación/zoom) |
| `client/components/modal.component.ts` | 98 | `setProperty('transition')` | `'opacity 0.22s ease', 'important'` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/components/modal.component.ts` | 99 | `setProperty('opacity')` | `'0', 'important'` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/components/modal.component.ts` | 108 | `setProperty('transition')` | `'transform 0.25s cubic-bezier(0.16, 1, 0` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/components/modal.component.ts` | 109 | `setProperty('transform')` | `'translateY(0` | Transformación geométrica interactiva (rotación/traslación/zoom) |
| `client/components/tool-status.component.ts` | 162 | `width` | `'0%'` | Barra de progreso reactiva con porcentaje de avance dinámico |
| `client/components/tool-status.component.ts` | 196 | `width` | `'100%'` | Barra de progreso reactiva con porcentaje de avance dinámico |
| `client/components/tool-status.component.ts` | 209 | `width` | ``${info.percent}%`` | Barra de progreso reactiva con porcentaje de avance dinámico |
| `client/components/tool-status.component.ts` | 243 | `width` | `'100%'` | Barra de progreso reactiva con porcentaje de avance dinámico |
| `client/utils/dom.util.ts` | 332 | `width` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 333 | `minWidth` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 342 | `width` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 343 | `minWidth` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 371 | `width` | `w` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 372 | `minWidth` | `w` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 464 | `width` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 595 | `display` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 596 | `opacity` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 597 | `transition` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 598 | `pointerEvents` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 601 | `transform` | `''` | Limpieza / reset dinámico de estilos inline |
| `client/utils/dom.util.ts` | 602 | `transition` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 678 | `transform` | `''` | Limpieza / reset dinámico de estilos inline |
| `client/utils/dom.util.ts` | 679 | `transition` | `''` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 706 | `transition` | `'none'` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 714 | `transform` | ``translateY(${diff}px)`` | Transformación geométrica interactiva (rotación/traslación/zoom) |
| `client/utils/dom.util.ts` | 730 | `transition` | `'transform 0.2s cubic-bezier(0.16, 1, 0.` | Animación y transición modular de modal / dropdown / utilidades DOM |
| `client/utils/dom.util.ts` | 731 | `transform` | `''` | Limpieza / reset dinámico de estilos inline |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 339 | `opacity` | ``${this.overlayOpacity}`` | Opacidad dinámica reactiva controlada por slider comparativo |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 341 | `opacity` | `'1'` | Opacidad dinámica reactiva controlada por slider comparativo |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 570 | `width` | ``${displayWidth}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 571 | `height` | ``${displayHeight}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 578 | `width` | ``${displayWidth}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 579 | `height` | ``${displayHeight}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 621 | `width` | ``${displayWidth}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 622 | `height` | ``${displayHeight}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 629 | `width` | ``${displayWidth}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compare-pdf/compare-pdf.view.ts` | 630 | `height` | ``${displayHeight}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compress-pdf/compress-pdf.view.ts` | 281 | `width` | ``${viewport.width}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/compress-pdf/compress-pdf.view.ts` | 282 | `height` | ``${viewport.height}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 296 | `left` | ``${x}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 297 | `top` | ``${y}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 298 | `width` | ``${width}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 299 | `height` | ``${height}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 301 | `height` | ``${y}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 302 | `top` | ``${y + height}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 303 | `height` | ``${100 - (y + height)}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 305 | `top` | ``${y}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 306 | `height` | ``${height}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 307 | `width` | ``${x}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 309 | `top` | ``${y}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 310 | `height` | ``${height}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 311 | `left` | ``${x + width}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/crop-pdf/crop-pdf.view.ts` | 312 | `width` | ``${100 - (x + width)}%`` | Coordenadas porcentuales del marco de recorte interactivo |
| `client/views/tools/edit-pdf/edit-pdf.view.ts` | 447 | `width` | ``${vp.width}px`` | Dimensión dinámica de lienzo / canvas calculada en tiempo de ejecución |

## Criterios de Corrección y Manejo de Falsos Positivos
> [!TIP]
> **Caso Especial `--layout-scroll-height`**: Esta variable CSS es calculada en JavaScript para sincronizar la altura del contenedor de visualización virtual con la altura real de páginas del PDF. **Bajo ninguna circunstancia debe eliminarse**.

1. Si un hallazgo estático fue detectado, extráigalo a una clase BEM en `public/css/components/` o `public/css/tools/`.
2. Si el estilo depende de cálculos en tiempo de ejecución (ancho de ventana, coordenadas X/Y del cursor, rotación), es legítimo y debe conservarse.

---
*Reporte generado automáticamente por la Suite de Pruebas de BoardPDF.*
