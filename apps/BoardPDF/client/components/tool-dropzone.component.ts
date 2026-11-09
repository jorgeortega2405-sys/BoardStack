import { pickDropboxFiles } from '../services/dropbox.service.js';
import { pickGoogleDriveFiles } from '../services/google-drive.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { bindFileDropzone } from '../utils/dom.util.js';

interface ToolDropzoneOptions {
  accept?: string;
  buttonText?: string;
  container: HTMLElement;
  desc?: string;
  hideCloudButtons?: boolean;
  hint?: string;
  multiselect?: boolean;
  onBrowseClick?: () => void;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  title?: string;
}

class ToolDropzoneComponent {
  private abortController: AbortController | null = null;
  private dropzoneElement: HTMLElement | null = null;
  private options: ToolDropzoneOptions;

  constructor(options: ToolDropzoneOptions) {
    this.options = options;
  }

  public async init(): Promise<HTMLElement> {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const element = await loadTemplate('/views/components/tool-dropzone.html');
    this.dropzoneElement = element;

    const titleEl = element.querySelector<HTMLElement>('[data-ref="tool-dropzone-title"]');
    const descEl = element.querySelector<HTMLElement>('[data-ref="tool-dropzone-desc"]');
    const btnTextEl = element.querySelector<HTMLElement>('[data-ref="tool-dropzone-btn-text"]');
    const hintEl = element.querySelector<HTMLElement>('[data-ref="tool-dropzone-hint"]');
    const inputEl = element.querySelector<HTMLInputElement>('[data-ref="tool-dropzone-input"]');
    const browseBtn = element.querySelector<HTMLButtonElement>('[data-ref="btn-tool-browse"]');
    const driveBtn = element.querySelector<HTMLButtonElement>('[data-ref="btn-tool-drive"]');
    const dropboxBtn = element.querySelector<HTMLButtonElement>('[data-ref="btn-tool-dropbox"]');

    if (titleEl && this.options.title) {
      titleEl.textContent = this.options.title;
    }
    if (descEl && this.options.desc) {
      descEl.textContent = this.options.desc;
    }
    if (btnTextEl && this.options.buttonText) {
      btnTextEl.textContent = this.options.buttonText;
    }
    if (hintEl && this.options.hint) {
      hintEl.textContent = this.options.hint;
    }
    if (inputEl) {
      inputEl.accept = this.options.accept || 'application/pdf,.pdf';
      inputEl.multiple = !!this.options.multiselect;
    }

    if (this.options.hideCloudButtons) {
      const cloudGroup = element.querySelector<HTMLElement>('[data-ref="tool-dropzone-cloud-btns"]');
      if (cloudGroup) cloudGroup.remove();
    }

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.options.onBrowseClick) {
        this.options.onBrowseClick();
      } else {
        inputEl?.click();
      }
    }, { signal });

    inputEl?.addEventListener('change', () => {
      const files = inputEl.files;
      if (files && files.length > 0) {
        void this.options.onFilesSelected(Array.from(files));
      }
    }, { signal });

    driveBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickGoogleDriveFiles({ multiselect: !!this.options.multiselect });
      if (files && files.length > 0) {
        void this.options.onFilesSelected(files);
      }
    }, { signal });

    dropboxBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = await pickDropboxFiles({ multiselect: !!this.options.multiselect });
      if (files && files.length > 0) {
        void this.options.onFilesSelected(files);
      }
    }, { signal });

    bindFileDropzone({
      dropTarget: element,
      onFiles: (fileList) => {
        const files = Array.from(fileList);
        if (files.length > 0) {
          void this.options.onFilesSelected(files);
        }
      },
      signal,
      visualTarget: element,
    });

    renderIcons(element);
    this.options.container.appendChild(element);
    return element;
  }

  public getElement(): HTMLElement | null {
    return this.dropzoneElement;
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.dropzoneElement) {
      this.dropzoneElement.remove();
      this.dropzoneElement = null;
    }
  }
}

export { ToolDropzoneComponent };
export type { ToolDropzoneOptions };
