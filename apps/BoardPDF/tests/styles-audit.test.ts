import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

describe('BoardPDF - Styles, Inline Mutations & Standards Compliance Audit', () => {
  const rootDir = fs.existsSync(path.resolve(process.cwd(), 'src/index.ts'))
    ? process.cwd()
    : path.resolve(process.cwd(), 'apps/BoardPDF');

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

  test('verifies zero static style="..." attributes across all public HTML views and index.html', () => {
    const htmlFiles = getFiles(path.join(rootDir, 'public/views'), '.html').concat([path.join(rootDir, 'index.html')]);
    assert.ok(htmlFiles.length >= 35, `Expected at least 35 HTML files, found ${htmlFiles.length}`);

    const violations: { file: string; line: number; style: string }[] = [];

    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const match = /\bstyle\s*=\s*(["'])(.*?)\1/gi.exec(line);
        if (match) {
          violations.push({
            file: path.relative(rootDir, file).replace(/\\/g, '/'),
            line: idx + 1,
            style: match[2],
          });
        }
      });
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} static style="..." attributes in HTML:\n` +
        violations.map((v) => `  ${v.file}:${v.line} -> style="${v.style}"`).slice(0, 20).join('\n')
    );
  });

  test('verifies zero static .style mutations in client TypeScript', () => {
    const tsFiles = getFiles(path.join(rootDir, 'client'), '.ts');
    assert.ok(tsFiles.length >= 90, `Expected at least 90 client TS files, found ${tsFiles.length}`);

    const isPermittedDynamic = (rel: string, prop: string, val: string, raw: string): boolean => {
      if (prop === "setProperty('--layout-scroll-height')" || prop === "removeProperty('--layout-scroll-height')") return true;
      if (rel.includes('tool-status') && prop === 'width') return true;
      if (rel.includes('compare-pdf') && prop === 'opacity') return true;
      if (
        (prop === 'width' || prop === 'height' || prop === 'minWidth') &&
        (val.includes('viewport.') ||
          val.includes('vp.') ||
          raw.includes('canvas') ||
          val.includes('displayWidth') ||
          val.includes('displayHeight') ||
          val.includes('Math.max') ||
          val.includes('* scale') ||
          val.includes('newW') ||
          val.includes('newH') ||
          val.includes('w'))
      ) {
        return true;
      }
      if (prop === 'transform' && val.includes('rotate')) return true;
      if ((prop === 'transform' || prop.includes('transform')) && (val.includes('translateY') || val.includes('diff') || val === "''" || val === '""')) return true;
      if (rel.includes('crop') && ['left', 'top', 'width', 'height'].includes(prop) && val.includes('%')) return true;
      if (
        (rel.includes('redact') || rel.includes('edit-pdf') || rel.includes('compare-pdf')) &&
        ['left', 'top', 'bottom', 'width', 'height'].includes(prop) &&
        (val.includes('px') || val.includes('scale') || val.includes('initial') || val.includes('item') || val.includes('start') || val.includes('box.'))
      ) {
        return true;
      }
      if ((rel.includes('edit-pdf') || rel.includes('redact-pdf')) && ['color', 'fontSize', 'fontFamily'].includes(prop)) return true;
      if (rel.includes('edit-pdf') && prop === 'visibility') return true;
      if (rel.includes('redact-pdf') && prop === 'pointerEvents') return true;
      if (
        (rel.includes('modal.component') || rel.includes('dom.util')) &&
        (prop.includes('transition') || prop.includes('opacity') || prop === 'pointerEvents' || (prop === 'display' && (val === "''" || val === '""')))
      ) {
        return true;
      }
      if (rel.includes('dom.util') && (prop === 'width' || prop === 'minWidth')) return true;
      return false;
    };

    const staticViolations: { file: string; line: number; prop: string; val: string }[] = [];

    for (const file of tsFiles) {
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, idx) => {
        let m: RegExpExecArray | null;
        const lineRegex = /(?:[\w\.\?]+)?\.style(?:\.([a-zA-Z0-9]+)|\[['"]([^'"]+)['"]\])\s*=\s*([^;\n]+)/g;
        while ((m = lineRegex.exec(line)) !== null) {
          const prop = m[1] || m[2];
          const val = m[3].trim();
          if (!isPermittedDynamic(rel, prop, val, line.trim())) {
            staticViolations.push({ file: rel, line: idx + 1, prop, val });
          }
        }
        const setPropRegex = /(?:[\w\.\?]+)?\.style\.setProperty\s*\(\s*(['"][^'"]+['"])\s*,\s*([^)]+)\)/g;
        while ((m = setPropRegex.exec(line)) !== null) {
          const prop = 'setProperty(' + m[1] + ')';
          const val = m[2].trim();
          if (!isPermittedDynamic(rel, prop, val, line.trim())) {
            staticViolations.push({ file: rel, line: idx + 1, prop, val });
          }
        }
      });
    }

    assert.strictEqual(
      staticViolations.length,
      0,
      `Found ${staticViolations.length} static .style mutations in client TypeScript:\n` +
        staticViolations.map((v) => `  ${v.file}:${v.line} -> ${v.prop} = ${v.val}`).slice(0, 20).join('\n')
    );
  });

  test('verifies zero id attributes across all public HTML views and index.html', () => {
    const htmlFiles = getFiles(path.join(rootDir, 'public/views'), '.html').concat([path.join(rootDir, 'index.html')]);
    const idViolations: { file: string; line: number; tag: string }[] = [];

    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const match = /<[a-z0-9-]+\b[^>]*?\bid\s*=/gi.exec(line);
        if (match) {
          idViolations.push({
            file: path.relative(rootDir, file).replace(/\\/g, '/'),
            line: idx + 1,
            tag: match[0],
          });
        }
      });
    }

    assert.strictEqual(
      idViolations.length,
      0,
      `Found ${idViolations.length} forbidden id attributes in HTML templates:\n` +
        idViolations.map((v) => `  ${v.file}:${v.line} -> ${v.tag}`).join('\n')
    );
  });

  test('verifies strict HTML attribute ordering (buttons have type first, others have class first)', () => {
    const htmlFiles = getFiles(path.join(rootDir, 'public/views'), '.html').concat([path.join(rootDir, 'index.html')]);
    const orderingViolations: { file: string; tag: string; snippet: string }[] = [];
    const nonClassTags = new Set([
      'button', 'html', 'meta', 'link', 'title', 'head', 'body', 'script',
      'base', 'noscript', 'style', 'svg', 'use', 'path', 'g', 'circle', 'canvas',
    ]);

    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');

      // Rule: <button> must have type as first attribute
      for (const m of content.matchAll(/<button\s+([^>]*?)>/gi)) {
        if (!m[1].trim().startsWith('type=')) {
          orderingViolations.push({ file: rel, tag: 'button', snippet: m[0] });
        }
      }

      // Rule: Other elements with class must have class as first attribute
      for (const m of content.matchAll(/<([a-z0-9-]+)\s+([^>]*?)>/gi)) {
        const tagName = m[1].toLowerCase();
        if (nonClassTags.has(tagName)) continue;
        const attrs = m[2].trim();
        if (attrs.includes('class=') && !attrs.startsWith('class=')) {
          orderingViolations.push({ file: rel, tag: tagName, snippet: m[0] });
        }
      }
    }

    assert.strictEqual(
      orderingViolations.length,
      0,
      `Found ${orderingViolations.length} HTML attribute ordering violations:\n` +
        orderingViolations.map((v) => `  ${v.file} -> <${v.tag}>: ${v.snippet}`).slice(0, 20).join('\n')
    );
  });

  test('verifies zero forbidden console.* calls in client and src (except websocket.service.ts)', () => {
    const tsFiles = getFiles(path.join(rootDir, 'client'), '.ts').concat(getFiles(path.join(rootDir, 'src'), '.ts'));
    const consoleViolations: { file: string; line: number; call: string }[] = [];

    for (const file of tsFiles) {
      const norm = path.relative(rootDir, file).replace(/\\/g, '/');
      if (norm.endsWith('websocket.service.ts')) continue;

      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const match = line.match(/\bconsole\.(log|warn|error|info|debug)\b/);
        if (match) {
          consoleViolations.push({ file: norm, line: idx + 1, call: match[0] });
        }
      });
    }

    assert.strictEqual(
      consoleViolations.length,
      0,
      `Found ${consoleViolations.length} forbidden console.* calls:\n` +
        consoleViolations.map((v) => `  ${v.file}:${v.line} -> ${v.call}`).join('\n')
    );
  });
});
