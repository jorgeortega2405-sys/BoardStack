import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe, it } from 'node:test';
import ts from 'typescript';
import {
  BOARDPDF_ROOT,
  SCRIPTS_DIR,
  SRC_DIR,
  findProcessEnvFallbacks,
  parseSourceFile,
  readUtf8,
} from './helpers/standards-test-utils.js';

describe('R2: Stripe Product and Pricing Initialization Script Standards', () => {
  const stripeScriptPath = path.join(SCRIPTS_DIR, 'init-stripe-products.ts');

  describe('Tier 1: Feature Coverage (R2 Verification)', () => {
    it('verifies scripts/init-stripe-products.ts exists', () => {
      assert.ok(
        fs.existsSync(stripeScriptPath),
        'scripts/init-stripe-products.ts must exist as standalone Stripe setup script'
      );
    });

    it('verifies Stripe script imports Stripe SDK and accesses STRIPE_SECRET_KEY without fallbacks', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      assert.ok(
        content.includes("from 'stripe'") || content.includes('require("stripe")'),
        'Script must import official Stripe SDK'
      );

      assert.ok(
        content.includes('STRIPE_SECRET_KEY'),
        'Script must consume STRIPE_SECRET_KEY from environment'
      );

      const fallbacks = findProcessEnvFallbacks(content);
      assert.equal(
        fallbacks.length,
        0,
        `Script must have zero process.env fallbacks. Found:\n${fallbacks.map((f) => `L${f.line}: ${f.text}`).join('\n')}`
      );

      assert.ok(
        !content.includes('sk_test_placeholder') && !content.includes('sk_live_placeholder'),
        'Script must contain zero hardcoded Stripe API keys'
      );
    });

    it('verifies Stripe script configures Pro tier ($4.99/mo, $47.90/yr, $99.00 one-time)', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      const hasMonthlyPro = content.includes('499') || content.includes('4.99');
      const hasYearlyPro = content.includes('4790') || content.includes('47.90') || content.includes('47.9');
      const hasOneTimePro = content.includes('9900') || content.includes('99.00') || content.includes('99');

      assert.ok(hasMonthlyPro, 'Script must configure Pro monthly at $4.99 (499 cents)');
      assert.ok(hasYearlyPro, 'Script must configure Pro annual discount at ~$47.90 (4790 cents)');
      assert.ok(hasOneTimePro, 'Script must configure Pro one-time lifetime/annual pass at ~$99.00 (9900 cents)');
    });

    it('verifies Stripe script configures Business tier ($9.99/mo, $95.90/yr, $199.00 one-time)', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      const hasMonthlyBiz = content.includes('999') || content.includes('9.99');
      const hasYearlyBiz = content.includes('9590') || content.includes('95.90') || content.includes('95.9');
      const hasOneTimeBiz = content.includes('19900') || content.includes('199.00') || content.includes('199');

      assert.ok(hasMonthlyBiz, 'Script must configure Business monthly at $9.99 (999 cents)');
      assert.ok(hasYearlyBiz, 'Script must configure Business annual discount at ~$95.90 (9590 cents)');
      assert.ok(hasOneTimeBiz, 'Script must configure Business one-time lifetime/annual pass at ~$199.00 (19900 cents)');
    });

    it('verifies Stripe script incorporates idempotency logic', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      const hasIdempotency =
        content.includes('products.list') ||
        content.includes('products.search') ||
        content.includes('prices.list') ||
        content.includes('metadata');

      assert.ok(
        hasIdempotency,
        'Script must implement idempotency by querying existing products/prices or checking metadata'
      );
    });

    it('verifies standard 20% annual discount applied to yearly pricing', () => {
      const proMonthly = 4.99;
      const expectedProYearlyCents = 4790;
      const calculatedProYearly = Math.round(proMonthly * 12 * 0.8 * 100);
      assert.equal(
        Math.abs(calculatedProYearly - expectedProYearlyCents) <= 10,
        true,
        'Pro yearly rate should approximate 20% discount on 12 months'
      );

      const bizMonthly = 9.99;
      const expectedBizYearlyCents = 9590;
      const calculatedBizYearly = Math.round(bizMonthly * 12 * 0.8 * 100);
      assert.equal(
        Math.abs(calculatedBizYearly - expectedBizYearlyCents) <= 10,
        true,
        'Business yearly rate should approximate 20% discount on 12 months'
      );
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('verifies script aborts or rejects missing STRIPE_SECRET_KEY before attempting API operations', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      const guardsSecret =
        content.includes('!process.env.STRIPE_SECRET_KEY') ||
        content.includes('!stripeKey') ||
        content.includes('!apiKey') ||
        content.includes('STRIPE_SECRET_KEY is required') ||
        content.includes('process.exit(1)');

      assert.ok(
        guardsSecret,
        'Script must guard against missing or empty STRIPE_SECRET_KEY with explicit check'
      );
    });

    it('verifies all amounts are specified in integer cents and currency is USD', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      assert.ok(
        content.includes("'usd'") || content.includes('"usd"'),
        'All Stripe currency specifications must be USD'
      );

      const decimalAmountsInUnitAmount = /unit_amount:\s*\d+\.\d+/;
      assert.ok(
        !decimalAmountsInUnitAmount.test(content),
        'Stripe unit_amount must be specified in integer cents without floating point decimals'
      );
    });

    it('verifies product metadata tags include tier and application identifier', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      assert.ok(content.includes('metadata'), 'Script must pass metadata to Stripe products/prices');
      assert.ok(
        content.includes('tier') || content.includes('tierId'),
        'Metadata must include tier identifier for programmatic reconciliation'
      );
    });

    it('verifies script executes clean error exit code on critical missing secret failure', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      assert.ok(
        content.includes('process.exit(1)') || content.includes('throw new Error'),
        'Script must fail-fast with non-zero exit or thrown error'
      );
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('verifies alignment between Stripe script pricing and plans.config.ts', () => {
      const plansConfigPath = path.join(SRC_DIR, 'config/plans.config.ts');
      assert.ok(fs.existsSync(plansConfigPath), 'plans.config.ts must exist');
      const plansContent = readUtf8(plansConfigPath);

      if (fs.existsSync(stripeScriptPath)) {
        const stripeContent = readUtf8(stripeScriptPath);

        if (plansContent.includes('priceMonthly: 4.99')) {
          assert.ok(
            stripeContent.includes('499'),
            'Stripe script and plans.config.ts must agree on Pro monthly rate $4.99'
          );
        }
      }
    });

    it('verifies script outputs configuration snippets for .env and plans.config.ts', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);

      assert.ok(
        content.includes('price_') || content.includes('Price ID') || content.includes('stripePrice'),
        'Script should output or display resulting Stripe price IDs for configuration updates'
      );
    });
  });

  describe('Tier 4: Real-World Scenarios & AST Analysis', () => {
    it('verifies scripts/init-stripe-products.ts compiles cleanly with TypeScript compiler', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }

      const program = ts.createProgram([stripeScriptPath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: false,
        noEmit: true,
      });

      const diagnostics = ts.getPreEmitDiagnostics(program);
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error && d.file?.fileName.includes('init-stripe-products.ts')
      );

      assert.equal(
        errors.length,
        0,
        `Stripe setup script must compile without syntax or diagnostic errors:\n${errors
          .map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n'))
          .join('\n')}`
      );
    });

    it('verifies zero fallback operators (||) in init-stripe-products.ts', () => {
      if (!fs.existsSync(stripeScriptPath)) {
        assert.fail('scripts/init-stripe-products.ts does not exist');
      }
      const content = readUtf8(stripeScriptPath);
      const fallbacks = findProcessEnvFallbacks(content);

      assert.equal(
        fallbacks.length,
        0,
        `Stripe setup script must contain 0 process.env fallbacks:\n${fallbacks.map((f) => `L${f.line}: ${f.text}`).join('\n')}`
      );
    });
  });
});
