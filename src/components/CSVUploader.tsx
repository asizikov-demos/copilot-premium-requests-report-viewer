'use client';

import { useRef, useState } from 'react';
import { LockIcon, UploadIcon } from '@primer/octicons-react';
import { Button, ProgressBar, Spinner } from '@primer/react';

import {
  ingestStream,
  QuotaAggregator,
  UsageAggregator,
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  BillingAggregator,
  TokenAggregator,
  RawDataAggregator,
  IngestionResult
} from '@/utils/ingestion';
import { getBasePath } from '@/constants/deployment';

const SAMPLE_DATA_FILENAME = 'ai-credits-example.csv';

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
  const [totalRowsProcessed, setTotalRowsProcessed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isLoading || isSampleLoading;

  const startIngestion = (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      onError('Please select a CSV file');
      return;
    }

    // Reset state
    setIsLoading(true);
    setProgress(0);
    setTotalRowsProcessed(0);

    // Create all aggregators including raw data collector for adapter
    const quotaAggregator = new QuotaAggregator();
    const usageAggregator = new UsageAggregator();
    const dailyBucketsAggregator = new DailyBucketsAggregator();
    const featureUsageAggregator = new FeatureUsageAggregator();
    const billingAggregator = new BillingAggregator();
    const tokenAggregator = new TokenAggregator();
    const rawDataAggregator = new RawDataAggregator();

    // Single-pass streaming ingestion with all aggregators
    ingestStream(
      file,
      [quotaAggregator, usageAggregator, dailyBucketsAggregator, featureUsageAggregator, billingAggregator, tokenAggregator, rawDataAggregator],
      {
        chunkSize: 1024 * 1024, // 1MB chunks for smooth UI
        progressResolution: 1000,
        onProgress: (progressInfo) => {
          setTotalRowsProcessed(progressInfo.rowsProcessed);
          // Estimate progress percentage
          setProgress(prev => Math.min(prev + 5, 90));
        },
        onComplete: (result) => {
          setProgress(100);
          
          // Check if CSV is empty
          if (result.rowsProcessed === 0) {
            onError(result.warnings[0] ?? 'CSV file is empty');
            setIsLoading(false);
            setProgress(0);
            setTotalRowsProcessed(0);
            return;
          }
          
          // Small delay to show 100% before transitioning
          setTimeout(() => {
            onDataLoad(result, file.name);
            setIsLoading(false);
            setProgress(0);
            setTotalRowsProcessed(0);
          }, 200);
        },
        onError: (errorMsg) => {
          onError(errorMsg);
          setIsLoading(false);
          setProgress(0);
          setTotalRowsProcessed(0);
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
      setTotalRowsProcessed(0);
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
      <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md shadow-(--shadow-resting-small) px-8 py-10 animate-fade-in-up">
        {/* Hero section */}
        <div className="text-center mb-10">
          <h2 className="text-4xl text-(--fgColor-default) mb-4">
            Analyze your usage data
          </h2>
          <p className="text-lg text-(--fgColor-muted) max-w-md mx-auto leading-relaxed">
            Upload your GitHub Copilot AI Usage report to review usage patterns, quota consumption, and billing details locally in your browser.
          </p>
        </div>

        {/* Upload area */}
        <div
          className={`
            relative rounded-md border-2 border-dashed transition-all duration-150 cursor-pointer
            opacity-0 animate-scale-in
            ${isDragOver
              ? 'border-(--borderColor-accent-emphasis) bg-(--bgColor-accent-muted)'
              : 'border-(--borderColor-default) bg-(--bgColor-default) hover:border-(--borderColor-emphasis)'
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
                  ? 'bg-(--bgColor-accent-emphasis)'
                  : 'bg-(--bgColor-muted)'
                }
              `}>
                {isLoading ? (
                  <Spinner size="medium" srText={null} className="text-(--fgColor-accent)" />
                ) : (
                  <UploadIcon
                    size={24}
                    className={`transition-colors ${isDragOver ? 'text-(--fgColor-onEmphasis)' : 'text-(--fgColor-muted)'}`}
                  />
                )}
              </div>

              {/* Text */}
              <div className="text-center">
                {isLoading ? (
                  <div className="space-y-4">
                    <p className="text-base font-semibold text-(--fgColor-default)">Processing file...</p>
                    <div className="w-56 mx-auto">
                      <ProgressBar progress={progress} bg="accent.emphasis" aria-label="File processing progress" />
                    </div>
                    {totalRowsProcessed > 0 && (
                      <p className="text-sm text-(--fgColor-muted)">
                        {totalRowsProcessed.toLocaleString()} rows processed
                      </p>
                    )}
                  </div>
                ) : isSampleLoading ? (
                  <p className="text-base font-semibold text-(--fgColor-default)">Loading sample data...</p>
                ) : (
                  <>
                    <p className="text-base font-semibold text-(--fgColor-default) mb-1">
                      Drop your CSV file here
                    </p>
                    <p className="text-sm text-(--fgColor-muted)">
                      or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Accepted file hint */}
        <p className="mt-4 text-xs text-center text-(--fgColor-muted) font-medium tracking-wide">
          Accepted: .csv files from the GitHub Copilot AI Usage report
        </p>

        {/* Sample data button */}
        <div className="mt-5 flex justify-center opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Button
            variant="primary"
            size="large"
            onClick={(e) => { e.stopPropagation(); loadSampleData(); }}
            disabled={isBusy}
          >
            Try with sample data
          </Button>
        </div>

        {/* Inline privacy info */}
        <div className="mt-8 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="p-4 bg-(--bgColor-muted) rounded-md border border-(--borderColor-default)">
            <div className="flex items-center gap-2 mb-3">
              <LockIcon size={16} className="shrink-0 fill-(--fgColor-success)" />
              <span className="text-sm font-semibold text-(--fgColor-default)">Your data stays private</span>
            </div>
            <ul className="space-y-1 text-sm text-(--fgColor-muted) leading-relaxed pl-5 list-disc">
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
                  className="text-(--fgColor-accent) hover:underline font-medium transition-colors duration-150 break-all"
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
          className="text-xs text-(--fgColor-muted) hover:text-(--fgColor-accent) transition-colors duration-150 font-medium"
        >
          How to get this report →
        </a>
      </div>
    </div>
  );
}
