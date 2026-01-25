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
      <header className="border-b border-black bg-black backdrop-blur-sm sticky top-0 z-50">
        <div className="px-6 lg:px-10">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Premium Requests Viewer
            </h1>
            {isDataLoaded && (
              <button
                onClick={handleReset}
                className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                New Report
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 lg:px-10 py-6 lg:py-8">
        {error && (
          <div className="max-w-xl mb-6">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Error processing file</p>
                <p className="text-sm text-red-600 mt-0.5">{error}</p>
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
