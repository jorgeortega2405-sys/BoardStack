import { getFooterHtml, mountSiteFooter } from '../components/footer.component.js';
import { getApi, postApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { getTurnstileResponse, isTurnstileEnabled, removeTurnstile, renderTurnstile, resetTurnstile } from '../services/turnstile.service.js';
import { ViewController } from '../types/common.types.js';
import { hideElement, setupDropdown, showElement, withButtonLoading } from '../utils/dom.util.js';
import { validateEmail } from '../utils/validators.util.js';

interface TicketMessageData {
  createdAt: string;
  id: string;
  message: string;
  senderName: string;
  senderType: 'agent' | 'customer' | 'system';
}

interface TicketDetailsData {
  category: string;
  createdAt: string;
  email: string;
  id: string;
  messages: TicketMessageData[];
  name: string;
  priority: string;
  status: string;
  subject: string;
  ticketNumber: string;
  updatedAt: string;
}

export class ContactController implements ViewController {
  private abortController: AbortController | null = null;
  private container: HTMLElement;
  private currentTrackingToken: string | null = null;
  private dropdownController: { destroy: () => void } | null = null;
  private footerController: { destroy: () => void } | null = null;
  private turnstileContainer: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.abortController = new AbortController();
    this.renderFooter();
    this.turnstileContainer = this.container.querySelector<HTMLElement>('[data-ref="contact-turnstile-container"]');
    if (this.turnstileContainer && isTurnstileEnabled()) {
      void renderTurnstile(this.turnstileContainer, {
        action: 'contact_submit',
      });
    }
    this.bindEvents();
    renderIcons(this.container);

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      this.currentTrackingToken = token;
      await this.loadTicket(token);
    }
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.dropdownController) {
      this.dropdownController.destroy();
      this.dropdownController = null;
    }
    if (this.footerController) {
      this.footerController.destroy();
      this.footerController = null;
    }
    if (this.turnstileContainer) {
      removeTurnstile(this.turnstileContainer);
      this.turnstileContainer = null;
    }
  }

  private renderFooter(): void {
    const footerContainer = this.container.querySelector<HTMLElement>('[data-ref="contact-footer-section"]');
    if (!footerContainer) return;

    footerContainer.innerHTML = getFooterHtml();
    this.footerController = mountSiteFooter(footerContainer, this.abortController?.signal);
  }

  private bindEvents(): void {
    const form = this.container.querySelector<HTMLFormElement>('[data-ref="contact-form"]');
    const nameInput = this.container.querySelector<HTMLInputElement>('[data-ref="contact-name"]');
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="contact-email"]');
    const subjectDropdown = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-contact-subject"]');
    const subjectInput = this.container.querySelector<HTMLInputElement>('[data-ref="contact-subject"]');
    const subjectText = this.container.querySelector<HTMLElement>('[data-ref="contact-subject-selected-text"]');
    const messageInput = this.container.querySelector<HTMLTextAreaElement>('[data-ref="contact-message"]');
    const submitBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-contact"]');
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="contact-error"]');
    const successBanner = this.container.querySelector<HTMLElement>('[data-ref="contact-success"]');

    if (subjectDropdown) {
      this.dropdownController = setupDropdown(subjectDropdown, {
        onSelect: (val: string, item?: HTMLElement) => {
          if (subjectInput) subjectInput.value = val;
          if (subjectText && item) {
            const text = item.querySelector('.menu-item__text')?.textContent || '';
            subjectText.textContent = text;
            const itemIconHref = item.querySelector('.component-icon use')?.getAttribute('href');
            const triggerIconUse = subjectDropdown.querySelector('[data-ref="icon-contact-subject"] use');
            if (itemIconHref && triggerIconUse) {
              triggerIconUse.setAttribute('href', itemIconHref);
            }
          }
        },
      });
    }

    const showError = (msg: string) => {
      hideElement(successBanner);
      if (errorBanner) {
        errorBanner.textContent = msg;
        showElement(errorBanner);
      }
    };

    const showSuccess = (msg: string) => {
      hideElement(errorBanner);
      if (successBanner) {
        successBanner.textContent = msg;
        showElement(successBanner);
      }
    };

    form?.addEventListener(
      'submit',
      async (e: Event) => {
        e.preventDefault();

        const name = (nameInput?.value || '').trim();
        const email = (emailInput?.value || '').trim();
        const subject = (subjectInput?.value || '').trim();
        const message = (messageInput?.value || '').trim();

        if (name.length < 2) {
          showError(t('contact.error_name'));
          nameInput?.focus();
          return;
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
          showError(emailValidation.error || t('contact.error_email'));
          emailInput?.focus();
          return;
        }

        if (!subject) {
          showError(t('contact.error_subject'));
          return;
        }

        if (message.length < 10) {
          showError(t('contact.error_message'));
          messageInput?.focus();
          return;
        }

        if (this.turnstileContainer && isTurnstileEnabled()) {
          const turnstileToken = getTurnstileResponse(this.turnstileContainer);
          if (!turnstileToken) {
            showError(t('contact.error_turnstile'));
            return;
          }
        }

        hideElement(errorBanner);

        await withButtonLoading(submitBtn, t('contact.sending'), async () => {
          form.reset();
          if (this.turnstileContainer) {
            resetTurnstile(this.turnstileContainer);
          }
          if (subjectInput) subjectInput.value = '';
          if (subjectText) subjectText.textContent = t('contact.subject_placeholder');
          const triggerIconUse = subjectDropdown?.querySelector('[data-ref="icon-contact-subject"] use');
          if (triggerIconUse) {
            triggerIconUse.setAttribute('href', '/icons.svg#help');
          }
          showSuccess(t('contact.success_message'));
          showToast(t('contact.toast_success'), 'success');
        });
      },
      { signal: this.abortController?.signal }
    );

    this.bindTicketReplyEvent();
  }

  private bindTicketReplyEvent(): void {
    const replyForm = this.container.querySelector<HTMLFormElement>('[data-ref="ticket-reply-form"]');
    const replyTextarea = this.container.querySelector<HTMLTextAreaElement>('[data-ref="ticket-reply-message"]');
    const replyBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-ticket-reply"]');
    const replyError = this.container.querySelector<HTMLElement>('[data-ref="ticket-reply-error"]');
    const replySuccess = this.container.querySelector<HTMLElement>('[data-ref="ticket-reply-success"]');
    const messagesList = this.container.querySelector<HTMLElement>('[data-ref="ticket-messages-list"]');

    replyForm?.addEventListener(
      'submit',
      async (e: Event) => {
        e.preventDefault();
        if (!this.currentTrackingToken) return;

        const message = (replyTextarea?.value || '').trim();
        if (message.length < 2) {
          if (replyError) {
            replyError.textContent = t('contact.error_reply_empty');
            showElement(replyError);
          }
          return;
        }

        hideElement(replyError);

        await withButtonLoading(replyBtn, t('contact.sending_reply'), async () => {
          const res = await postApi(`/api/support/tickets/${encodeURIComponent(this.currentTrackingToken!)}/reply`, {
            message,
          });

          const data = (await res.json().catch(() => ({}))) as { error?: string; message?: TicketMessageData };
          if (!res.ok || !data.message) {
            if (replyError) {
              replyError.textContent = data.error || t('contact.error_reply_send');
              showElement(replyError);
            }
            return;
          }

          if (replyTextarea) replyTextarea.value = '';
          if (replySuccess) {
            replySuccess.textContent = t('contact.success_reply');
            showElement(replySuccess);
            setTimeout(() => {
              hideElement(replySuccess);
            }, 4000);
          }

          if (messagesList) {
            this.appendTicketMessage(data.message, messagesList);
            messagesList.scrollTop = messagesList.scrollHeight;
          }
          showToast(t('contact.toast_reply_success'), 'success');
        });
      },
      { signal: this.abortController?.signal }
    );
  }

  private async loadTicket(token: string): Promise<void> {
    const formCard = this.container.querySelector<HTMLElement>('[data-ref="contact-card-form"]');
    const ticketCard = this.container.querySelector<HTMLElement>('[data-ref="contact-card-ticket"]');
    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-title"]');
    const numberEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-number"]');
    const badgeEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-status-badge"]');
    const authorEl = this.container.querySelector<HTMLElement>('[data-ref="ticket-author"]');
    const messagesList = this.container.querySelector<HTMLElement>('[data-ref="ticket-messages-list"]');
    const replyForm = this.container.querySelector<HTMLFormElement>('[data-ref="ticket-reply-form"]');
    const closedNotice = this.container.querySelector<HTMLElement>('[data-ref="ticket-closed-notice"]');

    hideElement(formCard);
    showElement(ticketCard);

    try {
      const res = await getApi(`/api/support/tickets/${encodeURIComponent(token)}`);

      if (!res.ok) {
        if (titleEl) titleEl.textContent = t('contact.ticket_not_found');
        if (numberEl) numberEl.textContent = '#ERROR';
        if (badgeEl) {
          badgeEl.textContent = t('contact.status_invalid');
          badgeEl.className = 'contact-ticket-status-badge contact-ticket-status-badge--closed';
        }
        hideElement(replyForm);
        if (closedNotice) {
          closedNotice.textContent = t('contact.ticket_invalid_token');
          showElement(closedNotice);
        }
        return;
      }

      const ticket = (await res.json()) as TicketDetailsData;

      if (titleEl) titleEl.textContent = ticket.subject;
      if (numberEl) numberEl.textContent = `#${ticket.ticketNumber}`;
      if (authorEl) authorEl.textContent = `${ticket.name} (${ticket.category})`;

      if (badgeEl) {
        const statusMap: Record<string, { label: string; modifier: string }> = {
          closed: { label: t('contact.status_closed'), modifier: 'closed' },
          in_progress: { label: t('contact.status_in_progress'), modifier: 'waiting' },
          open: { label: t('contact.status_open'), modifier: 'open' },
          resolved: { label: t('contact.status_resolved'), modifier: 'resolved' },
          waiting_customer: { label: t('contact.status_waiting'), modifier: 'waiting' },
        };
        const mapped = statusMap[ticket.status] || { label: ticket.status, modifier: 'open' };
        badgeEl.textContent = mapped.label;
        badgeEl.className = `contact-ticket-status-badge contact-ticket-status-badge--${mapped.modifier}`;
      }

      if (messagesList) {
        messagesList.innerHTML = '';
        for (const msg of ticket.messages) {
          this.appendTicketMessage(msg, messagesList);
        }
        messagesList.scrollTop = messagesList.scrollHeight;
      }

      if (ticket.status === 'closed') {
        hideElement(replyForm);
        showElement(closedNotice);
      } else {
        showElement(replyForm);
        hideElement(closedNotice);
      }

      renderIcons(ticketCard || this.container);
    } catch {
      if (titleEl) titleEl.textContent = t('contact.ticket_load_error');
      hideElement(replyForm);
    }
  }

  private appendTicketMessage(msg: TicketMessageData, container: HTMLElement): void {
    const isCustomer = msg.senderType === 'customer';
    const row = document.createElement('div');
    row.className = `contact-ticket-msg contact-ticket-msg--${isCustomer ? 'customer' : 'agent'}`;
    row.setAttribute('data-ref', `ticket-msg-${msg.id}`);

    const meta = document.createElement('div');
    meta.className = 'contact-ticket-msg__meta';

    const author = document.createElement('span');
    author.className = 'contact-ticket-msg__author';
    author.textContent = isCustomer ? msg.senderName : msg.senderName || t('contact.support_team');
    meta.appendChild(author);

    if (!isCustomer) {
      const badge = document.createElement('span');
      badge.className = 'contact-ticket-msg__badge';
      badge.textContent = t('contact.badge_agent');
      meta.appendChild(badge);
    }

    const date = document.createElement('span');
    date.className = 'contact-ticket-msg__date';
    date.textContent = new Date(msg.createdAt).toLocaleString();
    meta.appendChild(date);

    const bubble = document.createElement('div');
    bubble.className = 'contact-ticket-msg__bubble';
    bubble.textContent = msg.message;

    row.appendChild(meta);
    row.appendChild(bubble);
    container.appendChild(row);
  }
}

export async function createContactView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/contact/contact.html');
  const controller = new ContactController(container);
  await controller.init();
  (container as any).__controller = controller;
  return container;
}
