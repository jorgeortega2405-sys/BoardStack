function updateRulers(container: HTMLElement, showRulersAndGuides: boolean, zoomLevel = 1.0): void {
  if (!showRulersAndGuides) return;
  const workspace = container.querySelector<HTMLElement>('[data-ref="collaborative-workspace"]');
  const canvasTop = container.querySelector<HTMLCanvasElement>('[data-ref="ruler-top"]');
  const canvasLeft = container.querySelector<HTMLCanvasElement>('[data-ref="ruler-left"]');
  if (!workspace || !canvasTop || !canvasLeft) return;

  const firstSheet = container.querySelector<HTMLElement>('.collaborative-page-sheet');
  if (!firstSheet) return;

  const wsRect = workspace.getBoundingClientRect();
  const pageRect = firstSheet.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;
  const topW = Math.max(100, Math.round(wsRect.width - 20));
  const leftH = Math.max(100, Math.round(wsRect.height - 20));

  if (canvasTop.width !== Math.round(topW * dpr) || canvasTop.height !== Math.round(20 * dpr)) {
    canvasTop.width = Math.round(topW * dpr);
    canvasTop.height = Math.round(20 * dpr);
    canvasTop.style.width = `${topW}px`;
    canvasTop.style.height = '20px';
  }
  if (canvasLeft.width !== Math.round(20 * dpr) || canvasLeft.height !== Math.round(leftH * dpr)) {
    canvasLeft.width = Math.round(20 * dpr);
    canvasLeft.height = Math.round(leftH * dpr);
    canvasLeft.style.width = '20px';
    canvasLeft.style.height = `${leftH}px`;
  }

  const ctxTop = canvasTop.getContext('2d');
  const ctxLeft = canvasLeft.getContext('2d');
  if (!ctxTop || !ctxLeft) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgFill = isDark ? '#1e293b' : '#f3f4f7';
  const textFill = isDark ? '#94a3b8' : '#6b7280';
  const strokeLine = isDark ? '#475569' : '#9ca3af';

  ctxTop.save();
  ctxTop.scale(dpr, dpr);
  ctxTop.clearRect(0, 0, topW, 20);
  ctxTop.fillStyle = bgFill;
  ctxTop.fillRect(0, 0, topW, 20);

  const cmPx = 37.8 * (zoomLevel || 1.0);
  const originX = (pageRect.left - wsRect.left) - 20;

  ctxTop.fillStyle = textFill;
  ctxTop.strokeStyle = strokeLine;
  ctxTop.lineWidth = 1;
  ctxTop.font = '9px system-ui, sans-serif';
  ctxTop.textAlign = 'center';

  const startCm = Math.floor(-originX / cmPx) - 2;
  const endCm = Math.ceil((topW - originX) / cmPx) + 2;

  for (let cm = startCm; cm <= endCm; cm++) {
    const x = originX + cm * cmPx;
    if (x < 0 || x > topW) continue;

    if (cm % 2 === 0) {
      ctxTop.beginPath();
      ctxTop.moveTo(x, 8);
      ctxTop.lineTo(x, 20);
      ctxTop.stroke();
      if (cm >= 0 && x > 25) {
        ctxTop.fillText(cm.toString(), x, 7);
      }
    } else {
      ctxTop.beginPath();
      ctxTop.moveTo(x, 12);
      ctxTop.lineTo(x, 20);
      ctxTop.stroke();
    }

    for (let sub = 1; sub < 5; sub++) {
      const subX = x + (sub * 0.2) * cmPx;
      if (subX >= 0 && subX <= topW) {
        ctxTop.beginPath();
        ctxTop.moveTo(subX, 16);
        ctxTop.lineTo(subX, 20);
        ctxTop.stroke();
      }
    }
  }
  ctxTop.restore();

  ctxLeft.save();
  ctxLeft.scale(dpr, dpr);
  ctxLeft.clearRect(0, 0, 20, leftH);
  ctxLeft.fillStyle = bgFill;
  ctxLeft.fillRect(0, 0, 20, leftH);

  const originY = (pageRect.top - wsRect.top) - 20;
  ctxLeft.fillStyle = textFill;
  ctxLeft.strokeStyle = strokeLine;
  ctxLeft.lineWidth = 1;
  ctxLeft.font = '9px system-ui, sans-serif';
  ctxLeft.textAlign = 'right';

  const startCmY = Math.floor(-originY / cmPx) - 2;
  const endCmY = Math.ceil((leftH - originY) / cmPx) + 2;

  for (let cm = startCmY; cm <= endCmY; cm++) {
    const y = originY + cm * cmPx;
    if (y < 0 || y > leftH) continue;

    if (cm % 2 === 0) {
      ctxLeft.beginPath();
      ctxLeft.moveTo(8, y);
      ctxLeft.lineTo(20, y);
      ctxLeft.stroke();
      if (cm >= 0 && y > 25) {
        ctxLeft.fillText(cm.toString(), 7, y + 3);
      }
    } else {
      ctxLeft.beginPath();
      ctxLeft.moveTo(12, y);
      ctxLeft.lineTo(20, y);
      ctxLeft.stroke();
    }

    for (let sub = 1; sub < 5; sub++) {
      const subY = y + (sub * 0.2) * cmPx;
      if (subY >= 0 && subY <= leftH) {
        ctxLeft.beginPath();
        ctxLeft.moveTo(16, subY);
        ctxLeft.lineTo(20, subY);
        ctxLeft.stroke();
      }
    }
  }
  ctxLeft.restore();
}

function renderPersistentGuidesSvg(
  pageIndex: number,
  width: number,
  height: number,
  currentGuidesPreset: '12-col' | '3-col' | '3x3' | 'custom' | null,
  customGuideCols: number,
  customGuideRows: number
): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'collaborative-persistent-guides-svg');
  svg.setAttribute('data-ref', `persistent-guides-svg-${pageIndex}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (currentGuidesPreset === '12-col') {
    const margin = 38;
    const gutter = 16;
    const totalGutters = 11 * gutter;
    const availableWidth = width - 2 * margin - totalGutters;
    const colWidth = Math.max(1, availableWidth / 12);

    for (let i = 0; i < 12; i++) {
      const x1 = margin + i * (colWidth + gutter);
      const x2 = x1 + colWidth;

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('class', 'collaborative-persistent-guide-line');
      line1.setAttribute('x1', x1.toFixed(1));
      line1.setAttribute('y1', '0');
      line1.setAttribute('x2', x1.toFixed(1));
      line1.setAttribute('y2', height.toString());
      svg.appendChild(line1);

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('class', 'collaborative-persistent-guide-line');
      line2.setAttribute('x1', x2.toFixed(1));
      line2.setAttribute('y1', '0');
      line2.setAttribute('x2', x2.toFixed(1));
      line2.setAttribute('y2', height.toString());
      svg.appendChild(line2);
    }
  } else if (currentGuidesPreset === '3-col') {
    const margin = 38;
    const gutter = 24;
    const availableWidth = width - 2 * margin - 2 * gutter;
    const colWidth = Math.max(1, availableWidth / 3);

    for (let i = 0; i < 3; i++) {
      const x1 = margin + i * (colWidth + gutter);
      const x2 = x1 + colWidth;

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('class', 'collaborative-persistent-guide-line');
      line1.setAttribute('x1', x1.toFixed(1));
      line1.setAttribute('y1', '0');
      line1.setAttribute('x2', x1.toFixed(1));
      line1.setAttribute('y2', height.toString());
      svg.appendChild(line1);

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('class', 'collaborative-persistent-guide-line');
      line2.setAttribute('x1', x2.toFixed(1));
      line2.setAttribute('y1', '0');
      line2.setAttribute('x2', x2.toFixed(1));
      line2.setAttribute('y2', height.toString());
      svg.appendChild(line2);
    }
  } else if (currentGuidesPreset === '3x3') {
    const y1 = (height / 3).toFixed(1);
    const y2 = ((2 * height) / 3).toFixed(1);
    const x1 = (width / 3).toFixed(1);
    const x2 = ((2 * width) / 3).toFixed(1);

    for (const y of [y1, y2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y);
      svg.appendChild(line);
    }

    for (const x of [x1, x2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x);
      line.setAttribute('y2', height.toString());
      svg.appendChild(line);
    }
  } else if (currentGuidesPreset === 'custom') {
    const cols = Math.max(1, customGuideCols);
    const rows = Math.max(1, customGuideRows);

    for (let i = 1; i < cols; i++) {
      const x = ((i * width) / cols).toFixed(1);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x);
      line.setAttribute('y2', height.toString());
      svg.appendChild(line);
    }

    for (let j = 1; j < rows; j++) {
      const y = ((j * height) / rows).toFixed(1);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'collaborative-persistent-guide-line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y);
      svg.appendChild(line);
    }
  }

  return svg;
}

export { renderPersistentGuidesSvg, updateRulers };
