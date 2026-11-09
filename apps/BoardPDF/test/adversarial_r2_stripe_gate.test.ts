import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import {
  findOrCreateOneTimePrice,
  findOrCreateProduct,
  findOrCreateRecurringPrice,
  TIERS,
} from '../scripts/init-stripe-products.js';
import { PLAN_TIER_CONFIGS } from '../src/config/plans.config.js';

describe('EMPIRICAL CHALLENGER: Adversarial Verification of Stripe Script & Plans Calibration (R2)', () => {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const scriptPath = path.join(rootDir, 'scripts/init-stripe-products.ts');
  const plansConfigPath = path.join(rootDir, 'src/config/plans.config.ts');

  describe('Suite 1: Missing and Corrupt STRIPE_SECRET_KEY Oracle', () => {
    it('exits with code 1 and writes clean error to stderr when STRIPE_SECRET_KEY is empty string', () => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', scriptPath],
        {
          cwd: rootDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            STRIPE_SECRET_KEY: '',
          },
        }
      );

      assert.strictEqual(
        result.status,
        1,
        `Expected exit code 1 when STRIPE_SECRET_KEY is empty, got: ${result.status}`
      );
      assert.ok(
        result.stderr.includes('Error: STRIPE_SECRET_KEY environment variable is required.'),
        `Expected specific error message on stderr, got: ${result.stderr}`
      );
      assert.strictEqual(
        result.stdout.includes('=== STRIPE PRODUCTS & PRICES INITIALIZED SUCCESSFULLY ==='),
        false,
        'Stdout must not report success when secret key is empty'
      );
    });

    it('exits with code 1 in an isolated sandbox directory without .env file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stripe-sandbox-'));
      try {
        const isolatedEnv: Record<string, string> = {};
        for (const [key, val] of Object.entries(process.env)) {
          if (key !== 'STRIPE_SECRET_KEY' && val !== undefined) {
            isolatedEnv[key] = val;
          }
        }
        isolatedEnv.STRIPE_SECRET_KEY = '';

        const tsxLoaderUrl = import.meta.resolve('tsx');
        const result = spawnSync(
          process.execPath,
          ['--import', tsxLoaderUrl, scriptPath],
          {
            cwd: tempDir,
            encoding: 'utf8',
            env: isolatedEnv,
          }
        );

        assert.strictEqual(
          result.status,
          1,
          `Expected exit code 1 in directory without .env and empty STRIPE_SECRET_KEY, got: ${result.status}`
        );
        assert.ok(
          result.stderr.includes('Error: STRIPE_SECRET_KEY environment variable is required.'),
          `Expected specific error message on stderr in isolated sandbox, got: ${result.stderr}`
        );
      } finally {
        fs.rmSync(tempDir, { force: true, recursive: true });
      }
    });

    it('handles whitespace-only or invalid STRIPE_SECRET_KEY without crashing silently', () => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', scriptPath],
        {
          cwd: rootDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            STRIPE_SECRET_KEY: 'sk_test_mock_invalid_key_for_testing',
          },
        }
      );

      assert.notStrictEqual(
        result.status,
        0,
        'Script must exit with non-zero exit code when given an invalid Stripe key'
      );
      assert.strictEqual(
        result.stdout.includes('=== STRIPE PRODUCTS & PRICES INITIALIZED SUCCESSFULLY ==='),
        false,
        'Stdout must not claim success when Stripe key is rejected by API'
      );
    });
  });

  describe('Suite 2: Idempotency Logic & Repeated Execution Oracle', () => {
    it('verifies findOrCreateProduct reuses existing product and avoids duplicate creations', async () => {
      let createCallCount = 0;
      let updateCallCount = 0;

      const mockExistingProduct = {
        id: 'prod_mock_pro_existing',
        metadata: {
          platform: 'boardpdf',
          tier: 'pro',
        },
        name: 'BoardPDF Pro',
      };

      const mockStripe = {
        products: {
          create: async (params: any) => {
            createCallCount++;
            return { id: 'prod_mock_new', ...params };
          },
          list: async () => ({
            data: [mockExistingProduct],
          }),
          update: async (id: string, params: any) => {
            updateCallCount++;
            return { id, ...params };
          },
        },
      } as any;

      const proTier = TIERS.find((t) => t.id === 'pro')!;
      const product = await findOrCreateProduct(mockStripe, proTier);

      assert.strictEqual(product.id, 'prod_mock_pro_existing');
      assert.strictEqual(createCallCount, 0, 'Must not call products.create when product already exists');
      assert.strictEqual(updateCallCount, 0, 'Must not call products.update when metadata matches');
    });

    it('verifies findOrCreateProduct creates product when absent', async () => {
      let createCallCount = 0;
      const createdProducts: any[] = [];

      const mockStripe = {
        products: {
          create: async (params: any) => {
            createCallCount++;
            const newProd = { id: `prod_mock_${params.metadata.tier}`, ...params };
            createdProducts.push(newProd);
            return newProd;
          },
          list: async () => ({
            data: createdProducts,
          }),
        },
      } as any;

      const proTier = TIERS.find((t) => t.id === 'pro')!;
      const created = await findOrCreateProduct(mockStripe, proTier);
      assert.strictEqual(createCallCount, 1);
      assert.strictEqual(created.id, 'prod_mock_pro');

      const secondRun = await findOrCreateProduct(mockStripe, proTier);
      assert.strictEqual(createCallCount, 1, 'Second run must reuse product and NOT call products.create again');
      assert.strictEqual(secondRun.id, 'prod_mock_pro');
    });

    it('verifies findOrCreateRecurringPrice reuses matching active price', async () => {
      let priceCreateCount = 0;

      const mockPrice = {
        currency: 'usd',
        id: 'price_mock_recurring_pro_month',
        recurring: {
          interval: 'month',
        },
        type: 'recurring',
        unit_amount: 499,
      };

      const mockStripe = {
        prices: {
          create: async (params: any) => {
            priceCreateCount++;
            return { id: 'price_mock_new', ...params };
          },
          list: async () => ({
            data: [mockPrice],
          }),
        },
      } as any;

      const price = await findOrCreateRecurringPrice(mockStripe, 'prod_mock_pro', 499, 'month');
      assert.strictEqual(price.id, 'price_mock_recurring_pro_month');
      assert.strictEqual(priceCreateCount, 0, 'Must not create price when matching recurring price exists');
    });

    it('verifies findOrCreateOneTimePrice reuses matching one-time price', async () => {
      let priceCreateCount = 0;

      const mockPrice = {
        currency: 'usd',
        id: 'price_mock_onetime_pro',
        type: 'one_time',
        unit_amount: 9900,
      };

      const mockStripe = {
        prices: {
          create: async (params: any) => {
            priceCreateCount++;
            return { id: 'price_mock_new_onetime', ...params };
          },
          list: async () => ({
            data: [mockPrice],
          }),
        },
      } as any;

      const price = await findOrCreateOneTimePrice(mockStripe, 'prod_mock_pro', 9900);
      assert.strictEqual(price.id, 'price_mock_onetime_pro');
      assert.strictEqual(priceCreateCount, 0, 'Must not create price when matching one-time price exists');
    });

    it('verifies live script execution is idempotent across repeated runs', () => {
      const run1 = execFileSync(
        process.execPath,
        ['--import', 'tsx', scriptPath],
        { cwd: rootDir, encoding: 'utf8' }
      );
      assert.ok(run1.includes('STRIPE PRODUCTS & PRICES INITIALIZED SUCCESSFULLY'));

      const run2 = execFileSync(
        process.execPath,
        ['--import', 'tsx', scriptPath],
        { cwd: rootDir, encoding: 'utf8' }
      );
      assert.ok(run2.includes('STRIPE PRODUCTS & PRICES INITIALIZED SUCCESSFULLY'));

      const extractPriceIds = (output: string) => {
        const matches = output.match(/price_[a-zA-Z0-9]+/g) || [];
        return Array.from(new Set(matches)).sort();
      };

      const priceIds1 = extractPriceIds(run1);
      const priceIds2 = extractPriceIds(run2);

      assert.strictEqual(priceIds1.length, 6, 'Must detect exactly 6 price IDs across Pro and Business');
      assert.deepStrictEqual(
        priceIds1,
        priceIds2,
        'Price IDs between run 1 and run 2 must be 100% identical without duplicates'
      );
    });
  });

  describe('Suite 3: Price Calibration & Discount Mathematics', () => {
    it('validates Pro tier price structure and ~20% annual discount', () => {
      const pro = TIERS.find((t) => t.id === 'pro');
      assert.ok(pro, 'Pro tier definition must exist in TIERS');

      assert.strictEqual(pro.prices.monthly, 499, 'Pro monthly price must be 499 cents ($4.99)');
      assert.strictEqual(pro.prices.yearly, 4790, 'Pro yearly price must be 4790 cents ($47.90)');
      assert.strictEqual(pro.prices.oneTime, 9900, 'Pro one-time price must be 9900 cents ($99.00)');

      const fullAnnualAtMonthlyRate = 4.99 * 12;
      const actualAnnualRate = 47.90;
      const proDiscountPercent = ((fullAnnualAtMonthlyRate - actualAnnualRate) / fullAnnualAtMonthlyRate) * 100;

      assert.ok(
        Math.abs(proDiscountPercent - 20) < 0.1,
        `Pro annual discount must approximate 20% (calculated: ${proDiscountPercent.toFixed(2)}%)`
      );

      const proMonthlyEquivalent = actualAnnualRate / 12;
      assert.ok(
        Math.abs(proMonthlyEquivalent - 3.99) < 0.01,
        `Pro monthly equivalent on annual billing must be ~$3.99/mo (calculated: ${proMonthlyEquivalent.toFixed(4)})`
      );
    });

    it('validates Business tier price structure and ~20% annual discount', () => {
      const biz = TIERS.find((t) => t.id === 'business');
      assert.ok(biz, 'Business tier definition must exist in TIERS');

      assert.strictEqual(biz.prices.monthly, 999, 'Business monthly price must be 999 cents ($9.99)');
      assert.strictEqual(biz.prices.yearly, 9590, 'Business yearly price must be 9590 cents ($95.90)');
      assert.strictEqual(biz.prices.oneTime, 19900, 'Business one-time price must be 19900 cents ($199.00)');

      const fullAnnualAtMonthlyRate = 9.99 * 12;
      const actualAnnualRate = 95.90;
      const bizDiscountPercent = ((fullAnnualAtMonthlyRate - actualAnnualRate) / fullAnnualAtMonthlyRate) * 100;

      assert.ok(
        Math.abs(bizDiscountPercent - 20) < 0.1,
        `Business annual discount must approximate 20% (calculated: ${bizDiscountPercent.toFixed(2)}%)`
      );

      const bizMonthlyEquivalent = actualAnnualRate / 12;
      assert.ok(
        Math.abs(bizMonthlyEquivalent - 7.99) < 0.01,
        `Business monthly equivalent on annual billing must be ~$7.99/mo (calculated: ${bizMonthlyEquivalent.toFixed(4)})`
      );
    });

    it('validates plans.config.ts alignment with Stripe price IDs and rates', () => {
      const proConfig = PLAN_TIER_CONFIGS.pro;
      assert.strictEqual(proConfig.priceMonthly, 4.99);
      assert.strictEqual(proConfig.priceYearly, 3.99);
      assert.ok(proConfig.stripePriceMonthlyId?.startsWith('price_'));
      assert.ok(proConfig.stripePriceYearlyId?.startsWith('price_'));

      const bizConfig = PLAN_TIER_CONFIGS.business;
      assert.strictEqual(bizConfig.priceMonthly, 9.99);
      assert.strictEqual(bizConfig.priceYearly, 7.99);
      assert.ok(bizConfig.stripePriceMonthlyId?.startsWith('price_'));
      assert.ok(bizConfig.stripePriceYearlyId?.startsWith('price_'));

      const freeConfig = PLAN_TIER_CONFIGS.free;
      assert.strictEqual(freeConfig.priceMonthly, 0);
      assert.strictEqual(freeConfig.priceYearly, 0);
    });
  });

  describe('Suite 4: Architectural Invariants & Code Standards', () => {
    it('verifies init-stripe-products.ts contains zero process.env fallbacks', () => {
      const content = fs.readFileSync(scriptPath, 'utf8');
      const fallbackRegex = /process\.env(?:\.[a-zA-Z0-9_]+|\[['"][a-zA-Z0-9_]+['"]\])\s*\|\|/g;
      const matches = content.match(fallbackRegex) || [];
      assert.strictEqual(
        matches.length,
        0,
        `init-stripe-products.ts must have 0 process.env || fallbacks: ${JSON.stringify(matches)}`
      );
    });

    it('verifies plans.config.ts contains zero process.env fallbacks', () => {
      const content = fs.readFileSync(plansConfigPath, 'utf8');
      const fallbackRegex = /process\.env(?:\.[a-zA-Z0-9_]+|\[['"][a-zA-Z0-9_]+['"]\])\s*\|\|/g;
      const matches = content.match(fallbackRegex) || [];
      assert.strictEqual(
        matches.length,
        0,
        `plans.config.ts must have 0 process.env || fallbacks: ${JSON.stringify(matches)}`
      );
    });

    it('verifies clean bottom exports in init-stripe-products.ts and plans.config.ts', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8').trim();
      assert.ok(
        scriptContent.endsWith('};') || scriptContent.endsWith('}'),
        'Exports in init-stripe-products.ts must terminate the file cleanly'
      );
      assert.ok(
        scriptContent.includes('export {') && scriptContent.includes('export type {'),
        'Exports in init-stripe-products.ts must be grouped at the bottom'
      );

      const plansContent = fs.readFileSync(plansConfigPath, 'utf8').trim();
      assert.ok(
        plansContent.endsWith('};') || plansContent.endsWith('}'),
        'Exports in plans.config.ts must terminate the file cleanly'
      );
      assert.ok(
        plansContent.includes('export {'),
        'Exports in plans.config.ts must be grouped at the bottom'
      );
    });

    it('verifies clean TypeScript compilation with zero diagnostics', () => {
      const program = ts.createProgram([scriptPath, plansConfigPath], {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
      });

      const diagnostics = ts.getPreEmitDiagnostics(program);
      const errors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error
      );

      assert.strictEqual(
        errors.length,
        0,
        `TypeScript compilation must have 0 errors, found ${errors.length}:\n` +
          errors
            .map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n'))
            .join('\n')
      );
    });
  });
});
