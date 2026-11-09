import { ElementShape } from './collaborative-pdf.types.js';

function renderShapeGeometry(el: ElementShape, fill: string, stroke: string, strokeWidth: number, w: number, h: number, strokeDash = ''): string {
  const generateStarPolygon = (nPoints: number, innerRatio: number): string => {
    const cx = w / 2;
    const cy = h / 2;
    const rxOuter = w / 2;
    const ryOuter = h / 2;
    const rxInner = rxOuter * innerRatio;
    const ryInner = ryOuter * innerRatio;
    const pts: string[] = [];
    const total = nPoints * 2;
    for (let i = 0; i < total; i++) {
      const angle = (i * Math.PI) / nPoints - Math.PI / 2;
      const rx = i % 2 === 0 ? rxOuter : rxInner;
      const ry = i % 2 === 0 ? ryOuter : ryInner;
      pts.push(`${(cx + rx * Math.cos(angle)).toFixed(1)},${(cy + ry * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const generateRegularPolygon = (sides: number): string => {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const pts: string[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      pts.push(`${(cx + rx * Math.cos(angle)).toFixed(1)},${(cy + ry * Math.sin(angle)).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const generateGearPath = (teeth: number, toothDepth = 0.22, holeRatio = 0.35): string => {
    const cx = w / 2;
    const cy = h / 2;
    const rxOuter = w / 2;
    const ryOuter = h / 2;
    const rxRoot = rxOuter * (1 - toothDepth);
    const ryRoot = ryOuter * (1 - toothDepth);
    const rxHole = rxOuter * holeRatio;
    const ryHole = ryOuter * holeRatio;
    const pts: string[] = [];
    const total = teeth * 4;

    for (let i = 0; i < total; i++) {
      const angle = (i * 2 * Math.PI) / total - Math.PI / 2;
      const isOuter = i % 4 === 1 || i % 4 === 2;
      const rx = isOuter ? rxOuter : rxRoot;
      const ry = isOuter ? ryOuter : ryRoot;
      pts.push(`${(cx + rx * Math.cos(angle)).toFixed(1)},${(cy + ry * Math.sin(angle)).toFixed(1)}`);
    }

    const outerPoly = `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
    const holeCircle = `M ${cx} ${(cy - ryHole).toFixed(1)} A ${rxHole.toFixed(1)} ${ryHole.toFixed(1)} 0 1 0 ${cx} ${(cy + ryHole).toFixed(1)} A ${rxHole.toFixed(1)} ${ryHole.toFixed(1)} 0 1 0 ${cx} ${(cy - ryHole).toFixed(1)} Z`;
    return `${outerPoly} ${holeCircle}`;
  };

  const generateFlowerPath = (petals: number, innerRatio = 0.3): string => {
    const cx = w / 2;
    const cy = h / 2;
    const rxOuter = w / 2;
    const ryOuter = h / 2;
    const rxInner = rxOuter * innerRatio;
    const ryInner = ryOuter * innerRatio;
    let d = '';
    for (let i = 0; i < petals; i++) {
      const aStart = (i * 2 * Math.PI) / petals - Math.PI / 2;
      const aEnd = ((i + 1) * 2 * Math.PI) / petals - Math.PI / 2;
      const aMid = (aStart + aEnd) / 2;

      const pTipX = (cx + rxOuter * Math.cos(aMid)).toFixed(1);
      const pTipY = (cy + ryOuter * Math.sin(aMid)).toFixed(1);

      const pIn1X = (cx + rxInner * Math.cos(aStart)).toFixed(1);
      const pIn1Y = (cy + ryInner * Math.sin(aStart)).toFixed(1);

      const pIn2X = (cx + rxInner * Math.cos(aEnd)).toFixed(1);
      const pIn2Y = (cy + ryInner * Math.sin(aEnd)).toFixed(1);

      if (i === 0) d += `M ${pIn1X} ${pIn1Y} `;
      d += `Q ${pTipX} ${pTipY} ${pIn2X} ${pIn2Y} `;
    }
    return `${d}Z`;
  };

  if (el.sides && el.sides >= 3 && el.shapeType !== 'circle') {
    if (el.sides === 4 && (el.shapeType === 'rect' || el.shapeType === 'rounded-rect')) {
      const rx = el.borderRadius !== undefined ? el.borderRadius : 0;
      return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
    }
    return `<polygon points="${generateRegularPolygon(el.sides)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType.startsWith('line-')) {
    const stCol = stroke !== 'none' ? stroke : fill;
    const sw = strokeWidth || 3;
    const midY = h / 2;
    let lineDash = strokeDash;
    if (el.shapeType.includes('dashed')) {
      lineDash = strokeDash || 'stroke-dasharray="8,5"';
    } else if (el.shapeType.includes('dotted')) {
      lineDash = strokeDash || 'stroke-dasharray="2,5" stroke-linecap="round"';
    }

    if (el.shapeType.startsWith('line-arrow-')) {
      const x2 = w - 10;
      return `<g><line x1="0" y1="${midY}" x2="${x2}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><polygon points="${w},${midY} ${w - 14},${midY - 7} ${w - 11},${midY} ${w - 14},${midY + 7}" fill="${stCol}"/></g>`;
    }
    if (el.shapeType.startsWith('line-double-arrow-')) {
      return `<g><line x1="10" y1="${midY}" x2="${w - 10}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><polygon points="0,${midY} 14,${midY - 7} 11,${midY} 14,${midY + 7}" fill="${stCol}"/><polygon points="${w},${midY} ${w - 14},${midY - 7} ${w - 11},${midY} ${w - 14},${midY + 7}" fill="${stCol}"/></g>`;
    }
    if (el.shapeType === 'line-endpoint-square-solid') {
      return `<g><line x1="8" y1="${midY}" x2="${w - 8}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><rect x="0" y="${midY - 5}" width="10" height="10" fill="${stCol}"/><rect x="${w - 10}" y="${midY - 5}" width="10" height="10" fill="${stCol}"/></g>`;
    }
    if (el.shapeType === 'line-endpoint-circle-solid') {
      return `<g><line x1="6" y1="${midY}" x2="${w - 6}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><circle cx="6" cy="${midY}" r="5" fill="${stCol}"/><circle cx="${w - 6}" cy="${midY}" r="5" fill="${stCol}"/></g>`;
    }
    if (el.shapeType === 'line-endpoint-diamond-solid') {
      return `<g><line x1="7" y1="${midY}" x2="${w - 7}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><polygon points="7,${midY - 6} 14,${midY} 7,${midY + 6} 0,${midY}" fill="${stCol}"/><polygon points="${w - 7},${midY - 6} ${w},${midY} ${w - 7},${midY + 6} ${w - 14},${midY}" fill="${stCol}"/></g>`;
    }
    if (el.shapeType === 'line-endpoint-square-hollow') {
      return `<g><line x1="8" y1="${midY}" x2="${w - 8}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><rect x="1" y="${midY - 5}" width="10" height="10" fill="none" stroke="${stCol}" stroke-width="${Math.max(1.5, sw)}"/><rect x="${w - 11}" y="${midY - 5}" width="10" height="10" fill="none" stroke="${stCol}" stroke-width="${Math.max(1.5, sw)}"/></g>`;
    }
    if (el.shapeType === 'line-endpoint-circle-hollow') {
      return `<g><line x1="6" y1="${midY}" x2="${w - 6}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><circle cx="6" cy="${midY}" r="5" fill="none" stroke="${stCol}" stroke-width="${Math.max(1.5, sw)}"/><circle cx="${w - 6}" cy="${midY}" r="5" fill="none" stroke="${stCol}" stroke-width="${Math.max(1.5, sw)}"/></g>`;
    }
    if (el.shapeType === 'line-endpoint-diamond-hollow') {
      return `<g><line x1="7" y1="${midY}" x2="${w - 7}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash}/><polygon points="7,${midY - 6} 14,${midY} 7,${midY + 6} 0,${midY}" fill="none" stroke="${stCol}" stroke-width="${Math.max(1.5, sw)}"/><polygon points="${w - 7},${midY - 6} ${w},${midY} ${w - 7},${midY + 6} ${w - 14},${midY}" fill="none" stroke="${stCol}" stroke-width="${Math.max(1.5, sw)}"/></g>`;
    }
    return `<line x1="0" y1="${midY}" x2="${w}" y2="${midY}" stroke="${stCol}" stroke-width="${sw}" ${lineDash} />`;
  }

  if (el.shapeType === 'rect') {
    const rx = el.borderRadius !== undefined ? el.borderRadius : 0;
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'rounded-rect') {
    const rx = el.borderRadius !== undefined ? el.borderRadius : Math.min(w, h) * 0.18;
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'circle') {
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'triangle') {
    return `<polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'triangle-down') {
    return `<polygon points="0,0 ${w},0 ${w / 2},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'diamond') {
    return `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'cross') {
    const cx1 = w * 0.35;
    const cx2 = w * 0.65;
    const cy1 = h * 0.35;
    const cy2 = h * 0.65;
    return `<polygon points="${cx1},0 ${cx2},0 ${cx2},${cy1} ${w},${cy1} ${w},${cy2} ${cx2},${cy2} ${cx2},${h} ${cx1},${h} ${cx1},${cy2} 0,${cy2} 0,${cy1} ${cx1},${cy1}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'plaque') {
    return `<path d="M 0 ${h * 0.15} Q ${w / 2} 0 ${w} ${h * 0.15} V ${h * 0.85} Q ${w / 2} ${h} 0 ${h * 0.85} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'scalloped-rect') {
    const r = el.borderRadius !== undefined ? el.borderRadius : Math.min(w, h) * 0.15;
    return `<path d="M ${r} 0 H ${w - r} A ${r} ${r} 0 0 0 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 0 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 0 0 ${h - r} V ${r} A ${r} ${r} 0 0 0 ${r} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'parallelogram-right') {
    return `<polygon points="${w * 0.25},0 ${w},0 ${w * 0.75},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'parallelogram-left') {
    return `<polygon points="0,0 ${w * 0.75},0 ${w},${h} ${w * 0.25},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'trapezoid') {
    return `<polygon points="${w * 0.2},0 ${w * 0.8},0 ${w},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'trapezoid-inverted') {
    return `<polygon points="0,0 ${w},0 ${w * 0.8},${h} ${w * 0.2},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'shield') {
    return `<path d="M 0 0 H ${w} V ${h * 0.6} C ${w} ${h * 0.9} ${w / 2} ${h} ${w / 2} ${h} C ${w / 2} ${h} 0 ${h * 0.9} 0 ${h * 0.6} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arch') {
    return `<path d="M 0 ${h} V ${h * 0.45} C 0 ${-h * 0.05} ${w} ${-h * 0.05} ${w} ${h * 0.45} V ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'right-triangle') {
    return `<polygon points="0,0 0,${h} ${w},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'semicircle') {
    return `<path d="M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'quarter-circle') {
    return `<path d="M 0 ${h} V 0 A ${w} ${h} 0 0 1 ${w} ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'quarter-circle-arc') {
    const t = Math.min(w, h) * 0.35;
    return `<path d="M 0 ${h} H ${t} A ${w - t} ${h - t} 0 0 1 ${w} ${h - t} V 0 A ${w} ${h} 0 0 0 0 ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'semicircle-arc') {
    const t = Math.min(w, h) * 0.35;
    return `<path d="M 0 ${h} H ${t} A ${w / 2 - t} ${h - t} 0 0 1 ${w - t} ${h} H ${w} A ${w / 2} ${h} 0 0 0 0 ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'pentagon') {
    return `<polygon points="${generateRegularPolygon(5)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'hexagon-vertical') {
    return `<polygon points="${w * 0.5},0 ${w},${h * 0.25} ${w},${h * 0.75} ${w * 0.5},${h} 0,${h * 0.75} 0,${h * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'hexagon') {
    return `<polygon points="${w * 0.25},0 ${w * 0.75},0 ${w},${h * 0.5} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'octagon') {
    const c = 0.2929;
    return `<polygon points="${w * c},0 ${w * (1 - c)},0 ${w},${h * c} ${w},${h * (1 - c)} ${w * (1 - c)},${h} ${w * c},${h} 0,${h * (1 - c)} 0,${h * c}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'chamfered-rect') {
    const c = el.borderRadius !== undefined ? el.borderRadius : Math.min(w, h) * 0.15;
    return `<polygon points="${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'heptagon') {
    return `<polygon points="${generateRegularPolygon(7)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'decagon') {
    return `<polygon points="${generateRegularPolygon(10)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'star-4') {
    return `<polygon points="${generateStarPolygon(4, 0.28)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star' || el.shapeType === 'star-5') {
    return `<polygon points="${generateStarPolygon(5, 0.42)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-6') {
    return `<polygon points="${generateStarPolygon(6, 0.58)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-7') {
    return `<polygon points="${generateStarPolygon(7, 0.5)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-8') {
    return `<polygon points="${generateStarPolygon(8, 0.68)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-8-soft') {
    return `<polygon points="${generateStarPolygon(8, 0.78)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-12') {
    return `<polygon points="${generateStarPolygon(12, 0.78)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-16') {
    return `<polygon points="${generateStarPolygon(16, 0.82)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-24') {
    return `<polygon points="${generateStarPolygon(24, 0.88)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'star-32') {
    return `<polygon points="${generateStarPolygon(32, 0.91)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flare-8') {
    return `<polygon points="${generateStarPolygon(8, 0.16)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flare-12') {
    return `<polygon points="${generateStarPolygon(12, 0.18)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flare-16') {
    return `<polygon points="${generateStarPolygon(16, 0.2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'badge' || el.shapeType === 'badge-20' || el.shapeType === 'badge-scallop') {
    return `<polygon points="${generateStarPolygon(16, 0.86)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'arrow-block-right') {
    return `<polygon points="0,${h * 0.25} ${w * 0.55},${h * 0.25} ${w * 0.55},0 ${w},${h * 0.5} ${w * 0.55},${h} ${w * 0.55},${h * 0.75} 0,${h * 0.75}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-block-left') {
    return `<polygon points="${w},${h * 0.25} ${w * 0.45},${h * 0.25} ${w * 0.45},0 0,${h * 0.5} ${w * 0.45},${h} ${w * 0.45},${h * 0.75} ${w},${h * 0.75}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-block-up') {
    return `<polygon points="${w * 0.25},${h} ${w * 0.25},${h * 0.55} 0,${h * 0.55} ${w * 0.5},0 ${w},${h * 0.55} ${w * 0.75},${h * 0.55} ${w * 0.75},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-block-down') {
    return `<polygon points="${w * 0.25},0 ${w * 0.25},${h * 0.45} 0,${h * 0.45} ${w * 0.5},${h} ${w},${h * 0.45} ${w * 0.75},${h * 0.45} ${w * 0.75},0" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-double-horizontal') {
    return `<polygon points="${w * 0.25},0 0,${h * 0.5} ${w * 0.25},${h} ${w * 0.25},${h * 0.7} ${w * 0.75},${h * 0.7} ${w * 0.75},${h} ${w},${h * 0.5} ${w * 0.75},0 ${w * 0.75},${h * 0.3} ${w * 0.25},${h * 0.3}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-double-vertical') {
    return `<polygon points="0,${h * 0.25} ${w * 0.5},0 ${w},${h * 0.25} ${w * 0.7},${h * 0.25} ${w * 0.7},${h * 0.75} ${w},${h * 0.75} ${w * 0.5},${h} 0,${h * 0.75} ${w * 0.3},${h * 0.75} ${w * 0.3},${h * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-pentagon-right') {
    return `<polygon points="0,0 ${w * 0.7},0 ${w},${h * 0.5} ${w * 0.7},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-chevron-right') {
    return `<polygon points="0,0 ${w * 0.65},0 ${w},${h * 0.5} ${w * 0.65},${h} 0,${h} ${w * 0.35},${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-notched-left') {
    return `<polygon points="${w},0 ${w * 0.4},0 ${w * 0.4},${h * 0.2} 0,${h * 0.5} ${w * 0.4},${h * 0.8} ${w * 0.4},${h} ${w},${h} ${w * 0.75},${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'arrow-bidirectional-bold') {
    return `<polygon points="${w * 0.28},${h * 0.15} 0,${h * 0.5} ${w * 0.28},${h * 0.85} ${w * 0.28},${h * 0.65} ${w * 0.72},${h * 0.65} ${w * 0.72},${h * 0.85} ${w},${h * 0.5} ${w * 0.72},${h * 0.15} ${w * 0.72},${h * 0.35} ${w * 0.28},${h * 0.35}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'flowchart-preparation') {
    return `<polygon points="${w * 0.2},0 ${w * 0.8},0 ${w},${h * 0.5} ${w * 0.8},${h} ${w * 0.2},${h} 0,${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-terminator') {
    const rx = el.borderRadius !== undefined ? Math.min(el.borderRadius, h / 2) : h / 2;
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-process-rounded') {
    const rx = el.borderRadius !== undefined ? el.borderRadius : Math.min(w, h) * 0.15;
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-decision') {
    return `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-document') {
    return `<path d="M 0 0 H ${w} V ${h * 0.78} C ${w * 0.78} ${h * 0.94} ${w * 0.68} ${h * 0.66} ${w * 0.48} ${h * 0.82} C ${w * 0.32} ${h * 0.95} ${w * 0.16} ${h * 0.82} 0 ${h * 0.88} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-data') {
    return `<polygon points="${w * 0.22},0 ${w},0 ${w * 0.78},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-manual') {
    return `<polygon points="0,0 ${w},0 ${w * 0.82},${h} ${w * 0.18},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-delay') {
    return `<path d="M 0 0 H ${w * 0.55} A ${h / 2} ${h / 2} 0 0 1 ${w * 0.55} ${h} H 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-merge') {
    return `<polygon points="0,0 ${w},0 ${w / 2},${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-display') {
    return `<polygon points="${w * 0.25},0 ${w},0 ${w},${h} ${w * 0.25},${h} 0,${h * 0.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'flowchart-offpage') {
    return `<polygon points="0,0 ${w},0 ${w},${h * 0.65} ${w * 0.5},${h} 0,${h * 0.65}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'callout-rect' || el.shapeType === 'callout') {
    return `<path d="M 0 0 H ${w} V ${h * 0.72} H ${w * 0.45} L ${w * 0.25} ${h} L ${w * 0.32} ${h * 0.72} H 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'callout-rounded') {
    const r = el.borderRadius !== undefined ? el.borderRadius : Math.min(w, h) * 0.12;
    const b = h * 0.72;
    return `<path d="M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${b - r} A ${r} ${r} 0 0 1 ${w - r} ${b} H ${w * 0.45} L ${w * 0.25} ${h} L ${w * 0.32} ${b} H ${r} A ${r} ${r} 0 0 1 0 ${b - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'callout-oval') {
    return `<path d="M ${w * 0.5} 0 C ${w * 0.85} 0 ${w} ${h * 0.28} ${w} ${h * 0.45} C ${w} ${h * 0.62} ${w * 0.82} ${h * 0.75} ${w * 0.55} ${h * 0.75} L ${w * 0.3} ${h} L ${w * 0.4} ${h * 0.74} C ${w * 0.18} ${h * 0.72} 0 ${h * 0.6} 0 ${h * 0.45} C 0 ${h * 0.28} ${w * 0.15} 0 ${w * 0.5} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'callout-thought') {
    return `<g><path d="M ${w * 0.3} ${h * 0.7} C ${w * 0.12} ${h * 0.7} 0 ${h * 0.58} 0 ${h * 0.42} C 0 ${h * 0.26} ${w * 0.12} ${h * 0.14} ${w * 0.28} ${h * 0.14} C ${w * 0.35} ${h * 0.05} ${w * 0.55} 0 ${w * 0.65} ${h * 0.1} C ${w * 0.75} ${h * 0.05} ${w * 0.9} ${h * 0.12} ${w * 0.95} ${h * 0.25} C ${w * 1.02} ${h * 0.35} ${w} ${h * 0.52} ${w * 0.9} ${h * 0.6} C ${w * 0.88} ${h * 0.7} ${w * 0.72} ${h * 0.74} ${w * 0.62} ${h * 0.7} C ${w * 0.52} ${h * 0.76} ${w * 0.38} ${h * 0.75} ${w * 0.3} ${h * 0.7} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} /><circle cx="${w * 0.22}" cy="${h * 0.84}" r="${Math.min(w, h) * 0.06}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/><circle cx="${w * 0.14}" cy="${h * 0.94}" r="${Math.min(w, h) * 0.038}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/></g>`;
  }
  if (el.shapeType === 'callout-capsule') {
    const rx = el.borderRadius !== undefined ? Math.min(el.borderRadius, (h * 0.72) / 2) : (h * 0.72) / 2;
    const b = h * 0.72;
    return `<path d="M ${rx} 0 H ${w - rx} A ${rx} ${rx} 0 0 1 ${w} ${rx} V ${b - rx} A ${rx} ${rx} 0 0 1 ${w - rx} ${b} H ${w * 0.45} L ${w * 0.25} ${h} L ${w * 0.32} ${b} H ${rx} A ${rx} ${rx} 0 0 1 0 ${b - rx} V ${rx} A ${rx} ${rx} 0 0 1 ${rx} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'cloud-puffy' || el.shapeType === 'cloud') {
    return `<path d="M ${w * 0.22} ${h * 0.75} C ${w * 0.08} ${h * 0.75} 0 ${h * 0.62} 0 ${h * 0.48} C 0 ${h * 0.34} ${w * 0.1} ${h * 0.22} ${w * 0.25} ${h * 0.22} C ${w * 0.32} ${h * 0.08} ${w * 0.52} 0 ${w * 0.65} ${h * 0.12} C ${w * 0.78} ${h * 0.06} ${w * 0.92} ${h * 0.16} ${w * 0.96} ${h * 0.3} C ${w * 1.02} ${h * 0.42} ${w * 0.98} ${h * 0.58} ${w * 0.9} ${h * 0.66} C ${w * 0.96} ${h * 0.75} ${w * 0.88} ${h * 0.75} ${w * 0.82} ${h * 0.75} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'cloud-layered') {
    return `<path d="M 0 ${h * 0.65} Q ${w * 0.2} ${h * 0.35} ${w * 0.45} ${h * 0.45} Q ${w * 0.65} ${h * 0.15} ${w * 0.85} ${h * 0.4} Q ${w} ${h * 0.48} ${w} ${h * 0.75} H 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'cloud-wide') {
    return `<path d="M ${w * 0.12} ${h * 0.75} C ${w * 0.02} ${h * 0.75} 0 ${h * 0.6} 0 ${h * 0.5} C 0 ${h * 0.35} ${w * 0.1} ${h * 0.25} ${w * 0.22} ${h * 0.25} C ${w * 0.3} ${h * 0.1} ${w * 0.48} 0 ${w * 0.62} ${h * 0.12} C ${w * 0.75} ${h * 0.05} ${w * 0.88} ${h * 0.18} ${w * 0.92} ${h * 0.32} C ${w} ${h * 0.42} ${w} ${h * 0.6} ${w * 0.9} ${h * 0.75} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'cloud-compact') {
    return `<path d="M ${w * 0.25} ${h * 0.82} C ${w * 0.1} ${h * 0.82} 0 ${h * 0.68} 0 ${h * 0.52} C 0 ${h * 0.35} ${w * 0.15} ${h * 0.25} ${w * 0.32} ${h * 0.25} C ${w * 0.4} ${h * 0.08} ${w * 0.65} 0 ${w * 0.78} ${h * 0.18} C ${w * 0.92} ${h * 0.18} ${w} ${h * 0.35} ${w} ${h * 0.52} C ${w} ${h * 0.7} ${w * 0.88} ${h * 0.82} ${w * 0.75} ${h * 0.82} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'cloud-high-dome') {
    return `<path d="M ${w * 0.18} ${h * 0.8} C ${w * 0.05} ${h * 0.8} 0 ${h * 0.65} 0 ${h * 0.5} C 0 ${h * 0.38} ${w * 0.12} ${h * 0.3} ${w * 0.25} ${h * 0.3} C ${w * 0.28} ${h * 0.1} ${w * 0.48} 0 ${w * 0.6} 0 C ${w * 0.72} 0 ${w * 0.82} ${h * 0.12} ${w * 0.85} ${h * 0.3} C ${w * 0.95} ${h * 0.38} ${w} ${h * 0.52} ${w} ${h * 0.65} C ${w} ${h * 0.8} ${w * 0.88} ${h * 0.8} ${w * 0.82} ${h * 0.8} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'teardrop-straight') {
    return `<path d="M ${w / 2} 0 C ${w * 0.75} ${h * 0.35} ${w} ${h * 0.6} ${w} ${h * 0.75} C ${w} ${h * 0.88} ${w * 0.78} ${h} ${w / 2} ${h} C ${w * 0.22} ${h} 0 ${h * 0.88} 0 ${h * 0.75} C 0 ${h * 0.6} ${w * 0.25} ${h * 0.35} ${w / 2} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'teardrop-elongated') {
    return `<path d="M ${w / 2} 0 C ${w * 0.7} ${h * 0.5} ${w} ${h * 0.72} ${w} ${h * 0.82} C ${w} ${h * 0.92} ${w * 0.78} ${h} ${w / 2} ${h} C ${w * 0.22} ${h} 0 ${h * 0.92} 0 ${h * 0.82} C 0 ${h * 0.72} ${w * 0.3} ${h * 0.5} ${w / 2} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'teardrop-oval') {
    return `<path d="M ${w / 2} 0 C ${w * 0.85} ${h * 0.28} ${w} ${h * 0.55} ${w} ${h * 0.72} C ${w} ${h * 0.88} ${w * 0.78} ${h} ${w / 2} ${h} C ${w * 0.22} ${h} 0 ${h * 0.88} 0 ${h * 0.72} C 0 ${h * 0.55} ${w * 0.15} ${h * 0.28} ${w / 2} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'teardrop-wide') {
    return `<path d="M ${w / 2} 0 C ${w * 0.9} ${h * 0.35} ${w} ${h * 0.6} ${w} ${h * 0.72} C ${w} ${h * 0.88} ${w * 0.78} ${h} ${w / 2} ${h} C ${w * 0.22} ${h} 0 ${h * 0.88} 0 ${h * 0.72} C 0 ${h * 0.6} ${w * 0.1} ${h * 0.35} ${w / 2} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'teardrop-curved') {
    return `<path d="M ${w * 0.3} 0 C ${w * 0.7} 0 ${w} ${h * 0.3} ${w} ${h * 0.62} C ${w} ${h * 0.85} ${w * 0.78} ${h} ${w * 0.5} ${h} C ${w * 0.18} ${h} 0 ${h * 0.82} 0 ${h * 0.58} C 0 ${h * 0.35} ${w * 0.12} ${h * 0.18} ${w * 0.3} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'heart-classic' || el.shapeType === 'heart') {
    return `<path d="M ${w / 2} ${h * 0.85} C ${w * 0.15} ${h * 0.6} 0 ${h * 0.35} 0 ${h * 0.22} C 0 ${h * 0.08} ${w * 0.2} 0 ${w * 0.38} 0 C ${w * 0.45} 0 ${w / 2} ${h * 0.12} ${w / 2} ${h * 0.12} C ${w / 2} ${h * 0.12} ${w * 0.55} 0 ${w * 0.62} 0 C ${w * 0.8} 0 ${w} ${h * 0.08} ${w} ${h * 0.22} C ${w} ${h * 0.35} ${w * 0.85} ${h * 0.6} ${w / 2} ${h * 0.85} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'heart-wide') {
    return `<path d="M ${w / 2} ${h * 0.88} C ${w * 0.1} ${h * 0.55} 0 ${h * 0.32} 0 ${h * 0.2} C 0 ${h * 0.06} ${w * 0.22} 0 ${w * 0.4} 0 C ${w * 0.46} 0 ${w / 2} ${h * 0.1} ${w / 2} ${h * 0.1} C ${w / 2} ${h * 0.1} ${w * 0.54} 0 ${w * 0.6} 0 C ${w * 0.78} 0 ${w} ${h * 0.06} ${w} ${h * 0.2} C ${w} ${h * 0.32} ${w * 0.9} ${h * 0.55} ${w / 2} ${h * 0.88} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'heart-stylized') {
    return `<path d="M ${w / 2} ${h} C ${w * 0.2} ${h * 0.68} 0 ${h * 0.42} 0 ${h * 0.25} C 0 ${h * 0.08} ${w * 0.22} 0 ${w * 0.42} 0 C ${w * 0.48} 0 ${w / 2} ${h * 0.1} ${w / 2} ${h * 0.1} C ${w / 2} ${h * 0.1} ${w * 0.52} 0 ${w * 0.58} 0 C ${w * 0.78} 0 ${w} ${h * 0.08} ${w} ${h * 0.25} C ${w} ${h * 0.42} ${w * 0.8} ${h * 0.68} ${w / 2} ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'heart-tall') {
    return `<path d="M ${w / 2} ${h} C ${w * 0.1} ${h * 0.65} 0 ${h * 0.32} 0 ${h * 0.18} C 0 ${h * 0.05} ${w * 0.18} 0 ${w * 0.36} 0 C ${w * 0.44} 0 ${w / 2} ${h * 0.08} ${w / 2} ${h * 0.08} C ${w / 2} ${h * 0.08} ${w * 0.56} 0 ${w * 0.64} 0 C ${w * 0.82} 0 ${w} ${h * 0.05} ${w} ${h * 0.18} C ${w} ${h * 0.32} ${w * 0.9} ${h * 0.65} ${w / 2} ${h} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'heart-sharp') {
    return `<path d="M ${w / 2} ${h} L 0 ${h * 0.42} C 0 ${h * 0.15} ${w * 0.22} 0 ${w * 0.42} 0 C ${w * 0.48} 0 ${w / 2} ${h * 0.12} ${w / 2} ${h * 0.12} C ${w / 2} ${h * 0.12} ${w * 0.52} 0 ${w * 0.58} 0 C ${w * 0.78} 0 ${w} ${h * 0.15} ${w} ${h * 0.42} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'gear-8') {
    return `<path d="${generateGearPath(8, 0.22, 0.35)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }
  if (el.shapeType === 'gear-12') {
    return `<path d="${generateGearPath(12, 0.20, 0.38)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }
  if (el.shapeType === 'gear-10-sharp') {
    return `<path d="${generateGearPath(10, 0.28, 0.32)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }
  if (el.shapeType === 'gear-14-fine') {
    return `<path d="${generateGearPath(14, 0.18, 0.42)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }
  if (el.shapeType === 'gear-12-industrial') {
    return `<path d="${generateGearPath(12, 0.26, 0.30)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }
  if (el.shapeType === 'gear-16') {
    return `<path d="${generateGearPath(16, 0.16, 0.45)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }

  if (el.shapeType === 'banner-ribbon-horizontal') {
    return `<path d="M ${w * 0.12} ${h * 0.25} H ${w * 0.88} V ${h * 0.75} H ${w * 0.12} Z M 0 ${h * 0.4} L ${w * 0.08} ${h * 0.55} L 0 ${h * 0.7} L ${w * 0.12} ${h * 0.65} V ${h * 0.35} Z M ${w} ${h * 0.4} L ${w * 0.92} ${h * 0.55} L ${w} ${h * 0.7} L ${w * 0.88} ${h * 0.65} V ${h * 0.35} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'banner-pennant-point') {
    return `<polygon points="0,${h * 0.15} ${w},${h * 0.5} 0,${h * 0.85}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'banner-swallowtail') {
    return `<polygon points="0,${h * 0.15} ${w},${h * 0.15} ${w * 0.78},${h * 0.5} ${w},${h * 0.85} 0,${h * 0.85}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'banner-shield-pennant') {
    return `<polygon points="0,0 ${w},0 ${w},${h * 0.7} ${w * 0.5},${h} 0,${h * 0.7}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'banner-ribbon-vertical') {
    return `<path d="M ${w * 0.15} 0 H ${w * 0.85} V ${h * 0.85} L ${w * 0.5},${h} L ${w * 0.15} ${h * 0.85} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'asterisk-6-thin') {
    return `<polygon points="${generateStarPolygon(6, 0.14)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'asterisk-6-thick') {
    return `<polygon points="${generateStarPolygon(6, 0.32)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'asterisk-5-rounded') {
    return `<polygon points="${generateStarPolygon(5, 0.28)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'asterisk-8-snow') {
    return `<polygon points="${generateStarPolygon(8, 0.22)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'asterisk-5-thin') {
    return `<polygon points="${generateStarPolygon(5, 0.14)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'organic-daisy-8') {
    return `<path d="${generateFlowerPath(8, 0.25)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-flower-6') {
    return `<path d="${generateFlowerPath(6, 0.28)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-flower-10') {
    return `<path d="${generateFlowerPath(10, 0.38)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-flower-center') {
    const cx = w / 2;
    const cy = h / 2;
    const rOuter = Math.min(w, h) / 2;
    const rHole = rOuter * 0.25;
    const flower = generateFlowerPath(6, 0.38);
    const hole = `M ${cx} ${cy - rHole} A ${rHole} ${rHole} 0 1 0 ${cx} ${cy + rHole} A ${rHole} ${rHole} 0 1 0 ${cx} ${cy - rHole} Z`;
    return `<path d="${flower} ${hole}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill-rule="evenodd" />`;
  }
  if (el.shapeType === 'organic-clover-4') {
    return `<path d="M ${w / 2} ${h / 2} C ${w * 0.35} ${h * 0.3} ${w * 0.18} ${h * 0.3} ${w * 0.18} ${h * 0.45} C ${w * 0.18} ${h * 0.58} ${w * 0.35} ${h * 0.55} ${w / 2} ${h / 2} C ${w * 0.3} ${h * 0.65} ${w * 0.3} ${h * 0.82} ${w * 0.45} ${h * 0.82} C ${w * 0.58} ${h * 0.82} ${w * 0.55} ${h * 0.65} ${w / 2} ${h / 2} C ${w * 0.65} ${h * 0.7} ${w * 0.82} ${h * 0.7} ${w * 0.82} ${h * 0.55} C ${w * 0.82} ${h * 0.42} ${w * 0.65} ${h * 0.45} ${w / 2} ${h / 2} C ${w * 0.7} ${h * 0.35} ${w * 0.7} ${h * 0.18} ${w * 0.55} ${h * 0.18} C ${w * 0.42} ${h * 0.18} ${w * 0.45} ${h * 0.35} ${w / 2} ${h / 2} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-propeller-4') {
    return `<path d="M ${w / 2} ${h / 2} C ${w * 0.35} ${h * 0.28} ${w * 0.35} ${h * 0.08} ${w / 2} ${h * 0.08} C ${w * 0.65} ${h * 0.08} ${w * 0.65} ${h * 0.28} ${w / 2} ${h / 2} C ${w * 0.72} ${h * 0.35} ${w * 0.92} ${h * 0.35} ${w * 0.92} ${h / 2} C ${w * 0.92} ${h * 0.65} ${w * 0.72} ${h * 0.65} ${w / 2} ${h / 2} C ${w * 0.65} ${h * 0.72} ${w * 0.65} ${h * 0.92} ${w / 2} ${h * 0.92} C ${w * 0.35} ${h * 0.92} ${w * 0.35} ${h * 0.72} ${w / 2} ${h / 2} C ${w * 0.28} ${h * 0.65} ${w * 0.08} ${h * 0.65} ${w * 0.08} ${h / 2} C ${w * 0.08} ${h * 0.35} ${w * 0.28} ${h * 0.35} ${w / 2} ${h / 2} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-leaf') {
    return `<path d="M ${w * 0.08} ${h * 0.92} C ${w * 0.08} ${h * 0.42} ${w * 0.48} ${h * 0.08} ${w * 0.92} ${h * 0.08} C ${w * 0.92} ${h * 0.58} ${w * 0.52} ${h * 0.92} ${w * 0.08} ${h * 0.92} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-wave-ribbon') {
    return `<path d="M ${w * 0.08} ${h * 0.4} Q ${w * 0.28} ${h * 0.22} ${w * 0.5} ${h * 0.4} T ${w * 0.92} ${h * 0.4} V ${h * 0.6} Q ${w * 0.72} ${h * 0.78} ${w * 0.5} ${h * 0.6} T ${w * 0.08} ${h * 0.6} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }
  if (el.shapeType === 'organic-s-ribbon') {
    return `<path d="M ${w * 0.08} ${h * 0.55} C ${w * 0.3} ${h * 0.3} ${w * 0.7} ${h * 0.7} ${w * 0.92} ${h * 0.45} C ${w * 0.75} ${h * 0.62} ${w * 0.38} ${h * 0.38} ${w * 0.08} ${h * 0.55} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  if (el.shapeType === 'arrow') {
    const midY = h / 2;
    const head = Math.min(24, Math.max(12, w / 4));
    return `<path d="M 0 ${midY} L ${w} ${midY} M ${w - head} ${midY - head * 0.6} L ${w} ${midY} L ${w - head} ${midY + head * 0.6}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (el.shapeType === 'arrow-left') {
    const midY = h / 2;
    const head = Math.min(24, Math.max(12, w / 4));
    return `<path d="M ${w} ${midY} L 0 ${midY} M ${head} ${midY - head * 0.6} L 0 ${midY} L ${head} ${midY + head * 0.6}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (el.shapeType === 'arrow-up') {
    const midX = w / 2;
    const head = Math.min(24, Math.max(12, h / 4));
    return `<path d="M ${midX} ${h} L ${midX} 0 M ${midX - head * 0.6} ${head} L ${midX} 0 L ${midX + head * 0.6} ${head}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (el.shapeType === 'arrow-down') {
    const midX = w / 2;
    const head = Math.min(24, Math.max(12, h / 4));
    return `<path d="M ${midX} 0 L ${midX} ${h} M ${midX - head * 0.6} ${h - head} L ${midX} ${h} L ${midX + head * 0.6} ${h - head}" fill="${fill}" stroke="${fill}" stroke-width="${Math.max(4, strokeWidth || 4)}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (el.shapeType === 'lightning') {
    return `<polygon points="${w * 0.55},0 ${w * 0.15},${h * 0.55} ${w * 0.45},${h * 0.55} ${w * 0.35},${h} ${w * 0.85},${h * 0.42} ${w * 0.55},${h * 0.42}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
  }

  return '';
}

function renderShapeInner(el: ElementShape): string {
  let fill = el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : '#000000';
  let stroke = el.strokeColor && el.strokeColor !== 'transparent' ? el.strokeColor : 'none';
  const strokeWidth = el.strokeWidth || 0;
  const w = el.width;
  const h = el.height;
  let gradDef = '';

  if (fill.startsWith('linear-gradient')) {
    const gradId = `shape-grad-${el.id}`;
    const hexes = fill.match(/#[a-fA-F0-9]{6}|#[a-fA-F0-9]{3}/g);
    if (hexes && hexes.length >= 2) {
      gradDef = `<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${hexes[0]}"/><stop offset="100%" stop-color="${hexes[1]}"/></linearGradient></defs>`;
      fill = `url(#${gradId})`;
    }
  }

  let strokeDash = '';
  if (el.strokeStyle === 'dashed') strokeDash = 'stroke-dasharray="6,4"';
  else if (el.strokeStyle === 'long-dash') strokeDash = 'stroke-dasharray="12,6"';
  else if (el.strokeStyle === 'dotted') strokeDash = 'stroke-dasharray="2,3"';
  else if (el.strokeStyle === 'none' || strokeWidth === 0) {
    stroke = 'none';
  }

  const geom = renderShapeGeometry(el, fill, stroke, strokeWidth, w, h, strokeDash);
  return geom ? `${gradDef}${geom}` : '';
}

export { renderShapeGeometry, renderShapeInner };
