import { ModelDailyAggregator } from '@/utils/ingestion/ModelDailyAggregator';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { makeNormalizedRow } from './makeNormalizedRow';

export function makeModelDailyArtifacts(rows: readonly Partial<NormalizedRow>[] = []) {
  const aggregator = new ModelDailyAggregator();
  aggregator.init();
  for (const row of rows) aggregator.onRow(makeNormalizedRow(row));
  return aggregator.finalize();
}
