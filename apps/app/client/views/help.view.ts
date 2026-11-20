type HelpSection = 'cookies' | 'privacy' | 'security' | 'terms';

async function createHelpView(section: HelpSection = 'terms', navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container';
  container.setAttribute('data-ref', 'help-layout');
  return container;
}

export {
  createHelpView
};

export type {
  HelpSection
};
