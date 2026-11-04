import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculatePdfCost, getMonthlyQuotaByPermissions } from '../../src/services/ai-token.service.js';

describe('AI Tokens Engine & PBAC Quotas', () => {
  it('assigns 100 tokens to standard free accounts', () => {
    const quota = getMonthlyQuotaByPermissions([]);
    assert.strictEqual(quota, 100);
  });

  it('assigns 2,000 tokens to Pro accounts via subscription:feature:pro', () => {
    const quota = getMonthlyQuotaByPermissions(['subscription:feature:pro']);
    assert.strictEqual(quota, 2000);
  });

  it('assigns 5,000 tokens to Business accounts via subscription:feature:business', () => {
    const quota = getMonthlyQuotaByPermissions(['subscription:feature:pro', 'subscription:feature:business']);
    assert.strictEqual(quota, 5000);
  });

  it('assigns 25,000 tokens to Enterprise accounts via subscription:feature:enterprise', () => {
    const quota = getMonthlyQuotaByPermissions([
      'subscription:feature:pro',
      'subscription:feature:business',
      'subscription:feature:enterprise',
    ]);
    assert.strictEqual(quota, 25000);
  });

  it('calculates summarize-pdf cost based on page count and file size', () => {
    const cost1 = calculatePdfCost('summarize-pdf', 1, 500 * 1024);
    assert.strictEqual(cost1, 4);

    const cost5 = calculatePdfCost('summarize-pdf', 5, 2 * 1024 * 1024);
    assert.strictEqual(cost5, 8);

    const costHeavy = calculatePdfCost('summarize-pdf', 10, 12 * 1024 * 1024);
    assert.strictEqual(costHeavy, 15);
  });

  it('calculates pdf-to-markdown cost with 2 tokens per page plus base and size', () => {
    const cost1 = calculatePdfCost('pdf-to-markdown', 1, 100 * 1024);
    assert.strictEqual(cost1, 5);

    const cost10 = calculatePdfCost('pdf-to-markdown', 10, 2 * 1024 * 1024);
    assert.strictEqual(cost10, 23);
  });

  it('calculates translate-pdf cost with 2 tokens per page plus base and size', () => {
    const cost1 = calculatePdfCost('translate-pdf', 1, 500 * 1024);
    assert.strictEqual(cost1, 5);

    const cost5 = calculatePdfCost('translate-pdf', 5, 1 * 1024 * 1024);
    assert.strictEqual(cost5, 13);
  });

  it('handles zero or negative page count safely by falling back to at least 1 page', () => {
    const costZero = calculatePdfCost('summarize-pdf', 0, 0);
    assert.ok(costZero >= 3);

    const costNeg = calculatePdfCost('translate-pdf', -5, 0);
    assert.ok(costNeg >= 4);
  });
});
