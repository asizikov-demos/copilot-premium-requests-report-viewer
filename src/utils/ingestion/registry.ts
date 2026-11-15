import { BillingAggregator } from './BillingAggregator';
import { DailyBucketsAggregator } from './DailyBucketsAggregator';
import { FeatureUsageAggregator } from './FeatureUsageAggregator';
import { QuotaAggregator } from './QuotaAggregator';
import { RawDataAggregator } from './RawDataAggregator';
import { TokenAggregator } from './TokenAggregator';
import { UsageAggregator } from './UsageAggregator';
import type { Aggregator } from './types';

const aggregatorRegistry = {
  quota: () => new QuotaAggregator(),
  usage: () => new UsageAggregator(),
  dailyBuckets: () => new DailyBucketsAggregator(),
  featureUsage: () => new FeatureUsageAggregator(),
  billing: () => new BillingAggregator(),
  tokens: () => new TokenAggregator(),
  rawData: () => new RawDataAggregator(),
};

export type AggregatorId = keyof typeof aggregatorRegistry;

export function createAggregators(ids: readonly AggregatorId[]): Aggregator[] {
  return [...new Set(ids)].map(id => {
    if (!Object.hasOwn(aggregatorRegistry, id)) {
      throw new Error(`Unknown ingestion aggregator: ${id}`);
    }
    return aggregatorRegistry[id]();
  });
}
