# Instrucciones Maestras del Proyecto para Inteligencias Artificiales y Agentes (AGENTS.md)

Este documento define las reglas estrictas de desarrollo, seguridad, arquitectura y diseño que **TODAS** las Inteligencias Artificiales (Antigravity, Gemini, Claude, Cursor, Copilot, Windsurf, etc.) deben acatar obligatoriamente al generar, refactorizar o modificar código en este repositorio.

---

## 1. Regla de Oro de Seguridad: CERO Exposición de Información Sensible y Backend Logger Obligatorio

1. **Uso Exclusivo del Sistema Centralizado `Logger` en Backend**:
   - Todo registro de actividad, error, advertencia o evento en el backend (`apps/BoardPDF/src/` y microservicios) debe realizarse **estrictamente a través del servicio centralizado `Logger`** (`src/services/logger.service.ts`).
   - Categorías disponibles:
     - `logger.app`: Ciclo de vida general, arranque del servidor, inicializaciones y peticiones HTTP.
     - `logger.db`: Conexiones a bases de datos (MySQL, Redis), consultas, transacciones y fallos de persistencia.
     - `logger.security`: Intentos de autenticación (éxitos/fallos), ataques o bloqueos CSRF/Turnstile, códigos 2FA y accesos restringidos.
   - Todo parámetro sensible (`password`, `token`, `secret`, `cookie`, `authorization`) es sanitizado automáticamente por el `Logger`.

2. **Respuestas HTTP Seguras**:
   - **NUNCA** envíes mensajes de error técnicos, consultas SQL, comandos Redis, trazas de depuración (stack traces), rutas de archivos del servidor ni detalles de excepciones internas en las respuestas HTTP hacia el frontend.
   - Si ocurre una excepción o error inesperado (código 500, 400, etc.), envía siempre un mensaje genérico, comprensible y seguro para el usuario final (ej. `"Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde."`).
   - Toda información técnica sensible, parámetros detallados y stack traces deben registrarse **exclusivamente** en el `Logger`.

3. **Protección de Datos y Objetos de Usuario**:
   - **NUNCA** incluyas en respuestas al cliente credenciales, hashes de contraseña (`password_hash`), códigos de verificación, tokens de descarga ni claves privadas.
   - Sanitizar siempre los objetos de usuario antes de enviarlos (únicamente campos públicos: `id`, `username`, `email`, `avatar_url`, `plan`, `permissions`).

---

## 2. Gestión Estricta de Credenciales y Secretos: CERO Secretos en Archivos `.ts` (Exclusividad Total de `.env`)

1. **Exclusividad Total del Archivo `.env`**:
   - **TODAS** las contraseñas, secretos criptográficos, llaves privadas, tokens de acceso (JWT, Stripe, Google Picker, Turnstile, DeepL, Dropbox, S3, etc.) y credenciales de bases de datos deben residir **exclusivamente en el archivo `.env`**.
   - Queda estrictamente prohibido escribir contraseñas, tokens o secretos hardcodeados en cualquier archivo TypeScript (`.ts`), JavaScript (`.js`) o JSON de configuración.

2. **PROHIBICIÓN TOTAL DE FALLBACKS CON CREDENCIALES**:
   - **NUNCA** coloques credenciales, contraseñas o secretos como valores de fallback (por defecto) en archivos `.ts`.
   - **PROHIBIDO**:
     ```typescript
     // ❌ INCORRECTO Y PELIGROSO:
     const dbPassword = process.env.DB_PASSWORD || 'boardpdf_secure_password_2026';
     const jwtSecret = process.env.SESSION_SECRET || 'mi_secreto_super_seguro_123';
     ```
   - **CORRECTO**:
     ```typescript
     // ✅ CORRECTO:
     const dbPassword = process.env.DB_PASSWORD || '';
     const jwtSecret = process.env.SESSION_SECRET || '';
     // O validar y lanzar error en el arranque si una credencial requerida está ausente.
     ```
   - Los archivos `.ts` únicamente deben importar y consumir configuraciones desde `.env` (a través del módulo centralizado `src/config/env.config.ts`), jamás asumiendo o exponiendo credenciales maestras en el código fuente.

---

## 3. CERO Texto Hardcodeado: Sistema de Traducciones Obligatorio (CERO Español en la Web)

1. **Prohibición Total de Cadenas de Texto Fijas en Frontend**:
   - Queda terminantemente prohibido escribir texto de usuario hardcodeado directamente en plantillas HTML (`public/views/`), componentes o vistas TypeScript (`client/`).
   - **Cero rastro de texto en español hardcodeado en la interfaz web**. Todo texto que ve el usuario debe resolverse exclusivamente mediante claves del sistema de internacionalización (`i18n.service.ts`).

2. **Uso Obligatorio de Atributos de Traducción en Plantillas HTML**:
   - En plantillas HTML, los elementos que contengan texto, placeholders, títulos o atributos de accesibilidad deben usar los atributos de datos semánticos de i18n y dejar el interior del elemento completamente vacío:
     - `data-i18n="clave.de.traduccion"`: Para el texto interno del elemento.
     - `data-i18n-placeholder="clave.de.traduccion"`: Para atributos `placeholder` en inputs.
     - `data-i18n-aria="clave.de.traduccion"`: Para atributos `aria-label`.
     - `data-i18n-title="clave.de.traduccion"`: Para atributos `title`.
   - Ejemplo:
     ```html
     <!-- ✅ CORRECTO: -->
     <h1 class="card__title" data-ref="login-title" data-i18n="auth.login.title"></h1>
     <input class="field__input" data-ref="input-email" type="email" placeholder=" " data-i18n-placeholder="auth.login.email_placeholder" />
     <button type="button" class="component-button component-button--black" data-ref="btn-submit" data-i18n="auth.login.submit_btn"></button>

     <!-- ❌ PROHIBIDO: -->
     <h1 class="card__title">Iniciar Sesión</h1>
     <input class="field__input" placeholder="Ingresa tu correo" />
     <button type="button" class="component-button">Continuar</button>
     ```

3. **Uso Obligatorio de `t(...)` en TypeScript**:
   - En vistas, componentes y servicios TypeScript (`client/`), cualquier mensaje dinámico, alerta, confirmación, tooltip o toast debe obtenerse invocando la función `t()`:
     ```typescript
     import { t } from '../services/i18n.service.js';

     // ✅ CORRECTO:
     showToast(t('errors.invalid_credentials'), 'error');
     ```
   - Las claves deben registrarse debidamente en los diccionarios JSON en `public/translations/` (`es/general.json`, `es/legal.json`, etc.).

---

## 4. Idioma en Ecosistemas Ajenos al Sistema Web (Python, Rust, Shell, Docker) y Anotaciones

1. **Código y Documentación 100% en Inglés en Python y Rust**:
   - En herramientas, microservicios y módulos donde el sistema de traducción web de TypeScript no aplica (como Rust en `apps/board-wasm/` y `apps/collab-server/`, scripts de Python en `scripts/` o tests, Dockerfiles, Shell scripts y archivos de configuración):
     - **TODO el código debe escribirse estrictamente en INGLÉS**: nombres de funciones, variables, structs, enums, constantes, logs internos, mensajes de error y argumentos de línea de comandos.
     - Queda estrictamente prohibido usar español en identificadores, comentarios, docstrings o logs dentro de proyectos Rust o Python.

2. **Anotaciones Técnicas y Comentarios**:
   - En cualquier archivo donde sea estrictamente indispensable incluir una anotación técnica, docstring o comentario (respetando la regla de código auto-documentado), este debe redactarse **exclusivamente en INGLÉS**.
   - Cero comentarios o anotaciones en español en todo el repositorio.

---

## 5. Prohibición Total de `console.*` en Frontend (Excepción Única: WebSocket Lifecycle)

1. **Cero `console.log` en el Frontend**:
   - Queda estrictamente prohibido utilizar `console.log`, `console.warn`, `console.error`, `console.info` o `console.debug` en cualquier archivo del frontend (`client/`).
   - Ni los controladores, ni las vistas, ni los componentes, ni los servicios pueden imprimir logs en la consola del navegador.

2. **Única Excepción Permitida**:
   - La única excepción autorizada en toda la aplicación cliente se encuentra en `client/services/websocket.service.ts`, y está limitada estrictamente a dos eventos de ciclo de vida de la conexión:
     1. Conexión establecida: `console.log('[WebSocket] Conexión establecida con éxito...');`
     2. Conexión cerrada/finalizada: `console.log('[WebSocket] Conexión cerrada.');`
   - Cualquier otro log en frontend (incluyendo errores de red, fallos de render o advertencias) no debe emitir logs a consola; en su lugar, se manejan silenciosamente o mediante notificaciones de UI (`showToast` o modales).

---

## 6. CERO Estilos Inline (`style="..."` o `element.style.*`)

1. **Prohibición Estricta de Estilos Inline**:
   - **NUNCA** utilices atributos `style="..."` en plantillas HTML ni inyectes estilos mediante `element.style.propiedad = ...` o `element.setAttribute('style', ...)` en JavaScript/TypeScript.
   - Todo diseño visual, espaciado, paleta de colores, tipografía, visibilidad y disposición debe gestionarse mediante clases modulares CSS en `public/css/` siguiendo la metodología BEM.

2. **Excepciones Críticas y Estrictamente Justificadas**:
   - Únicamente se permite manipular estilos en tiempo de ejecución en casos donde la geometría o física depende de cálculos dinámicos de píxeles que CSS no puede resolver estáticamente:
     1. **Scrollbars Virtuales y Cálculos de Scroll**: Posicionamiento y desplazamiento en vivo (`scrollTop`, `transform: translateY(...)`).
     2. **Canvas y Previsualización PDF de Alta Resolución**: Dimensionamiento pixel-ratio dinámico (`canvas.width`, `canvas.style.width = ...px`) en base al DPR de la pantalla y el nivel de zoom dinámico.
     3. **Gestos de Arrastre Táctil / Puntero**: Arrastre interactivo en tiempo real con puntero (como `setupSheetDragToDismiss` en `client/components/modal.component.ts` para desplazar una hoja modal en móvil).
   - Fuera de estas situaciones geométricas en tiempo real, el uso de estilos inline está terminantemente prohibido.

---

## 7. CERO Alertas Nativas del Navegador / Google (`alert`, `confirm`, `prompt`)

1. **Prohibición de Diálogos Nativos**:
   - **NUNCA** utilices `window.alert()`, `window.confirm()` o `window.prompt()`.
   - Estas alertas nativas bloquean el hilo principal del navegador, rompen la experiencia de usuario y degradan el diseño de la aplicación.

2. **Uso Obligatorio de Modales y Toasts del Sistema**:
   - Para confirmaciones, advertencias críticas, diálogos interactivos y formularios emergentes: utilizar el componente de modales del proyecto (`openModal` de `client/components/modal.component.ts`).
   - Para mensajes de retroalimentación inmediata, éxito o error no bloqueante: utilizar el servicio de notificaciones flotantes (`showToast` de `client/services/toast.service.ts`).

---

## 8. Uso Obligatorio del Sistema Centralizado de Invalidación de Caché (Cache Invalidator)

1. **Centralización en `cache.service.ts`**:
   - Toda interacción con caché Redis en el backend debe gestionarse a través del servicio centralizado `cacheService` (`src/services/cache.service.ts`).
   - Queda terminantemente prohibido realizar mutaciones en la base de datos sin disparar la correspondiente invalidación centralizada de caché.

2. **Invalidación Obligatoria en Mutaciones**:
   - Al modificar cualquier entidad, deben invocarse inmediatamente los métodos dedicados de invalidación:
     - Modificación de usuario: `await cacheService.invalidateUser(userId, email, username)`
     - Modificación de pertenencia a organización: `await cacheService.invalidateUserOrg(userId)`
     - Modificación de preferencias de usuario: `await cacheService.invalidateUserPrefs(userId)`
     - Modificación de permisos de rol: `await cacheService.invalidateRolePermsCache(role)`
   - Prohibido generar llaves de caché arbitrarias sin registrarlas en `CACHE_KEYS` o realizar llamadas `del()` manuales con claves quemadas.

---

## 9. Reglas Estrictas de HTML y DOM (CERO IDs)

1. **Prohibido el uso de `id`**:
   - **NUNCA** agregues atributos `id="..."` a ningún elemento HTML.
   - **NUNCA** utilices `document.getElementById(...)` en JavaScript.
   - Para identificar elementos o vincular componentes con JavaScript, utiliza exclusivamente atributos de datos semánticos: `data-ref="..."` (ej. `data-ref="btn-submit-login"`).
   - En JavaScript, selecciona elementos usando `querySelector('[data-ref="..."]')` o `querySelectorAll(...)`.

2. **Campos de Formulario Flotantes**:
   - Para inputs y etiquetas, envuelve el `<input>` dentro de `<label class="field" data-ref="...">`. Esto vincula el campo de forma nativa e inclusiva sin requerir atributos `id` ni `for`.

---

## 10. Orden Estricto de Atributos en HTML

Al escribir o modificar plantillas HTML, los atributos deben ordenarse de acuerdo a las siguientes reglas:

1. **Para botones (`<button>`)**:
   - El atributo `type` **debe ser siempre el primero**, seguido de `class`, luego `data-ref`, luego atributos de traducción (`data-i18n*`), y finalmente los demás atributos (`data-tooltip`, `aria-label`, etc.).
   ```html
   <button type="button" class="component-button component-button--h55 component-button--black component-button--w-full" data-ref="btn-submit-stage1" data-i18n="auth.register.continue_btn">
   <button type="button" class="field__action" data-ref="btn-random-username" data-tooltip="Generar nombre aleatorio" aria-label="Generar nombre aleatorio">
   ```

2. **Para cualquier otro elemento (`<div>`, `<a>`, `<label>`, `<input>`, `<span>`, etc.)**:
   - El atributo `class` **debe ser siempre el primero**, seguido de `data-ref` (o `data-*`), luego atributos de traducción (`data-i18n*`), y luego los demás atributos (`type`, `placeholder`, `href`, etc.).
   ```html
   <div class="menu-panel menu-panel--w-285 menu-panel--h-full" data-ref="main-menu">
   <input class="field__input field__input--has-action" data-ref="register-username" type="text" placeholder=" " autocomplete="username" />
   <a class="link" data-ref="btn-forgot-password" href="/forgot-password" data-i18n="auth.login.forgot_link"></a>
   ```

---

## 11. Diseño de Formularios y Banners de Error

1. **Ubicación de Banners de Notificación/Error**:
   - Los banners de error (`<div class="banner banner--danger" data-ref="...-error">`) deben ubicarse **siempre debajo de los botones de acción** (ej. debajo de los botones de "Continuar", "Continuar con Google" o "Verificar"), nunca en la parte superior del formulario.
2. **Labels Flotantes**:
   - Todos los inputs utilizan la técnica de label flotante con la estructura `.field` > `.field__input` + `.field__label`.

---

## 12. Organización Modular del Código

1. **Estructura Backend (`src/`)**:
   - `src/config/`: Conexiones y configuraciones (`database.config.ts`, `redis.config.ts`, `env.config.ts`, `email-templates.json`).
   - `src/services/`: Lógica de negocio pura (`logger.service.ts`, `cache.service.ts`, `auth.service.ts`, `mail.service.ts`, `verification.service.ts`, etc.).
   - `src/controllers/`: Manejadores de rutas HTTP Express.
   - `src/middlewares/`: Middlewares globales y de ruta (`auth.middleware.ts`, `csrf.middleware.ts`).
   - `src/routes/`: Definición y montaje de rutas.
   - `src/types/`: Interfaces y tipos TypeScript.
   - `src/utils/`: Validadores y utilidades puras.

2. **Estructura Frontend TypeScript (`client/`) y Assets (`public/`)**:
   - `client/app-main.ts`: Punto de entrada principal de la SPA frontend.
   - `client/app-router.ts`: Enrutador cliente y ciclo de vida de navegación SPA.
   - `client/views/`: Vistas y controladores TypeScript (`auth.view.ts`, `settings.view.ts`, `home.view.ts`, etc.).
   - `client/components/`: Componentes modulares TypeScript (`layout.component.ts`, `modal.component.ts`).
   - `client/services/`: Servicios cliente TypeScript (`api.service.ts`, `i18n.service.ts`, `websocket.service.ts`, etc.).
   - `client/types/`: Interfaces y tipos TypeScript del frontend (`auth.types.ts`, `subscription.types.ts`, `common.types.ts`).
   - `client/utils/`: Utilidades cliente (`dom.util.ts`, `validators.util.ts`, `languages.util.ts`).
   - `client/config/`: Configuraciones de rutas y skeletons (`skeleton-routes.ts`, `skeleton-templates.ts`).
   - `public/views/`: Archivos de plantilla `.html` puros organizados temáticamente (`auth/`, `settings/`, `home/`, `error/`).
   - `public/translations/`: Diccionarios JSON de traducción por idioma (`es/general.json`, `es/legal.json`, etc.).
   - `public/css/`: Hojas de estilo modulares con metodología BEM (`root.css` para tokens de diseño y temas, y carpeta `components/` con componentes atómicos `component-buttons.css`, `component-forms.css`, `component-feedback.css`, `component-layout.css`, `component-overlays.css`, y módulos de dominio/canvas cargados bajo demanda).
   - **Compilador / Bundler**: Vite en modo middleware Express para desarrollo (`npm run dev`) y compilación de producción a `dist/client/` (`npm run build`). Verificación de tipos con `npm run typecheck`.

3. **Estructura Rust y Microservicios (`apps/`)**:
   - `apps/board-wasm/`: Motor WebAssembly de alto rendimiento en Rust para renderizado, transformaciones vectoriales y procesamiento local de PDFs.
   - `apps/collab-server/`: Servidor de sincronización WebSocket de alta concurrencia en Rust para edición colaborativa en tiempo real.

---

## 13. Reglas Estrictas de Imports en JavaScript y TypeScript

1. **Formato Horizontal de Imports**:
   - Cada instrucción `import` debe declararse en **una sola línea horizontal**, sin saltos de línea entre llaves `{ ... }`.
2. **Orden Alfabético por Ruta / Módulo**:
   - Todas las sentencias `import` al inicio del archivo deben ordenarse **alfabéticamente** según la ruta o nombre del módulo origen.
3. **Orden Alfabético de Miembros Nombrados**:
   - Dentro de `{ ... }`, los elementos importados deben listarse estrictamente en **orden alfabético**.

```typescript
import { navigate } from '../app-router.js';
import { clearUserState, currentUser, getApi, postApi, setCurrentUser } from '../services/api.service.js';
import { getCurrentLanguage, setLanguage, t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { debounce, setupDropdown, withButtonLoading } from '../utils/dom.util.js';
```

---

## 14. Cero Anotaciones y Cero Comentarios Explicativos en Código Web / TS

1. **Código 100% Auto-documentado**:
   - Queda estrictamente prohibido utilizar JSDoc (`/** ... */`), PHPDoc o anotaciones de parámetros en archivos TypeScript y JavaScript.
   - Queda prohibido incluir bloques de cabecera decorativos (`/* ====== SECCIÓN ====== */`) o comentarios inline que describan código evidente.
   - Todo el código debe ser limpio, conciso y auto-explicativo mediante nombres claros de tipos, funciones y variables.

---

## 15. Estructura Estándar de Archivos y Controladores JS/TS

1. **Secuencia de Estructura**:
   - **Imports**: Horizontales y alfabéticos.
   - **Constantes / Estado Encapsulado**: A nivel de módulo.
   - **Clase / Controlador**:
     - `constructor()`: Bind de handlers (`this._boundClick = this.handleClick.bind(this)`), instanciación de servicios.
     - `init()`: AbortController, contenedor DOM (`data-ref`), `this.bindEvents()`, carga de datos.
     - `bindEvents()`: Asocia listeners delimitados al contenedor.
     - `destroy()`: AbortController.abort(), remueve todos los event listeners.
     - Event Handlers (`handleClick`, `handleSubmit`).
     - Métodos Privados / Auxiliares (`_loadData`, `_render`).
   - **Exportaciones Limpias**: Al final del archivo.

---

## 16. Control de Acceso Estricto Basado en Permisos (PBAC)

1. **CERO Autorización por Roles Directos**:
   - **NUNCA** utilices el rol de un usuario (`user.role === '...'`, `roles.includes('...')`, `requireRole(...)`) para controlar acceso a rutas, servicios o lógica de negocio.
   - Los roles existen únicamente como contenedores o agrupadores de permisos en la base de datos (`role_permissions`). Toda verificación de acceso debe realizarse a través de permisos específicos (`hasPermission`, `requirePermission`, `hasAllPermissions`).

2. **CERO Autorización por Nombres de Suscripción Directos**:
   - **NUNCA** concedas o restrinjas funciones comparando cadenas de planes o suscripciones (`subscription_tier === '...'`).
   - El acceso a funciones premium (equipos, kits de marca, herramientas IA, SSO corporativo, etc.) se rige **exclusivamente por los permisos activos** conferidos por la suscripción (`subscription:feature:*`), verificados mediante `hasSubscriptionFeature` o el middleware `requireFeature`.

---

## 17. Esquemas de Base de Datos y Scripts de Arranque (CERO DDL Inline)

1. **Scripts SQL como Única Autoridad**:
   - Toda creación o modificación de tablas, columnas e índices debe residir exclusivamente en los scripts de arranque en `database/` (`database/db_identity.sql`).
   - Queda estrictamente prohibido colocar sentencias DDL (`CREATE TABLE`, `ALTER TABLE`) o migraciones automáticas inline dentro de `src/config/database.config.ts` o servicios backend.
