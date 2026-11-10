import { navigate } from '../../app-router.js';
import { openCancelSubscriptionModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { checkAuthSession, currentUser, fetchAiTokenBalance, getApi, getBillingDetailsApi, updateAutoRenewalApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { BillingDetailsResponse } from '../../types/subscription.types.js';

async function createBillingView(): Promise<HTMLElement> {
  await checkAuthSession();
  const container = await loadTemplate('/views/settings/billing.html');
  translateElement(container);
  renderIcons(container);

  let resetCountdownTarget: Date | null = null;
  let resetCountdownIntervalId: number | null = null;
  let resetExpiryRefetchTimerId: number | null = null;
  let hasTriggeredExpiryRefetch = false;
  let isDestroyed = false;

  const clearCountdownTimers = () => {
    if (resetCountdownIntervalId !== null) {
      window.clearInterval(resetCountdownIntervalId);
      resetCountdownIntervalId = null;
    }
    if (resetExpiryRefetchTimerId !== null) {
      window.clearTimeout(resetExpiryRefetchTimerId);
      resetExpiryRefetchTimerId = null;
    }
  };

  const accordionHeaderSub = container.querySelector<HTMLElement>('[data-ref="accordion-header-subscription"]');
  const groupSub = container.querySelector<HTMLElement>('[data-ref="group-subscription-plan"]');
  accordionHeaderSub?.addEventListener('click', (e) => {
    e.preventDefault();
    groupSub?.classList.toggle('is-active');
  });

  const accordionHeaderUsage = container.querySelector<HTMLElement>('[data-ref="accordion-header-usage"]');
  const groupUsage = container.querySelector<HTMLElement>('[data-ref="group-resource-usage"]');
  accordionHeaderUsage?.addEventListener('click', (e) => {
    e.preventDefault();
    groupUsage?.classList.toggle('is-active');
  });

  const renderSubscriptionPlan = (info: BillingDetailsResponse) => {
    const planNameEl = container.querySelector<HTMLElement>('[data-ref="current-plan-name"]');
    const planStatusBadge = container.querySelector<HTMLElement>('[data-ref="current-plan-status-badge"]');
    const planDescEl = container.querySelector<HTMLElement>('[data-ref="current-plan-desc"]');
    const btnUpgrade = container.querySelector<HTMLElement>('[data-ref="btn-upgrade-plan"]');
    const itemCancelSub = container.querySelector<HTMLElement>('[data-ref="item-cancel-subscription"]');
    const dividerCancelSub = container.querySelector<HTMLElement>('[data-ref="divider-cancel-sub"]');
    const cancelTitleEl = container.querySelector<HTMLElement>('[data-ref="item-cancel-subscription-title"]');
    const cancelDescEl = container.querySelector<HTMLElement>('[data-ref="item-cancel-subscription-desc"]');
    const btnToggleSub = container.querySelector<HTMLElement>('[data-ref="btn-toggle-subscription"]');
    const iconCancelSubUse = container.querySelector<SVGUseElement>('[data-ref="icon-cancel-sub"] use');

    const hasActiveSub = Boolean(
      (info.hasSubscription || (info.tier && info.tier !== 'free')) &&
      info.tier &&
      info.tier !== 'free'
    );

    if (hasActiveSub) {
      const tierFormatted = info.tier!.charAt(0).toUpperCase() + info.tier!.slice(1);
      const isOneTime = Boolean(
        info.is_one_time ||
        info.billing_period?.includes('one_time') ||
        !info.stripe_subscription_id
      );

      let billingLabel = '';
      if (isOneTime) {
        if (info.billing_period === 'one_time_yearly') {
          billingLabel = t('settings.billing.billing_one_time_yearly');
        } else if (info.billing_period === 'one_time_monthly') {
          billingLabel = t('settings.billing.billing_one_time_monthly');
        } else {
          billingLabel = t('settings.billing.billing_one_time');
        }
      } else if (info.interval === 'year' || info.billing_period === 'yearly') {
        billingLabel = t('pricing.billing_yearly');
      } else {
        billingLabel = t('pricing.billing_monthly');
      }

      if (planNameEl) planNameEl.textContent = `BoardPDF ${tierFormatted} (${billingLabel})`;

      let dateFormatted = '';
      if (info.current_period_end) {
        try {
          const d = new Date(info.current_period_end);
          dateFormatted = d.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        } catch {}
      }

      if (planStatusBadge) {
        planStatusBadge.classList.remove('is-hidden');
        if (info.cancel_at_period_end) {
          planStatusBadge.className = 'component-badge component-badge--sm component-badge--warning';
          planStatusBadge.textContent = t('settings.billing.status_cancel_scheduled');
        } else {
          planStatusBadge.className = 'component-badge component-badge--sm component-badge--success';
          planStatusBadge.textContent = t('settings.billing.status_active');
        }
      }

      if (planDescEl) {
        const amountVal = info.amount || 0;
        const amountText = amountVal > 0 ? `USD $${amountVal.toFixed(2)} - ` : '';

        if (isOneTime) {
          if (dateFormatted) {
            planDescEl.textContent = t('settings.billing.plan_desc_one_time_date', {
              amount: amountText,
              date: dateFormatted,
            });
          } else {
            planDescEl.textContent = t('settings.billing.plan_desc_one_time', {
              amount: amountText,
            });
          }
        } else if (info.cancel_at_period_end) {
          planDescEl.textContent = t('settings.billing.plan_desc_scheduled', { date: dateFormatted });
        } else {
          planDescEl.textContent = t('settings.billing.plan_desc_active', {
            amount: amountText,
            date: dateFormatted,
          });
        }
      }

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_change_plan');
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/pricing');
        };
      }

      if (isOneTime) {
        itemCancelSub?.classList.add('is-hidden');
        dividerCancelSub?.classList.add('is-hidden');
      } else {
        itemCancelSub?.classList.remove('is-hidden');
        dividerCancelSub?.classList.remove('is-hidden');

        if (btnToggleSub && cancelTitleEl && cancelDescEl) {
          if (info.cancel_at_period_end) {
            iconCancelSubUse?.setAttribute('href', '/icons.svg#autorenew');
            cancelTitleEl.textContent = t('settings.billing.reactivate_sub_title');
            cancelDescEl.textContent = t('settings.billing.reactivate_sub_desc', { date: dateFormatted });
            btnToggleSub.textContent = t('settings.billing.btn_reactivate_sub');
            btnToggleSub.className = 'component-button component-button--h34 component-button--black';
            btnToggleSub.onclick = (e) => {
              e.preventDefault();
              handleToggleSubscription(false);
            };
          } else {
            iconCancelSubUse?.setAttribute('href', '/icons.svg#close');
            cancelTitleEl.textContent = t('settings.billing.cancel_sub_title');
            cancelDescEl.textContent = t('settings.billing.cancel_sub_desc');
            btnToggleSub.textContent = t('settings.billing.btn_cancel_subscription');
            btnToggleSub.className = 'component-button component-button--h34';
            btnToggleSub.onclick = (e) => {
              e.preventDefault();
              handleToggleSubscription(true, dateFormatted);
            };
          }
        }
      }
    } else {
      if (planNameEl) planNameEl.textContent = t('settings.billing.free_plan_title');
      if (planStatusBadge) planStatusBadge.classList.add('is-hidden');
      if (planDescEl) planDescEl.textContent = t('settings.billing.free_plan_desc');

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_explore_plans');
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/pricing');
        };
      }

      itemCancelSub?.classList.add('is-hidden');
      dividerCancelSub?.classList.add('is-hidden');
    }
  };

  const loadBillingData = async () => {
    try {
      const res = await getBillingDetailsApi();
      if (res && res.success && res.tier && res.tier !== 'free') {
        renderSubscriptionPlan(res);
      } else if (currentUser?.subscription_tier && currentUser.subscription_tier !== 'free') {
        renderSubscriptionPlan({
          billing_period: 'one_time_monthly',
          hasSubscription: true,
          is_one_time: true,
          status: 'active',
          success: true,
          tier: currentUser.subscription_tier,
        });
      } else if (res && res.success) {
        renderSubscriptionPlan(res);
      } else {
        renderSubscriptionPlan({ hasSubscription: false, success: false, tier: 'free' });
      }
    } catch {
      if (currentUser?.subscription_tier && currentUser.subscription_tier !== 'free') {
        renderSubscriptionPlan({
          billing_period: 'one_time_monthly',
          hasSubscription: true,
          is_one_time: true,
          status: 'active',
          success: true,
          tier: currentUser.subscription_tier,
        });
      } else {
        renderSubscriptionPlan({ hasSubscription: false, success: false, tier: 'free' });
      }
    }
  };

  const handleToggleSubscription = (cancelAtPeriodEnd: boolean, dateFormatted = '') => {
    if (cancelAtPeriodEnd) {
      openCancelSubscriptionModal({
        dateFormatted,
        onConfirm: async (inst: any) => {
          inst.setConfirmLoading(true);
          try {
            const res = await updateAutoRenewalApi(true);
            if (res.success) {
              inst.close();
              showToast(t('settings.billing.toast_subscription_cancelled'), 'info');
              await loadBillingData();
            } else {
              inst.setConfirmLoading(false);
              showToast(res.error || t('common.error_occurred'), 'danger');
            }
          } catch {
            inst.setConfirmLoading(false);
            showToast(t('common.error_occurred'), 'danger');
          }
        },
      });
    } else {
      (async () => {
        try {
          const res = await updateAutoRenewalApi(false);
          if (res.success) {
            showToast(t('settings.billing.toast_subscription_reactivated'), 'success');
            await loadBillingData();
          } else {
            showToast(res.error || t('common.error_occurred'), 'danger');
          }
        } catch {
          showToast(t('common.error_occurred'), 'danger');
        }
      })();
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0.0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderStorageValues = (used: number, limit: number) => {
    const textUsed = container.querySelector<HTMLElement>('[data-ref="storage-text-used"]');
    const badgePercent = container.querySelector<HTMLElement>('[data-ref="storage-badge-percent"]');
    const barFill = container.querySelector<HTMLElement>('[data-ref="storage-bar-fill"]');
    const textAvailable = container.querySelector<HTMLElement>('[data-ref="storage-available-text"]');

    if (!textUsed || !barFill) return;

    const pct = Math.min(100, Math.round((used / limit) * 1000) / 10);
    const avail = Math.max(0, limit - used);

    textUsed.textContent = t('settings.billing.storage_used_format', {
      limit: formatBytes(limit),
      used: formatBytes(used),
    });

    if (badgePercent) {
      badgePercent.textContent = `${pct}%`;
      if (pct >= 90) {
        badgePercent.className = 'component-badge component-badge--danger component-text--sm';
      } else if (pct >= 75) {
        badgePercent.className = 'component-badge component-badge--warning component-text--sm';
      } else {
        badgePercent.className = 'component-badge component-badge--neutral component-text--sm';
      }
    }

    barFill.style.setProperty('--progress-pct', `${Math.min(100, pct)}%`);
    barFill.classList.remove('component-progress__bar--danger', 'component-progress__bar--warning', 'component-progress__bar--primary');
    if (pct >= 90) {
      barFill.classList.add('component-progress__bar--danger');
    } else if (pct >= 75) {
      barFill.classList.add('component-progress__bar--warning');
    } else {
      barFill.classList.add('component-progress__bar--primary');
    }

    if (textAvailable) {
      textAvailable.textContent = t('settings.billing.storage_available_format', {
        available: formatBytes(avail),
      });
    }
  };

  const renderStorageSection = async () => {
    try {
      const res = await getApi(API_ROUTES.settings.storage);
      if (res.ok) {
        const data = await res.json();
        const used = Number(data.usedBytes) || 0;
        const limit = Number(data.limitBytes) || 5368709120;
        renderStorageValues(used, limit);
        return;
      }
    } catch {}

    const used = Number(currentUser?.storage_used_bytes) || 0;
    const limit = Number(currentUser?.storage_limit_bytes) || 5368709120;
    renderStorageValues(used, limit);
  };

  const updateResetCountdown = () => {
    const resetDateText = container.querySelector<HTMLElement>('[data-ref="tokens-reset-date-text"]');
    if (!resetDateText) return;

    if (!resetCountdownTarget || Number.isNaN(resetCountdownTarget.getTime())) {
      resetDateText.textContent = t('settings.billing.tokens_reset_monthly');
      return;
    }

    const diffMs = resetCountdownTarget.getTime() - Date.now();
    if (diffMs <= 0) {
      resetDateText.textContent = t('settings.billing.tokens_reset_soon');
      if (!hasTriggeredExpiryRefetch && !isDestroyed) {
        hasTriggeredExpiryRefetch = true;
        resetExpiryRefetchTimerId = window.setTimeout(() => {
          if (!isDestroyed) {
            void renderAiTokensSection();
          }
        }, 3000);
      }
      return;
    }

    const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const minutes = Math.max(1, Math.floor((diffMs % 3600000) / 60000));

    let dateFormatted = '';
    try {
      dateFormatted = resetCountdownTarget.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {}

    if (days >= 2) {
      resetDateText.textContent = t('settings.billing.tokens_reset_in_days', {
        date: dateFormatted,
        days: String(days),
        hours: String(hours),
      });
    } else if (days === 1) {
      resetDateText.textContent = t('settings.billing.tokens_reset_in_days_singular', {
        date: dateFormatted,
        hours: String(hours),
      });
    } else if (hours >= 1) {
      resetDateText.textContent = t('settings.billing.tokens_reset_in_hours', {
        hours: String(hours),
        minutes: String(minutes),
      });
    } else {
      resetDateText.textContent = t('settings.billing.tokens_reset_in_minutes', {
        minutes: String(totalMinutes),
      });
    }
  };

  const renderAiTokensSection = async () => {
    const textBalance = container.querySelector<HTMLElement>('[data-ref="tokens-text-balance"]');
    const badgePercent = container.querySelector<HTMLElement>('[data-ref="tokens-badge-percent"]');
    const barFill = container.querySelector<HTMLElement>('[data-ref="tokens-bar-fill"]');

    if (!textBalance || !barFill) return;

    let balance = currentUser?.ai_tokens_balance ?? 100;
    let limit = 100;
    if (currentUser?.subscription_tier === 'pro') limit = 2000;
    else if (currentUser?.subscription_tier === 'business') limit = 5000;

    clearCountdownTimers();
    resetCountdownTarget = null;

    const tokenData = await fetchAiTokenBalance();
    if (tokenData) {
      balance = tokenData.balance;
      limit = tokenData.limit || limit;
      if (tokenData.resetAt) {
        const parsed = new Date(tokenData.resetAt);
        if (!Number.isNaN(parsed.getTime())) {
          resetCountdownTarget = parsed;
          if (parsed.getTime() > Date.now()) {
            hasTriggeredExpiryRefetch = false;
          }
        }
      }
    }

    const pct = Math.min(100, Math.max(0, Math.round((balance / limit) * 100)));
    textBalance.textContent = t('settings.billing.tokens_balance_format', {
      balance: balance.toLocaleString(),
      limit: limit.toLocaleString(),
    });

    if (badgePercent) {
      badgePercent.textContent = `${pct}%`;
      if (pct <= 10) {
        badgePercent.className = 'component-badge component-badge--danger component-text--sm';
      } else if (pct <= 25) {
        badgePercent.className = 'component-badge component-badge--warning component-text--sm';
      } else {
        badgePercent.className = 'component-badge component-badge--neutral component-text--sm';
      }
    }

    barFill.style.setProperty('--progress-pct', `${pct}%`);
    barFill.classList.remove('component-progress__bar--danger', 'component-progress__bar--warning', 'component-progress__bar--primary');
    if (pct <= 10) {
      barFill.classList.add('component-progress__bar--danger');
    } else if (pct <= 25) {
      barFill.classList.add('component-progress__bar--warning');
    } else {
      barFill.classList.add('component-progress__bar--primary');
    }

    updateResetCountdown();
    if (resetCountdownTarget && !isDestroyed) {
      resetCountdownIntervalId = window.setInterval(updateResetCountdown, 15000);
    }
  };

  await Promise.all([
    loadBillingData(),
    renderAiTokensSection(),
    renderStorageSection(),
  ]);

  const onSubscriptionUpdated = () => {
    void loadBillingData();
    void renderAiTokensSection();
    void renderStorageSection();
  };
  window.addEventListener('subscription-updated', onSubscriptionUpdated);

  (container as any).__controller = {
    destroy: () => {
      isDestroyed = true;
      clearCountdownTimers();
      window.removeEventListener('subscription-updated', onSubscriptionUpdated);
    },
  };

  return container;
}

export { createBillingView };
