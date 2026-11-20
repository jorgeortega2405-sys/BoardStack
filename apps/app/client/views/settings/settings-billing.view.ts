import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { i18n } from '../../i18n/i18n.service.js';
import { openCancelSubscriptionModal } from '../../components/modal-dialogs.js';
import { renderIcons } from '../../services/icon.service.js';
import { toast } from '../../services/toast.service.js';

interface BillingData {
  amount: number;
  billing_period?: string | null;
  billing_type?: string | null;
  cancel_at_period_end: boolean;
  currency: string;
  current_period_end?: string | null;
  hasSubscription: boolean;
  is_one_time: boolean;
  ok: boolean;
  status: string;
  stripe_subscription_id?: string | null;
  tier: string;
}

async function createSettingsBillingView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-billing-layout');

  let billingInfo: BillingData = {
    amount: 0,
    billing_period: null,
    billing_type: null,
    cancel_at_period_end: false,
    currency: 'USD',
    current_period_end: null,
    hasSubscription: currentUser?.subscription_tier === 'pro',
    is_one_time: false,
    ok: true,
    status: currentUser?.subscription_tier === 'pro' ? 'active' : 'inactive',
    tier: currentUser?.subscription_tier || 'free',
  };

  try {
    const res = await getApi('/api/subscription/billing');
    if (res.ok) {
      billingInfo = res;
    }
  } catch {}

  const isPro = billingInfo.tier === 'pro' && billingInfo.hasSubscription;
  const isOneTime = Boolean(
    billingInfo.is_one_time ||
    billingInfo.billing_type === 'one_time' ||
    billingInfo.billing_period?.includes('one_time') ||
    billingInfo.billing_period?.includes('1_month') ||
    billingInfo.billing_period?.includes('6_months') ||
    billingInfo.billing_period?.includes('12_months')
  );

  let dateFormatted = '';
  if (billingInfo.current_period_end) {
    try {
      const d = new Date(billingInfo.current_period_end);
      dateFormatted = d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {}
  }

  let periodLabel = i18n.t('settings.billing.period_monthly');
  if (billingInfo.billing_period === 'yearly') {
    periodLabel = i18n.t('settings.billing.period_yearly');
  } else if (billingInfo.billing_period === '1_month') {
    periodLabel = i18n.t('settings.billing.period_1_month');
  } else if (billingInfo.billing_period === '6_months') {
    periodLabel = i18n.t('settings.billing.period_6_months');
  } else if (billingInfo.billing_period === '12_months') {
    periodLabel = i18n.t('settings.billing.period_12_months');
  }

  const renewalTypeLabel = isOneTime
    ? i18n.t('settings.billing.renewal_fixed')
    : i18n.t('settings.billing.renewal_auto');

  container.innerHTML = `
    <div class="component-header" data-ref="settings-header">
      <h1 class="component-title" data-ref="settings-title">${i18n.t('settings.billing.title')}</h1>
      <p class="component-subtitle" data-ref="settings-subtitle">${i18n.t('settings.billing.subtitle')}</p>
    </div>

    <div class="component-group component-group--accordion is-active" data-ref="group-subscription-plan">
      <div class="component-accordion-header" data-ref="accordion-header-subscription">
        <div class="component-item__content">
          <div class="component-item__icon-box">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#star"></use></svg>
          </div>
          <div class="component-item__text">
            <h2 class="component-item__title">${i18n.t('settings.billing.plan_details_title')}</h2>
            <p class="component-item__desc">${i18n.t('settings.billing.plan_details_desc')}</p>
          </div>
        </div>
        <div class="component-item__actions">
          <svg class="component-icon component-accordion-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </div>
      </div>

      <div class="component-accordion-body" data-ref="accordion-body-subscription">
        <div class="component-accordion-content">
          <div class="component-item" data-ref="item-current-plan">
            <div class="component-item__content">
              <div class="component-item__icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#rocket_launch"></use></svg>
              </div>
              <div class="component-item__text">
                <div class="component-group--between" style="justify-content: flex-start; gap: 8px;">
                  <h3 class="component-item__title" data-ref="current-plan-name">
                    ${isPro ? i18n.t('settings.billing.pro_plan_name', { period: periodLabel }) : i18n.t('settings.billing.free_plan_name')}
                  </h3>
                  <span class="component-badge component-badge--sm ${
                    isPro
                      ? billingInfo.cancel_at_period_end
                        ? 'component-badge--warning'
                        : 'component-badge--success'
                      : 'component-badge--neutral'
                  }" data-ref="current-plan-badge">
                    ${
                      isPro
                        ? billingInfo.cancel_at_period_end
                          ? i18n.t('settings.billing.cancel_scheduled')
                          : i18n.t('settings.billing.active')
                        : i18n.t('settings.billing.basic_plan')
                    }
                  </span>
                </div>
                <p class="component-item__desc" data-ref="current-plan-desc">
                  ${
                    isPro
                      ? `${renewalTypeLabel} · $${Number(billingInfo.amount || 9.99).toFixed(2)} USD${
                          dateFormatted ? ` · ${i18n.t('settings.billing.active')} (${dateFormatted})` : ''
                        }. ${
                          billingInfo.cancel_at_period_end
                            ? i18n.t('settings.billing.no_further_charges')
                            : ''
                        }`
                      : i18n.t('settings.billing.free_access_desc')
                  }
                </p>
              </div>
            </div>
            <div class="component-item__actions" data-ref="current-plan-actions">
              ${
                !isPro
                  ? `<button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-upgrade-plan">${i18n.t('settings.billing.upgrade_to_pro')}</button>`
                  : isOneTime
                  ? `<span class="component-badge component-badge--sm">${i18n.t('settings.billing.fixed_plan_badge')}</span>`
                  : billingInfo.cancel_at_period_end
                  ? `<button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-reactivate-sub">${i18n.t('settings.billing.reactivate_subscription')}</button>`
                  : `<button type="button" class="component-button component-button--h34 component-button--danger" data-ref="btn-cancel-sub">${i18n.t('settings.billing.cancel_subscription')}</button>`
              }
            </div>
          </div>

          ${
            isPro && isOneTime
              ? `
              <hr class="component-divider" />
              <div class="component-item" data-ref="item-fixed-note">
                <div class="component-item__content">
                  <div class="component-item__icon-box">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  </div>
                  <div class="component-item__text">
                    <h3 class="component-item__title">${i18n.t('settings.billing.fixed_no_renewals_title')}</h3>
                    <p class="component-item__desc">${i18n.t('settings.billing.fixed_no_renewals_desc', { date: dateFormatted || i18n.t('settings.billing.end_of_cycle') })}</p>
                  </div>
                </div>
              </div>
            `
              : ''
          }
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const header = container.querySelector<HTMLElement>('[data-ref="accordion-header-subscription"]');
  const group = container.querySelector<HTMLElement>('[data-ref="group-subscription-plan"]');
  header?.addEventListener('click', (e) => {
    e.preventDefault();
    group?.classList.toggle('is-active');
  });

  const btnUpgrade = container.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-plan"]');
  btnUpgrade?.addEventListener('click', () => {
    navigate('/pricing');
  });

  const handleCancelSub = () => {
    openCancelSubscriptionModal({
      dateFormatted: dateFormatted || i18n.t('settings.billing.end_of_period'),
      onConfirm: async (inst) => {
        inst.clearError();
        inst.setConfirmLoading(true, i18n.t('settings.billing.cancelling'));

        try {
          const res = await postApi('/api/subscription/renewal', { cancelAtPeriodEnd: true });
          if (res.ok) {
            inst.close();
            toast.success(i18n.t('settings.billing.cancellation_success'));
            navigate('/settings/billing');
            return true;
          } else {
            inst.setConfirmLoading(false);
            inst.showError(res.error || i18n.t('settings.billing.cancellation_failed'));
            return false;
          }
        } catch {
          inst.setConfirmLoading(false);
          inst.showError(i18n.t('auth.connection_error'));
          return false;
        }
      },
    });
  };

  const handleReactivateSub = async () => {
    try {
      const res = await postApi('/api/subscription/renewal', { cancelAtPeriodEnd: false });
      if (res.ok) {
        toast.success(i18n.t('settings.billing.reactivation_success'));
        navigate('/settings/billing');
      } else {
        toast.error(res.error || i18n.t('settings.billing.reactivation_failed'));
      }
    } catch {
      toast.error(i18n.t('auth.connection_error'));
    }
  };

  container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-sub"]')?.addEventListener('click', handleCancelSub);
  container.querySelector<HTMLButtonElement>('[data-ref="btn-reactivate-sub"]')?.addEventListener('click', handleReactivateSub);

  return container;
}

export {
  createSettingsBillingView
};

export type {
  BillingData
};
