import { checkAuthSession, confirmTeamSeatUpgradeIntentApi, currentUser, escapeHtml, previewTeamSeatsApi, updateTeamSeatsApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { TeamDetailResponse, TeamSeatPreview } from '../types/team.types.js';
import { debounce, setupPasswordToggle } from '../utils/dom.util.js';
import { openModal } from './modal.component.js';

const MAX_SEATS = 100;

function openSeatPaymentModal(options: {
  amountCharged: number;
  clientSecret: string;
  onUpdated?: () => void | Promise<void>;
  paymentIntentId: string;
  publishableKey: string;
  seats: number;
}): ModalInstance {
  let stripeInstance: any = null;
  let elementsInstance: any = null;
  let paymentElement: any = null;

  const bodyHtml = `<div class="team-seat-payment-mount" data-ref="team-seat-payment-mount"></div>`;
  const formattedAmount = options.amountCharged.toFixed(2);

  const modal = openModal({
    bodyHtml,
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.btn_confirm_seat_payment', { amount: formattedAmount }),
    description: t('settings.team.seats_upgrade_modal_desc', {
      amount: formattedAmount,
      seats: options.seats,
    }),
    onClose: () => {
      try {
        paymentElement?.destroy?.();
      } catch {}
    },
    onConfirm: async (inst) => {
      inst.clearError();
      if (!stripeInstance || !elementsInstance) {
        inst.showError(t('teams.errors.confirm_seats'));
        return false;
      }

      inst.setConfirmLoading(true);
      const { error, paymentIntent } = await stripeInstance.confirmPayment({
        confirmParams: {
          return_url: window.location.href,
        },
        elements: elementsInstance,
        redirect: 'if_required',
      });

      if (error) {
        inst.setConfirmLoading(false);
        inst.showError(error.message || t('teams.errors.confirm_seats'));
        return false;
      }

      if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        const confirmRes = await confirmTeamSeatUpgradeIntentApi(paymentIntent.id || options.paymentIntentId);
        if (!confirmRes.success) {
          inst.setConfirmLoading(false);
          inst.showError(confirmRes.error || t('teams.errors.confirm_seats'));
          return false;
        }
        await checkAuthSession();
        if (typeof options.onUpdated === 'function') {
          await options.onUpdated();
        }
        inst.close();
        showToast(t('settings.team.toast_seats_updated'), 'success');
        return true;
      }

      inst.setConfirmLoading(false);
      inst.showError(t('teams.errors.confirm_seats'));
      return false;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('settings.team.seats_upgrade_modal_title'),
  });

  const mountTarget = modal.body.querySelector<HTMLElement>('[data-ref="team-seat-payment-mount"]');
  if (mountTarget) {
    void (async () => {
      try {
        stripeInstance = await loadStripeSdk(options.publishableKey);
        elementsInstance = stripeInstance.elements({
          appearance: getStripeAppearance(),
          clientSecret: options.clientSecret,
        });
        paymentElement = elementsInstance.create('payment', { layout: 'tabs' });
        paymentElement.mount(mountTarget);
      } catch {
        modal.showError(t('teams.errors.confirm_seats'));
      }
    })();
  }

  return modal;
}

function openManageTeamSeatsModal(options: {
  detail: TeamDetailResponse;
  onUpdated?: () => void | Promise<void>;
}): ModalInstance {
  const { detail } = options;
  const minSeats = Math.max(1, detail.seatsUsed + detail.pendingCount);
  const currentLimit = Math.max(minSeats, Number(detail.seatLimit || detail.team.seat_limit || 1));
  const requiresPassword = currentUser?.has_password !== false;
  let seatDraft = currentLimit;
  let isClosed = false;
  let lastPreview: TeamSeatPreview | null = null;
  let confirmedChecked = false;
  let useNewCard = false;

  const minHint = t('settings.team.seats_modal_min_hint', {
    active: detail.seatsUsed,
    min: minSeats,
    pending: detail.pendingCount,
  });

  const securityFieldHtml = requiresPassword
    ? `
      <label class="field" data-ref="field-seats-password">
        <input class="field__input field__input--has-action" data-ref="input-seats-password" type="password" placeholder=" " autocomplete="current-password" />
        <span class="field__label">${escapeHtml(t('settings.team.seats_security_password_label'))}</span>
        <button type="button" class="field__action" data-ref="btn-toggle-seats-password" data-tooltip="${escapeHtml(t('common.show_password'))}" aria-label="${escapeHtml(t('auth.login.toggle_password'))}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
        </button>
      </label>
    `
    : `
      <p class="team-seats-field__hint" data-ref="seats-security-email-hint">${escapeHtml(t('settings.team.seats_security_email_hint', { email: currentUser?.email || '' }))}</p>
      <label class="field" data-ref="field-seats-email">
        <input class="field__input" data-ref="input-seats-email" type="email" placeholder=" " autocomplete="email" />
        <span class="field__label">${escapeHtml(t('settings.team.seats_security_email_label'))}</span>
      </label>
    `;

  const bodyHtml = `
    <div class="team-seats-modal" data-ref="team-seats-modal-body">
      <div class="team-seats-field" data-ref="modal-seats-stepper-box">
        <div class="team-seats-field__header">
          <span class="team-seats-field__label">${escapeHtml(t('settings.team.seats_step_label'))}</span>
          <div class="team-seats-stepper" data-ref="modal-seats-stepper">
            <button type="button" class="component-button component-button--h36 component-button--icon-only" data-ref="btn-modal-seats-dec" aria-label="${escapeHtml(t('settings.team.aria_decrease_seats'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#remove"></use></svg>
            </button>
            <input class="field__input team-seats-stepper__input" data-ref="input-modal-seats" type="number" min="${minSeats}" max="${MAX_SEATS}" value="${seatDraft}" />
            <button type="button" class="component-button component-button--h36 component-button--icon-only" data-ref="btn-modal-seats-inc" aria-label="${escapeHtml(t('settings.team.aria_increase_seats'))}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            </button>
          </div>
        </div>
        <p class="team-seats-field__hint">${escapeHtml(minHint)}</p>
      </div>
      <div class="banner banner--info is-hidden" data-ref="modal-seats-preview-banner"></div>
      <div class="team-seats-payment is-hidden" data-ref="modal-seats-payment-box"></div>
      <div class="team-seats-security is-hidden" data-ref="modal-seats-security-box">
        <label class="team-confirm-check" data-ref="label-seats-confirm">
          <input class="component-checkbox" data-ref="checkbox-seats-confirm" type="checkbox" />
          <span class="team-confirm-check__text">${escapeHtml(t('settings.team.seats_security_confirm_label'))}</span>
        </label>
        ${securityFieldHtml}
      </div>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: t('settings.team.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: t('settings.team.btn_update_seats'),
    description: t('settings.team.seats_modal_desc'),
    onClose: () => {
      isClosed = true;
    },
    onConfirm: async (inst) => {
      inst.clearError();
      if (seatDraft === currentLimit) {
        return false;
      }

      if (!confirmedChecked) {
        inst.showError(t('settings.team.validation_confirm_required'));
        return false;
      }

      const passwordVal = (passwordInput?.value || '').trim();
      const emailVal = (emailInput?.value || '').trim().toLowerCase();
      if (requiresPassword) {
        if (!passwordVal) {
          inst.showError(t('settings.team.validation_password_required'));
          passwordInput?.focus();
          return false;
        }
      } else {
        const expectedEmail = (currentUser?.email || '').trim().toLowerCase();
        if (!emailVal || (expectedEmail && emailVal !== expectedEmail)) {
          inst.showError(t('settings.team.validation_email_confirm_required'));
          emailInput?.focus();
          return false;
        }
      }

      inst.setConfirmLoading(true);
      const res = await updateTeamSeatsApi({
        confirmed: true,
        ...(requiresPassword ? { currentPassword: passwordVal } : { verificationEmail: emailVal }),
        seats: seatDraft,
        useNewCard: seatDraft > currentLimit && useNewCard,
      });
      if (isClosed) return false;

      if (!res.success) {
        inst.setConfirmLoading(false);
        inst.showError(res.error || t('teams.errors.update_seats'));
        syncControls();
        return false;
      }

      if (res.requiresPaymentAction && res.clientSecret && res.publishableKey && res.paymentIntentId) {
        inst.close();
        openSeatPaymentModal({
          amountCharged: Number(res.amountCharged || 0),
          clientSecret: res.clientSecret,
          onUpdated: options.onUpdated,
          paymentIntentId: res.paymentIntentId,
          publishableKey: res.publishableKey,
          seats: seatDraft,
        });
        return true;
      }

      await checkAuthSession();
      if (typeof options.onUpdated === 'function') {
        await options.onUpdated();
      }
      inst.close();
      showToast(t('settings.team.toast_seats_updated'), 'success');
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'sm',
    title: t('settings.team.seats_modal_title'),
  });

  renderIcons(modal.body);

  const btnDec = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-dec"]');
  const btnInc = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-inc"]');
  const inputSeats = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-seats"]');
  const previewBanner = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-preview-banner"]');
  const paymentBox = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-payment-box"]');
  const securityBox = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-security-box"]');
  const confirmCheckbox = modal.body.querySelector<HTMLInputElement>('[data-ref="checkbox-seats-confirm"]');
  const passwordInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-seats-password"]');
  const btnTogglePassword = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-seats-password"]');
  const emailInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-seats-email"]');

  setupPasswordToggle(btnTogglePassword, passwordInput, {
    hideTooltip: t('common.hide_password'),
    showTooltip: t('common.show_password'),
  });

  const renderPaymentBox = () => {
    if (!paymentBox) return;
    if (seatDraft <= currentLimit || !lastPreview) {
      paymentBox.classList.add('is-hidden');
      paymentBox.innerHTML = '';
      return;
    }

    if (lastPreview.isOneTime) {
      paymentBox.innerHTML = `<p class="team-seats-field__hint" data-ref="seats-one-time-note">${escapeHtml(t('settings.team.seats_payment_one_time_card_note'))}</p>`;
      paymentBox.classList.remove('is-hidden');
      return;
    }

    if (lastPreview.defaultPaymentMethod) {
      const pm = lastPreview.defaultPaymentMethod;
      const brandLabel = (pm.brand || 'CARD').toUpperCase();
      const expiryHtml = pm.expMonth && pm.expYear
        ? `<span class="team-seats-payment__card-exp">${escapeHtml(t('settings.team.seats_payment_card_expires', {
            month: String(pm.expMonth).padStart(2, '0'),
            year: String(pm.expYear).slice(-2),
          }))}</span>`
        : '';

      paymentBox.innerHTML = `
        <div class="team-seats-payment__title">${escapeHtml(t('settings.team.seats_payment_card_title'))}</div>
        <div class="team-seats-payment__card" data-ref="seats-default-card-row">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
          <div class="team-seats-payment__card-info">
            <span class="team-seats-payment__card-brand">${escapeHtml(t('settings.team.seats_payment_card_masked', { brand: brandLabel, last4: pm.last4 }))}</span>
            ${expiryHtml}
          </div>
        </div>
        <label class="team-confirm-check" data-ref="label-seats-use-new-card">
          <input class="component-checkbox" data-ref="checkbox-seats-use-new-card" type="checkbox" ${useNewCard ? 'checked' : ''} />
          <span class="team-confirm-check__text">${escapeHtml(t('settings.team.seats_payment_use_new_card'))}</span>
        </label>
      `;
      renderIcons(paymentBox);
      paymentBox.classList.remove('is-hidden');
      return;
    }

    paymentBox.innerHTML = `<p class="team-seats-field__hint" data-ref="seats-no-card-note">${escapeHtml(t('settings.team.seats_payment_no_card'))}</p>`;
    paymentBox.classList.remove('is-hidden');
  };

  const syncControls = () => {
    const hasSeatChange = seatDraft !== currentLimit;
    if (inputSeats) inputSeats.value = String(seatDraft);
    if (btnDec) btnDec.disabled = seatDraft <= minSeats;
    if (btnInc) btnInc.disabled = seatDraft >= MAX_SEATS;
    if (!hasSeatChange) {
      useNewCard = false;
    }

    securityBox?.classList.toggle('is-hidden', !hasSeatChange);
    renderPaymentBox();

    const hasCred = requiresPassword
      ? Boolean((passwordInput?.value || '').trim())
      : Boolean((emailInput?.value || '').trim());

    if (modal.confirmBtn) {
      modal.confirmBtn.disabled = !hasSeatChange || !confirmedChecked || !hasCred;
    }
  };

  const refreshPreview = debounce(async () => {
    if (isClosed) return;
    const requested = seatDraft;
    if (requested === currentLimit) {
      previewBanner?.classList.add('is-hidden');
      renderPaymentBox();
      return;
    }

    const res = await previewTeamSeatsApi(requested);
    if (isClosed || requested !== seatDraft) return;

    if (!res.success || !res.preview) {
      previewBanner?.classList.add('is-hidden');
      modal.showError(res.error || t('teams.errors.preview_seats'));
      return;
    }

    modal.clearError();
    const p = res.preview;
    lastPreview = p;
    const formattedAmount = Number(p.amountDueNow || 0).toFixed(2);
    const formattedNext = Number(p.nextCycleAmount || 0).toFixed(2);

    if (previewBanner) {
      if (p.newSeats < p.currentSeats) {
        previewBanner.textContent = t('settings.team.seats_preview_reduce', {
          newSeats: p.newSeats,
          nextCycleAmount: formattedNext,
        });
      } else if (p.isOneTime) {
        previewBanner.textContent = t('settings.team.seats_preview_one_time', {
          amount: formattedAmount,
        });
      } else {
        previewBanner.textContent = t('settings.team.seats_preview_charge_now', {
          amount: formattedAmount,
          nextCycleAmount: formattedNext,
        });
      }
      previewBanner.classList.remove('is-hidden');
    }
    renderPaymentBox();
  }, 240);

  const loadBaselinePreview = async () => {
    const res = await previewTeamSeatsApi(currentLimit);
    if (isClosed || !res.success || !res.preview) return;
    lastPreview = res.preview;
    if (seatDraft !== currentLimit) {
      renderPaymentBox();
    }
  };

  const adjustDraft = (target: number) => {
    const clamped = Math.max(minSeats, Math.min(MAX_SEATS, Math.floor(target)));
    seatDraft = clamped;
    modal.clearError();
    syncControls();
    if (clamped === currentLimit) {
      previewBanner?.classList.add('is-hidden');
      return;
    }
    refreshPreview();
  };

  btnDec?.addEventListener('click', () => adjustDraft(seatDraft - 1));
  btnInc?.addEventListener('click', () => adjustDraft(seatDraft + 1));
  inputSeats?.addEventListener('input', () => {
    const parsed = Number(inputSeats.value);
    if (Number.isFinite(parsed)) {
      adjustDraft(parsed);
    }
  });

  paymentBox?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement | null;
    if (target?.getAttribute('data-ref') === 'checkbox-seats-use-new-card') {
      useNewCard = Boolean(target.checked);
    }
  });

  confirmCheckbox?.addEventListener('change', () => {
    confirmedChecked = Boolean(confirmCheckbox.checked);
    modal.clearError();
    syncControls();
  });

  const handleCredInput = () => {
    modal.clearError();
    syncControls();
  };

  const handleCredKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && modal.confirmBtn && !modal.confirmBtn.disabled) {
      e.preventDefault();
      modal.confirmBtn.click();
    }
  };

  passwordInput?.addEventListener('input', handleCredInput);
  passwordInput?.addEventListener('keydown', handleCredKeydown);
  emailInput?.addEventListener('input', handleCredInput);
  emailInput?.addEventListener('keydown', handleCredKeydown);

  syncControls();
  void loadBaselinePreview();
  return modal;
}

export { openManageTeamSeatsModal };
