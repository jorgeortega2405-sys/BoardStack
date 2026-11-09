import { EditorElement, ElementChart, ElementImage, ElementShape, ElementTable, ElementText } from './collaborative-pdf.types.js';

function renderActiveSmartGuides(
  pageIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  otherElements: Array<ElementChart | ElementImage | ElementShape | ElementTable | ElementText>,
  pageDim: { height: number; width: number },
  container: HTMLElement
): void {
  const guidesSvg = container.querySelector<SVGElement>(`[data-ref="guides-svg-${pageIndex}"]`);
  if (!guidesSvg) return;

  guidesSvg.innerHTML = '';

  const pageW = pageDim.width;
  const pageH = pageDim.height;
  const margin = 38;
  const linesToDraw: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];

  const myLeft = x;
  const myCenter = x + width / 2;
  const myRight = x + width;

  const myTop = y;
  const myMiddle = y + height / 2;
  const myBottom = y + height;

  const isClose = (a: number, b: number) => Math.abs(a - b) < 1.5;

  if (isClose(myCenter, pageW / 2)) {
    linesToDraw.push({
      x1: pageW / 2,
      x2: pageW / 2,
      y1: 0,
      y2: pageH,
    });
  }

  if (isClose(myMiddle, pageH / 2)) {
    linesToDraw.push({
      x1: 0,
      x2: pageW,
      y1: pageH / 2,
      y2: pageH / 2,
    });
  }

  if (isClose(myLeft, margin) || isClose(myRight, margin) || isClose(myCenter, margin)) {
    const snapX = isClose(myLeft, margin) ? myLeft : (isClose(myRight, margin) ? myRight : myCenter);
    linesToDraw.push({ x1: snapX, x2: snapX, y1: 0, y2: pageH });
  }
  if (isClose(myRight, pageW - margin) || isClose(myLeft, pageW - margin) || isClose(myCenter, pageW - margin)) {
    const snapX = isClose(myRight, pageW - margin) ? myRight : (isClose(myLeft, pageW - margin) ? myLeft : myCenter);
    linesToDraw.push({ x1: snapX, x2: snapX, y1: 0, y2: pageH });
  }

  if (isClose(myTop, margin) || isClose(myBottom, margin) || isClose(myMiddle, margin)) {
    const snapY = isClose(myTop, margin) ? myTop : (isClose(myBottom, margin) ? myBottom : myMiddle);
    linesToDraw.push({ x1: 0, x2: pageW, y1: snapY, y2: snapY });
  }
  if (isClose(myBottom, pageH - margin) || isClose(myTop, pageH - margin) || isClose(myMiddle, pageH - margin)) {
    const snapY = isClose(myBottom, pageH - margin) ? myBottom : (isClose(myTop, pageH - margin) ? myTop : myMiddle);
    linesToDraw.push({ x1: 0, x2: pageW, y1: snapY, y2: snapY });
  }

  const vCoords = [myLeft, myCenter, myRight];
  for (const vX of vCoords) {
    const matchingOthers: Array<ElementChart | ElementImage | ElementShape | ElementTable | ElementText> = [];
    for (const other of otherElements) {
      const oW = other.width || 100;
      const oLeft = other.x;
      const oCenter = other.x + oW / 2;
      const oRight = other.x + oW;
      if (isClose(vX, oLeft) || isClose(vX, oCenter) || isClose(vX, oRight)) {
        matchingOthers.push(other);
      }
    }

    if (matchingOthers.length > 0) {
      let minY = myTop;
      let maxY = myBottom;
      for (const m of matchingOthers) {
        const mTop = m.y;
        const mBottom = m.y + (m.height || 40);
        if (mTop < minY) minY = mTop;
        if (mBottom > maxY) maxY = mBottom;
      }
      linesToDraw.push({
        x1: Math.round(vX),
        x2: Math.round(vX),
        y1: Math.max(0, minY - 14),
        y2: Math.min(pageH, maxY + 14),
      });
    }
  }

  const hCoords = [myTop, myMiddle, myBottom];
  for (const hY of hCoords) {
    const matchingOthers: Array<ElementChart | ElementImage | ElementShape | ElementTable | ElementText> = [];
    for (const other of otherElements) {
      const oH = other.height || 40;
      const oTop = other.y;
      const oMiddle = other.y + oH / 2;
      const oBottom = other.y + oH;
      if (isClose(hY, oTop) || isClose(hY, oMiddle) || isClose(hY, oBottom)) {
        matchingOthers.push(other);
      }
    }

    if (matchingOthers.length > 0) {
      let minX = myLeft;
      let maxX = myRight;
      for (const m of matchingOthers) {
        const mLeft = m.x;
        const mRight = m.x + (m.width || 100);
        if (mLeft < minX) minX = mLeft;
        if (mRight > maxX) maxX = mRight;
      }
      linesToDraw.push({
        x1: Math.max(0, minX - 14),
        x2: Math.min(pageW, maxX + 14),
        y1: Math.round(hY),
        y2: Math.round(hY),
      });
    }
  }

  const drawnLineKeys = new Set<string>();
  for (const l of linesToDraw) {
    const key = `${l.x1}_${l.y1}_${l.x2}_${l.y2}`;
    if (drawnLineKeys.has(key)) continue;
    drawnLineKeys.add(key);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'collaborative-guide-line');
    line.setAttribute('x1', l.x1.toString());
    line.setAttribute('y1', l.y1.toString());
    line.setAttribute('x2', l.x2.toString());
    line.setAttribute('y2', l.y2.toString());
    guidesSvg.appendChild(line);
  }

  const renderBadge = (cx: number, cy: number, dist: number) => {
    if (dist <= 0) return;
    const textVal = `${Math.round(dist)} px`;
    const badgeW = Math.max(38, textVal.length * 6.5 + 10);
    const badgeH = 18;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'collaborative-guide-badge-group');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', (cx - badgeW / 2).toFixed(1));
    rect.setAttribute('y', (cy - badgeH / 2).toFixed(1));
    rect.setAttribute('width', badgeW.toFixed(1));
    rect.setAttribute('height', badgeH.toFixed(1));
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', '#000000');
    rect.setAttribute('opacity', '0.92');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx.toFixed(1));
    text.setAttribute('y', (cy + 1).toFixed(1));
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    text.setAttribute('font-weight', '600');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = textVal;

    g.appendChild(rect);
    g.appendChild(text);
    guidesSvg.appendChild(g);
  };

  let closestLeft: { cy: number; gap: number; oRight: number } | null = null;
  let closestRight: { cy: number; gap: number; oLeft: number } | null = null;
  let closestTop: { cx: number; gap: number; oBottom: number } | null = null;
  let closestBottom: { cx: number; gap: number; oTop: number } | null = null;

  for (const other of otherElements) {
    const oW = other.width || 100;
    const oH = other.height || 40;
    const oLeft = other.x;
    const oRight = other.x + oW;
    const oTop = other.y;
    const oBottom = other.y + oH;

    const yOverlap = Math.max(myTop, oTop) < Math.min(myBottom, oBottom);
    if (yOverlap) {
      if (oRight <= myLeft) {
        const gap = myLeft - oRight;
        if (gap >= 4 && gap <= 300 && (!closestLeft || gap < closestLeft.gap)) {
          const cy = Math.max(myTop, oTop) + Math.min(myBottom - myTop, oBottom - oTop) / 2;
          closestLeft = { cy, gap, oRight };
        }
      } else if (myRight <= oLeft) {
        const gap = oLeft - myRight;
        if (gap >= 4 && gap <= 300 && (!closestRight || gap < closestRight.gap)) {
          const cy = Math.max(myTop, oTop) + Math.min(myBottom - myTop, oBottom - oTop) / 2;
          closestRight = { cy, gap, oLeft };
        }
      }
    }

    const xOverlap = Math.max(myLeft, oLeft) < Math.min(myRight, oRight);
    if (xOverlap) {
      if (oBottom <= myTop) {
        const gap = myTop - oBottom;
        if (gap >= 4 && gap <= 300 && (!closestTop || gap < closestTop.gap)) {
          const cx = Math.max(myLeft, oLeft) + Math.min(myRight - myLeft, oRight - oLeft) / 2;
          closestTop = { cx, gap, oBottom };
        }
      } else if (myBottom <= oTop) {
        const gap = oTop - myBottom;
        if (gap >= 4 && gap <= 300 && (!closestBottom || gap < closestBottom.gap)) {
          const cx = Math.max(myLeft, oLeft) + Math.min(myRight - myLeft, oRight - oLeft) / 2;
          closestBottom = { cx, gap, oTop };
        }
      }
    }
  }

  if (closestLeft) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('class', 'collaborative-guide-line');
    tick.setAttribute('x1', closestLeft.oRight.toFixed(1));
    tick.setAttribute('x2', myLeft.toFixed(1));
    tick.setAttribute('y1', closestLeft.cy.toFixed(1));
    tick.setAttribute('y2', closestLeft.cy.toFixed(1));
    guidesSvg.appendChild(tick);
    renderBadge((closestLeft.oRight + myLeft) / 2, closestLeft.cy, closestLeft.gap);
  }
  if (closestRight) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('class', 'collaborative-guide-line');
    tick.setAttribute('x1', myRight.toFixed(1));
    tick.setAttribute('x2', closestRight.oLeft.toFixed(1));
    tick.setAttribute('y1', closestRight.cy.toFixed(1));
    tick.setAttribute('y2', closestRight.cy.toFixed(1));
    guidesSvg.appendChild(tick);
    renderBadge((myRight + closestRight.oLeft) / 2, closestRight.cy, closestRight.gap);
  }
  if (closestTop) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('class', 'collaborative-guide-line');
    tick.setAttribute('x1', closestTop.cx.toFixed(1));
    tick.setAttribute('x2', closestTop.cx.toFixed(1));
    tick.setAttribute('y1', closestTop.oBottom.toFixed(1));
    tick.setAttribute('y2', myTop.toFixed(1));
    guidesSvg.appendChild(tick);
    renderBadge(closestTop.cx, (closestTop.oBottom + myTop) / 2, closestTop.gap);
  }
  if (closestBottom) {
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('class', 'collaborative-guide-line');
    tick.setAttribute('x1', closestBottom.cx.toFixed(1));
    tick.setAttribute('x2', closestBottom.cx.toFixed(1));
    tick.setAttribute('y1', myBottom.toFixed(1));
    tick.setAttribute('y2', closestBottom.oTop.toFixed(1));
    guidesSvg.appendChild(tick);
    renderBadge(closestBottom.cx, (myBottom + closestBottom.oTop) / 2, closestBottom.gap);
  }
}

function applySmartGuides(
  item: { height?: number; id: string; pageIndex?: number; width?: number },
  rawX: number,
  rawY: number,
  elements: EditorElement[],
  pageDim: { height: number; width: number },
  container: HTMLElement
): { x: number; y: number } {
  const pageIndex = item.pageIndex ?? 0;
  const width = item.width || 100;
  const height = item.height || 40;
  const threshold = 6;
  const margin = 38;

  const otherElements = elements.filter(
    (el): el is ElementChart | ElementImage | ElementShape | ElementTable | ElementText =>
      el.id !== item.id && (el.pageIndex ?? 0) === pageIndex && el.type !== 'drawing'
  );

  const pageW = pageDim.width;
  const pageH = pageDim.height;
  let bestDiffX: number | null = null;
  let snappedX = rawX;

  const checkSnapX = (current: number, target: number) => {
    const diff = target - current;
    if (Math.abs(diff) <= threshold) {
      if (bestDiffX === null || Math.abs(diff) < Math.abs(bestDiffX)) {
        bestDiffX = diff;
      }
    }
  };

  checkSnapX(rawX + width / 2, pageW / 2);
  checkSnapX(rawX, 0);
  checkSnapX(rawX + width, pageW);
  checkSnapX(rawX, margin);
  checkSnapX(rawX + width, pageW - margin);
  checkSnapX(rawX + width / 2, margin);
  checkSnapX(rawX + width / 2, pageW - margin);

  for (const other of otherElements) {
    const oW = other.width || 100;
    const oLeft = other.x;
    const oCenter = other.x + oW / 2;
    const oRight = other.x + oW;

    checkSnapX(rawX, oLeft);
    checkSnapX(rawX, oRight);
    checkSnapX(rawX, oCenter);

    checkSnapX(rawX + width / 2, oCenter);
    checkSnapX(rawX + width / 2, oLeft);
    checkSnapX(rawX + width / 2, oRight);

    checkSnapX(rawX + width, oRight);
    checkSnapX(rawX + width, oLeft);
    checkSnapX(rawX + width, oCenter);
  }

  if (bestDiffX !== null) {
    snappedX = rawX + bestDiffX;
  }

  let bestDiffY: number | null = null;
  let snappedY = rawY;

  const checkSnapY = (current: number, target: number) => {
    const diff = target - current;
    if (Math.abs(diff) <= threshold) {
      if (bestDiffY === null || Math.abs(diff) < Math.abs(bestDiffY)) {
        bestDiffY = diff;
      }
    }
  };

  checkSnapY(rawY + height / 2, pageH / 2);
  checkSnapY(rawY, 0);
  checkSnapY(rawY + height, pageH);
  checkSnapY(rawY, margin);
  checkSnapY(rawY + height, pageH - margin);
  checkSnapY(rawY + height / 2, margin);
  checkSnapY(rawY + height / 2, pageH - margin);

  for (const other of otherElements) {
    const oH = other.height || 40;
    const oTop = other.y;
    const oCenter = other.y + oH / 2;
    const oBottom = other.y + oH;

    checkSnapY(rawY, oTop);
    checkSnapY(rawY, oBottom);
    checkSnapY(rawY, oCenter);

    checkSnapY(rawY + height / 2, oCenter);
    checkSnapY(rawY + height / 2, oTop);
    checkSnapY(rawY + height / 2, oBottom);

    checkSnapY(rawY + height, oBottom);
    checkSnapY(rawY + height, oTop);
    checkSnapY(rawY + height, oCenter);
  }

  if (bestDiffY !== null) {
    snappedY = rawY + bestDiffY;
  }

  renderActiveSmartGuides(pageIndex, snappedX, snappedY, width, height, otherElements, pageDim, container);

  return { x: snappedX, y: snappedY };
}

function clearSmartGuides(container: HTMLElement, pageIndex?: number): void {
  if (pageIndex !== undefined) {
    const svg = container.querySelector<SVGElement>(`[data-ref="guides-svg-${pageIndex}"]`);
    if (svg) svg.innerHTML = '';
  } else {
    const svgs = container.querySelectorAll<SVGElement>('.collaborative-guides-svg');
    svgs.forEach((svg) => {
      svg.innerHTML = '';
    });
  }
}

export { applySmartGuides, clearSmartGuides, renderActiveSmartGuides };
