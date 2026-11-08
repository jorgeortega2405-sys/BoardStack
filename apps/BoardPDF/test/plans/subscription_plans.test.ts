import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_TOOLS_LIMITS, getPlanBenefits, getToolTierLimits, PLAN_TIER_BENEFITS, resolveToolLimits, WORKFLOW_LIMITS } from '../../src/config/subscription-plans.config.js';
import { getToolLimits, TOOLS_LIMITS } from '../../src/config/tools-limits.config.js';

describe('Subscription Plans Master Configuration', () => {
  it('covers all active subscription tiers in PLAN_TIER_BENEFITS', () => {
    const requiredTiers = ['free', 'pro', 'business'];
    for (const tier of requiredTiers) {
      assert.ok(PLAN_TIER_BENEFITS[tier as keyof typeof PLAN_TIER_BENEFITS]);
      const def = getPlanBenefits(tier);
      assert.strictEqual(def.id, tier);
      assert.ok(def.name.length > 0);
      assert.ok(def.features.length >= 5);
      assert.ok(typeof def.storageGB === 'number' && def.storageGB > 0);
    }
  });

  it('correctly maps storage quotas across plans', () => {
    const free = getPlanBenefits('free');
    assert.strictEqual(free.storageGB, 5);

    const pro = getPlanBenefits('pro');
    assert.strictEqual(pro.storageGB, 100);

    const business = getPlanBenefits('business');
    assert.strictEqual(business.storageGB, 500);
  });

  it('contains explicit limits for all 30 PDF tools plus collaborative-pdf and workflows', () => {
    const thirtyTools = [
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

    for (const toolId of thirtyTools) {
      assert.ok(ALL_TOOLS_LIMITS[toolId], `Tool ${toolId} must be present in ALL_TOOLS_LIMITS`);
      const limits = ALL_TOOLS_LIMITS[toolId];

      assert.ok(limits.free.maxFiles > 0);
      assert.ok(limits.free.maxFileSizeMB > 0);
      assert.ok(limits.free.maxTotalSizeMB > 0);

      assert.ok(limits.pro.maxFiles >= limits.free.maxFiles);
      assert.ok(limits.pro.maxFileSizeMB >= limits.free.maxFileSizeMB);

      assert.ok(limits.business.maxFiles >= limits.pro.maxFiles);
      assert.ok(limits.business.maxFileSizeMB >= limits.pro.maxFileSizeMB);
    }

    assert.ok(ALL_TOOLS_LIMITS['collaborative-pdf']);
    assert.ok(ALL_TOOLS_LIMITS['workflows']);
  });

  it('resolves tool limits based on PBAC permissions', () => {
    const freeMerge = resolveToolLimits('merge-pdf', []);
    assert.strictEqual(freeMerge.maxFiles, 25);
    assert.strictEqual(freeMerge.maxFileSizeMB, 50);

    const proMerge = resolveToolLimits('merge-pdf', ['subscription:feature:pro']);
    assert.strictEqual(proMerge.maxFiles, 500);
    assert.strictEqual(proMerge.maxFileSizeMB, 1000);

    const businessMerge = resolveToolLimits('merge-pdf', ['subscription:feature:business']);
    assert.strictEqual(businessMerge.maxFiles, 500);
    assert.strictEqual(businessMerge.maxFileSizeMB, 1000);

    const legacyMerge = resolveToolLimits('merge-pdf', ['tools:merge:batch_500']);
    assert.strictEqual(legacyMerge.maxFiles, 500);

    const legacySplit = resolveToolLimits('split-pdf', ['tools:split:by_size']);
    assert.strictEqual(legacySplit.maxFileSizeMB, 1000);

    const legacyAi = resolveToolLimits('summarize-pdf', ['tools:ai:advanced']);
    assert.strictEqual(legacyAi.maxFileSizeMB, 200);

    const fallbackUnknown = resolveToolLimits('non-existent-tool', ['subscription:feature:business']);
    assert.strictEqual(fallbackUnknown.maxFiles, 1);
    assert.strictEqual(fallbackUnknown.maxFileSizeMB, 50);
  });

  it('maintains backward compatibility with tools-limits bridge', () => {
    assert.strictEqual(TOOLS_LIMITS['merge-pdf'].free.maxFiles, 25);
    assert.strictEqual(TOOLS_LIMITS['merge-pdf'].pro.maxFiles, 500);

    const limitsDefault = getToolLimits('merge-pdf');
    assert.strictEqual(limitsDefault.maxFiles, 25);

    const limitsLegacy = getToolLimits('merge-pdf', ['tools:merge:batch_500']);
    assert.strictEqual(limitsLegacy.maxFiles, 500);

    const limitsUnknown = getToolLimits('unknown', ['tools:merge:batch_500']);
    assert.strictEqual(limitsUnknown.maxFiles, 1);
  });

  it('correctly retrieves tier limits using getToolTierLimits', () => {
    const freeLimits = getToolTierLimits('merge-pdf', 'free');
    assert.strictEqual(freeLimits.maxFiles, 25);

    const proLimits = getToolTierLimits('merge-pdf', 'pro');
    assert.strictEqual(proLimits.maxFiles, 500);

    const businessLimits = getToolTierLimits('merge-pdf', 'business');
    assert.strictEqual(businessLimits.maxFiles, 500);
  });

  it('defines workflow quotas consistently across plans', () => {
    assert.strictEqual(WORKFLOW_LIMITS.free, 5);
    assert.strictEqual(WORKFLOW_LIMITS.pro, 50);
    assert.strictEqual(WORKFLOW_LIMITS.business, 200);
  });
});
