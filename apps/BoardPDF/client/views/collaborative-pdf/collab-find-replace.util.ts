import { EditorElement } from './collaborative-pdf.types.js';

export function findSearchMatches(
  elements: EditorElement[],
  query: string,
  matchCase: boolean
): Array<{ elementId: string; pageIndex: number }> {
  if (!query) return [];
  const matches: Array<{ elementId: string; pageIndex: number }> = [];
  for (const el of elements) {
    if (el.type === 'text' && typeof el.text === 'string') {
      const text = matchCase ? el.text : el.text.toLowerCase();
      const search = matchCase ? query : query.toLowerCase();
      if (text.includes(search)) {
        matches.push({ elementId: el.id, pageIndex: el.pageIndex ?? 0 });
      }
    }
  }
  return matches;
}

export function replaceCurrentMatch(
  elements: EditorElement[],
  match: { elementId: string; pageIndex: number },
  search: string,
  replaceWith: string,
  matchCase: boolean
): boolean {
  const el = elements.find((e) => e.id === match.elementId);
  if (!el || el.type !== 'text') return false;
  const textVal = el.text || '';
  if (matchCase) {
    el.text = textVal.replace(search, replaceWith);
  } else {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    el.text = textVal.replace(regex, replaceWith);
  }
  return true;
}

export function replaceAllMatches(
  elements: EditorElement[],
  search: string,
  replaceWith: string,
  matchCase: boolean
): number {
  let count = 0;
  const regex = new RegExp(
    search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    matchCase ? 'g' : 'gi'
  );

  for (const el of elements) {
    if (el.type === 'text' && typeof el.text === 'string') {
      const matches = el.text.match(regex);
      if (matches && matches.length > 0) {
        count += matches.length;
        el.text = el.text.replace(regex, replaceWith);
      }
    }
  }
  return count;
}
