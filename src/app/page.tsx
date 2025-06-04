'use client';

import { useState } from 'react';
import { CSVUploader } from '@/components/CSVUploader';
import { DataAnalysis } from '@/components/DataAnalysis';
import { CSVData } from '@/types/csv';

export default function Home() {
  const [csvData, setCsvData] = useState<CSVData[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDataLoad = (data: CSVData[], filename: string) => {
    setCsvData(data);
    setFilename(filename);
    setIsDataLoaded(true);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsDataLoaded(false);
  };

  const handleReset = () => {
    setCsvData([]);
    setFilename('');
    setIsDataLoaded(false);
    setError('');
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            GitHub Copilot Premium Requests Viewer
          </h1>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isDataLoaded ? (
          <CSVUploader onDataLoad={handleDataLoad} onError={handleError} />
        ) : (
          <DataAnalysis csvData={csvData} filename={filename} onReset={handleReset} />
        )}
      </div>
    </main>
  );
}
