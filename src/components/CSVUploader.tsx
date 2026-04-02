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
    <div className="w-full max-w-2xl mx-auto">
      <div className="card-elevated px-8 py-10 animate-fade-in-up">
        {/* Hero section */}
        <div className="text-center mb-10">
          <h2 className="display-heading text-4xl text-[#1f2328] mb-4">
            Analyze your usage data
          </h2>
          <p className="text-lg text-[#636c76] max-w-md mx-auto leading-relaxed">
            Upload your GitHub Copilot premium requests report to visualize usage patterns and optimize costs.
          </p>
        </div>

        {/* Upload area */}
        <div
          className={`
            relative rounded-md border-2 border-dashed transition-all duration-150 cursor-pointer
            opacity-0 animate-scale-in
            ${isDragOver
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-[#d1d9e0] bg-white hover:border-[#d1d9e0] hover:shadow-sm'
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

          <div className="px-6 py-14 sm:py-16">
            <div className="flex flex-col items-center gap-5">
              {/* Icon */}
              <div className={`
                w-16 h-16 rounded-md flex items-center justify-center transition-all duration-150
                ${isDragOver
                  ? 'bg-indigo-500 shadow-sm'
                  : 'bg-[#f6f8fa]'
                }
              `}>
                {isLoading ? (
                  <div className="w-7 h-7 border-2 border-[#d1d9e0] border-t-indigo-500 rounded-full animate-spin" />
                ) : (
                  <svg
                    className={`w-7 h-7 transition-colors ${isDragOver ? 'text-white' : 'text-[#636c76]'}`}
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
                    <p className="text-base font-semibold text-[#1f2328]">Processing file...</p>
                    <div className="w-56 mx-auto">
                      <div className="h-2 bg-[#f6f8fa] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    {totalRows.current > 0 && (
                      <p className="text-sm text-[#636c76]">
                        {totalRows.current.toLocaleString()} rows processed
                      </p>
                    )}
                  </div>
                ) : isSampleLoading ? (
                  <p className="text-base font-semibold text-[#1f2328]">Loading sample data...</p>
                ) : (
                  <>
                    <p className="text-base font-semibold text-[#1f2328] mb-1">
                      Drop your CSV file here
                    </p>
                    <p className="text-sm text-[#636c76]">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Accepted file hint */}
        <p className="mt-4 text-xs text-center text-[#636c76] font-medium tracking-wide">
          Accepted: .csv files from the Premium Request Usage report
        </p>

        {/* Sample data button */}
        <div className="mt-5 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <button
            onClick={(e) => { e.stopPropagation(); loadSampleData(); }}
            disabled={isBusy}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#2da44e] hover:bg-[#2c974b] border border-[#2da44e] hover:border-[#2c974b] rounded-md transition-all duration-150 disabled:opacity-50"
          >
            Try with sample data
          </button>
        </div>

        {/* Inline privacy info */}
        <div className="mt-8 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="p-4 bg-[#f6f8fa] rounded-md border border-[#d1d9e0]">
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#2da44e" className="flex-shrink-0" aria-hidden="true">
                <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z" />
              </svg>
              <span className="text-sm font-semibold text-[#1f2328]">Your data stays private</span>
            </div>
            <ul className="space-y-1 text-sm text-[#636c76] leading-relaxed pl-5 list-disc">
              <li>All processing of your uploaded CSV happens in your browser. The file contents are not uploaded to any server.</li>
              <li>The contents of your uploaded CSV are not stored or cached on any server.</li>
              <li>When you close or reload this tab, the app does not retain your uploaded CSV file.</li>
              <li>This page does not send the contents of your uploaded CSV to external endpoints.</li>
              <li>
                You can verify this yourself — the source code is available at{' '}
                <a
                  href="https://github.com/asizikov-demos/copilot-premium-requests-report-viewer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-600 font-medium transition-colors duration-150 break-all"
                >
                  github.com/asizikov-demos/copilot-premium-requests-report-viewer
                </a>
                .
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* How to get this report */}
      <div className="mt-5 text-center opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <a
          href="https://docs.github.com/en/enterprise-cloud@latest/billing/how-tos/products/view-productlicense-use#downloading-usage-reports"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#636c76] hover:text-indigo-500 transition-colors duration-150 font-medium"
        >
          How to get this report →
        </a>
      </div>
    </div>
  );
}
