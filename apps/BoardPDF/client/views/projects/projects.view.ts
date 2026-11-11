import { getFooterHtml, mountSiteFooter } from '../../components/footer.component.js';
import { getLabelDisplayName, openCreateFolderModal, openDeleteDocModal, openDeleteFolderModal, openDeleteUploadModal, openDocumentLabelsModal, openMoveDocModal, openMoveUploadModal, openRenameFolderModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { COLLAB_DOCUMENT_DEFAULT_SIZE } from '../../config/collab-page-presets.config.js';
import { currentUser, deleteApi, getApi, patchApi, postApi, putApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { navigate } from '../../services/navigation.service.js';
import { renderPdfThumbnail } from '../../services/pdf-preview.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { DocumentLabel, ViewController } from '../../types/common.types.js';
import { debounce, setupDropdown } from '../../utils/dom.util.js';


interface ProjectFolder {
  color?: string | null;
  created_at: string;
  document_count?: number;
  file_count?: number;
  folder_type: 'project' | 'uploads' | 'upload_folder';
  id: string;
  name: string;
  parent_id?: string | null;
  updated_at: string;
  user_id?: number | null;
}

interface DocItem {
  access_level?: string;
  content?: any;
  created_at: string;
  folder_id?: string | null;
  id: string;
  labels?: DocumentLabel[];
  page_count: number;
  pdf_filename?: string;
  title: string;
  updated_at: string;
}

interface UploadFileItem {
  createdAt?: string;
  folderId?: string | null;
  id: string;
  mimeType: string;
  name: string;
  pageCount?: number;
  size: number;
  type: string;
  url: string;
  userId?: number | null;
}

class ProjectsController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private footerController: { destroy: () => void } | null = null;
  private currentFolder: ProjectFolder | null = null;
  private currentFolderId: string | null = null;
  private customLabelsCount: number = 0;
  private documents: DocItem[] = [];
  private files: UploadFileItem[] = [];
  private filterCategory: string = 'all';
  private filterLabelId: number | null = null;
  private filterType: 'all' | 'docs' | 'folders' | 'images' | 'pdfs' | 'uploads' = 'all';
  private folders: ProjectFolder[] = [];
  private maxCustomLabels: number = 3;
  private searchQuery: string = '';
  private sortAscending: boolean = false;
  private sortOption: 'az' | 'oldest' | 'recent' | 'za' = 'recent';
  private uploadsActiveTab: 'all' | 'images' | 'pdfs' = 'all';
  private uploadsFolder: ProjectFolder | null = null;
  private userLabels: DocumentLabel[] = [];

  constructor(container: HTMLElement, folderId?: string | null) {
    this.container = container;
    this.currentFolderId = folderId || null;
  }

  public async init(): Promise<void> {
    if (!currentUser) {
      navigate('/login?redirect=%2Fprojects', true);
      return;
    }
    this.abortController = new AbortController();
    await this.loadData();
    this.renderView();
    this.renderFooter();
    renderIcons(this.container);
    this.bindEvents();
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.footerController) {
      this.footerController.destroy();
      this.footerController = null;
    }
  }

  private renderFooter(): void {
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="projects-footer-section"]');
    if (!footerContainer) return;

    footerContainer.innerHTML = getFooterHtml();
    this.footerController = mountSiteFooter(footerContainer, this.abortController?.signal);
  }

  private async loadData(): Promise<void> {
    if (!this.currentFolderId) {
      await Promise.all([this.loadRootProjectsData(), this.loadLabelsCatalog()]);
    } else {
      await Promise.all([this.loadFolderDetailData(this.currentFolderId), this.loadLabelsCatalog()]);
    }
  }

  private async loadLabelsCatalog(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.documentLabels.base);
      if (res.ok) {
        const data = await res.json();
        this.userLabels = Array.isArray(data.labels) ? data.labels : [];
        this.customLabelsCount = typeof data.customCount === 'number'
          ? data.customCount
          : this.userLabels.filter((l) => !l.is_default).length;
        this.maxCustomLabels = typeof data.maxCustomLabels === 'number' ? data.maxCustomLabels : 3;
      }
    } catch {
    }
  }

  private async loadRootProjectsData(): Promise<void> {
    this.currentFolder = null;
    try {
      const docsRes = await getApi(API_ROUTES.collaborativeDocs.base);
      if (docsRes.ok) {
        const data = await docsRes.json();
        const serverDocs: DocItem[] = Array.isArray(data.documents) ? data.documents : [];
        this.documents = serverDocs.filter((d) => !d.folder_id);
      } else {
        this.documents = [];
      }
    } catch {
      this.documents = [];
    }

    try {
      const foldersRes = await getApi(API_ROUTES.projectFolders.base);
      if (foldersRes.ok) {
        const fData = await foldersRes.json();
        this.folders = Array.isArray(fData.folders) ? fData.folders.filter((f: ProjectFolder) => f.folder_type === 'project') : [];
        this.uploadsFolder = fData.uploadsFolder || null;
      }
    } catch {
      this.folders = [];
      this.uploadsFolder = null;
    }
  }

  private async loadFolderDetailData(folderId: string): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.projectFolders.byId(folderId));
      if (!res.ok) {
        showToast(t('projects.folder_not_found', 'Carpeta no encontrada'), 'warning');
        navigate('/projects');
        return;
      }
      const data = await res.json();
      this.currentFolder = data.folder || null;
      this.documents = Array.isArray(data.documents) ? data.documents : [];
      this.files = Array.isArray(data.files) ? data.files : [];
      this.folders = Array.isArray(data.subfolders) ? data.subfolders : [];
    } catch {
      showToast(t('projects.folder_load_error', 'Error al cargar carpeta'), 'danger');
      navigate('/projects');
    }
  }

  private getFilteredAndSortedDocs(): DocItem[] {
    let list = [...this.documents];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter((d) => (d.title || '').toLowerCase().includes(q));
    }

    if (this.filterCategory !== 'all') {
      if (this.filterCategory === 'root') {
        list = list.filter((d) => !d.folder_id);
      } else {
        list = list.filter((d) => d.folder_id === this.filterCategory);
      }
    }

    if (this.filterLabelId !== null) {
      list = list.filter((d) => Array.isArray(d.labels) && d.labels.some((lbl) => lbl.id === this.filterLabelId));
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (this.sortOption === 'recent') {
        comparison = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      } else if (this.sortOption === 'oldest') {
        comparison = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
      } else if (this.sortOption === 'az') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (this.sortOption === 'za') {
        comparison = (b.title || '').localeCompare(a.title || '');
      }
      return this.sortAscending ? -comparison : comparison;
    });

    return list;
  }

  private getFilteredAndSortedFolders(): ProjectFolder[] {
    let list = [...this.folders];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter((f) => (f.name || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (this.sortOption === 'az') {
        comparison = a.name.localeCompare(b.name);
      } else if (this.sortOption === 'za') {
        comparison = b.name.localeCompare(a.name);
      } else if (this.sortOption === 'oldest') {
        comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      } else {
        comparison = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return this.sortAscending ? -comparison : comparison;
    });

    return list;
  }

  private getFilteredAndSortedUploads(): UploadFileItem[] {
    let list = [...this.files];

    if (this.filterType === 'images' || this.uploadsActiveTab === 'images') {
      list = list.filter((f) => f.type === 'image' || f.mimeType?.startsWith('image/'));
    } else if (this.filterType === 'pdfs' || this.uploadsActiveTab === 'pdfs') {
      list = list.filter((f) => f.type === 'pdf' || f.mimeType?.includes('pdf'));
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter((f) => (f.name || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (this.sortOption === 'az') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (this.sortOption === 'za') {
        comparison = (b.name || '').localeCompare(a.name || '');
      } else if (this.sortOption === 'oldest') {
        comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else {
        comparison = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return this.sortAscending ? -comparison : comparison;
    });

    return list;
  }

  private renderView(): void {
    const mainTitle = this.container.querySelector<HTMLElement>('[data-ref="projects-main-title"]');
    const folderHeaderActions = this.container.querySelector<HTMLElement>('[data-ref="folder-header-actions"]');
    const btnFolderBack = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-back"]');
    const btnUploadDirect = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-upload-direct"]');

    const sectionFolders = this.container.querySelector<HTMLElement>('[data-ref="section-folders"]');
    const sectionDocs = this.container.querySelector<HTMLElement>('[data-ref="section-documents"]');
    const sectionUploads = this.container.querySelector<HTMLElement>('[data-ref="section-uploads"]');

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-project-search"]');
    const clearBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');
    if (clearBtn) {
      if (this.searchQuery) {
        clearBtn.classList.remove('is-hidden');
      } else {
        clearBtn.classList.add('is-hidden');
      }
    }

    const btnFilterType = this.container.querySelector<HTMLElement>('[data-ref="btn-filter-type"]');
    btnFilterType?.classList.toggle('is-active', this.filterType !== 'all');

    const btnFilterCat = this.container.querySelector<HTMLElement>('[data-ref="btn-filter-category"]');
    btnFilterCat?.classList.toggle('is-active', this.filterCategory !== 'all');

    const btnFilterLabel = this.container.querySelector<HTMLElement>('[data-ref="btn-filter-label"]');
    btnFilterLabel?.classList.toggle('is-active', this.filterLabelId !== null);

    const btnFilterDate = this.container.querySelector<HTMLElement>('[data-ref="btn-filter-date"]');
    btnFilterDate?.classList.toggle('is-active', this.sortOption !== 'recent');

    const mainSubtitle = this.container.querySelector<HTMLElement>('[data-ref="projects-main-subtitle"]');
    const dropdownCategory = this.container.querySelector<HTMLElement>('[data-ref="dropdown-filter-category"]');
    const dropdownLabel = this.container.querySelector<HTMLElement>('[data-ref="dropdown-filter-label"]');

    if (!this.currentFolderId || !this.currentFolder) {
      if (mainTitle) mainTitle.textContent = t('projects.title');
      if (mainSubtitle) mainSubtitle.textContent = t('projects.subtitle');
      btnFolderBack?.classList.add('is-hidden');
      folderHeaderActions?.classList.add('is-hidden');
      btnUploadDirect?.classList.add('is-hidden');

      sectionDocs?.classList.remove('is-hidden');
      sectionUploads?.classList.add('is-hidden');

      if (dropdownCategory) dropdownCategory.classList.remove('is-hidden');
      if (dropdownLabel) dropdownLabel.classList.toggle('is-hidden', this.userLabels.length === 0);

      this.renderTypeFilterMenu('root');
      this.renderRootFoldersGrid();
      this.renderDocsGrid();
    } else if (this.currentFolder.folder_type === 'project') {
      const folderName = this.currentFolder.name;
      if (mainTitle) mainTitle.textContent = folderName;
      if (mainSubtitle) mainSubtitle.textContent = t('projects.subtitle_project_folder');
      btnFolderBack?.classList.remove('is-hidden');
      folderHeaderActions?.classList.remove('is-hidden');
      btnUploadDirect?.classList.add('is-hidden');

      sectionFolders?.classList.add('is-hidden');
      sectionDocs?.classList.remove('is-hidden');
      sectionUploads?.classList.add('is-hidden');

      if (dropdownCategory) dropdownCategory.classList.add('is-hidden');
      if (dropdownLabel) dropdownLabel.classList.toggle('is-hidden', this.userLabels.length === 0);

      this.renderTypeFilterMenu('project');
      this.renderDocsGrid();
    } else if (this.currentFolder.folder_type === 'uploads') {
      if (mainTitle) mainTitle.textContent = t('projects.uploads_title');
      if (mainSubtitle) mainSubtitle.textContent = t('projects.subtitle_uploads');
      btnFolderBack?.classList.remove('is-hidden');
      folderHeaderActions?.classList.add('is-hidden');
      btnUploadDirect?.classList.remove('is-hidden');

      sectionFolders?.classList.remove('is-hidden');
      sectionDocs?.classList.add('is-hidden');
      sectionUploads?.classList.remove('is-hidden');

      if (dropdownCategory) dropdownCategory.classList.add('is-hidden');
      if (dropdownLabel) dropdownLabel.classList.add('is-hidden');

      this.renderTypeFilterMenu('uploads');
      this.renderUploadSubfoldersGrid();
      this.renderUploadsGrid();
    } else if (this.currentFolder.folder_type === 'upload_folder') {
      const folderName = this.currentFolder.name;
      if (mainTitle) mainTitle.textContent = folderName;
      if (mainSubtitle) mainSubtitle.textContent = t('projects.subtitle_uploads');
      btnFolderBack?.classList.remove('is-hidden');
      folderHeaderActions?.classList.remove('is-hidden');
      btnUploadDirect?.classList.remove('is-hidden');

      sectionFolders?.classList.add('is-hidden');
      sectionDocs?.classList.add('is-hidden');
      sectionUploads?.classList.remove('is-hidden');

      if (dropdownCategory) dropdownCategory.classList.add('is-hidden');
      if (dropdownLabel) dropdownLabel.classList.add('is-hidden');

      this.renderTypeFilterMenu('uploads');
      this.renderUploadsGrid();
    }

    this.renderCategoryFilterItems();
    this.renderLabelFilterItems();
  }

  private renderTypeFilterMenu(context: 'root' | 'project' | 'uploads'): void {
    const bar = this.container.querySelector<HTMLElement>('[data-ref="projects-categories-bar"]');
    if (!bar) return;

    if (context === 'uploads') {
      bar.innerHTML = `
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'all' ? 'is-active' : ''}" data-ref="pill-type-all" data-type="all">
          ${t('projects.tab_all')}
        </button>
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'images' ? 'is-active' : ''}" data-ref="pill-type-images" data-type="images">
          ${t('projects.tab_images')}
        </button>
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'pdfs' ? 'is-active' : ''}" data-ref="pill-type-pdfs" data-type="pdfs">
          ${t('projects.tab_pdfs')}
        </button>
      `;
    } else if (context === 'project') {
      bar.innerHTML = `
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'all' ? 'is-active' : ''}" data-ref="pill-type-all" data-type="all">
          ${t('projects.tab_all')}
        </button>
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'docs' ? 'is-active' : ''}" data-ref="pill-type-docs" data-type="docs">
          ${t('projects.tab_docs')}
        </button>
      `;
    } else {
      bar.innerHTML = `
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'all' ? 'is-active' : ''}" data-ref="pill-type-all" data-type="all">
          ${t('projects.tab_all')}
        </button>
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'docs' ? 'is-active' : ''}" data-ref="pill-type-docs" data-type="docs">
          ${t('projects.tab_docs')}
        </button>
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'folders' ? 'is-active' : ''}" data-ref="pill-type-folders" data-type="folders">
          ${t('projects.tab_folders')}
        </button>
        <button type="button" class="component-badge component-badge--interactive ${this.filterType === 'uploads' ? 'is-active' : ''}" data-ref="pill-type-uploads" data-type="uploads">
          ${t('projects.tab_uploads')}
        </button>
      `;
    }

    renderIcons(bar);
  }

  private renderCategoryFilterItems(): void {
    const list = this.container.querySelector<HTMLElement>('[data-ref="list-filter-category"]');
    if (!list) return;

    let html = `
      <button type="button" class="menu-item ${this.filterCategory === 'all' ? 'is-active' : ''}" data-ref="item-cat-all" data-category="all">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#grid_view"></use></svg>
        <span class="menu-item__text">Todas las categorías</span>
      </button>
      <button type="button" class="menu-item ${this.filterCategory === 'root' ? 'is-active' : ''}" data-ref="item-cat-root" data-category="root">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#home"></use></svg>
        <span class="menu-item__text">Sin carpeta (Raíz)</span>
      </button>
    `;

    this.folders.forEach((f) => {
      const isActive = this.filterCategory === f.id;
      html += `
        <button type="button" class="menu-item ${isActive ? 'is-active' : ''}" data-ref="item-cat-${f.id}" data-category="${f.id}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          <span class="menu-item__text">${this.escapeHtml(f.name)}</span>
        </button>
      `;
    });

    list.innerHTML = html;
  }

  private renderLabelFilterItems(): void {
    const list = this.container.querySelector<HTMLElement>('[data-ref="list-filter-label"]');
    const badgeLabel = this.container.querySelector<HTMLElement>('[data-ref="label-filter-label"]');
    const badgeDot = this.container.querySelector<HTMLElement>('[data-ref="dot-filter-label"]');
    if (!list) return;

    let html = `
      <button type="button" class="menu-item ${this.filterLabelId === null ? 'is-active' : ''}" data-ref="item-label-all" data-filter-label-id="all">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#label"></use></svg>
        <span class="menu-item__text">${this.escapeHtml(t('projects.label_all'))}</span>
      </button>
    `;

    for (const lbl of this.userLabels) {
      const isActive = this.filterLabelId === lbl.id;
      const displayName = getLabelDisplayName(lbl);
      html += `
        <button type="button" class="menu-item ${isActive ? 'is-active' : ''}" data-ref="item-label-${lbl.id}" data-filter-label-id="${lbl.id}">
          <span class="projects-filter-label__menu-dot label-dot--${lbl.color}"></span>
          <span class="menu-item__text">${this.escapeHtml(displayName)}</span>
        </button>
      `;
    }

    list.innerHTML = html;
    renderIcons(list);

    const activeLabel = this.filterLabelId !== null
      ? this.userLabels.find((l) => l.id === this.filterLabelId) || null
      : null;

    if (badgeLabel) {
      badgeLabel.textContent = activeLabel ? getLabelDisplayName(activeLabel) : t('projects.filter_label');
    }

    if (badgeDot) {
      badgeDot.className = 'projects-filter-label__dot';
      if (activeLabel) {
        badgeDot.classList.add(`label-dot--${activeLabel.color}`);
      } else {
        badgeDot.classList.add('is-hidden');
      }
    }
  }

  private renderDocsGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="grid-documents"]');
    const empty = this.container.querySelector<HTMLElement>('[data-ref="empty-documents"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="counter-documents"]');
    if (!grid || !empty) return;

    if (this.filterType === 'folders' || this.filterType === 'uploads') {
      grid.innerHTML = '';
      const filteredFolders = this.getFilteredAndSortedFolders();
      const hasFolders = (this.uploadsFolder ? 1 : 0) + filteredFolders.length > 0;
      if (!hasFolders) {
        empty.classList.remove('is-hidden');
      } else {
        empty.classList.add('is-hidden');
      }
      return;
    }

    const filteredDocs = this.getFilteredAndSortedDocs();
    const filteredFolders = this.getFilteredAndSortedFolders();
    const hasFolders = (this.uploadsFolder ? 1 : 0) + filteredFolders.length > 0;

    if (counter) {
      counter.textContent = `(${filteredDocs.length})`;
    }

    if (filteredDocs.length === 0) {
      grid.innerHTML = '';
      if (!hasFolders || (this.currentFolder && this.currentFolder.folder_type === 'project')) {
        empty.classList.remove('is-hidden');
      } else {
        empty.classList.add('is-hidden');
      }
      return;
    }

    empty.classList.add('is-hidden');

    grid.innerHTML = filteredDocs.map((doc) => {
      const isPublic = doc.access_level === 'anyone_with_link';
      const badgeIcon = isPublic ? 'lock_open' : 'lock';
      const badgeText = isPublic ? 'Público' : 'Privado';
      const relativeTime = this.formatRelativeTime(doc.updated_at);
      const dim = this.getDocDimensions(doc);
      const paperSize = this.computePaperSize(dim.width, dim.height, 196, 156);
      const docLabels = Array.isArray(doc.labels) ? doc.labels : [];
      const labelsDotsHtml = docLabels.length > 0
        ? `<div class="pdf-card__labels" data-ref="labels-doc-${doc.id}">${docLabels
            .map((lbl) => `<span class="pdf-card__label-dot label-dot--${lbl.color}" title="${this.escapeHtml(getLabelDisplayName(lbl))}"></span>`)
            .join('')}</div>`
        : '';

      return `
        <div class="tool-card tool-card--collab-doc" data-ref="card-doc-${doc.id}" data-doc-id="${doc.id}">
          <div class="tool-card__preview-box" data-ref="thumb-box-${doc.id}">
            <div class="pdf-card__actions" data-ref="actions-doc-${doc.id}">
              <div class="dropdown" data-ref="dropdown-doc-${doc.id}">
                <button type="button" class="component-button component-button--icon-only pdf-card__btn-action dropdown-trigger" data-ref="btn-more-pdf" data-id="${doc.id}" data-tooltip="Más opciones" aria-label="Más opciones">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_vert"></use></svg>
                </button>
                <div class="menu-panel menu-panel--dropdown menu-panel--w-220 menu-panel--doc-actions" data-ref="menu-doc-${doc.id}">
                  <div class="menu-panel__list" data-ref="list-actions-${doc.id}">
                    <button type="button" class="menu-item" data-ref="item-open-tab-${doc.id}" data-action="open-tab" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
                      <span class="menu-item__text">Abrir en una pestaña</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-move-doc-${doc.id}" data-action="move-doc" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                      <span class="menu-item__text">Mover a carpeta...</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-copy-doc-${doc.id}" data-action="copy-doc" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                      <span class="menu-item__text">Crear una copia</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-download-${doc.id}" data-action="download" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                      <span class="menu-item__text">Descargar PDF</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-copy-link-${doc.id}" data-action="copy-link" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
                      <span class="menu-item__text">Copiar enlace</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="item-labels-doc-${doc.id}" data-action="manage-labels" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#label"></use></svg>
                      <span class="menu-item__text">${this.escapeHtml(t('projects.add_label'))}</span>
                    </button>
                    <div class="menu-divider" data-ref="divider-delete-${doc.id}"></div>
                    <button type="button" class="menu-item menu-item--danger" data-ref="item-delete-${doc.id}" data-action="delete" data-id="${doc.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                      <span class="menu-item__text">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="tool-card__paper" data-ref="paper-${doc.id}" style="height: ${paperSize.height}px; width: ${paperSize.width}px;">
              <canvas class="tool-card__canvas is-hidden" data-ref="canvas-doc-${doc.id}" style="height: ${paperSize.height}px; width: ${paperSize.width}px;"></canvas>
              <div class="tool-card__placeholder" data-ref="placeholder-doc-${doc.id}">
                <svg class="component-icon tool-card__placeholder-icon" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
              </div>
            </div>
            ${labelsDotsHtml}
          </div>

          <div class="tool-card__bottom" data-ref="info-doc-${doc.id}">
            <div class="tool-card__title-row" data-ref="title-row-${doc.id}">
              <h3 class="tool-card__title" data-ref="title-doc-${doc.id}" title="${this.escapeHtml(doc.title)}">${this.escapeHtml(doc.title)}</h3>
              <span class="tool-card__badge-pill" data-ref="badge-doc-${doc.id}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${badgeIcon}"></use></svg>
                <span>${badgeText}</span>
              </span>
            </div>
            <div class="tool-card__meta-row" data-ref="meta-row-${doc.id}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
              <span class="tool-card__meta-text" data-ref="meta-doc-${doc.id}">${relativeTime}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);
    this.setupDropdownsInElement(grid);
    this.loadDocPreviews(filteredDocs);
  }

  private renderRootFoldersGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="grid-folders"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="counter-folders"]');
    const empty = this.container.querySelector<HTMLElement>('[data-ref="empty-folders"]');
    if (!grid) return;

    if (this.filterType === 'docs') {
      grid.innerHTML = '';
      return;
    }

    let filteredFolders = this.getFilteredAndSortedFolders();
    if (this.filterType === 'uploads') {
      filteredFolders = [];
    }
    const totalCount = (this.uploadsFolder ? 1 : 0) + filteredFolders.length;

    if (counter) {
      counter.textContent = `(${totalCount})`;
    }

    if (totalCount === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('is-hidden');
      return;
    }
    empty?.classList.add('is-hidden');

    let cardsHtml = '';

    if (this.uploadsFolder && (!this.searchQuery || 'subidos'.includes(this.searchQuery.toLowerCase()))) {
      const upCount = this.uploadsFolder.file_count || 0;
      cardsHtml += `
        <div class="tool-card tool-card--collab-doc project-folder-card project-folder-card--uploads" data-ref="card-folder-uploads" data-folder-id="${this.uploadsFolder.id}">
          <div class="tool-card__preview-box project-folder-preview-box">
            <div class="project-folder-illustration">
              <svg class="project-folder-illustration__svg" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class="project-folder-illustration__back" d="M16 32 C16 23.5 22.5 17 31 17 H92 C98.5 17 103.5 20.5 108.5 26 L115.5 34 C119 38 124 40.5 129.5 40.5 H209 C217.5 40.5 224 47 224 55.5 V150 C224 158.5 217.5 165 209 165 H31 C22.5 165 16 158.5 16 150 Z" />
                <rect class="project-folder-illustration__front" x="16" y="37" width="208" height="128" rx="14" />
              </svg>
              <div class="project-folder-illustration__icon-wrap">
                <svg class="component-icon project-folder-illustration__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
              </div>
            </div>
          </div>
          <div class="tool-card__bottom">
            <div class="tool-card__title-row">
              <h3 class="tool-card__title" title="Subidos">Subidos</h3>
              <span class="tool-card__badge-pill">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
                <span>${upCount} ${upCount === 1 ? 'archivo' : 'archivos'}</span>
              </span>
            </div>
            <div class="tool-card__meta-row">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              <span class="tool-card__meta-text">Carpeta del sistema</span>
            </div>
          </div>
        </div>
      `;
    }

    filteredFolders.forEach((f) => {
      const docCount = f.document_count || 0;
      cardsHtml += `
        <div class="tool-card tool-card--collab-doc project-folder-card" data-ref="card-folder-${f.id}" data-folder-id="${f.id}">
          <div class="tool-card__preview-box project-folder-preview-box">
            <div class="pdf-card__actions" data-ref="actions-folder-${f.id}">
              <div class="dropdown" data-ref="dropdown-folder-${f.id}">
                <button type="button" class="component-button component-button--icon-only pdf-card__btn-action dropdown-trigger" data-ref="btn-more-folder" data-id="${f.id}" data-name="${this.escapeHtml(f.name)}" data-tooltip="Más opciones" aria-label="Más opciones">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_vert"></use></svg>
                </button>
                <div class="menu-panel menu-panel--dropdown menu-panel--w-180 menu-panel--doc-actions" data-ref="menu-folder-${f.id}">
                  <div class="menu-panel__list">
                    <button type="button" class="menu-item" data-action="rename-folder" data-id="${f.id}" data-name="${this.escapeHtml(f.name)}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
                      <span class="menu-item__text">Renombrar</span>
                    </button>
                    <div class="menu-divider"></div>
                    <button type="button" class="menu-item menu-item--danger" data-action="delete-folder" data-id="${f.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                      <span class="menu-item__text">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="project-folder-illustration">
              <svg class="project-folder-illustration__svg" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class="project-folder-illustration__back" d="M16 32 C16 23.5 22.5 17 31 17 H92 C98.5 17 103.5 20.5 108.5 26 L115.5 34 C119 38 124 40.5 129.5 40.5 H209 C217.5 40.5 224 47 224 55.5 V150 C224 158.5 217.5 165 209 165 H31 C22.5 165 16 158.5 16 150 Z" />
                <rect class="project-folder-illustration__front" x="16" y="37" width="208" height="128" rx="14" />
              </svg>
              <div class="project-folder-illustration__icon-wrap">
                <svg class="component-icon project-folder-illustration__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              </div>
            </div>
          </div>

          <div class="tool-card__bottom">
            <div class="tool-card__title-row">
              <h3 class="tool-card__title" title="${this.escapeHtml(f.name)}">${this.escapeHtml(f.name)}</h3>
              <span class="tool-card__badge-pill">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                <span>${docCount} ${docCount === 1 ? 'diseño' : 'diseños'}</span>
              </span>
            </div>
            <div class="tool-card__meta-row">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              <span class="tool-card__meta-text">Carpeta</span>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = cardsHtml;
    renderIcons(grid);
    this.setupDropdownsInElement(grid);
  }

  private renderUploadSubfoldersGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="grid-folders"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="counter-folders"]');
    const empty = this.container.querySelector<HTMLElement>('[data-ref="empty-folders"]');
    if (!grid) return;

    const filteredFolders = this.getFilteredAndSortedFolders();

    if (counter) {
      counter.textContent = `(${filteredFolders.length})`;
    }

    if (filteredFolders.length === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('is-hidden');
      return;
    }
    empty?.classList.add('is-hidden');

    let cardsHtml = '';
    filteredFolders.forEach((f) => {
      const fCount = f.file_count || 0;
      cardsHtml += `
        <div class="tool-card tool-card--collab-doc project-folder-card" data-ref="card-subfolder-${f.id}" data-folder-id="${f.id}">
          <div class="tool-card__preview-box project-folder-preview-box">
            <div class="pdf-card__actions" data-ref="actions-subfolder-${f.id}">
              <div class="dropdown" data-ref="dropdown-subfolder-${f.id}">
                <button type="button" class="component-button component-button--icon-only pdf-card__btn-action dropdown-trigger" data-ref="btn-more-subfolder" data-id="${f.id}" data-name="${this.escapeHtml(f.name)}" data-tooltip="Más opciones" aria-label="Más opciones">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_vert"></use></svg>
                </button>
                <div class="menu-panel menu-panel--dropdown menu-panel--w-180 menu-panel--doc-actions" data-ref="menu-subfolder-${f.id}">
                  <div class="menu-panel__list">
                    <button type="button" class="menu-item" data-action="rename-folder" data-id="${f.id}" data-name="${this.escapeHtml(f.name)}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
                      <span class="menu-item__text">Renombrar</span>
                    </button>
                    <div class="menu-divider"></div>
                    <button type="button" class="menu-item menu-item--danger" data-action="delete-folder" data-id="${f.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                      <span class="menu-item__text">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="project-folder-illustration">
              <svg class="project-folder-illustration__svg" viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class="project-folder-illustration__back" d="M16 32 C16 23.5 22.5 17 31 17 H92 C98.5 17 103.5 20.5 108.5 26 L115.5 34 C119 38 124 40.5 129.5 40.5 H209 C217.5 40.5 224 47 224 55.5 V150 C224 158.5 217.5 165 209 165 H31 C22.5 165 16 158.5 16 150 Z" />
                <rect class="project-folder-illustration__front" x="16" y="37" width="208" height="128" rx="14" />
              </svg>
              <div class="project-folder-illustration__icon-wrap">
                <svg class="component-icon project-folder-illustration__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              </div>
            </div>
          </div>

          <div class="tool-card__bottom">
            <div class="tool-card__title-row">
              <h3 class="tool-card__title" title="${this.escapeHtml(f.name)}">${this.escapeHtml(f.name)}</h3>
              <span class="tool-card__badge-pill">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                <span>${fCount} ${fCount === 1 ? 'archivo' : 'archivos'}</span>
              </span>
            </div>
            <div class="tool-card__meta-row">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
              <span class="tool-card__meta-text">Carpeta</span>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = cardsHtml;
    renderIcons(grid);
    this.setupDropdownsInElement(grid);
  }

  private renderUploadsGrid(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="grid-uploads"]');
    const empty = this.container.querySelector<HTMLElement>('[data-ref="empty-uploads"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="counter-uploads"]');
    if (!grid || !empty) return;

    const filteredFiles = this.getFilteredAndSortedUploads();

    if (counter) {
      counter.textContent = `(${filteredFiles.length})`;
    }

    if (filteredFiles.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('is-hidden');
      return;
    }

    empty.classList.add('is-hidden');

    grid.innerHTML = filteredFiles.map((file) => {
      const isImg = file.type === 'image' || file.mimeType?.startsWith('image/');
      const badge = isImg ? 'IMG' : 'PDF';
      const badgeIcon = isImg ? 'image' : 'picture_as_pdf';

      return `
        <div class="tool-card tool-card--collab-doc project-upload-card" data-ref="card-upload-${file.id}" data-upload-id="${file.id}">
          <div class="tool-card__preview-box">
            <div class="pdf-card__actions" data-ref="actions-up-${file.id}">
              <div class="dropdown" data-ref="dropdown-up-${file.id}">
                <button type="button" class="component-button component-button--icon-only pdf-card__btn-action dropdown-trigger" data-ref="btn-more-upload" data-id="${file.id}" data-tooltip="Más opciones" aria-label="Más opciones">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#more_vert"></use></svg>
                </button>
                <div class="menu-panel menu-panel--dropdown menu-panel--w-180 menu-panel--doc-actions" data-ref="menu-up-${file.id}">
                  <div class="menu-panel__list">
                    <button type="button" class="menu-item" data-action="move-upload" data-id="${file.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                      <span class="menu-item__text">Mover a...</span>
                    </button>
                    <button type="button" class="menu-item" data-action="download-upload" data-url="${file.url}" data-name="${this.escapeHtml(file.name)}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                      <span class="menu-item__text">Descargar</span>
                    </button>
                    <div class="menu-divider"></div>
                    <button type="button" class="menu-item menu-item--danger" data-action="delete-upload" data-id="${file.id}">
                      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                      <span class="menu-item__text">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="tool-card__paper">
              ${
                isImg
                  ? `<img class="tool-card__upload-img" src="${file.url}" alt="${this.escapeHtml(file.name)}" loading="lazy" />`
                  : `<canvas class="tool-card__canvas is-hidden" data-ref="canvas-upload-${file.id}"></canvas>
                     <div class="tool-card__placeholder" data-ref="placeholder-upload-${file.id}">
                       <svg class="component-icon tool-card__placeholder-icon" aria-hidden="true"><use href="/icons.svg#picture_as_pdf"></use></svg>
                     </div>`
              }
            </div>
          </div>

          <div class="tool-card__bottom">
            <div class="tool-card__title-row">
              <h3 class="tool-card__title" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</h3>
              <span class="tool-card__badge-pill">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${badgeIcon}"></use></svg>
                <span>${badge}</span>
              </span>
            </div>
            <div class="tool-card__meta-row">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
              <span class="tool-card__meta-text">${this.formatBytes(file.size)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);
    this.setupDropdownsInElement(grid);
    this.loadUploadPdfThumbnails(filteredFiles);
  }

  private setupDropdownsInElement(container: HTMLElement): void {
    const dropdowns = container.querySelectorAll<HTMLElement>('.dropdown');
    dropdowns.forEach((dd) => {
      const card = dd.closest<HTMLElement>('.project-folder-card, .tool-card--collab-doc, .project-upload-card');
      setupDropdown(dd, {
        onOpen: () => {
          if (card) card.classList.add('has-open-dropdown');
        },
        onClose: () => {
          if (card) card.classList.remove('has-open-dropdown');
        },
      });
    });
  }

  private loadDocPreviews(docs: DocItem[]): void {
    for (const doc of docs) {
      const canvas = this.container.querySelector<HTMLCanvasElement>(`[data-ref="canvas-doc-${doc.id}"]`);
      const placeholder = this.container.querySelector<HTMLElement>(`[data-ref="placeholder-doc-${doc.id}"]`);
      if (!canvas) continue;

      canvas.classList.remove('is-hidden');
      if (placeholder) placeholder.classList.add('is-hidden');
      this.renderLocalCanvasPreview(doc, canvas, 196, 156);
    }
  }

  private loadUploadPdfThumbnails(files: UploadFileItem[]): void {
    files.forEach((file) => {
      if (file.type === 'pdf' || file.mimeType?.includes('pdf')) {
        const canvas = this.container.querySelector<HTMLCanvasElement>(`[data-ref="canvas-upload-${file.id}"]`);
        const placeholder = this.container.querySelector<HTMLElement>(`[data-ref="placeholder-upload-${file.id}"]`);
        if (canvas && file.url) {
          renderPdfThumbnail(file.url, canvas, { pageNum: 1, targetWidth: 160 })
            .then(() => {
              canvas.classList.remove('is-hidden');
              placeholder?.classList.add('is-hidden');
            })
            .catch(() => {
              // Retain placeholder if thumbnail generation fails
            });
        }
      }
    });
  }

  private bindEvents(): void {
    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-project-search"]');
    const clearBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    if (searchInput) {
      const onSearchDebounced = debounce((val: string) => {
        this.searchQuery = val.trim();
        this.renderView();
      }, 150);

      searchInput.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        onSearchDebounced(val);
        if (clearBtn) {
          if (val) {
            clearBtn.classList.remove('is-hidden');
          } else {
            clearBtn.classList.add('is-hidden');
          }
        }
      }, { signal: this.abortController?.signal });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.classList.add('is-hidden');
        this.renderView();
        searchInput.focus();
      }, { signal: this.abortController?.signal });
    }

    const categoriesBar = this.container.querySelector<HTMLElement>('[data-ref="projects-categories-bar"]');
    if (categoriesBar) {
      categoriesBar.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-type]');
        if (!btn) return;
        const type = (btn.getAttribute('data-type') || 'all') as any;
        this.filterType = type;
        if (type === 'images' || type === 'pdfs') {
          this.uploadsActiveTab = type;
        } else {
          this.uploadsActiveTab = 'all';
        }
        if (type === 'uploads' && this.uploadsFolder && !this.currentFolderId) {
          navigate(`/projects/${this.uploadsFolder.id}`);
          return;
        }
        this.renderView();
      }, { signal: this.abortController?.signal });
    }

    const catDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-filter-category"]');
    if (catDropdown) {
      setupDropdown(catDropdown);

      catDropdown.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-category]');
        if (!item) return;
        const cat = item.getAttribute('data-category') || 'all';
        this.filterCategory = cat;
        const label = this.container.querySelector<HTMLElement>('[data-ref="label-filter-category"]');
        if (label) {
          label.textContent = cat === 'all' ? 'Categoría' : item.querySelector('.menu-item__text')?.textContent?.trim() || item.textContent?.trim() || 'Categoría';
        }
        catDropdown.querySelectorAll('.menu-item').forEach((m) => m.classList.remove('is-active'));
        item.classList.add('is-active');
        this.renderView();
      }, { signal: this.abortController?.signal });
    }

    const labelDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-filter-label"]');
    if (labelDropdown) {
      setupDropdown(labelDropdown);

      labelDropdown.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-filter-label-id]');
        if (!item) return;
        const rawVal = item.getAttribute('data-filter-label-id') || 'all';
        this.filterLabelId = rawVal === 'all' ? null : Number(rawVal);
        if (this.filterLabelId !== null && (!Number.isInteger(this.filterLabelId) || this.filterLabelId <= 0)) {
          this.filterLabelId = null;
        }
        this.renderView();
      }, { signal: this.abortController?.signal });
    }

    const dateDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-filter-date"]');
    if (dateDropdown) {
      setupDropdown(dateDropdown);
      const menu = dateDropdown.querySelector<HTMLElement>('.menu-panel');

      menu?.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sort = (btn.getAttribute('data-sort') || 'recent') as any;
          this.sortOption = sort;
          const label = this.container.querySelector<HTMLElement>('[data-ref="label-filter-date"]');
          if (label) {
            label.textContent = btn.querySelector('.menu-item__text')?.textContent?.trim() || btn.textContent?.trim() || 'Fecha de modificación';
          }
          dateDropdown.querySelectorAll('.menu-item').forEach((m) => m.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.renderView();
        }, { signal: this.abortController?.signal });
      });
    }

    const btnSortToggle = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-sort"]');
    btnSortToggle?.addEventListener('click', () => {
      this.sortAscending = !this.sortAscending;
      showToast(this.sortAscending ? 'Orden ascendente' : 'Orden descendente', 'info');
      this.renderView();
    }, { signal: this.abortController?.signal });

    const plusDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-new-action"]');
    if (plusDropdown) {
      setupDropdown(plusDropdown);
      const menu = plusDropdown.querySelector<HTMLElement>('.menu-panel');

      menu?.querySelector('[data-action="new-doc"]')?.addEventListener('click', () => {
        this.createNewCollabDocument();
      }, { signal: this.abortController?.signal });

      menu?.querySelector('[data-action="new-folder"]')?.addEventListener('click', () => {
        void this.promptCreateFolder();
      }, { signal: this.abortController?.signal });

      menu?.querySelector('[data-action="upload-files"]')?.addEventListener('click', () => {
        const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-project-upload"]');
        fileInput?.click();
      }, { signal: this.abortController?.signal });
    }

    const btnUploadDirect = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-upload-direct"]');
    btnUploadDirect?.addEventListener('click', () => {
      const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-project-upload"]');
      fileInput?.click();
    }, { signal: this.abortController?.signal });

    const fileInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-project-upload"]');
    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        void this.handleUploadFiles(Array.from(fileInput.files));
        fileInput.value = '';
      }
    }, { signal: this.abortController?.signal });

    const btnEmptyCreate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-empty-create-pdf"]');
    btnEmptyCreate?.addEventListener('click', () => {
      this.createNewCollabDocument();
    }, { signal: this.abortController?.signal });

    const btnEmptyUpload = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-empty-upload"]');
    btnEmptyUpload?.addEventListener('click', () => {
      fileInput?.click();
    }, { signal: this.abortController?.signal });

    const btnRenameFolder = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-folder-rename"]');
    btnRenameFolder?.addEventListener('click', () => {
      if (this.currentFolder) {
        void this.promptRenameFolder(this.currentFolder.id, this.currentFolder.name);
      }
    }, { signal: this.abortController?.signal });

    const btnDeleteFolder = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-folder-delete"]');
    btnDeleteFolder?.addEventListener('click', () => {
      if (this.currentFolder) {
        void this.promptDeleteFolder(this.currentFolder.id);
      }
    }, { signal: this.abortController?.signal });

    const btnFolderBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-folder-back"]');
    btnFolderBack?.addEventListener('click', () => {
      navigate('/projects');
    }, { signal: this.abortController?.signal });

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const folderCard = target.closest<HTMLElement>('.project-folder-card');
      if (folderCard && !target.closest('.dropdown') && !target.closest('.project-folder-card__actions') && !target.closest('.pdf-card__actions')) {
        e.preventDefault();
        const fId = folderCard.getAttribute('data-folder-id');
        if (fId) {
          navigate(`/projects/${encodeURIComponent(fId)}`);
        }
        return;
      }

      const uploadCard = target.closest<HTMLElement>('.project-upload-card');
      if (uploadCard && !target.closest('.dropdown') && !target.closest('.pdf-card__actions')) {
        e.preventDefault();
        const upId = uploadCard.getAttribute('data-upload-id');
        const file = this.files.find((f) => f.id === upId);
        if (file?.url) {
          window.open(file.url, '_blank');
        }
        return;
      }

      const docCard = target.closest<HTMLElement>('.tool-card--collab-doc');
      if (docCard && !target.closest('.dropdown') && !target.closest('.pdf-card__actions')) {
        const docId = docCard.getAttribute('data-doc-id');
        if (docId) {
          e.preventDefault();
          const doc = this.documents.find((d) => d.id === docId);
          const dim = doc ? this.getDocDimensions(doc) : { height: 1123, width: 794 };
          navigate(`/d/${encodeURIComponent(docId)}?w=${dim.width}&h=${dim.height}`);
          return;
        }
      }

      const actionBtn = target.closest<HTMLElement>('[data-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-action');
        const id = actionBtn.getAttribute('data-id');

        if (action === 'open-tab' && id) {
          const doc = this.documents.find((d) => d.id === id);
          const dim = doc ? this.getDocDimensions(doc) : { height: 1123, width: 794 };
          window.open(`/d/${encodeURIComponent(id)}?w=${dim.width}&h=${dim.height}`, '_blank');
        } else if (action === 'copy-doc' && id) {
          void this.handleDuplicateDoc(id);
        } else if (action === 'move-doc' && id) {
          void this.promptMoveDoc(id);
        } else if (action === 'copy-link' && id) {
          const link = `${window.location.origin}/d/${encodeURIComponent(id)}`;
          navigator.clipboard?.writeText(link);
          showToast(t('toasts.enlace_copiado_al_portapapeles'), 'info');
        } else if (action === 'manage-labels' && id) {
          actionBtn.closest<HTMLElement>('.dropdown')?.classList.remove('is-open');
          actionBtn.closest<HTMLElement>('.tool-card')?.classList.remove('has-open-dropdown');
          void this.promptManageLabels(id);
        } else if (action === 'download' && id) {
          showToast(t('toasts.generando_descarga_del_documento'), 'info');
          window.open(`/api/collaborative-docs/${encodeURIComponent(id)}/export`, '_blank');
        } else if (action === 'delete' && id) {
          void this.handleDeleteDoc(id);
        } else if (action === 'rename-folder' && id) {
          const name = actionBtn.getAttribute('data-name') || '';
          void this.promptRenameFolder(id, name);
        } else if (action === 'delete-folder' && id) {
          void this.promptDeleteFolder(id);
        } else if (action === 'move-upload' && id) {
          void this.promptMoveUpload(id);
        } else if (action === 'delete-upload' && id) {
          void this.promptDeleteUpload(id);
        } else if (action === 'download-upload') {
          const url = actionBtn.getAttribute('data-url');
          const name = actionBtn.getAttribute('data-name') || 'archivo';
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
          }
        }
        return;
      }
    }, { signal: this.abortController?.signal });
  }

  private async promptCreateFolder(): Promise<void> {
    const isUploadsContext = this.currentFolder?.folder_type === 'uploads';
    const folderType = isUploadsContext ? 'upload_folder' : 'project';
    const parentId = isUploadsContext ? this.currentFolder?.id : null;

    openCreateFolderModal({
      onConfirm: async (name: string) => {
        try {
          const res = await postApi(API_ROUTES.projectFolders.base, {
            folderType,
            name,
            parentId,
          });
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || t('ui.no_se_pudo_crear_la_carpeta'), 'danger');
            return false;
          }
          showToast(t('toasts.carpeta_creada_exitosamente'), 'info');
          await this.loadData();
          this.renderView();
          return true;
        } catch {
          showToast(t('ui.no_se_pudo_crear_la_carpeta') || 'Error al crear la carpeta', 'danger');
          return false;
        }
      },
    });
  }

  private async promptRenameFolder(folderId: string, currentName: string): Promise<void> {
    openRenameFolderModal({
      currentName,
      onConfirm: async (newName: string) => {
        try {
          const res = await patchApi(API_ROUTES.projectFolders.byId(folderId), { name: newName });
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || t('ui.no_se_pudo_renombrar_la_carpeta'), 'danger');
            return false;
          }
          showToast(t('toasts.carpeta_renombrada_exitosamente'), 'info');
          await this.loadData();
          this.renderView();
          return true;
        } catch {
          showToast(t('ui.no_se_pudo_renombrar_la_carpeta') || 'Error al renombrar carpeta', 'danger');
          return false;
        }
      },
    });
  }

  private async promptDeleteFolder(folderId: string): Promise<void> {
    openDeleteFolderModal({
      onConfirm: async () => {
        try {
          const res = await deleteApi(API_ROUTES.projectFolders.byId(folderId));
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || t('ui.no_se_pudo_eliminar_la_carpeta'), 'danger');
            return false;
          }
          showToast(t('toasts.folder_deleted'), 'info');
          if (this.currentFolderId === folderId) {
            navigate('/projects');
          } else {
            await this.loadData();
            this.renderView();
          }
          return true;
        } catch {
          showToast(t('ui.error_al_eliminar_la_carpeta'), 'danger');
          return false;
        }
      },
    });
  }

  private async promptMoveDoc(docId: string): Promise<void> {
    let availableFolders: ProjectFolder[] = [];
    try {
      const res = await getApi(API_ROUTES.projectFolders.base);
      if (res.ok) {
        const data = await res.json();
        availableFolders = Array.isArray(data.folders) ? data.folders.filter((f: ProjectFolder) => f.folder_type === 'project') : [];
      }
    } catch {}

    const currentDoc = this.documents.find((d) => d.id === docId);
    const activeFolderId = currentDoc?.folder_id || this.currentFolderId || null;

    openMoveDocModal({
      activeFolderId,
      folders: availableFolders.map((f) => ({ id: f.id, name: f.name })),
      onConfirm: async (targetId: string | null) => {
        try {
          const res = await patchApi(API_ROUTES.projectFolders.docFolder(docId), { folderId: targetId });
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || t('ui.no_se_pudo_mover_el_documento'), 'danger');
            return false;
          }
          showToast(t('toasts.doc_moved_success'), 'info');
          await this.loadData();
          this.renderView();
          return true;
        } catch {
          showToast(t('ui.no_se_pudo_mover_el_documento') || 'Error al mover documento', 'danger');
          return false;
        }
      },
    });
  }

  private async promptManageLabels(docId: string): Promise<void> {
    if (this.userLabels.length === 0) {
      await this.loadLabelsCatalog();
    }

    const doc = this.documents.find((d) => d.id === docId);
    const initialSelectedIds = Array.isArray(doc?.labels) ? doc.labels.map((l) => l.id) : [];

    openDocumentLabelsModal({
      customCount: this.customLabelsCount,
      documentId: docId,
      initialSelectedIds,
      labels: this.userLabels,
      maxCustomLabels: this.maxCustomLabels,
      onCatalogUpdated: (updatedLabels, customCount, maxCustomLabels, deletedLabelId) => {
        this.userLabels = updatedLabels;
        this.customLabelsCount = customCount;
        this.maxCustomLabels = maxCustomLabels;
        if (deletedLabelId !== undefined) {
          this.documents = this.documents.map((item) => ({
            ...item,
            labels: Array.isArray(item.labels) ? item.labels.filter((lbl) => lbl.id !== deletedLabelId) : [],
          }));
          if (this.filterLabelId === deletedLabelId) {
            this.filterLabelId = null;
          }
        }
        this.renderView();
      },
      onSave: (updatedDocLabels, updatedLabels, customCount, maxCustomLabels) => {
        this.userLabels = updatedLabels;
        this.customLabelsCount = customCount;
        this.maxCustomLabels = maxCustomLabels;
        this.documents = this.documents.map((item) =>
          item.id === docId ? { ...item, labels: updatedDocLabels } : item
        );
        this.renderView();
      },
    });
  }

  private async promptMoveUpload(uploadId: string): Promise<void> {
    let availableSubfolders: ProjectFolder[] = [];
    const uploadsFldId = this.uploadsFolder?.id || '';
    if (uploadsFldId) {
      try {
        const res = await getApi(`${API_ROUTES.projectFolders.base}?parentId=${encodeURIComponent(uploadsFldId)}&folderType=upload_folder`);
        if (res.ok) {
          const data = await res.json();
          availableSubfolders = Array.isArray(data.folders) ? data.folders : [];
        }
      } catch {}
    }

    const currentFile = this.files.find((f) => f.id === uploadId);
    const activeFolderId = currentFile?.folderId || null;

    openMoveUploadModal({
      activeFolderId,
      folders: availableSubfolders.map((f) => ({ id: f.id, name: f.name })),
      onConfirm: async (targetId: string | null) => {
        try {
          const res = await patchApi(API_ROUTES.projectFolders.uploadFolder(uploadId), { folderId: targetId });
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || t('ui.no_se_pudo_mover_el_archivo'), 'danger');
            return false;
          }
          showToast(t('toasts.file_moved_success'), 'info');
          await this.loadData();
          this.renderView();
          return true;
        } catch {
          showToast(t('ui.no_se_pudo_mover_el_archivo') || 'Error al mover archivo', 'danger');
          return false;
        }
      },
    });
  }

  private async promptDeleteUpload(uploadId: string): Promise<void> {
    openDeleteUploadModal({
      onConfirm: async () => {
        try {
          const res = await deleteApi(API_ROUTES.projectFolders.uploadDelete(uploadId));
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || t('ui.no_se_pudo_eliminar_el_archivo'), 'danger');
            return false;
          }
          showToast(t('toasts.file_deleted'), 'info');
          await this.loadData();
          this.renderView();
          return true;
        } catch {
          showToast(t('ui.no_se_pudo_eliminar_el_archivo') || 'Error al eliminar archivo', 'danger');
          return false;
        }
      },
    });
  }

  private async handleUploadFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (this.currentFolder?.folder_type === 'upload_folder') {
      formData.append('folderId', this.currentFolder.id);
    } else if (this.currentFolder?.folder_type === 'uploads') {
      formData.append('folderId', this.currentFolder.id);
    }

    showToast(`Subiendo ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'}...`, 'info');

    try {
      const res = await fetch(API_ROUTES.collaborativeDocs.upload, {
        body: formData,
        method: 'POST',
      });
      if (res.ok) {
        showToast(t('toasts.files_uploaded_success'), 'info');
        await this.loadData();
        this.renderView();
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al subir archivos', 'danger');
      }
    } catch {
      showToast('Error de red al subir archivos', 'danger');
    }
  }

  private createNewCollabDocument(): void {
    if (currentUser?.storage_limit_bytes && currentUser.storage_used_bytes) {
      if (currentUser.storage_used_bytes >= currentUser.storage_limit_bytes) {
        showToast(t('projects.storage_limit_reached'), 'danger');
        return;
      }
    }

    const titleVal = 'Documento sin título';
    const dimensions = { ...COLLAB_DOCUMENT_DEFAULT_SIZE };
    const newDocId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const targetFolderId = this.currentFolder?.folder_type === 'project' ? this.currentFolder.id : null;

    const initialContent = {
      elements: [],
      pageBackgrounds: ['#ffffff'],
      pageCount: 1,
      pagePdfSources: [null],
      pageSize: dimensions,
      pageSizes: [dimensions],
      pageTitles: [''],
    };

    try {
      void putApi(API_ROUTES.collaborativeDocs.byId(newDocId), {
        content: initialContent,
        folderId: targetFolderId,
        id: newDocId,
        title: titleVal,
      });
    } catch {}

    const navUrl = `/d/${encodeURIComponent(newDocId)}?w=${dimensions.width}&h=${dimensions.height}`;
    navigate(navUrl);
  }

  private async handleDuplicateDoc(docId: string): Promise<void> {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) return;

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newTitle = `${doc.title} (Copia)`;
    const newContent = doc.content ? JSON.parse(JSON.stringify(doc.content)) : {};

    try {
      await putApi(API_ROUTES.collaborativeDocs.byId(newId), {
        content: newContent,
        folderId: doc.folder_id || null,
        id: newId,
        title: newTitle,
      });
    } catch {}

    showToast(t('toasts.copy_created_success'), 'info');
    await this.loadData();
    this.renderView();
  }

  private async handleDeleteDoc(docId: string): Promise<void> {
    const doc = this.documents.find((d) => d.id === docId);
    const docTitle = doc?.title || 'este documento';

    openDeleteDocModal({
      docTitle,
      onConfirm: async () => {
        try {
          await deleteApi(API_ROUTES.collaborativeDocs.byId(docId));
        } catch {}
        showToast(t('toasts.documento_eliminado_correctamente'), 'info');
        await this.loadData();
        this.renderView();
        return true;
      },
    });
  }

  private getDocDimensions(doc: DocItem): { height: number; width: number } {
    const w = doc.content?.pageSizes?.[0]?.width || doc.content?.pageSize?.width || 794;
    const h = doc.content?.pageSizes?.[0]?.height || doc.content?.pageSize?.height || 1123;
    return { height: Math.max(50, Number(h) || 1123), width: Math.max(50, Number(w) || 794) };
  }

  private computePaperSize(docW: number, docH: number, maxW = 196, maxH = 156): { height: number; width: number } {
    const scale = Math.min(maxW / docW, maxH / docH);
    return {
      height: Math.max(36, Math.round(docH * scale)),
      width: Math.max(36, Math.round(docW * scale)),
    };
  }

  private renderLocalCanvasPreview(doc: DocItem, canvas: HTMLCanvasElement, maxW = 196, maxH = 156): void {
    const dim = this.getDocDimensions(doc);
    const paperSize = this.computePaperSize(dim.width, dim.height, maxW, maxH);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = paperSize.width * dpr;
    canvas.height = paperSize.height * dpr;
    canvas.style.width = `${paperSize.width}px`;
    canvas.style.height = `${paperSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const bg = doc.content?.pageBackgrounds?.[0] || '#ffffff';
    if (bg.startsWith('linear-gradient')) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, paperSize.width, paperSize.height);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, paperSize.width, paperSize.height);
    }

    const elements = doc.content?.elements || [];
    const scale = paperSize.width / dim.width;

    for (const el of elements) {
      if (el.pageIndex !== undefined && el.pageIndex !== 0) continue;
      ctx.save();

      if (el.type === 'text') {
        const x = (el.x || 0) * scale;
        const y = (el.y || 0) * scale;
        const fontSize = Math.max(4, Math.round((el.fontSize || 16) * scale));
        ctx.font = `${el.isBold ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.fillStyle = el.color || '#000000';
        ctx.textBaseline = 'top';
        const txt = (el.text || '').substring(0, 40);
        ctx.fillText(txt, x, y);
      } else if (el.type === 'shape') {
        ctx.strokeStyle = el.strokeColor || '#000000';
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 1) * scale);
        ctx.fillStyle = el.fillColor || 'transparent';
        const x = (el.x || 0) * scale;
        const y = (el.y || 0) * scale;
        const w = (el.width || 50) * scale;
        const h = (el.height || 50) * scale;
        if (el.shapeType === 'circle' || el.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
          ctx.stroke();
        } else {
          if (el.fillColor && el.fillColor !== 'transparent') ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
      }
      ctx.restore();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  private formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Editado hace un momento';
    if (diffMin < 60) return `Editado hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
    if (diffHours < 24) return `Editado hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays === 1) return 'Editado ayer';
    if (diffDays < 30) return `Editado hace ${diffDays} días`;
    return `Editado el ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

async function createProjectsView(folderId?: string | null): Promise<HTMLElement | null> {
  if (!currentUser) {
    navigate('/login?redirect=%2Fprojects', true);
    return null;
  }
  const container = await loadTemplate('/views/projects/projects.html');
  const controller = new ProjectsController(container, folderId);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}

export { ProjectsController, createProjectsView };
