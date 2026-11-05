import { escapeHtml } from '../../services/api.service.js';
import { CHART_PALETTES, ElementChart } from './collaborative-pdf.types.js';

export function applyChartPalette(el: ElementChart): void {
  const scheme = el.options.colorScheme || 'blue';
  const palette = CHART_PALETTES[scheme] || CHART_PALETTES.blue;
  el.series.forEach((s, i) => {
    s.color = palette[i % palette.length];
  });
}

export function renderChartSvg(el: ElementChart): string {
  const W = el.width || 480;
  const H = el.height || 320;
  const scheme = el.options.colorScheme || 'blue';
  const palette = el.options.colorPalette || CHART_PALETTES[scheme] || CHART_PALETTES.blue;
  const hasTitle = !!el.options.title;
  const hasSubtitle = !!el.options.subtitle;
  const isProgress = el.chartType === 'progress-bar' || el.chartType === 'progress-ring' || el.chartType === 'progress-gauge';

  let titleSvg = '';
  if (hasTitle) {
    titleSvg += `<text x="${W / 2}" y="22" font-size="14" font-weight="700" text-anchor="middle" fill="#1e293b">${escapeHtml(el.options.title || '')}</text>`;
  }
  if (hasSubtitle) {
    titleSvg += `<text x="${W / 2}" y="${hasTitle ? 37 : 20}" font-size="11" fill="#64748b" text-anchor="middle">${escapeHtml(el.options.subtitle || '')}</text>`;
  }

  if (isProgress) {
    const pct = Math.max(0, Math.min(100, Math.round(el.options.percentageValue ?? 72)));
    let content = '';

    if (el.chartType === 'progress-ring') {
      const cx = W / 2;
      const cy = hasTitle ? H / 2 + 10 : H / 2;
      const r = Math.min(W, H) / 2 - 24;
      const circ = 2 * Math.PI * r;
      const offset = circ * (1 - pct / 100);
      content = `
        <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#e2e8f0" stroke-width="14" fill="none"></circle>
        <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${palette[0]}" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} ${cy})"></circle>
        <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="28" font-weight="700" fill="#1e293b">${pct}%</text>
      `;
    } else if (el.chartType === 'progress-bar') {
      const barW = Math.max(80, W - 48);
      const barH = 24;
      const x = (W - barW) / 2;
      const y = hasTitle ? H / 2 - 4 : H / 2 - 12;
      const fillW = Math.max(8, barW * (pct / 100));
      content = `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="12" fill="#e2e8f0"></rect>
        <rect x="${x}" y="${y}" width="${fillW}" height="${barH}" rx="12" fill="${palette[0]}"></rect>
        <text x="${W / 2}" y="${y + 42}" text-anchor="middle" font-size="20" font-weight="700" fill="#1e293b">${pct}%</text>
      `;
    } else if (el.chartType === 'progress-gauge') {
      const cx = W / 2;
      const cy = hasTitle ? H - 28 : H - 24;
      const r = Math.min(W / 2 - 28, H - (hasTitle ? 50 : 36));
      const angle = -Math.PI + (pct / 100) * Math.PI;
      const needleX = cx + Math.cos(angle) * (r - 10);
      const needleY = cy + Math.sin(angle) * (r - 10);
      content = `
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" stroke="#e2e8f0" stroke-width="14" fill="none" stroke-linecap="round"></path>
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${needleX} ${needleY}" stroke="${palette[0]}" stroke-width="14" fill="none" stroke-linecap="round"></path>
        <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="#1e293b" stroke-width="3" stroke-linecap="round"></line>
        <circle cx="${cx}" cy="${cy}" r="6" fill="#1e293b"></circle>
        <text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="24" font-weight="700" fill="#1e293b">${pct}%</text>
      `;
    }

    return `<svg class="collaborative-chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">${titleSvg}${content}</svg>`;
  }

  if (el.chartType === 'pie' || el.chartType === 'donut') {
    const cx = W / 2;
    const cy = hasTitle ? (H - (hasSubtitle ? 44 : 32)) / 2 + (hasSubtitle ? 44 : 32) : H / 2;
    const r = Math.min(W / 2 - 36, H / 2 - (hasTitle ? 32 : 20));
    const s0 = el.series[0] || { name: 'Valores', values: [40, 30, 20, 10] };
    const vals = s0.values.length > 0 ? s0.values : [1];
    const total = vals.reduce((a, b) => a + (Number(b) || 0), 0) || 1;

    let currentAngle = -Math.PI / 2;
    let slicesSvg = '';

    vals.forEach((v, idx) => {
      const sliceAngle = ((Number(v) || 0) / total) * 2 * Math.PI;
      if (sliceAngle <= 0) return;
      const x1 = cx + r * Math.cos(currentAngle);
      const y1 = cy + r * Math.sin(currentAngle);
      const x2 = cx + r * Math.cos(currentAngle + sliceAngle);
      const y2 = cy + r * Math.sin(currentAngle + sliceAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const col = palette[idx % palette.length];

      slicesSvg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${col}" stroke="#ffffff" stroke-width="1.5"></path>`;
      currentAngle += sliceAngle;
    });

    let innerHole = '';
    if (el.chartType === 'donut') {
      const innerR = r * 0.58;
      innerHole = `
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff"></circle>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#1e293b">${total}</text>
      `;
    }

    let legendSvg = '';
    if (el.options.showLegend !== false) {
      let legX = 20;
      const legY = H - 12;
      el.labels.forEach((lbl, idx) => {
        const col = palette[idx % palette.length];
        legendSvg += `
          <rect x="${legX}" y="${legY - 9}" width="10" height="10" rx="2" fill="${col}"></rect>
          <text x="${legX + 14}" y="${legY}" font-size="11" fill="#475569">${escapeHtml(lbl)}</text>
        `;
        legX += Math.max(60, lbl.length * 7 + 24);
      });
    }

    return `<svg class="collaborative-chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">${titleSvg}${slicesSvg}${innerHole}${legendSvg}</svg>`;
  }

  const showX = el.options.showXLabels !== false;
  const showY = el.options.showYLabels !== false;
  const showGrid = el.options.showGridLines !== false;
  const showLegend = el.options.showLegend !== false && el.series.length > 0;
  const pfx = el.options.dataLabelPrefix || '';
  const sfx = el.options.dataLabelSuffix || '';

  const marginLeft = showY ? 46 : 16;
  const marginRight = 20;
  const marginTop = hasTitle ? (hasSubtitle ? 50 : 38) : (showLegend ? 32 : 18);
  const marginBottom = showX ? 36 : 16;
  const plotW = Math.max(60, W - marginLeft - marginRight);
  const plotH = Math.max(40, H - marginTop - marginBottom);

  let allVals: number[] = [];
  el.series.forEach((s) => {
    s.values.forEach((v) => allVals.push(Number(v) || 0));
  });
  if (allVals.length === 0) allVals = [0, 10];
  const maxVal = el.options.yAxisMax ?? Math.max(10, Math.ceil(Math.max(...allVals) * 1.15));
  const minVal = el.options.yAxisMin ?? 0;
  const valRange = Math.max(1, maxVal - minVal);

  const getY = (v: number) => marginTop + plotH - ((v - minVal) / valRange) * plotH;

  let gridSvg = '';
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const stepVal = Math.round(minVal + (valRange / gridSteps) * i);
    const y = getY(stepVal);
    if (showGrid) {
      gridSvg += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + plotW}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${i === 0 ? 'none' : '3 3'}"></line>`;
    }
    if (showY) {
      gridSvg += `<text x="${marginLeft - 8}" y="${y + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${pfx}${stepVal}${sfx}</text>`;
    }
  }

  const numCategories = Math.max(1, el.labels.length);
  const slotW = plotW / numCategories;
  let xAxisSvg = '';
  let seriesSvg = '';

  if (showX) {
    el.labels.forEach((lbl, i) => {
      const x = marginLeft + i * slotW + slotW / 2;
      xAxisSvg += `<text x="${x}" y="${marginTop + plotH + 18}" font-size="11" fill="#64748b" text-anchor="middle">${escapeHtml(lbl)}</text>`;
    });
  }

  if (el.chartType === 'bar-vertical') {
    const s0 = el.series[0] || { color: palette[0], name: 'Serie 1', values: [20, 40, 60, 30] };
    const barW = Math.min(48, Math.max(12, slotW * 0.55));
    s0.values.forEach((v, i) => {
      const num = Number(v) || 0;
      const bx = marginLeft + i * slotW + (slotW - barW) / 2;
      const by = getY(num);
      const bh = Math.max(2, marginTop + plotH - by);
      const col = s0.color || palette[i % palette.length];
      seriesSvg += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" rx="3" fill="${col}"></rect>`;
      if (el.options.showDataLabels) {
        seriesSvg += `<text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" font-size="10" font-weight="600" fill="#334155">${pfx}${num}${sfx}</text>`;
      }
    });
  } else if (el.chartType === 'bar-horizontal') {
    const s0 = el.series[0] || { color: palette[0], name: 'Serie 1', values: [20, 40, 60, 30] };
    const rowH = plotH / numCategories;
    const barH = Math.min(28, Math.max(8, rowH * 0.6));
    s0.values.forEach((v, i) => {
      const num = Number(v) || 0;
      const by = marginTop + i * rowH + (rowH - barH) / 2;
      const bw = Math.max(2, (num / maxVal) * plotW);
      const col = s0.color || palette[i % palette.length];
      seriesSvg += `<rect x="${marginLeft}" y="${by}" width="${bw}" height="${barH}" rx="3" fill="${col}"></rect>`;
      if (el.options.showDataLabels) {
        seriesSvg += `<text x="${marginLeft + bw + 6}" y="${by + barH / 2 + 4}" font-size="10" font-weight="600" fill="#334155">${pfx}${num}${sfx}</text>`;
      }
    });
  } else if (el.chartType === 'bar-grouped') {
    const numSeries = Math.max(1, el.series.length);
    const groupPad = slotW * 0.15;
    const totalBarW = slotW - groupPad * 2;
    const barW = Math.max(4, totalBarW / numSeries);

    el.labels.forEach((_, cIdx) => {
      el.series.forEach((s, sIdx) => {
        const num = Number(s.values[cIdx]) || 0;
        const bx = marginLeft + cIdx * slotW + groupPad + sIdx * barW;
        const by = getY(num);
        const bh = Math.max(2, marginTop + plotH - by);
        const col = s.color || palette[sIdx % palette.length];
        seriesSvg += `<rect x="${bx}" y="${by}" width="${barW - 2}" height="${bh}" rx="2" fill="${col}"></rect>`;
        if (el.options.showDataLabels) {
          seriesSvg += `<text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" font-size="9" font-weight="600" fill="#334155">${num}</text>`;
        }
      });
    });
  } else if (el.chartType === 'bar-stacked') {
    const barW = Math.min(48, Math.max(12, slotW * 0.55));
    el.labels.forEach((_, cIdx) => {
      let acc = 0;
      const bx = marginLeft + cIdx * slotW + (slotW - barW) / 2;
      el.series.forEach((s, sIdx) => {
        const num = Number(s.values[cIdx]) || 0;
        const by = getY(acc + num);
        const bh = Math.max(2, (num / valRange) * plotH);
        const col = s.color || palette[sIdx % palette.length];
        seriesSvg += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" rx="2" fill="${col}"></rect>`;
        acc += num;
      });
    });
  } else if (el.chartType === 'line' || el.chartType === 'line-multi') {
    el.series.forEach((s, sIdx) => {
      const col = s.color || palette[sIdx % palette.length];
      const points = s.values.map((v, cIdx) => {
        const px = marginLeft + cIdx * slotW + slotW / 2;
        const py = getY(Number(v) || 0);
        return `${px},${py}`;
      }).join(' ');

      seriesSvg += `<polyline points="${points}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
      s.values.forEach((v, cIdx) => {
        const px = marginLeft + cIdx * slotW + slotW / 2;
        const py = getY(Number(v) || 0);
        seriesSvg += `<circle cx="${px}" cy="${py}" r="4" fill="${col}" stroke="#ffffff" stroke-width="2"></circle>`;
        if (el.options.showDataLabels) {
          seriesSvg += `<text x="${px}" y="${py - 7}" text-anchor="middle" font-size="10" font-weight="600" fill="#334155">${pfx}${v}${sfx}</text>`;
        }
      });
    });
  } else if (el.chartType === 'area-stacked' || el.chartType === 'area-overlap') {
    el.series.forEach((s, sIdx) => {
      const col = s.color || palette[sIdx % palette.length];
      const pts = s.values.map((v, cIdx) => {
        const px = marginLeft + cIdx * slotW + slotW / 2;
        const py = getY(Number(v) || 0);
        return { x: px, y: py };
      });
      if (pts.length > 0) {
        const firstX = pts[0].x;
        const lastX = pts[pts.length - 1].x;
        const base = marginTop + plotH;
        const polyPoints = `${firstX},${base} ` + pts.map((p) => `${p.x},${p.y}`).join(' ') + ` ${lastX},${base}`;
        seriesSvg += `<polygon points="${polyPoints}" fill="${col}" fill-opacity="0.45"></polygon>`;
        seriesSvg += `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5"></polyline>`;
      }
    });
  } else if (el.chartType === 'scatter') {
    const s0 = el.series[0] || { color: palette[0], values: [10, 35, 60, 80] };
    s0.values.forEach((v, i) => {
      const px = marginLeft + i * slotW + slotW / 2;
      const py = getY(Number(v) || 0);
      seriesSvg += `<circle cx="${px}" cy="${py}" r="6" fill="${s0.color || palette[0]}" opacity="0.85"></circle>`;
    });
  }

  let legendSvg = '';
  if (showLegend) {
    let legX = marginLeft;
    const legY = marginTop - 12;
    el.series.forEach((s, idx) => {
      const col = s.color || palette[idx % palette.length];
      legendSvg += `
        <rect x="${legX}" y="${legY - 8}" width="10" height="10" rx="2" fill="${col}"></rect>
        <text x="${legX + 14}" y="${legY}" font-size="11" fill="#475569">${escapeHtml(s.name)}</text>
      `;
      legX += Math.max(60, s.name.length * 7 + 28);
    });
  }

  return `
    <svg class="collaborative-chart-svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">
      ${titleSvg}
      ${legendSvg}
      ${gridSvg}
      ${xAxisSvg}
      ${seriesSvg}
    </svg>
  `;
}
