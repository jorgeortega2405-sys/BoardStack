import { i18n } from '../i18n/i18n.service.js';

function createFooterComponent(navigate?: (path: string) => void): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'component-block component-block--footer';
  footer.setAttribute('data-ref', 'app-footer');

  footer.innerHTML = `
    <div class="component-footer__main" data-ref="footer-main">
      <div class="component-footer__brand" data-ref="footer-brand-box">
        <a class="component-brand" data-ref="footer-brand-link" href="javascript:void(0)" aria-label="BoardStack">
          <img class="component-brand__img" data-ref="footer-logo-img" alt="BoardStack" src="/logo.svg" />
        </a>
        <p class="component-footer__slogan" data-ref="footer-slogan">${i18n.t('footer.slogan')}</p>
      </div>

      <div class="component-footer__nav" data-ref="footer-nav">
        <div class="component-footer__col" data-ref="footer-col-product">
          <h4 class="component-footer__col-title" data-ref="footer-title-product">${i18n.t('footer.cat_product')}</h4>
          <div class="component-footer__links" data-ref="footer-links-product">
            <a class="component-footer__link" data-ref="link-product-home" href="javascript:void(0)">${i18n.t('footer.product_home')}</a>
            <a class="component-footer__link" data-ref="link-product-features" href="javascript:void(0)">${i18n.t('footer.product_features')}</a>
            <a class="component-footer__link" data-ref="link-product-pricing" href="javascript:void(0)">${i18n.t('footer.product_pricing')}</a>
            <a class="component-footer__link" data-ref="link-product-tools" href="javascript:void(0)">${i18n.t('footer.product_tools')}</a>
            <a class="component-footer__link" data-ref="link-product-faq" href="javascript:void(0)">${i18n.t('footer.product_faq')}</a>
          </div>
        </div>

        <div class="component-footer__col" data-ref="footer-col-legal">
          <h4 class="component-footer__col-title" data-ref="footer-title-legal">${i18n.t('footer.cat_legal')}</h4>
          <div class="component-footer__links" data-ref="footer-links-legal">
            <a class="component-footer__link" data-ref="link-legal-security" href="javascript:void(0)">${i18n.t('footer.legal_security')}</a>
            <a class="component-footer__link" data-ref="link-legal-privacy" href="javascript:void(0)">${i18n.t('footer.legal_privacy')}</a>
            <a class="component-footer__link" data-ref="link-legal-terms" href="javascript:void(0)">${i18n.t('footer.legal_terms')}</a>
            <a class="component-footer__link" data-ref="link-legal-cookies" href="javascript:void(0)">${i18n.t('footer.legal_cookies')}</a>
          </div>
        </div>

        <div class="component-footer__col" data-ref="footer-col-company">
          <h4 class="component-footer__col-title" data-ref="footer-title-company">${i18n.t('footer.cat_company')}</h4>
          <div class="component-footer__links" data-ref="footer-links-company">
            <a class="component-footer__link" data-ref="link-company-about" href="javascript:void(0)">${i18n.t('footer.company_about')}</a>
            <a class="component-footer__link" data-ref="link-company-contact" href="javascript:void(0)">${i18n.t('footer.company_contact')}</a>
            <a class="component-footer__link" data-ref="link-company-blog" href="javascript:void(0)">${i18n.t('footer.company_blog')}</a>
            <a class="component-footer__link" data-ref="link-company-press" href="javascript:void(0)">${i18n.t('footer.company_press')}</a>
          </div>
        </div>
      </div>
    </div>

    <div class="component-footer__bottom" data-ref="footer-bottom">
      <span data-ref="footer-copyright">© ${new Date().getFullYear()} BoardStack. ${i18n.t('footer.all_rights_reserved')}</span>
    </div>
  `;

  const links = footer.querySelectorAll<HTMLAnchorElement>('a');
  links.forEach((link) => {
    link.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
    });
  });

  return footer;
}

export {
  createFooterComponent
};
