import { copyToClipboard, escapeHtml, removeEmptyState, renderEmptyState } from '../../utils/dom.util.js';
import { formatDate } from '../../utils/format.util.js';
import { getApi } from '../../services/api.service.js';
import { i18n } from '../../i18n/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { toast } from '../../services/toast.service.js';

interface InvoiceData {
  amount: string;
  billingPeriod?: string | null;
  billingType?: string | null;
  createdAt: string;
  currency: string;
  customerEmail: string;
  customerName: string;
  id: number | string;
  invoiceNumber: string;
  planId: string;
  receiptUrl: string | null;
  reference: string;
  status: string;
}

interface PurchaseRecord {
  amount_total?: number | string;
  billing_period?: string | null;
  billing_type?: string | null;
  created_at?: string;
  currency?: string;
  id?: number | string;
  plan_id?: string;
  status?: string;
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  stripe_subscription_id?: string | null;
}

function formatInvoiceDate(isoDate?: string): string {
  return formatDate(isoDate) || '—';
}

function getPeriodLabel(period?: string | null): string {
  const bp = String(period || '');
  if (bp === 'one_time_monthly') {
    return i18n.t('settings.billing.period_1_month');
  } else if (bp === 'one_time_yearly') {
    return i18n.t('settings.billing.period_12_months');
  } else if (bp === 'yearly') {
    return i18n.t('settings.billing.period_yearly');
  } else if (bp === 'one_time') {
    return i18n.t('settings.billing.renewal_fixed');
  }
  return i18n.t('settings.billing.period_monthly');
}

function getPlanLabel(planId?: string | null): string {
  const raw = (planId || 'pro').toLowerCase();
  return raw === 'free' ? i18n.t('settings.billing.free_plan_name') : `BoardStack ${raw.toUpperCase()}`;
}

function openInvoicePrintWindow(invoice: InvoiceData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error(i18n.t('settings.purchases.invoice_popup_blocked'));
    return;
  }

  const planName = getPlanLabel(invoice.planId);
  const periodName = getPeriodLabel(invoice.billingPeriod);
  const dateFormatted = formatInvoiceDate(invoice.createdAt);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(invoice.invoiceNumber)} - BoardStack</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background-color: #f9fafb;
      padding: 40px 20px;
    }
    .invoice-toolbar {
      max-width: 760px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-primary { background: #000000; color: #ffffff; border: 1px solid #000000; }
    .btn-primary:hover { background: #262626; }
    .btn-secondary { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }
    .btn-secondary:hover { background: #f3f4f6; }
    .invoice-wrapper {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand-title { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .brand-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-num { font-size: 20px; font-weight: 700; color: #111827; }
    .invoice-date { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
    .col-title { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 8px; }
    .col-text { font-size: 14px; line-height: 1.5; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .table th { text-align: left; padding: 12px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    .table th.text-right { text-align: right; }
    .table td { padding: 16px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
    .table td.text-right { text-align: right; font-weight: 600; }
    .table-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #4b5563; }
    .totals-row.grand-total { border-top: 2px solid #111827; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; color: #111827; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-toolbar { display: none !important; }
      .invoice-wrapper { border: none !important; box-shadow: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
      @page { margin: 15mm; size: auto; }
    }
  </style>
</head>
<body>
  <div class="invoice-toolbar">
    ${invoice.receiptUrl ? `<a href="${escapeHtml(invoice.receiptUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">${escapeHtml(i18n.t('settings.purchases.invoice_view_receipt'))}</a>` : ''}
    <button type="button" class="btn btn-primary" onclick="window.print()">${escapeHtml(i18n.t('settings.purchases.invoice_print'))}</button>
    <button type="button" class="btn btn-secondary" onclick="window.close()">${escapeHtml(i18n.t('settings.purchases.invoice_close'))}</button>
  </div>
  <div class="invoice-wrapper">
    <div class="header">
      <div>
        <div class="brand-title">BoardStack</div>
        <div class="brand-sub">boardstack.local</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-num">${escapeHtml(invoice.invoiceNumber)}</div>
        <div class="invoice-date">${escapeHtml(i18n.t('settings.purchases.invoice_date'))}: ${escapeHtml(dateFormatted)}</div>
        <div class="badge">${escapeHtml(i18n.t('settings.purchases.invoice_status_paid'))}</div>
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="col-title">${escapeHtml(i18n.t('settings.purchases.invoice_issuer'))}</div>
        <div class="col-text"><strong>BoardStack Inc.</strong><br>billing@boardstack.local</div>
      </div>
      <div>
        <div class="col-title">${escapeHtml(i18n.t('settings.purchases.billed_to'))}</div>
        <div class="col-text"><strong>${escapeHtml(invoice.customerName)}</strong><br>${escapeHtml(invoice.customerEmail)}</div>
      </div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>${escapeHtml(i18n.t('settings.purchases.invoice_description'))}</th>
          <th class="text-right">${escapeHtml(i18n.t('settings.purchases.col_amount'))}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${escapeHtml(planName)}</strong>
            <div class="table-sub">${escapeHtml(periodName)} &bull; ${escapeHtml(i18n.t('settings.purchases.invoice_payment_method'))}: ${escapeHtml(i18n.t('settings.purchases.invoice_payment_method_stripe'))} (${escapeHtml(invoice.reference)})</div>
          </td>
          <td class="text-right">$${escapeHtml(invoice.amount)} ${escapeHtml(invoice.currency)}</td>
        </tr>
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-row">
        <span>${escapeHtml(i18n.t('settings.purchases.invoice_subtotal'))}</span>
        <span>$${escapeHtml(invoice.amount)} ${escapeHtml(invoice.currency)}</span>
      </div>
      <div class="totals-row">
        <span>${escapeHtml(i18n.t('settings.purchases.invoice_tax'))}</span>
        <span>$0.00 ${escapeHtml(invoice.currency)}</span>
      </div>
      <div class="totals-row grand-total">
        <span>${escapeHtml(i18n.t('settings.purchases.invoice_total'))}</span>
        <span>$${escapeHtml(invoice.amount)} ${escapeHtml(invoice.currency)}</span>
      </div>
    </div>
    <div class="footer">
      BoardStack &bull; Gracias por tu preferencia.
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

async function createSettingsPurchasesView(navigate: (path: string) => void): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'component-layout--split-full';
  container.setAttribute('data-ref', 'settings-purchases-layout');

  container.innerHTML = `
    <div class="component-top" data-ref="purchases-top">
      <div class="component-top__left" data-ref="purchases-top-left">
        <div class="component-top__title-box" data-ref="purchases-title-heading">
          <span class="component-top__title-text" data-ref="purchases-title">${i18n.t('settings.purchases.title')}</span>
          <span class="component-badge component-badge--sm is-hidden" data-ref="purchases-selected-badge"></span>
        </div>
      </div>
      <div class="component-top__right" data-ref="purchases-header-actions">
        <div class="component-group component-group--actions is-hidden" data-ref="purchases-selection-actions">
          <button type="button" class="component-button component-button--h40 component-button--black component-button--icon-only" data-ref="btn-download-invoice" data-tooltip="${i18n.t('settings.purchases.download_invoice')}" aria-label="${i18n.t('settings.purchases.download_invoice')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h40 component-button--secondary component-button--icon-only" data-ref="btn-copy-reference" data-tooltip="${i18n.t('settings.purchases.copy_reference')}" aria-label="${i18n.t('settings.purchases.copy_reference')}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
          </button>
        </div>
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-toggle-search" data-tooltip="${i18n.t('common.search')}" aria-label="${i18n.t('common.search')}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--full" data-ref="purchases-bottom">
      <div class="component-floating-search is-hidden" data-ref="purchases-search-toolbar">
        <div class="component-floating-search__inner" data-ref="purchases-search-inner">
          <div class="component-search component-search--floating" data-ref="search-box">
            <div class="component-search__icon" data-ref="search-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            </div>
            <div class="component-search__input-box" data-ref="search-input-box">
              <input class="component-search__input" data-ref="purchases-search-input" type="text" placeholder="${i18n.t('settings.purchases.search_placeholder')}" maxlength="100" autocomplete="off" />
            </div>
            <button type="button" class="component-button component-button--h34 component-button--icon-only is-hidden" data-ref="btn-clear-search" aria-label="${i18n.t('common.clear_search')}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="component-table-wrapper component-table-wrapper--flush" data-ref="purchases-table-wrapper">
        <table class="component-table component-table--flush" data-ref="purchases-table">
          <thead class="component-table__head" data-ref="purchases-thead">
            <tr>
              <th data-ref="th-plan">${i18n.t('settings.purchases.col_plan')}</th>
              <th data-ref="th-period">${i18n.t('settings.purchases.col_period')}</th>
              <th data-ref="th-amount">${i18n.t('settings.purchases.col_amount')}</th>
              <th data-ref="th-status">${i18n.t('settings.purchases.col_status')}</th>
              <th data-ref="th-date">${i18n.t('settings.purchases.col_date')}</th>
              <th data-ref="th-reference">${i18n.t('settings.purchases.col_reference')}</th>
            </tr>
          </thead>
          <tbody class="component-table__body" data-ref="purchases-tbody">
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector<HTMLElement>('[data-ref="purchases-tbody"]');
  const tableEl = container.querySelector<HTMLElement>('[data-ref="purchases-table"]');
  const tableWrapper = container.querySelector<HTMLElement>('[data-ref="purchases-table-wrapper"]');
  const searchInput = container.querySelector<HTMLInputElement>('[data-ref="purchases-search-input"]');
  const btnClearSearch = container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');
  const btnToggleSearch = container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-search"]');
  const searchToolbar = container.querySelector<HTMLElement>('[data-ref="purchases-search-toolbar"]');
  const selectedBadge = container.querySelector<HTMLElement>('[data-ref="purchases-selected-badge"]');
  const selectionActions = container.querySelector<HTMLElement>('[data-ref="purchases-selection-actions"]');
  const btnDownloadInvoice = container.querySelector<HTMLButtonElement>('[data-ref="btn-download-invoice"]');
  const btnCopyReference = container.querySelector<HTMLButtonElement>('[data-ref="btn-copy-reference"]');

  let allPurchases: PurchaseRecord[] = [];
  let currentlyDisplayedPurchases: PurchaseRecord[] = [];
  let selectedPurchaseId: number | string | null = null;

  const updateSelectionUI = () => {
    if (selectedPurchaseId !== null) {
      if (selectedBadge) {
        selectedBadge.textContent = i18n.t('settings.purchases.selected_count', { count: 1 });
        selectedBadge.classList.remove('is-hidden');
      }
      selectionActions?.classList.remove('is-hidden');
      btnToggleSearch?.classList.add('is-hidden');
    } else {
      selectedBadge?.classList.add('is-hidden');
      selectionActions?.classList.add('is-hidden');
      btnToggleSearch?.classList.remove('is-hidden');
    }
    renderIcons(container);
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedPurchaseId !== null) {
        selectedPurchaseId = null;
        updateSelectionUI();
        renderRows(currentlyDisplayedPurchases, Boolean(searchInput?.value.trim()));
      } else if (searchToolbar && !searchToolbar.classList.contains('is-hidden')) {
        hideSearchToolbar();
      }
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  btnClearSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) {
      searchInput.value = '';
      btnClearSearch.classList.add('is-hidden');
      renderRows(allPurchases);
      searchInput.focus();
    }
  });

  btnCopyReference?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedPurchaseId === null) return;
    const purchase = allPurchases.find((p) => p.id === selectedPurchaseId);
    if (!purchase) return;

    const refId = String(
      purchase.stripe_subscription_id ||
      purchase.stripe_payment_intent_id ||
      purchase.stripe_session_id ||
      `#${purchase.id}` ||
      ''
    );

    if (refId) {
      void copyToClipboard(refId);
    }
  });

  btnDownloadInvoice?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectedPurchaseId === null) return;

    try {
      const res = await getApi(`/api/subscription/invoice/${selectedPurchaseId}`);
      if (!res.ok || !res.invoice) {
        toast.error(i18n.t('settings.purchases.invoice_error'));
        return;
      }

      openInvoicePrintWindow(res.invoice);
      toast.success(i18n.t('settings.purchases.invoice_downloaded'));
    } catch {
      toast.error(i18n.t('settings.purchases.invoice_error'));
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
        const emptyStateEl = renderEmptyState({
          container: tableWrapper,
          dataRef: 'purchases-empty-state',
          desc: isSearchResult
            ? i18n.t('settings.purchases.search_no_results')
            : i18n.t('settings.purchases.empty_desc'),
          graphicType: isSearchResult ? 'search' : 'subscriptions',
          isTable: true,
          title: isSearchResult
            ? i18n.t('common.search')
            : i18n.t('settings.purchases.empty_title'),
        });

        if (!isSearchResult) {
          const actionContainer = document.createElement('div');
          actionContainer.style.marginTop = '16px';
          const btnPricing = document.createElement('button');
          btnPricing.className = 'component-button component-button--black component-button--h36';
          btnPricing.textContent = i18n.t('settings.purchases.view_plans');
          btnPricing.addEventListener('click', () => navigate('/pricing'));
          actionContainer.appendChild(btnPricing);
          emptyStateEl.appendChild(actionContainer);
        }
      }
      selectedPurchaseId = null;
      updateSelectionUI();
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

      const planName = getPlanLabel(p.plan_id);
      const periodName = getPeriodLabel(p.billing_period);
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

      const statusKey = `settings.purchases.status_${p.status || 'active'}`;
      const statusText = i18n.t(statusKey) !== statusKey ? i18n.t(statusKey) : (p.status || i18n.t('settings.purchases.status_active'));

      const refId = String(
        p.stripe_subscription_id ||
        p.stripe_payment_intent_id ||
        p.stripe_session_id ||
        `#${p.id}`
      );
      const shortRef = refId.length > 20 ? `${refId.slice(0, 10)}...${refId.slice(-6)}` : refId;

      row.innerHTML = `
        <td class="component-table__cell" data-ref="cell-plan-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-plan-${p.id}">${escapeHtml(planName)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-period-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-period-${p.id}">${escapeHtml(periodName)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-amount-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-amount-${p.id}">$${escapeHtml(amount)} ${escapeHtml(currency)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-status-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-status-${p.id}">${escapeHtml(statusText)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-date-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-date-${p.id}">${escapeHtml(dateFormatted)}</span>
        </td>
        <td class="component-table__cell" data-ref="cell-ref-${p.id}">
          <span class="component-badge component-badge--sm" data-ref="text-ref-${p.id}" data-tooltip="${escapeHtml(refId)}">${escapeHtml(shortRef)}</span>
        </td>
      `;

      row.addEventListener('click', () => {
        if (p.id !== undefined && selectedPurchaseId === p.id) {
          selectedPurchaseId = null;
        } else {
          selectedPurchaseId = p.id ?? null;
        }
        updateSelectionUI();
        renderRows(currentlyDisplayedPurchases, isSearchResult);
      });

      tbody.appendChild(row);
    });

    renderIcons(tbody);
  };

  const loadPurchases = async () => {
    try {
      const res = await getApi('/api/subscription/purchases');
      allPurchases = res.purchases || [];
      renderRows(allPurchases);
    } catch (_) {
      allPurchases = [];
      renderRows([]);
    }
  };

  (container as HTMLElement & { cleanup?: () => void }).cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };

  renderIcons(container);
  await loadPurchases();

  return container;
}

export {
  createSettingsPurchasesView
};

export type {
  InvoiceData,
  PurchaseRecord
};
