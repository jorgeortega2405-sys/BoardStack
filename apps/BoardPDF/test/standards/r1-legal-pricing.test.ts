import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import {
  PUBLIC_VIEWS_DIR,
  TRANSLATIONS_DIR,
  flattenKeys,
  parseHtmlTags,
  readJson,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R1: Legal Policies, FAQs & Pricing Disclaimer Standards', () => {
  const helpViewsDir = path.join(PUBLIC_VIEWS_DIR, 'help');
  const pricingViewPath = path.join(PUBLIC_VIEWS_DIR, 'pricing/pricing.html');
  const translationsEsDir = path.join(TRANSLATIONS_DIR, 'es');

  describe('Tier 1: Feature Coverage (R1 Verification)', () => {
    it('verifies all 4 required legal policy templates and FAQ template exist', () => {
      const requiredTemplates = [
        'terms.html',
        'privacy.html',
        'cookies.html',
        'security.html',
        'faq.html',
      ];

      for (const tpl of requiredTemplates) {
        const fullPath = path.join(helpViewsDir, tpl);
        assert.ok(
          fs.existsSync(fullPath),
          `Expected legal template ${tpl} to exist in ${helpViewsDir}`
        );
      }
    });

    it('verifies Terms Section 10 specifies subscription billing, auto-renewal, cancellation and refunds', () => {
      const termsJsonPath = path.join(translationsEsDir, 'terms.json');
      assert.ok(fs.existsSync(termsJsonPath), 'terms.json must exist');
      const termsData = readJson<Record<string, string>>(termsJsonPath);

      const section10Title = termsData.section10_title || '';
      const section10Text = termsData.section10_text || '';
      const combined = `${section10Title} ${section10Text}`.toLowerCase();

      const hasObsoleteFreeClaims =
        combined.includes('gratuidad del servicio') ||
        combined.includes('ausencia de cargos') ||
        combined.includes('sin costo') ||
        combined.includes('no se requiere ingresar tarjetas');

      assert.equal(
        hasObsoleteFreeClaims,
        false,
        'Terms Section 10 must NOT contain obsolete claims of free service or absence of charges'
      );

      const requiredTerms = ['suscripción', 'renovación', 'cancelación'];
      for (const term of requiredTerms) {
        assert.ok(
          combined.includes(term),
          `Terms Section 10 must include billing concept "${term}"`
        );
      }
    });

    it('verifies FAQ accurately explains subscription tiers and cancel-anytime policy', () => {
      const generalJsonPath = path.join(translationsEsDir, 'general.json');
      assert.ok(fs.existsSync(generalJsonPath), 'general.json must exist');
      const generalData = readJson<any>(generalJsonPath);
      const flat = flattenKeys(generalData);

      const faqEntries = Object.entries(flat).filter(([k]) =>
        k.startsWith('help.faq.') || k.startsWith('faq.')
      );

      assert.ok(faqEntries.length > 0, 'FAQ translation entries must exist');

      const fullFaqText = faqEntries.map(([, v]) => v.toLowerCase()).join(' ');
      assert.ok(
        !fullFaqText.includes('totalmente gratis y sin límites para siempre') &&
        !fullFaqText.includes('completamente libre de cargos en todas sus funciones'),
        'FAQ must not present the entire service as unconditionally free without paid tiers'
      );
    });

    it('verifies Pricing disclaimer details advance billing, auto-renewal, and cancellation', () => {
      assert.ok(fs.existsSync(pricingViewPath), 'pricing.html must exist');
      const pricingHtml = readUtf8(pricingViewPath);

      const generalJsonPath = path.join(translationsEsDir, 'general.json');
      const generalData = readJson<any>(generalJsonPath);
      const flat = flattenKeys(generalData);

      const disclaimerKeys = Object.keys(flat).filter((k) =>
        k.toLowerCase().includes('disclaimer') || k.toLowerCase().includes('notice')
      );

      assert.ok(disclaimerKeys.length > 0, 'Must have translation keys for pricing disclaimer');

      const disclaimerText = disclaimerKeys.map((k) => flat[k]).join(' ').toLowerCase();
      assert.ok(
        !disclaimerText.includes('lorem ipsum') && !disclaimerText.includes('placeholder text'),
        'Pricing disclaimer must not contain placeholder lorem text'
      );

      assert.ok(
        disclaimerText.includes('renov') || disclaimerText.includes('cancel') || disclaimerText.includes('cobro'),
        'Pricing disclaimer must describe billing terms, renewal, or cancellation'
      );
    });

    it('verifies Privacy Policy avoids low-level technical engine disclosures', () => {
      const privacyJsonPath = path.join(translationsEsDir, 'privacy.json');
      assert.ok(fs.existsSync(privacyJsonPath), 'privacy.json must exist');
      const privacyData = readJson<Record<string, string>>(privacyJsonPath);
      const fullText = Object.values(privacyData).join(' ');

      const forbiddenEngines = [
        'Node.js Sandbox Engine',
        'Redis In-Memory Engine',
        'MySQL Storage Engine InnoDB',
      ];

      for (const engine of forbiddenEngines) {
        assert.ok(
          !fullText.includes(engine),
          `Privacy policy should not disclose internal engine name "${engine}"`
        );
      }
    });

    it('verifies Cookies policy covers essential, analytics, and functional cookie categories', () => {
      const cookiesJsonPath = path.join(translationsEsDir, 'cookies.json');
      assert.ok(fs.existsSync(cookiesJsonPath), 'cookies.json must exist');
      const cookiesData = readJson<Record<string, string>>(cookiesJsonPath);
      const fullText = Object.values(cookiesData).join(' ').toLowerCase();

      assert.ok(
        fullText.includes('esencial') || fullText.includes('técnic') || fullText.includes('necesari'),
        'Cookies policy must describe essential/technical cookies'
      );
      assert.ok(
        fullText.includes('analític') || fullText.includes('rendimiento') || fullText.includes('estadístic'),
        'Cookies policy must describe analytics/performance cookies'
      );
    });

    it('verifies Security policy outlines stateless encryption, AES-256, and zero local persistence', () => {
      const secJsonPath = path.join(translationsEsDir, 'security.json');
      assert.ok(fs.existsSync(secJsonPath), 'security.json must exist');
      const secData = readJson<Record<string, string>>(secJsonPath);
      const fullText = Object.values(secData).join(' ').toLowerCase();

      assert.ok(
        fullText.includes('cifrado') || fullText.includes('encript') || fullText.includes('tls') || fullText.includes('aes'),
        'Security policy must describe data encryption standards'
      );
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies legal policy sections meet substantive length thresholds', () => {
      const policyFiles = ['terms.json', 'privacy.json', 'cookies.json', 'security.json'];
      for (const file of policyFiles) {
        const filePath = path.join(translationsEsDir, file);
        if (fs.existsSync(filePath)) {
          const data = readJson<Record<string, string>>(filePath);
          for (const [key, value] of Object.entries(data)) {
            if (key.includes('title')) {
              assert.ok(value.trim().length > 3, `Title for ${key} too short: "${value}"`);
            }
            if (key.includes('text') || key.includes('desc')) {
              assert.ok(
                value.trim().length >= 40,
                `Substantive text for ${key} in ${file} too brief (${value.length} chars)`
              );
            }
          }
        }
      }
    });

    it('verifies no empty string values in legal translation dictionaries', () => {
      const policyFiles = ['terms.json', 'privacy.json', 'cookies.json', 'security.json'];
      for (const file of policyFiles) {
        const filePath = path.join(translationsEsDir, file);
        if (fs.existsSync(filePath)) {
          const data = readJson<Record<string, any>>(filePath);
          const flat = flattenKeys(data);
          for (const [key, value] of Object.entries(flat)) {
            assert.ok(
              value !== null && value !== undefined && value.trim() !== '',
              `Legal translation key ${key} in ${file} must not be empty`
            );
          }
        }
      }
    });

    it('verifies FAQ accordion items contain structured question and answer pairs', () => {
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flat = flattenKeys(generalData);
      const questionKeys = Object.keys(flat).filter((k) => k.includes('faq') && k.includes('q'));
      const answerKeys = Object.keys(flat).filter((k) => k.includes('faq') && k.includes('a'));

      assert.ok(questionKeys.length > 0, 'FAQ must have question keys');
      assert.ok(answerKeys.length > 0, 'FAQ must have answer keys');
    });

    it('verifies pricing disclaimer maintains concise boundary suitable for card footer', () => {
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flat = flattenKeys(generalData);
      const disclaimerKeys = Object.keys(flat).filter(
        (k) => (k.includes('pricing') && (k.endsWith('.disclaimer') || k.endsWith('.notice') || k.includes('disclaimer_text')))
      );

      for (const key of disclaimerKeys) {
        const text = flat[key];
        assert.ok(
          text.length >= 20 && text.length <= 1200,
          `Disclaimer ${key} length (${text.length}) must be between 20 and 1200 chars`
        );
      }
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies all data-i18n references in help templates exist in translations', () => {
      const helpHtmlFiles = fs
        .readdirSync(helpViewsDir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(helpViewsDir, f));

      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const termsData = readJson<any>(path.join(translationsEsDir, 'terms.json'));
      const privacyData = readJson<any>(path.join(translationsEsDir, 'privacy.json'));
      const cookiesData = readJson<any>(path.join(translationsEsDir, 'cookies.json'));
      const securityData = readJson<any>(path.join(translationsEsDir, 'security.json'));

      const allKeys = new Set([
        ...Object.keys(flattenKeys(generalData)),
        ...Object.keys(flattenKeys(termsData, 'help.terms')),
        ...Object.keys(flattenKeys(privacyData, 'help.privacy')),
        ...Object.keys(flattenKeys(cookiesData, 'help.cookies')),
        ...Object.keys(flattenKeys(securityData, 'help.security')),
      ]);

      const missingKeys: string[] = [];
      for (const htmlPath of helpHtmlFiles) {
        const html = readUtf8(htmlPath);
        const tags = parseHtmlTags(html);
        for (const tag of tags) {
          for (const attr of tag.attributes) {
            if (attr.name.startsWith('data-i18n')) {
              const key = attr.value.trim();
              if (key && !allKeys.has(key)) {
                missingKeys.push(`${path.basename(htmlPath)}: ${attr.name}="${key}"`);
              }
            }
          }
        }
      }

      assert.equal(
        missingKeys.length,
        0,
        `Found undefined data-i18n keys in help templates:\n${missingKeys.join('\n')}`
      );
    });

    it('verifies pricing card tier names match terms and disclaimer descriptions', () => {
      const termsJsonPath = path.join(translationsEsDir, 'terms.json');
      const termsData = readJson<Record<string, string>>(termsJsonPath);
      const termsSection10 = (termsData.section10_text || '').toLowerCase();

      assert.ok(
        termsSection10.includes('pro') || termsSection10.includes('negocios') || termsSection10.includes('business'),
        'Terms Section 10 should reference the specific active subscription tiers (Pro / Negocios)'
      );
    });
  });

  describe('Tier 4: Real-World Scenarios & Full View Audit', () => {
    it('verifies zero hardcoded text nodes inside elements having data-i18n in help views', () => {
      const helpHtmlFiles = fs
        .readdirSync(helpViewsDir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(helpViewsDir, f));

      const violations: string[] = [];
      const inlineTextRegex = /<([a-zA-Z0-9-]+)[^>]*\sdata-i18n="[^"]+"[^>]*>([^<]+)<\/\1>/g;

      for (const htmlPath of helpHtmlFiles) {
        const html = readUtf8(htmlPath);
        let match: RegExpExecArray | null;
        while ((match = inlineTextRegex.exec(html)) !== null) {
          const inner = match[2].trim();
          if (inner.length > 0) {
            violations.push(`${path.basename(htmlPath)}: Element <${match[1]}> contains hardcoded inner text "${inner}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Elements with data-i18n must be completely empty inside:\n${violations.join('\n')}`
      );
    });

    it('verifies all legal templates reference valid legal route links without broken anchors', () => {
      const helpHtmlFiles = fs
        .readdirSync(helpViewsDir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(helpViewsDir, f));

      const brokenHrefs: string[] = [];
      for (const htmlPath of helpHtmlFiles) {
        const html = readUtf8(htmlPath);
        const tags = parseHtmlTags(html);
        for (const tag of tags) {
          if (tag.tagName === 'a') {
            const href = tag.attributes.find((a) => a.name === 'href')?.value;
            if (href && (href === '#' || href === 'javascript:void(0)')) {
              brokenHrefs.push(`${path.basename(htmlPath)}:L${tag.line} contains placeholder href="${href}"`);
            }
          }
        }
      }

      assert.equal(
        brokenHrefs.length,
        0,
        `Legal policy navigation links must not contain dead anchors:\n${brokenHrefs.join('\n')}`
      );
    });
  });
});
