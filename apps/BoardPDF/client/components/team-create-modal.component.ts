import { checkAuthSession, createTeamApi, currentUser, escapeHtml, hasSubscriptionFeature } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { navigate } from '../services/navigation.service.js';
import { showToast } from '../services/toast.service.js';
import { setActiveTeamId } from '../services/workspace.service.js';
import { ModalInstance } from '../types/common.types.js';
import { openModal } from './modal.component.js';

function openCreateTeamModal(options: { initialSeats?: number; onCreated?: () => void } = {}): ModalInstance | null {
  const user = currentUser;
  if (!user) {
    showToast(t('pricing.login_required'), 'info');
    navigate('/login');
    return null;
  }

  const hasBusinessEntitlement = hasSubscriptionFeature('business');
  const ownsActiveTeam = Array.isArray(user.teams)
    && user.teams.some((team) => Number(team.owner_id) === Number(user.id) && team.subscription_status === 'active');
  const canCreateFirstFreeTeam = hasBusinessEntitlement && !ownsActiveTeam;

  let seats = Math.max(1, Math.min(50, Math.floor(Number(options.initialSeats) || (canCreateFirstFreeTeam ? 1 : 2))));

  const hintText = canCreateFirstFreeTeam
    ? t('teams.create_modal.business_free_hint')
    : t('teams.create_modal.upgrade_hint');

  const bodyHtml = `
    <div class="team-create-modal" data-ref="team-create-modal-body">
      <div class="banner banner--info team-create-modal__hint" data-ref="team-create-hint">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
        <span>${escapeHtml(hintText)}</span>
      </div>
      <label class="field" data-ref="field-create-team-name">
        <input class="field__input" data-ref="input-create-team-name" type="text" placeholder=" " maxlength="80" autocomplete="organization" />
        <span class="field__label">${escapeHtml(t('teams.create_modal.team_name_label'))}</span>
      </label>
      <div class="team-seats-field" data-ref="team-create-seats-field">
        <div class="team-seats-field__header">
          <span class="team-seats-field__label">${escapeHtml(t('teams.create_modal.seats_label'))}</span>
          <span class="component-badge component-badge--sm component-badge--neutral" data-ref="team-create-seats-badge">${escapeHtml(seats === 1 ? t('checkout.seats_count_singular') : t('checkout.seats_count_plural', { count: seats }))}</span>
        </div>
        <div class="team-seats-stepper" data-ref="team-create-seats-stepper">
          <button type="button" class="component-button component-button--h36 component-button--icon-only" data-ref="btn-modal-seats-dec" aria-label="-">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#remove"></use></svg>
          </button>
          <input class="field__input team-seats-stepper__input" data-ref="input-create-team-seats" type="number" min="1" max="50" value="${seats}" />
          <button type="button" class="component-button component-button--h36 component-button--icon-only" data-ref="btn-modal-seats-inc" aria-label="+">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          </button>
        </div>
        <p class="team-seats-field__hint">${escapeHtml(t('teams.create_modal.seats_price_hint'))}</p>
      </div>
      <ul class="team-create-modal__features">
        <li class="team-create-modal__feature-item">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span>${escapeHtml(t('teams.create_modal.feat_storage'))}</span>
        </li>
        <li class="team-create-modal__feature-item">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span>${escapeHtml(t('teams.create_modal.feat_tokens'))}</span>
        </li>
        <li class="team-create-modal__feature-item">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>
          <span>${escapeHtml(t('teams.create_modal.feat_sharing'))}</span>
        </li>
      </ul>
    </div>
  `;

  const getConfirmText = (count: number): string => {
    if (canCreateFirstFreeTeam && count === 1) {
      return t('teams.create_modal.btn_create_free');
    }
    return t('teams.create_modal.btn_continue_checkout', { seats: count });
  };

  const modal = openModal({
    bodyHtml,
    cancelText: t('teams.create_modal.btn_cancel'),
    confirmClass: 'component-button--black',
    confirmText: getConfirmText(seats),
    description: t('teams.create_modal.subtitle'),
    onConfirm: async (inst) => {
      inst.clearError();
      const nameInput = inst.body.querySelector<HTMLInputElement>('[data-ref="input-create-team-name"]');
      const name = (nameInput?.value || '').trim();
      if (name.length < 2) {
        inst.showError(t('checkout.team_name_required'));
        nameInput?.focus();
        return false;
      }

      if (canCreateFirstFreeTeam && seats === 1) {
        inst.setConfirmLoading(true);
        const res = await createTeamApi(name);
        if (res.success && res.team) {
          setActiveTeamId(res.team.id);
          await checkAuthSession();
          inst.close();
          showToast(t('checkout.success_team_ready', { seats: res.team.seat_limit || 1, team: res.team.name }), 'success');
          if (typeof options.onCreated === 'function') {
            options.onCreated();
          }
          navigate('/settings/team');
          return true;
        }
        inst.setConfirmLoading(false);
        inst.showError(res.error || t('teams.errors.create_team'));
        return false;
      }

      inst.close();
      const params = new URLSearchParams({
        cycle: 'monthly',
        flow: 'create-team',
        plan: 'business',
        seats: String(seats),
        teamName: name,
      });
      navigate(`/checkout?${params.toString()}`);
      return true;
    },
    showCancel: true,
    showConfirm: true,
    size: 'md',
    title: t('teams.create_modal.title'),
  });

  const seatsInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-create-team-seats"]');
  const seatsBadge = modal.body.querySelector<HTMLElement>('[data-ref="team-create-seats-badge"]');
  const btnDec = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-dec"]');
  const btnInc = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-seats-inc"]');
  const nameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-create-team-name"]');

  const syncSeatsUI = (nextVal: number) => {
    seats = Math.max(1, Math.min(50, Math.floor(Number(nextVal) || 1)));
    if (seatsInput) seatsInput.value = String(seats);
    if (seatsBadge) {
      seatsBadge.textContent = seats === 1
        ? t('checkout.seats_count_singular')
        : t('checkout.seats_count_plural', { count: seats });
    }
    if (modal.btnConfirm) {
      modal.btnConfirm.textContent = getConfirmText(seats);
    }
    if (btnDec) btnDec.disabled = seats <= 1;
    if (btnInc) btnInc.disabled = seats >= 50;
  };

  syncSeatsUI(seats);
  renderIcons(modal.backdrop);

  btnDec?.addEventListener('click', (e) => {
    e.preventDefault();
    syncSeatsUI(seats - 1);
  });

  btnInc?.addEventListener('click', (e) => {
    e.preventDefault();
    syncSeatsUI(seats + 1);
  });

  seatsInput?.addEventListener('change', () => {
    syncSeatsUI(Number(seatsInput.value));
  });

  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.btnConfirm?.click();
    }
  });

  setTimeout(() => {
    nameInput?.focus();
  }, 100);

  return modal;
}

export { openCreateTeamModal };
