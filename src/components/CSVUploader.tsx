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
      <div className="text-center mb-12 animate-fade-in-up">
        <h2 className="display-heading text-4xl sm:text-5xl text-stone-900 mb-4">
          Analyze your usage data
        </h2>
        <p className="text-lg text-stone-500 max-w-md mx-auto leading-relaxed">
          Upload your GitHub Copilot premium requests report to visualize usage patterns and optimize costs.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          opacity-0 animate-scale-in
          ${isDragOver 
            ? 'border-orange-400 bg-orange-50/50 shadow-lg shadow-orange-100' 
            : 'border-stone-200 hover:border-stone-300 hover:shadow-md bg-white'
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
        
        <div className="px-6 py-14 sm:py-20">
          <div className="flex flex-col items-center gap-5">
            {/* Icon */}
            <div className={`
              w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isDragOver 
                ? 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-200' 
                : 'bg-gradient-to-br from-stone-100 to-stone-200'
              }
            `}>
              {isLoading ? (
                <div className="w-7 h-7 border-2 border-stone-300 border-t-orange-600 rounded-full animate-spin" />
              ) : (
                <svg
                  className={`w-7 h-7 transition-colors ${isDragOver ? 'text-white' : 'text-stone-500'}`}
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
                <div className="space-y-4">
                  <p className="text-base font-semibold text-stone-900">Processing file...</p>
                  <div className="w-56 mx-auto">
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  {totalRows.current > 0 && (
                    <p className="text-sm text-stone-500">
                      {totalRows.current.toLocaleString()} rows processed
                    </p>
                  )}
                </div>
              ) : isSampleLoading ? (
                <p className="text-base font-semibold text-stone-900">Loading sample data...</p>
              ) : (
                <>
                  <p className="text-base font-semibold text-stone-900 mb-1">
                    Drop your CSV file here
                  </p>
                  <p className="text-sm text-stone-500">
                    or click to browse
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sample data button */}
      <div className="mt-5 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <button
          onClick={(e) => { e.stopPropagation(); loadSampleData(); }}
          disabled={isBusy}
          className="px-5 py-2.5 text-sm font-semibold text-orange-600 hover:text-white hover:bg-orange-600 border border-orange-200 hover:border-orange-600 rounded-full transition-all duration-200 disabled:opacity-50"
        >
          Try with sample data
        </button>
      </div>

      {/* Help text */}
      <div className="mt-10 space-y-3 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <p className="text-xs text-stone-400 font-medium tracking-wide">
          Required: date, username, model, quantity
        </p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <a
            href="https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-premium-requests#downloading-a-copilot-premium-request-usage-report"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 hover:text-orange-600 transition-colors font-medium"
          >
            How to get this report →
          </a>
          <span className="text-stone-300">•</span>
          <button
            onClick={() => setShowPrivacyDialog(true)}
            className="text-stone-500 hover:text-orange-600 transition-colors font-medium"
          >
            Privacy info
          </button>
        </div>
      </div>
      
      {/* Privacy Dialog */}
      {showPrivacyDialog && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-7 shadow-2xl border border-stone-100 animate-scale-in">
            <div className="flex items-start justify-between mb-5">
              <h3 className="text-xl font-bold text-stone-900">Privacy Information</h3>
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors p-1 hover:bg-stone-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <p>
                <span className="font-semibold text-stone-900">Your data stays local.</span>{' '}
                This is a front-end only application. No data leaves your browser.
              </p>
              
              <p>
                All CSV processing happens locally, ensuring your usage data remains private.
              </p>
              
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs text-stone-500 mb-1 font-medium">Open source</p>
                <a
                  href="https://github.com/asizikov-demos/copilot-premium-requests-report-viewer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium break-all"
                >
                  github.com/asizikov-demos/copilot-premium-requests-report-viewer
                </a>
              </div>
            </div>
            
            <div className="mt-7">
              <button
                onClick={() => setShowPrivacyDialog(false)}
                className="w-full px-4 py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors shadow-lg hover:shadow-xl"
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
