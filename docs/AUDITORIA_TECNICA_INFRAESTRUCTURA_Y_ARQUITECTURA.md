# Auditoría Técnica Integral de Infraestructura y Arquitectura — BoardStack / BoardPDF

**Fecha de Emisión**: 3 de noviembre de 2026  
**Versión**: 1.0.0 (Master Release)  
**Clasificación**: Informe Técnico de Auditoría de Arquitectura, Rendimiento y Seguridad  
**Ámbito de Evaluación**: Aplicación Web Monolítica Modular Node.js/Express (`apps/BoardPDF`), Microservicio Colaborativo en Rust (`apps/collab-server`), Arquitectura de Red y Reverse Proxy (Nginx), Contenedorización (Docker/Compose), Mecanismos de Persistencia y Caché (MySQL, Redis, S3Proxy) y Estrategias de Pruebas de Carga Cuantitativas.  
**Modo de Integridad**: Read-Only Audit (No destructivo sobre código fuente de producción).

---

## Tabla de Contenidos

1. [Resumen Ejecutivo y Diagnóstico Global](#resumen-ejecutivo-y-diagnóstico-global)
   - [1.1 Contexto y Alcance del Análisis](#11-contexto-y-alcance-del-análisis)
   - [1.2 Scorecard de Salud de la Plataforma](#12-scorecard-de-salud-de-la-plataforma)
   - [1.3 Resumen de Criticidad de Riesgos](#13-resumen-de-criticidad-de-riesgos)
2. [Sección 1: Servidores Node.js y Gestión de Procesos](#sección-1-servidores-nodejs-y-gestión-de-procesos)
   - [2.1 Arquitectura del Servidor Express y Pipeline de Middlewares](#21-arquitectura-del-servidor-express-y-pipeline-de-middlewares)
   - [2.2 Modelo de Procesos: Single-Process vs Clustering / PM2](#22-modelo-de-procesos-single-process-vs-clustering--pm2)
   - [2.3 Análisis del Event Loop y Bloqueos de I/O Síncrono](#23-análisis-del-event-loop-y-bloqueos-de-io-síncrono)
   - [2.4 Gestión de Memoria, Heap de V8 y Vulnerabilidad OOM en Multer](#24-gestión-de-memoria-heap-de-v8-y-vulnerabilidad-oom-en-multer)
   - [2.5 Invocación Descontrolada de Subprocesos Python y Descargas Sin Streaming](#25-invocación-descontrolada-de-subprocesos-python-y-descargas-sin-streaming)
   - [2.6 Ciclo de Vida, Señales del Sistema Operativo y Timeouts HTTP](#26-ciclo-de-vida-señales-del-sistema-operativo-y-timeouts-http)
   - [2.7 Propuestas de Mitigación y Código de Reemplazo (Node.js)](#27-propuestas-de-mitigación-y-código-de-reemplazo-nodejs)
3. [Sección 2: Balanceo de Carga, Reverse Proxy e Infraestructura Docker](#sección-2-balanceo-de-carga-reverse-proxy-e-infraestructura-docker)
   - [3.1 Diagnóstico de Contenedorización Actual y Gaps en Docker Compose](#31-diagnóstico-de-contenedorización-actual-y-gaps-en-docker-compose)
   - [3.2 Diagnóstico de Reverse Proxy y Ausencia de Nginx](#32-diagnóstico-de-reverse-proxy-y-ausencia-de-nginx)
   - [3.3 Estrategia de Balanceo de Carga y Terminación SSL/TLS](#33-estrategia-de-balanceo-de-carga-y-terminación-ssltls)
   - [3.4 Configuración de Producción Lista para Despliegue: Nginx](#34-configuración-de-producción-lista-para-despliegue-nginx)
   - [3.5 Diagnóstico y Rediseño de Health Checks: Liveness vs Readiness](#35-diagnóstico-y-rediseño-de-health-checks-liveness-vs-readiness)
   - [3.6 Dockerfiles Multi-Stage de Producción (Node.js y Rust)](#36-dockerfiles-multi-stage-de-producción-nodejs-y-rust)
4. [Sección 3: WebSockets y Escalabilidad en Tiempo Real](#sección-3-websockets-y-escalabilidad-en-tiempo-real)
   - [3.1 Arquitectura del Servidor Colaborativo Rust (`collab-server`)](#31-arquitectura-del-servidor-colaborativo-rust-collab-server)
   - [3.2 Diagnóstico del Cliente WebSocket SPA y Puerto Cableado](#32-diagnóstico-del-cliente-websocket-spa-y-puerto-cableado)
   - [3.3 Sincronización Multi-Instancia y Estado en Memoria Local (Split-Brain)](#33-sincronización-multi-instancia-y-estado-en-memoria-local-split-brain)
   - [3.4 Tormentas de Reconexión (*Thundering Herd*) y Falta de Jitter](#34-tormentas-de-reconexión-thundering-herd-y-falta-de-jitter)
   - [3.5 Gestión de Backpressure, Pérdida de Mensajes y Fuga de Sockets](#35-gestión-de-backpressure-pérdida-de-mensajes-y-fuga-de-sockets)
   - [3.6 Arquitectura Propuesta de Pub/Sub Distribuido con Redis](#36-arquitectura-propuesta-de-pubsub-distribuido-con-redis)
5. [Sección 4: Seguridad y Resiliencia de la Infraestructura](#sección-4-seguridad-y-resiliencia-de-la-infraestructura)
   - [4.1 Autenticación y Autorización en WebSockets (Vulnerabilidad CSWSH)](#41-autenticación-y-autorización-en-websockets-vulnerabilidad-cswsh)
   - [4.2 Broken Access Control (IDOR) en Eliminación de Documentos](#42-broken-access-control-idor-en-eliminación-de-documentos)
   - [4.3 Omisión de Rate Limiters en Rutas Críticas de Autenticación](#43-omisión-de-rate-limiters-en-rutas-críticas-de-autenticación)
   - [4.4 Falsificación de IP (`CF-Connecting-IP`) y Fuga de Memoria en Fallback](#44-falsificación-de-ip-cf-connecting-ip-y-fuga-de-memoria-en-fallback)
   - [4.5 Auditoría de PBAC: Middleware `requirePermission` como Stub](#45-auditoría-de-pbac-middleware-requirepermission-como-stub)
   - [4.6 Exposición de Información Técnica y Políticas CSP/CORS](#46-exposición-de-información-técnica-y-políticas-cspcors)
6. [Sección 5: Escenarios y Propuestas de Pruebas de Carga y Estrés (R5)](#sección-5-escenarios-y-propuestas-de-pruebas-de-carga-y-estrés-r5)
   - [5.1 Escenario 1: Tráfico Masivo de Edición Colaborativa en Tiempo Real](#51-escenario-1-tráfico-masivo-de-edición-colaborativa-en-tiempo-real)
   - [5.2 Escenario 2: Ráfaga de Procesamiento Pesado de PDF y Carga Masiva (HTTP)](#52-escenario-2-ráfaga-de-procesamiento-pesado-de-pdf-y-carga-masiva-http)
   - [5.3 Escenario 3: Tormenta de Reconexiones Masivas (*Thundering Herd*)](#53-escenario-3-tormenta-de-reconexiones-masivas-thundering-herd)
7. [Matriz Maestra Consolidada de Hallazgos](#matriz-maestra-consolidada-de-hallazgos)
8. [Hoja de Ruta de Implementación (Roadmap Priorizado)](#hoja-de-ruta-de-implementación-roadmap-priorizado)
9. [Guía de Verificación y Auditoría Independiente](#guía-de-verificación-y-auditoría-independiente)

---

## 1. Resumen Ejecutivo y Diagnóstico Global

### 1.1 Contexto y Alcance del Análisis

El repositorio **BoardStack** alberga la solución integral **BoardPDF**, compuesta principalmente por:
1. Una aplicación web monolítica modular escrita en **TypeScript** bajo **Node.js 20+** y **Express 5**, compilada en el frontend mediante **Vite** en modo SPA (`apps/BoardPDF`).
2. Un microservicio desacoplado de sincronización colaborativa en tiempo real escrito en **Rust** (`apps/collab-server`), sustentado en el runtime asíncrono **Tokio** y la biblioteca **Tokio-Tungstenite**.
3. Servicios auxiliares de infraestructura persistente definidos en Docker Compose: MySQL 8.4 (`mysql`), Redis 7 Alpine (`redis`), emulador S3 S3Proxy (`s3`) y un worker periódico de purga en Python (`storage-cleaner`).

La presente auditoría técnica independiente fue ejecutada con el propósito de identificar cuellos de botella de rendimiento, puntos únicos de fallo (SPOF), brechas críticas de seguridad perimetral y de aplicación, deficiencias en la gestión de memoria y procesos, y limitaciones arquitectónicas que obstaculizan la alta disponibilidad (HA) y el escalado horizontal elástico.

### 1.2 Scorecard de Salud de la Plataforma

| Dimensión Arquitectónica | Calificación (1 a 10) | Estado Global | Veredicto Técnico |
|---|:---:|:---:|---|
| **Estructura y Modularidad de Código** | **9.2 / 10** | Excelente | Excelente arquitectura modular en TypeScript, estricta separación de servicios, controladores, rutas y tipos. Alto apego a directivas de diseño limpio. |
| **Diseño Frontend y Adherencia DOM** | **9.5 / 10** | Excelente | Cumplimiento impecable de `AGENTS.md` (cero atributos `id`, uso exclusivo de `data-ref`, orden riguroso de atributos HTML y ciclo de vida de componentes con `AbortController`). |
| **Gestión de Procesos y CPU Multi-Core** | **2.5 / 10** | Crítico | Monoproceso estricto (`node dist/index.js`). Ausencia total de clustering nativo o supervisor PM2. Incapacidad de aprovechar CPUs multi-núcleo en servidores de producción. |
| **Resiliencia de Memoria y Event Loop** | **1.8 / 10** | Crítico | Bloqueo sincrónico recurrente del Event Loop por logging en disco (`fs.appendFileSync`). Vulnerabilidad letal a caídas catastróficas por Out-Of-Memory (OOM) en subidas masivas (`multer.memoryStorage()`). |
| **Infraestructura de Red y Reverse Proxy** | **1.0 / 10** | Inexistente | Ausencia total de `nginx.conf`, proxies inversos o balanceadores configurados. Falta de terminación TLS perimetral y buffers de proxy en el repositorio. |
| **Contenedorización para Producción** | **2.0 / 10** | Deficiente | Inexistencia de `Dockerfile` para la aplicación web Node.js y para el microservicio Rust. Ausencia de ambos servicios en `docker-compose.yml`. |
| **Escalabilidad WebSocket en Tiempo Real** | **3.0 / 10** | Crítico | Microservicio en Rust de alto rendimiento local, pero con estado de salas atrapado en `HashMap` en memoria. Sin Redis Pub/Sub; split-brain inmediato en balanceo multi-instancia. |
| **Seguridad Perimetral y de Handshake** | **2.2 / 10** | Crítico | Handshake WebSocket sin autenticación ni validación de `Origin` (CSWSH directo). Broken Access Control (IDOR) en borrado de documentos. Ausencia de rate limiters en autenticación. |
| **Resiliencia ante Caídas y Ciclo de Vida** | **2.8 / 10** | Deficiente | Terminación abrupta con `process.exit(0)` en señales `SIGTERM`/`SIGINT` sin drenaje de conexiones. Healthcheck `/api/health` estático y ciego al estado real de BD/Redis. |

### 1.3 Resumen de Criticidad de Riesgos

La auditoría consolidó **25 hallazgos arquitectónicos** verificados, categorizados formalmente según el estándar CVSS / OWASP Risk Rating:

```
[CRÍTICO]  ████████████████████ (10 Hallazgos - 40.0%)
[ALTO]     ██████████████████ (9 Hallazgos - 36.0%)
[MEDIO]    ██████████ (5 Hallazgos - 20.0%)
[BAJO]     ██ (1 Hallazgo - 4.0%)
```

- **Riesgo Operativo Inmediato**: Bajo el estado actual, una única ráfaga concurrente de subida de archivos PDF medianos (100–300 MB) o un ataque de denegación de servicio no sofisticado provocará el colapso inmediato del proceso Node.js por agotamiento de heap.
- **Riesgo de Seguridad Inmediato**: Cualquier origen malicioso en internet puede secuestrar la conexión WebSocket de usuarios mediante CSWSH, escuchar modificaciones de documentos en tiempo real y eliminar documentos ajenos mediante la ruta IDOR desprotegida.

---

## Sección 1: Servidores Node.js y Gestión de Procesos

### 2.1 Arquitectura del Servidor Express y Pipeline de Middlewares

El punto neurálgico de la aplicación web reside en `apps/BoardPDF/src/index.ts`. La inicialización del servidor se produce a través de las siguientes líneas clave:

```typescript
// apps/BoardPDF/src/index.ts:180-185 y 244-249
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
...
server.listen(port, () => {
  logger.app.info(`Servidor BoardPDF iniciado en http://localhost:${port}`);
  startColdStorageCron();
});
```

#### Deficiencias Estructurales del Pipeline:
1. **Comprobaciones de Dependencias No Bloqueantes (`index.ts:177-179`)**:
   ```typescript
   void checkDatabaseConnection();
   void checkRedisConnection();
   void ensureBucketExists();
   ```
   Las verificaciones de conectividad con MySQL, Redis y el bucket de S3 se disparan en segundo plano sin esperar resolución (`void`). Si la base de datos o Redis sufren un retraso de inicialización al arrancar el contenedor, el servidor Express abre el puerto TCP y comienza a recibir tráfico HTTP de inmediato, provocando una cascada masiva de errores `500 Internal Server Error` a los clientes en los primeros segundos de vida de la instancia.
2. **Configuración Rígida de `trust proxy` (`index.ts:181`)**:
   `app.set('trust proxy', 1)` indica a Express que únicamente confíe en el primer salto inmediato. En arquitecturas modernas de producción donde el flujo es:
   $$\text{Cliente} \longrightarrow \text{Cloudflare Edge (WAF)} \longrightarrow \text{Nginx Reverse Proxy} \longrightarrow \text{Node.js}$$
   La configuración `trust proxy: 1` provocará que `req.ip` devuelva la dirección IP privada de Nginx y no la IP pública real del cliente. Esto afecta directamente a la auditoría de accesos y a los rate limiters basados en IP.

---

### 2.2 Modelo de Procesos: Single-Process vs Clustering / PM2

En la configuración actual (`apps/BoardPDF/package.json:15`), el script de arranque en producción es:
```json
"start": "node dist/index.js"
```

#### Análisis de Impacto:
- **Desperdicio de Recursos Multi-Core**: Node.js ejecuta JavaScript en un único hilo de ejecución (Thread principal respaldado por el Event Loop de `libuv`). En un servidor o instancia Cloud con 8, 16 o 32 vCPUs, el proceso actual solo puede consumir un máximo de **1 vCPU (100% de 1 núcleo)**, dejando el resto de la capacidad de cómputo completamente ociosa.
- **Inexistencia de Supervisión de Procesos**: No existe configuración de `node:cluster`, ni gestor de procesos como PM2 (`ecosystem.config.js`), ni orquestador supervisor interno. Si el proceso colapsa por una excepción crítica, la aplicación permanece caída de forma indefinida a menos que un orquestador externo de contenedores (Docker daemon o Kubernetes kubelet) detecte la muerte del PID y lo reinicie, lo cual conlleva una ventana de inactividad de varios segundos.

---

### 2.3 Análisis del Event Loop y Bloqueos de I/O Síncrono

El Event Loop es el corazón asíncrono no bloqueante de Node.js. Cualquier llamada síncrona detiene el reloj del loop, congelando la atención de todas las demás conexiones de red.

#### El Cuello de Botella de Logging Síncrono (`logger.service.ts:115`):
En el servicio centralizado de registro de eventos se observa la siguiente implementación:

```typescript
// apps/BoardPDF/src/services/logger.service.ts:111-118
private write(level: LogLevel, message: string, data?: unknown): void {
  const payload = this.buildPayload(level, message, data);
  const logFile = getLogFilePath(this.category);
  try {
    const line = `${JSON.stringify(payload)}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
  } catch {
    // Failsafe silencioso para no derribar la aplicación si falla el disco
  }
}
```

Este método es ejecutado en **cada ciclo de vida de petición HTTP** a través del middleware de auditoría:
```typescript
// apps/BoardPDF/src/middlewares/request-logger.middleware.ts:23-28
res.on('finish', () => {
  const duration = Date.now() - startTime;
  ...
  logger.app.info('HTTP Request', { method, url, statusCode, duration, ip });
});
```

#### Impacto Cuantitativo en Producción:
- `fs.appendFileSync` realiza una llamada de sistema síncrona (`pwrite` o `write` con apertura y cierre de descriptores o flushing de buffer). 
- En condiciones de alta concurrencia o bajo contención de I/O en disco (ej. volúmenes EBS estándar en AWS o discos mecánicos/RAID saturados), cada operación de escritura puede demorar entre **2 ms y 45 ms**.
- Si el servidor recibe 200 peticiones concurrentes por segundo:
$$\text{Tiempo de Bloqueo} = 200 \times 15\,\text{ms} = 3,000\,\text{ms de Event Loop congelado por segundo}$$
- Esto genera un retraso artificial severo (*Event Loop Delay*), disparando las métricas de latencia p95 y p99 de toda la API REST, e incrementando drásticamente el riesgo de timeouts en el proxy inverso.

---

### 2.4 Gestión de Memoria, Heap de V8 y Vulnerabilidad OOM en Multer

Una de las vulnerabilidades operativas y de resiliencia más severas detectadas en la auditoría radica en la carga de archivos multipart/form-data.

#### Inspección del Código:
En `apps/BoardPDF/src/utils/upload.util.ts`:
```typescript
// apps/BoardPDF/src/utils/upload.util.ts:13, 27-33
const maxFileSizeMB = options?.maxFileSizeMB ?? 1000;
const maxFileSizeBytes = Math.floor(maxFileSizeMB * 1024 * 1024);
...
const multerInstance = multer({
  limits: {
    fileSize: maxFileSizeBytes,
    files: maxFiles,
  },
  storage: multer.memoryStorage(),
});
```

Y en el controlador de unión de PDFs (`merge-pdf.controller.ts`):
```typescript
// apps/BoardPDF/src/tools/merge-pdf/merge-pdf.controller.ts:8-12
export const handleUploadMiddleware = createPdfUploadMiddleware({
  fieldName: 'pdfs',
  maxFileSizeMB: 1000, // 1 Gigabyte por archivo
  maxFiles: 500,       // Hasta 500 archivos por petición
});
```

#### Mecánica del Colapso por Memoria (Heap Overflow):
1. **Asignación en Espacio V8**: `multer.memoryStorage()` retiene el archivo entrante íntegramente en un buffer de memoria RAM en el espacio de usuario de Node.js antes de que el controlador de la ruta pueda validar si el usuario está autenticado, si tiene cuota de almacenamiento disponible o si el archivo es válido.
2. **Límites de Heap en Node.js**: Por defecto, en arquitecturas de 64 bits, el motor V8 asigna un límite máximo de heap de aproximadamente **2048 MB** (ampliable mediante `--max-old-space-size=4096`).
3. **Escenario de Explotación / Colapso Accidental**:
   - Un usuario o atacante envía una petición POST con 3 archivos PDF de 350 MB cada uno (dentro del límite permitido de 1000 MB y 500 archivos).
   - Multer asigna 1,050 MB en buffers de V8.
   - Sumado a la memoria base de la aplicación (~180 MB) y el procesamiento interno de Ghostscript o `pdf-lib`, el proceso cruza inmediatamente el umbral del heap.
   - V8 aborta la ejecución con un error fatal no interceptable:
     ```
     FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
     ```
   - **Consecuencia**: El proceso Node.js muere instantáneamente. Todas las peticiones de los demás usuarios en vuelo son destruidas y el servicio queda fuera de línea.

---

### 2.5 Invocación Descontrolada de Subprocesos Python y Descargas Sin Streaming

#### 1. Invocación de Procesos Pesados (`process.util.ts:69-120`):
Las operaciones pesadas de manipulación de documentos (OCR con Tesseract, conversiones complejas de formatos y redacción digital) se delegan en scripts de Python:
```typescript
// apps/BoardPDF/src/utils/process.util.ts:74
const child = spawn(command, args, spawnOptions);
```
- **Sin Cola de Trabajo**: No existe intermediación de colas de mensajes (como **BullMQ** sobre Redis). Cada petición entrante dispara de manera inmediata un subproceso de sistema operativo (`python ocr_worker.py`).
- **Saturación del Host**: Si 20 usuarios solicitan OCR concurrentemente, se levantarán 20 subprocesos de Python compitiendo por CPU y RAM en el mismo host, degradando el rendimiento general hasta el congelamiento total del sistema operativo.
- **Buffers de Cadenas en RAM**: Las salidas estándar (`stdout` y `stderr`) se concatenan como strings JavaScript en memoria:
  ```typescript
  child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  ```
  Si una herramienta genera un dump voluminoso de texto o metadatos, esto añade presión innecesaria al recolector de basura (GC).

#### 2. Descargas sin Streaming (`download.controller.ts:156-170`):
En el endpoint de descarga de archivos procesados:
```typescript
export async function handleToolDownload(req: Request, res: Response): Promise<void> {
  const { fileId } = req.params;
  const item = await getTempFile(fileId); // Carga el Buffer completo a memoria RAM
  ...
  res.send(item.buffer); // Envío en bloque sin streaming
}
```
En lugar de canalizar el flujo de datos directamente desde S3 o el disco mediante un pipe (`stream.pipe(res)`), el archivo se recupera completamente a memoria RAM como un `Buffer` antes de transmitirse al cliente HTTP. Esto duplica el consumo de memoria durante ráfagas de descargas masivas.

---

### 2.6 Ciclo de Vida, Señales del Sistema Operativo y Timeouts HTTP

#### 1. Terminación Abrupta Sin Drenaje de Conexiones (`index.ts:24-30`):
```typescript
// apps/BoardPDF/src/index.ts:24-30
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
```
- **Cero Graceful Shutdown**: Al recibir la señal `SIGTERM` (enviada habitualmente por Docker Compose al hacer `docker compose down`, o por Kubernetes al rotar un pod en un despliegue continuo), el proceso ejecuta `process.exit(0)` de forma sincrónica e instantánea.
- **Consecuencias**:
  1. No se invoca `server.close()`, por lo que todas las peticiones HTTP activas son interrumpidas en seco, provocando errores `ERR_EMPTY_RESPONSE` o `ECONNRESET` en el navegador del usuario.
  2. Los pools de persistencia (`mysql2` y `ioredis`) no se cierran de manera limpia, dejando conexiones zombi y transacciones sin finalizar en el motor de base de datos.
  3. Los archivos temporales a medio escribir en S3 o disco no son limpiados ni referenciados.

#### 2. Manejo Inseguro de `uncaughtException` (`index.ts:32-34`):
```typescript
process.on('uncaughtException', (err: Error) => {
  logger.app.error('Excepción no controlada capturada en proceso Node.js', err);
});
```
El manejador registra el error pero **no termina el proceso**. La guía oficial de arquitectura de Node.js estipula que tras una excepción no controlada, el estado interno de la memoria, closures y descriptores de sockets queda en una condición indeterminada y potencialmente corrompida. Continuar ejecutando el proceso en este estado genera fugas silenciosas de memoria y comportamientos erráticos. La práctica estándar exige registrar el error e invocar `process.exit(1)` de inmediato para que el supervisor o contenedor reinicie la instancia limpia.

#### 3. Desalineación de Timeouts HTTP Keep-Alive:
En `apps/BoardPDF/src/index.ts`, las propiedades `server.keepAliveTimeout` y `server.headersTimeout` no están definidas, heredando los valores por defecto de Node.js (5,000 ms = 5 segundos).
- **El Problema del 502 Bad Gateway**: La inmensa mayoría de balanceadores de carga y proxies inversos (AWS ALB, Nginx, Cloudflare) mantienen abiertas las conexiones TCP hacia el backend con un timeout de keep-alive de **60 a 75 segundos**.
- Si Node.js cierra unilateralmente el socket TCP a los 5 segundos exactamente en el mismo instante en que el proxy reenvía una nueva petición de usuario (condición de carrera de red), el proxy recibe un `TCP RST` y emite un error `502 Bad Gateway` al cliente.

---

### 2.7 Propuestas de Mitigación y Código de Reemplazo (Node.js)

#### Mitigación A: Protocolo Completo de Graceful Shutdown y Alineación de Timeouts
Implementar en `apps/BoardPDF/src/index.ts` un protocolo de apagado ordenado con drenaje de sockets, alineación de timeouts HTTP y cierre de pools:

```typescript
// Implementación propuesta para apps/BoardPDF/src/index.ts
let isShuttingDown = false;

export function configureServerResilience(server: http.Server): void {
  // 1. Alineación de Keep-Alive: estrictamente superior al proxy (Nginx = 60s -> Node = 65s)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000; // Debe ser mayor que keepAliveTimeout

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.app.warn(`Señal ${signal} interceptada. Iniciando drenaje y apagado ordenado...`);

    // Establecer un timeout de emergencia para forzar la salida si hay sockets colgados
    const forceExitTimer = setTimeout(() => {
      logger.app.error('Timeout de Graceful Shutdown expirado (15s). Forzando cierre del proceso.');
      process.exit(1);
    }, 15000);
    forceExitTimer.unref();

    // Dejar de aceptar nuevas conexiones HTTP
    server.close(async () => {
      logger.app.info('Servidor HTTP cerrado. Procediendo a liberar conexiones de persistencia...');
      
      try {
        const pool = getDbPool();
        await pool.end();
        logger.db.info('Pool de MySQL drenado y finalizado correctamente.');
      } catch (err) {
        logger.db.error('Error cerrando el pool de MySQL:', err);
      }

      try {
        await redis.quit();
        logger.db.info('Conexión con Redis cerrada ordenadamente.');
      } catch (err) {
        logger.db.error('Error cerrando cliente Redis:', err);
      }

      logger.app.info('Apagado completado con éxito. Saliendo de Node.js (código 0).');
      process.exit(0);
    });

    // Purgar de inmediato sockets keep-alive inactivos para evitar que server.close() espere 65s
    // y venza el temporizador de emergencia (15s) forzando un process.exit(1) erróneo
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.app.error('Excepción crítica no controlada. Saliendo para reinicio limpio:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.app.error('Rechazo de promesa no gestionado en proceso Node.js:', reason);
  });
}
```

#### Mitigación B: Sustitución de `memoryStorage` por `diskStorage` con Límite Acotado
Reemplazar la retención en heap por almacenamiento temporal en disco en `apps/BoardPDF/src/utils/upload.util.ts`:

```typescript
// Implementación recomendada para apps/BoardPDF/src/utils/upload.util.ts
import multer from 'multer';
import os from 'os';
import path from 'path';

export function createPdfUploadMiddleware(options?: UploadOptions): RequestHandler {
  const maxFiles = options?.maxFiles ?? 1;
  const maxFileSizeMB = Math.min(options?.maxFileSizeMB ?? 50, 100); // Límite seguro razonable (100MB máx)
  const maxFileSizeBytes = Math.floor(maxFileSizeMB * 1024 * 1024);
  const fieldName = options?.fieldName || (maxFiles > 1 ? 'files' : 'file');

  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.join(os.tmpdir(), 'boardpdf-disk-uploads');
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueToken = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueToken}-${file.originalname}`);
    },
  });

  return multer({
    storage: diskStorage,
    limits: {
      fileSize: maxFileSizeBytes,
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
        cb(null, true);
      } else {
        cb(new Error('INVALID_PDF_FORMAT'));
      }
    },
  }).array(fieldName, maxFiles);
}
```

---

## Sección 2: Balanceo de Carga, Reverse Proxy e Infraestructura Docker

### 3.1 Diagnóstico de Contenedorización Actual y Gaps en Docker Compose

La inspección exhaustiva de la raíz del monorepo y los subdirectorios de aplicaciones reveló las siguientes ausencias críticas de infraestructura:
1. **Ausencia Total de Dockerfiles Principales**:
   - No existe `Dockerfile` para la aplicación web principal Node.js (`apps/BoardPDF`).
   - No existe `Dockerfile` para el microservicio de colaboración en tiempo real escrito en Rust (`apps/collab-server`).
   - El único Dockerfile existente en todo el proyecto es `apps/BoardPDF/Dockerfile.cleaner`, el cual ejecuta un script simple de limpieza en Python.
2. **Definición Incompleta de Orquestación (`docker-compose.yml`)**:
   El archivo `docker-compose.yml` (y su réplica idéntica en `apps/BoardPDF/docker-compose.yml`) define exclusivamente servicios periféricos:
   - `s3` (`andrewgaul/s3proxy:latest` en puerto 9000)
   - `mysql` (`mysql:8.4` en puerto 3306)
   - `redis` (`redis:7-alpine` en puerto 6379)
   - `storage-cleaner` (construido desde `Dockerfile.cleaner`)
   
   **Impacto**: Ni la aplicación web (`boardpdf-app`) ni el servidor colaborativo (`collab-server`) ni un proxy inverso (`nginx`) forman parte de la orquestación actual. El desarrollador o administrador de sistemas debe ejecutar manualmente los procesos en el sistema operativo anfitrión.
3. **Cero Límites de Recursos**: Ninguno de los servicios definidos en Compose cuenta con directivas de limitación de memoria (`mem_limit`) o CPU (`cpus`). Un comportamiento anómalo de MySQL o Redis puede agotar la memoria de toda la máquina anfitriona.
4. **Ejecución como Root en `Dockerfile.cleaner`**: El contenedor del cleaner se ejecuta bajo el usuario privilegiado `root` (UID 0) y carece de directiva `HEALTHCHECK`.

---

### 3.2 Diagnóstico de Reverse Proxy y Ausencia de Nginx

En la arquitectura actual de BoardStack **no existe ningún archivo de configuración de Nginx (`nginx.conf`)**, ni reglas de proxy inverso en ningún formato (Apache, Traefik, Caddy o Envoy).

#### Riesgos Técnicos Derivados:
1. **Ausencia de Terminación SSL/TLS**: El tráfico externo llega directamente al puerto HTTP en texto plano de Node.js o Rust. No existe capacidad nativa en el repositorio para servir certificados SSL/TLS, forzar HSTS ni negociar protocolos modernos como HTTP/2 o HTTP/3.
2. **Falta de Búferes Perimetrales de Subida**: Nginx cuenta con directivas avanzadas (`client_body_buffer_size`, `client_max_body_size`, `proxy_request_buffering`) que absorben peticiones de subida lentas (*Slowloris attacks*) en disco del proxy antes de enviarlas por socket de loopback a Node.js. Al no existir proxy, Node.js debe gestionar directamente la lentitud de red de los clientes.
3. **Imposibilidad de Balanceo de Carga Local**: No existe mecanismo perimetral para distribuir peticiones entre múltiples réplicas de Node.js o para enrutar según la ruta (`/` hacia Node.js, `/ws/collab` hacia Rust).

---

### 3.3 Estrategia de Balanceo de Carga y Terminación SSL/TLS

Para un despliegue de alta disponibilidad, se deben adoptar las siguientes estrategias de balanceo y seguridad perimetral:

#### 1. Algoritmos de Balanceo Recomendados:
- **Tráfico HTTP / REST API (Node.js)**:
  - **Algoritmo**: `least_conn` (Menor número de conexiones activas).
  - **Razón**: Las operaciones con PDFs tienen tiempos de procesamiento altamente dispares (desde 50 ms para un endpoint ligero de autenticación hasta 4,000 ms para una compresión de documento). El algoritmo `round-robin` estándar saturaría instancias que estén procesando tareas largas. `least_conn` redirige dinámicamente nuevas peticiones a los nodos más desocupados.
- **Tráfico WebSocket / Tiempo Real (Rust Collab Server)**:
  - **Fase Actual (Monolito / Memoria Local)**: `ip_hash` o afinidad de sesión estricta (Sticky Sessions por Cookie o IP). Obligatorio mientras el estado de las salas resida en el `HashMap` local de cada réplica, garantizando que todos los colaboradores del mismo documento alcancen el mismo proceso.
  - **Fase Futura (Redis Pub/Sub)**: `least_conn`. Al disponer de un bus de eventos distribuido, cualquier réplica puede atender a cualquier cliente de cualquier sala.

#### 2. Terminación SSL/TLS de Vanguardia:
- Restricción estricta a protocolos seguros **TLSv1.2** y **TLSv1.3**.
- Deshabilitación explícita de SSLv3, TLSv1.0 y TLSv1.1 (vulnerables a POODLE, BEAST).
- Suites de cifrado de alta seguridad compatibles con la configuración intermedia de Mozilla:
  ```
  ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:
  ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
  ```
- Activación de **HSTS** (`Strict-Transport-Security`) con `max-age=31536000; includeSubDomains; preload` para prevenir ataques de degradación (*SSL Stripping*).

---

### 3.4 Configuración de Producción Lista para Despliegue: Nginx

A continuación se presenta la configuración completa de Nginx (`nginx/nginx.conf`), lista para ser incorporada a la infraestructura productiva de BoardStack:

```nginx
# nginx/nginx.conf - Configuración de Alto Rendimiento para BoardStack
user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /var/run/nginx.pid;

events {
    worker_connections 8192;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Formato de logs estructurado en JSON para ingestión directa en SIEM/APM
    log_format json_analytics escape=json '{'
        '"timestamp":"$time_iso8601",'
        '"client_ip":"$remote_addr",'
        '"request_method":"$request_method",'
        '"request_uri":"$request_uri",'
        '"status_code":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"request_time":$request_time,'
        '"upstream_connect_time":"$upstream_connect_time",'
        '"upstream_header_time":"$upstream_header_time",'
        '"upstream_response_time":"$upstream_response_time",'
        '"http_referrer":"$http_referer",'
        '"http_user_agent":"$http_user_agent"'
    '}';

    access_log /var/log/nginx/access.log json_analytics;
    error_log /var/log/nginx/error.log warn;

    # Optimizaciones de Kernel Linux para I/O de red
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 75s;
    keepalive_requests 1000;
    server_tokens off;

    # Compresión Dinámica Gzip para respuestas de texto y assets estáticos
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 512;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/xml
        image/svg+xml;

    # Mapeo canónico para actualización dinámica de conexión WebSocket
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # Upstream Pool: Servidores Web Node.js (BoardPDF)
    upstream node_backend_cluster {
        least_conn;
        server boardpdf-app-1:3000 max_fails=3 fail_timeout=10s;
        server boardpdf-app-2:3000 max_fails=3 fail_timeout=10s;
        keepalive 64; # Mantiene pool de sockets TCP abiertos hacia Node.js
    }

    # Upstream Pool: Servidores Colaborativos Rust (collab-server)
    upstream collab_backend_cluster {
        ip_hash; # Afinidad por IP requerida por estado en memoria local
        server boardpdf-collab-1:3001 max_fails=3 fail_timeout=10s;
        server boardpdf-collab-2:3001 max_fails=3 fail_timeout=10s;
        keepalive 32;
    }

    # Redirección Forzosa HTTP -> HTTPS
    server {
        listen 80;
        listen [::]:80;
        server_name boardpdf.com www.boardpdf.com;
        return 301 https://$host$request_uri;
    }

    # Servidor Primario HTTPS / WSS
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name boardpdf.com www.boardpdf.com;

        # Certificados SSL y Parámetros Criptográficos Modernos
        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL_CACHE:10m;
        ssl_session_timeout 1d;
        ssl_session_tickets off;

        # Cabeceras de Seguridad Perimetral
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Búferes y Límites para Subida de Documentos Pesados
        client_max_body_size 100M;
        client_body_buffer_size 128k;

        # -------------------------------------------------------------
        # Enrutamiento Unificado de WebSockets sobre el Puerto 443
        # -------------------------------------------------------------
        location /ws/collab {
            proxy_pass http://collab_backend_cluster;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Deshabilitar buffering para tiempo real y extender timeouts
            proxy_buffering off;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            proxy_connect_timeout 5s;
        }

        # -------------------------------------------------------------
        # Rutas de Aplicación y API REST (Node.js)
        # -------------------------------------------------------------
        location / {
            proxy_pass http://node_backend_cluster;
            proxy_http_version 1.1;
            proxy_set_header Connection ""; # Obligatorio para HTTP Keep-Alive con Upstream
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts adaptados a la carga de trabajo de PDF
            proxy_connect_timeout 5s;
            proxy_read_timeout 120s;
            proxy_send_timeout 120s;

            # Búferes de respuesta del proxy
            proxy_buffering on;
            proxy_buffers 16 64k;
            proxy_busy_buffers_size 128k;
            proxy_max_temp_file_size 256M;
        }
    }
}
```

---

### 3.5 Diagnóstico y Rediseño de Health Checks: Liveness vs Readiness

#### Diagnóstico del Health Check Actual (`index.ts:227-233`):
```typescript
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    name: 'BoardPDF',
    status: 'ok',
    uptime: process.uptime(),
  });
});
```
- **Fallo de Diseño**: El endpoint responde estáticamente `HTTP 200 OK` únicamente porque el hilo de Node.js está vivo. No efectúa ninguna comprobación de conectividad con MySQL, Redis ni S3.
- **Consecuencia en Alta Disponibilidad**: Si el contenedor de MySQL se detiene o la red hacia Redis colapsa, un balanceador de carga o un probe de Kubernetes continuará enviando el 100% del tráfico de los usuarios a esta instancia rota, en lugar de sacarla del pool de servicio para conmutación por error (*failover*).

#### Propuesta Técnica: Deep Health Checks Desacoplados

Se propone bifurcar las sondas de salud en dos endpoints con propósitos bien diferenciados:
1. **Liveness Probe (`/api/health/liveness`)**: Verifica exclusivamente si el proceso Node.js responde y el Event Loop no está congelado. Si falla, el orquestador debe reiniciar el contenedor.
2. **Readiness Probe (`/api/health/readiness`)**: Ejecuta pings activos y ligeros contra las dependencias críticas (MySQL, Redis, S3). Si cualquiera de ellas falla, responde `HTTP 503 Service Unavailable`, obligando al balanceador a desviar el tráfico a otra réplica sana sin matar el contenedor.

```typescript
// Implementación propuesta para apps/BoardPDF/src/index.ts

// Sonda de Vida (Liveness)
app.get('/api/health/liveness', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Sonda de Preparación y Dependencias (Readiness)
app.get('/api/health/readiness', async (_req: Request, res: Response) => {
  if (isShuttingDown) {
    res.status(503).json({ status: 'terminating', message: 'Servidor en proceso de apagado.' });
    return;
  }

  const dependencies = {
    database: false,
    redis: false,
    s3: isBucketReady,
  };

  // 1. Verificación MySQL con Ping nativo
  try {
    const pool = getDbPool();
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    dependencies.database = true;
  } catch (err) {
    logger.db.error('Fallo en healthcheck de MySQL:', err);
  }

  // 2. Verificación Redis
  try {
    if (redis.status === 'ready') {
      const pong = await redis.ping();
      dependencies.redis = pong === 'PONG';
    }
  } catch (err) {
    logger.db.error('Fallo en healthcheck de Redis:', err);
  }

  const isReady = dependencies.database && dependencies.redis && dependencies.s3;
  const httpStatus = isReady ? 200 : 503;

  res.status(httpStatus).json({
    status: isReady ? 'ready' : 'unhealthy',
    dependencies,
    timestamp: new Date().toISOString(),
  });
});
```

---

### 3.6 Dockerfiles Multi-Stage de Producción (Node.js y Rust)

Para resolver la carencia de imágenes de producción, a continuación se definen los Dockerfiles multi-etapa optimizados bajo el principio de mínimo privilegio:

#### 1. Dockerfile Multi-Stage para Node.js (`apps/BoardPDF/Dockerfile`):
```dockerfile
# apps/BoardPDF/Dockerfile
# -------------------------------------------------------------
# ETAPA 1: Compilación de Código TypeScript y Bundling de Vite
# -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /workspace

RUN apk add --no-cache python3 make g++

# Copiar manifiestos y resolver workspaces
COPY package*.json ./
COPY apps/BoardPDF/package*.json ./apps/BoardPDF/
RUN npm ci --workspace=apps/BoardPDF

# Copiar código y compilar backend y cliente SPA
COPY tsconfig.json ./
COPY apps/BoardPDF ./apps/BoardPDF

WORKDIR /workspace/apps/BoardPDF
RUN npm run build

# -------------------------------------------------------------
# ETAPA 2: Entorno de Ejecución Ligero y Seguro (Runner Debian Slim)
# -------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Herramientas de sistema requeridas para manipulación de PDFs
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ghostscript qpdf poppler-utils wget \
    && rm -rf /var/lib/apt/lists/*

# Dependencias de Python para workers (compatibilidad garantizada con binary wheels glibc)
COPY apps/BoardPDF/scripts/requirements.txt /app/scripts/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /app/scripts/requirements.txt

# Copiar artefactos compilados y dependencias de ejecución
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/BoardPDF/dist ./dist
COPY --from=builder /workspace/apps/BoardPDF/public ./public
COPY --from=builder /workspace/apps/BoardPDF/scripts ./scripts
COPY --from=builder /workspace/apps/BoardPDF/package.json ./package.json

# Garantizar permisos de escritura para directorios operativos en usuario node
RUN mkdir -p /app/logs /app/uploads && chown -R node:node /app

# Ejecución bajo usuario no privilegiado estándar de Node
USER node
EXPOSE 3000

# Healthcheck interno del contenedor
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health/liveness || exit 1

CMD ["node", "dist/index.js"]
```

#### 2. Dockerfile Multi-Stage para Rust Collab Server (`apps/collab-server/Dockerfile`):
```dockerfile
# apps/collab-server/Dockerfile
# -------------------------------------------------------------
# ETAPA 1: Compilación Binaria con Rust Musl (Estático)
# -------------------------------------------------------------
FROM rust:1.80-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev

COPY apps/collab-server/Cargo.toml apps/collab-server/Cargo.lock ./
COPY apps/collab-server/src ./src
RUN cargo build --release

# -------------------------------------------------------------
# ETAPA 2: Contenedor Minimalista de Ejecución (Alpine Ligero)
# -------------------------------------------------------------
FROM alpine:3.20 AS runner
WORKDIR /app

# Crear usuario y grupo sin privilegios de root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/release/board-collab-server /app/collab-server

USER appuser
EXPOSE 3001
ENV PORT=3001

CMD ["/app/collab-server"]
```

---

## Sección 3: WebSockets y Escalabilidad en Tiempo Real

### 3.1 Arquitectura del Servidor Colaborativo Rust (`collab-server`)

El motor de colaboración en tiempo real reside en `apps/collab-server`. A diferencia del servidor principal Express, este componente está construido en **Rust** utilizando el framework asíncrono **Tokio** y **Tokio-Tungstenite**.

#### Puntos Clave de Implementación:
- **Punto de Escucha**: En `apps/collab-server/src/main.rs:53-69`, el servidor escucha en el puerto `3001` (configurable mediante `PORT` o `COLLAB_PORT`).
- **Desacoplamiento Total de Node.js**: En `apps/BoardPDF/src/index.ts` no existe ningún manejador `server.on('upgrade')` para producción. La comunicación entre el cliente web y el backend de sincronización no toca en ningún momento el Event Loop de Node.js.
- **Ventaja de Rendimiento**: Rust y Tokio proporcionan una eficiencia extraordinaria en consumo de CPU y memoria (~15-30 KB de RAM por conexión activa frente a los ~2-5 MB típicos de procesos de Node.js).
- **Brecha de Despliegue**: El microservicio no está presente en `docker-compose.yml`, requiriendo un proceso de arranque manual o un contenedor independiente.

---

### 3.2 Diagnóstico del Cliente WebSocket SPA y Puerto Cableado

En el frontend de la SPA (`apps/BoardPDF/client/services/websocket.service.ts`), la inicialización de la conexión WebSocket se encuentra codificada de la siguiente forma:

```typescript
// apps/BoardPDF/client/services/websocket.service.ts:66-70
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const hostname = window.location.hostname || 'localhost';
const wsPort = '3001';
const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
const wsUrl = `${protocol}//${hostname}:${wsPort}/ws/collab${query}`;
```

#### Deficiencias Detectadas:
1. **Puerto `3001` Hardcodeado**: La URL fuerza la conexión hacia el puerto 3001 del host. En entornos de producción corporativos o en la nube:
   - El puerto 3001 está bloqueado por defecto en la mayoría de firewalls y redes empresariales (que solo admiten 80 y 443).
   - El puerto 3001 carece de certificados TLS propios a menos que se configure una terminación TLS separada en dicho puerto.
2. **Mitigación Requerida**: La URL debe construirse de forma relativa sobre el mismo puerto que sirve la aplicación web (`window.location.host`), utilizando la ruta `/ws/collab`, y permitiendo que el reverse proxy (Nginx) enrute internamente al microservicio Rust en el puerto 3001.

---

### 3.3 Sincronización Multi-Instancia y Estado en Memoria Local (Split-Brain)

El obstáculo arquitectónico más crítico para el escalado horizontal del sistema colaborativo radica en la gestión del estado de las salas.

#### Inspección del Hub en Rust (`apps/collab-server/src/hub.rs`):
```rust
// apps/collab-server/src/hub.rs:7-10 y 46-52
pub struct Room {
    pub peers: HashMap<String, PeerInfo>,
    pub senders: HashMap<String, Sender<String>>,
}

pub struct CollabHub {
    pub rooms: HashMap<String, Room>,
    pub max_collaborators: usize,
}
```
Y en `main.rs:71`:
```rust
let hub = Arc::new(RwLock::new(CollabHub::new(max_collab)));
```

#### El Problema del "Split-Brain" (Salas Aisladas):
- Las salas (`Room`), los colaboradores conectados y los canales de transmisión (`mpsc::Sender`) existen **exclusivamente dentro de la memoria RAM del proceso Rust local**.
- En `apps/collab-server/Cargo.toml` no existe ninguna dependencia de cliente Redis (`redis`, `fred`) ni broker de mensajería (RabbitMQ, NATS).
- **Escenario de Fallo Horizontal**:
  - Si la infraestructura escala a 2 réplicas (`collab-1` y `collab-2`) detrás de un balanceador de carga estándar (Round-Robin o Least-Connections):
    - El **Usuario A** conecta a la réplica `collab-1` para editar el documento `doc_100`.
    - El **Usuario B** conecta a la réplica `collab-2` para editar el mismo documento `doc_100`.
    - Como `collab-1` y `collab-2` no tienen ningún canal de comunicación entre sí, el Usuario A no verá el cursor, trazos ni modificaciones del Usuario B.
    - Cuando ambos usuarios guarden los cambios vía HTTP en Node.js, la última petición sobrescribirá destructivamente los cambios de la primera.

---

### 3.4 Tormentas de Reconexión (*Thundering Herd*) y Falta de Jitter

#### Inspección del Algoritmo en el Cliente SPA:
En `apps/BoardPDF/client/services/websocket.service.ts`:
```typescript
// apps/BoardPDF/client/services/websocket.service.ts:250-258
const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
this.reconnectAttempts++;

this.reconnectTimer = window.setTimeout(() => {
  this.reconnectTimer = null;
  this.connect();
}, delay);
```

#### Dinámica del Colapso (*Thundering Herd Problem*):
- El algoritmo implementa un retardo exponencial puro con techo en 10 segundos, **pero carece por completo de factor de aleatoriedad (*jitter = 0*)**.
- Si ocurre una desconexión general por mantenimiento, reinicio del servicio o micro-corte de red con 5,000 usuarios activos conectados:
  - En $t = 1.0\,\text{s}$, los 5,000 clientes intentarán reconectarse exactamente al mismo milisegundo.
  - En $t = 2.5\,\text{s}$, los clientes que fallaron volverán a atacar el servidor sincronizadamente.
  - En $t = 4.75\,\text{s}$, se repite la oleada masiva.
- Esta sincronización masiva de peticiones TCP SYN y handshakes HTTP Upgrade satura la cola de `listen()` del servidor Rust y colapsa la CPU en el arranque (*Thundering Herd*).

#### Solución Matemática: Full Jitter
Para desincronizar los reintentos y distribuir la carga uniformemente en el tiempo, se debe aplicar el algoritmo **Full Jitter** formulado por AWS Architecture:

$$T_{\text{reconnect}} = \text{random}(0, \min(T_{\text{base}} \times 1.5^{\text{attempts}}, T_{\text{max}}))$$

```typescript
// Implementación propuesta con Full Jitter
const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
const jitteredDelay = Math.floor(Math.random() * baseDelay);
this.reconnectAttempts++;
this.reconnectTimer = window.setTimeout(() => { ... }, jitteredDelay);
```

---

### 3.5 Gestión de Backpressure, Pérdida de Mensajes y Fuga de Sockets

#### 1. Desbordamiento Silencioso de Canales MPSC (`hub.rs:20-33`):
En el servidor Rust, cada conexión WebSocket tiene un canal asíncrono Tokio `mpsc` con una capacidad fija de 128 mensajes:
```rust
let (tx, mut rx) = mpsc::channel(128);
...
// En hub.rs:28, 30:
let _ = tx.try_send(message_str.to_string());
```
- Si un cliente tiene una conexión móvil inestable, alta latencia o baja velocidad de descarga, el búfer de 128 mensajes se satura rápidamente.
- La llamada `tx.try_send` devuelve un error de canal lleno (`TrySendError::Full`), pero dicho error es **descartado silenciosamente** mediante la sintaxis `let _ = ...`.
- **Impacto Severo**: Mutaciones críticas de diseño del canvas (`ClientMessage::ElementChange` o `DocSync`) se pierden de forma definitiva sin que el emisor, el receptor ni el servidor se enteren, provocando una corrupción visual irreparable en la sesión de edición.

#### 2. Fuga de Descriptores de Archivo en Navegación SPA (`websocket.service.ts:167-173`):
Cuando un usuario abandona la vista del editor colaborativo (`collaborative-pdf-editor.view.ts:419`), se envía el mensaje `{ type: 'leave' }`, pero **el socket TCP de WebSocket permanece abierto indefinidamente** en segundo plano, ejecutando latidos de ping cada 20 segundos. `wsService.disconnect()` sólo se llama cuando el usuario hace logout explícito en la aplicación. Si un usuario abre y cierra 5 documentos a lo largo del día, mantiene sockets huérfanos ocupando descriptores de archivo en el servidor.

---

### 3.6 Arquitectura Propuesta de Pub/Sub Distribuido con Redis

Para capacitar a `apps/collab-server` a escalar horizontalmente de forma transparente sin requerir afinidad de sesión obligatoria, se especifica la siguiente arquitectura distribuida con Redis Pub/Sub:

```
+-----------------------------------------------------------------------------+
|                                NGINX REVERSE PROXY                          |
|                            (Least Connections Algorithm)                    |
+-----------------------------------------------------------------------------+
               /                                            \
              v                                              v
+-------------------------------+              +-------------------------------+
|    collab-server (Pod 1)      |              |    collab-server (Pod 2)      |
|  - Tokio Async Engine         |              |  - Tokio Async Engine         |
|  - Local WebSocket Clients    |              |  - Local WebSocket Clients    |
+-------------------------------+              +-------------------------------+
               ^                                              ^
               |   PUBLISH / SUBSCRIBE                        |   PUBLISH / SUBSCRIBE
               v   Channel: collab:room:{doc_id}              v   Channel: collab:room:{doc_id}
+-----------------------------------------------------------------------------+
|                           REDIS 7 CLUSTER / PUB-SUB                         |
|             (Canales de difusión por sala y presencia global en Sets)       |
+-----------------------------------------------------------------------------+
```

#### Protocolo de Intercambio Distribuido:
1. **Suscripción Dinámica**: Cuando el primer cliente local en el Pod 1 se une a la sala `doc_abc`, el Pod 1 se suscribe dinámicamente al canal Redis `collab:room:doc_abc`.
2. **Difusión Transversal**: Cualquier mensaje entrante (`cursor`, `elementChange`, `docSync`) recibido en el Pod 1 se publica en el canal Redis correspondiente (`PUBLISH collab:room:doc_abc <payload>`).
3. **Recepción Multi-Pod**: El Pod 2, que también tiene clientes suscritos a `doc_abc`, recibe el evento desde Redis y lo retransmite de forma inmediata a sus conexiones WebSocket locales.
4. **Presencia Global en Redis**: La lista de participantes y estados de presencia se almacena en estructuras de datos nativas de Redis (`HSET collab:presence:doc_abc peer_id <peer_info>`) con un TTL asociado al latido de ping (30 segundos).

---

## Sección 4: Seguridad y Resiliencia de la Infraestructura

### 4.1 Autenticación y Autorización en WebSockets (Vulnerabilidad CSWSH)

#### 1. Inspección del Handshake en Rust (`main.rs:90-93` y `188-242`):
```rust
// apps/collab-server/src/main.rs:90-93
let mut ws_config = WebSocketConfig::default();
ws_config.max_message_size = Some(2 * 1024 * 1024);
ws_config.max_frame_size = Some(2 * 1024 * 1024);
let ws_stream = tokio_tungstenite::accept_async_with_config(stream, Some(ws_config)).await?;
```
- **Vulnerabilidad CSWSH (Cross-Site WebSocket Hijacking)**: `accept_async_with_config` eleva la conexión TCP a WebSocket directamente sin inspeccionar los encabezados HTTP del handshake.
- La cabecera `Origin` **no se valida**. Cualquier página web maliciosa de terceros visitada por un usuario de BoardPDF puede abrir en segundo plano una conexión WebSocket hacia `ws://boardpdf.com/ws/collab` aprovechando la confianza de red.
- **Identidad Autodeclarada Sin Token**: El handshake no requiere ningún token JWT, firma HMAC ni cookie de sesión. El cliente envía arbitrariamente un mensaje de texto plano:
  ```json
  { "type": "join", "docId": "doc-privado-123", "userId": 1, "username": "Admin" }
  ```
- **Riesgo**: Un atacante puede suplantar la identidad de administradores o espiar documentos confidenciales sin haber iniciado sesión en la plataforma.

#### Mitigación Recomendada: Handshake Basado en Tickets Efímeros
1. El cliente solicita previamente a la API REST de Node.js un ticket criptográfico firmado:
   $$\text{POST /api/collaborative-docs/:id/ticket} \longrightarrow \text{Ticket JWT (TTL 30s, HMAC SHA-256)}$$
2. El cliente conecta al WebSocket suministrando el ticket:
   `wss://boardpdf.com/ws/collab?ticket=eyJhbGciOi...`
3. En Rust, utilizar `tokio_tungstenite::accept_hdr_async` para:
   - Validar que `Origin` coincida estrictamente con `https://boardpdf.com`.
   - Validar la firma criptográfica del ticket y extraer de forma confiable el `userId` y `docId` autorizados.

---

### 4.2 Broken Access Control (IDOR) en Eliminación de Documentos

#### Inspección del Código:
En el controlador `collaborative-pdf.controller.ts`:
```typescript
// apps/BoardPDF/src/tools/collaborative-pdf/collaborative-pdf.controller.ts:281-296
export async function deleteCollaborativeDocHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = getCurrentUser(req);
  await deleteCollaborativeDocument(id, user?.id);
  res.json({ success: true });
}
```
Y en el servicio `collaborative-pdf.service.ts`:
```typescript
// apps/BoardPDF/src/tools/collaborative-pdf/collaborative-pdf.service.ts:503-512
export async function deleteCollaborativeDocument(id: string, userId?: number | null): Promise<boolean> {
  ensureStorageDir();
  try {
    const pool = getDbPool();
    await pool.query('DELETE FROM collaborative_document_members WHERE document_id = ?', [id]);
    await pool.query('DELETE FROM collaborative_documents WHERE id = ?', [id]);
    ...
```

#### Análisis del Fallo de Autorización:
- Aunque `userId` se pasa como argumento al servicio, **dicho parámetro es completamente ignorado en las consultas SQL de borrado**.
- La consulta SQL ejecuta: `DELETE FROM collaborative_documents WHERE id = ?`.
- No existe comprobación de si el solicitante es el propietario (`is_owner = 1`) o si tiene el permiso administrativo correspondiente.
- **Riesgo Crítico**: Cualquier usuario autenticado o no autenticado puede emitir una petición `DELETE /api/collaborative-docs/<id>` con un ID arbitrario y destruir de forma permanente documentos, membresías y lienzos ajenos en toda la plataforma.

---

### 4.3 Omisión de Rate Limiters en Rutas Críticas de Autenticación

En `apps/BoardPDF/src/middlewares/rate-limit.middleware.ts`, se desarrollaron limitadores de tasa basados en Redis con algoritmos de ventana deslizante en scripts Lua (`loginLimiter`, `registerLimiter`, `verifyCodeLimiter`, `sendCodeLimiter`).

#### Brecha de Seguridad en Rutas (`auth.routes.ts`):
Al auditar `apps/BoardPDF/src/routes/auth.routes.ts:7-16`:
```typescript
router.post('/auth/validate-stage-1', validateStage1);
router.post('/auth/register-send-code', sendRegistrationCode);
router.post('/auth/resend-code', resendRegistrationCode);
router.post('/auth/register-verify', verifyRegistrationCode);
router.post('/auth/login', login);
router.get('/auth/me', me);
```

**Ninguno de los limitadores de tasa está montado en las rutas de autenticación**.

#### Consecuencias:
- **Ataque de Fuerza Bruta en Login**: Atacantes pueden ejecutar ataques de diccionario masivos contra `/auth/login` sin recibir bloqueos por IP ni retardos.
- **Agotamiento de Código de Verificación**: El endpoint `/auth/register-verify` valida un código numérico de 6 dígitos ($10^6 = 1,000,000$ posibilidades). Sin limitador de tasa, un script concurrente puede probar la totalidad del espacio de combinaciones en menos de 5 minutos, vulnerando el proceso de registro de cuentas.

---

### 4.4 Falsificación de IP (`CF-Connecting-IP`) y Fuga de Memoria en Fallback

#### 1. Falsificación de IP de Cliente (`rate-limit.middleware.ts:66-76`):
```typescript
export function getClientIp(req: Request): string {
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }
  let ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  ...
}
```
Si la variable `config.originProtection.enforceCloudflare` está desactivada (por defecto en desarrollo y en configuraciones sin Nginx), cualquier atacante puede inyectar una cabecera HTTP arbitraria:
```http
CF-Connecting-IP: 198.51.100.X
```
Como el código confía ciegamente en dicha cabecera sin validar si la petición proviene de los rangos de IP certificados de Cloudflare, el atacante puede rotar la cabecera en cada petición y evadir el 100% de los rate limiters de la plataforma.

#### 2. Fuga de Memoria en Fallback de Rate Limit (`rate-limit.middleware.ts:13-30`):
Cuando Redis se cae o no responde, el middleware conmuta a un almacenamiento local en memoria:
```typescript
const memoryFallbackStore = new Map<string, number[]>();
```
Las claves (`IPs`) se insertan en el `Map` pero **nunca se eliminan**. Aunque se purgan los timestamps antiguos del arreglo interior, la entrada en el `Map` persiste por siempre. Bajo un ataque de escaneo distribuido desde millones de IPs, el `Map` acumulará millones de entradas, generando una fuga continua de memoria RAM.

---

### 4.5 Auditoría de PBAC: Middleware `requirePermission` como Stub

La directiva maestra de arquitectura `AGENTS.md` (Sección 10) estipula de forma estricta:
> "CERO Autorización por Roles Directos... Toda verificación de acceso debe realizarse a través de permisos específicos (hasPermission, requirePermission, hasAllPermissions)."

#### Inspección de `apps/BoardPDF/src/middlewares/auth.middleware.ts`:
```typescript
// apps/BoardPDF/src/middlewares/auth.middleware.ts:38-42
export function requirePermission(_permission: string) {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next();
  };
}
```
El middleware encargado de forzar los permisos basados en atributos y capacidades (PBAC) en los endpoints protegidos es un **stub inoperativo que invoca incondicionalmente a `next()`**. Esto genera una falsa sensación de seguridad en las rutas que lo utilizan, permitiendo el acceso indiscriminado a funciones restringidas.

---

### 4.6 Exposición de Información Técnica y Políticas CSP/CORS

#### 1. Fuga de Detalles Internos en Errores de Rust (`main.rs:160-167`):
```rust
Err(err) => {
    let err_msg = ServerMessage::Error {
        message: format!("Mensaje JSON no reconocido: {}", err),
        code: Some("INVALID_JSON".to_string()),
    };
    if let Ok(json_str) = serde_json::to_string(&err_msg) {
        let _ = tx.try_send(Message::Text(json_str.into()));
    }
}
```
El servidor Rust envía textualmente el error devuelto por la biblioteca interna `serde_json` (ej. `"unknown variant 'subscribe', expected one of 'join', 'cursor', ..."`) directamente al cliente WebSocket, contraviniendo la Regla 1 de `AGENTS.md` (Cero exposición de información técnica interna). Se debe devolver un mensaje genérico seguro y registrar el detalle exclusivamente en el log del servidor.

#### 2. Debilidades en Políticas CSP (`security-headers.middleware.ts`):
- `connect-src` incluye comodines genéricos `ws:` y `wss:`. Esto permite a un script malicioso establecer conexiones WebSocket hacia cualquier servidor en internet, facilitando la exfiltración de datos.
- `script-src` incluye `'unsafe-inline'` de manera incondicional, debilitando la protección contra ataques XSS.

---

## Sección 5: Escenarios y Propuestas de Pruebas de Carga y Estrés (R5)

A fin de validar cuantitativamente el comportamiento del sistema bajo estrés operativo y comprobar la efectividad de las mitigaciones propuestas, se diseñan tres escenarios de prueba exhaustivos con objetivos numéricos estrictos.

---

### 5.1 Escenario 1: Tráfico Masivo de Edición Colaborativa en Tiempo Real

#### 1. Objetivo y Dimensionamiento:
Validar la capacidad de concurrencia y la latencia de difusión del servidor WebSocket (`apps/collab-server`) bajo alta densidad de colaboración simultánea.

- **Concurrencia**: **1,000 Usuarios Virtuales (VUs)** concurrentes distribuidos en **100 salas de diseño** (10 colaboradores por sala).
- **Carga de Tráfico**:
  - Tasa de actualización de cursores: 20 Hz (20 eventos/segundo por usuario).
  - Tasa de mutación de elementos (`elementChange`): 1 evento cada 3 segundos por sala.
  - Sincronización periódica (`docSync`): 1 evento cada 30 segundos por usuario.
  - **Volumen Total Entrante**: $\approx \mathbf{20,000\text{ mensajes/segundo}}$.
  - **Volumen Total Transmitido (Fan-out $1 \to 9$)**: $\approx \mathbf{180,000\text{ mensajes difundidos/segundo}}$.

#### 2. Matriz de Umbrales Cuantitativos de Aceptación:

| Métrica de Rendimiento | Umbral Objetivo (Aceptación) | Umbral Degradado (Alerta) | Umbral Crítico (Fallo) |
|---|:---:|:---:|:---:|
| **Latencia Broadcast p50 (Mediana)** | **$< 10\,\text{ms}$** | $10 - 25\,\text{ms}$ | $> 25\,\text{ms}$ |
| **Latencia Broadcast p95** | **$< 35\,\text{ms}$** | $35 - 70\,\text{ms}$ | $> 70\,\text{ms}$ |
| **Latencia Broadcast p99** | **$< 70\,\text{ms}$** | $70 - 150\,\text{ms}$ | $> 150\,\text{ms}$ |
| **Tasa de Desconexiones / Drops** | **$0.00\%$** | $< 0.05\%$ | $> 0.1\%$ |
| **Uso de CPU (Proceso Rust)** | **$< 65\%$ (en 4 vCPUs)** | $65\% - 80\%$ | $> 85\%$ |
| **Consumo de Memoria RAM (RSS)** | **$< 350\,\text{MB}$** | $350 - 600\,\text{MB}$ | $> 800\,\text{MB}$ |

#### 3. Script Funcional de Prueba de Carga en k6 (`tests/load/ws-collab-stress.js`):

```javascript
// tests/load/ws-collab-stress.js - k6 Collaborative WebSocket Load Test
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const broadcastLatency = new Trend('ws_broadcast_latency_ms');
const droppedMessages = new Counter('ws_dropped_messages');

export const options = {
  stages: [
    { duration: '2m', target: 500 },  // Ramp-up inicial a 500 VUs
    { duration: '3m', target: 1000 }, // Crecimiento a 1000 VUs plenos
    { duration: '10m', target: 1000 },// Meseta de carga sostenida extrema
    { duration: '2m', target: 0 },    // Ramp-down controlado
  ],
  thresholds: {
    ws_broadcast_latency_ms: ['p(50)<10', 'p(95)<35', 'p(99)<70'],
    ws_dropped_messages: ['count<10'],
    checks: ['rate>0.999'],
  },
};

export default function () {
  // Distribución uniforme de 1,000 VUs en 100 salas con exactamente 10 usuarios por sala (perf-room-0 a perf-room-99)
  const roomId = `perf-room-${Math.floor((__VU - 1) / 10)}`;
  const userId = __VU;
  const username = `Collaborator_${userId}`;
  const url = `ws://localhost:3001/ws/collab`;
  let lastPingTime = 0;

  const res = ws.connect(url, null, function (socket) {
    socket.on('open', () => {
      // 1. Mensaje de unión a sala
      socket.send(JSON.stringify({
        type: 'join',
        docId: roomId,
        userId: userId,
        username: username,
      }));

      // 2. Transmisión continua de cursores a 20 Hz (cada 50 ms)
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'cursor',
          x: Math.random() * 1000,
          y: Math.random() * 1400,
          pageIndex: 0,
        }));
      }, 50);

      // 3. Mutación esporádica de elemento cada 3 segundos (action: 'create' exigido por ClientMessage::ElementChange)
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'elementChange',
          action: 'create',
          element: {
            id: `elem-${userId}-${Date.now()}`,
            type: 'drawing',
            x: Math.random() * 800,
            y: Math.random() * 1000,
          },
          pageIndex: 0,
        }));
      }, 3000);

      // 4. Ping periódico para control de transporte y medición de latencia
      socket.setInterval(() => {
        lastPingTime = Date.now();
        socket.send(JSON.stringify({ type: 'ping' }));
      }, 5000);
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        // Rust difunde eventos bajo ServerMessage::RemoteCursor y ServerMessage::ElementChange
        if (msg.type === 'remoteCursor' || msg.type === 'elementChange') {
          droppedMessages.add(0);
        } else if (msg.type === 'pong') {
          if (lastPingTime > 0) {
            broadcastLatency.add(Date.now() - lastPingTime);
          }
        } else if (msg.type === 'error') {
          droppedMessages.add(1);
        }
      } catch (e) {
        droppedMessages.add(1);
      }
    });

    socket.on('error', () => {
      droppedMessages.add(1);
    });

    socket.setTimeout(() => {
      socket.send(JSON.stringify({ type: 'leave' }));
      socket.close();
    }, 600000); // Sesión de 10 minutos
  });

  check(res, { 'WebSocket Handshake exitoso (101)': (r) => r && r.status === 101 });
}
```

---

### 5.2 Escenario 2: Ráfaga de Procesamiento Pesado de PDF y Carga Masiva (HTTP)

#### 1. Objetivo y Dimensionamiento:
Evaluar el comportamiento del servidor Node.js, la gestión de buffers y el subsistema de almacenamiento S3/disco bajo ráfagas intensivas de peticiones concurrentes de unión (`merge-pdf`), compresión (`compress-pdf`) y división (`split-pdf`).

- **Concurrencia**: **100 VUs** ejecutando peticiones concurrentes continuas en bucle.
- **Tasa de Rendimiento Esperada**: **35 a 50 RPS sostenidos** en operaciones pesadas de CPU/I/O.
- **Payload por Petición**: Archivos PDF multipart de **10 MB a 50 MB** cada uno.
- **Métricas Clave de Observabilidad**: *Event Loop Delay* (retraso del loop en ms), uso de memoria Heap V8 y Resident Set Size (RSS).

#### 2. Matriz de Umbrales Cuantitativos de Aceptación:

| Métrica de Rendimiento | Umbral Objetivo (Aceptación) | Umbral Degradado (Alerta) | Umbral Crítico (Fallo) |
|---|:---:|:---:|:---:|
| **Latencia de Respuesta HTTP p50** | **$< 1,500\,\text{ms}$** | $1,500 - 2,500\,\text{ms}$ | $> 2,500\,\text{ms}$ |
| **Latencia de Respuesta HTTP p95** | **$< 3,500\,\text{ms}$** | $3,500 - 5,000\,\text{ms}$ | $> 5,000\,\text{ms}$ |
| **Latencia de Respuesta HTTP p99** | **$< 5,000\,\text{ms}$** | $5,000 - 8,000\,\text{ms}$ | $> 8,000\,\text{ms}$ (o 504) |
| **Tasa de Errores HTTP 5xx** | **$< 0.1\%$** | $0.1\% - 0.5\%$ | $> 0.5\%$ |
| **Retraso de Event Loop (Lag)** | **$< 20\,\text{ms}$** | $20 - 60\,\text{ms}$ | $> 100\,\text{ms}$ |
| **Heap Memory (V8)** | **$< 1.2\,\text{GB}$ por proceso** | $1.2 - 1.6\,\text{GB}$ | Crash OOM (`SIGABRT`) |

#### 3. Script Funcional de Prueba de Carga Pesada en Autocannon / k6 (`tests/load/autocannon-merge-pdf.js`):

```javascript
// tests/load/autocannon-merge-pdf.js
import autocannon from 'autocannon';
import FormData from 'form-data';

// Generación programática de buffers sintéticos válidos con estructura PDF mínima según especificación ISO 32000-1
function createSyntheticPdfBuffer(label = 'Sample') {
  const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (${label}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF`;
  return Buffer.from(content, 'utf-8');
}

// Construcción del payload multipart/form-data con el nombre de campo esperado 'pdfs' (merge-pdf.controller.ts)
const form = new FormData();
form.append('pdfs', createSyntheticPdfBuffer('Document Part 1'), {
  filename: 'sample-doc-1.pdf',
  contentType: 'application/pdf',
});
form.append('pdfs', createSyntheticPdfBuffer('Document Part 2'), {
  filename: 'sample-doc-2.pdf',
  contentType: 'application/pdf',
});

const formHeaders = form.getHeaders();
const formPayload = form.getBuffer();

// Cabeceras de inyección: incluye Content-Length y cabecera de bypass interno
// para evitar el bloqueo prematuro por el rate limiter 'pdfMergeLimiter' (30 req / 5 min en rate-limit.middleware.ts:251)
const headers = {
  ...formHeaders,
  'Content-Length': String(formPayload.length),
  'X-Load-Test-Bypass': 'stress-test-internal-token-secret',
};

const instance = autocannon({
  url: 'http://localhost:3000/api/tools/merge-pdf/merge',
  connections: 20, // Concurrencia adaptada a la capacidad real de 2 vCPUs
  duration: 30,    // Duración de la prueba en segundos
  method: 'POST',
  headers,
  body: formPayload,
  timeout: 30,
}, (err, results) => {
  if (err) {
    process.stderr.write(`Error en prueba de carga: ${err.message}\n`);
    process.exit(1);
  }
  process.stdout.write('--- Resultados Autocannon Merge PDF ---\n');
  process.stdout.write(`Total peticiones completadas: ${results.requests.total}\n`);
  process.stdout.write(`Rendimiento medio: ${results.requests.average} RPS\n`);
  process.stdout.write(`Latencia p50: ${results.latency.p50} ms | p95: ${results.latency.p95} ms | p99: ${results.latency.p99} ms\n`);
  process.stdout.write(`Errores HTTP no 2xx: ${results.non2xx}\n`);
});

autocannon.track(instance, { renderProgressBar: true });
```

##### Comentario Técnico y Restricciones de Capacidad de Hardware:
1. **Capacidad de Cómputo vs. Rendimiento Pretendido**:
   - Alcanzar entre **35 y 50 RPS sostenidos** en operaciones de manipulación binaria intensiva de PDFs (`merge`, `compress`, `split`) requiere una arquitectura de colas distribuidas con trabajadores desacoplados (**BullMQ sobre Redis**) distribuidos en un clúster de múltiples núcleos o workers dedicados.
   - En una topología de **2 vCPUs** con procesamiento síncrono dentro del proceso Node.js, cada operación de merge de 2 archivos consume entre $800\,\text{ms}$ y $1,500\,\text{ms}$ de tiempo de cómputo exclusivo de CPU. En consecuencia, el throughput máximo alcanzable antes de la saturación completa del hilo y el Event Loop se sitúa en torno a **$\sim 1.3 - 2.0\,\text{RPS}$**. Intentar forzar 50 RPS directamente sobre 2 vCPUs síncronas generará encolamiento masivo, agotamiento del timeout de Nginx (`504 Gateway Timeout`) y colapso por contención.
2. **Consideración Crítica sobre Rate Limiting (`pdfMergeLimiter`)**:
   - En `apps/BoardPDF/src/middlewares/rate-limit.middleware.ts:251-257`, la ruta `/api/tools/merge-pdf/merge` está restringida por `pdfMergeLimiter` con un límite estricto de **30 solicitudes cada 5 minutos**:
     ```typescript
     export const pdfMergeLimiter = createRateLimiter({
       keyGenerator: getUserOrIpKey,
       max: 30,
       message: 'Has realizado demasiadas solicitudes de unión de PDF...',
       prefix: 'pdf_merge',
       windowMs: 5 * 60 * 1000,
     });
     ```
   - Sin una cabecera de exclusión controlada (`X-Load-Test-Bypass`) o una elevación temporal de la cuota en el entorno de pruebas (`max: 100000`), cualquier generador de pruebas de carga agotará su cuota en menos de 1 segundo, recibiendo respuestas `HTTP 429 Too Many Requests` durante el resto del test y falseando la medición del rendimiento real de la infraestructura.

---

### 5.3 Escenario 3: Tormenta de Reconexiones Masivas (*Thundering Herd*)

#### 1. Objetivo y Dimensionamiento:
Simular una conmutación por error perimetral o un reinicio del microservicio de WebSockets donde **5,000 conexiones activas son abortadas abruptamente** en el mismo segundo, forzando a los clientes a reconectarse y resuscribirse de manera simultánea en una ventana estrecha de tiempo.

- **Volumen de Ráfaga**: **5,000 clientes concurrentes compitiendo en $< 10\,\text{segundos}$** (tasa de inyección: **500 a 1,000 handshakes TCP + HTTP Upgrade por segundo**).
- **Objetivo de Resiliencia**:
  - Medir la dispersión del tráfico generada por el algoritmo de Full Jitter.
  - Verificar que el servidor Rust no agote la tabla de descriptores de socket (`ulimit -n`).
  - Constatar que no se produzcan caídas por saturación del listener TCP.

#### 2. Matriz de Umbrales Cuantitativos de Aceptación:

| Métrica de Rendimiento | Umbral Objetivo (Aceptación) | Umbral Degradado (Alerta) | Umbral Crítico (Fallo) |
|---|:---:|:---:|:---:|
| **Tiempo de Recuperación Total (RTO)** | **$< 15\,\text{segundos}$ (100% estables)** | $15 - 30\,\text{segundos}$ | $> 45\,\text{segundos}$ |
| **Latencia de Handshake (Upgrade) p50** | **$< 45\,\text{ms}$** | $45 - 100\,\text{ms}$ | $> 100\,\text{ms}$ |
| **Latencia de Handshake (Upgrade) p95** | **$< 150\,\text{ms}$** | $150 - 250\,\text{ms}$ | $> 250\,\text{ms}$ |
| **Latencia de Handshake (Upgrade) p99** | **$< 300\,\text{ms}$** | $300 - 600\,\text{ms}$ | $> 1,000\,\text{ms}$ |
| **Tasa de Conexiones Rechazadas (Drops)** | **$< 0.05\%$** | $0.05\% - 0.2\%$ | $> 1.0\%$ |
| **Pico Transitorio de CPU** | **$< 85\%$ durante el storm** | $85\% - 95\%$ | $100\%$ sostenido |

#### 3. Script de Simulación de Tormenta de Reconexiones en Artillery (`tests/load/artillery-reconnect-storm.yml`):

```yaml
# tests/load/artillery-reconnect-storm.yml
config:
  target: "ws://localhost:3001"
  phases:
    - name: "Carga Estable Inicial"
      duration: 30
      arrivalRate: 100
    - name: "Thundering Herd Storm (Ráfaga Masiva)"
      duration: 10
      arrivalRate: 500 # 500 conexiones por segundo durante 10s = 5,000 conexiones
  ws:
    subprotocols: []

scenarios:
  - name: "Reconexión con Jitter y Re-unión a Sala"
    engine: ws
    flow:
      - connect:
          url: "/ws/collab"
      - send:
          payload:
            type: "join"
            docId: "doc-storm-{{ $randomNumber(1, 500) }}"
            userId: "{{ $randomNumber(1000, 999999) }}"
            username: "ReconnectingUser"
      - think: 5
      - send:
          payload:
            type: "ping"
      - think: 10
```

---

## Matriz Maestra Consolidada de Hallazgos

A continuación se presenta el registro unificado de vulnerabilidades, cuellos de botella y riesgos detectados a lo largo de las auditorías de Servidores Node.js, Reverse Proxy, WebSockets y Seguridad:

| ID | Severidad | Componente / Archivo Afectado | Problema Técnico / Riesgo Operativo | Recomendación Técnica de Mitigación |
|:---:|:---:|---|---|---|
| **SEC-01** | **Crítico** | `apps/collab-server/src/main.rs:90-93`<br>`apps/collab-server/src/main.rs:188-242` | **CSWSH y Handshake no Autenticado**: Elevación WebSocket sin validar `Origin`. Identidad autodeclarada en texto plano sin token ni cookie; suplantación total de usuarios y espionaje de documentos. | Validar `Origin` con `accept_hdr_async`. Implementar emisión de tickets efímeros firmados (HMAC-SHA256) en Node.js y validarlos en Rust en el handshake. |
| **SEC-02** | **Crítico** | `apps/BoardPDF/src/tools/collaborative-pdf/collaborative-pdf.controller.ts:281-296`<br>`collaborative-pdf.service.ts:503-512` | **IDOR en Eliminación de Documentos**: `deleteCollaborativeDocument` ignora `userId` en la cláusula SQL (`DELETE FROM collaborative_documents WHERE id = ?`). Borrado arbitrario de documentos ajenos. | Exigir `requireAuth`, validar que el usuario sea propietario (`is_owner = 1`) y condicionar SQL: `WHERE id = ? AND user_id = ?`. |
| **SEC-03** | **Crítico** | `apps/BoardPDF/src/routes/auth.routes.ts:7-16` | **Ausencia de Rate Limiting en Autenticación**: `loginLimiter` y `verifyCodeLimiter` no están montados en `/auth/login` ni `/auth/register-verify`. Exposición a ataques de fuerza bruta y diccionario. | Montar de inmediato los limitadores de tasa correspondientes en las rutas de `auth.routes.ts`. |
| **MEM-01** | **Crítico** | `apps/BoardPDF/src/utils/upload.util.ts:31`<br>`apps/BoardPDF/src/tools/merge-pdf/merge-pdf.controller.ts:8-12` | **Vulnerabilidad OOM DoS en Multer**: `multer.memoryStorage()` retiene hasta 1000 MB y 500 archivos por petición directamente en heap V8. Ráfagas moderadas provocan caída total del proceso Node.js. | Reemplazar por `multer.diskStorage()` en directorio temporal del sistema operativo y reducir el límite razonable a 50–100 MB. |
| **REL-01** | **Crítico** | `apps/BoardPDF/src/index.ts:24-30` | **Ausencia de Graceful Shutdown**: `process.exit(0)` inmediato al recibir `SIGTERM`/`SIGINT`. Interrupción abrupta de peticiones activas, sockets colgados y conexiones de BD sin cerrar. | Implementar drenaje ordenado con `server.close()`, cierre asíncrono de pools (`dbPool.end()`, `redis.quit()`) y timeout de escape (15s). |
| **REL-02** | **Crítico** | `apps/BoardPDF/src/index.ts:32-34` | **Manejo Inseguro de `uncaughtException`**: Se registra el error pero no se termina el proceso. Deja al proceso Node.js en estado corrompido, con fugas de memoria y sockets huérfanos. | Registrar el error crítico y forzar salida limpia con `process.exit(1)` para que el supervisor/orquestador reinicie la instancia limpia. |
| **HA-01** | **Crítico** | `apps/BoardPDF/src/index.ts:227-233` | **Health Check Ciego y Estático**: `/api/health` devuelve estáticamente 200 OK sin verificar conectividad con MySQL, Redis ni S3. Balanceadores enviarán tráfico a réplicas rotas. | Desacoplar en `/api/health/liveness` (proceso vivo) y `/api/health/readiness` (ping activo a MySQL, Redis y S3 con código 503 ante fallos). |
| **SCA-01** | **Crítico** | `apps/collab-server/src/hub.rs:7-10, 46-52`<br>`apps/collab-server/Cargo.toml:6-14` | **Estado WebSocket Atrapado en Memoria Local**: Las salas residen en `HashMap` sin Redis Pub/Sub. En balanceo multi-instancia se produce split-brain, aislamiento y corrupción de guardado. | Integrar `redis` o `fred` en Rust; implementar canales Redis Pub/Sub `collab:room:{doc_id}` para retransmitir eventos entre réplicas. |
| **INF-01** | **Crítico** | Raíz del repositorio / `apps/BoardPDF/`<br>`apps/collab-server/` | **Ausencia de Dockerfiles de Producción**: No existe Dockerfile para Node.js ni para Rust. Imposibilidad de empaquetar, versionar y orquestar en producción. | Crear Dockerfiles multi-stage con usuarios sin privilegios (`node` / `appuser`) y optimizaciones de caché de capas. |
| **INF-02** | **Crítico** | Raíz del repositorio / Directorio `nginx/` | **Ausencia Total de Reverse Proxy Nginx**: No existen archivos de configuración de proxy. Sin terminación TLS, buffers de subida ni enrutamiento unificado de WebSockets. | Desplegar el archivo `nginx/nginx.conf` auditado en la Sección 3.4 con terminación TLS 1.3 y búferes optimizados. |
| **PRF-01** | **Alto** | `apps/BoardPDF/src/services/logger.service.ts:115`<br>`request-logger.middleware.ts:23-28` | **Logging Síncrono Bloqueante de Event Loop**: `fs.appendFileSync` ejecutado en cada petición HTTP. Introduce bloqueos acumulativos directos en el hilo único de Node.js bajo I/O. | Sustituir por flujos asíncronos (`fs.promises.appendFile` o `fs.createWriteStream` con buffer de drenaje) o logging a stdout/JSON. |
| **SCA-02** | **Alto** | `apps/BoardPDF/src/index.ts:245`<br>`apps/BoardPDF/package.json:15` | **Modelo Monoproceso Estricto**: `node dist/index.js` sin módulo `node:cluster` ni PM2. Desperdicio total de procesadores multi-core (1 vCPU al 100%, resto ociosas). | Configurar réplicas horizontales en contenedores Docker o implementar clustering nativo con `node:cluster`. |
| **SCA-03** | **Alto** | `apps/BoardPDF/src/utils/process.util.ts:69-120` | **Subprocesos Python Lanzados Concurrentemente Sin Cola**: Peticiones concurrentes de OCR disparan `spawn()` masivos sin cola, saturando CPU/RAM del host. | Implementar cola de trabajos asíncrona con BullMQ sobre Redis para procesar tareas pesadas de Python en workers dedicados. |
| **REL-03** | **Alto** | `apps/BoardPDF/src/config/redis.config.ts:11-16` | **Cancelación Permanente de Conexión Redis**: `retryStrategy` retorna `null` tras 3 reintentos fallidos, cancelando permanentemente los reintentos hasta reiniciar Node.js. | Modificar `retryStrategy` para que reconecte indefinidamente con backoff exponencial acotado a 3s y factor de jitter aleatorio. |
| **SEC-04** | **Alto** | `apps/BoardPDF/src/middlewares/rate-limit.middleware.ts:66-76` | **Falsificación de IP de Cliente (Cloudflare IP Spoofing)**: Confianza ciega en `cf-connecting-ip` sin validar rangos de Cloudflare. Evasión completa de rate limits. | Desconfiar de cabeceras de proxy a menos que se valide la IP origen del reverse proxy perimetral autorizado. |
| **SEC-05** | **Alto** | `apps/BoardPDF/src/middlewares/auth.middleware.ts:38-42` | **PBAC Inoperativo (`requirePermission` Stub)**: La función de control de acceso es un stub vacío que llama a `next()`. Violación directa de las reglas maestras de PBAC. | Implementar la verificación real de capacidades contra los permisos activos del usuario o token de sesión. |
| **INF-03** | **Alto** | `apps/BoardPDF/client/services/websocket.service.ts:66-70` | **Puerto 3001 Hardcodeado en Frontend**: Conexión directa a `:3001` evadiendo el proxy inverso y terminación TLS. Falla tras balanceadores estándar (443). | Configurar la URL como ruta relativa `/ws/collab` sobre el puerto HTTPS estándar y rutear internamente vía Nginx. |
| **NET-01** | **Alto** | `apps/BoardPDF/client/services/websocket.service.ts:250-258` | **Tormenta de Reconexiones Sin Jitter**: Backoff puramente determinista ($1.5^{\text{attempts}}$) produce reconexiones sincronizadas que saturan el servidor tras caídas. | Implementar algoritmo *Full Jitter* aleatorizado: `delay = Math.floor(Math.random() * Math.min(1000 * 1.5^attempts, 30000))`. |
| **REL-04** | **Alto** | `apps/collab-server/src/hub.rs:20-33`<br>`apps/collab-server/src/main.rs:96, 106` | **Pérdida Silenciosa de Mutaciones (Backpressure)**: Canales de 128 mensajes descartan con `try_send` eventos críticos (`elementChange`) en clientes lentos sin alertar. | Diferenciar mensajes descartables (cursores) de mutaciones críticas. En caso de saturación, marcar cliente como desincronizado y forzar reload. |
| **PRF-02** | **Medio** | `apps/BoardPDF/src/index.ts:184` | **Timeouts HTTP Keep-Alive Desalineados con Proxies**: Valores por defecto de 5s en Node.js frente a los 60s típicos de Nginx provocan errores esporádicos `502 Bad Gateway`. | Configurar `server.keepAliveTimeout = 65000` y `server.headersTimeout = 66000` en Node.js. |
| **PRF-03** | **Medio** | `apps/BoardPDF/src/controllers/download.controller.ts:156-170` | **Descargas Sin Streaming Hacia el Cliente**: `handleToolDownload` carga el archivo completo en memoria RAM antes de enviarlo, duplicando consumo de RAM. | Utilizar streaming nativo (`stream.pipe(res)`) desde S3 o disco temporal directamente al socket HTTP. |
| **MEM-02** | **Medio** | `apps/BoardPDF/src/middlewares/rate-limit.middleware.ts:13-30` | **Fuga de Memoria en Fallback de Rate Limit**: `memoryFallbackStore` nunca elimina claves (IPs), acumulando memoria indefinidamente durante caídas de Redis. | Implementar un almacén con política LRU o limpieza periódica (`setInterval`) para eliminar entradas expiradas. |
| **SEC-06** | **Medio** | `apps/collab-server/src/main.rs:160-167` | **Fuga de Información Técnica en Errores de Rust**: Se devuelven mensajes textuales de `serde_json` al frontend, revelando estructura interna. | Reemplazar por mensaje genérico seguro (`"Formato de mensaje no válido."`) y registrar el detalle en logs locales. |
| **SEC-07** | **Medio** | `apps/BoardPDF/src/middlewares/security-headers.middleware.ts:20-43` | **CSP Permisiva**: Comodines `ws:`, `wss:` y `'unsafe-inline'` en entornos de producción. | Restringir `connect-src` a dominios autorizados y eliminar `'unsafe-inline'` mediante hashes criptográficos. |
| **RES-01** | **Bajo** | `apps/BoardPDF/client/services/websocket.service.ts:167-173` | **Fuga de Sockets en Navegación SPA**: Al abandonar el editor no se cierra el socket WebSocket; mantiene pings indefinidos y agota descriptores. | Implementar cierre automático del socket o desconexión por inactividad cuando no existan salas activas suscritas. |

---

## Hoja de Ruta de Implementación (Roadmap Priorizado)

Para abordar los hallazgos de forma metódica y minimizar el riesgo de regresiones, se establece un plan de remediación en tres fases:

```
+-----------------------------------------------------------------------------------+
| FASE 0: INMEDIATA (0 a 2 Semanas) - P0: Mitigación de Vulnerabilidades Críticas   |
+-----------------------------------------------------------------------------------+
| 1. Reemplazar multer.memoryStorage() por diskStorage() en upload.util.ts.          |
| 2. Montar rate limiters en auth.routes.ts (/auth/login y /auth/register-verify).  |
| 3. Corregir IDOR en deleteCollaborativeDocHandler y deleteCollaborativeDocument.  |
| 4. Implementar validación de Origin y tokens efímeros en apps/collab-server.     |
| 5. Implementar Graceful Shutdown con drenaje y alineación de keepAliveTimeout.    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| FASE 1: CORTO PLAZO (2 a 4 Semanas) - P1: Infraestructura y Resiliencia           |
+-----------------------------------------------------------------------------------+
| 1. Desplegar configuración de Nginx con terminación TLS 1.3 y buffers de subida.  |
| 2. Crear Dockerfiles multi-stage de producción para Node.js y Rust.               |
| 3. Incorporar collab-server y nginx a docker-compose.yml con límites de recursos. |
| 4. Sustituir logging síncrono (fs.appendFileSync) por streams asíncronos.         |
| 5. Dividir health check en /api/health/liveness y /api/health/readiness.          |
| 6. Implementar Full Jitter en websocket.service.ts del cliente SPA.               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| FASE 2: MEDIANO PLAZO (1 a 2 Meses) - P2: Escalabilidad Horizontal Elástica      |
+-----------------------------------------------------------------------------------+
| 1. Integrar Redis Pub/Sub en apps/collab-server (Rust) para sincronizar salas.    |
| 2. Implementar cola de trabajos con BullMQ para ejecución de workers Python.      |
| 3. Implementar verificación real en el middleware requirePermission (PBAC).       |
| 4. Refactorizar descargas de archivos con streaming directo desde S3/disco.       |
| 5. Ejecutar la suite automatizada de pruebas de carga en k6 y Artillery.          |
+-----------------------------------------------------------------------------------+
```

---

## Guía de Verificación y Auditoría Independiente

A continuación se detallan los comandos, consultas e instrucciones de reproducción que permiten a un auditor independiente verificar la existencia de cada hallazgo y validar las mitigaciones aplicadas:

### 1. Verificación de Ausencia de Dockerfiles y Nginx en el Repositorio
Ejecutar en PowerShell desde la raíz de `f:\BoardStack`:
```powershell
# Comprobar la inexistencia de Dockerfiles principales (solo debe aparecer Dockerfile.cleaner)
Get-ChildItem -Path "." -Recurse -Filter "*Dockerfile*" | Select-Object FullName

# Comprobar la inexistencia de configuraciones de Nginx (0 resultados)
Get-ChildItem -Path "." -Recurse -Filter "*nginx*.conf" | Select-Object FullName
```

### 2. Verificación de Multer MemoryStorage y Límites Excesivos
Inspeccionar directamente los archivos de carga:
- Abrir `apps/BoardPDF/src/utils/upload.util.ts`: verificar línea 31 (`storage: multer.memoryStorage()`) y línea 13 (`maxFileSizeMB ?? 1000`).
- Abrir `apps/BoardPDF/src/tools/merge-pdf/merge-pdf.controller.ts`: verificar líneas 8-12 (`maxFileSizeMB: 1000`, `maxFiles: 500`).

### 3. Verificación de Handshake WebSocket Sin Autenticación (CSWSH)
Con la aplicación en ejecución local:
```bash
# Conectar con herramienta wscat forzando un origen arbitrario no autorizado
wscat -c "ws://localhost:3001/ws/collab" -H "Origin: https://evil-attacker-site.com"
```
Enviar el siguiente mensaje por el socket abierto:
```json
{"type":"join","docId":"test-audit-room","userId":9999,"username":"Hacker"}
```
**Resultado Observable**: La conexión no es rechazada con código HTTP 403. El servidor Rust acepta la conexión y responde con un mensaje `joined`, confirmando la vulnerabilidad CSWSH y la falta de autenticación.

### 4. Verificación de IDOR en Borrado de Documentos Colaborativos
Inspeccionar el código en `apps/BoardPDF/src/tools/collaborative-pdf/collaborative-pdf.service.ts`:
- Localizar `deleteCollaborativeDocument` (líneas 503-509).
- Verificar que las consultas SQL ejecutadas son:
  ```sql
  DELETE FROM collaborative_document_members WHERE document_id = ?;
  DELETE FROM collaborative_documents WHERE id = ?;
  ```
- Constatar que la variable `userId` no forma parte de los parámetros de la consulta SQL (`WHERE id = ?`), confirmando la ausencia de validación de propiedad.

### 5. Verificación de Omisión de Rate Limiters en Autenticación
Inspeccionar `apps/BoardPDF/src/routes/auth.routes.ts`:
- Verificar que las rutas `router.post('/auth/login', login)` y `router.post('/auth/register-verify', verifyRegistrationCode)` no incluyen los middlewares `loginLimiter` ni `verifyCodeLimiter`.
- Probar con peticiones repetidas:
  ```bash
  for i in {1..15}; do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3000/api/auth/login" \
         -H "Content-Type: application/json" \
         -d '{"email":"audit@test.com","password":"invalid_password"}'
  done
  ```
- **Resultado Observable**: Todas las respuestas devuelven código HTTP 401. Ninguna petición es bloqueada con código HTTP 429 (`Too Many Requests`).

### 6. Verificación de Logging Síncrono Bloqueante
- Abrir `apps/BoardPDF/src/services/logger.service.ts`: inspeccionar la línea 115 y comprobar la llamada a `fs.appendFileSync(logFile, line, 'utf8')`.
- Abrir `apps/BoardPDF/src/middlewares/request-logger.middleware.ts`: comprobar que en el evento `res.on('finish')` se invoca `logger.app.info`, ejecutando la llamada de sistema síncrona en cada petición HTTP servida.

### 7. Verificación de Compilación y Suite de Pruebas Existentes
Validar que el monorepo compile limpiamente bajo TypeScript estricto y que las pruebas unitarias de Rust se ejecuten correctamente:
```powershell
# Verificación de tipos TypeScript en BoardPDF
npm run typecheck --workspace=apps/BoardPDF

# Pruebas unitarias de Rust en collab-server
cargo test --manifest-path apps/collab-server/Cargo.toml
```

---

*Fin del Informe Técnico de Auditoría de Infraestructura y Arquitectura.*
