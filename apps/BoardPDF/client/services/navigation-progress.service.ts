let activeProgressTimer: ReturnType<typeof setTimeout> | null = null;
let currentProgressElement: HTMLElement | null = null;

function resolveWrapper(container?: HTMLElement | null): HTMLElement | null {
  const selector = '.component-wrapper, .view-wrapper, .login-container, .layout-body--scrollable, .layout-scrollable, .view-scrollable';
  if (container) {
    if (container.matches(selector)) {
      return container;
    }
    const inner = container.querySelector<HTMLElement>(selector);
    if (inner) return inner;
    return container;
  }
  return document.querySelector<HTMLElement>(selector);
}

function createProgressBar(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'navigation-progress navigation-progress--loading';
  container.setAttribute('data-ref', 'navigation-progress');

  const bar = document.createElement('div');
  bar.className = 'navigation-progress__bar';
  bar.setAttribute('data-ref', 'navigation-progress-bar');

  container.appendChild(bar);
  return container;
}

function startNavigationProgress(currentView?: HTMLElement | null): void {
  if (activeProgressTimer) {
    clearTimeout(activeProgressTimer);
    activeProgressTimer = null;
  }

  const targetWrapper = resolveWrapper(currentView);
  if (!targetWrapper) return;

  if (!currentProgressElement || !currentProgressElement.isConnected) {
    currentProgressElement = createProgressBar();
    targetWrapper.prepend(currentProgressElement);
  } else {
    currentProgressElement.className = 'navigation-progress navigation-progress--loading';
    if (currentProgressElement.parentElement !== targetWrapper) {
      targetWrapper.prepend(currentProgressElement);
    }
  }
}

function transferNavigationProgress(sourceView?: HTMLElement | null, targetView?: HTMLElement | null): void {
  if (!currentProgressElement || !currentProgressElement.isConnected) return;
  const targetWrapper = resolveWrapper(targetView);
  if (targetWrapper && currentProgressElement.parentElement !== targetWrapper) {
    targetWrapper.prepend(currentProgressElement);
  }
}

function finishNavigationProgress(targetView?: HTMLElement | null): void {
  if (activeProgressTimer) {
    clearTimeout(activeProgressTimer);
    activeProgressTimer = null;
  }

  if (!currentProgressElement || !currentProgressElement.isConnected) {
    const existing = document.querySelector<HTMLElement>('[data-ref="navigation-progress"]');
    if (!existing) return;
    currentProgressElement = existing;
  }

  const targetWrapper = resolveWrapper(targetView);
  if (targetWrapper && currentProgressElement.parentElement !== targetWrapper) {
    targetWrapper.prepend(currentProgressElement);
  }

  const el = currentProgressElement;
  el.className = 'navigation-progress navigation-progress--finishing';

  activeProgressTimer = setTimeout(() => {
    el.classList.add('navigation-progress--complete');
    activeProgressTimer = setTimeout(() => {
      el.remove();
      if (currentProgressElement === el) {
        currentProgressElement = null;
      }
      activeProgressTimer = null;
    }, 220);
  }, 200);
}

export { finishNavigationProgress, startNavigationProgress, transferNavigationProgress };
