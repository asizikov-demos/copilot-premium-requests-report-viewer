/** @jest-environment node */

import { serialize } from 'node:v8';

import { DetailPagesAggregator, selectUserDetails } from '@/utils/ingestion/DetailPagesAggregator';
import { PRICING } from '@/constants/pricing';

import { makeUsageRow } from '../helpers/makeNormalizedRow';

it('bounds detail storage by occupied user/day/model buckets, not input row count', () => {
  const users = 1000;
  const days = 31;
  const models = 4;
  const accumulator = new DetailPagesAggregator();
  // Reusing and mutating one row also detects accidental retention of source rows.
  const row = makeUsageRow({
    quantity: 1, billingQuantity: 1,
    grossAmount: PRICING.AI_CREDIT_USD_VALUE, discountAmount: PRICING.AI_CREDIT_USD_VALUE, netAmount: 0,
    inputTokens: 10, outputTokens: 5, cacheReadTokens: 20, cacheWriteTokens: 0,
    organization: 'test-org-one', costCenter: 'test-cost-center-one',
  });
  const feed = () => {
    for (let user = 0; user < users; user++) {
      row.user = `test-user-${user}`;
      for (let day = 1; day <= days; day++) {
        row.day = row.date = `2026-07-${String(day).padStart(2, '0')}`;
        for (let model = 0; model < models; model++) {
          row.model = `test-model-${model}`;
          accumulator.onRow(row);
        }
      }
    }
  };
  global.gc?.();
  const before = process.memoryUsage();
  const started = performance.now();
  feed();
  const artifacts = accumulator.finalize();
  const firstSize = serialize(artifacts).byteLength;
  for (let repeat = 0; repeat < 4; repeat++) feed();
  const repeated = accumulator.finalize();
  const finalSize = serialize(repeated).byteLength;
  global.gc?.();
  const after = process.memoryUsage();

  expect(repeated.users.size).toBe(users);
  const user = selectUserDetails(repeated, 'test-user-0');
  expect(user.details.dailyModels).toHaveLength(days * models);
  expect(user.details.totals.quantity).toBe(days * models * 5);
  expect(user.tokens.totals.inputTokens).toBe(days * models * 5 * 10);
  expect(user.tokens.byDay.size).toBe(days);
  expect(finalSize).toBeLessThan(64 * 1024 * 1024);
  expect(finalSize).toBeLessThanOrEqual(firstSize * 1.01);
  expect(repeated.organizations.get('test-org-one')?.totals.quantity).toBe(users * days * models * 5);

  console.info('Detail scale:', {
    users, days, models, rows: users * days * models * 5,
    serializedMiB: finalSize / 1024 / 1024,
    heapAndArrayBuffersDeltaMiB: (after.heapUsed + after.arrayBuffers - before.heapUsed - before.arrayBuffers) / 1024 / 1024,
    heapDeltaMiB: (after.heapUsed - before.heapUsed) / 1024 / 1024,
    arrayBuffersDeltaMiB: (after.arrayBuffers - before.arrayBuffers) / 1024 / 1024,
    elapsedMs: performance.now() - started,
  });
}, 30000);
