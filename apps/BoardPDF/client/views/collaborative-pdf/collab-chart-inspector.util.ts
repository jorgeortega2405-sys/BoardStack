import { escapeHtml } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { hideElement, setupDropdown, showElement } from '../../utils/dom.util.js';
import { CHART_PALETTES, ChartType, ElementChart, ElementChartDataSeries, ElementChartOptions } from './collaborative-pdf.types.js';

function switchChartInspectorTab(
  tab: 'customize' | 'data',
  queryPanel: <T extends HTMLElement>(selector: string) => T | null
): void {
  const tabToggle = queryPanel<HTMLElement>('[data-ref="chart-tabs-toggle"]');
  const tabData = queryPanel<HTMLElement>('[data-ref="chart-tab-content-data"]');
  const tabCust = queryPanel<HTMLElement>('[data-ref="chart-tab-content-customize"]');
  const btnData = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-data"]');
  const btnCust = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-customize"]');

  if (tab === 'data') {
    if (tabToggle) tabToggle.setAttribute('data-active', '0');
    if (tabData) showElement(tabData);
    if (tabCust) hideElement(tabCust);
    btnData?.classList.add('is-active');
    btnCust?.classList.remove('is-active');
  } else {
    if (tabToggle) tabToggle.setAttribute('data-active', '1');
    if (tabData) hideElement(tabData);
    if (tabCust) showElement(tabCust);
    btnCust?.classList.add('is-active');
    btnData?.classList.remove('is-active');
  }
}

function switchChartAxisTab(
  axis: 'xaxis' | 'yaxis',
  queryPanel: <T extends HTMLElement>(selector: string) => T | null
): void {
  const tabToggle = queryPanel<HTMLElement>('[data-ref="chart-axis-tabs-toggle"]');
  const tabX = queryPanel<HTMLElement>('[data-ref="chart-tab-content-xaxis"]');
  const tabY = queryPanel<HTMLElement>('[data-ref="chart-tab-content-yaxis"]');
  const btnX = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-xaxis"]');
  const btnY = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-yaxis"]');

  if (axis === 'xaxis') {
    if (tabToggle) tabToggle.setAttribute('data-active', '0');
    if (tabX) showElement(tabX);
    if (tabY) hideElement(tabY);
    btnX?.classList.add('is-active');
    btnY?.classList.remove('is-active');
  } else {
    if (tabToggle) tabToggle.setAttribute('data-active', '1');
    if (tabX) hideElement(tabX);
    if (tabY) showElement(tabY);
    btnY?.classList.add('is-active');
    btnX?.classList.remove('is-active');
  }
}

function renderChartSpreadsheet(
  el: ElementChart,
  queryPanel: <T extends HTMLElement>(selector: string) => T | null,
  onUpdateChartSvg: (el: ElementChart) => void
): void {
  const tableHead = queryPanel<HTMLTableSectionElement>('[data-ref="chart-table-head"]');
  const tableBody = queryPanel<HTMLTableSectionElement>('[data-ref="chart-table-body"]');
  if (!tableHead || !tableBody) return;

  const scheme = el.options.colorScheme || 'blue';
  const palette = CHART_PALETTES[scheme] || CHART_PALETTES.blue;

  tableHead.innerHTML = '';
  tableBody.innerHTML = '';

  const trH = document.createElement('tr');
  trH.innerHTML = `
    <th class="collaborative-chart-table__col-index">#</th>
    <th class="collaborative-chart-table__col-cat">${escapeHtml(t('collaborative.chart_col_category'))}</th>
  `;

  el.series.forEach((s, sIdx) => {
    const th = document.createElement('th');
    th.className = 'collaborative-chart-table__col-series';
    const col = s.color || palette[sIdx % palette.length];
    th.innerHTML = `<svg class="collaborative-chart-table__dot-svg" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="${escapeHtml(col)}"></circle></svg> ${escapeHtml(s.name || `${t('collaborative.chart_series_prefix')} ${sIdx + 1}`)}`;
    trH.appendChild(th);
  });
  tableHead.appendChild(trH);

  el.labels.forEach((lbl, rIdx) => {
    const tr = document.createElement('tr');
    const dotCol = palette[rIdx % palette.length];

    const tdDot = document.createElement('td');
    tdDot.className = 'collaborative-chart-table__cell-index';
    tdDot.innerHTML = `<svg class="collaborative-chart-table__dot-svg" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="${escapeHtml(dotCol)}"></circle></svg>`;
    tr.appendChild(tdDot);

    const tdCat = document.createElement('td');
    const inpCat = document.createElement('input');
    inpCat.type = 'text';
    inpCat.value = lbl;
    inpCat.addEventListener('input', () => {
      el.labels[rIdx] = inpCat.value;
      onUpdateChartSvg(el);
    });
    tdCat.appendChild(inpCat);
    tr.appendChild(tdCat);

    el.series.forEach((s) => {
      const tdVal = document.createElement('td');
      const inpVal = document.createElement('input');
      inpVal.type = 'number';
      inpVal.value = String(s.values[rIdx] ?? 0);
      inpVal.addEventListener('input', () => {
        s.values[rIdx] = parseFloat(inpVal.value) || 0;
        onUpdateChartSvg(el);
      });
      tdVal.appendChild(inpVal);
      tr.appendChild(tdVal);
    });

    tableBody.appendChild(tr);
  });
}

function syncChartInspector(
  el: ElementChart,
  queryPanel: <T extends HTMLElement>(selector: string) => T | null,
  queryPanelAll: <T extends HTMLElement>(selector: string) => NodeListOf<T>,
  onUpdateChartSvg: (el: ElementChart) => void
): void {
  const lblType = queryPanel<HTMLElement>('[data-ref="label-current-chart-type"]');
  const typeNames: Record<ChartType, string> = {
    'area-overlap': t('collaborative.chart_type_area_overlap'),
    'area-stacked': t('collaborative.chart_type_area_stacked'),
    'bar-grouped': t('collaborative.chart_type_bar_grouped'),
    'bar-horizontal': t('collaborative.chart_type_bar_horizontal'),
    'bar-stacked': t('collaborative.chart_type_bar_stacked'),
    'bar-vertical': t('collaborative.chart_type_bar_vertical'),
    'donut': t('collaborative.chart_type_donut'),
    'line': t('collaborative.chart_type_line'),
    'line-multi': t('collaborative.chart_type_line_multi'),
    'pie': t('collaborative.chart_type_pie'),
    'progress-bar': t('collaborative.chart_type_progress_bar'),
    'progress-gauge': t('collaborative.chart_type_progress_gauge'),
    'progress-ring': t('collaborative.chart_type_progress_ring'),
    'scatter': t('collaborative.chart_type_scatter'),
  };
  if (lblType) lblType.textContent = typeNames[el.chartType] || t('collaborative.chart_type_bar_vertical');

  const pickBtns = queryPanelAll<HTMLButtonElement>('[data-ref="btn-pick-chart-type"]');
  pickBtns.forEach((btn) => {
    const isCurrent = btn.getAttribute('data-chart-type') === el.chartType;
    btn.classList.toggle('is-selected', isCurrent);
    btn.classList.toggle('is-active', isCurrent);
  });

  const paletteBtns = queryPanelAll<HTMLButtonElement>('[data-ref="btn-chart-palette-opt"]');
  paletteBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-palette') === (el.options.colorScheme || 'blue'));
  });

  const setInput = (ref: string, val: string | number | null | undefined) => {
    const inp = queryPanel<HTMLInputElement>(`[data-ref="${ref}"]`);
    if (inp) inp.value = val !== undefined && val !== null ? String(val) : '';
  };

  const setCheckbox = (ref: string, checked: boolean) => {
    const chk = queryPanel<HTMLInputElement>(`[data-ref="${ref}"]`);
    if (chk) chk.checked = checked;
  };

  setInput('input-chart-title', el.options.title);
  setInput('input-chart-subtitle', el.options.subtitle);
  setInput('input-chart-xaxis-title', el.options.xAxisTitle);
  setInput('input-chart-yaxis-title', el.options.yAxisTitle);
  setInput('input-chart-prefix', el.options.dataLabelPrefix);
  setInput('input-chart-suffix', el.options.dataLabelSuffix);
  setInput('input-chart-min', el.options.yAxisMin);
  setInput('input-chart-max', el.options.yAxisMax);

  setCheckbox('input-chart-legend', el.options.showLegend !== false);
  setCheckbox('input-chart-datalabels', !!el.options.showDataLabels);
  setCheckbox('input-chart-xlabels', el.options.showXLabels !== false);
  setCheckbox('input-chart-ylabels', el.options.showYLabels !== false);
  setCheckbox('input-chart-gridlines', el.options.showGridLines !== false);

  renderChartSpreadsheet(el, queryPanel, onUpdateChartSvg);
}

function bindChartInspectorEvents(
  signal: AbortSignal | undefined,
  restoreElementsMain: () => void,
  queryPanel: <T extends HTMLElement>(selector: string) => T | null,
  queryPanelAll: <T extends HTMLElement>(selector: string) => NodeListOf<T>,
  getSelectedChart: () => ElementChart | undefined,
  onUpdateChartSvg: (el: ElementChart) => void,
  onApplyChartPalette: (el: ElementChart) => void
): void {
  const btnBack = queryPanel<HTMLButtonElement>('[data-ref="btn-chart-inspector-back"]');
  btnBack?.addEventListener('click', restoreElementsMain, { signal });

  const typeDropdownWrapper = queryPanel<HTMLElement>('[data-ref="dropdown-wrapper-chart-type"]');
  const btnTypeDropdown = queryPanel<HTMLButtonElement>('[data-ref="btn-chart-type-dropdown"]');
  const typeBackdrop = queryPanel<HTMLElement>('[data-ref="dropdown-backdrop-chart-type"]');
  const typePopup = queryPanel<HTMLElement>('[data-ref="chart-type-popup"]');
  const chartTypeDropdown = setupDropdown(typeDropdownWrapper, {
    backdrop: typeBackdrop,
    isSelect: true,
    matchWidth: true,
    menu: typePopup,
    trigger: btnTypeDropdown,
    onSelect: (val) => {
      const newType = val as ChartType;
      const el = getSelectedChart();
      if (!newType || !el) return false;
      el.chartType = newType;
      onUpdateChartSvg(el);
      syncChartInspector(el, queryPanel, queryPanelAll, onUpdateChartSvg);
      typePopup?.querySelectorAll<HTMLElement>('[data-ref="btn-pick-chart-type"]').forEach((item) => {
        const isCurrent = item.getAttribute('data-chart-type') === newType;
        item.classList.toggle('is-selected', isCurrent);
        item.classList.toggle('is-active', isCurrent);
      });
    },
  });
  signal?.addEventListener('abort', () => chartTypeDropdown.destroy(), { once: true });

  const btnTabData = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-data"]');
  const btnTabCust = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-customize"]');
  btnTabData?.addEventListener('click', () => switchChartInspectorTab('data', queryPanel), { signal });
  btnTabCust?.addEventListener('click', () => switchChartInspectorTab('customize', queryPanel), { signal });

  const btnTabXAxis = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-xaxis"]');
  const btnTabYAxis = queryPanel<HTMLButtonElement>('[data-ref="btn-tab-chart-yaxis"]');
  btnTabXAxis?.addEventListener('click', () => switchChartAxisTab('xaxis', queryPanel), { signal });
  btnTabYAxis?.addEventListener('click', () => switchChartAxisTab('yaxis', queryPanel), { signal });

  const btnAddRow = queryPanel<HTMLButtonElement>('[data-ref="btn-chart-add-row"]');
  btnAddRow?.addEventListener('click', () => {
    const el = getSelectedChart();
    if (!el) return;
    const nextIdx = el.labels.length + 1;
    el.labels.push(`${t('collaborative.chart_item_prefix')} ${nextIdx}`);
    el.series.forEach((s) => s.values.push(20 + Math.round(Math.random() * 50)));
    renderChartSpreadsheet(el, queryPanel, onUpdateChartSvg);
    onUpdateChartSvg(el);
  }, { signal });

  const btnAddCol = queryPanel<HTMLButtonElement>('[data-ref="btn-chart-add-col"]');
  btnAddCol?.addEventListener('click', () => {
    const el = getSelectedChart();
    if (!el) return;
    const sIdx = el.series.length;
    const scheme = el.options.colorScheme || 'blue';
    const pal = CHART_PALETTES[scheme] || CHART_PALETTES.blue;
    el.series.push({
      color: pal[sIdx % pal.length],
      name: `${t('collaborative.chart_series_prefix')} ${sIdx + 1}`,
      values: el.labels.map(() => 15 + Math.round(Math.random() * 60)),
    });
    renderChartSpreadsheet(el, queryPanel, onUpdateChartSvg);
    onUpdateChartSvg(el);
  }, { signal });

  const btnTranspose = queryPanel<HTMLButtonElement>('[data-ref="btn-chart-transpose"]');
  btnTranspose?.addEventListener('click', () => {
    const el = getSelectedChart();
    if (!el || el.series.length === 0) return;
    const oldLabels = [...el.labels];
    const oldSeries = [...el.series];
    const newLabels = oldSeries.map((s) => s.name);
    const newSeries: ElementChartDataSeries[] = oldLabels.map((lbl, r) => ({
      color: CHART_PALETTES[el.options.colorScheme || 'blue'][r % 5],
      name: lbl,
      values: oldSeries.map((s) => s.values[r] ?? 0),
    }));
    el.labels = newLabels;
    el.series = newSeries;
    renderChartSpreadsheet(el, queryPanel, onUpdateChartSvg);
    onUpdateChartSvg(el);
  }, { signal });

  const btnClear = queryPanel<HTMLButtonElement>('[data-ref="btn-chart-clear-data"]');
  btnClear?.addEventListener('click', () => {
    const el = getSelectedChart();
    if (!el) return;
    el.series.forEach((s) => {
      s.values = s.values.map(() => 0);
    });
    renderChartSpreadsheet(el, queryPanel, onUpdateChartSvg);
    onUpdateChartSvg(el);
  }, { signal });

  const paletteBtns = queryPanelAll<HTMLButtonElement>('[data-ref="btn-chart-palette-opt"]');
  paletteBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const scheme = btn.getAttribute('data-palette') as ElementChartOptions['colorScheme'];
      const el = getSelectedChart();
      if (!scheme || !el) return;
      el.options.colorScheme = scheme;
      onApplyChartPalette(el);
      syncChartInspector(el, queryPanel, queryPanelAll, onUpdateChartSvg);
      onUpdateChartSvg(el);
    }, { signal });
  });

  const bindOptInput = (ref: string, key: keyof ElementChartOptions, isNum = false) => {
    const inp = queryPanel<HTMLInputElement>(`[data-ref="${ref}"]`);
    inp?.addEventListener('input', () => {
      const el = getSelectedChart();
      if (!el) return;
      (el.options as any)[key] = isNum ? (inp.value ? parseFloat(inp.value) : null) : inp.value;
      onUpdateChartSvg(el);
    }, { signal });
  };

  const bindOptSwitch = (ref: string, key: keyof ElementChartOptions) => {
    const chk = queryPanel<HTMLInputElement>(`[data-ref="${ref}"]`);
    chk?.addEventListener('change', () => {
      const el = getSelectedChart();
      if (!el) return;
      (el.options as any)[key] = chk.checked;
      onUpdateChartSvg(el);
    }, { signal });
  };

  bindOptInput('input-chart-title', 'title');
  bindOptInput('input-chart-subtitle', 'subtitle');
  bindOptInput('input-chart-xaxis-title', 'xAxisTitle');
  bindOptInput('input-chart-yaxis-title', 'yAxisTitle');
  bindOptInput('input-chart-prefix', 'dataLabelPrefix');
  bindOptInput('input-chart-suffix', 'dataLabelSuffix');
  bindOptInput('input-chart-min', 'yAxisMin', true);
  bindOptInput('input-chart-max', 'yAxisMax', true);

  bindOptSwitch('input-chart-legend', 'showLegend');
  bindOptSwitch('input-chart-datalabels', 'showDataLabels');
  bindOptSwitch('input-chart-xlabels', 'showXLabels');
  bindOptSwitch('input-chart-ylabels', 'showYLabels');
  bindOptSwitch('input-chart-gridlines', 'showGridLines');
}

export { bindChartInspectorEvents, renderChartSpreadsheet, switchChartAxisTab, switchChartInspectorTab, syncChartInspector };
