async function createHomeView(navigate?: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container';
  container.setAttribute('data-ref', 'home-layout');
  return container;
}

export {
  createHomeView
};
