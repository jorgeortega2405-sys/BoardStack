# Project: BoardPDF Tools Audit & Modular Refactoring

## Architecture
- **Backend Architecture**: Express 4 with NodeNext ESM module resolution (`src/`). Route definitions in `src/routes/tools.routes.ts`, tool implementations under `src/tools/<tool>/`, shared utilities under `src/utils/`, shared services under `src/services/`, central logging in `src/services/logger.service.ts`.
- **Frontend Architecture**: SPA written in TypeScript under `client/`, bundled via Vite middleware / Vite production build to `dist/client/`. Views in `client/views/tools/`, HTML templates in `public/views/tools/`, client services in `client/services/`, reusable components in `client/components/`.
- **Worker Infrastructure**: Python 3 worker scripts located in `scripts/`, invoked via `src/utils/process.util.ts`.
- **Verification Infrastructure**: Python automated test orchestrator in `test/main.py` (Tests 1-8).

---

## Feature Inventory
| # | Feature / Work Item | Description | Milestone | Source |
|---|---------------------|-------------|-----------|--------|
| 1 | Central PDF Utility Service | Centralize `isPdfBuffer`, `sanitizePdfFilename`, `extractPdfText`, `cleanTextForWinAnsi`, `parseHexColor`, `getGhostscriptCommand` in `src/utils/pdf.util.ts` | M1 | Survey Explorer B1 |
| 2 | Central Upload Middleware Factory | Centralize Multer configuration, file validation, error mapping in `src/utils/upload.util.ts` | M1 | Survey Explorer B1 |
| 3 | Central Archive Utility | Centralize ZIP archive generation `createZipBuffer` in `src/utils/archive.util.ts` | M1 | Survey Explorer B1 |
| 4 | Unified Tool Download Handler | Reusable `handleToolDownload` in `src/controllers/download.controller.ts` | M1 | Survey Explorer B1 |
| 5 | PBAC Permission Enforcement | Enforce permissions in `getToolLimits` (`src/config/tools-limits.config.ts`) | M1 | Survey Explorer B1 |
| 6 | Backend Tools Refactoring (Part 1: Core Operations) | Refactor `merge-pdf`, `split-pdf`, `rotate-pdf`, `organize-pdf`, `remove-pdf-pages`, `compress-pdf` to use M1 utils | M2 | Survey Explorer B1 |
| 7 | Backend Tools Refactoring (Part 2: Security & Transform) | Refactor `protect-pdf`, `unlock-pdf`, `watermark-pdf`, `page-numbers`, `crop-pdf`, `edit-pdf`, `repair-pdf` to use M1 utils | M2 | Survey Explorer B1 |
| 8 | Backend Tools Refactoring (Part 3: Converters & AI) | Refactor `pdf-converter`, `to-pdf-converter`, `pdf-to-markdown`, `ocr-pdf`, `compare-pdf`, `summarize-pdf`, `translate-pdf`, `cloud`, purge duplicate worker scripts | M2 | Survey Explorer B1 |
| 9 | Frontend Tool Layout Component | Create `ToolLayoutController` in `client/components/tool-layout.component.ts` managing states, drawer, banners, and status overlays | M3 | Survey Explorer F1 |
| 10 | Frontend Universal File Flow Service | Enhance `client/services/tool-flow.service.ts` with `setupToolFileFlow` handling drag/drop, browse, cloud pickers, and validation | M3 | Survey Explorer F1 |
| 11 | Frontend PDF Preview & Thumbnail Service | Create `client/services/pdf-preview.service.ts` for PDF.js document loading, thumbnail generation, canvas scaling | M3 | Survey Explorer F1 |
| 12 | Frontend Tools Refactoring (Part 1: Single-file & Core) | Refactor `compress-pdf`, `protect-pdf`, `unlock-pdf`, `repair-pdf`, `ocr-pdf`, `pdf-to-markdown`, `summarize-pdf`, `translate-pdf` using M3 abstractions | M4 | Survey Explorer F1 |
| 13 | Frontend Tools Refactoring (Part 2: Multi-file & Grid) | Refactor `merge-pdf`, `split-pdf`, `rotate-pdf`, `organize-pdf`, `remove-pdf-pages`, `page-numbers`, `watermark-pdf` using M3 abstractions | M4 | Survey Explorer F1 |
| 14 | Frontend Tools Refactoring (Part 3: Converters & Canvas) | Refactor `pdf-converter`, `to-pdf-converter`, `compare-pdf`, `crop-pdf`, `edit-pdf`, `redact-pdf` using M3 abstractions; purge dead comments and helpers | M4 | Survey Explorer F1 |
| 15 | Full Verification Matrix & Hardening | Full build (`npm run build`), strict typecheck (`npm run typecheck`), full test suite (`python test/main.py 8`), standards audit, challenger & forensic auditor gates | M5 | Survey Explorer T1 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Shared Tool Utilities & PBAC | `src/utils/pdf.util.ts`, `src/utils/upload.util.ts`, `src/utils/archive.util.ts`, `src/controllers/download.controller.ts`, `src/config/tools-limits.config.ts` | none | DONE |
| M2 | Backend Tools Refactoring & Deduplication | All 22 tools in `src/tools/`, `src/routes/tools.routes.ts`, purge duplicate scripts in `src/tools/*/scripts/` | M1 | IN_PROGRESS |
| M3 | Frontend Shared Tool Abstractions & Preview | `client/components/tool-layout.component.ts`, `client/services/tool-flow.service.ts`, `client/services/pdf-preview.service.ts` | none | IN_PROGRESS |
| M4 | Frontend Tool Views Refactoring & Deduplication | All 21 tool views in `client/views/tools/`, purge comments/dead helpers | M3 | PLANNED |
| M5 | Comprehensive Full Suite Verification & Gate | Typecheck, build:server, build:client, python test suite 8, adversarial review, forensic audit | M2, M4 | PLANNED |

---

## Code Layout & File Boundaries
- **Backend Shared Utilities**: `src/utils/pdf.util.ts`, `src/utils/upload.util.ts`, `src/utils/archive.util.ts`.
- **Backend Controllers & Routes**: `src/controllers/download.controller.ts`, `src/routes/tools.routes.ts`.
- **Backend Tool Directories**: `src/tools/<tool_name>/<tool_name>.controller.ts`, `<tool_name>.service.ts`, `<tool_name>.routes.ts`.
- **Frontend Components & Services**: `client/components/tool-layout.component.ts`, `client/services/tool-flow.service.ts`, `client/services/pdf-preview.service.ts`.
- **Frontend Tool Views**: `client/views/tools/<tool_name>/<tool_name>.view.ts`.

---

## Interface Contracts

### 1. `src/utils/pdf.util.ts`
```ts
export function isPdfBuffer(buffer: Buffer): boolean;
export function sanitizePdfFilename(rawName?: string, defaultName?: string): string;
export function extractPdfText(buffer: Buffer): Promise<{ fullText: string; pages: string[] }>;
export function cleanTextForWinAnsi(text: string): string;
export function parseHexColor(hex?: string): { r: number; g: number; b: number };
export function getGhostscriptCommand(): string;
```

### 2. `src/utils/upload.util.ts`
```ts
export interface UploadOptions {
  fieldName?: string;
  maxFileSizeMB?: number;
  maxFiles?: number;
}
export function createPdfUploadMiddleware(options?: UploadOptions): RequestHandler;
```

### 3. `src/utils/archive.util.ts`
```ts
export function createZipBuffer(files: Array<{ buffer: Buffer; name: string }>): Promise<Buffer>;
```

### 4. `src/controllers/download.controller.ts`
```ts
export function handleToolDownload(req: Request, res: Response): Promise<void>;
```

### 5. `client/components/tool-layout.component.ts`
```ts
export interface ToolLayoutOptions {
  container: HTMLElement;
  dropzoneCardRef?: string;
  errorBannerRef?: string;
  onRetry?: () => void;
  selectedCardRef?: string;
  sidebarRef?: string;
  toolName: string;
  workspaceRef?: string;
}
export class ToolLayoutController {
  constructor(options: ToolLayoutOptions);
  init(signal: AbortSignal): void;
  showReadyState(): void;
  showEmptyState(): void;
  showProcessingState(): void;
  showError(msg: string): void;
  hideError(): void;
  destroy(): void;
}
```

### 6. `client/services/tool-flow.service.ts`
```ts
export interface ToolFileFlowOptions {
  container: HTMLElement;
  dropzoneRef?: string;
  multiselect?: boolean;
  onFile?: (file: File) => void | Promise<void>;
  onFiles?: (files: File[]) => void | Promise<void>;
  signal: AbortSignal;
  toolId: string;
}
export function setupToolFileFlow(options: ToolFileFlowOptions): void;
```

### 7. `client/services/pdf-preview.service.ts`
```ts
export function renderPdfThumbnail(
  fileOrDoc: File | any,
  canvas: HTMLCanvasElement,
  options?: { dpr?: boolean; pageNum?: number; targetWidth?: number }
): Promise<void>;

export function generateThumbnailDataUrl(
  pdfDocument: any,
  pageNum: number,
  targetWidth?: number,
  quality?: number
): Promise<string>;
```
