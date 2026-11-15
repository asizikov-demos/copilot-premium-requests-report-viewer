'use client';

import { Banner, Button, Spinner } from '@primer/react';

import type { IngestionProgress } from '@/utils/ingestion/types';

export function DetailStreamStatus({ error, progress, onBack }: {
  error?: string;
  progress?: IngestionProgress;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button onClick={onBack}>Back to overview</Button>
      {error ? <Banner variant="critical" title="Unable to load details" description={error} /> : (
        <div role="status" className="flex items-center gap-3 p-5 text-sm text-(--fgColor-muted)">
          <Spinner size="small" srText={null} />
          <span>
            Loading details from the uploaded report. Large files may take a moment.
            {progress && ` ${(progress.rowsScanned ?? progress.rowsProcessed).toLocaleString()} rows scanned.`}
          </span>
        </div>
      )}
    </div>
  );
}
