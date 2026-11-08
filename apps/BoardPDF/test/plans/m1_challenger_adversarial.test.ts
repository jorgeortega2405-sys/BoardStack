import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as clientMasterConfig from '../../client/config/subscription-plans.config.js';
import { getCurrentUserToolLimits, getMaxWorkflows as getClientMaxWorkflows, TOOLS_LIMITS as CLIENT_TOOLS_LIMITS, WORKFLOW_LIMITS as CLIENT_WORKFLOW_LIMITS } from '../../client/config/tools-limits.config.js';
import {
  ALL_TOOLS_LIMITS,
  getPlanBenefits,
  getToolTierLimits,
  normalizeTierKey,
  PLAN_TIER_BENEFITS,
  resolveToolLimits,
  SubscriptionTierKey,
  WORKFLOW_LIMITS,
} from '../../src/config/subscription-plans.config.js';
import { getMaxWorkflows as getServerMaxWorkflows, getToolLimits, TOOLS_LIMITS as SERVER_TOOLS_LIMITS, WORKFLOW_LIMITS as SERVER_WORKFLOW_LIMITS } from '../../src/config/tools-limits.config.js';

const ALL_30_PDF_TOOLS = [
  'compare-pdf',
  'compress-pdf',
  'crop-pdf',
  'edit-pdf',
  'excel-to-pdf',
  'extract-pdf-pages',
  'html-to-pdf',
  'jpg-to-pdf',
  'merge-pdf',
  'ocr-pdf',
  'organize-pdf',
  'page-numbers',
  'pdf-converter',
  'pdf-to-excel',
  'pdf-to-jpg',
  'pdf-to-markdown',
  'pdf-to-pdfa',
  'pdf-to-powerpoint',
  'pdf-to-word',
  'powerpoint-to-pdf',
  'protect-pdf',
  'redact-pdf',
  'remove-pdf-pages',
  'repair-pdf',
  'rotate-pdf',
  'split-pdf',
  'summarize-pdf',
  'to-pdf-converter',
  'translate-pdf',
  'unlock-pdf',
  'watermark-pdf',
  'word-to-pdf',
];

const SPECIAL_TOOLS = ['collaborative-pdf', 'workflows'];
const ALL_EXPECTED_TOOL_KEYS = [...ALL_30_PDF_TOOLS, ...SPECIAL_TOOLS];

describe('CHALLENGER 1: Adversarial Master Config & Limits Stress Tests', () => {
  describe('Suite 1: 30 Tools Catalog Integrity & Monotonicity', () => {
    it('contains all 30 PDF tools plus collaborative-pdf and workflows', () => {
      for (const toolId of ALL_EXPECTED_TOOL_KEYS) {
        assert.ok(ALL_TOOLS_LIMITS[toolId], `Tool ${toolId} must exist in ALL_TOOLS_LIMITS`);
      }
      assert.ok(Object.keys(ALL_TOOLS_LIMITS).length >= 32);
    });

    it('enforces strict proportionality and monotonicity across Free <= Pro <= Business', () => {
      for (const toolId of ALL_EXPECTED_TOOL_KEYS) {
        const limits = ALL_TOOLS_LIMITS[toolId];
        assert.ok(limits, `Missing limits for ${toolId}`);

        for (const tier of ['free', 'pro', 'business'] as const) {
          const tierLimits = limits[tier];
          assert.ok(tierLimits, `Missing ${tier} for ${toolId}`);
          assert.ok(Number.isInteger(tierLimits.maxFiles) && tierLimits.maxFiles > 0, `${toolId} ${tier} maxFiles invalid`);
          assert.ok(Number.isInteger(tierLimits.maxFileSizeMB) && tierLimits.maxFileSizeMB > 0, `${toolId} ${tier} maxFileSizeMB invalid`);
          assert.ok(Number.isInteger(tierLimits.maxTotalSizeMB) && tierLimits.maxTotalSizeMB > 0, `${toolId} ${tier} maxTotalSizeMB invalid`);
          assert.ok(
            tierLimits.maxTotalSizeMB >= tierLimits.maxFileSizeMB,
            `${toolId} ${tier} maxTotalSizeMB (${tierLimits.maxTotalSizeMB}) must be >= maxFileSizeMB (${tierLimits.maxFileSizeMB})`
          );
        }

        assert.ok(limits.pro.maxFiles >= limits.free.maxFiles, `${toolId} Pro maxFiles < Free`);
        assert.ok(limits.pro.maxFileSizeMB >= limits.free.maxFileSizeMB, `${toolId} Pro maxFileSizeMB < Free`);
        assert.ok(limits.pro.maxTotalSizeMB >= limits.free.maxTotalSizeMB, `${toolId} Pro maxTotalSizeMB < Free`);

        assert.ok(limits.business.maxFiles >= limits.pro.maxFiles, `${toolId} Business maxFiles < Pro`);
        assert.ok(limits.business.maxFileSizeMB >= limits.pro.maxFileSizeMB, `${toolId} Business maxFileSizeMB < Pro`);
        assert.ok(limits.business.maxTotalSizeMB >= limits.pro.maxTotalSizeMB, `${toolId} Business maxTotalSizeMB < Pro`);
      }
    });

    it('enforces rational boundary constraints on Free and Business tiers', () => {
      for (const toolId of ALL_EXPECTED_TOOL_KEYS) {
        const free = ALL_TOOLS_LIMITS[toolId].free;
        assert.ok(free.maxFiles <= 25, `${toolId} free maxFiles (${free.maxFiles}) exceeds ceiling 25`);
        assert.ok(free.maxFileSizeMB <= 100, `${toolId} free maxFileSizeMB (${free.maxFileSizeMB}) exceeds ceiling 100`);
        assert.ok(free.maxTotalSizeMB <= 100, `${toolId} free maxTotalSizeMB (${free.maxTotalSizeMB}) exceeds ceiling 100`);

        const biz = ALL_TOOLS_LIMITS[toolId].business;
        assert.ok(biz.maxFiles >= 3, `${toolId} business maxFiles too low`);
        assert.ok(biz.maxFileSizeMB >= 200, `${toolId} business maxFileSizeMB too low`);
        assert.ok(biz.maxTotalSizeMB >= 300, `${toolId} business maxTotalSizeMB too low`);
      }
    });
  });

  describe('Suite 2: Plan Benefits, Corporate Capabilities & Security Flags', () => {
    it('strictly isolates Free plan from paid capabilities and charges', () => {
      const free = PLAN_TIER_BENEFITS.free;
      assert.strictEqual(free.id, 'free');
      assert.strictEqual(free.storageGB, 5);
      assert.strictEqual(free.priceMonthly, 0);
      assert.strictEqual(free.priceYearly, 0);
      assert.strictEqual(free.hasSso, false);
      assert.strictEqual(free.hasSaml, false);
      assert.strictEqual(free.hasOrganization, false);
      assert.strictEqual(free.hasAdvancedAi, false);
      assert.strictEqual(free.hasBatchProcessing, false);
      assert.strictEqual(free.maxWorkflows, 5);
      assert.strictEqual(free.supportLevel, 'community');
    });

    it('verifies Pro plan benefits and limits', () => {
      const pro = PLAN_TIER_BENEFITS.pro;
      assert.strictEqual(pro.id, 'pro');
      assert.strictEqual(pro.storageGB, 100);
      assert.ok(pro.priceMonthly > 0);
      assert.ok(pro.priceYearly > 0);
      assert.strictEqual(pro.hasSso, false);
      assert.strictEqual(pro.hasSaml, false);
      assert.strictEqual(pro.hasOrganization, false);
      assert.strictEqual(pro.hasAdvancedAi, true);
      assert.strictEqual(pro.hasBatchProcessing, true);
      assert.strictEqual(pro.maxWorkflows, 50);
      assert.strictEqual(pro.supportLevel, 'priority');
    });

    it('verifies Business plan benefits and limits', () => {
      const business = PLAN_TIER_BENEFITS.business;
      assert.strictEqual(business.id, 'business');
      assert.strictEqual(business.storageGB, 500);
      assert.ok(business.priceMonthly > 0);
      assert.ok(business.priceYearly > 0);
      assert.strictEqual(business.hasSso, false);
      assert.strictEqual(business.hasSaml, false);
      assert.strictEqual(business.hasOrganization, true);
      assert.strictEqual(business.hasAdvancedAi, true);
      assert.strictEqual(business.hasBatchProcessing, true);
      assert.strictEqual(business.maxWorkflows, 200);
      assert.strictEqual(business.supportLevel, 'priority');
    });

    it('verifies workflow quotas consistency with WORKFLOW_LIMITS', () => {
      const tiers: SubscriptionTierKey[] = ['free', 'pro', 'business'];
      for (const tier of tiers) {
        assert.strictEqual(PLAN_TIER_BENEFITS[tier].maxWorkflows, WORKFLOW_LIMITS[tier]);
      }
      assert.ok(WORKFLOW_LIMITS.business >= WORKFLOW_LIMITS.pro);
      assert.ok(WORKFLOW_LIMITS.pro >= WORKFLOW_LIMITS.free);
    });
  });

  describe('Suite 3: normalizeTierKey & getPlanBenefits Adversarial Resilience', () => {
    it('handles Spanish aliases, mixed cases, and whitespace padding', () => {
      assert.strictEqual(normalizeTierKey('FREE'), 'free');
      assert.strictEqual(normalizeTierKey('  pro  '), 'pro');
      assert.strictEqual(normalizeTierKey('NEGOCIOS'), 'business');
      assert.strictEqual(normalizeTierKey('business'), 'business');
    });

    it('falls back safely to free for null, undefined, empty, or unknown strings', () => {
      assert.strictEqual(normalizeTierKey(null), 'free');
      assert.strictEqual(normalizeTierKey(undefined), 'free');
      assert.strictEqual(normalizeTierKey(''), 'free');
      assert.strictEqual(normalizeTierKey('   '), 'free');
      assert.strictEqual(normalizeTierKey('unknown_tier'), 'free');
      assert.strictEqual(normalizeTierKey('superadmin'), 'free');
      assert.strictEqual(normalizeTierKey('gold_vip'), 'free');
    });

    it('getPlanBenefits always returns valid definition without throwing', () => {
      const freeDef = getPlanBenefits();
      assert.strictEqual(freeDef.id, 'free');
      assert.ok(freeDef.features.length >= 5);

      const nullDef = getPlanBenefits(null);
      assert.strictEqual(nullDef.id, 'free');

      const garbageDef = getPlanBenefits('invalid_plan_123');
      assert.strictEqual(garbageDef.id, 'free');
    });
  });

  describe('Suite 4: getToolTierLimits Stress Tests', () => {
    it('handles unknown tool IDs with safe fallback in getToolTierLimits', () => {
      const unknownFree = getToolTierLimits('non-existent-tool-id', 'free');
      assert.deepStrictEqual(unknownFree, { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 });

      const unknownBiz = getToolTierLimits('another-fake-tool', 'business');
      assert.deepStrictEqual(unknownBiz, { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 });
    });
  });

  describe('Suite 5: PBAC resolveToolLimits Adversarial Evaluation', () => {
    it('resolves free limits for empty, undefined, null, or non-matching permissions', () => {
      for (const toolId of ALL_EXPECTED_TOOL_KEYS) {
        const freeExpected = ALL_TOOLS_LIMITS[toolId].free;

        const resEmpty = resolveToolLimits(toolId, []);
        assert.deepStrictEqual(resEmpty, freeExpected);

        const resUndef = resolveToolLimits(toolId, undefined);
        assert.deepStrictEqual(resUndef, freeExpected);

        const resNull = resolveToolLimits(toolId, null as any);
        assert.deepStrictEqual(resNull, freeExpected);

        const resUnrelated = resolveToolLimits(toolId, ['user:profile', 'admin:access', 'subscription:feature:other']);
        assert.deepStrictEqual(resUnrelated, freeExpected);
      }
    });

    it('evaluates hierarchy precedence: Business > Pro > Legacy', () => {
      const toolId = 'merge-pdf';

      const resBiz = resolveToolLimits(toolId, ['subscription:feature:business']);
      assert.strictEqual(resBiz.maxFiles, 500);
      assert.strictEqual(resBiz.maxFileSizeMB, 1000);

      const resBizMulti = resolveToolLimits(toolId, [
        'subscription:feature:pro',
        'subscription:feature:business',
        'tools:merge:batch_500',
      ]);
      assert.strictEqual(resBizMulti.maxFiles, 500, 'Business must take precedence over Pro and Legacy');
    });

    it('preserves legacy mock permissions backward compatibility across all 30 tools', () => {
      const mergeLegacy = resolveToolLimits('merge-pdf', ['tools:merge:batch_500']);
      assert.strictEqual(mergeLegacy.maxFiles, 500);

      const organizeLegacy = resolveToolLimits('organize-pdf', ['tools:merge:batch_500']);
      assert.strictEqual(organizeLegacy.maxFiles, 500);

      const splitLegacy = resolveToolLimits('split-pdf', ['tools:split:by_size']);
      assert.strictEqual(splitLegacy.maxFileSizeMB, 1000);

      const extractLegacy = resolveToolLimits('extract-pdf-pages', ['tools:split:by_size']);
      assert.strictEqual(extractLegacy.maxFileSizeMB, 500);

      const aiSumLegacy = resolveToolLimits('summarize-pdf', ['tools:ai:advanced']);
      assert.strictEqual(aiSumLegacy.maxFileSizeMB, 200);

      const aiTransLegacy = resolveToolLimits('translate-pdf', ['tools:ai:advanced']);
      assert.strictEqual(aiTransLegacy.maxFileSizeMB, 200);

      const compressLegacy = resolveToolLimits('compress-pdf', ['tools:high_size_limit']);
      assert.strictEqual(compressLegacy.maxFileSizeMB, 1000);
    });

    it('safely handles adversarial permission list containing null, undefined, numbers, and huge arrays', () => {
      const dirtyPerms = ['tools:merge:batch_500', null as any, undefined as any, 9999 as any];
      const resDirty = resolveToolLimits('merge-pdf', dirtyPerms);
      assert.strictEqual(resDirty.maxFiles, 500);

      const hugePerms = Array.from({ length: 5000 }, (_, i) => `unrelated:perm:${i}`);
      hugePerms.push('subscription:feature:pro');
      const start = performance.now();
      const resHuge = resolveToolLimits('merge-pdf', hugePerms);
      const duration = performance.now() - start;
      assert.strictEqual(resHuge.maxFiles, 500);
      assert.ok(duration < 50, `PBAC resolution on 5000 permissions took ${duration}ms, expected < 50ms`);
    });

    it('safely handles unknown tool ID with default fallback', () => {
      const unknownBiz = resolveToolLimits('unknown-tool', ['subscription:feature:business']);
      assert.deepStrictEqual(unknownBiz, { maxFiles: 1, maxFileSizeMB: 50, maxTotalSizeMB: 50 });
    });
  });

  describe('Suite 6: Backward Compatibility Bridges (Server & Client)', () => {
    it('server bridge src/config/tools-limits.config.ts delegates seamlessly', () => {
      assert.strictEqual(SERVER_TOOLS_LIMITS['merge-pdf'].free.maxFiles, 25);
      assert.strictEqual(SERVER_TOOLS_LIMITS['merge-pdf'].pro.maxFiles, 500);

      const limitsFree = getToolLimits('merge-pdf', []);
      assert.strictEqual(limitsFree.maxFiles, 25);
      assert.strictEqual(limitsFree.maxFileSizeMB, 50);

      const limitsLegacy = getToolLimits('merge-pdf', ['tools:merge:batch_500']);
      assert.strictEqual(limitsLegacy.maxFiles, 500);
      assert.strictEqual(limitsLegacy.maxFileSizeMB, 1000);

      const limitsUnknown = getToolLimits('fake-tool');
      assert.strictEqual(limitsUnknown.maxFiles, 1);

      assert.strictEqual(SERVER_WORKFLOW_LIMITS.free, 5);
      assert.strictEqual(SERVER_WORKFLOW_LIMITS.business, 200);
      assert.ok(getServerMaxWorkflows() >= 100);
    });

    it('client bridge client/config/tools-limits.config.ts preserves client expectations', () => {
      assert.strictEqual(CLIENT_TOOLS_LIMITS['merge-pdf'].free.maxFiles, 25);
      assert.strictEqual(CLIENT_TOOLS_LIMITS['merge-pdf'].pro.maxFiles, 500);

      const clientLimits = getCurrentUserToolLimits('merge-pdf');
      assert.strictEqual(clientLimits.isPremium, false);
      assert.strictEqual(clientLimits.maxFiles, 25);
      assert.strictEqual(clientLimits.maxFileSizeMB, 50);

      const clientUnknown = getCurrentUserToolLimits('unknown-tool');
      assert.strictEqual(clientUnknown.isPremium, false);
      assert.strictEqual(clientUnknown.maxFiles, 1);

      assert.strictEqual(CLIENT_WORKFLOW_LIMITS.business, 200);
      assert.ok(getClientMaxWorkflows() >= 100);
    });

    it('client gateway client/config/subscription-plans.config.ts re-exports master faithfully', () => {
      assert.strictEqual(clientMasterConfig.ALL_TOOLS_LIMITS, ALL_TOOLS_LIMITS);
      assert.strictEqual(clientMasterConfig.PLAN_TIER_BENEFITS, PLAN_TIER_BENEFITS);
      assert.strictEqual(clientMasterConfig.WORKFLOW_LIMITS, WORKFLOW_LIMITS);
      assert.strictEqual(clientMasterConfig.getPlanBenefits, getPlanBenefits);
      assert.strictEqual(clientMasterConfig.getToolTierLimits, getToolTierLimits);
      assert.strictEqual(clientMasterConfig.resolveToolLimits, resolveToolLimits);
    });
  });
});
