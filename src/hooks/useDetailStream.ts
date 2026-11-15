'use client';

import { useContext, useEffect, useState } from 'react';

import { AnalysisContext } from '@/context/AnalysisContext';
import type { DetailArtifacts } from '@/utils/ingestion/DetailAggregator';
import { streamFile, type RowFilter } from '@/utils/ingestion/streamFile';
import type { IngestionProgress, TokenArtifacts } from '@/utils/ingestion/types';

export interface DetailResult {
  details: DetailArtifacts;
  tokens: TokenArtifacts;
  warnings?: string[];
}

interface DetailState {
  data?: DetailResult;
  progress?: IngestionProgress;
  error?: string;
}

// File identity scopes cached aggregates to the upload; replacing it releases the cache.
const cache = new WeakMap<File, Map<string, DetailResult>>();

export function useDetailStream(filter: Omit<RowFilter, 'months'>) {
  const context = useContext(AnalysisContext);
  const file = context?.sourceFile;
  const monthKey = JSON.stringify([...(context?.selectedMonths ?? [])].sort());
  const filterKey = JSON.stringify([filter.user, filter.organization, filter.costCenter, monthKey]);
  const [state, setState] = useState<DetailState & { key?: string; file?: File }>({});
  const user = filter.user;
  const organization = filter.organization;
  const costCenter = filter.costCenter;

  useEffect(() => {
    if (!file) return;
    const cached = cache.get(file)?.get(filterKey);
    if (cached) return;
    const controller = new AbortController();
    const update = (next: DetailState) => setState({ ...next, key: filterKey, file });
    streamFile(file, ['details', 'tokens'], {
      user, organization, costCenter, months: JSON.parse(monthKey) as string[],
    }, {
      signal: controller.signal,
      onProgress: progress => {
        if (!controller.signal.aborted) update({ progress });
      },
    }).then(result => {
      if (controller.signal.aborted) return;
      const details = result.outputs.details as DetailArtifacts | null | undefined;
      const tokens = result.outputs.tokens as TokenArtifacts | null | undefined;
      if (!details || !tokens || result.warnings.some(warning => warning.startsWith('Aggregator '))) {
        throw new Error(result.warnings.join('; ') || 'Missing detail aggregation output');
      }
      const data = { details, tokens, warnings: result.warnings };
      let entries = cache.get(file);
      if (!entries) {
        entries = new Map();
        cache.set(file, entries);
      }
      entries.set(filterKey, data);
      update({ data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) update({
        error: error instanceof Error ? error.message : 'Failed to load report details',
      });
    });
    return () => controller.abort();
  }, [file, filterKey, user, organization, costCenter, monthKey]);

  const current = file ? cache.get(file)?.get(filterKey) : undefined;
  const scopedState = state.key === filterKey && state.file === file ? state : {};
  return {
    ...scopedState,
    data: current ?? scopedState.data,
    error: file ? scopedState.error : 'The uploaded file is unavailable. Upload the report again to view details.',
    months: context?.selectedMonths.length ? context.selectedMonths : context?.availableMonths.map(month => month.value) ?? [],
  };
}
