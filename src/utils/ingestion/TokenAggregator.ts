import { TokenAccumulator } from './TokenAccumulator';
import type { Aggregator, NormalizedRow, TokenArtifacts } from './types';

export class TokenAggregator implements Aggregator<TokenArtifacts> {
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
