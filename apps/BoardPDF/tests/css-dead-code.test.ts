import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import postcss from 'postcss';

describe('BoardPDF - CSS Dead Code & Unreferenced Selectors Audit', () => {
  const rootDir = fs.existsSync(path.resolve(process.cwd(), 'src/index.ts'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'apps/BoardPDF');

  const cssFiles = [
    'public/css/root.css',
    'public/css/components/component-buttons.css',
    'public/css/components/component-feedback.css',
    'public/css/components/component-forms.css',
    'public/css/components/component-layout.css',
    'public/css/components/component-overlays.css',
    'public/css/components/component-views.css',
    'public/css/tools/tool-base.css',
    'public/css/tools/tool-grid.css',
    'public/css/tools/tool-viewer.css',
  ];

  const dynamicWhitelist = [
    /^is-pos-(top|center|bottom)-(left|center|right)$/,
    /^modal-card--(sm|md|lg)$/,
    /^toast-item--(success|danger|warning|info)$/,
    /^contact-ticket-status-badge--/,
    /^contact-ticket-msg--(customer|agent)$/,
    /^sortable-(ghost|chosen|drag)$/,
    /^(textLayer|annotationLayer|canvasWrapper|page)$/,
    /^is-(active|open|disabled|hidden|loading|processing|selected|visible|dragging|dragover|marked-remove|mobile-open|ready|success|error)$/,
  ];

  function getFiles(dir: string, ext: string): string[] {
    let res: string[] = [];
    if (!fs.existsSync(dir)) return res;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(item.name)) {
          res = res.concat(getFiles(full, ext));
        }
      } else if (item.name.endsWith(ext)) {
        res.push(full);
      }
    }
    return res;
  }

  function splitSelectors(selectorStr: string): string[] {
    const selectors: string[] = [];
    let current = '';
    let inParen = 0;
    let inBracket = 0;

    for (let i = 0; i < selectorStr.length; i++) {
      const char = selectorStr[i];
      if (char === '(') inParen++;
      else if (char === ')') inParen--;
      else if (char === '[') inBracket++;
      else if (char === ']') inBracket--;

      if (char === ',' && inParen === 0 && inBracket === 0) {
        selectors.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim().length > 0) {
      selectors.push(current.trim());
    }
    return selectors;
  }

  const htmlFiles = getFiles(path.join(rootDir, 'public/views'), '.html').concat([path.join(rootDir, 'index.html')]);
  const tsFiles = getFiles(path.join(rootDir, 'client'), '.ts');

  const htmlContent = htmlFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const tsContent = tsFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const allContent = htmlContent + '\n' + tsContent;

  const isClassUsed = (cls: string): boolean => {
    if (dynamicWhitelist.some((rx) => rx.test(cls))) return true;
    return allContent.includes(cls);
  };

  test('verifies all 10 stylesheet targets exist and are populated', () => {
    for (const rel of cssFiles) {
      const full = path.join(rootDir, rel);
      assert.ok(fs.existsSync(full), `Stylesheet missing: ${rel}`);
      const content = fs.readFileSync(full, 'utf8');
      assert.ok(content.length > 500, `Stylesheet ${rel} appears suspiciously truncated (${content.length} bytes)`);
    }
  });

  test('verifies zero dead or unreferenced class rules remain in public/css/', () => {
    const violations: { file: string; line?: number; selector: string; deadClass: string }[] = [];

    for (const rel of cssFiles) {
      const full = path.join(rootDir, rel);
      const content = fs.readFileSync(full, 'utf8');
      const root = postcss.parse(content);

      root.walkRules((rule) => {
        if (rule.parent && (rule.parent as any).name === 'keyframes') return;

        const branches = splitSelectors(rule.selector);
        for (const branch of branches) {
          const classTokens = [...branch.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
          for (const token of classTokens) {
            if (!isClassUsed(token)) {
              violations.push({
                file: rel,
                line: rule.source?.start?.line,
                selector: branch,
                deadClass: token,
              });
            }
          }
        }
      });
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} dead/unreferenced class rules in public/css/:\n` +
        violations.map((v) => `  ${v.file}:${v.line || 0} -> selector "${v.selector}" contains dead class "${v.deadClass}"`).slice(0, 20).join('\n')
    );
  });

  test('verifies all :root design tokens, custom properties and active keyframes are preserved', () => {
    const rootCssPath = path.join(rootDir, 'public/css/root.css');
    const rootContent = fs.readFileSync(rootCssPath, 'utf8');
    assert.ok(rootContent.includes('--action-primary'), 'Missing --action-primary in root.css');
    assert.ok(rootContent.includes('--color-primary'), 'Missing --color-primary in root.css');
    assert.ok(rootContent.includes('.is-hidden'), 'Missing .is-hidden utility in root.css');

    const toolBaseCss = fs.readFileSync(path.join(rootDir, 'public/css/tools/tool-base.css'), 'utf8');
    assert.ok(toolBaseCss.includes('@keyframes pdf-spin'), 'Missing @keyframes pdf-spin');
    assert.ok(toolBaseCss.includes('@keyframes dropzone-pop'), 'Missing @keyframes dropzone-pop');
  });

  test('verifies no empty @media query containers exist', () => {
    const emptyMedia: { file: string; params: string }[] = [];

    for (const rel of cssFiles) {
      const full = path.join(rootDir, rel);
      const content = fs.readFileSync(full, 'utf8');
      const root = postcss.parse(content);

      root.walkAtRules('media', (media) => {
        const hasRules = media.nodes && media.nodes.some((n) => n.type === 'rule' || n.type === 'atrule');
        if (!hasRules) {
          emptyMedia.push({ file: rel, params: media.params });
        }
      });
    }

    assert.strictEqual(
      emptyMedia.length,
      0,
      `Found ${emptyMedia.length} empty @media queries:\n` +
        emptyMedia.map((m) => `  ${m.file} -> @media ${m.params}`).join('\n')
    );
  });
});
