import { QuotaArtifacts, UsageArtifacts } from './types';

/**
 * Enriches UserAggregate[] with quota values from QuotaArtifacts.
 * This combines outputs from UsageAggregator + QuotaAggregator.
 */
export function enrichUserAggregates(
  usageArtifacts: UsageArtifacts,
  quotaArtifacts: QuotaArtifacts
) {
  return usageArtifacts.users.map(user => ({
    ...user,
    quotaValue: quotaArtifacts.quotaByUser.get(user.user) ?? 'unknown'
  }));
}
