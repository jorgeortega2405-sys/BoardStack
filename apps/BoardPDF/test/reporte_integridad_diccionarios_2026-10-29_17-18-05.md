# Reporte de Verificación: Integridad de Diccionarios de Traducción (i18n)
**Fecha y Hora de Generación:** 29/10/2026 17:18:05

> [!IMPORTANT]
> **AVISO DE AUDITORÍA Y EVALUACIÓN DE FALSOS POSITIVOS**:
> Este informe recopila detecciones automáticas de código. Sin embargo, en un entorno de producción **siempre existirán falsos positivos legítimos** (por ejemplo: `--layout-scroll-height: 3021px;` que debe ir inline para el cálculo reactivo del layout, o valores de posicionamiento en transformaciones de lienzo, marcas y términos técnicos que no admiten traducción).
> 
> **Antes de aplicar correcciones automáticas o manuales, la Inteligencia Artificial o el desarrollador debe revisar cuidadosamente cada hallazgo** para determinar si efectivamente se puede y debe eliminar el CSS inline, si requiere clave de traducción, o si debe mantenerse intacto.

## Resumen Ejecutivo
Se analizó la coherencia e integridad de los diccionarios de traducción en `public/translations/es/` contrastados con las llamadas en plantillas HTML y módulos TypeScript del cliente.

- **Total de claves traducidas en JSON:** 959
- **Claves requeridas en código:** 250
- **Claves faltantes (referenciadas pero no definidas en español):** 1
- **Claves huérfanas en diccionarios (definidas sin referencia directa):** 710

Esta verificación previene que los usuarios visualicen claves en crudo como fallback o que existan recursos innecesarios en los paquetes de idioma.

## Métricas Principales
| Parámetro | Valor |
| :--- | :--- |
| Claves activas en JSON | 959 |
| Claves referenciadas en código | 250 |
| Claves faltantes en JSON | 1 |
| Claves huérfanas en diccionarios | 710 |
| Integridad de diccionarios | 1 claves faltantes |

## Claves Faltantes en Diccionarios de Idioma
| Clave Faltante | Archivo Referenciado | Línea | Usos |
| :--- | :--- | :---: | :---: |
| `nav.faq` | `client/components/layout.component.ts` | 313 | 1 |

## Claves Huérfanas en Diccionario (Sin Uso Directo)
| Clave en Diccionario | Módulo |
| :--- | :--- |
| `ai.greeting` | `ai` |
| `ai.input_placeholder` | `ai` |
| `ai.new_chat` | `ai` |
| `ai.send` | `ai` |
| `app.loading` | `app` |
| `app.name` | `app` |
| `app.tagline` | `app` |
| `common.back` | `common` |
| `common.save` | `common` |
| `common.search_tools` | `common` |
| `cookies.banner_desc` | `cookies` |
| `cookies.banner_title` | `cookies` |
| `cookies.last_updated` | `cookies` |
| `cookies.section1_text` | `cookies` |
| `cookies.section1_title` | `cookies` |
| `cookies.section2_text` | `cookies` |
| `cookies.section2_title` | `cookies` |
| `cookies.section3_text` | `cookies` |
| `cookies.section3_title` | `cookies` |
| `cookies.section4_text` | `cookies` |
| `cookies.section4_title` | `cookies` |
| `cookies.section5_text` | `cookies` |
| `cookies.section5_title` | `cookies` |
| `cookies.section6_text` | `cookies` |
| `cookies.section6_title` | `cookies` |
| `cookies.subtitle` | `cookies` |
| `cookies.table_header_category` | `cookies` |
| `cookies.table_header_domain` | `cookies` |
| `cookies.table_header_duration` | `cookies` |
| `cookies.table_header_name` | `cookies` |
| `cookies.table_header_purpose` | `cookies` |
| `cookies.table_row1_category` | `cookies` |
| `cookies.table_row1_domain` | `cookies` |
| `cookies.table_row1_duration` | `cookies` |
| `cookies.table_row1_name` | `cookies` |
| `cookies.table_row1_purpose` | `cookies` |
| `cookies.table_row2_category` | `cookies` |
| `cookies.table_row2_domain` | `cookies` |
| `cookies.table_row2_duration` | `cookies` |
| `cookies.table_row2_name` | `cookies` |

---
*Reporte generado automáticamente por la Suite de Pruebas de BoardPDF.*
