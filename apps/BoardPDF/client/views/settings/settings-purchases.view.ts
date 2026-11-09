import { downloadInvoiceApi, escapeHtml, getPurchaseHistoryApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { showToast } from '../../services/toast.service.js';
import { PurchaseRecord } from '../../types/subscription.types.js';
import { removeEmptyState, renderEmptyState, withButtonLoading } from '../../utils/dom.util.js';

async function createPurchasesView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/purchases.html');
  translateElement(container);
  renderIcons(container);

  const tbody = container.querySelector<HTMLElement>('[data-ref="purchases-tbody"]');
  const tableEl = container.querySelector<HTMLElement>('[data-ref="purchases-table"]');
  const tableWrapper = container.querySelector<HTMLElement>('[data-ref="purchases-table-wrapper"]');
  const searchInput = container.querySelector<HTMLInputElement>('[data-ref="purchases-search-input"]');
  const btnClearSearch = container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');
  const btnToggleSearch = container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-search"]');
  const searchToolbar = container.querySelector<HTMLElement>('[data-ref="purchases-search-toolbar"]');
  const btnActionDownloadInvoice = container.querySelector<HTMLButtonElement>('[data-ref="btn-action-download-invoice"]');

  let allPurchases: PurchaseRecord[] = [];
  let currentlyDisplayedPurchases: PurchaseRecord[] = [];
  let selectedPurchaseId: number | string | null = null;

  const updateSelectionState = () => {
    if (selectedPurchaseId) {
      btnActionDownloadInvoice?.classList.remove('is-hidden');
    } else {
      btnActionDownloadInvoice?.classList.add('is-hidden');
    }
  };

  btnToggleSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!searchToolbar) return;
    const isClosed = searchToolbar.classList.contains('is-hidden');
    searchToolbar.classList.toggle('is-hidden', !isClosed);
    if (isClosed && searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  const hideSearchToolbar = () => {
    if (!searchToolbar) return;
    searchToolbar.classList.add('is-hidden');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      btnClearSearch?.classList.add('is-hidden');
      renderRows(allPurchases);
    }
  };

  container.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && searchToolbar && !searchToolbar.classList.contains('is-hidden')) {
      hideSearchToolbar();
    }
  });

  btnActionDownloadInvoice?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedPurchaseId) return;

    await withButtonLoading(btnActionDownloadInvoice, async () => {
      const res = await downloadInvoiceApi(selectedPurchaseId!);
      if (res.success && res.blob) {
        const url = window.URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.className = 'is-hidden';
        a.href = url;
        a.download = res.filename || `Factura-BoardPDF-${selectedPurchaseId}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        showToast(t('settings.purchases.invoice_download_success') || 'Factura descargada correctamente.', 'success');
      } else {
        showToast(res.error || t('common.error_occurred') || t('ui.error_al_descargar_la_factura'), 'danger');
      }
    });
  });

  btnClearSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) {
      searchInput.value = '';
      btnClearSearch.classList.add('is-hidden');
      renderRows(allPurchases);
      searchInput.focus();
    }
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (btnClearSearch) {
      btnClearSearch.classList.toggle('is-hidden', query.length === 0);
    }

    if (!query) {
      renderRows(allPurchases);
      return;
    }

    const filtered = allPurchases.filter((p) => {
      const planName = (p.plan_id || '').toLowerCase();
      const periodName = (p.billing_period || '').toLowerCase();
      const status = (p.status || '').toLowerCase();
      const amount = String(p.amount_total || '');
      const refId = String(
        p.stripe_subscription_id ||
        p.stripe_payment_intent_id ||
        p.stripe_session_id ||
        p.id ||
        ''
      ).toLowerCase();

      return (
        planName.includes(query) ||
        periodName.includes(query) ||
        status.includes(query) ||
        amount.includes(query) ||
        refId.includes(query)
      );
    });

    renderRows(filtered, true);
  });

  const renderRows = (purchases: PurchaseRecord[], isSearchResult = false) => {
    currentlyDisplayedPurchases = purchases;
    if (!tbody) return;

    if (purchases.length === 0) {
      tableEl?.classList.add('is-hidden');
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'purchases-empty-state',
          desc: isSearchResult
            ? t('settings.purchases.search_no_results') || t('ui.no_se_encontraron_compras_que_coincidan_')
            : t('settings.purchases.empty_desc') || t('ui.aun_no_has_realizado_ninguna_compra_o_su'),
          graphicType: isSearchResult ? 'search' : 'subscriptions',
          isTable: true,
          title: isSearchResult
            ? t('common.no_results') || 'Sin resultados'
            : t('settings.purchases.empty_title') || 'No hay compras registradas',
        });
      }
      selectedPurchaseId = null;
      updateSelectionState();
      return;
    }

    tableEl?.classList.remove('is-hidden');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'purchases-empty-state');
    }

    tbody.innerHTML = '';
    purchases.forEach((p) => {
      const isSelected = selectedPurchaseId === p.id;
      const row = document.createElement('tr');
      row.className = `component-table__row component-cursor-pointer${isSelected ? ' is-selected' : ''}`;
      row.setAttribute('data-ref', `purchase-row-${p.id}`);

      const planName = (p.plan_id || 'Pro').toUpperCase();
      const bp = String(p.billing_period || '');
      let periodName = 'Mensual';
      if (bp === 'one_time_monthly') {
        periodName = t('settings.purchases.period_one_time_monthly') || 'Pago único (1 mes)';
      } else if (bp === 'one_time_yearly') {
        periodName = t('settings.purchases.period_one_time_yearly') || 'Pago único (1 año)';
      } else if (bp === 'yearly') {
        periodName = t('pricing.billing_yearly') || 'Anual';
      } else if (bp === 'one_time') {
        periodName = t('settings.purchases.period_one_time') || 'Pago único';
      } else {
        periodName = t('pricing.billing_monthly') || 'Mensual';
      }

      const amount = Number(p.amount_total || 0).toFixed(2);
      const currency = (p.currency || 'USD').toUpperCase();

      let dateFormatted = '—';
      if (p.created_at) {
        try {
          const d = new Date(p.created_at);
          dateFormatted = d.toLocaleDateString(undefined, {
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        } catch (_) {}
      }

      const statusKey = `settings.purchases.status_${p.status}`;
      const statusTrans = t(statusKey);
      const statusMap: Record<string, string> = {
        active: 'Activo',
        cancelled: 'Cancelado',
        completed: 'Completado',
        failed: 'Fallido',
        pending: 'Pendiente',
        refunded: 'Reembolsado',
      };
      const statusText = statusTrans !== statusKey ? statusTrans : (statusMap[p.status || ''] || p.status || '');

      const refId = String(
        p.stripe_subscription_id ||
        p.stripe_payment_intent_id ||
        p.stripe_session_id ||
        `#${p.id}`
      );
      const shortRef = refId.length > 20 ? `${refId.slice(0, 10)}...${refId.slice(-6)}` : refId;

      row.innerHTML = `
        <td class="component-table__cell component-table__cell--pl20" data-ref="cell-plan-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-plan-${p.id}">BoardPDF ${escapeHtml(planName)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-period-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-period-${p.id}">${escapeHtml(periodName)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-amount-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-amount-${p.id}">$${escapeHtml(amount)} ${escapeHtml(currency)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-status-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-status-${p.id}">${escapeHtml(statusText || '')}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-date-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-date-${p.id}">${escapeHtml(dateFormatted)}</span>
        </td>
        <td class="component-table__cell component-table__cell--pr20" data-ref="cell-ref-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-ref-${p.id}" data-tooltip="${escapeHtml(refId)}">${escapeHtml(shortRef)}</span>
        </td>
      `;

      row.addEventListener('click', () => {
        if (p.id !== undefined && selectedPurchaseId === p.id) {
          selectedPurchaseId = null;
        } else {
          selectedPurchaseId = p.id ?? null;
        }
        renderRows(currentlyDisplayedPurchases, isSearchResult);
      });

      tbody.appendChild(row);
    });

    updateSelectionState();
    renderIcons(tbody);
  };

  const loadPurchases = async () => {
    try {
      const res = await getPurchaseHistoryApi();
      allPurchases = res.purchases || [];
      renderRows(allPurchases);
    } catch (_) {
      allPurchases = [];
      renderRows([]);
    }
  };

  await loadPurchases();

  return container;
}

export { createPurchasesView };
