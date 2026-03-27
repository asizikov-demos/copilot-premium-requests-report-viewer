/**
 * FeatureUsageAggregator
 * ---------------------------------
 * Streams rows and accumulates usage for specialized Copilot features:
 *  - Code Review (model name contains 'code review')
 *  - Coding Agent (model name contains 'coding agent' or 'padawan')
 *  - Spark (model name contains 'spark')
 *
 * Output artifacts provide O(1) access to:
 *  - featureTotals: total request quantities per feature
 *  - featureUsers: distinct user sets per feature
 *
 * This replaces on-render O(R) scans (e.g. calculateFeatureUtilization)
 * with incremental O(1) updates during ingestion.
 */
import { Aggregator, AggregatorContext, NormalizedRow, FeatureUsageArtifacts } from './types';
import { isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';

export class FeatureUsageAggregator implements Aggregator<FeatureUsageArtifacts> {
  readonly id = 'featureUsage';

  private codeReviewTotal = 0;
  private codingAgentTotal = 0;
  private sparkTotal = 0;

  private codeReviewUsers = new Set<string>();
  private codingAgentUsers = new Set<string>();
  private sparkUsers = new Set<string>();

  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.codeReviewTotal = 0;
    this.codingAgentTotal = 0;
    this.sparkTotal = 0;
    this.codeReviewUsers.clear();
    this.codingAgentUsers.clear();
    this.sparkUsers.clear();
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    const qty = row.quantity;

    if (isCodeReviewModel(row.model)) {
      this.codeReviewTotal += qty;
      this.codeReviewUsers.add(row.user);
    }

    if (isCodingAgentModel(row.model)) {
      this.codingAgentTotal += qty;
      this.codingAgentUsers.add(row.user);
    }

    const lower = row.model.toLowerCase();
    if (lower.includes('spark')) {
      this.sparkTotal += qty;
      this.sparkUsers.add(row.user);
    }
  }

  finalize(_ctx: AggregatorContext): FeatureUsageArtifacts {
    void _ctx;
    return {
      featureTotals: {
        codeReview: this.codeReviewTotal,
        codingAgent: this.codingAgentTotal,
        spark: this.sparkTotal
      },
      featureUsers: {
        codeReview: this.codeReviewUsers,
        codingAgent: this.codingAgentUsers,
        spark: this.sparkUsers
      }
    };
  }
}
