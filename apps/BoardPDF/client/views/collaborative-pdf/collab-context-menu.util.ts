import { EditorElement } from './collaborative-pdf.types.js';

export function moveElementLayer(
  elements: EditorElement[],
  elementId: string,
  direction: 'back' | 'backward' | 'forward' | 'front'
): boolean {
  const targetIndex = elements.findIndex((el) => el.id === elementId);
  if (targetIndex === -1) return false;
  const targetElem = elements[targetIndex];
  const p = targetElem.pageIndex ?? 0;

  const pageIndices: number[] = [];
  for (let i = 0; i < elements.length; i++) {
    if ((elements[i].pageIndex ?? 0) === p) {
      pageIndices.push(i);
    }
  }

  const posInPage = pageIndices.indexOf(targetIndex);
  if (posInPage === -1) return false;

  if (direction === 'front') {
    if (posInPage === pageIndices.length - 1) return false;
    const [removed] = elements.splice(targetIndex, 1);
    const lastItem = elements.map((el, i) => ({ el, i })).filter((x) => (x.el.pageIndex ?? 0) === p).pop();
    if (lastItem) {
      elements.splice(lastItem.i + 1, 0, removed);
    } else {
      elements.push(removed);
    }
  } else if (direction === 'back') {
    if (posInPage === 0) return false;
    const [removed] = elements.splice(targetIndex, 1);
    const firstItem = elements.map((el, i) => ({ el, i })).filter((x) => (x.el.pageIndex ?? 0) === p)[0];
    if (firstItem) {
      elements.splice(firstItem.i, 0, removed);
    } else {
      elements.unshift(removed);
    }
  } else if (direction === 'forward') {
    if (posInPage === pageIndices.length - 1) return false;
    const nextIndex = pageIndices[posInPage + 1];
    const temp = elements[targetIndex];
    elements[targetIndex] = elements[nextIndex];
    elements[nextIndex] = temp;
  } else if (direction === 'backward') {
    if (posInPage === 0) return false;
    const prevIndex = pageIndices[posInPage - 1];
    const temp = elements[targetIndex];
    elements[targetIndex] = elements[prevIndex];
    elements[prevIndex] = temp;
  }
  return true;
}

export function reorderElementLayer(
  elements: EditorElement[],
  draggedId: string,
  targetId: string
): boolean {
  if (draggedId === targetId) return false;
  const draggedIdx = elements.findIndex((el) => el.id === draggedId);
  const targetIdx = elements.findIndex((el) => el.id === targetId);
  if (draggedIdx === -1 || targetIdx === -1) return false;

  const [removed] = elements.splice(draggedIdx, 1);
  const newTargetIdx = elements.findIndex((el) => el.id === targetId);
  elements.splice(newTargetIdx, 0, removed);
  return true;
}

export function alignElementToPage(
  elem: EditorElement,
  alignment: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top',
  dim: { height: number; width: number }
): boolean {
  if (!('x' in elem && 'y' in elem)) return false;
  const w = 'width' in elem && typeof elem.width === 'number' ? elem.width : 100;
  const h = 'height' in elem && typeof elem.height === 'number' ? elem.height : 50;

  switch (alignment) {
    case 'left':
      elem.x = 0;
      break;
    case 'center':
      elem.x = Math.round((dim.width - w) / 2);
      break;
    case 'right':
      elem.x = dim.width - w;
      break;
    case 'top':
      elem.y = 0;
      break;
    case 'middle':
      elem.y = Math.round((dim.height - h) / 2);
      break;
    case 'bottom':
      elem.y = dim.height - h;
      break;
  }
  return true;
}
