'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { CSVData, NewCSVData } from '@/types/csv';

interface CSVUploaderProps {
  onDataLoad: (data: CSVData[], filename: string) => void;
  onError: (error: string) => void;
}

export function CSVUploader({ onDataLoad, onError }: CSVUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accumulatedData = useRef<(CSVData | NewCSVData)[]>([]);
  const isFormatValidated = useRef(false);
  const totalRows = useRef(0);

  const validateFormat = (firstRow: CSVData | NewCSVData): boolean => {
    const isLegacy = 'Timestamp' in firstRow;
    const isNew = 'date' in firstRow && 'username' in firstRow && 'model' in firstRow && 'quantity' in firstRow;

    if (!isLegacy && !isNew) {
      onError('Unrecognized CSV format. Expected legacy headers (Timestamp, User, ...) or new headers (date, username, model, quantity).');
      return false;
    }

    if (isLegacy) {
      const requiredLegacy = ['Timestamp', 'User', 'Model', 'Requests Used', 'Exceeds Monthly Quota', 'Total Monthly Quota'];
      const missingLegacy = requiredLegacy.filter(col => !(col in firstRow));
      if (missingLegacy.length > 0) {
        onError(`Missing required legacy columns: ${missingLegacy.join(', ')}`);
        return false;
      }
    } else if (isNew) {
      const requiredNew = ['date', 'username', 'model', 'quantity'];
      const missingNew = requiredNew.filter(col => !(col in firstRow));
      if (missingNew.length > 0) {
        onError(`Missing required new format columns: ${missingNew.join(', ')}`);
        return false;
      }
    }

    return true;
  };

  const handleFileSelect = (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      onError('Please select a CSV file');
      return;
    }

    // Reset state
    setIsLoading(true);
    setProgress(0);
    accumulatedData.current = [];
    isFormatValidated.current = false;
    totalRows.current = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      chunkSize: 1024 * 1024, // 1MB chunks for smooth UI
      chunk: (results, parser) => {
        // Handle errors in chunk
        if (results.errors.length > 0) {
          parser.abort();
          onError(`CSV parsing error: ${results.errors[0].message}`);
          setIsLoading(false);
          return;
        }

        const chunkData = results.data as (CSVData | NewCSVData)[];
        
        // Validate format on first chunk
        if (!isFormatValidated.current && chunkData.length > 0) {
          if (!validateFormat(chunkData[0])) {
            parser.abort();
            setIsLoading(false);
            return;
          }
          isFormatValidated.current = true;
        }

        // Accumulate data
        accumulatedData.current.push(...chunkData);
        totalRows.current += chunkData.length;

        // Update progress (estimate based on bytes read)
        // PapaParse doesn't provide exact progress, so we estimate based on chunk count
        setProgress(prev => Math.min(prev + 10, 90));
      },
      complete: () => {
        if (accumulatedData.current.length === 0) {
          onError('CSV file is empty');
          setIsLoading(false);
          return;
        }

        // Final processing
        setProgress(100);
        
        // Small delay to show 100% before transitioning
        setTimeout(() => {
          onDataLoad(accumulatedData.current as CSVData[], file.name);
          setIsLoading(false);
          setProgress(0);
        }, 200);
      },
      error: (error) => {
        onError(`File reading error: ${error.message}`);
        setIsLoading(false);
        setProgress(0);
      }
    });
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
            Supported formats:
            <br />
            <span className="font-medium">Legacy:</span> Timestamp, User, Model, Requests Used, Exceeds Monthly Quota, Total Monthly Quota
            <br />
            <span className="font-medium">New:</span> date, username, model, quantity, (optional cost & quota columns)
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
