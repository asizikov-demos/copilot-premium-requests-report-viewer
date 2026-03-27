'use client';

import { useState } from 'react';
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-[#24292f] sticky top-0 z-50">
        <div className="px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <svg height="32" viewBox="0 0 16 16" width="32" fill="#fff" aria-hidden="true">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
              </svg>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                Premium Requests Viewer
              </h1>
            </div>
            {isDataLoaded && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-white bg-transparent hover:bg-white/[0.08] rounded-md transition-all duration-150 border border-[#57606a]"
              >
                New Report
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-8 pb-12">
        {error && (
          <div className="max-w-xl mb-6 animate-fade-in-up">
            <div className="flex items-start gap-3 p-4 bg-[#fef2f2] border border-[#fecdd3] rounded-md">
              <svg className="w-5 h-5 text-[#cf222e] flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-[#cf222e]">Error processing file</p>
                <p className="text-sm text-[#cf222e]/80 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!isDataLoaded ? (
          <CSVUploader onDataLoad={handleDataLoad} onError={handleError} />
        ) : ingestionResult ? (
          <DataAnalysis ingestionResult={ingestionResult} filename={filename} onReset={handleReset} />
        ) : null}
      </div>
    </main>
  );
}
