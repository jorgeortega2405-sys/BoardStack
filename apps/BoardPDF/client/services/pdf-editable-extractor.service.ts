import { loadPdfDocument, loadPdfJs } from './pdf-loader.service.js';

interface ExtractedPageResult {
  elements: any[];
  hasEditableContent: boolean;
  pageNumber: number;
  pageSize: { height: number; width: number };
}

interface RawTextItem {
  fontSize: number;
  fontName: string;
  hasEOL: boolean;
  height: number;
  id: number;
  str: string;
  width: number;
  x: number;
  y: number;
}

interface GroupedLine {
  color?: string;
  fontName: string;
  fontSize: number;
  height: number;
  items: RawTextItem[];
  maxX: number;
  minX: number;
  text: string;
  y: number;
}

async function resolvePdfDoc(source: any): Promise<{ doc: any; shouldDestroy: boolean }> {
  if (source && typeof source.getPage === 'function') {
    return { doc: source, shouldDestroy: false };
  }
  if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
    const doc = await loadPdfDocument(source);
    return { doc, shouldDestroy: true };
  }
  if (source instanceof File || source instanceof Blob) {
    const ab = await source.arrayBuffer();
    const doc = await loadPdfDocument(ab);
    return { doc, shouldDestroy: true };
  }
  if (typeof source === 'string') {
    const res = await fetch(source);
    const ab = await res.arrayBuffer();
    const doc = await loadPdfDocument(ab);
    return { doc, shouldDestroy: true };
  }
  throw new Error('Formato de origen PDF no compatible');
}

async function checkPdfPagesEditableStatus(source: any): Promise<boolean[]> {
  const { doc, shouldDestroy } = await resolvePdfDoc(source);
  const results: boolean[] = [];
  try {
    const numPages = doc.numPages || 1;
    for (let p = 1; p <= numPages; p++) {
      try {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const valid = (textContent.items || []).filter((it: any) => typeof it.str === 'string' && it.str.trim().length > 0);
        results.push(valid.length > 0);
      } catch {
        results.push(false);
      }
    }
  } finally {
    if (shouldDestroy) {
      try {
        void doc.destroy();
      } catch {}
    }
  }
  return results;
}

async function extractEditablePdfPage(
  source: any,
  pageNum: number,
  targetPageIndex: number,
  targetWidth?: number,
  targetHeight?: number
): Promise<ExtractedPageResult> {
  const { doc, shouldDestroy } = await resolvePdfDoc(source);
  try {
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const pdfWidth = vp.width || 595.28;
    const pdfHeight = vp.height || 841.89;

    const calcW = targetWidth || Math.round((pdfWidth / 72) * 96);
    const calcH = targetHeight || Math.round((pdfHeight / 72) * 96);
    const scaleX = calcW / pdfWidth;
    const scaleY = calcH / pdfHeight;

    const textContent = await page.getTextContent();
    const rawItems: RawTextItem[] = (textContent.items || [])
      .filter((it: any) => typeof it.str === 'string' && it.str.trim().length > 0)
      .map((it: any, idx: number) => {
        const tx = Array.isArray(it.transform) && it.transform.length >= 6 ? it.transform : [12, 0, 0, 12, 0, 0];
        const x = tx[4];
        const y = tx[5];
        const fontSize = Math.hypot(tx[0], tx[1]) || it.height || 12;
        return {
          fontSize,
          fontName: it.fontName || '',
          hasEOL: Boolean(it.hasEOL),
          height: it.height || fontSize,
          id: idx,
          str: it.str,
          width: it.width || (fontSize * it.str.length * 0.5),
          x,
          y,
        };
      });

    if (rawItems.length === 0) {
      return {
        elements: [],
        hasEditableContent: false,
        pageNumber: pageNum,
        pageSize: { height: calcH, width: calcW },
      };
    }

    rawItems.sort((a, b) => {
      const diffY = b.y - a.y;
      if (Math.abs(diffY) > Math.min(a.fontSize, b.fontSize) * 0.45) return diffY;
      return a.x - b.x;
    });

    const lines: GroupedLine[] = [];
    let curLine: GroupedLine | null = null;

    for (const item of rawItems) {
      if (!curLine) {
        curLine = {
          fontName: item.fontName,
          fontSize: item.fontSize,
          height: item.height,
          items: [item],
          maxX: item.x + item.width,
          minX: item.x,
          text: item.str,
          y: item.y,
        };
        continue;
      }

      const sameY = Math.abs(item.y - curLine.y) <= Math.max(curLine.fontSize, item.fontSize) * 0.48;
      const closeX = (item.x - curLine.maxX) <= Math.max(curLine.fontSize, 12) * 2.8;

      if (sameY && closeX) {
        const needSpace = (item.x - curLine.maxX) > curLine.fontSize * 0.16 && !curLine.text.endsWith(' ') && !item.str.startsWith(' ');
        curLine.text += (needSpace ? ' ' : '') + item.str;
        curLine.maxX = Math.max(curLine.maxX, item.x + item.width);
        curLine.fontSize = Math.max(curLine.fontSize, item.fontSize);
        curLine.height = Math.max(curLine.height, item.height);
        curLine.items.push(item);
      } else {
        lines.push(curLine);
        curLine = {
          fontName: item.fontName,
          fontSize: item.fontSize,
          height: item.height,
          items: [item],
          maxX: item.x + item.width,
          minX: item.x,
          text: item.str,
          y: item.y,
        };
      }
    }
    if (curLine) lines.push(curLine);

    const elements: any[] = [];
    let elemCount = 0;

    for (const line of lines) {
      const fn = (line.fontName || '').toLowerCase();
      const isBold = fn.includes('bold') || fn.includes('black') || fn.includes('heavy') || fn.includes('semibold') || fn.includes('medium') || fn.includes('700') || fn.includes('800') || fn.includes('900');
      const isItalic = fn.includes('italic') || fn.includes('oblique');

      let fontFamily = 'Helvetica';
      if (fn.includes('times') || fn.includes('serif') || fn.includes('garamond') || fn.includes('georgia')) {
        fontFamily = 'Times New Roman';
      } else if (fn.includes('courier') || fn.includes('mono') || fn.includes('consolas')) {
        fontFamily = 'Courier New';
      } else if (fn.includes('roboto')) {
        fontFamily = 'Roboto';
      } else if (fn.includes('arial')) {
        fontFamily = 'Arial';
      }

      const editorX = Math.round(line.minX * scaleX);
      const editorY = Math.round((pdfHeight - line.y - line.fontSize) * scaleY);
      const editorW = Math.max(24, Math.ceil((line.maxX - line.minX) * scaleX) + 12);
      const editorH = Math.max(16, Math.ceil(line.height * scaleY));
      const editorFontSize = Math.max(9, Math.round(line.fontSize * scaleY));

      elements.push({
        align: 'left',
        color: '#000000',
        fontFamily,
        fontSize: editorFontSize,
        fontWeight: isBold ? 'bold' : 'normal',
        height: editorH,
        id: `elem_${Date.now()}_${elemCount++}_${Math.random().toString(36).substring(2, 7)}`,
        isBold,
        isItalic,
        pageIndex: targetPageIndex,
        rotation: 0,
        text: line.text,
        type: 'text',
        width: editorW,
        x: editorX,
        y: editorY,
      });
    }

    try {
      const extractedImages = await extractImagesFromPage(page, vp, scaleX, scaleY, targetPageIndex, elemCount);
      elements.push(...extractedImages);
    } catch {}

    return {
      elements,
      hasEditableContent: true,
      pageNumber: pageNum,
      pageSize: { height: calcH, width: calcW },
    };
  } finally {
    if (shouldDestroy) {
      try {
        void doc.destroy();
      } catch {}
    }
  }
}

async function extractImagesFromPage(
  page: any,
  vp: any,
  scaleX: number,
  scaleY: number,
  pageIndex: number,
  startCount: number
): Promise<any[]> {
  const images: any[] = [];
  if (typeof document === 'undefined') return images;

  const opList = await page.getOperatorList();
  const pdfjs = await loadPdfJs();
  let currentMatrix = [1, 0, 0, 1, 0, 0];
  const matrixStack: number[][] = [];
  let count = startCount;

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === pdfjs.OPS.save) {
      matrixStack.push([...currentMatrix]);
    } else if (fn === pdfjs.OPS.restore) {
      if (matrixStack.length > 0) currentMatrix = matrixStack.pop()!;
    } else if (fn === pdfjs.OPS.transform && Array.isArray(args) && args.length >= 6) {
      const [a1, b1, c1, d1, e1, f1] = currentMatrix;
      const [a2, b2, c2, d2, e2, f2] = args;
      currentMatrix = [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
      ];
    } else if (fn === pdfjs.OPS.paintImageXObject && Array.isArray(args) && args[0]) {
      const imgId = args[0];
      const imgX = currentMatrix[4];
      const imgY = currentMatrix[5];
      const imgW = Math.hypot(currentMatrix[0], currentMatrix[1]);
      const imgH = Math.hypot(currentMatrix[2], currentMatrix[3]);

      if (imgW < 8 || imgH < 8) continue;

      try {
        const rawImg = await new Promise<any>((resolve) => {
          try {
            page.objs.get(imgId, (res: any) => resolve(res));
          } catch {
            resolve(null);
          }
        });

        if (rawImg && rawImg.width > 0 && rawImg.height > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = rawImg.width;
          canvas.height = rawImg.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (rawImg.bitmap) {
              ctx.drawImage(rawImg.bitmap, 0, 0);
            } else if (rawImg instanceof HTMLImageElement || rawImg instanceof HTMLCanvasElement) {
              ctx.drawImage(rawImg, 0, 0);
            } else if (rawImg.data) {
              const imgData = ctx.createImageData(rawImg.width, rawImg.height);
              if (rawImg.data.length === rawImg.width * rawImg.height * 4) {
                imgData.data.set(rawImg.data);
              } else if (rawImg.data.length === rawImg.width * rawImg.height * 3) {
                let src = 0;
                let dst = 0;
                while (src < rawImg.data.length) {
                  imgData.data[dst++] = rawImg.data[src++];
                  imgData.data[dst++] = rawImg.data[src++];
                  imgData.data[dst++] = rawImg.data[src++];
                  imgData.data[dst++] = 255;
                }
              } else if (rawImg.data.length === rawImg.width * rawImg.height) {
                let src = 0;
                let dst = 0;
                while (src < rawImg.data.length) {
                  const val = rawImg.data[src++];
                  imgData.data[dst++] = val;
                  imgData.data[dst++] = val;
                  imgData.data[dst++] = val;
                  imgData.data[dst++] = 255;
                }
              }
              ctx.putImageData(imgData, 0, 0);
            }

            const dataUrl = canvas.toDataURL('image/png');
            if (dataUrl && dataUrl.startsWith('data:image/png')) {
              const edX = Math.round(imgX * scaleX);
              const edY = Math.round((vp.height - imgY - imgH) * scaleY);
              const edW = Math.max(20, Math.round(imgW * scaleX));
              const edH = Math.max(20, Math.round(imgH * scaleY));

              images.push({
                height: edH,
                id: `elem_img_${Date.now()}_${count++}_${Math.random().toString(36).substring(2, 7)}`,
                pageIndex,
                rotation: 0,
                type: 'image',
                url: dataUrl,
                width: edW,
                x: edX,
                y: edY,
              });
            }
          }
        }
      } catch {}
    }
  }

  return images;
}

export { checkPdfPagesEditableStatus, extractEditablePdfPage };
export type { ExtractedPageResult };
