import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import { flattenKeys, PUBLIC_VIEWS_DIR, readJson, readUtf8, TRANSLATIONS_DIR } from './helpers/standards-test-utils.js';

describe('Milestone 1 Challenger: Adversarial R1 Legal & FAQ Stress Harness', () => {
  const translationsEsDir = path.join(TRANSLATIONS_DIR, 'es');
  const helpViewsDir = path.join(PUBLIC_VIEWS_DIR, 'help');
  const pricingViewPath = path.join(PUBLIC_VIEWS_DIR, 'pricing/pricing.html');

  describe('Adversarial Test 1: Translation Dictionaries Zero Obsolete Claims & Zero Engine Leaks', () => {
    it('scans all JSON dictionaries in public/translations/es/ for forbidden internal engine leaks', () => {
      const forbiddenEngines = [
        'Node.js Sandbox Engine',
        'Redis (In-Memory Engine)',
        'Redis In-Memory Engine',
        'MySQL Storage Engine InnoDB',
      ];

      const jsonFiles = fs.readdirSync(translationsEsDir).filter((f) => f.endsWith('.json'));
      const violations: string[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(translationsEsDir, file);
        const content = readUtf8(filePath);

        for (const engine of forbiddenEngines) {
          if (content.includes(engine)) {
            violations.push(`${file} leaks internal technical engine name: "${engine}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Found internal engine disclosures in translation files:\n${violations.join('\n')}`
      );
    });

    it('scans all JSON dictionaries in public/translations/es/ for obsolete claims of total service gratuity or absence of charges', () => {
      const forbiddenPhrases = [
        'gratuidad del servicio y ausencia de cargos',
        'no se requiere ingresar tarjetas de crédito ni suscribirse a planes de cobro periódico',
        'totalmente gratuito sin cobros ocultos ni suscripciones periódicas',
        'sin requerir suscripciones periódicas ni pagos obligatorios',
      ];

      const jsonFiles = fs.readdirSync(translationsEsDir).filter((f) => f.endsWith('.json'));
      const violations: string[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(translationsEsDir, file);
        const content = readUtf8(filePath).toLowerCase();

        for (const phrase of forbiddenPhrases) {
          if (content.includes(phrase)) {
            violations.push(`${file} contains obsolete free-only claim: "${phrase}"`);
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Found obsolete free-only claims in translation files:\n${violations.join('\n')}`
      );
    });
  });

  describe('Adversarial Test 2: Cross-Document Legal Consistency Oracle', () => {
    it('verifies Terms Section 10, FAQ billing items, and Pricing card disclaimer agree on renewal terms', () => {
      const termsData = readJson<Record<string, string>>(path.join(translationsEsDir, 'terms.json'));
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flatGeneral = flattenKeys(generalData);

      const termsSec10 = (termsData.section10_text || '').toLowerCase();
      const faqBill1 = (flatGeneral['help.faq.item_bill_1_a'] || '').toLowerCase();
      const pricingDisclaimerGeo = (flatGeneral['pricing.disclaimer_geo_1'] || '').toLowerCase();

      assert.ok(termsSec10.includes('mensuales o anuales'), 'Terms must specify monthly or annual billing cycles');
      assert.ok(faqBill1.includes('mensuales o anuales'), 'FAQ must specify monthly or annual billing cycles');
      assert.ok(pricingDisclaimerGeo.includes('mensuales o anuales'), 'Pricing disclaimer must specify monthly or annual billing cycles');

      assert.ok(termsSec10.includes('renovación automática') || termsSec10.includes('renovarán automáticamente'), 'Terms must state auto-renewal');
      assert.ok(faqBill1.includes('renovación automática'), 'FAQ must state auto-renewal');
      assert.ok(pricingDisclaimerGeo.includes('renuevan automáticamente'), 'Pricing disclaimer must state auto-renewal');
    });

    it('verifies Terms Section 10, FAQ billing items, and Pricing card disclaimer agree on cancellation mechanism', () => {
      const termsData = readJson<Record<string, string>>(path.join(translationsEsDir, 'terms.json'));
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flatGeneral = flattenKeys(generalData);

      const termsSec10 = (termsData.section10_text || '').toLowerCase();
      const faqBill1 = (flatGeneral['help.faq.item_bill_1_a'] || '').toLowerCase();
      const pricingDisclaimerGeo = (flatGeneral['pricing.disclaimer_geo_1'] || '').toLowerCase();

      assert.ok(termsSec10.includes('configuración de su cuenta > facturación'), 'Terms must direct to Account Settings > Facturación');
      assert.ok(faqBill1.includes('facturación en los ajustes de tu cuenta'), 'FAQ must direct to Billing in account settings');
      assert.ok(pricingDisclaimerGeo.includes('ajustes de tu cuenta'), 'Pricing disclaimer must direct to account settings');
    });

    it('verifies Terms Section 10, FAQ billing items, and Pricing card disclaimer agree on refund and 14-day statutory right', () => {
      const termsData = readJson<Record<string, string>>(path.join(translationsEsDir, 'terms.json'));
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flatGeneral = flattenKeys(generalData);

      const termsSec10 = (termsData.section10_text || '').toLowerCase();
      const faqBill1 = (flatGeneral['help.faq.item_bill_1_a'] || '').toLowerCase();
      const pricingDisclaimerGeo = (flatGeneral['pricing.disclaimer_geo_1'] || '').toLowerCase();

      assert.ok(termsSec10.includes('14 días') && termsSec10.includes('desistimiento'), 'Terms must explicitly state 14-day statutory withdrawal right');
      assert.ok(faqBill1.includes('14 días') && faqBill1.includes('desistimiento'), 'FAQ must explicitly state 14-day statutory withdrawal right');
      assert.ok(pricingDisclaimerGeo.includes('14 días') && pricingDisclaimerGeo.includes('desistimiento'), 'Pricing disclaimer must state 14-day statutory right');

      assert.ok(termsSec10.includes('no son reembolsables'), 'Terms must state non-refundable default');
      assert.ok(faqBill1.includes('no son reembolsables'), 'FAQ must state non-refundable default');
      assert.ok(pricingDisclaimerGeo.includes('no son reembolsables'), 'Pricing disclaimer must state non-refundable default');
    });

    it('verifies Terms Section 10, FAQ billing items, and Pricing card disclaimer agree on one-time pass policy', () => {
      const termsData = readJson<Record<string, string>>(path.join(translationsEsDir, 'terms.json'));
      const generalData = readJson<any>(path.join(translationsEsDir, 'general.json'));
      const flatGeneral = flattenKeys(generalData);

      const termsSec10 = (termsData.section10_text || '').toLowerCase();
      const faqBill1 = (flatGeneral['help.faq.item_bill_1_a'] || '').toLowerCase();
      const pricingDisclaimerGeo = (flatGeneral['pricing.disclaimer_geo_1'] || '').toLowerCase();

      assert.ok(termsSec10.includes('pago único') && termsSec10.includes('sin renovaciones automáticas'), 'Terms must state one-time pass has no auto-renewal');
      assert.ok(faqBill1.includes('pago único') && faqBill1.includes('no se renuevan automáticamente'), 'FAQ must state one-time pass has no auto-renewal');
      assert.ok(pricingDisclaimerGeo.includes('pago único') && pricingDisclaimerGeo.includes('no se renuevan automáticamente'), 'Pricing disclaimer must state one-time pass has no auto-renewal');
    });
  });

  describe('Adversarial Test 3: Structural Integrity & Privacy Sub-Processors Render Verification', () => {
    it('verifies privacy.html Section 11 contains structured table rendering all 4 compliant sub-processors', () => {
      const privacyHtmlPath = path.join(helpViewsDir, 'privacy.html');
      const privacyHtml = readUtf8(privacyHtmlPath);

      assert.ok(privacyHtml.includes('data-ref="help-privacy-table"'), 'Must have privacy sub-processors table');
      assert.ok(privacyHtml.includes('data-i18n="help.privacy.table_row1_entity"'), 'Must render row 1 entity');
      assert.ok(privacyHtml.includes('data-i18n="help.privacy.table_row2_entity"'), 'Must render row 2 entity');
      assert.ok(privacyHtml.includes('data-i18n="help.privacy.table_row3_entity"'), 'Must render row 3 entity');
      assert.ok(privacyHtml.includes('data-i18n="help.privacy.table_row4_entity"'), 'Must render row 4 entity');
    });

    it('verifies privacy.json Section 11 contains abstract compliant descriptions without low-level engine leaks', () => {
      const privacyData = readJson<Record<string, string>>(path.join(translationsEsDir, 'privacy.json'));

      assert.ok(privacyData.table_row1_entity.includes('AWS S3 / MinIO'), 'Row 1 must classify distributed object storage');
      assert.ok(privacyData.table_row2_entity.includes('Isolated Ephemeral Execution Containers'), 'Row 2 must classify ephemeral container execution');
      assert.ok(privacyData.table_row3_entity.includes('Cloudflare Turnstile'), 'Row 3 must classify edge network and threat protection');
      assert.ok(privacyData.table_row4_entity.includes('Encrypted In-Memory Cache and Session State Layer'), 'Row 4 must classify encrypted memory cache layer');

      assert.ok(!privacyData.table_row2_entity.includes('Node.js Sandbox Engine'), 'Row 2 must not leak Node.js Sandbox Engine');
      assert.ok(!privacyData.table_row4_entity.includes('Redis (In-Memory Engine)'), 'Row 4 must not leak Redis (In-Memory Engine)');
    });
  });
});
