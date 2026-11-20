type ToastType = 'success' | 'error' | 'warning' | 'info' | 'danger';

interface ModalInstance {
  backdrop: HTMLElement;
  body: HTMLElement;
  btnCancel: HTMLElement | null;
  btnConfirm: HTMLButtonElement | null;
  cancelBtn: HTMLElement | null;
  card: HTMLElement | null;
  clearError: () => void;
  close: () => void;
  closeBtn: HTMLElement | null;
  confirmBtn: HTMLButtonElement | null;
  errorBanner: HTMLElement | null;
  setBody: (newBody: HTMLElement | string) => void;
  setConfirmLoading: (isLoading: boolean, loadingText?: string) => void;
  setConfirmText: (newText: string) => void;
  setConfirmVisible: (visible: boolean) => void;
  setDescription: (newDesc: string) => void;
  setError?: (msg: string) => void;
  setOnConfirm: (fn: ((inst: ModalInstance) => boolean | Promise<boolean | void> | void) | null) => void;
  setTitle: (newTitle: string) => void;
  showError: (message: string) => void;
  [key: string]: any;
}

interface ModalOptions {
  bodyHtml?: HTMLElement | string;
  cancelText?: string;
  confirmClass?: string;
  confirmText?: string;
  description?: string;
  onCancel?: ((inst: ModalInstance) => void) | null;
  onClose?: (() => void) | null;
  onConfirm?: ((inst: ModalInstance) => boolean | Promise<boolean | void> | void) | null;
  showCancel?: boolean;
  showConfirm?: boolean;
  size?: 'lg' | 'md' | 'sm' | string;
  title?: string;
}

interface ConfirmModalOptions {
  cancelText?: string;
  confirmClass?: string;
  confirmText?: string;
  description?: string;
  isDanger?: boolean;
  onCancel?: ((inst: ModalInstance) => void) | null;
  onConfirm?: ((inst: ModalInstance) => boolean | Promise<boolean | void> | void) | null;
  title?: string;
}

interface PromptModalOptions {
  cancelText?: string;
  confirmClass?: string;
  confirmText?: string;
  defaultValue?: string;
  description?: string;
  inputPlaceholder?: string;
  inputType?: string;
  onCancel?: ((inst: ModalInstance) => void) | null;
  onConfirm: (value: string, inst: ModalInstance) => boolean | Promise<boolean | void> | void;
  title: string;
}

interface Language {
  code: string;
  name: string;
}

export type { ConfirmModalOptions, Language, ModalInstance, ModalOptions, PromptModalOptions, ToastType };
