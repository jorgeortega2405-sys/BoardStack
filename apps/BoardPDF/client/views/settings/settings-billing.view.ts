import { navigate } from '../../app-router.js';
import { openModal } from '../../components/modal.component.js';
import { cancelSubscriptionImmediateApi, checkAuthSession, getBillingDetailsApi, updateAutoRenewalApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { BillingDetailsResponse } from '../../types/subscription.types.js';

export async function createBillingView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/billing.html');
  translateElement(container);
  renderIcons(container);

  const accordionHeaderSub = container.querySelector<HTMLElement>('[data-ref="accordion-header-subscription"]');
  const groupSub = container.querySelector<HTMLElement>('[data-ref="group-subscription-plan"]');
  accordionHeaderSub?.addEventListener('click', (e) => {
    e.preventDefault();
    groupSub?.classList.toggle('is-active');
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

    const hasActiveSub = Boolean(info.hasSubscription && info.tier && info.tier !== 'free');

    if (hasActiveSub) {
      const tierFormatted = info.tier!.charAt(0).toUpperCase() + info.tier!.slice(1);
      const intervalText = info.interval === 'year'
        ? t('pricing.billing_yearly') || 'Anual'
        : t('pricing.billing_monthly') || 'Mensual';
      if (planNameEl) planNameEl.textContent = `BoardPDF ${tierFormatted} (${intervalText})`;

      let dateFormatted = '';
      if (info.current_period_end) {
        try {
          const d = new Date(info.current_period_end);
          dateFormatted = d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
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
        if (info.cancel_at_period_end) {
          planDescEl.textContent = (t('settings.billing.plan_desc_scheduled') || 'Tu plan expirará el {date}. Conservas todos tus beneficios hasta esa fecha.').replace('{date}', dateFormatted);
        } else {
          const amountVal = info.amount || 0;
          const amountText = amountVal > 0 ? `USD $${amountVal.toFixed(2)} - ` : '';
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

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'flex';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'block';
      if (itemCancelSub) itemCancelSub.style.display = 'flex';
      if (dividerCancelSub) dividerCancelSub.style.display = 'block';

      if (btnToggleRenewal && autoRenewalDesc) {
        if (info.cancel_at_period_end) {
          autoRenewalDesc.textContent = t('settings.billing.auto_renewal_paused_desc') || 'La renovación automática está cancelada. Tu suscripción no se cobrará nuevamente.';
          btnToggleRenewal.textContent = t('settings.billing.btn_reactivate_renewal') || 'Reactivar renovación';
          btnToggleRenewal.className = 'component-button component-button--h34 component-button--black';
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
      if (res && res.success) {
        renderSubscriptionPlan(res);
      } else {
        renderSubscriptionPlan({ hasSubscription: false, success: false, tier: 'free' });
      }
    } catch {
      renderSubscriptionPlan({ hasSubscription: false, success: false, tier: 'free' });
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

  await loadBillingData();

  const onSubscriptionUpdated = () => {
    void loadBillingData();
  };
  window.addEventListener('subscription-updated', onSubscriptionUpdated);

  (container as any).__controller = {
    destroy: () => {
      window.removeEventListener('subscription-updated', onSubscriptionUpdated);
    },
  };

  return container;
}
