/**
 * FeatureUsageAggregator
 * ---------------------------------
 * Streams rows and accumulates usage for specialized Copilot features:
 *  - Code Review (model name contains 'code review')
 *  - Coding Agent (model name contains 'coding agent')
 *  - Spark (product/sku fields via isSparkProduct)
 *  - Code Quality (product/sku fields via isCodeQualityProduct)
 *
 * Output artifacts provide O(1) access to:
 *  - featureTotals: total request quantities per feature
 *  - featureUsers: distinct user sets per feature
 *
 * This replaces on-render O(R) scans with incremental O(1) updates during ingestion.
 */
import { Aggregator, AggregatorContext, NormalizedRow, FeatureUsageArtifacts } from './types';
import { isCodeQualityProduct, isCodeReviewModel, isCodingAgentModel, isSparkProduct } from '@/utils/productClassification';

export class FeatureUsageAggregator implements Aggregator<FeatureUsageArtifacts> {
  readonly id = 'featureUsage';

  private codeReviewTotal = 0;
  private codingAgentTotal = 0;
  private sparkTotal = 0;
  private codeQualityTotal = 0;
  private nonCopilotCodeReviewTotal = 0;

  private codeReviewUsers = new Set<string>();
  private codingAgentUsers = new Set<string>();
  private sparkUsers = new Set<string>();
  private codeQualityUsers = new Set<string>();

  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.codeReviewTotal = 0;
    this.codingAgentTotal = 0;
    this.sparkTotal = 0;
    this.codeQualityTotal = 0;
    this.nonCopilotCodeReviewTotal = 0;
    this.codeReviewUsers.clear();
    this.codingAgentUsers.clear();
    this.sparkUsers.clear();
    this.codeQualityUsers.clear();
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    const qty = row.quantity;

    if (isCodeReviewModel(row.model)) {
      this.codeReviewTotal += qty;
      if (row.isNonCopilotUsage) {
        this.nonCopilotCodeReviewTotal += qty;
      } else {
        this.codeReviewUsers.add(row.user);
      }
    }

    if (isCodingAgentModel(row.model)) {
      this.codingAgentTotal += qty;
      if (!row.isNonCopilotUsage) {
        this.codingAgentUsers.add(row.user);
      }
    }

    if (isSparkProduct(row.product, row.sku)) {
      this.sparkTotal += qty;
      if (!row.isNonCopilotUsage) {
        this.sparkUsers.add(row.user);
      }
    }

    if (isCodeQualityProduct(row.product, row.sku)) {
      this.codeQualityTotal += row.billingQuantity ?? qty;
      if (!row.isNonCopilotUsage && row.user) {
        this.codeQualityUsers.add(row.user);
      }
    }
  }

  finalize(_ctx: AggregatorContext): FeatureUsageArtifacts {
    void _ctx;
    return {
      featureTotals: {
        codeReview: this.codeReviewTotal,
        codingAgent: this.codingAgentTotal,
        spark: this.sparkTotal,
        codeQuality: this.codeQualityTotal
      },
      featureUsers: {
        codeReview: this.codeReviewUsers,
        codingAgent: this.codingAgentUsers,
        spark: this.sparkUsers,
        codeQuality: this.codeQualityUsers
      },
      specialTotals: {
        nonCopilotCodeReview: this.nonCopilotCodeReviewTotal
      }
    };
  }
}
