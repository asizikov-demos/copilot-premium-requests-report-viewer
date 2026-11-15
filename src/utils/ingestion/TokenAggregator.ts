import { TokenAccumulator } from './TokenAccumulator';
import type { Aggregator, AggregatorContext, NormalizedRow, TokenArtifacts } from './types';
import { MonthlyAggregator } from './MonthlyAggregator';
import { mergeTokenArtifacts } from './selectors';
import { TOKEN_FIELDS } from './tokenFields';

class TokenPartialAggregator implements Aggregator<TokenArtifacts> {
  readonly id = 'tokens';
  private accumulator = new TokenAccumulator();

  init(): void {
    this.accumulator = new TokenAccumulator();
  }

  onRow(row: NormalizedRow): void {
    this.accumulator.addRow(row);
  }

  finalize(): TokenArtifacts {
    return this.accumulator.finalize();
  }
}

export class TokenAggregator extends MonthlyAggregator<TokenArtifacts> {
  private totals: Partial<Record<typeof TOKEN_FIELDS[number], number>> = {};
  private failure?: Error;

  constructor() {
    super('tokens', () => new TokenPartialAggregator(), mergeTokenArtifacts);
  }

  override init(ctx?: AggregatorContext): void {
    super.init(ctx);
    this.totals = {};
    this.failure = undefined;
  }

  override onRow(row: NormalizedRow, ctx?: AggregatorContext): void {
    if (this.failure) return;
    for (const field of TOKEN_FIELDS) {
      const count = row[field];
      if (count === undefined || !Number.isSafeInteger(count) || count < 0) continue;
      const total = (this.totals[field] ?? 0) + count;
      if (!Number.isSafeInteger(total)) {
        this.failure = new Error(`Token total exceeds the safe integer range in ${field}`);
        throw this.failure;
      }
      this.totals[field] = total;
    }
    super.onRow(row, ctx);
  }

  override finalize(ctx?: AggregatorContext) {
    if (this.failure) throw this.failure;
    return super.finalize(ctx);
  }
}
