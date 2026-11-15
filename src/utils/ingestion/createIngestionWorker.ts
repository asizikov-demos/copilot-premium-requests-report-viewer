export function createIngestionWorker(): Worker {
  return new Worker(new URL('./ingestion.worker.ts', import.meta.url), { type: 'module' });
}
