import { checkAuthSession, confirmTeamSeatUpgradeIntentApi, escapeHtml, previewTeamSeatsApi, updateTeamSeatsApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { getStripeAppearance, loadStripeSdk } from '../services/stripe.service.js';
import { showToast } from '../services/toast.service.js';
import { ModalInstance } from '../types/common.types.js';
import { TeamDetailResponse } from '../types/team.types.js';
import { debounce } from '../utils/dom.util.js';
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
  let seatDraft = currentLimit;
  let isClosed = false;

  const minHint = t('settings.team.seats_modal_min_hint', {
    active: detail.seatsUsed,
    min: minSeats,
    pending: detail.pendingCount,
  });

  const bodyHtml = `
    <div class="team-seats-modal" data-ref="team-seats-modal-body">
      <div class="team-seats-field">
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

      inst.setConfirmLoading(true);
      const res = await updateTeamSeatsApi(seatDraft);
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

  const btnDec = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-dec"]');
  const btnInc = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-inc"]');
  const inputSeats = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-seats"]');
  const previewBanner = modal.body.querySelector<HTMLElement>('[data-ref="modal-seats-preview-banner"]');

  const syncControls = () => {
    if (inputSeats) inputSeats.value = String(seatDraft);
    if (btnDec) btnDec.disabled = seatDraft <= minSeats;
    if (btnInc) btnInc.disabled = seatDraft >= MAX_SEATS;
    if (modal.confirmBtn) modal.confirmBtn.disabled = seatDraft === currentLimit;
  };

  const refreshPreview = debounce(async () => {
    if (isClosed) return;
    const requested = seatDraft;
    if (requested === currentLimit) {
      previewBanner?.classList.add('is-hidden');
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
  }, 240);

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

  syncControls();
  return modal;
}

export { openManageTeamSeatsModal };
