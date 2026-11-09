import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import {
  BOARDPDF_ROOT,
  CLIENT_DIR,
  CSS_DIR,
  PUBLIC_VIEWS_DIR,
  findFiles,
  getAllHtmlFiles,
  getAllTypeScriptFiles,
  parseHtmlTags,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R7: CSS Class Modularization & Markup Rules Standards', () => {
  describe('Tier 1: Feature Coverage (R7 Verification)', () => {
    it('verifies zero inline style attributes in HTML templates', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          const styleAttr = tag.attributes.find((a) => a.name.toLowerCase() === 'style');
          if (styleAttr) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} <${tag.tagName} style="${styleAttr.value}">`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Zero inline style attributes allowed in HTML templates (AGENTS.md Rule 6). Found ${violations.length}:\n${violations
          .slice(0, 30)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies zero style="display: none;" (must use .is-hidden)', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          const styleAttr = tag.attributes.find((a) => a.name.toLowerCase() === 'style');
          if (styleAttr && styleAttr.value.replace(/\s+/g, '').includes('display:none')) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} <${tag.tagName} style="${styleAttr.value}">`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Inline display:none must be replaced with .is-hidden. Found ${violations.length}:\n${violations.join('\n')}`
      );
    });

    it('verifies zero id attributes in HTML templates (AGENTS.md Rule 9)', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          const idAttr = tag.attributes.find((a) => a.name.toLowerCase() === 'id');
          if (idAttr) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} <${tag.tagName} id="${idAttr.value}">`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Zero id attributes permitted (must use data-ref). Found ${violations.length}:\n${violations
          .slice(0, 30)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies button tags have type as the very first attribute (AGENTS.md Rule 10)', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          if (tag.tagName === 'button' && tag.attributes.length > 0) {
            const firstAttr = tag.attributes[0];
            if (firstAttr.name.toLowerCase() !== 'type') {
              violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} <button ${tag.rawTag.slice(0, 60)}> (first attr is ${firstAttr.name})`);
            }
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Button type must be first attribute. Found ${violations.length} violations:\n${violations
          .slice(0, 30)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies non-button tags with class attribute have class as first attribute', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          if (tag.tagName !== 'button' && tag.attributes.some((a) => a.name.toLowerCase() === 'class')) {
            const firstAttr = tag.attributes[0];
            if (firstAttr.name.toLowerCase() !== 'class') {
              violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} <${tag.tagName}> first attr is ${firstAttr.name}, expected class`);
            }
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Non-button elements with class must list class first. Found ${violations.length}:\n${violations
          .slice(0, 30)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies .is-hidden utility class is defined in public/css/root.css or component styles', () => {
      const rootCssPath = path.join(CSS_DIR, 'root.css');
      assert.ok(fs.existsSync(rootCssPath), 'root.css must exist');
      const allCss = findFiles(CSS_DIR, (p) => p.endsWith('.css')).map((f) => readUtf8(f)).join('\n');
      assert.ok(
        allCss.includes('.is-hidden'),
        'Stylesheet must define .is-hidden utility class'
      );
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies client TypeScript contains zero document.getElementById calls', () => {
      const clientTsFiles = getAllTypeScriptFiles(CLIENT_DIR);
      const violations: string[] = [];
      const getElemRegex = /document\.getElementById\s*\(/;

      for (const file of clientTsFiles) {
        const content = readUtf8(file);
        if (getElemRegex.test(content)) {
          violations.push(path.relative(BOARDPDF_ROOT, file));
        }
      }

      assert.equal(
        violations.length,
        0,
        `document.getElementById forbidden by AGENTS.md Rule 9. Found in:\n${violations.join('\n')}`
      );
    });

    it('verifies CSS directory structure adheres to modular BEM components', () => {
      const componentsCssDir = path.join(CSS_DIR, 'components');
      assert.ok(fs.existsSync(componentsCssDir), 'public/css/components/ must exist');

      const cssFiles = fs.readdirSync(componentsCssDir).filter((f) => f.endsWith('.css'));
      assert.ok(cssFiles.length >= 5, `Expected modular CSS component files, found ${cssFiles.length}`);

      for (const f of cssFiles) {
        assert.ok(f.startsWith('component-'), `CSS component file ${f} should follow component-*.css naming pattern`);
      }
    });

    it('verifies error banners (.banner--danger) are placed below action buttons in auth forms (Rule 11)', () => {
      const authViewsDir = path.join(PUBLIC_VIEWS_DIR, 'auth');
      if (fs.existsSync(authViewsDir)) {
        const authFiles = fs.readdirSync(authViewsDir).filter((f) => f.endsWith('.html'));
        for (const f of authFiles) {
          const content = readUtf8(path.join(authViewsDir, f));
          const buttonIndex = content.indexOf('btn-submit');
          const bannerIndex = content.indexOf('banner--danger');
          if (buttonIndex !== -1 && bannerIndex !== -1) {
            assert.ok(
              bannerIndex > buttonIndex,
              `In ${f}, error banner must be placed below submit action button (AGENTS.md Rule 11)`
            );
          }
        }
      }
    });

    it('verifies form fields use floating label structure (.field > .field__input + .field__label)', () => {
      const authViewsDir = path.join(PUBLIC_VIEWS_DIR, 'auth');
      if (fs.existsSync(authViewsDir)) {
        const loginPath = path.join(authViewsDir, 'login.html');
        if (fs.existsSync(loginPath)) {
          const content = readUtf8(loginPath);
          assert.ok(content.includes('field__input'), 'Login form must use field__input floating input');
          assert.ok(content.includes('field__label'), 'Login form must use field__label floating label');
        }
      }
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies client TypeScript DOM queries do not rely on deprecated view-specific classes', () => {
      const clientTsFiles = getAllTypeScriptFiles(CLIENT_DIR);
      const deprecatedClassQueryRegex = /querySelector(All)?\(\s*['"]\.(pricing-[a-zA-Z0-9_-]+|home-[a-zA-Z0-9_-]+|settings-[a-zA-Z0-9_-]+)['"]\s*\)/g;
      const violations: string[] = [];

      for (const file of clientTsFiles) {
        const content = readUtf8(file);
        let match: RegExpExecArray | null;
        while ((match = deprecatedClassQueryRegex.exec(content)) !== null) {
          violations.push(`${path.relative(BOARDPDF_ROOT, file)}: queries by deprecated class .${match[2]}`);
        }
      }

      assert.equal(
        violations.length,
        0,
        `TypeScript DOM queries must use [data-ref="..."] rather than view-specific classes:\n${violations.join('\n')}`
      );
    });

    it('verifies TypeScript DOM creation does not assign element.style directly outside canvas/drag exceptions', () => {
      const clientTsFiles = getAllTypeScriptFiles(CLIENT_DIR).filter(
        (f) =>
          !f.includes('canvas') &&
          !f.includes('scrollbar') &&
          !f.includes('modal.component.ts') &&
          !f.includes('pdf-preview.service.ts') &&
          !f.includes('tool-zoom.util.ts') &&
          !f.includes('dom.util.ts') &&
          !f.includes('collaborative-pdf') &&
          !f.includes('tools') &&
          !f.includes('projects.view.ts')
      );

      const violations: string[] = [];
      const inlineStyleAssignment = /\.style\.[a-zA-Z]+\s*=/g;

      for (const file of clientTsFiles) {
        const content = readUtf8(file);
        let match: RegExpExecArray | null;
        while ((match = inlineStyleAssignment.exec(content)) !== null) {
          violations.push(`${path.relative(BOARDPDF_ROOT, file)}: ${match[0]}`);
        }
      }

      assert.equal(
        violations.length,
        0,
        `Direct element.style assignments forbidden outside canvas/scroll exceptions (Rule 6):\n${violations.slice(0, 20).join('\n')}`
      );
    });
  });

  describe('Tier 4: Monorepo-Wide Real-World Application Scenarios', () => {
    it('verifies all 50 HTML templates maintain zero id attributes and zero inline styles', () => {
      const htmlFiles = getAllHtmlFiles();
      assert.ok(htmlFiles.length >= 40, `Expected at least 40 templates, found ${htmlFiles.length}`);

      let totalIdViolations = 0;
      let totalStyleViolations = 0;

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          if (tag.attributes.some((a) => a.name.toLowerCase() === 'id')) {
            totalIdViolations++;
          }
          if (tag.attributes.some((a) => a.name.toLowerCase() === 'style')) {
            totalStyleViolations++;
          }
        }
      }

      assert.equal(totalIdViolations, 0, `Total template id attributes: ${totalIdViolations}`);
      assert.equal(totalStyleViolations, 0, `Total template style attributes: ${totalStyleViolations}`);
    });
  });
});
