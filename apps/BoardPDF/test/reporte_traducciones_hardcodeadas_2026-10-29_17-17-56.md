# Reporte de Auditoría: Textos Hardcodeados sin Clave de Traducción (i18n)
**Fecha y Hora de Generación:** 29/10/2026 17:17:56

> [!IMPORTANT]
> **AVISO DE AUDITORÍA Y EVALUACIÓN DE FALSOS POSITIVOS**:
> Este informe recopila detecciones automáticas de código. Sin embargo, en un entorno de producción **siempre existirán falsos positivos legítimos** (por ejemplo: `--layout-scroll-height: 3021px;` que debe ir inline para el cálculo reactivo del layout, o valores de posicionamiento en transformaciones de lienzo, marcas y términos técnicos que no admiten traducción).
> 
> **Antes de aplicar correcciones automáticas o manuales, la Inteligencia Artificial o el desarrollador debe revisar cuidadosamente cada hallazgo** para determinar si efectivamente se puede y debe eliminar el CSS inline, si requiere clave de traducción, o si debe mantenerse intacto.

## Resumen Ejecutivo
Se realizó una auditoría exhaustiva sobre **35 archivos HTML** y **92 archivos TypeScript** del cliente de BoardPDF.

- **Hallazgos sospechosos de texto hardcodeado:** 988
- **Falsos positivos analizados y catalogados:** 5

La arquitectura del proyecto requiere que todo texto visible en plantillas utilice atributos `data-i18n`, `data-i18n-placeholder`, `data-i18n-tooltip` o funciones `t('clave')` en TypeScript.

## Métricas Principales
| Parámetro | Valor |
| :--- | :--- |
| Archivos HTML analizados | 35 |
| Archivos TypeScript cliente analizados | 92 |
| Total de elementos revisados | 993 |
| Posibles textos hardcodeados a revisar | 988 |
| Falsos positivos técnicos identificados | 5 |
| Estado de la prueba | Advertencias detectadas |

## Detecciones de Texto sin Clave de Traducción
| Archivo | Línea | Tipo | Elemento | Texto Detectado | Motivo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public/views/about/about.html` | 8 | Texto visible en etiqueta | `<span>` | Nuestra Historia | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 10 | Texto visible en etiqueta | `<h1>` | Hacer la gestión de documentos simple, rápida y universal | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 11 | Texto visible en etiqueta | `<p>` | BoardPDF nació de una convicción clara: nadie debería perder horas peleando con software pesado, lic | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 17 | Texto visible en etiqueta | `<h2>` | El Origen: Cuando el software tradicional se convirtió en un obstáculo | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 19 | Texto visible en etiqueta | `<p>` | Todos nos hemos encontrado en la misma situación: la necesidad urgente de unir dos contratos antes d | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 20 | Texto visible en etiqueta | `<p>` | En respuesta a esta necesidad, nació BoardPDF en 2024. El objetivo fundacional fue contundente: cons | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 25 | Texto visible en etiqueta | `<h2>` | La Evolución: De herramientas esenciales a Inteligencia Documental | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 27 | Texto visible en etiqueta | `<p>` | Lo que comenzó como una solución limpia y eficiente para fusionar y dividir documentos PDF evolucion | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 28 | Texto visible en etiqueta | `<p>` | Rápidamente expandimos nuestras capacidades para incluir motores de conversión bidireccional de Offi | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 33 | Texto visible en etiqueta | `<h2>` | Nuestros Pilares Innegociables | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 35 | Texto visible en etiqueta | `<p>` | Cada función que diseñamos, cada línea de código que escribimos y cada mejora que implementamos en B | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 41 | Texto visible en etiqueta | `<h3>` | Privacidad y Cero Retención | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 42 | Texto visible en etiqueta | `<p>` | Tus archivos te pertenecen únicamente a ti. Viajan bajo túneles cifrados TLS 1.3 con AES-256 y se el | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 49 | Texto visible en etiqueta | `<h3>` | Fidelidad y Rendimiento | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 50 | Texto visible en etiqueta | `<p>` | Preservamos tipografías, tablas, capas vectoriales y márgenes con máxima precisión visual. Diseñamos | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 57 | Texto visible en etiqueta | `<h3>` | Simplicidad Universal | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 58 | Texto visible en etiqueta | `<p>` | Sin instalaciones ni barreras. Una interfaz intuitiva y accesible que funciona en cualquier disposit | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 65 | Texto visible en etiqueta | `<h2>` | Hacia el Futuro | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 67 | Texto visible en etiqueta | `<p>` | Creemos firmemente que el software moderno debe adaptarse a las personas, ahorrándoles tiempo para l | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 68 | Texto visible en etiqueta | `<p>` | Gracias por elegir BoardPDF como tu espacio de trabajo para documentos digitales. Nuestra historia c | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 72 | Texto visible en etiqueta | `<h2>` | Descubre todo lo que puedes lograr con BoardPDF | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 73 | Texto visible en etiqueta | `<p>` | Comienza gratis hoy mismo y experimenta una nueva forma de trabajar con tus documentos PDF. | Texto en lenguaje natural sin data-i18n |
| `public/views/about/about.html` | 75 | Texto visible en etiqueta | `<a>` | Explorar herramientas | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 8 | Texto visible en etiqueta | `<span>` | Atención y Soporte | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 10 | Texto visible en etiqueta | `<h1>` | ¿En qué podemos ayudarte? | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 11 | Texto visible en etiqueta | `<p>` | Envíanos tu mensaje, consulta técnica o solicitud corporativa. Nuestro equipo te responderá en menos | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 16 | Texto visible en etiqueta | `<h2>` | Envíanos un mensaje | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 17 | Texto visible en etiqueta | `<p>` | Completa el formulario y nos pondremos en contacto contigo lo antes posible. | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 22 | Texto visible en etiqueta | `<span>` | Nombre completo | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 27 | Texto visible en etiqueta | `<span>` | Correo electrónico | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 31 | Atributo aria-label | `<button aria-label="..." >` | Asunto de la consulta | Atributo aria-label sin data-i18n-aria |
| `public/views/contact/contact.html` | 34 | Texto visible en etiqueta | `<span>` | Selecciona un asunto | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 46 | Texto visible en etiqueta | `<span>` | Consultas generales | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 50 | Texto visible en etiqueta | `<span>` | Soporte técnico y problemas con herramientas | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 54 | Texto visible en etiqueta | `<span>` | Seguridad y Privacidad (GDPR) | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 58 | Texto visible en etiqueta | `<span>` | Sugerencia de nueva función | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 68 | Texto visible en etiqueta | `<span>` | Describe tu consulta con detalle... | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 75 | Texto visible en etiqueta | `<span>` | Enviar mensaje | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 87 | Texto visible en etiqueta | `<span>` | Abierto | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 89 | Texto visible en etiqueta | `<h2>` | Cargando incidencia... | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 90 | Texto visible en etiqueta | `<p>` | Iniciada por | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 98 | Texto visible en etiqueta | `<span>` | Escribe tu respuesta a soporte... | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 103 | Texto visible en etiqueta | `<span>` | Enviar respuesta | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 106 | Texto visible en etiqueta | `<span>` | Nueva consulta | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 114 | Texto visible en etiqueta | `<div>` | Este ticket ha sido resuelto y cerrado. Si necesitas asistencia adicional, por favor crea una . | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 114 | Texto visible en etiqueta | `<a>` | nueva consulta | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 125 | Texto visible en etiqueta | `<h3>` | Soporte Técnico | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 126 | Texto visible en etiqueta | `<a>` | soporte@boardpdf.app | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 127 | Texto visible en etiqueta | `<p>` | Dudas técnicas, incidencias de conversión y asistencia en herramientas. | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 136 | Texto visible en etiqueta | `<h3>` | Privacidad y Legal | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 137 | Texto visible en etiqueta | `<a>` | privacidad@boardpdf.app | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 138 | Texto visible en etiqueta | `<p>` | Consultas sobre protección de datos personales, RGPD y seguridad. | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 144 | Texto visible en etiqueta | `<h3>` | ¿Buscas una solución inmediata? | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 145 | Texto visible en etiqueta | `<p>` | Las preguntas más comunes sobre límites de tamaño, seguridad de archivos y planes ya están respondid | Texto en lenguaje natural sin data-i18n |
| `public/views/contact/contact.html` | 146 | Texto visible en etiqueta | `<a>` | Consultar Preguntas Frecuentes | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 6 | Texto visible en etiqueta | `<h1>` | ¡Tu archivo está listo para descargar! | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 7 | Texto visible en etiqueta | `<p>` | El proceso se ha completado con éxito y tu documento está listo para descargar. | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 12 | Texto visible en etiqueta | `<span>` | Descargar PDF | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 15 | Atributo data-tooltip | `<button data-tooltip="..." >` | Google Drive | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/download-ready/download-ready.html` | 15 | Atributo aria-label | `<button aria-label="..." >` | Google Drive | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 18 | Atributo data-tooltip | `<button data-tooltip="..." >` | Dropbox | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/download-ready/download-ready.html` | 18 | Atributo aria-label | `<button aria-label="..." >` | Dropbox | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 21 | Atributo data-tooltip | `<button data-tooltip="..." >` | Copiar enlace de descarga | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/download-ready/download-ready.html` | 21 | Atributo aria-label | `<button aria-label="..." >` | Copiar enlace de descarga | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 24 | Atributo data-tooltip | `<button data-tooltip="..." >` | Eliminar ahora | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/download-ready/download-ready.html` | 24 | Atributo aria-label | `<button aria-label="..." >` | Eliminar ahora | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 34 | Texto visible en etiqueta | `<h2>` | Continuar a... | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 41 | Texto visible en etiqueta | `<h3>` | ¿Cómo nos puedes dar las gracias? ¡Haz correr la voz! | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 42 | Texto visible en etiqueta | `<p>` | Por favor, comparte la herramienta para inspirar a más personas productivas. | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 44 | Atributo aria-label | `<button aria-label="..." >` | Trustpilot | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 44 | Texto visible en etiqueta | `<span>` | Trustpilot | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 51 | Atributo aria-label | `<button aria-label="..." >` | Facebook | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 51 | Texto visible en etiqueta | `<span>` | Facebook | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 57 | Atributo aria-label | `<button aria-label="..." >` | Twitter (X) | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 57 | Texto visible en etiqueta | `<span>` | Twitter (X) | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 63 | Atributo aria-label | `<button aria-label="..." >` | LinkedIn | Atributo aria-label sin data-i18n-aria |
| `public/views/download-ready/download-ready.html` | 63 | Texto visible en etiqueta | `<span>` | LinkedIn | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 82 | Texto visible en etiqueta | `<span>` | Enlace caducado | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 83 | Texto visible en etiqueta | `<h1>` | Enlace no disponible o caducado | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 84 | Texto visible en etiqueta | `<p>` | El archivo ya no está disponible en nuestro servidor o el enlace ha caducado. Por razones de segurid | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 88 | Texto visible en etiqueta | `<span>` | Volver al inicio | Texto en lenguaje natural sin data-i18n |
| `public/views/download-ready/download-ready.html` | 92 | Texto visible en etiqueta | `<span>` | Ver herramientas | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 6 | Texto visible en etiqueta | `<span>` | Board | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 37 | Texto visible en etiqueta | `<h2>` | El software PDF en el que confían millones de usuarios | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 38 | Texto visible en etiqueta | `<p>` | BoardPDF es tu aplicación web para gestionar y editar archivos PDF fácilmente. Disfruta de todas las | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 43 | Texto visible en etiqueta | `<span>` | ISO 27001 | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 44 | Texto visible en etiqueta | `<span>` | Seguridad de la Información | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 50 | Texto visible en etiqueta | `<span>` | SECURE SSL | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 51 | Texto visible en etiqueta | `<span>` | Cifrado de 256 bits | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 57 | Texto visible en etiqueta | `<span>` | PDF Association | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 58 | Texto visible en etiqueta | `<span>` | Estándar Internacional | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 6 | Texto visible en etiqueta | `<text>` | Board | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 14 | Texto visible en etiqueta | `<p>` | Herramientas inteligentes, rápidas y seguras para potenciar tu productividad con documentos PDF. | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 87 | Texto visible en etiqueta | `<h4>` | Producto | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 90 | Texto visible en etiqueta | `<a>` | Inicio | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 93 | Texto visible en etiqueta | `<a>` | Preguntas frecuentes | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 99 | Texto visible en etiqueta | `<h4>` | Legal | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 25 | Texto visible en etiqueta | `<a>` | Seguridad | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 105 | Texto visible en etiqueta | `<a>` | Política de Privacidad | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 108 | Texto visible en etiqueta | `<a>` | Términos y Condiciones | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 111 | Texto visible en etiqueta | `<a>` | Cookies | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 117 | Texto visible en etiqueta | `<h4>` | Empresa | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 120 | Texto visible en etiqueta | `<a>` | Sobre nosotros | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 123 | Texto visible en etiqueta | `<a>` | Contacto | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 132 | Atributo aria-label | `<button aria-label="..." >` | Seleccionar idioma | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 135 | Texto visible en etiqueta | `<span>` | Español | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 147 | Atributo placeholder | `<input placeholder="..." >` | Buscar idioma... | Atributo placeholder sin data-i18n-placeholder |
| `public/views/home/home.html` | 150 | Texto visible en etiqueta | `<div>` | No se encontraron idiomas | Texto en lenguaje natural sin data-i18n |
| `public/views/home/home.html` | 158 | Atributo aria-label | `<a aria-label="..." >` | X (Twitter) | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 163 | Atributo aria-label | `<a aria-label="..." >` | Facebook | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 168 | Atributo aria-label | `<a aria-label="..." >` | LinkedIn | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 173 | Atributo aria-label | `<a aria-label="..." >` | Instagram | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 178 | Atributo aria-label | `<a aria-label="..." >` | TikTok | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 183 | Atributo aria-label | `<a aria-label="..." >` | Reddit | Atributo aria-label sin data-i18n-aria |
| `public/views/home/home.html` | 189 | Texto visible en etiqueta | `<span>` | © BoardPDF 2026 ® - Tu editor de PDF | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 5 | Atributo data-tooltip | `<button data-tooltip="..." >` | Sincronizar desplazamiento | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 5 | Atributo aria-label | `<button aria-label="..." >` | Sincronizar desplazamiento | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 11 | Texto visible en etiqueta | `<span>` | Similitud: | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 26 | Texto visible en etiqueta | `<h1>` | Comparar PDF | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 27 | Texto visible en etiqueta | `<p>` | Compara dos archivos PDF uno al lado del otro, detecta cambios de texto semántico y visualiza difere | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 31 | Texto visible en etiqueta | `<span>` | Seleccionar Primer PDF | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 34 | Atributo data-tooltip | `<button data-tooltip="..." >` | Google Drive | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 34 | Atributo aria-label | `<button aria-label="..." >` | Google Drive | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 37 | Atributo data-tooltip | `<button data-tooltip="..." >` | Dropbox | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 37 | Atributo aria-label | `<button aria-label="..." >` | Dropbox | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 43 | Texto visible en etiqueta | `<p>` | o arrastra y suelta el PDF aquí para comenzar la comparación | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 50 | Atributo data-tooltip | `<button data-tooltip="..." >` | Quitar archivo antiguo | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 50 | Atributo aria-label | `<button aria-label="..." >` | Quitar archivo | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 59 | Atributo data-tooltip | `<button data-tooltip="..." >` | Reducir zoom | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 59 | Atributo aria-label | `<button aria-label="..." >` | Reducir zoom | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 63 | Atributo data-tooltip | `<button data-tooltip="..." >` | Aumentar zoom | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 63 | Atributo aria-label | `<button aria-label="..." >` | Aumentar zoom | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 67 | Texto visible en etiqueta | `<span>` | documento_1.pdf | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 76 | Atributo data-tooltip | `<button data-tooltip="..." >` | Quitar archivo nuevo | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 50 | Atributo aria-label | `<button aria-label="..." >` | Quitar archivo | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 83 | Texto visible en etiqueta | `<p>` | Arrastra y suelta aquí el segundo PDF | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 86 | Texto visible en etiqueta | `<span>` | Seleccionar archivo | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 34 | Atributo data-tooltip | `<button data-tooltip="..." >` | Google Drive | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 34 | Atributo aria-label | `<button aria-label="..." >` | Google Drive | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 37 | Atributo data-tooltip | `<button data-tooltip="..." >` | Dropbox | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 37 | Atributo aria-label | `<button aria-label="..." >` | Dropbox | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 59 | Atributo data-tooltip | `<button data-tooltip="..." >` | Reducir zoom | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 59 | Atributo aria-label | `<button aria-label="..." >` | Reducir zoom | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 63 | Atributo data-tooltip | `<button data-tooltip="..." >` | Aumentar zoom | Atributo data-tooltip sin data-i18n-tooltip |
| `public/views/tools/compare-pdf/compare-pdf.html` | 63 | Atributo aria-label | `<button aria-label="..." >` | Aumentar zoom | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 112 | Texto visible en etiqueta | `<span>` | documento_2.pdf | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 126 | Atributo aria-label | `<button aria-label="..." >` | Cerrar opciones | Atributo aria-label sin data-i18n-aria |
| `public/views/tools/compare-pdf/compare-pdf.html` | 134 | Texto visible en etiqueta | `<span>` | Texto semántico | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 138 | Texto visible en etiqueta | `<span>` | Superposición de contenido | Texto en lenguaje natural sin data-i18n |
| `public/views/tools/compare-pdf/compare-pdf.html` | 145 | Texto visible en etiqueta | `<div>` | Compara los cambios y diferencias semánticas y visuales entre ambos archivos PDF. | Texto en lenguaje natural sin data-i18n |

## Falsos Positivos Técnicos Validados (No requieren corrección)
| Archivo | Línea | Elemento | Texto Técnico / Permitido | Razón de Falso Positivo |
| :--- | :--- | :--- | :--- | :--- |
| `public/views/home/home.html` | 6 | `<a aria-label="..." >` | BoardPDF | Término técnico |
| `public/views/home/home.html` | 6 | `<span>` | PDF | Marca técnica o numérico |
| `public/views/home/home.html` | 6 | `<a aria-label="..." >` | BoardPDF | Término técnico |
| `public/views/home/home.html` | 6 | `<tspan>` | PDF | Marca técnica o numérico |
| `index.html` | 8 | `<title>` | BoardPDF | Marca técnica o numérico |

## Directrices para el Desarrollador / IA
1. **Revisión Humana Obligatoria**: Antes de extraer un texto a `general.json`, verifique si corresponde a un identificador, número o nombre comercial.
2. **Implementación de Claves**: Para agregar una traducción:
   - En HTML: agregar el atributo `data-i18n="seccion.clave"` o `data-i18n-placeholder="..."`.
   - En TS: importar `t` desde `../services/i18n.service.js` y llamar `t('seccion.clave')`.
   - En JSON: registrar la clave en `public/translations/es/general.json` respetando el formato BEM/Namespace.

---
*Reporte generado automáticamente por la Suite de Pruebas de BoardPDF.*
