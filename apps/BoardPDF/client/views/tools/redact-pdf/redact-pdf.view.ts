import { ToolPhaseManager } from '../../../components/tool-phase-manager.js';
import { showUpgradeLimitModal } from '../../../components/upgrade-limit-modal.component.js';
import { API_ROUTES } from '../../../config/api-routes.js';
import { getCurrentUserToolLimits } from '../../../config/tools-limits.config.js';
import { postFormWithProgress } from '../../../services/api.service.js';
import { renderIcons } from '../../../services/icon.service.js';
import { loadPdfDocument, loadPdfJs } from '../../../services/pdf-loader.service.js';
import { loadTemplate } from '../../../services/template.service.js';
import { showToast } from '../../../services/toast.service.js';
import { ViewController } from '../../../types/common.types.js';
import { ToolSidebarModalController, hideElement, setupToolSidebarModal, showElement, withButtonLoading } from '../../../utils/dom.util.js';
import { formatBytes } from '../../../utils/format.util.js';
import { ToolZoomController } from '../../../utils/tool-zoom.util.js';
import { ClientRedactTool, ClientRedactionBox, RedactPdfResultData } from './redact-pdf.types.js';
import { t } from '../../../services/i18n.service.js';

class RedactPdfController implements ViewController {
  private abortController: AbortController | null = null;
  private activePageIndex = 0;
  private container: HTMLElement;
  private currentFile: File | null = null;
  private currentTool: ClientRedactTool = 'select-text';
  private fullPageRedactions: Set<number> = new Set();
  private isProcessing = false;
  private pageDimensions: Array<{ height: number; width: number }> = [];
  private pageScales: number[] = [];
  private pageTextItems: Array<Array<{ height: number; str: string; width: number; x: number; y: number }>> = [];
  private pdfDocument: any = null;
  private phaseManager: ToolPhaseManager | null = null;
  private redactionBoxes: ClientRedactionBox[] = [];
  private sidebarModal: ToolSidebarModalController | null = null;
  private zoomController: ToolZoomController | null = null;
  private zoomLevel = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.abortController = new AbortController();
    this.phaseManager = new ToolPhaseManager({
      container: this.container,
      dropzone: {
        buttonText: 'Seleccionar Archivo PDF',
        desc: t('ui.oculta_y_elimina_de_forma_irreversible_i'),
        hint: 'o arrastra y suelta el PDF aquí',
        multiselect: false,
        onFilesSelected: (files: File[]) => {
          if (files.length > 0) void this.handleFileSelected(files[0]);
        },
        title: 'Censurar PDF',
      },
      onRetry: () => {
        void this.executeRedaction();
      },
      sidebarRef: 'redact-pdf-sidebar',
      toolId: 'redact-pdf',
      toolName: 'Censurar PDF',
      topHeaderRef: 'component-top',
      workspaceCardRef: 'redact-workspace-card',
    });
    await this.phaseManager.init();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.sidebarModal) {
      this.sidebarModal.destroy();
      this.sidebarModal = null;
    }
    if (this.zoomController) {
      this.zoomController = null;
    }
    if (this.phaseManager) {
      this.phaseManager.destroy();
      this.phaseManager = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.pdfDocument) {
      try {
        void this.pdfDocument.destroy();
      } catch {}
      this.pdfDocument = null;
    }
  }

  private bindEvents(): void {
    if (!this.abortController) return;
    const { signal } = this.abortController;

    const sidebar = this.container.querySelector<HTMLElement>('[data-ref="redact-pdf-sidebar"]');
    const backdrop = this.container.querySelector<HTMLElement>('[data-ref="tool-sidebar-backdrop"]');
    const dragZone = this.container.querySelector<HTMLElement>('[data-ref="redact-sidebar-drag-zone"]');
    const closeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-sidebar-close"]');
    const settingsBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');

    if (sidebar && backdrop && settingsBtn) {
      this.sidebarModal = setupToolSidebarModal({ backdrop, closeBtn, dragZone, settingsBtn, sidebar, signal });
    }

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-redact"]');
    const toolSelectBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-select"]');
    const toolDrawBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-draw"]');

    const searchBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-search-redact"]');
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-phrase"]');

    const toggleRedactTool = this.container.querySelector<HTMLElement>('[data-ref="toggle-redact-tool"]');

    this.zoomController = new ToolZoomController({
      container: this.container,
      initialZoom: this.zoomLevel,
      onZoomChange: (level) => {
        this.applyZoom(level);
      },
      signal,
    });

    if (toolSelectBtn) {
      toolSelectBtn.addEventListener('click', () => {
        if (toggleRedactTool) toggleRedactTool.setAttribute('data-active', '0');
        this.switchTool('select-text');
      }, { signal });
    }

    if (toolDrawBtn) {
      toolDrawBtn.addEventListener('click', () => {
        if (toggleRedactTool) toggleRedactTool.setAttribute('data-active', '1');
        this.switchTool('draw-box');
      }, { signal });
    }

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        this.handleSearchAndRedact(searchInput.value);
      }, { signal });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSearchAndRedact(searchInput.value);
        }
      }, { signal });
    }

    if (executeBtn) {
      executeBtn.addEventListener('click', async () => {
        await this.executeRedaction();
      }, { signal });
    }
  }

  private switchTool(tool: ClientRedactTool): void {
    this.currentTool = tool;
    const toolSelectBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-select"]');
    const toolDrawBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tool-draw"]');
    const toggleRedactTool = this.container.querySelector<HTMLElement>('[data-ref="toggle-redact-tool"]');

    if (toggleRedactTool) {
      toggleRedactTool.setAttribute('data-active', tool === 'select-text' ? '0' : '1');
    }

    if (toolSelectBtn && toolDrawBtn) {
      toolSelectBtn.classList.toggle('is-active', tool === 'select-text');
      toolDrawBtn.classList.toggle('is-active', tool === 'draw-box');
    }

    const drawingSurfaces = this.container.querySelectorAll<HTMLElement>('.pdf-redact-drawing-surface');
    drawingSurfaces.forEach((surf) => {
      surf.style.pointerEvents = tool === 'draw-box' ? 'auto' : 'none';
    });

    const textLayers = this.container.querySelectorAll<HTMLElement>('.pdf-redact-text-layer');
    textLayers.forEach((layer) => {
      layer.style.pointerEvents = tool === 'select-text' ? 'auto' : 'none';
    });
  }

  private applyZoom(level: number): void {
    this.zoomLevel = level;
    const cards = this.container.querySelectorAll<HTMLElement>('.pdf-redact-page-card');
    cards.forEach((card) => {
      const pIdx = parseInt(card.getAttribute('data-page-index') || '0', 10);
      const dims = this.pageDimensions[pIdx];
      if (!dims) return;
      const baseW = 760;
      const baseH = Math.floor((dims.height / dims.width) * baseW);
      const scaledW = Math.round(baseW * this.zoomLevel);
      const scaledH = Math.round(baseH * this.zoomLevel);

      const scaler = card.querySelector<HTMLElement>('.tool-viewport-scaler');
      if (scaler) {
        scaler.style.width = `${scaledW}px`;
        scaler.style.height = `${scaledH}px`;
      }
      const viewport = card.querySelector<HTMLElement>('.pdf-redact-viewport');
      if (viewport) {
        viewport.style.transform = `scale(${this.zoomLevel})`;
        viewport.style.transformOrigin = 'top left';
      }
      const header = card.querySelector<HTMLElement>('.pdf-redact-page-card__header');
      if (header) {
        header.style.width = `${scaledW}px`;
      }
      card.style.width = `${scaledW}px`;
    });
  }

  private async handleFileSelected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.showError(t('ui.por_favor_selecciona_un_archivo_pdf_vali'));
      return;
    }
    const limits = getCurrentUserToolLimits('redact-pdf');
    const maxSizeBytes = limits.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showUpgradeLimitModal({
        currentLimit: limits.maxFileSizeMB,
        fileName: file.name,
        toolId: 'redact-pdf',
        toolName: 'Redactar PDF',
        type: 'file_size',
      });
      return;
    }

    this.hideError();
    this.currentFile = file;
    this.redactionBoxes = [];
    this.fullPageRedactions.clear();

    const docNamePill = this.container.querySelector<HTMLElement>('[data-ref="val-doc-title"]');
    if (docNamePill) docNamePill.textContent = file.name;

    this.phaseManager?.setPhase('workspace');

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      outputNameInput.value = `${baseName}_censurado.pdf`;
    }
    const topControls = this.container.querySelector<HTMLElement>('[data-ref="redact-top-controls"]');
    const topActions = this.container.querySelector<HTMLElement>('[data-ref="redact-top-actions"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    showElement(topControls);
    showElement(topActions);
    if (settingsBtn) settingsBtn.classList.add('is-visible');

    try {
      const buffer = await file.arrayBuffer();
      this.pdfDocument = await loadPdfDocument(buffer);

      this.pageDimensions = [];
      this.pageScales = [];
      this.pageTextItems = [];

      const numPages = this.pdfDocument.numPages;
      for (let i = 1; i <= numPages; i++) {
        const page = await this.pdfDocument.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        this.pageDimensions.push({ height: vp.height, width: vp.width });
      }

      const pagesBadge = this.container.querySelector<HTMLElement>('[data-ref="pages-count-badge"]');
      if (pagesBadge) pagesBadge.textContent = `${numPages}`;

      await this.renderThumbnails();
      await this.renderDocumentPages();
      this.updateSidebarSummary();
      this.zoomController?.showFooter(true);
      this.zoomController?.updatePageInfo(1, numPages);
    } catch {
      this.showError(t('ui.error_al_leer_el_archivo_pdf_verifica_qu'));
      this.resetSelectedFile();
    }
  }

  private resetSelectedFile(): void {
    this.currentFile = null;
    this.pdfDocument = null;
    this.redactionBoxes = [];
    this.fullPageRedactions.clear();
    this.sidebarModal?.close();
    this.zoomController?.showFooter(false);
    this.zoomController?.reset();

    const outputNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-doc-title"], [data-ref="input-output-name"]');
    if (outputNameInput) {
      outputNameInput.value = 'documento_censurado.pdf';
    }
    const topControls = this.container.querySelector<HTMLElement>('[data-ref="redact-top-controls"]');
    const topActions = this.container.querySelector<HTMLElement>('[data-ref="redact-top-actions"]');
    const settingsBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-options"], [data-ref="btn-tool-settings"]');
    hideElement(topControls);
    hideElement(topActions);
    if (settingsBtn) settingsBtn.classList.remove('is-visible');

    this.phaseManager?.setPhase('dropzone');
    this.hideError();
  }

  private async renderThumbnails(): Promise<void> {
    if (!this.pdfDocument) return;
    const container = this.container.querySelector<HTMLElement>('[data-ref="thumbnails-container"]');
    if (!container) return;
    container.innerHTML = '';

    const numPages = this.pdfDocument.numPages;
    for (let i = 1; i <= numPages; i++) {
      const pageIndex = i - 1;
      const thumbItem = document.createElement('div');
      thumbItem.className = `redact-thumbnail ${pageIndex === this.activePageIndex ? 'is-active' : ''} ${this.fullPageRedactions.has(pageIndex) ? 'is-full-redacted' : ''}`;
      thumbItem.setAttribute('data-ref', `thumb-page-${pageIndex}`);

      const sheet = document.createElement('div');
      sheet.className = 'redact-thumbnail__sheet';

      const canvas = document.createElement('canvas');
      canvas.className = 'redact-thumbnail__canvas';
      sheet.appendChild(canvas);

      const badge = document.createElement('span');
      badge.className = 'redact-thumbnail__badge';
      badge.textContent = `#${i}`;

      thumbItem.appendChild(sheet);
      thumbItem.appendChild(badge);
      container.appendChild(thumbItem);

      thumbItem.addEventListener('click', () => {
        this.activePageIndex = pageIndex;
        this.container.querySelectorAll('.redact-thumbnail').forEach((t) => t.classList.remove('is-active'));
        thumbItem.classList.add('is-active');

        const targetPageCard = this.container.querySelector<HTMLElement>(`[data-page-index="${pageIndex}"]`);
        if (targetPageCard) {
          targetPageCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        this.zoomController?.updatePageInfo(pageIndex + 1, this.pdfDocument?.numPages || 1);
      });

      try {
        const page = await this.pdfDocument.getPage(i);
        const origVp = page.getViewport({ scale: 1 });
        const thumbScale = 100 / origVp.width;
        const vp = page.getViewport({ scale: thumbScale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        }
      } catch {}
    }
  }

  private async renderDocumentPages(): Promise<void> {
    if (!this.pdfDocument) return;
    const pagesWrapper = this.container.querySelector<HTMLElement>('[data-ref="pages-wrapper"]');
    if (!pagesWrapper) return;
    pagesWrapper.innerHTML = '';

    const numPages = this.pdfDocument.numPages;

    for (let i = 1; i <= numPages; i++) {
      const pageIndex = i - 1;
      const page = await this.pdfDocument.getPage(i);
      const dims = this.pageDimensions[pageIndex];

      const baseWidth = 760;
      const displayScale = baseWidth / dims.width;
      this.pageScales[pageIndex] = displayScale;

      const displayWidth = Math.floor(baseWidth);
      const displayHeight = Math.floor((dims.height / dims.width) * baseWidth);
      const scaledW = Math.round(displayWidth * this.zoomLevel);
      const scaledH = Math.round(displayHeight * this.zoomLevel);

      const pageCard = document.createElement('div');
      pageCard.className = 'pdf-redact-page-card';
      pageCard.setAttribute('data-page-index', `${pageIndex}`);
      pageCard.style.width = `${scaledW}px`;

      const header = document.createElement('div');
      header.className = 'pdf-redact-page-card__header';
      header.style.width = `${scaledW}px`;

      const title = document.createElement('span');
      title.className = 'pdf-redact-page-card__title';
      title.textContent = `Página ${i}`;
      header.appendChild(title);

      const togglePageBtn = document.createElement('button');
      togglePageBtn.type = 'button';
      togglePageBtn.className = 'component-button component-button--secondary component-button--h36';
      togglePageBtn.setAttribute('data-ref', `btn-toggle-page-${pageIndex}`);

      const isFull = this.fullPageRedactions.has(pageIndex);
      togglePageBtn.innerHTML = isFull
        ? '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#undo"></use></svg><span>Restaurar página</span>'
        : '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg><span>Censurar página completa</span>';

      togglePageBtn.addEventListener('click', () => {
        this.toggleFullPageRedact(pageIndex);
      });
      header.appendChild(togglePageBtn);
      pageCard.appendChild(header);

      const scalerEl = document.createElement('div');
      scalerEl.className = 'tool-viewport-scaler';
      scalerEl.setAttribute('data-ref', `viewport-scaler-${pageIndex}`);
      scalerEl.style.width = `${scaledW}px`;
      scalerEl.style.height = `${scaledH}px`;

      const viewportEl = document.createElement('div');
      viewportEl.className = 'pdf-redact-viewport tool-viewport-sheet';
      viewportEl.setAttribute('data-viewport-page', `${pageIndex}`);
      viewportEl.style.width = `${displayWidth}px`;
      viewportEl.style.height = `${displayHeight}px`;
      viewportEl.style.transform = `scale(${this.zoomLevel})`;
      viewportEl.style.transformOrigin = 'top left';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-redact-canvas';
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        const viewport = page.getViewport({ scale: displayScale });
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      viewportEl.appendChild(canvas);

      const textLayer = document.createElement('div');
      textLayer.className = 'pdf-redact-text-layer';
      textLayer.setAttribute('data-textlayer-page', `${pageIndex}`);
      textLayer.style.pointerEvents = this.currentTool === 'select-text' ? 'auto' : 'none';
      viewportEl.appendChild(textLayer);

      await this.extractAndRenderTextItems(page, displayScale, textLayer, pageIndex);

      textLayer.addEventListener('mouseup', () => {
        if (this.currentTool !== 'select-text') return;
        this.handleTextSelection(pageIndex, viewportEl, displayScale);
      });

      const drawingSurface = document.createElement('div');
      drawingSurface.className = 'pdf-redact-drawing-surface';
      drawingSurface.setAttribute('data-drawing-page', `${pageIndex}`);
      drawingSurface.style.pointerEvents = this.currentTool === 'draw-box' ? 'auto' : 'none';
      viewportEl.appendChild(drawingSurface);

      this.bindDrawingSurfaceInteractions(drawingSurface, pageIndex, viewportEl, displayScale);

      const overlay = document.createElement('div');
      overlay.className = 'pdf-redactions-layer';
      overlay.setAttribute('data-overlay-page', `${pageIndex}`);
      viewportEl.appendChild(overlay);

      scalerEl.appendChild(viewportEl);
      pageCard.appendChild(scalerEl);
      pagesWrapper.appendChild(pageCard);

      this.renderPageRedactions(pageIndex);
    }
  }

  private async extractAndRenderTextItems(
    page: any,
    scale: number,
    textLayer: HTMLElement,
    pageIndex: number
  ): Promise<void> {
    try {
      const textContent = await page.getTextContent();
      const dims = this.pageDimensions[pageIndex];
      const viewport = page.getViewport({ scale });
      const itemsList: Array<{ height: number; str: string; width: number; x: number; y: number }> = [];

      if (textContent.items && textContent.items.length > 0) {
        textContent.items.forEach((item: any) => {
          if (!item || typeof item.str !== 'string' || !item.str.trim() || !Array.isArray(item.transform) || item.transform.length < 6) return;

          const tx = (window as any).pdfjsLib?.Util?.transform
            ? (window as any).pdfjsLib.Util.transform(viewport.transform, item.transform)
            : [scale, 0, 0, scale, item.transform[4] * scale, (dims.height - item.transform[5]) * scale];

          const itemH = item.height * scale || 14;
          const itemX = tx[4];
          const itemY = tx[5] - itemH;
          const itemW = item.width * scale;
          const fontSize = Math.max(10, Math.round(itemH));

          itemsList.push({
            height: item.height || 14,
            str: item.str,
            width: item.width,
            x: item.transform[4],
            y: item.transform[5],
          });

          const span = document.createElement('span');
          span.className = 'pdf-redact-text-item';
          span.style.left = `${itemX}px`;
          span.style.top = `${itemY}px`;
          span.style.width = `${Math.max(itemW, 8)}px`;
          span.style.height = `${itemH}px`;
          span.style.fontSize = `${fontSize}px`;
          span.textContent = item.str;

          textLayer.appendChild(span);
        });
      }

      this.pageTextItems[pageIndex] = itemsList;
    } catch {}
  }

  private handleTextSelection(pageIndex: number, viewportEl: HTMLElement, scale: number): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();
    if (clientRects.length === 0) return;

    const vpRect = viewportEl.getBoundingClientRect();
    let addedCount = 0;

    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      const relX = Math.round(((rect.left - vpRect.left) / this.zoomLevel) / scale);
      const relY = Math.round(((rect.top - vpRect.top) / this.zoomLevel) / scale);
      const relW = Math.round((rect.width / this.zoomLevel) / scale);
      const relH = Math.round((rect.height / this.zoomLevel) / scale);

      if (relW > 2 && relH > 2) {
        this.redactionBoxes.push({
          height: relH,
          id: crypto.randomUUID(),
          pageIndex,
          text: selectedText,
          width: relW,
          x: relX,
          y: relY,
        });
        addedCount++;
      }
    }

    selection.removeAllRanges();

    if (addedCount > 0) {
      this.renderPageRedactions(pageIndex);
      this.updateSidebarSummary();
      this.renderThumbnails();
      showToast(t('toasts.texto_censurado_correctamente'), 'success');
    }
  }

  private bindDrawingSurfaceInteractions(
    surface: HTMLElement,
    pageIndex: number,
    viewportEl: HTMLElement,
    scale: number
  ): void {
    let startX = 0;
    let startY = 0;
    let isDrawing = false;
    let previewBox: HTMLElement | null = null;

    surface.addEventListener('mousedown', (e: MouseEvent) => {
      if (this.currentTool !== 'draw-box') return;
      const vpRect = viewportEl.getBoundingClientRect();
      startX = (e.clientX - vpRect.left) / this.zoomLevel;
      startY = (e.clientY - vpRect.top) / this.zoomLevel;
      isDrawing = true;

      previewBox = document.createElement('div');
      previewBox.className = 'pdf-redact-preview-box';
      previewBox.style.left = `${startX}px`;
      previewBox.style.top = `${startY}px`;
      previewBox.style.width = '0px';
      previewBox.style.height = '0px';
      viewportEl.appendChild(previewBox);

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDrawing || !previewBox) return;
        const curX = (ev.clientX - vpRect.left) / this.zoomLevel;
        const curY = (ev.clientY - vpRect.top) / this.zoomLevel;

        const left = Math.min(startX, curX);
        const top = Math.min(startY, curY);
        const width = Math.abs(curX - startX);
        const height = Math.abs(curY - startY);

        previewBox.style.left = `${left}px`;
        previewBox.style.top = `${top}px`;
        previewBox.style.width = `${width}px`;
        previewBox.style.height = `${height}px`;
      };

      const onMouseUp = (ev: MouseEvent) => {
        if (!isDrawing) return;
        isDrawing = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (previewBox && previewBox.parentElement) {
          previewBox.parentElement.removeChild(previewBox);
          previewBox = null;
        }

        const curX = (ev.clientX - vpRect.left) / this.zoomLevel;
        const curY = (ev.clientY - vpRect.top) / this.zoomLevel;

        const left = Math.min(startX, curX);
        const top = Math.min(startY, curY);
        const width = Math.abs(curX - startX);
        const height = Math.abs(curY - startY);

        const pdfX = Math.round(left / scale);
        const pdfY = Math.round(top / scale);
        const pdfW = Math.round(width / scale);
        const pdfH = Math.round(height / scale);

        if (pdfW > 4 && pdfH > 4) {
          this.redactionBoxes.push({
            height: pdfH,
            id: crypto.randomUUID(),
            pageIndex,
            width: pdfW,
            x: pdfX,
            y: pdfY,
          });

          this.renderPageRedactions(pageIndex);
          this.updateSidebarSummary();
          this.renderThumbnails();
          showToast(t('toasts.area_de_censura_anadida'), 'success');
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  private toggleFullPageRedact(pageIndex: number): void {
    if (this.fullPageRedactions.has(pageIndex)) {
      this.fullPageRedactions.delete(pageIndex);
      showToast(t('toasts.pagina_restaurada'), 'info');
    } else {
      this.fullPageRedactions.add(pageIndex);
      showToast(t('toasts.pagina_censurada_por_completo'), 'warning');
    }

    const toggleBtn = this.container.querySelector<HTMLButtonElement>(`[data-ref="btn-toggle-page-${pageIndex}"]`);
    if (toggleBtn) {
      const isFull = this.fullPageRedactions.has(pageIndex);
      toggleBtn.innerHTML = isFull
        ? '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#undo"></use></svg><span>Restaurar página</span>'
        : '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg><span>Censurar página completa</span>';
    }

    this.renderPageRedactions(pageIndex);
    this.updateSidebarSummary();
    this.renderThumbnails();
  }

  private renderPageRedactions(pageIndex: number): void {
    const overlay = this.container.querySelector<HTMLElement>(`[data-overlay-page="${pageIndex}"]`);
    if (!overlay) return;
    overlay.innerHTML = '';

    const scale = this.pageScales[pageIndex] || 1;

    if (this.fullPageRedactions.has(pageIndex)) {
      const fullOverlay = document.createElement('div');
      fullOverlay.className = 'page-redaction-overlay--full';

      const badge = document.createElement('div');
      badge.className = 'page-redaction-overlay--full__badge';
      badge.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg><span>Página censurada por completo</span>';
      fullOverlay.appendChild(badge);

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'component-button component-button--secondary component-button--h36';
      restoreBtn.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#undo"></use></svg><span>Restaurar</span>';
      restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullPageRedact(pageIndex);
      });
      fullOverlay.appendChild(restoreBtn);

      overlay.appendChild(fullOverlay);
      return;
    }

    const boxes = this.redactionBoxes.filter((b) => b.pageIndex === pageIndex);
    boxes.forEach((box) => {
      const boxEl = document.createElement('div');
      boxEl.className = 'redaction-box';
      boxEl.setAttribute('data-box-id', box.id);
      boxEl.style.left = `${box.x * scale}px`;
      boxEl.style.top = `${box.y * scale}px`;
      boxEl.style.width = `${box.width * scale}px`;
      boxEl.style.height = `${box.height * scale}px`;
      boxEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.container.querySelectorAll('.redaction-box').forEach((b) => b.classList.remove('is-selected'));
        boxEl.classList.add('is-selected');
      });

      overlay.appendChild(boxEl);
    });
  }

  private removeRedactionBox(id: string): void {
    const box = this.redactionBoxes.find((b) => b.id === id);
    if (!box) return;
    const pageIndex = box.pageIndex;
    this.redactionBoxes = this.redactionBoxes.filter((b) => b.id !== id);

    this.renderPageRedactions(pageIndex);
    this.updateSidebarSummary();
    this.renderThumbnails();
  }

  private clearAllRedactions(): void {
    if (this.redactionBoxes.length === 0 && this.fullPageRedactions.size === 0) return;
    this.redactionBoxes = [];
    this.fullPageRedactions.clear();

    const numPages = this.pdfDocument?.numPages || 0;
    for (let i = 0; i < numPages; i++) {
      const toggleBtn = this.container.querySelector<HTMLButtonElement>(`[data-ref="btn-toggle-page-${i}"]`);
      if (toggleBtn) {
        toggleBtn.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility_off"></use></svg><span>Censurar página completa</span>';
      }
      this.renderPageRedactions(i);
    }

    this.updateSidebarSummary();
    this.renderThumbnails();
    showToast(t('toasts.se_eliminaron_todas_las_censuras'), 'info');
  }

  private handleSearchAndRedact(phrase: string): void {
    const query = phrase.trim().toLowerCase();
    if (!query) {
      showToast(t('toasts.introduce_una_palabra_o_frase_para_busca'), 'warning');
      return;
    }

    let matchesCount = 0;
    const numPages = this.pdfDocument?.numPages || 0;

    for (let p = 0; p < numPages; p++) {
      const items = this.pageTextItems[p] || [];
      const dims = this.pageDimensions[p];
      if (!dims) continue;

      items.forEach((item) => {
        if (item.str.toLowerCase().includes(query)) {
          const charWidth = item.width / item.str.length;
          const startIndex = item.str.toLowerCase().indexOf(query);
          const matchWidth = Math.max(8, charWidth * query.length);
          const matchX = Math.round(item.x + (charWidth * startIndex));
          const matchY = Math.round(dims.height - item.y - item.height);

          this.redactionBoxes.push({
            height: Math.round(item.height || 14),
            id: crypto.randomUUID(),
            pageIndex: p,
            text: query,
            width: Math.round(matchWidth),
            x: matchX,
            y: matchY,
          });

          matchesCount++;
        }
      });

      this.renderPageRedactions(p);
    }

    if (matchesCount > 0) {
      this.updateSidebarSummary();
      this.renderThumbnails();
      showToast(`Se censuraron ${matchesCount} coincidencias de "${query}".`, 'success');
    } else {
      showToast(`No se encontraron coincidencias para "${query}".`, 'info');
    }
  }

  private updateSidebarSummary(): void {
    const totalRedactions = this.redactionBoxes.length;
    const fullPagesCount = this.fullPageRedactions.size;

    const executeBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-execute-redact"]');
    if (executeBtn) {
      executeBtn.disabled = (totalRedactions === 0 && fullPagesCount === 0);
    }

    const listContainer = this.container.querySelector<HTMLElement>('[data-ref="redactions-list-container"]');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (totalRedactions === 0 && fullPagesCount === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'redact-items-list__empty';
      emptyMsg.setAttribute('data-ref', 'redactions-empty-msg');
      emptyMsg.textContent = t('ui.no_has_anadido_ninguna_censura_todavia_s');
      listContainer.appendChild(emptyMsg);
      return;
    }

    this.fullPageRedactions.forEach((pageIdx) => {
      const row = document.createElement('div');
      row.className = 'redact-item-row';

      const badge = document.createElement('span');
      badge.className = 'redact-item-row__badge';
      badge.textContent = `Pág. ${pageIdx + 1}`;
      row.appendChild(badge);

      const text = document.createElement('span');
      text.className = 'redact-item-row__text';
      text.textContent = 'Página completa censurada';
      row.appendChild(text);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'redact-item-row__remove';
      removeBtn.setAttribute('data-tooltip', 'Restaurar página');
      removeBtn.setAttribute('aria-label', 'Restaurar página');
      removeBtn.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>';
      removeBtn.addEventListener('click', () => {
        this.toggleFullPageRedact(pageIdx);
      });
      row.appendChild(removeBtn);

      listContainer.appendChild(row);
    });

    this.redactionBoxes.forEach((box) => {
      const row = document.createElement('div');
      row.className = 'redact-item-row';

      const badge = document.createElement('span');
      badge.className = 'redact-item-row__badge';
      badge.textContent = `Pág. ${box.pageIndex + 1}`;
      row.appendChild(badge);

      const text = document.createElement('span');
      text.className = 'redact-item-row__text';
      text.textContent = box.text ? `"${box.text}"` : `Área [${box.width}×${box.height}]`;
      row.appendChild(text);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'redact-item-row__remove';
      removeBtn.setAttribute('data-tooltip', 'Eliminar censura');
      removeBtn.setAttribute('aria-label', 'Eliminar censura');
      removeBtn.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>';
      removeBtn.addEventListener('click', () => {
        this.removeRedactionBox(box.id);
      });
      row.appendChild(removeBtn);

      listContainer.appendChild(row);
    });

    renderIcons(listContainer);
  }

  private async executeRedaction(): Promise<void> {
    if (this.isProcessing || !this.currentFile) return;

    const totalRedactions = this.redactionBoxes.length;
    const fullPagesCount = this.fullPageRedactions.size;

    if (totalRedactions === 0 && fullPagesCount === 0) {
      showToast(t('toasts.anade_al_menos_una_censura_de_texto_area'), 'warning');
      return;
    }

    this.isProcessing = true;
    this.hideError();
    this.phaseManager?.showUploading(1, 1);

    try {
      const numPages = this.pdfDocument?.numPages || 0;
      const pageRedactions: any[] = [];

      for (let i = 0; i < numPages; i++) {
        const isFull = this.fullPageRedactions.has(i);
        const boxes = this.redactionBoxes.filter((b) => b.pageIndex === i);

        if (isFull || boxes.length > 0) {
          pageRedactions.push({
            boxes: isFull ? [] : boxes.map((b) => ({
              height: b.height,
              text: b.text,
              width: b.width,
              x: b.x,
              y: b.y,
            })),
            fullPage: isFull,
            pageIndex: i,
          });
        }
      }

      const formData = new FormData();
      formData.append('pdf', this.currentFile);
      formData.append('file', this.currentFile);
      formData.append('redactions', JSON.stringify(pageRedactions));
      formData.append('sanitizeMetadata', 'true');

      const response = await postFormWithProgress(
        API_ROUTES.tools.redactPdf.redact,
        formData,
        (progress) => {
          this.phaseManager?.updateUploadProgress(progress, 1);
        }
      );
      const result = (await response.json()) as {
        data?: RedactPdfResultData;
        error?: string;
        message?: string;
        success: boolean;
      };

      this.phaseManager?.showProcessing(
        'Censurando y purgando contenido...',
        t('ui.eliminando_texto_internamente_y_aplicand')
      );

      if (response.ok && result.success && result.data) {
        const token = result.data.fileId;
        showToast(t('toasts.documento_censurado_con_exito'), 'success');
        this.phaseManager?.navigateToDownload({
          downloadUrl: `/api/download/${token}`,
          fileSize: result.data.fileSize,
          filename: result.data.filename || `${this.currentFile.name.replace(/\.pdf$/i, '')}_censurado.pdf`,
          returnText: 'Censurar otro documento PDF',
          returnUrl: '/redact-pdf',
          subtitle: t('tools.redact_success_prefix') + `"${this.currentFile?.name}".`,
          title: '¡PDF censurado con éxito!',
          token,
        });
      } else {
        throw new Error(result.error || result.message || t('ui.error_al_censurar_el_documento_pdf'));
      }
    } catch (err: any) {
      const message = err?.message || t('ui.ha_ocurrido_un_error_inesperado_al_proce');
      this.phaseManager?.showError(message);
      this.showError(message);
    } finally {
      this.isProcessing = false;
    }
  }

  private showError(msg: string): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="redact-global-error"]');
    if (errorEl) {
      errorEl.textContent = msg;
      showElement(errorEl);
    }
    showToast(msg, 'danger');
  }

  private hideError(): void {
    const errorEl = this.container.querySelector<HTMLElement>('[data-ref="redact-global-error"]');
    if (errorEl) {
      errorEl.textContent = '';
      hideElement(errorEl);
    }
  }
}

async function createRedactPdfView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/tools/redact-pdf/redact-pdf.html');
  const controller = new RedactPdfController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { RedactPdfController, createRedactPdfView };
