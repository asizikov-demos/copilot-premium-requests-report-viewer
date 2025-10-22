'use client';

import { useRef, useState } from 'react';
import { 
  ingestStream, 
  QuotaAggregator, 
  UsageAggregator, 
  DailyBucketsAggregator,
  RawDataAggregator,
  IngestionResult 
} from '@/utils/ingestion';

interface CSVUploaderProps {
  onDataLoad: (result: IngestionResult, filename: string) => void;
  onError: (error: string) => void;
}

export function CSVUploader({ onDataLoad, onError }: CSVUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalRows = useRef(0);

  const handleFileSelect = (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      onError('Please select a CSV file');
      return;
    }

    // Reset state
    setIsLoading(true);
    setProgress(0);
    totalRows.current = 0;

    // Create all aggregators including raw data collector for adapter
    const quotaAggregator = new QuotaAggregator();
    const usageAggregator = new UsageAggregator();
    const dailyBucketsAggregator = new DailyBucketsAggregator();
    const rawDataAggregator = new RawDataAggregator();

    // Single-pass streaming ingestion with all aggregators
    ingestStream(
      file,
      [quotaAggregator, usageAggregator, dailyBucketsAggregator, rawDataAggregator],
      {
        chunkSize: 1024 * 1024, // 1MB chunks for smooth UI
        progressResolution: 1000,
        onProgress: (progressInfo) => {
          totalRows.current = progressInfo.rowsProcessed;
          // Estimate progress percentage
          setProgress(prev => Math.min(prev + 5, 90));
        },
        onComplete: (result) => {
          setProgress(100);
          
          // Check if CSV is empty
          if (result.rowsProcessed === 0) {
            onError('CSV file is empty');
            setIsLoading(false);
            setProgress(0);
            return;
          }
          
          // Small delay to show 100% before transitioning
          setTimeout(() => {
            onDataLoad(result, file.name);
            setIsLoading(false);
            setProgress(0);
          }, 200);
        },
        onError: (errorMsg) => {
          onError(errorMsg);
          setIsLoading(false);
          setProgress(0);
        }
      }
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isLoading}
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            {isLoading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            ) : (
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isLoading ? 'Processing CSV file...' : 'Upload CSV File'}
            </h3>
            
            {isLoading && progress > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Processing...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                {totalRows.current > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {totalRows.current.toLocaleString()} rows processed
                  </p>
                )}
              </div>
            )}
            
            <p className="text-gray-500 mb-4">
              {isLoading ? 'Please wait while we process your file...' : 'Drag and drop your CSV file here, or click to browse'}
            </p>
            <button
              onClick={handleButtonClick}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Choose File'}
            </button>
          </div>
          
          <div className="text-xs text-gray-400">
            Required columns: date, username, model, quantity
            <br />
            Optional: exceeds_quota, total_monthly_quota, cost columns, organization, cost_center_name
          </div>
          <div className="text-xs text-blue-500 mt-1">
            <a
              href="https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-premium-requests#downloading-a-copilot-premium-request-usage-report"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-700"
            >
              How to obtain this report file
            </a>
          </div>
          <div className="text-xs text-blue-500 mt-1">
            <button
              onClick={() => setShowPrivacyDialog(true)}
              className="underline hover:text-blue-700 bg-transparent border-none p-0 cursor-pointer"
            >
              Privacy Information
            </button>
          </div>
        </div>
      </div>
      
      {/* Privacy Dialog */}
      {showPrivacyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowPrivacyDialog(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="pr-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Information</h3>
              
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong>Your data is completely secure:</strong> This is a front-end only application. 
                  No data leaves your browser and nothing is sent to any external servers.
                </p>
                
                <p>
                  All CSV processing and analysis happens locally in your browser, ensuring your 
                  usage data remains private and secure.
                </p>
                
                <p>
                  <strong>Open Source:</strong> This application is open source and available for review at:
                </p>
                
                <div className="bg-gray-50 p-3 rounded border">
                  <a
                    href="https://github.com/asizikov-demos/copilot-premium-requests-report-viewer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    github.com/asizikov-demos/copilot-premium-requests-report-viewer
                  </a>
                </div>
                
                <p>
                  You can review the source code, copy it, or modify it according to your needs.
                </p>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowPrivacyDialog(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
