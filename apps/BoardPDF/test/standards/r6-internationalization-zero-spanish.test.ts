import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import {
  BOARDPDF_ROOT,
  CLIENT_DIR,
  PUBLIC_VIEWS_DIR,
  TRANSLATIONS_DIR,
  findFiles,
  flattenKeys,
  getAllHtmlFiles,
  getAllTypeScriptFiles,
  parseHtmlTags,
  readJson,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R6: Full Web Internationalization (Zero Hardcoded Spanish) Standards', () => {
  const translationsEsDir = path.join(TRANSLATIONS_DIR, 'es');
  const translationsEnDir = path.join(TRANSLATIONS_DIR, 'en');

  function loadAllSpanishKeys(): Set<string> {
    const keys = new Set<string>();
    if (!fs.existsSync(translationsEsDir)) {
      return keys;
    }
    const files = fs.readdirSync(translationsEsDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const data = readJson(path.join(translationsEsDir, f));
      const basePrefix = f.replace('.json', '');
      const flat = flattenKeys(data);
      for (const k of Object.keys(flat)) {
        keys.add(k);
        keys.add(`${basePrefix}.${k}`);
        keys.add(`help.${basePrefix}.${k}`);
      }
    }
    return keys;
  }

  describe('Tier 1: Feature Coverage (R6 Verification)', () => {
    it('verifies elements with data-i18n in HTML templates have zero hardcoded inner text', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];
      const hardcodedInnerRegex = /<([a-zA-Z0-9-]+)[^>]*\sdata-i18n="[^"]+"[^>]*>([^<]+)<\/\1>/g;

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        let match: RegExpExecArray | null;
        while ((match = hardcodedInnerRegex.exec(content)) !== null) {
          const inner = match[2].trim();
          if (inner.length > 0) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}: <${match[1]}> has text "${inner}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Elements with data-i18n must be empty. Found ${violations.length} violations:\n${violations
          .slice(0, 30)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies input placeholders in HTML templates use data-i18n-placeholder', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          if (tag.tagName === 'input' || tag.tagName === 'textarea') {
            const hasDataPlaceholder = tag.attributes.some((a) => a.name === 'data-i18n-placeholder');
            const placeholderAttr = tag.attributes.find((a) => a.name === 'placeholder');
            if (placeholderAttr && placeholderAttr.value.trim() !== '' && placeholderAttr.value.trim() !== ' ') {
              if (!hasDataPlaceholder) {
                violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} hardcoded placeholder "${placeholderAttr.value}"`);
              }
            }
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `All input placeholders must use data-i18n-placeholder. Found ${violations.length}:\n${violations
          .slice(0, 30)
          .join('\n')}`
      );
    });

    it('verifies client TypeScript showToast calls use t(...) rather than raw string literals', () => {
      const clientTsFiles = getAllTypeScriptFiles(CLIENT_DIR);
      const violations: string[] = [];
      const rawToastRegex = /showToast\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`](error|success|info|warning)['"`]\)/g;

      for (const file of clientTsFiles) {
        const content = readUtf8(file);
        let match: RegExpExecArray | null;
        while ((match = rawToastRegex.exec(content)) !== null) {
          violations.push(`${path.relative(BOARDPDF_ROOT, file)}: raw toast "${match[1]}"`);
        }
      }

      assert.equal(
        violations.length,
        0,
        `All showToast calls must use t('...'). Found ${violations.length} raw string toasts:\n${violations
          .slice(0, 30)
          .join('\n')}`
      );
    });

    it('verifies English translation dictionary bundle (en/) exists for complete bilingual parity', () => {
      assert.ok(
        fs.existsSync(translationsEnDir),
        'public/translations/en/ directory must exist for bilingual dictionary parity'
      );
    });

    it('verifies data-i18n-aria attributes used for icon-only action buttons', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          if (tag.tagName === 'button' || tag.tagName === 'a') {
            const ariaAttr = tag.attributes.find((a) => a.name === 'aria-label');
            const hasDataAria = tag.attributes.some((a) => a.name === 'data-i18n-aria');
            if (ariaAttr && !hasDataAria && ariaAttr.value.trim().length > 3) {
              const isSpanish = /[áéíóúñ¿¡]|\b(cerrar|abrir|eliminar|guardar|descargar|buscar|siguiente)\b/i.test(ariaAttr.value);
              if (isSpanish) {
                violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} hardcoded aria-label "${ariaAttr.value}"`);
              }
            }
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Spanish aria-label values must use data-i18n-aria. Found ${violations.length}:\n${violations.slice(0, 20).join('\n')}`
      );
    });

    it('verifies data-i18n-title attributes used for tool cards and tooltips', () => {
      const htmlFiles = getAllHtmlFiles();
      const violations: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          const titleAttr = tag.attributes.find((a) => a.name === 'title');
          const hasDataTitle = tag.attributes.some((a) => a.name === 'data-i18n-title');
          if (titleAttr && !hasDataTitle && titleAttr.value.trim().length > 3) {
            const isSpanish = /[áéíóúñ¿¡]|\b(herramienta|descargar|guardar|editar)\b/i.test(titleAttr.value);
            if (isSpanish) {
              violations.push(`${path.relative(BOARDPDF_ROOT, file)}:L${tag.line} hardcoded title "${titleAttr.value}"`);
            }
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Spanish title attributes must use data-i18n-title. Found ${violations.length}:\n${violations.slice(0, 20).join('\n')}`
      );
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies translation dictionaries do not contain empty string or null values', () => {
      assert.ok(fs.existsSync(translationsEsDir), 'public/translations/es/ must exist');
      const files = fs.readdirSync(translationsEsDir).filter((f) => f.endsWith('.json'));

      const emptyKeys: string[] = [];
      for (const f of files) {
        const data = readJson(path.join(translationsEsDir, f));
        const flat = flattenKeys(data);
        for (const [k, v] of Object.entries(flat)) {
          if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
            emptyKeys.push(`${f}: ${k}`);
          }
        }
      }

      assert.equal(
        emptyKeys.length,
        0,
        `Found empty translation dictionary keys:\n${emptyKeys.join('\n')}`
      );
    });

    it('verifies interpolation tokens {var} are properly closed in translation dictionaries', () => {
      const files = fs.readdirSync(translationsEsDir).filter((f) => f.endsWith('.json'));
      const malformedInterpolations: string[] = [];

      for (const f of files) {
        const data = readJson(path.join(translationsEsDir, f));
        const flat = flattenKeys(data);
        for (const [k, v] of Object.entries(flat)) {
          const opens = (v.match(/\{/g) || []).length;
          const closes = (v.match(/\}/g) || []).length;
          if (opens !== closes) {
            malformedInterpolations.push(`${f}: ${k} -> "${v}"`);
          }
        }
      }

      assert.equal(
        malformedInterpolations.length,
        0,
        `Found malformed interpolation braces:\n${malformedInterpolations.join('\n')}`
      );
    });

    it('verifies translation dictionaries contain common UI action keys', () => {
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flat = flattenKeys(generalData);
      const allKeys = Object.keys(flat);

      const commonKeys = ['common', 'auth', 'errors', 'nav'];
      for (const prefix of commonKeys) {
        assert.ok(
          allKeys.some((k) => k.startsWith(prefix)),
          `general.json must define section "${prefix}"`
        );
      }
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies all data-i18n* attributes across all 50 HTML templates resolve in translation dictionaries', () => {
      const allKeys = loadAllSpanishKeys();
      const htmlFiles = getAllHtmlFiles();
      const missingKeys: string[] = [];

      for (const file of htmlFiles) {
        const content = readUtf8(file);
        const tags = parseHtmlTags(content);
        for (const tag of tags) {
          for (const attr of tag.attributes) {
            if (attr.name.startsWith('data-i18n')) {
              const key = attr.value.trim();
              if (key && !allKeys.has(key)) {
                missingKeys.push(`${path.basename(file)}: ${attr.name}="${key}"`);
              }
            }
          }
        }
      }

      assert.equal(
        missingKeys.length,
        0,
        `Found unresolvable data-i18n* attributes in templates (${missingKeys.length}):\n${missingKeys
          .slice(0, 30)
          .join('\n')}`
      );
    });

    it('verifies client TypeScript does not invoke window.alert, window.confirm, or window.prompt (Rule 7)', () => {
      const clientTsFiles = getAllTypeScriptFiles(CLIENT_DIR);
      const nativeAlertRegex = /\b(window\.)?(alert|confirm|prompt)\s*\(/;
      const violations: string[] = [];

      for (const file of clientTsFiles) {
        const content = readUtf8(file);
        if (nativeAlertRegex.test(content)) {
          violations.push(path.relative(BOARDPDF_ROOT, file));
        }
      }

      assert.equal(
        violations.length,
        0,
        `Native alerts/confirms forbidden by AGENTS.md Rule 7. Found in:\n${violations.join('\n')}`
      );
    });
  });

  describe('Tier 4: Monorepo-Wide Real-World Application Scenarios', () => {
    it('verifies zero hardcoded Spanish sentences in client TypeScript files', () => {
      const clientTsFiles = getAllTypeScriptFiles(CLIENT_DIR);
      const violations: string[] = [];

      const spanishSentenceRegex = /['"`]([A-ZÁÉÍÓÚÑ][^'"`\n]{15,}?\b(el|la|los|las|de|en|por|para|con|un|una|este|esta|guardar|descargar|procesando|cancelar|error|éxito)\b[^'"`\n]{5,})['"`]/g;

      for (const file of clientTsFiles) {
        const content = readUtf8(file);
        let match: RegExpExecArray | null;
        while ((match = spanishSentenceRegex.exec(content)) !== null) {
          const text = match[1];
          if (!text.includes('/') && !text.includes('css') && !text.includes('data-ref')) {
            violations.push(`${path.relative(BOARDPDF_ROOT, file)}: "${text}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Client TypeScript must not contain hardcoded Spanish user strings. Found ${violations.length} occurrences:\n${violations
          .slice(0, 30)
          .join('\n')}${violations.length > 30 ? `\n...and ${violations.length - 30} more` : ''}`
      );
    });

    it('verifies translation key parity between es/ and en/ bundles once en/ is present', () => {
      if (fs.existsSync(translationsEnDir)) {
        const esFiles = fs.readdirSync(translationsEsDir).filter((f) => f.endsWith('.json'));
        const enFiles = fs.readdirSync(translationsEnDir).filter((f) => f.endsWith('.json'));

        for (const ef of esFiles) {
          assert.ok(enFiles.includes(ef), `English translation dictionary must include ${ef}`);
        }
      }
    });
  });
});
