import { PRICING } from '@/constants/pricing';
import { ModelDailyAggregator } from '@/utils/ingestion/ModelDailyAggregator';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { makeNormalizedRow } from './makeNormalizedRow';

export function makeModelDailyArtifacts(rows: readonly Partial<NormalizedRow>[] = []) {
  const aggregator = new ModelDailyAggregator();
  const ctx = { pricing: PRICING };
  aggregator.init(ctx);
  for (const row of rows) aggregator.onRow(makeNormalizedRow(row), ctx);
  return aggregator.finalize(ctx);
}
