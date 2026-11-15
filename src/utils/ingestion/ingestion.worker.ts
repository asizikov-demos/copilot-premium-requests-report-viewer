import { runFileIngestion } from './runFileIngestion';
import type { IngestionRequest } from './workerProtocol';

self.addEventListener('message', (event: MessageEvent<IngestionRequest>) => {
  runFileIngestion(event.data, response => self.postMessage(response));
});
