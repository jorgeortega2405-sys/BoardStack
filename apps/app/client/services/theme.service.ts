type ThemeMode = 'light' | 'dark' | 'system';

class ThemeService {
  private currentTheme: ThemeMode = 'system';
  private listeners: Array<(theme: ThemeMode, resolved: 'light' | 'dark') => void> = [];
  private mediaQuery: MediaQueryList | null = null;
  private initialized = false;

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'system') {
        this.applyTheme();
      }
    });

    const saved = localStorage.getItem('theme') as ThemeMode | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      this.currentTheme = saved;
    } else {
      this.currentTheme = 'system';
    }

    this.applyTheme();
  }

  public getTheme(): ThemeMode {
    return this.currentTheme;
  }

  public getResolvedTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    return this.currentTheme;
  }

  public setTheme(theme: ThemeMode, persist = true): void {
    this.currentTheme = theme;
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
    this.applyTheme();
  }

  public onThemeChange(callback: (theme: ThemeMode, resolved: 'light' | 'dark') => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return;

    const resolved = this.getResolvedTheme();
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');

    this.listeners.forEach((listener) => {
      try {
        listener(this.currentTheme, resolved);
      } catch (err) {
        console.error('Error in theme listener:', err);
      }
    });
  }
}

const themeService = new ThemeService();

export {
  ThemeService,
  themeService
};

export type {
  ThemeMode
};