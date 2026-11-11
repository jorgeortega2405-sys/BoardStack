# Reglas de Desarrollo y Seguridad de BoardPDF (GEMINI.md)

Este archivo complementa a `AGENTS.md` y es cargado directamente por Antigravity / Gemini CLI para gobernar el comportamiento en este repositorio.

## Directivas Primarias

1. **CERO Exposición de Información Sensible y Backend Logger Obligatorio**:
   - Todo log en backend debe usar exclusivamente `logger.app.*`, `logger.db.*` o `logger.security.*` (`src/services/logger.service.ts`).
   - NUNCA expongas stack traces, queries SQL, errores de base de datos o secretos de configuración al frontend en respuestas HTTP.
   - En caso de error, responde siempre con mensajes genéricos, comprensibles y seguros.

2. **CERO Credenciales en Archivos `.ts` (Exclusividad Total de `.env`)**:
   - Todas las credenciales, contraseñas, secretos criptográficos y API keys deben residir exclusivamente en `.env`.
   - PROHIBIDO escribir credenciales en código `.ts` o `.js`.
   - CERO fallbacks con secretos en archivos `.ts` (PROHIBIDO `process.env.SECRET || 'valor_secreto'`). Solo importar y consumir desde `.env` (`src/config/env.config.ts`) sin fallbacks de credenciales.

3. **CERO Texto Hardcodeado: Sistema de Traducciones Obligatorio (CERO Español en la Web)**:
   - Todo texto legible para el usuario en la interfaz web debe provenir de las claves de traducción de `i18n.service.ts` (`public/translations/`).
   - En HTML (`public/views/`): Usar `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria`, `data-i18n-title` con etiquetas internas vacías.
   - En TypeScript (`client/`): Usar `t('clave.de.traduccion')`. Cero texto en español hardcodeado en la web.

4. **Idioma 100% en Inglés en Python, Rust, Shell y Anotaciones**:
   - En Python, Rust (`apps/BoardPDF/board-wasm/`, `apps/BoardPDF/sync-engine/`), Dockerfiles, Shell y scripts externos al sistema de traducción web, TODO el código, variables, logs internos y mensajes debe ser estrictamente en INGLÉS.
   - Cualquier anotación técnica, comentario o docstring debe redactarse 100% en INGLÉS.

5. **CERO `console.log` en Frontend (Excepción Única: WebSocket Lifecycle)**:
   - Prohibición total de `console.log`, `console.warn`, `console.error`, `console.info` o `console.debug` en el frontend (`client/`).
   - Única excepción permitida: `client/services/websocket.service.ts` exclusivamente para los dos logs de conexión establecida y conexión cerrada/finalizada.

6. **CERO Estilos Inline (`style="..."` o `element.style.*`)**:
   - Prohibido el uso de estilos inline tanto en plantillas HTML como en TypeScript/JavaScript.
   - Todo estilo debe definirse mediante clases modulares CSS en `public/css/` (BEM).
   - Únicas excepciones permitidas: cálculos dinámicos de scroll/scrollbars virtuales, renderizado dinámico de canvas/preview PDF de alta resolución, o arrastre táctil interactivo en tiempo real (drag-to-dismiss).

7. **CERO Alertas Nativas del Navegador / Google (`alert`, `confirm`, `prompt`)**:
   - Prohibido el uso de `window.alert()`, `window.confirm()` o `window.prompt()`.
   - Para alertas, diálogos y confirmaciones usar exclusivamente los modales del proyecto (`openModal` en `client/components/modal.component.ts`) y notificaciones (`showToast` en `client/services/toast.service.ts`).

8. **Uso Obligatorio del Sistema Centralizado de Invalidación de Caché (Cache Invalidator)**:
   - Toda mutación que afecte datos cacheados en Redis debe invocar los métodos centralizados de `cacheService` (`src/services/cache.service.ts`), como `invalidateUser`, `invalidateUserOrg`, `invalidateUserPrefs`, `invalidateRolePermsCache`.
   - Prohibido omitir la invalidación o realizar invalidaciones manuales aisladas.

9. **CERO Atributos `id`**:
   - Usa exclusivamente `data-ref="..."` para identificar elementos.
   - En JavaScript usa `querySelector('[data-ref="..."]')`.

10. **Orden de Atributos**:
    - `<button type="..." class="..." data-ref="..." data-i18n*="...">` (type primero).
    - En los demás elementos: `<div class="..." data-ref="..." data-i18n*="...">` (class primero).

11. **Ubicación de Banners de Error**:
    - Colocar los banners de error debajo de los botones de acción del formulario.

12. **Imports Horizontales y Alfabéticos**:
    - Escribir cada `import` en una sola línea horizontal.
    - Ordenar las declaraciones alfabéticamente por ruta de módulo, y los miembros `{ ... }` alfabéticamente.

13. **CERO Anotaciones y Comentarios Explicativos en TS/JS**:
    - Prohibido JSDoc, PHPDoc, bloques decorativos y comentarios inline de código obvio. Código 100% auto-documentado.

14. **Estructura Estándar de Controladores / Vistas JS/TS**:
    - Seguir el ciclo de vida: `init()` (con `AbortController`), `bindEvents()` y `destroy()`.

15. **Frontend TypeScript (`client/`) y Compilación Vite**:
    - Todo el código cliente se escribe en TypeScript estricto dentro de `client/`.
    - Los archivos estáticos en tiempo de ejecución (`views/`, `translations/`, `css/`) residen en `public/`.
    - En desarrollo, Vite corre como middleware Express (`npm run dev`). En producción, Vite compila a `dist/client/` (`npm run build`). Verificación de tipos con `npm run typecheck`.

16. **Control de Acceso Basado en Permisos (PBAC)**:
    - Prohibido autorizar acciones evaluando roles directamente (`user.role === '...'`, `requireRole(...)`) o cadenas de suscripción (`user.subscription_tier === '...'`).
    - Toda autorización se rige exclusivamente por permisos específicos (`hasPermission`, `requirePermission`, `hasSubscriptionFeature`, `requireFeature`).

17. **CERO DDL Inline en Código de Base de Datos**:
    - Todo esquema, tabla, columna e índice debe residir en los scripts de arranque en `database/` (`database/db_identity.sql`). Prohibido `CREATE TABLE` o `ALTER TABLE` en `database.config.ts` o servicios backend.

18. **Almacenamiento Exclusivo en AWS S3 / MinIO (CERO Archivos Guardados en Servidor Local)**:
    - Absolutamente todo archivo, foto, avatar o documento subido por el usuario, o generado/procesado por el servidor (PDFs resultantes, conversiones, exportaciones), debe almacenarse exclusivamente en S3/MinIO (`s3Client`, `temp-storage.service.ts`).
    - PROHIBIDO guardar archivos de manera persistente en carpetas locales del servidor (`uploads/`, `public/uploads/`, `storage/`). El backend es 100% Stateless.
    - Si se requieren archivos intermedios en `os.tmpdir()` para procesamiento técnico, deben eliminarse obligatoriamente de inmediato en el bloque `finally`.

Consulta las especificaciones completas en [AGENTS.md](AGENTS.md).
