type ToastType = 'success' | 'error' | 'warning' | 'info' | 'danger';

interface Language {
  code: string;
  name: string;
}

export type {
  Language,
  ToastType
};
