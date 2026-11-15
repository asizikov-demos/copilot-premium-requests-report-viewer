'use client';

import { useState } from 'react';
import { MarkGithubIcon } from '@primer/octicons-react';
import { Button, Link } from '@primer/react';

import { CSVUploader } from '@/components/CSVUploader';
import { DataAnalysis } from '@/components/DataAnalysis';
import { IngestionResult } from '@/utils/ingestion';

export default function Home() {
  const [ingestionResult, setIngestionResult] = useState<IngestionResult | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDataLoad = (result: IngestionResult, filename: string) => {
    setIngestionResult(result);
    setFilename(filename);
    setIsDataLoaded(true);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsDataLoaded(false);
  };

  const handleReset = () => {
    setIngestionResult(null);
    setFilename('');
    setIsDataLoaded(false);
    setError('');
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-(--header-bgColor) sticky top-0 z-50">
        <div className="px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <MarkGithubIcon size={24} className="fill-(--header-fgColor-logo)" />
              <h1 className="text-lg font-semibold tracking-tight text-(--header-fgColor-logo)">
                Copilot Billing Report Viewer
              </h1>
            </div>
            {isDataLoaded && (
              <Button onClick={handleReset}>New Report</Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className={isDataLoaded ? 'flex-1 px-6 py-8 pb-12' : 'flex-1 px-4 sm:px-6'}>
        {!isDataLoaded ? (
          <CSVUploader onDataLoad={handleDataLoad} onError={handleError} error={error} />
        ) : ingestionResult ? (
          <DataAnalysis ingestionResult={ingestionResult} filename={filename} onReset={handleReset} />
        ) : null}
      </div>

      <footer className="space-y-3 pb-8 text-center">
        {!isDataLoaded && (
          <p className="text-xs text-(--fgColor-muted)">
            This app processes your CSV locally in your browser and doesn&apos;t upload it. Questions?{' '}
            <Link
              href="https://github.com/asizikov-demos/copilot-premium-requests-report-viewer/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create an issue
            </Link>
          </p>
        )}
        <p className="text-xs text-(--fgColor-muted)">
          &copy;{' '}
          <Link
            href="https://github.com/asizikov"
            target="_blank"
            rel="noopener noreferrer"
          >
            Anton Sizikov
          </Link>
          {' '}&mdash; Solutions Engineer @ GitHub
        </p>
      </footer>
    </main>
  );
}
