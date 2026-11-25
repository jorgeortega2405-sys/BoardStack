import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { formatBytes, formatDate } from '../../utils/format.util.js';
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
  storage_limit_bytes?: number;
  storage_used_bytes?: number;
  stripe_subscription_id?: string | null;
  tier: string;
}

async function createSettingsBillingView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-container component-container--narrow';
  container.setAttribute('data-ref', 'settings-billing-layout');

  const initialTier = currentUser?.subscription_tier || 'free';
  const initialIsPaid = (initialTier === 'pro' || initialTier === 'enterprise');

  let billingInfo: BillingData = {
    amount: 0,
    billing_period: null,
    billing_type: null,
    cancel_at_period_end: false,
    currency: 'USD',
    current_period_end: null,
    hasSubscription: initialIsPaid,
    is_one_time: false,
    ok: true,
    status: initialIsPaid ? 'active' : 'inactive',
    tier: initialTier,
  };

  try {
    const res = await getApi('/api/subscription/billing');
    if (res.ok) {
      billingInfo = res;
    }
  } catch {}

  const isEnterprise = billingInfo.tier === 'enterprise' && (billingInfo.hasSubscription || billingInfo.status === 'active');
  const isBusiness = billingInfo.tier === 'business' && (billingInfo.hasSubscription || billingInfo.status === 'active');
  const isPro = billingInfo.tier === 'pro' && (billingInfo.hasSubscription || billingInfo.status === 'active');
  const hasPaidPlan = isEnterprise || isBusiness || isPro;

  const isOneTime = Boolean(
    billingInfo.is_one_time ||
    billingInfo.billing_type === 'one_time' ||
    billingInfo.billing_period?.includes('one_time') ||
    billingInfo.billing_period?.includes('1_month') ||
    billingInfo.billing_period?.includes('6_months') ||
    billingInfo.billing_period?.includes('12_months')
  );

  const dateFormatted = formatDate(billingInfo.current_period_end);

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

  const usedBytes = Number(billingInfo.storage_used_bytes ?? currentUser?.storage_used_bytes ?? 0);
  const totalLimitBytes = billingInfo.storage_limit_bytes
    ? Number(billingInfo.storage_limit_bytes)
    : (isEnterprise ? 10 * 1024 * 1024 * 1024 * 1024 : (isBusiness ? 1024 * 1024 * 1024 * 1024 : (isPro ? 100 * 1024 * 1024 * 1024 : 0)));

  const formattedUsed = formatBytes(usedBytes);
  const formattedLimit = isEnterprise ? 'Custom' : (isBusiness ? '1 TB' : (isPro ? '100 GB' : '0 GB'));
  const usagePercent = totalLimitBytes > 0 ? Math.min(100, Math.round((usedBytes / totalLimitBytes) * 100)) : 0;
  const storageText = hasPaidPlan ? `${formattedUsed} / ${formattedLimit}` : i18n.t('settings.billing.storage_badge_free');
  const storageDesc = isEnterprise
    ? i18n.t('settings.billing.storage_usage_desc_enterprise', { limit: formattedLimit, percent: usagePercent, used: formattedUsed })
    : isBusiness
    ? i18n.t('settings.billing.storage_usage_desc_business', { limit: formattedLimit, percent: usagePercent, used: formattedUsed })
    : isPro
    ? i18n.t('settings.billing.storage_usage_desc_pro', { limit: formattedLimit, percent: usagePercent, used: formattedUsed })
    : i18n.t('settings.billing.storage_usage_desc_free');

  const planName = isEnterprise
    ? i18n.t('settings.billing.enterprise_plan_name', { period: periodLabel })
    : isBusiness
    ? i18n.t('settings.billing.business_plan_name', { period: periodLabel })
    : isPro
    ? i18n.t('settings.billing.pro_plan_name', { period: periodLabel })
    : i18n.t('settings.billing.free_plan_name');

  const badgeClass = hasPaidPlan
    ? billingInfo.cancel_at_period_end
      ? 'component-badge--warning'
      : 'component-badge--success'
    : 'component-badge--neutral';

  const badgeText = hasPaidPlan
    ? billingInfo.cancel_at_period_end
      ? i18n.t('settings.billing.cancel_scheduled')
      : i18n.t('settings.billing.active')
    : i18n.t('settings.billing.basic_plan');

  const defaultAmt = isEnterprise ? 99 : (isBusiness ? 39 : 9.99);
  const planDesc = hasPaidPlan
    ? `${renewalTypeLabel} · $${Number(billingInfo.amount || defaultAmt).toFixed(2)} USD${
        dateFormatted ? ` · ${i18n.t('settings.billing.active')} (${dateFormatted})` : ''
      }. ${
        billingInfo.cancel_at_period_end
          ? i18n.t('settings.billing.no_further_charges')
          : ''
      }`
    : i18n.t('settings.billing.free_access_desc');

  let actionsHtml = '';
  if (isEnterprise) {
    actionsHtml = `<button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-manage-org">${i18n.t('settings.billing.manage_organization')}</button>`;
  } else if (isBusiness) {
    if (isOneTime) {
      actionsHtml = `<button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-manage-org">${i18n.t('settings.billing.manage_organization')}</button>`;
    } else if (billingInfo.cancel_at_period_end) {
      actionsHtml = `
        <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-manage-org" style="margin-right: 8px;">${i18n.t('settings.billing.manage_organization')}</button>
        <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-reactivate-sub">${i18n.t('settings.billing.reactivate_subscription')}</button>
      `;
    } else {
      actionsHtml = `
        <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-manage-org" style="margin-right: 8px;">${i18n.t('settings.billing.manage_organization')}</button>
        <button type="button" class="component-button component-button--h34 component-button--danger" data-ref="btn-cancel-sub">${i18n.t('settings.billing.cancel_subscription')}</button>
      `;
    }
  } else if (isPro) {
    if (isOneTime) {
      actionsHtml = `<span class="component-badge component-badge--sm">${i18n.t('settings.billing.fixed_plan_badge')}</span>`;
    } else if (billingInfo.cancel_at_period_end) {
      actionsHtml = `<button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-reactivate-sub">${i18n.t('settings.billing.reactivate_subscription')}</button>`;
    } else {
      actionsHtml = `<button type="button" class="component-button component-button--h34 component-button--danger" data-ref="btn-cancel-sub">${i18n.t('settings.billing.cancel_subscription')}</button>`;
    }
  } else {
    actionsHtml = `<button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-upgrade-plan">${i18n.t('settings.billing.upgrade_to_pro')}</button>`;
  }

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
                    ${planName}
                  </h3>
                  <span class="component-badge component-badge--sm ${badgeClass}" data-ref="current-plan-badge">
                    ${badgeText}
                  </span>
                </div>
                <p class="component-item__desc" data-ref="current-plan-desc">
                  ${planDesc}
                </p>
              </div>
            </div>
            <div class="component-item__actions" data-ref="current-plan-actions">
              ${actionsHtml}
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

          <hr class="component-divider" />
          <div class="component-item component-item--stacked" data-ref="item-storage-usage">
            <div class="component-item__content" style="width: 100%;">
              <div class="component-item__icon-box">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
              </div>
              <div class="component-item__text" style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
                <div class="component-group--between" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <h3 class="component-item__title">${i18n.t('settings.billing.storage_usage_title')}</h3>
                  <span class="component-badge component-badge--sm component-badge--neutral" data-ref="storage-usage-text">
                    ${storageText}
                  </span>
                </div>
                <p class="component-item__desc" style="margin: 0;">${storageDesc}</p>
                <div class="component-progress-bar" style="width: 100%; height: 6px; background-color: var(--border-color); border-radius: 9999px; overflow: hidden; margin-top: 4px;">
                  <div style="height: 100%; width: ${usagePercent}%; background-color: ${usagePercent > 90 ? 'var(--color-error, #dc2626)' : 'var(--text-primary)'}; border-radius: 9999px; transition: width 0.3s ease;"></div>
                </div>
              </div>
            </div>
          </div>
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

  const btnManageOrg = container.querySelector<HTMLButtonElement>('[data-ref="btn-manage-org"]');
  btnManageOrg?.addEventListener('click', () => {
    navigate('/organization');
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
