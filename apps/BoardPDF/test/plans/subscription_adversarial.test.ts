import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_TOOLS_LIMITS, getPlanBenefits, getToolTierLimits, normalizeTierKey, PLAN_TIER_BENEFITS, resolveToolLimits, WORKFLOW_LIMITS } from '../../src/config/subscription-plans.config.js';
import { getToolLimits, TOOLS_LIMITS } from '../../src/config/tools-limits.config.js';
import { getCurrentUserToolLimits } from '../../client/config/tools-limits.config.js';

describe('Adversarial Critic Stress Suite: Invariants, Boundary Cases & Integrity', () => {
  it('validates strictly positive limits and monotonic non-decreasing progression for all 34 tools', () => {
    const tiers = ['free', 'pro', 'business', 'enterprise'] as const;
    for (const [toolId, tool] of Object.entries(ALL_TOOLS_LIMITS)) {
      for (const tier of tiers) {
        const cfg = tool[tier];
        assert.ok(cfg.maxFiles >= 1, `${toolId} (${tier}): maxFiles must be >= 1`);
        assert.ok(cfg.maxFileSizeMB >= 1, `${toolId} (${tier}): maxFileSizeMB must be >= 1`);
        assert.ok(cfg.maxTotalSizeMB >= 1, `${toolId} (${tier}): maxTotalSizeMB must be >= 1`);
        assert.ok(cfg.maxFileSizeMB <= cfg.maxTotalSizeMB, `${toolId} (${tier}): maxFileSizeMB must not exceed maxTotalSizeMB`);
      }

      assert.ok(tool.free.maxFiles <= tool.pro.maxFiles, `${toolId}: free.maxFiles > pro.maxFiles`);
      assert.ok(tool.pro.maxFiles <= tool.business.maxFiles, `${toolId}: pro.maxFiles > business.maxFiles`);
      assert.ok(tool.business.maxFiles <= tool.enterprise.maxFiles, `${toolId}: business.maxFiles > enterprise.maxFiles`);

      assert.ok(tool.free.maxFileSizeMB <= tool.pro.maxFileSizeMB, `${toolId}: free.maxFileSizeMB > pro.maxFileSizeMB`);
      assert.ok(tool.pro.maxFileSizeMB <= tool.business.maxFileSizeMB, `${toolId}: pro.maxFileSizeMB > business.maxFileSizeMB`);
      assert.ok(tool.business.maxFileSizeMB <= tool.enterprise.maxFileSizeMB, `${toolId}: business.maxFileSizeMB > enterprise.maxFileSizeMB`);

      assert.ok(tool.free.maxTotalSizeMB <= tool.pro.maxTotalSizeMB, `${toolId}: free.maxTotalSizeMB > pro.maxTotalSizeMB`);
      assert.ok(tool.pro.maxTotalSizeMB <= tool.business.maxTotalSizeMB, `${toolId}: pro.maxTotalSizeMB > business.maxTotalSizeMB`);
      assert.ok(tool.business.maxTotalSizeMB <= tool.enterprise.maxTotalSizeMB, `${toolId}: business.maxTotalSizeMB > enterprise.maxTotalSizeMB`);

      assert.deepStrictEqual(tool.premium, tool.pro, `${toolId}: premium alias must match pro`);
    }
  });

  it('validates strict permission precedence order in resolveToolLimits', () => {
    const entVsBusVsPro = resolveToolLimits('merge-pdf', [
      'subscription:feature:pro',
      'subscription:feature:business',
      'subscription:feature:enterprise',
    ]);
    assert.strictEqual(entVsBusVsPro.maxFiles, 1000);

    const busVsPro = resolveToolLimits('merge-pdf', [
      'subscription:feature:pro',
      'subscription:feature:business',
    ]);
    assert.strictEqual(busVsPro.maxFiles, 500);

    const busVsLegacyPro = resolveToolLimits('merge-pdf', [
      'tools:merge:batch_500',
      'subscription:feature:business',
    ]);
    assert.strictEqual(busVsLegacyPro.maxFiles, 500);
  });

  it('handles null, undefined, and malformed inputs to resolveToolLimits safely', () => {
    const nullPerms = resolveToolLimits('merge-pdf', null as any);
    assert.strictEqual(nullPerms.maxFiles, 25);

    const undefPerms = resolveToolLimits('merge-pdf', undefined as any);
    assert.strictEqual(undefPerms.maxFiles, 25);

    const unknownTool = resolveToolLimits('non-existent-tool-xyz', ['subscription:feature:enterprise']);
    assert.strictEqual(unknownTool.maxFiles, 1);
    assert.strictEqual(unknownTool.maxFileSizeMB, 50);
  });

  it('normalizes tier aliases, casing, whitespace, and invalid names gracefully', () => {
    assert.strictEqual(normalizeTierKey('  PRO  '), 'pro');
    assert.strictEqual(normalizeTierKey('BUSINESS'), 'business');
    assert.strictEqual(normalizeTierKey('negocios'), 'business');
    assert.strictEqual(normalizeTierKey('ENTERPRISE'), 'enterprise');
    assert.strictEqual(normalizeTierKey('empresas'), 'enterprise');
    assert.strictEqual(normalizeTierKey('escuelas'), 'edu_school');
    assert.strictEqual(normalizeTierKey('universidades'), 'edu_university');
    assert.strictEqual(normalizeTierKey('educacion_individual'), 'edu_individual');
    assert.strictEqual(normalizeTierKey('unknown_tier_xyz'), 'free');
    assert.strictEqual(normalizeTierKey(null), 'free');
    assert.strictEqual(normalizeTierKey(undefined), 'free');
  });

  it('validates client-side getCurrentUserToolLimits for all tools and safe fallback', () => {
    for (const toolId of Object.keys(ALL_TOOLS_LIMITS)) {
      const clientLimit = getCurrentUserToolLimits(toolId);
      assert.ok(clientLimit.isPremium);
      assert.strictEqual(clientLimit.maxFiles, ALL_TOOLS_LIMITS[toolId].premium.maxFiles);
      assert.strictEqual(clientLimit.maxFileSizeMB, ALL_TOOLS_LIMITS[toolId].premium.maxFileSizeMB);
      assert.strictEqual(clientLimit.maxTotalSizeMB, ALL_TOOLS_LIMITS[toolId].premium.maxTotalSizeMB);
    }

    const unknownClient = getCurrentUserToolLimits('non-existent-client-tool');
    assert.ok(unknownClient.isPremium);
    assert.strictEqual(unknownClient.maxFiles, 50);
  });

  it('validates storage quotas and workflow limits strict monotonicity across tiers', () => {
    assert.strictEqual(WORKFLOW_LIMITS.free, 5);
    assert.strictEqual(WORKFLOW_LIMITS.pro, 50);
    assert.strictEqual(WORKFLOW_LIMITS.business, 200);
    assert.strictEqual(WORKFLOW_LIMITS.enterprise, 1000);

    assert.strictEqual(PLAN_TIER_BENEFITS.free.storageGB, 5);
    assert.strictEqual(PLAN_TIER_BENEFITS.pro.storageGB, 100);
    assert.strictEqual(PLAN_TIER_BENEFITS.business.storageGB, 500);
    assert.strictEqual(PLAN_TIER_BENEFITS.enterprise.storageGB, 1024);
  });
});
