import {
  BUSINESS_PLAN,
  ENTERPRISE_PLAN,
  PRO_PLAN,
  STORAGE_TIER_LIMITS,
  TIER_RANK,
  calculatePeriodEnd,
  getPriceAmount,
  getStorageTierLabel,
  getStorageTierLimitBytes,
  getTierRank,
} from '../src/server/config/subscription-plans.config.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('tier ranks and storage limits enforce strictly increasing progression', () => {
  assert.equal(TIER_RANK.free, 0);
  assert.equal(TIER_RANK.pro, 1);
  assert.equal(TIER_RANK.business, 2);
  assert.equal(TIER_RANK.enterprise, 3);

  assert.equal(getTierRank('free'), 0);
  assert.equal(getTierRank('pro'), 1);
  assert.equal(getTierRank('business'), 2);
  assert.equal(getTierRank('enterprise'), 3);
  assert.equal(getTierRank(null), 0);
  assert.equal(getTierRank('unknown'), 0);

  assert.equal(STORAGE_TIER_LIMITS.free, 0);
  assert.equal(STORAGE_TIER_LIMITS.pro, 100 * 1024 * 1024 * 1024);
  assert.equal(STORAGE_TIER_LIMITS.business, 1024 * 1024 * 1024 * 1024);
  assert.equal(STORAGE_TIER_LIMITS.enterprise, 10 * 1024 * 1024 * 1024 * 1024);

  assert.equal(getStorageTierLimitBytes('free'), STORAGE_TIER_LIMITS.free);
  assert.equal(getStorageTierLimitBytes('pro'), STORAGE_TIER_LIMITS.pro);
  assert.equal(getStorageTierLimitBytes('business'), STORAGE_TIER_LIMITS.business);
  assert.equal(getStorageTierLimitBytes('enterprise'), STORAGE_TIER_LIMITS.enterprise);
  assert.equal(getStorageTierLimitBytes(undefined), STORAGE_TIER_LIMITS.free);

  assert.equal(getStorageTierLabel('free'), '0 GB');
  assert.equal(getStorageTierLabel('pro'), '100 GB');
  assert.equal(getStorageTierLabel('business'), '1 TB');
  assert.equal(getStorageTierLabel('enterprise'), 'Custom');
});

test('business plan defines correct base and extra seat boundaries', () => {
  assert.equal(BUSINESS_PLAN.baseSeats, 3);
  assert.equal(BUSINESS_PLAN.minSeats, 3);
  assert.equal(BUSINESS_PLAN.maxSeats, 50);
  assert.equal(BUSINESS_PLAN.extraSeatPriceMonthly, 6);
  assert.equal(BUSINESS_PLAN.extraSeatPriceYearly, 5);
});

test('getPriceAmount computes pro plan pricing for recurring and one-time durations', () => {
  assert.equal(getPriceAmount('pro', 'recurring', 'monthly'), 9.99);
  assert.equal(getPriceAmount('pro', 'recurring', 'yearly'), 7.99 * 12);
  assert.equal(getPriceAmount('pro', 'one_time', '1_month'), 9.99);
  assert.equal(getPriceAmount('pro', 'one_time', '6_months'), 49.99);
  assert.equal(getPriceAmount('pro', 'one_time', '12_months'), 89.99);
});

test('getPriceAmount computes business plan pricing with scalable seat counts', () => {
  assert.equal(getPriceAmount('business', 'recurring', 'monthly', 3), 29.00);
  assert.equal(getPriceAmount('business', 'recurring', 'monthly', 5), 29.00 + (2 * 6.00));
  assert.equal(getPriceAmount('business', 'recurring', 'monthly', 10), 29.00 + (7 * 6.00));

  assert.equal(getPriceAmount('business', 'recurring', 'yearly', 3), 288.00);
  assert.equal(getPriceAmount('business', 'recurring', 'yearly', 5), 288.00 + (2 * 5.00 * 12));

  assert.equal(getPriceAmount('business', 'one_time', '1_month', 3), 29.00);
  assert.equal(getPriceAmount('business', 'one_time', '1_month', 4), 35.00);
  assert.equal(getPriceAmount('business', 'one_time', '6_months', 3), 149.00);
  assert.equal(getPriceAmount('business', 'one_time', '6_months', 5), 149.00 + (2 * 30.00));
  assert.equal(getPriceAmount('business', 'one_time', '12_months', 3), 288.00);
  assert.equal(getPriceAmount('business', 'one_time', '12_months', 5), 288.00 + (2 * 60.00));
});

test('calculatePeriodEnd correctly advances calendar dates for recurring and one-time cycles', () => {
  const baseDate = new Date('2026-01-15T00:00:00.000Z');

  const monthlyEnd = calculatePeriodEnd(baseDate, 'recurring', 'monthly');
  assert.equal(monthlyEnd.getUTCMonth(), 1);
  assert.equal(monthlyEnd.getUTCDate(), 15);

  const yearlyEnd = calculatePeriodEnd(baseDate, 'recurring', 'yearly');
  assert.equal(yearlyEnd.getUTCFullYear(), 2027);
  assert.equal(yearlyEnd.getUTCMonth(), 0);

  const oneMonthEnd = calculatePeriodEnd(baseDate, 'one_time', '1_month');
  assert.equal(oneMonthEnd.getUTCMonth(), 1);

  const sixMonthEnd = calculatePeriodEnd(baseDate, 'one_time', '6_months');
  assert.equal(sixMonthEnd.getUTCMonth(), 6);

  const twelveMonthEnd = calculatePeriodEnd(baseDate, 'one_time', '12_months');
  assert.equal(twelveMonthEnd.getUTCFullYear(), 2027);
});
