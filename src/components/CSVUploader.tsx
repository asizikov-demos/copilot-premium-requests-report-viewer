'use client';

import { useRef, useState } from 'react';
import {
  ingestStream,
  QuotaAggregator,
  UsageAggregator,
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  BillingAggregator,
  RawDataAggregator,
  IngestionResult
} from '@/utils/ingestion';
import { getBasePath } from '@/constants/deployment';

const SAMPLE_DATA_FILENAME = 'pru-example.csv';

/**
 * Normalize a base path value to ensure it's safe for URL construction.
 * - Treats "" and "/" as empty (no base path)
 * - Rejects full URLs (http://, https://)
 * - Ensures leading slash and no trailing slash for non-empty paths
 */
function normalizeBasePath(rawBasePath: string): string {
  const trimmed = rawBasePath.trim();
  
  // Empty or root means no base path
  if (trimmed === '' || trimmed === '/') {
    return '';
  }

  // Reject full URLs - base path should be path-only
  if (/^https?:\/\//i.test(trimmed)) {
    console.warn(
      '[CSVUploader] Ignoring invalid base path that looks like a full URL:',
      trimmed
    );
    return '';
  }

  // Ensure leading slash
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  
  // Remove trailing slash
  return withLeadingSlash.endsWith('/') 
    ? withLeadingSlash.slice(0, -1) 
    : withLeadingSlash;
}

/**
 * Build a full URL for a public asset, accounting for deployment base path.
 * Uses the same base path as Next.js routing to ensure consistency.
 */
function buildPublicAssetUrl(assetPath: string): string {
  const basePath = normalizeBasePath(getBasePath());
  const normalizedAssetPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  
  // Only prepend base path if it's non-empty to avoid "//" protocol-relative URLs
  const pathOnlyUrl = basePath ? `${basePath}${normalizedAssetPath}` : normalizedAssetPath;

  // This module is a Client Component, but guard anyway to avoid referencing `window`
  // in any non-browser evaluation contexts.
  if (typeof window === 'undefined') {
    return pathOnlyUrl;
  }

  // Use an absolute URL so fetch is unambiguous across deployments.
  return new URL(pathOnlyUrl, window.location.origin).toString();
}

interface CSVUploaderProps {
  onDataLoad: (result: IngestionResult, filename: string) => void;
  onError: (error: string) => void;
}

export function CSVUploader({ onDataLoad, onError }: CSVUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalRows = useRef(0);

  const isBusy = isLoading || isSampleLoading;

  const startIngestion = (file: File) => {
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
    const featureUsageAggregator = new FeatureUsageAggregator();
    const billingAggregator = new BillingAggregator();
    const rawDataAggregator = new RawDataAggregator();

    // Single-pass streaming ingestion with all aggregators
    ingestStream(
      file,
      [quotaAggregator, usageAggregator, dailyBucketsAggregator, featureUsageAggregator, billingAggregator, rawDataAggregator],
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

  const loadSampleData = async () => {
    if (isBusy) return;

    setIsSampleLoading(true);
    try {
      const sampleUrl = buildPublicAssetUrl(`/data/${SAMPLE_DATA_FILENAME}`);
      const response = await fetch(sampleUrl);
      if (!response.ok) {
        throw new Error(`Failed to load sample data (${response.status})`);
      }

      const blob = await response.blob();
      const sampleFile = new File([blob], SAMPLE_DATA_FILENAME, { type: 'text/csv' });
      startIngestion(sampleFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sample data';
      onError(message);
      setProgress(0);
    } finally {
      setIsSampleLoading(false);
    }
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
      startIngestion(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      startIngestion(files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Hero section */}
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 mb-3">
          Analyze your usage data
        </h2>
        <p className="text-lg text-zinc-500 max-w-md mx-auto">
          Upload your GitHub Copilot premium requests report to visualize usage patterns and optimize costs.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50/50' 
            : 'border-zinc-200 hover:border-zinc-300 bg-white'
          }
          ${isBusy ? 'opacity-60 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isBusy}
        />
        
        <div className="px-6 py-12 sm:py-16">
          <div className="flex flex-col items-center gap-4">
            {/* Icon */}
            <div className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-colors
              ${isDragOver ? 'bg-blue-100' : 'bg-zinc-100'}
            `}>
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <svg
                  className={`w-6 h-6 ${isDragOver ? 'text-blue-600' : 'text-zinc-400'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25"
                  />
                </svg>
              )}
            </div>

            {/* Text */}
            <div className="text-center">
              {isLoading ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-900">Processing file...</p>
                  <div className="w-48 mx-auto">
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  {totalRows.current > 0 && (
                    <p className="text-xs text-zinc-500">
                      {totalRows.current.toLocaleString()} rows processed
                    </p>
                  )}
                </div>
              ) : isSampleLoading ? (
                <p className="text-sm font-medium text-zinc-900">Loading sample data...</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-900 mb-1">
                    Drop your CSV file here
                  </p>
                  <p className="text-sm text-zinc-500">
                    or click to browse
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sample data button */}
      <div className="mt-4 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); loadSampleData(); }}
          disabled={isBusy}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
        >
          Try with sample data
        </button>
      </div>

      {/* Help text */}
      <div className="mt-8 space-y-2 text-center">
        <p className="text-xs text-zinc-400">
          Required: date, username, model, quantity
        </p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <a
            href="https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-premium-requests#downloading-a-copilot-premium-request-usage-report"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-700 underline underline-offset-2 transition-colors"
          >
            How to get this report
          </a>
          <span className="text-zinc-300">•</span>
          <button
            onClick={() => setShowPrivacyDialog(true)}
            className="text-zinc-500 hover:text-zinc-700 underline underline-offset-2 transition-colors"
          >
            Privacy info
          </button>
        </div>
      </div>
      
      {/* Privacy Dialog */}
      {showPrivacyDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900">Privacy Information</h3>
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-zinc-600">
              <p>
                <span className="font-medium text-zinc-900">Your data stays local.</span>{' '}
                This is a front-end only application. No data leaves your browser.
              </p>
              
              <p>
                All CSV processing happens locally, ensuring your usage data remains private.
              </p>
              
              <div className="p-3 bg-zinc-50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">Open source</p>
                <a
                  href="https://github.com/asizikov-demos/copilot-premium-requests-report-viewer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 break-all"
                >
                  github.com/asizikov-demos/copilot-premium-requests-report-viewer
                </a>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="w-full px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
