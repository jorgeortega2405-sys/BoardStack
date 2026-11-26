import type { AccessibleAdminApp, AdminViewElement, AppDashboardStats } from '../types/admin.types.js';
import { Chart, type ChartConfiguration, registerables } from 'chart.js';
import { escapeHtml, removeEmptyState, renderEmptyState } from '../utils/dom.util.js';
import { formatBytes, formatCurrency, formatNumber, formatShortUtcDay } from '../utils/format.util.js';
import { getApi } from '../services/api.service.js';
import { getRoleLabel } from '../components/layout-user-menu.component.js';
import { i18n } from '../i18n/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { themeService } from '../services/theme.service.js';
import { toast } from '../services/toast.service.js';

interface DashboardApiResponse {
  app?: AccessibleAdminApp;
  code?: string;
  error?: string;
  ok?: boolean;
  stats?: AppDashboardStats | null;
}

interface ChartThemePalette {
  axisColor: string;
  barBg: string;
  barBorder: string;
  doughnutPlans: string[];
  doughnutRoles: string[];
  filesFill: string;
  filesLine: string;
  gridColor: string;
  roomsFill: string;
  roomsLine: string;
  surfaceBorder: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  usersFill: string;
  usersLine: string;
}

Chart.register(...registerables);

function getChartThemePalette(): ChartThemePalette {
  const isDark = themeService.getResolvedTheme() === 'dark';
  if (isDark) {
    return {
      axisColor: '#a1a1aa',
      barBg: 'rgba(96, 165, 250, 0.78)',
      barBorder: '#60a5fa',
      doughnutPlans: ['#52525b', '#60a5fa', '#34d399'],
      doughnutRoles: ['#71717a', '#fbbf24', '#60a5fa', '#a78bfa'],
      filesFill: 'rgba(251, 191, 36, 0.14)',
      filesLine: '#fbbf24',
      gridColor: 'rgba(255, 255, 255, 0.08)',
      roomsFill: 'rgba(52, 211, 153, 0.14)',
      roomsLine: '#34d399',
      surfaceBorder: '#121215',
      tooltipBg: '#18181b',
      tooltipBorder: '#27272a',
      tooltipText: '#f4f4f5',
      usersFill: 'rgba(96, 165, 250, 0.16)',
      usersLine: '#60a5fa',
    };
  }
  return {
    axisColor: '#6b7280',
    barBg: 'rgba(17, 24, 39, 0.85)',
    barBorder: '#111827',
    doughnutPlans: ['#9ca3af', '#2563eb', '#16a34a'],
    doughnutRoles: ['#9ca3af', '#d97706', '#2563eb', '#7c3aed'],
    filesFill: 'rgba(217, 119, 6, 0.12)',
    filesLine: '#d97706',
    gridColor: 'rgba(17, 24, 39, 0.07)',
    roomsFill: 'rgba(22, 163, 74, 0.12)',
    roomsLine: '#16a34a',
    surfaceBorder: '#ffffff',
    tooltipBg: '#111827',
    tooltipBorder: '#1f2937',
    tooltipText: '#ffffff',
    usersFill: 'rgba(37, 99, 235, 0.12)',
    usersLine: '#2563eb',
  };
}

function getPlanDisplayName(tier: string): string {
  const normalized = (tier || 'free').toLowerCase();
  const key = `admin.users.plan_${normalized}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : normalized.toUpperCase();
}

async function createAppDashboardView(
  app: AccessibleAdminApp,
  onAccessDenied: () => Promise<void>
): Promise<AdminViewElement | null> {
  const container = document.createElement('div') as AdminViewElement;
  container.className = 'component-layout--split-full';
  container.setAttribute('data-ref', 'app-dashboard-layout');

  const safeTitle = escapeHtml(i18n.t('admin.dashboard.title'));
  const safeAppName = escapeHtml(app.name);
  const safeRefresh = escapeHtml(i18n.t('common.refresh'));

  container.innerHTML = `
    <div class="component-top" data-ref="dashboard-top">
      <div class="component-top__left" data-ref="dashboard-top-left">
        <div class="component-top__title-box" data-ref="dashboard-title-heading">
          <span class="component-top__title-text" data-ref="dashboard-title">${safeTitle}</span>
          <span class="component-badge component-badge--neutral component-badge--sm" data-ref="dashboard-app-badge">${safeAppName}</span>
        </div>
      </div>
      <div class="component-top__right" data-ref="dashboard-header-actions">
        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-refresh-dashboard" data-tooltip="${safeRefresh}" aria-label="${safeRefresh}">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
        </button>
      </div>
    </div>

    <div class="component-bottom component-bottom--page" data-ref="dashboard-bottom">
      <div class="component-stack" data-ref="dashboard-content">
        <div class="component-grid component-grid--stats" data-ref="dashboard-kpi-grid">
          <div class="component-card component-card--metric-h component-card--metric-fill" data-ref="kpi-card-users">
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
            </div>
            <div class="component-card__content">
              <span class="component-card__label">${escapeHtml(i18n.t('admin.dashboard.card_users_label'))}</span>
              <div class="component-card__value" data-ref="kpi-users-value">0</div>
              <span class="component-card__subtext" data-ref="kpi-users-sub">${escapeHtml(i18n.t('common.loading'))}</span>
            </div>
          </div>

          <div class="component-card component-card--metric-h component-card--metric-fill" data-ref="kpi-card-rooms">
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
            </div>
            <div class="component-card__content">
              <span class="component-card__label">${escapeHtml(i18n.t('admin.dashboard.card_rooms_label'))}</span>
              <div class="component-card__value" data-ref="kpi-rooms-value">0</div>
              <span class="component-card__subtext" data-ref="kpi-rooms-sub">${escapeHtml(i18n.t('common.loading'))}</span>
            </div>
          </div>

          <div class="component-card component-card--metric-h component-card--metric-fill" data-ref="kpi-card-files">
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
            </div>
            <div class="component-card__content">
              <span class="component-card__label">${escapeHtml(i18n.t('admin.dashboard.card_files_label'))}</span>
              <div class="component-card__value" data-ref="kpi-files-value">0</div>
              <span class="component-card__subtext" data-ref="kpi-files-sub">${escapeHtml(i18n.t('common.loading'))}</span>
            </div>
          </div>

          <div class="component-card component-card--metric-h component-card--metric-fill" data-ref="kpi-card-storage">
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
            </div>
            <div class="component-card__content">
              <span class="component-card__label">${escapeHtml(i18n.t('admin.dashboard.card_storage_label'))}</span>
              <div class="component-card__value" data-ref="kpi-storage-value">0 B</div>
              <span class="component-card__subtext" data-ref="kpi-storage-sub">${escapeHtml(i18n.t('admin.dashboard.card_storage_sub'))}</span>
            </div>
          </div>

          <div class="component-card component-card--metric-h component-card--metric-fill" data-ref="kpi-card-revenue">
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#receipt_long"></use></svg>
            </div>
            <div class="component-card__content">
              <span class="component-card__label">${escapeHtml(i18n.t('admin.dashboard.card_revenue_label'))}</span>
              <div class="component-card__value" data-ref="kpi-revenue-value">$0.00 USD</div>
              <span class="component-card__subtext" data-ref="kpi-revenue-sub">${escapeHtml(i18n.t('common.loading'))}</span>
            </div>
          </div>

          <div class="component-card component-card--metric-h component-card--metric-fill" data-ref="kpi-card-subscriptions">
            <div class="component-card__icon-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
            </div>
            <div class="component-card__content">
              <span class="component-card__label">${escapeHtml(i18n.t('admin.dashboard.card_subscriptions_label'))}</span>
              <div class="component-card__value" data-ref="kpi-subscriptions-value">0</div>
              <span class="component-card__subtext" data-ref="kpi-subscriptions-sub">${escapeHtml(i18n.t('common.loading'))}</span>
            </div>
          </div>
        </div>

        <div class="component-grid component-grid--charts" data-ref="dashboard-charts-grid">
          <div class="component-card component-card--chart" data-ref="chart-card-activity">
            <div class="component-card__header">
              <div>
                <h2 class="component-card__title">${escapeHtml(i18n.t('admin.dashboard.chart_activity_title'))}</h2>
                <p class="component-card__subtitle">${escapeHtml(i18n.t('admin.dashboard.chart_activity_subtitle'))}</p>
              </div>
            </div>
            <div class="component-chart-box" data-ref="chart-box-activity">
              <canvas class="component-chart-canvas" data-ref="chart-activity"></canvas>
            </div>
          </div>

          <div class="component-card component-card--chart" data-ref="chart-card-revenue">
            <div class="component-card__header">
              <div>
                <h2 class="component-card__title">${escapeHtml(i18n.t('admin.dashboard.chart_revenue_title'))}</h2>
                <p class="component-card__subtitle">${escapeHtml(i18n.t('admin.dashboard.chart_revenue_subtitle'))}</p>
              </div>
            </div>
            <div class="component-chart-box" data-ref="chart-box-revenue">
              <canvas class="component-chart-canvas" data-ref="chart-revenue"></canvas>
            </div>
          </div>

          <div class="component-card component-card--chart" data-ref="chart-card-plans">
            <div class="component-card__header">
              <div>
                <h2 class="component-card__title">${escapeHtml(i18n.t('admin.dashboard.chart_plans_title'))}</h2>
                <p class="component-card__subtitle">${escapeHtml(i18n.t('admin.dashboard.chart_plans_subtitle'))}</p>
              </div>
            </div>
            <div class="component-chart-box" data-ref="chart-box-plans">
              <canvas class="component-chart-canvas" data-ref="chart-plans"></canvas>
            </div>
          </div>

          <div class="component-card component-card--chart" data-ref="chart-card-roles">
            <div class="component-card__header">
              <div>
                <h2 class="component-card__title">${escapeHtml(i18n.t('admin.dashboard.chart_roles_title'))}</h2>
                <p class="component-card__subtitle">${escapeHtml(i18n.t('admin.dashboard.chart_roles_subtitle'))}</p>
              </div>
            </div>
            <div class="component-chart-box" data-ref="chart-box-roles">
              <canvas class="component-chart-canvas" data-ref="chart-roles"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const bottomEl = container.querySelector<HTMLElement>('[data-ref="dashboard-bottom"]');
  const contentEl = container.querySelector<HTMLElement>('[data-ref="dashboard-content"]');
  const btnRefresh = container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-dashboard"]');

  const usersValEl = container.querySelector<HTMLElement>('[data-ref="kpi-users-value"]');
  const usersSubEl = container.querySelector<HTMLElement>('[data-ref="kpi-users-sub"]');
  const roomsValEl = container.querySelector<HTMLElement>('[data-ref="kpi-rooms-value"]');
  const roomsSubEl = container.querySelector<HTMLElement>('[data-ref="kpi-rooms-sub"]');
  const filesValEl = container.querySelector<HTMLElement>('[data-ref="kpi-files-value"]');
  const filesSubEl = container.querySelector<HTMLElement>('[data-ref="kpi-files-sub"]');
  const storageValEl = container.querySelector<HTMLElement>('[data-ref="kpi-storage-value"]');
  const revenueValEl = container.querySelector<HTMLElement>('[data-ref="kpi-revenue-value"]');
  const revenueSubEl = container.querySelector<HTMLElement>('[data-ref="kpi-revenue-sub"]');
  const subsValEl = container.querySelector<HTMLElement>('[data-ref="kpi-subscriptions-value"]');
  const subsSubEl = container.querySelector<HTMLElement>('[data-ref="kpi-subscriptions-sub"]');

  const canvasActivity = container.querySelector<HTMLCanvasElement>('[data-ref="chart-activity"]');
  const canvasRevenue = container.querySelector<HTMLCanvasElement>('[data-ref="chart-revenue"]');
  const canvasPlans = container.querySelector<HTMLCanvasElement>('[data-ref="chart-plans"]');
  const canvasRoles = container.querySelector<HTMLCanvasElement>('[data-ref="chart-roles"]');

  const activeCharts: Chart[] = [];
  let currentStats: AppDashboardStats | null = null;
  let isDisposed = false;

  const destroyCharts = () => {
    while (activeCharts.length > 0) {
      const instance = activeCharts.pop();
      instance?.destroy();
    }
  };

  const renderKpis = (stats: AppDashboardStats) => {
    const s = stats.summary;
    if (usersValEl) usersValEl.textContent = formatNumber(s.totalUsers);
    if (usersSubEl) {
      usersSubEl.textContent = i18n.t('admin.dashboard.card_users_sub', {
        active: formatNumber(s.activeUsers),
        newUsers: formatNumber(s.newUsersLast30d),
      });
    }
    if (roomsValEl) roomsValEl.textContent = formatNumber(s.totalRooms);
    if (roomsSubEl) {
      roomsSubEl.textContent = i18n.t('admin.dashboard.card_rooms_sub', {
        cloud: formatNumber(s.cloudRooms),
        persistent: formatNumber(s.persistentRooms),
      });
    }
    if (filesValEl) filesValEl.textContent = formatNumber(s.totalFiles);
    if (filesSubEl) {
      filesSubEl.textContent = i18n.t('admin.dashboard.card_files_sub', {
        downloads: formatNumber(s.totalDownloads),
      });
    }
    if (storageValEl) storageValEl.textContent = formatBytes(s.totalStorageBytes);
    if (revenueValEl) revenueValEl.textContent = formatCurrency(s.totalRevenue, s.currency);
    if (revenueSubEl) {
      revenueSubEl.textContent = i18n.t('admin.dashboard.card_revenue_sub', {
        purchases: formatNumber(s.purchasesCount),
      });
    }
    if (subsValEl) subsValEl.textContent = formatNumber(s.activeSubscriptions);
    if (subsSubEl) {
      subsSubEl.textContent = i18n.t('admin.dashboard.card_subscriptions_sub', {
        organizations: formatNumber(s.totalOrganizations),
      });
    }
  };

  const renderCharts = (stats: AppDashboardStats) => {
    if (isDisposed) return;
    destroyCharts();

    const palette = getChartThemePalette();
    const commonTooltip = {
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
      titleColor: palette.tooltipText,
      bodyColor: palette.tooltipText,
    };

    const activityLabels = stats.activitySeries.map((pt) => formatShortUtcDay(pt.date));
    if (canvasActivity) {
      const cfg: ChartConfiguration<'line'> = {
        data: {
          datasets: [
            {
              backgroundColor: palette.usersFill,
              borderColor: palette.usersLine,
              borderWidth: 2,
              data: stats.activitySeries.map((pt) => pt.users),
              fill: true,
              label: i18n.t('admin.dashboard.series_users'),
              pointRadius: 3,
              tension: 0.35,
            },
            {
              backgroundColor: palette.roomsFill,
              borderColor: palette.roomsLine,
              borderWidth: 2,
              data: stats.activitySeries.map((pt) => pt.rooms),
              fill: true,
              label: i18n.t('admin.dashboard.series_rooms'),
              pointRadius: 3,
              tension: 0.35,
            },
            {
              backgroundColor: palette.filesFill,
              borderColor: palette.filesLine,
              borderWidth: 2,
              data: stats.activitySeries.map((pt) => pt.files),
              fill: true,
              label: i18n.t('admin.dashboard.series_files'),
              pointRadius: 3,
              tension: 0.35,
            },
          ],
          labels: activityLabels,
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                boxWidth: 10,
                color: palette.axisColor,
                usePointStyle: true,
              },
              position: 'bottom',
            },
            tooltip: commonTooltip,
          },
          responsive: true,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: palette.axisColor },
            },
            y: {
              beginAtZero: true,
              grid: { color: palette.gridColor },
              ticks: {
                color: palette.axisColor,
                precision: 0,
              },
            },
          },
        },
        type: 'line',
      };
      activeCharts.push(new Chart(canvasActivity, cfg));
    }

    const revenueLabels = stats.revenueSeries.map((pt) => formatShortUtcDay(pt.date));
    if (canvasRevenue) {
      const cfg: ChartConfiguration<'bar'> = {
        data: {
          datasets: [
            {
              backgroundColor: palette.barBg,
              borderColor: palette.barBorder,
              borderRadius: 6,
              borderWidth: 1,
              data: stats.revenueSeries.map((pt) => pt.amount),
              label: i18n.t('admin.dashboard.series_revenue'),
              maxBarThickness: 36,
            },
          ],
          labels: revenueLabels,
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...commonTooltip,
              callbacks: {
                label: (ctx) => formatCurrency(Number(ctx.parsed.y || 0), stats.summary.currency),
              },
            },
          },
          responsive: true,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: palette.axisColor },
            },
            y: {
              beginAtZero: true,
              grid: { color: palette.gridColor },
              ticks: {
                callback: (val) => `$${val}`,
                color: palette.axisColor,
              },
            },
          },
        },
        type: 'bar',
      };
      activeCharts.push(new Chart(canvasRevenue, cfg));
    }

    if (canvasPlans) {
      const cfg: ChartConfiguration<'doughnut'> = {
        data: {
          datasets: [
            {
              backgroundColor: stats.planDistribution.map((_, idx) => palette.doughnutPlans[idx % palette.doughnutPlans.length]),
              borderColor: palette.surfaceBorder,
              borderWidth: 2,
              data: stats.planDistribution.map((item) => item.count),
            },
          ],
          labels: stats.planDistribution.map((item) => getPlanDisplayName(item.key)),
        },
        options: {
          cutout: '64%',
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                boxWidth: 10,
                color: palette.axisColor,
                usePointStyle: true,
              },
              position: 'bottom',
            },
            tooltip: commonTooltip,
          },
          responsive: true,
        },
        type: 'doughnut',
      };
      activeCharts.push(new Chart(canvasPlans, cfg));
    }

    if (canvasRoles) {
      const cfg: ChartConfiguration<'doughnut'> = {
        data: {
          datasets: [
            {
              backgroundColor: stats.roleDistribution.map((_, idx) => palette.doughnutRoles[idx % palette.doughnutRoles.length]),
              borderColor: palette.surfaceBorder,
              borderWidth: 2,
              data: stats.roleDistribution.map((item) => item.count),
            },
          ],
          labels: stats.roleDistribution.map((item) => getRoleLabel(item.key, item.key)),
        },
        options: {
          cutout: '64%',
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                boxWidth: 10,
                color: palette.axisColor,
                usePointStyle: true,
              },
              position: 'bottom',
            },
            tooltip: commonTooltip,
          },
          responsive: true,
        },
        type: 'doughnut',
      };
      activeCharts.push(new Chart(canvasRoles, cfg));
    }
  };

  const loadDashboard = async (showErrorToast = false): Promise<boolean> => {
    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.classList.add('is-loading');
    }

    try {
      const res = await getApi<DashboardApiResponse>(`/api/admin/apps/${encodeURIComponent(app.slug)}/dashboard`);
      if (isDisposed) {
        return true;
      }

      if (!res.ok) {
        if (res.code === 'PAGE_ACCESS_DENIED') {
          await onAccessDenied();
          return false;
        }
        if (showErrorToast) {
          toast.error(i18n.t('admin.dashboard.load_error'));
        }
        return true;
      }

      if (!res.stats) {
        contentEl?.classList.add('is-hidden');
        if (bottomEl) {
          renderEmptyState({
            container: bottomEl,
            dataRef: 'dashboard-empty-state',
            desc: i18n.t('admin.dashboard.unavailable'),
            graphicType: 'users',
            title: i18n.t('admin.dashboard.title'),
          });
        }
        return true;
      }

      if (bottomEl) {
        removeEmptyState(bottomEl, 'dashboard-empty-state');
      }
      contentEl?.classList.remove('is-hidden');

      currentStats = res.stats;
      renderKpis(res.stats);
      renderCharts(res.stats);
      return true;
    } catch {
      if (!isDisposed && showErrorToast) {
        toast.error(i18n.t('admin.dashboard.load_error'));
      }
      return true;
    } finally {
      if (!isDisposed && btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.classList.remove('is-loading');
      }
    }
  };

  const unsubTheme = themeService.onThemeChange(() => {
    if (!isDisposed && currentStats) {
      renderCharts(currentStats);
    }
  });

  btnRefresh?.addEventListener('click', (e) => {
    e.preventDefault();
    void loadDashboard(true);
  });

  container.cleanup = () => {
    isDisposed = true;
    unsubTheme();
    destroyCharts();
  };

  renderIcons(container);
  const canRender = await loadDashboard(true);
  if (!canRender || isDisposed) {
    container.cleanup?.();
    return null;
  }

  return container;
}

export {
  createAppDashboardView
};
