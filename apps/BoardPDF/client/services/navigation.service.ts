type NavigationHandler = (url: string, replace?: boolean) => void;
type LanguageSwitchHandler = (newLang: string) => Promise<void>;

let currentNavigationHandler: NavigationHandler = (url: string) => {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

let currentLanguageSwitchHandler: LanguageSwitchHandler | null = null;

function setNavigationHandler(handler: NavigationHandler): void {
  currentNavigationHandler = handler;
}

function setLanguageSwitchHandler(handler: LanguageSwitchHandler): void {
  currentLanguageSwitchHandler = handler;
}

function navigate(url: string, replace = false): void {
  currentNavigationHandler(url, replace);
}

async function switchLanguage(newLang: string): Promise<void> {
  if (currentLanguageSwitchHandler) {
    await currentLanguageSwitchHandler(newLang);
  }
}

export { navigate, setLanguageSwitchHandler, setNavigationHandler, switchLanguage };
export type { LanguageSwitchHandler, NavigationHandler };
