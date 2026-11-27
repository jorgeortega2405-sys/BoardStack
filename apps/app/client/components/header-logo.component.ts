function createHeaderLogoComponent(navigate?: (path: string) => void): HTMLElement {
  const block = document.createElement('div');
  block.className = 'component-block component-block--logo';
  block.setAttribute('data-ref', 'header-logo-block');
  block.innerHTML = `
    <a class="component-brand" data-ref="header-logo-link" href="/" aria-label="BoardStack">
      <img class="component-brand__img" data-ref="header-logo-img" alt="BoardStack" src="/logo.svg" />
    </a>
  `;

  const link = block.querySelector<HTMLAnchorElement>('[data-ref="header-logo-link"]');
  link?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    if (navigate) {
      navigate('/');
    } else {
      window.location.href = '/';
    }
  });

  return block;
}

export {
  createHeaderLogoComponent
};
