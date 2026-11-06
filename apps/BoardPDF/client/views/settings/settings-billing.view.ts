import { navigate } from '../../app-router.js';
import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { cancelSubscriptionImmediateApi, checkAuthSession, currentUser, fetchAiTokenBalance, getApi, getBillingDetailsApi, updateAutoRenewalApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { BillingDetailsResponse } from '../../types/subscription.types.js';

export async function createBillingView(): Promise<HTMLElement> {
  await checkAuthSession();
  const container = await loadTemplate('/views/settings/billing.html');
  translateElement(container);
  renderIcons(container);

  const accordionHeaderSub = container.querySelector<HTMLElement>('[data-ref="accordion-header-subscription"]');
  const groupSub = container.querySelector<HTMLElement>('[data-ref="group-subscription-plan"]');
  accordionHeaderSub?.addEventListener('click', (e) => {
    e.preventDefault();
    groupSub?.classList.toggle('is-active');
  });

  const accordionHeaderTokens = container.querySelector<HTMLElement>('[data-ref="accordion-header-tokens"]');
  const groupTokens = container.querySelector<HTMLElement>('[data-ref="group-ai-tokens"]');
  accordionHeaderTokens?.addEventListener('click', (e) => {
    e.preventDefault();
    groupTokens?.classList.toggle('is-active');
  });

  const accordionHeaderStorage = container.querySelector<HTMLElement>('[data-ref="accordion-header-storage"]');
  const groupStorage = container.querySelector<HTMLElement>('[data-ref="group-storage"]');
  accordionHeaderStorage?.addEventListener('click', (e) => {
    e.preventDefault();
    groupStorage?.classList.toggle('is-active');
  });

  const renderSubscriptionPlan = (info: BillingDetailsResponse) => {
    const planNameEl = container.querySelector<HTMLElement>('[data-ref="current-plan-name"]');
    const planStatusBadge = container.querySelector<HTMLElement>('[data-ref="current-plan-status-badge"]');
    const planDescEl = container.querySelector<HTMLElement>('[data-ref="current-plan-desc"]');
    const btnUpgrade = container.querySelector<HTMLElement>('[data-ref="btn-upgrade-plan"]');
    const itemAutoRenewal = container.querySelector<HTMLElement>('[data-ref="item-auto-renewal"]');
    const dividerAutoRenewal = container.querySelector<HTMLElement>('[data-ref="divider-auto-renewal"]');
    const autoRenewalDesc = container.querySelector<HTMLElement>('[data-ref="auto-renewal-desc"]');
    const btnToggleRenewal = container.querySelector<HTMLElement>('[data-ref="btn-toggle-auto-renewal"]');
    const itemCancelSub = container.querySelector<HTMLElement>('[data-ref="item-cancel-subscription"]');
    const dividerCancelSub = container.querySelector<HTMLElement>('[data-ref="divider-cancel-sub"]');

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
          billingLabel = 'Pago único (1 año)';
        } else if (info.billing_period === 'one_time_monthly') {
          billingLabel = 'Pago único (1 mes)';
        } else {
          billingLabel = 'Pago único';
        }
      } else {
        if (info.interval === 'year' || info.billing_period === 'yearly') {
          billingLabel = t('pricing.billing_yearly') || 'Suscripción Anual';
        } else {
          billingLabel = t('pricing.billing_monthly') || 'Suscripción Mensual';
        }
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
        } catch (_) {}
      }

      if (planStatusBadge) {
        planStatusBadge.style.display = 'inline-flex';
        if (info.cancel_at_period_end) {
          planStatusBadge.className = 'component-badge component-badge--sm component-badge--warning';
          planStatusBadge.textContent = t('settings.billing.status_cancel_scheduled') || 'Cancelación programada';
        } else {
          planStatusBadge.className = 'component-badge component-badge--sm component-badge--success';
          planStatusBadge.textContent = t('settings.billing.status_active') || 'Activo';
        }
      }

      if (planDescEl) {
        const amountVal = info.amount || 0;
        const amountText = amountVal > 0 ? `USD $${amountVal.toFixed(2)} - ` : '';

        if (isOneTime) {
          if (dateFormatted) {
            planDescEl.textContent = `${amountText}Plan activo hasta el ${dateFormatted}. Al ser un pago único, no se realizarán cobros automáticos de renovación.`;
          } else {
            planDescEl.textContent = `${amountText}Plan activo mediante pago único. Sin cargos de renovación automática.`;
          }
        } else if (info.cancel_at_period_end) {
          planDescEl.textContent = (t('settings.billing.plan_desc_scheduled') || 'Tu plan expirará el {date}. Conservas todos tus beneficios hasta esa fecha.').replace('{date}', dateFormatted);
        } else {
          planDescEl.textContent = (t('settings.billing.plan_desc_active') || '{amount}Próximo cobro programado para el {date}.').replace('{amount}', amountText).replace('{date}', dateFormatted);
        }
      }

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_change_plan') || 'Cambiar de plan';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/pricing');
        };
      }

      if (isOneTime) {
        if (itemAutoRenewal) itemAutoRenewal.style.display = 'none';
        if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'none';
        if (itemCancelSub) itemCancelSub.style.display = 'none';
        if (dividerCancelSub) dividerCancelSub.style.display = 'none';
      } else {
        if (itemAutoRenewal) itemAutoRenewal.style.display = 'flex';
        if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'block';
        if (itemCancelSub) itemCancelSub.style.display = 'flex';
        if (dividerCancelSub) dividerCancelSub.style.display = 'block';

        if (btnToggleRenewal && autoRenewalDesc) {
          if (info.cancel_at_period_end) {
            autoRenewalDesc.textContent = t('settings.billing.auto_renewal_paused_desc') || 'La renovación automática está cancelada. Tu suscripción no se cobrará nuevamente.';
            btnToggleRenewal.textContent = t('settings.billing.btn_reactivate_renewal') || 'Reactivar renovación';
            btnToggleRenewal.className = 'component-button component-button--h34';
            btnToggleRenewal.onclick = (e) => {
              e.preventDefault();
              handleToggleAutoRenewal(false);
            };
          } else {
            autoRenewalDesc.textContent = (t('settings.billing.auto_renewal_active_desc') || 'Tu suscripción se renovará automáticamente el {date}.').replace('{date}', dateFormatted);
            btnToggleRenewal.textContent = t('settings.billing.btn_cancel_renewal') || 'Cancelar renovación';
            btnToggleRenewal.className = 'component-button component-button--h34';
            btnToggleRenewal.onclick = (e) => {
              e.preventDefault();
              handleToggleAutoRenewal(true, dateFormatted);
            };
          }
        }
      }
    } else {
      if (planNameEl) planNameEl.textContent = t('settings.billing.free_plan_title') || 'Plan Gratuito';
      if (planStatusBadge) planStatusBadge.style.display = 'none';
      if (planDescEl) planDescEl.textContent = t('settings.billing.free_plan_desc') || 'Actualmente disfrutas del plan básico gratuito de BoardPDF.';

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_explore_plans') || 'Explorar planes';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/pricing');
        };
      }

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'none';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'none';
      if (itemCancelSub) itemCancelSub.style.display = 'none';
      if (dividerCancelSub) dividerCancelSub.style.display = 'none';
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

  const handleToggleAutoRenewal = (cancelAtPeriodEnd: boolean, dateFormatted = '') => {
    if (cancelAtPeriodEnd) {
      openModal({
        confirmClass: 'component-button--black',
        confirmText: t('settings.billing.btn_confirm_cancel_renewal') || 'Confirmar cancelación',
        description: (t('settings.billing.modal_cancel_renewal_desc') || 'Tu suscripción no se renovará al concluir el ciclo actual. Mantendrás todas tus funciones premium hasta el {date}.').replace('{date}', dateFormatted),
        title: t('settings.billing.modal_cancel_renewal_title') || '¿Cancelar renovación automática?',
        onConfirm: async (inst) => {
          inst.setConfirmLoading(true);
          try {
            const res = await updateAutoRenewalApi(true);
            if (res.success) {
              inst.close();
              showToast(t('settings.billing.toast_renewal_paused') || 'Renovación automática cancelada.', 'info');
              await loadBillingData();
            } else {
              inst.setConfirmLoading(false);
              showToast(res.error || t('common.error_occurred') || 'Error al procesar la solicitud.', 'danger');
            }
          } catch {
            inst.setConfirmLoading(false);
            showToast(t('common.error_occurred') || 'Error al procesar la solicitud.', 'danger');
          }
        },
      });
    } else {
      (async () => {
        const res = await updateAutoRenewalApi(false);
        if (res.success) {
          showToast(t('settings.billing.toast_renewal_active') || 'Renovación automática reactivada.', 'success');
          await loadBillingData();
        } else {
          showToast(res.error || t('common.error_occurred') || 'Error al procesar la solicitud.', 'danger');
        }
      })();
    }
  };

  const btnCancelImmediate = container.querySelector<HTMLElement>('[data-ref="btn-cancel-subscription-immediate"]');
  btnCancelImmediate?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: t('settings.billing.btn_confirm_cancel_immediate') || 'Cancelar suscripción ahora',
      description: t('settings.billing.modal_cancel_immediate_desc') || 'Esta acción cancelará tu suscripción de inmediato. Volverás al plan gratuito en este momento.',
      title: t('settings.billing.modal_cancel_immediate_title') || '¿Cancelar tu suscripción ahora?',
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const res = await cancelSubscriptionImmediateApi();
          if (res.success) {
            await checkAuthSession();
            inst.close();
            showToast(t('settings.billing.toast_subscription_cancelled') || 'Tu suscripción ha sido cancelada exitosamente.', 'info');
            await loadBillingData();
          } else {
            inst.setConfirmLoading(false);
            showToast(res.error || t('common.error_occurred') || 'Error al procesar la solicitud.', 'danger');
          }
        } catch {
          inst.setConfirmLoading(false);
          showToast(t('common.error_occurred') || 'Error al procesar la solicitud.', 'danger');
        }
      },
    });
  });

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0.0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderStorageSection = async () => {
    const textUsed = container.querySelector<HTMLElement>('[data-ref="storage-text-used"]');
    const badgePercent = container.querySelector<HTMLElement>('[data-ref="storage-badge-percent"]');
    const barFill = container.querySelector<HTMLElement>('[data-ref="storage-bar-fill"]');
    const textAvailable = container.querySelector<HTMLElement>('[data-ref="storage-available-text"]');

    if (!textUsed || !barFill) return;

    try {
      const res = await getApi(API_ROUTES.settings.storage);
      if (res.ok) {
        const data = await res.json();
        const used = Number(data.usedBytes) || 0;
        const limit = Number(data.limitBytes) || 5368709120;
        const pct = Math.min(100, Math.round((used / limit) * 1000) / 10);
        const avail = Math.max(0, limit - used);

        textUsed.textContent = `${formatBytes(used)} de ${formatBytes(limit)} utilizados`;
        if (badgePercent) {
          badgePercent.textContent = `${pct}%`;
          if (pct >= 90) {
            badgePercent.className = 'component-badge component-badge--danger';
          } else if (pct >= 75) {
            badgePercent.className = 'component-badge component-badge--warning';
          } else {
            badgePercent.className = 'component-badge component-badge--neutral';
          }
        }
        barFill.style.width = `${Math.min(100, pct)}%`;
        if (pct >= 90) {
          barFill.style.backgroundColor = 'var(--danger, #ef4444)';
        } else if (pct >= 75) {
          barFill.style.backgroundColor = 'var(--warning, #f59e0b)';
        } else {
          barFill.style.backgroundColor = 'var(--primary, #0f172a)';
        }
        if (textAvailable) {
          textAvailable.textContent = `${formatBytes(avail)} disponibles`;
        }
      }
    } catch {
      const used = Number(currentUser?.storage_used_bytes) || 0;
      const limit = Number(currentUser?.storage_limit_bytes) || 5368709120;
      const pct = Math.min(100, Math.round((used / limit) * 1000) / 10);
      textUsed.textContent = `${formatBytes(used)} de ${formatBytes(limit)} utilizados`;
      barFill.style.width = `${pct}%`;
    }
  };

  const renderAiTokensSection = async () => {
    const tierBadge = container.querySelector<HTMLElement>('[data-ref="tokens-tier-badge"]');
    const textBalance = container.querySelector<HTMLElement>('[data-ref="tokens-text-balance"]');
    const badgePercent = container.querySelector<HTMLElement>('[data-ref="tokens-badge-percent"]');
    const barFill = container.querySelector<HTMLElement>('[data-ref="tokens-bar-fill"]');
    const resetDateText = container.querySelector<HTMLElement>('[data-ref="tokens-reset-date-text"]');

    if (!textBalance || !barFill) return;

    const tierName = (currentUser?.subscription_tier || 'free').toUpperCase();
    if (tierBadge) {
      tierBadge.textContent = `Plan ${tierName}`;
      if (tierName === 'PRO' || tierName === 'BUSINESS' || tierName === 'ENTERPRISE') {
        tierBadge.className = 'component-badge component-badge--success';
      }
    }

    let balance = currentUser?.ai_tokens_balance ?? 100;
    let limit = 100;
    if (currentUser?.subscription_tier === 'pro') limit = 2000;
    else if (currentUser?.subscription_tier === 'business') limit = 5000;
    else if (currentUser?.subscription_tier === 'enterprise') limit = 10000;

    let resetAtStr = '';
    const tokenData = await fetchAiTokenBalance();
    if (tokenData) {
      balance = tokenData.balance;
      limit = tokenData.limit || limit;
      if (tokenData.resetAt) {
        try {
          const d = new Date(tokenData.resetAt);
          resetAtStr = d.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        } catch (_) {}
      }
    }

    const pct = Math.min(100, Math.max(0, Math.round((balance / limit) * 100)));
    textBalance.textContent = `${balance.toLocaleString()} / ${limit.toLocaleString()} tokens disponibles`;
    if (badgePercent) {
      badgePercent.textContent = `${pct}%`;
      if (pct <= 10) {
        badgePercent.className = 'component-badge component-badge--danger';
      } else if (pct <= 25) {
        badgePercent.className = 'component-badge component-badge--warning';
      } else {
        badgePercent.className = 'component-badge component-badge--neutral';
      }
    }
    barFill.style.width = `${pct}%`;
    if (pct <= 10) {
      barFill.style.backgroundColor = 'var(--danger, #ef4444)';
    } else if (pct <= 25) {
      barFill.style.backgroundColor = 'var(--warning, #f59e0b)';
    } else {
      barFill.style.backgroundColor = 'var(--primary, #0f172a)';
    }

    if (resetDateText) {
      if (resetAtStr) {
        resetDateText.textContent = `Próximo reinicio: ${resetAtStr}`;
      } else {
        resetDateText.textContent = 'Próximo reinicio: Mensual';
      }
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
      window.removeEventListener('subscription-updated', onSubscriptionUpdated);
    },
  };

  return container;
}
