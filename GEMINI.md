# Reglas e Instrucciones de Desarrollo para la IA - BoardStack

Este documento contiene las reglas arquitectónicas y convenciones de codificación obligatorias que la IA asistente debe seguir estrictamente al generar, modificar o refactorizar cualquier archivo en este repositorio.

---

## 1. Nomenclatura Genérica de Clases CSS (`component-*` y Modificadores)

### ⛔ Prohibido:
- **NUNCA** utilizar clases CSS directas acopladas a vistas, características o módulos específicos (por ejemplo: `settings-*`, `avatar-*`, `layout-*`, `pricing-*`, `modal-*`, `user-*`, etc.).

### ✅ Obligatorio:
- Utilizar **siempre clases genéricas** basadas en el prefijo `component-`, combinadas con la convención BEM (Bloque__Elemento--Modificador) o clases utilitarias del sistema de diseño (`public/css/components.css`).
- Estructura:
  - **Bloques genéricos**: `component-container`, `component-item`, `component-card`, `component-button`, `component-header`, `component-title`, `component-subtitle`, `component-group`, `component-avatar`, `component-divider`, `component-badge`, etc.
  - **Elementos internos**: `component-item__content`, `component-item__text`, `component-item__title`, `component-item__desc`, `component-item__actions`, `component-avatar__img`, `component-avatar__overlay`, etc.
  - **Modificadores**: `component-container--narrow`, `component-button--h34`, `component-button--black`, `component-avatar--lg`, etc.

### Comparativa:
```html
<!-- ❌ INCORRECTO: Clases directas acopladas a la vista -->
<div class="settings-container">
  <div class="settings-avatar-wrapper">
    <img class="avatar-image" src="..." />
    <button class="settings-save-button">Guardar</button>
  </div>
</div>

<!-- ✅ CORRECTO: Clases genéricas y reutilizables con modificadores -->
<div class="component-container component-container--narrow" data-ref="settings-container">
  <div class="component-item" data-ref="item-avatar">
    <div class="component-avatar component-avatar--lg" data-ref="avatar-box">
      <img class="component-avatar__img" data-ref="avatar-img" src="..." alt="Avatar" />
    </div>
    <div class="component-item__actions">
      <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-save">
        ...
      </button>
    </div>
  </div>
</div>
```

---

## 2. Atributos `data-*` en lugar de `id`

### ⛔ Prohibido:
- **Evitar en la mayor medida posible los atributos `id`** en elementos HTML o templates dinámicos.
- No utilizar `id` para estilizar en CSS, ni como selector general en TypeScript/JavaScript (`querySelector('#...')` o `getElementById`).

### ✅ Obligatorio:
- Utilizar atributos `data-*` para identificar elementos, vincular eventos, manejar estado o testing.
- El atributo estándar para referenciar elementos desde TypeScript es `data-ref="..."`.
- Otros atributos permitidos: `data-action`, `data-tier`, `data-tooltip`, `data-state`, `data-theme`, etc.

### ⚠️ Excepciones Estrictas donde SÍ se permite `id`:
El atributo `id` solo se admite en los casos donde sea un requisito técnico indispensable de la plataforma web o de accesibilidad nativa:
1. **Asociación obligatoria de inputs con labels**: `<input id="field-user-email">` emparejado con `<label for="field-user-email">`.
2. **Relaciones ARIA nativas**: Atributos como `aria-labelledby`, `aria-describedby` o `aria-controls` que exigen referenciar un ID explícito.
3. **Integraciones de terceros**: Contenedores exigidos por SDKs externos que requieren montarse sobre un selector por ID (e.g. Stripe Elements).

Fuera de estas excepciones puntuales, **todo debe usar atributos `data-*`**.

### Comparativa:
```html
<!-- ❌ INCORRECTO: Uso innecesario de id -->
<div id="account-header">
  <h1 id="title">Cuenta</h1>
  <button id="btn-submit">Enviar</button>
</div>

<!-- ✅ CORRECTO: Uso de data-ref para referencias y selectores -->
<div class="component-header" data-ref="account-header">
  <h1 class="component-title" data-ref="account-title">...</h1>
  <button type="button" class="component-button" data-ref="btn-submit">...</button>
</div>
```

---

## 3. Cero Texto Hardcodeado / Sistema de Traducciones e Idioma en Backend

### ⛔ Prohibido:
- **NUNCA** dejar texto literal o hardcodeado en archivos `.html`, plantillas o archivos TypeScript (`.ts`).
- Ningún texto visible al usuario final (títulos, descripciones, botones, placeholders, tooltips `data-tooltip`, textos `alt`, mensajes de error, notificaciones toast, modales) puede quedar sin clave de traducción.

### ✅ Obligatorio en Frontend (HTML / TypeScript):
- Todo texto que se muestre en pantalla **DEBE** obtenerse a través del servicio de internacionalización:
  ```ts
  i18n.t('clave.subclave')
  // o con parámetros:
  i18n.t('clave.subclave', { count: 5 })
  ```
- Si la clave requerida aún no existe en el catálogo de traducciones (`client/i18n/locales/es.ts`), es **obligatorio agregarla** con su traducción correspondiente antes de utilizarla.

### ✅ Obligatorio en Backend / Lenguajes no integrados a i18n (Python, Rust, etc.):
- En tecnologías o scripts de backend (Python, Rust, Go, scripts de automatización, etc.) que **no** sean compatibles con el sistema de traducciones del cliente:
  - **SOLO UTILIZAR INGLÉS (ENGLISH ONLY)** en cualquier texto, mensajes de log, mensajes de error, salidas de terminal y respuestas de API.
  - Prohibido mezclar español u otros idiomas en código o salidas de backend sin soporte i18n.

### Comparativa:
```ts
// ❌ INCORRECTO: Texto hardcodeado en TypeScript/HTML
header.innerHTML = `<h1>Tu cuenta</h1><p>Administra tu configuración</p>`;
toast.success('Cambios guardados con éxito');

// ❌ INCORRECTO en Python: Mensajes en español sin soporte de traducción
raise ValueError("El correo electrónico no es válido")

// ✅ CORRECTO: Uso estricto de claves i18n en TypeScript/HTML
header.innerHTML = `
  <h1 class="component-title" data-ref="account-title">${i18n.t('settings.account.title')}</h1>
  <p class="component-subtitle" data-ref="account-subtitle">${i18n.t('settings.account.subtitle')}</p>
`;
toast.success(i18n.t('common.saved'));

// ✅ CORRECTO en Python: Todo exclusivamente en inglés
raise ValueError("Invalid email address provided")
```

---

## 4. Orden de Imports y Exports en Archivos TypeScript (`.ts`)

### ✅ Obligatorio para `import`:
- **Todos los `import` van al inicio absoluto del archivo**.
- **Deben estar estrictamente ordenados de forma alfabética**.
- No intercalar código, constantes ni funciones entre las sentencias `import`.

### ✅ Obligatorio para `export`:
- **Todos los `export` van al puro final del archivo**.
- Prohibido usar `export` en línea a lo largo del cuerpo del archivo (evitar `export function ...`, `export const ...`, `export class ...` dispersos).
- Definir todas las funciones, clases, constantes e interfaces de forma local en el cuerpo y agrupar sus exportaciones al pie del archivo utilizando `export { ... }` o `export default`.

### Estructura de un archivo `.ts`:
```ts
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { i18n } from '../../i18n/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { toast } from '../../services/toast.service.js';

interface AccountViewState {
  isLoading: boolean;
  username: string;
}

const DEFAULT_TIMEOUT_MS = 5000;

function handleFormSubmit(): void {
  // Sin anotaciones en el código final
}

async function createSettingsAccountView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-account-layout');
  return container;
}

export {
  createSettingsAccountView,
  handleFormSubmit
};

export type {
  AccountViewState
};
```

---

## 5. Prohibición Total de Comentarios y Anotaciones (Exclusivo para Archivos CSS)

### ⛔ Prohibido:
- **NUNCA** incluir comentarios, anotaciones, notas explicativas, encabezados decorativos o bloques comentados en archivos `.ts`, `.html`, `.js`, `.py`, `.rs`, `.json`, `.sql`, etc.
- Prohibido el uso de comentarios de línea (`//`), comentarios multilínea (`/* ... */`), comentarios HTML (`<!-- ... -->`), comentarios Python/Bash (`#`) o docstrings usados como anotación en cualquier archivo que no sea CSS.
- El código debe ser limpio, directo y autoexplicativo sin texto adicional de asistencia o anotaciones.

### ✅ Obligatorio:
- **LOS ARCHIVOS CSS (`.css`) SON LOS ÚNICOS AUTORIZADOS** para contener anotaciones y comentarios (`/* ... */`) destinados a documentar la arquitectura de componentes, secciones del diseño o variables.
- Cualquier otro tipo de archivo debe generarse o modificarse **100% libre de comentarios y anotaciones**.

### Comparativa:
```ts
// ❌ INCORRECTO en TypeScript: Anotaciones o comentarios
// Función para procesar datos
const processUserData = () => { /* ... */ };

// ✅ CORRECTO en TypeScript: Código limpio sin anotaciones
const processUserData = () => {
  return true;
};
```

```html
<!-- ❌ INCORRECTO en HTML: Comentarios -->
<!-- Contenedor principal -->
<div class="component-container">...</div>

<!-- ✅ CORRECTO en HTML: Sin anotaciones -->
<div class="component-container">...</div>
```

```python
# ❌ INCORRECTO en Python: Comentarios o notas
# Connect to database
db = connect()

# ✅ CORRECTO en Python: Código limpio y directo
db = connect()
```

```css
/* ✅ CORRECTO en CSS: Único formato donde SÍ se permiten anotaciones */
/* ==========================================================================
   COMPONENT: BUTTONS & MODIFIERS
   ========================================================================== */
.component-button {
  display: inline-flex;
}
```

---

## 6. Almacenamiento Obligatorio en AWS S3 para Archivos Subidos por el Usuario

### ⛔ Prohibido:
- **NUNCA** guardar archivos, fotos de perfil, avatares o documentos subidos por el usuario en el sistema de archivos local (`public/uploads/...`, carpetas locales o disco del contenedor).
- **NUNCA** exponer nombres de servicios locales o provisionales en variables de entorno o código; utilizar siempre la convención y nomenclatura estándar de AWS S3 (`AWS_S3_*`).

### ✅ Obligatorio:
- **Absolutamente TODO lo que el usuario suba a la aplicación (fotos, avatares, archivos, documentos)** DEBE guardarse en AWS S3 (en entorno local mediante contenedor MinIO compatible con la API de S3, y en producción en AWS S3 directamente).
- En el archivo `.env`, `docker-compose.yml` y en todo el código y configuración de backend, referirse y configurar el almacenamiento siempre como **AWS S3** usando las variables:
  - `AWS_S3_REGION`
  - `AWS_S3_BUCKET`
  - `AWS_S3_ACCESS_KEY_ID`
  - `AWS_S3_SECRET_ACCESS_KEY`
  - `AWS_S3_ENDPOINT`
  - `AWS_S3_FORCE_PATH_STYLE`
  - `AWS_S3_PUBLIC_URL`
- Toda operación de subida, consulta o eliminación de archivos debe gestionarse exclusivamente a través del servicio centralizado de AWS S3 (`s3.service.ts`).
- **Sanitización rigurosa previa a S3**: Todo archivo subido (fotos de perfil, documentos, avatares, etc.) DEBE ser verificado y sanitizado obligatoriamente mediante `sanitizer.util.ts` (o `sanitizeAndUploadToS3`) antes de enviarse a AWS S3. Esto valida los magic bytes reales de cabecera (impidiendo binarios ejecutables `.exe`, ELF, scripts `.sh`), analiza y bloquea payloads maliciosos embebidos (`<script>`, `<?php`, `eval`, webshells, inyecciones de código) y genera nombres de archivo seguros y únicos libres de path traversal.

---

## 7. Cero Credenciales o Variables Hardcodeadas y Prohibición Total de Fallbacks

### ⛔ Prohibido:
- **NUNCA** dejar credenciales, secretos, API keys, tokens, contraseñas, URLs o nombres de base de datos/buckets hardcodeados en ningún archivo que no sea el `.env` local (el cual está estrictamente ignorado por git).
- **PROHIBICIÓN TOTAL DE FALLBACKS CON CREDENCIALES O SECRETOS**: Está terminantemente prohibido usar valores por defecto o fallback en código que contengan credenciales, identificadores o secretos simulados (por ejemplo: `accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || 'dummy_key'`, `bucket: process.env.AWS_S3_BUCKET || 'dummy_bucket'`, `secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || 'dummy_secret'`, `stripeSecretKey: process.env.STRIPE_SECRET_KEY || 'dummy_token'`, etc.).
- **NUNCA** incluir credenciales o secretos literales en `docker-compose.yml`, scripts o archivos de plantilla (en `.env.example` se deben usar exclusivamente marcadores genéricos como `your_s3_bucket`, `your_google_client_id`, nunca credenciales reales o patrones reconocibles por escáneres de seguridad como GitHub Secret Scanning).

### ✅ Obligatorio:
- La configuración del sistema debe conectarse **exclusivamente a través de variables de entorno (`process.env.*`)**.
- Si una variable de entorno no está definida en el `.env`, el código debe resolver a cadena vacía `process.env.VAR || ''` o `undefined`, nunca a credenciales, contraseñas o nombres hardcodeados. No se aceptan fallbacks de credenciales; solo la conexión pura con `.env`.
- Todo contenedor en `docker-compose.yml` debe alimentarse mediante `env_file: - .env` o interpolación de variables `${VAR}`, sin declarar valores sensibles literales en el archivo compose.
- Los archivos `.env.example` solo deben contener nombres de variables con marcadores genéricos (`your_api_key`, `your_db_password`, etc.).

### Comparativa:
```ts
// ❌ INCORRECTO: Credenciales hardcodeadas como fallback
const config = {
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || 'boardstack_s3_access_key',
  bucket: process.env.AWS_S3_BUCKET || 'boardstack-uploads',
  endpoint: process.env.AWS_S3_ENDPOINT || 'http://127.0.0.1:9000',
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE !== 'false',
  publicUrl: process.env.AWS_S3_PUBLIC_URL || 'http://localhost:9000/boardstack-uploads',
  region: process.env.AWS_S3_REGION || 'us-east-1',
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || 'example_secret_key',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || 'example_stripe_key',
};

// ✅ CORRECTO: Conexión limpia con .env sin fallbacks de credenciales
const config = {
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || '',
  bucket: process.env.AWS_S3_BUCKET || '',
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  publicUrl: process.env.AWS_S3_PUBLIC_URL || '',
  region: process.env.AWS_S3_REGION || '',
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
};
```

---

## Checklist de Verificación Rápida para la IA

Antes de dar por completado cualquier cambio o generación de código, la IA debe validar:
1. [ ] ¿Las clases CSS usan el prefijo genérico `component-` y modificadores en lugar de clases por módulo (`settings-`, `avatar-`, etc.)?
2. [ ] ¿Se eliminaron todos los atributos `id` innecesarios, reemplazándolos por `data-ref` (dejando `id` únicamente en inputs enlazados a labels o casos de fuerza mayor)?
3. [ ] ¿Todo el texto en HTML y TypeScript usa claves con `i18n.t(...)`, sin dejar ningún string visible hardcodeado?
4. [ ] Si se modificó Python, Rust u otro entorno sin i18n, ¿todo está escrito estrictamente en inglés?
5. [ ] En los archivos `.ts`, ¿los `import` están al principio ordenados alfabéticamente y todos los `export` agrupados al final del archivo?
6. [ ] ¿Se verificó que **NO** haya comentarios ni anotaciones de ningún tipo en archivos `.ts`, `.html`, `.py`, etc. (permitidos **exclusivamente en archivos `.css`**)?
7. [ ] ¿Todo archivo subido por el usuario se sanitiza rigurosamente contra malware/scripts y se almacena en AWS S3 bajo la convención y variables `AWS_S3_*`?
8. [ ] ¿Se verificó que no existan credenciales, secretos, API keys o valores de fallback hardcodeados en el código, configs o docker-compose (obteniéndose exclusivamente desde el archivo .env sin fallbacks simulados)?
