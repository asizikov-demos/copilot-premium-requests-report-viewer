'use client';

import { useId, useRef, useState } from 'react';
import { FileIcon, LinkExternalIcon, LockIcon, UploadIcon } from '@primer/octicons-react';
import { Banner, Button, Heading, Link, ProgressBar, Spinner, Stack, Text } from '@primer/react';

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
  error?: string;
}

export function CSVUploader({ onDataLoad, onError, error }: CSVUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRowsProcessed, setTotalRowsProcessed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const fileHintId = useId();

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
    if (isBusy) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isBusy) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      startIngestion(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBusy) return;
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      startIngestion(files[0]);
    }
  };

  const handleButtonClick = () => {
    if (isBusy) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <Stack gap="normal">
        <Stack gap="tight" className="text-center mb-2">
          <Heading as="h2" variant="medium">GitHub Copilot AI Usage</Heading>
          <Text as="p" size="medium" className="text-(--fgColor-muted)">
            Upload your GitHub Copilot AI Usage report to review usage patterns, quota consumption, and billing details locally in your browser.
          </Text>
        </Stack>

        <section aria-labelledby={`${fileInputId}-title`} className="rounded-md border border-(--borderColor-default) bg-(--bgColor-default)">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <Text as="h3" id={`${fileInputId}-title`} size="medium" weight="semibold">Upload usage file</Text>
          </div>
          <div className="p-5">
            <Stack gap="normal">
              <label htmlFor={fileInputId} className="sr-only">Upload CSV file</label>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                hidden
                disabled={isBusy}
              />
              <button
                type="button"
                aria-label="Upload CSV file by dragging and dropping or browsing your device"
                aria-describedby={fileHintId}
                disabled={isBusy}
                className={`w-full rounded-md border-2 border-dashed p-8 text-center transition-colors ${
                  isBusy
                    ? 'border-(--borderColor-default) opacity-50 cursor-not-allowed'
                    : isDragOver
                      ? 'cursor-pointer border-(--borderColor-accent-emphasis) bg-(--bgColor-accent-muted)'
                      : 'cursor-pointer border-(--borderColor-default) hover:border-(--borderColor-accent-emphasis) hover:bg-(--bgColor-muted)'
                }`}
                onDragEnter={handleDragOver}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleButtonClick}
              >
                <Stack as="span" align="center" gap="cozy">
                  <UploadIcon size={24} className="text-(--fgColor-muted)" />
                  <Stack as="span" gap="tight">
                    <Text size="medium" weight="medium">Drag &amp; drop your CSV file here, or click to browse</Text>
                    <Text id={fileHintId} size="small" className="text-(--fgColor-muted)">
                      Accepted: .csv files from the GitHub Copilot AI Usage report
                    </Text>
                  </Stack>
                </Stack>
              </button>

              <Stack direction="horizontal" align="center" gap="cozy" aria-hidden="true">
                <span className="flex-1 border-t border-(--borderColor-default)" />
                <Text size="small" className="text-(--fgColor-muted)">or</Text>
                <span className="flex-1 border-t border-(--borderColor-default)" />
              </Stack>

              <Stack direction="horizontal" justify="center">
                <Button variant="primary" leadingVisual={FileIcon} onClick={loadSampleData} disabled={isBusy}>
                  Try with sample data
                </Button>
              </Stack>

              <div role="status" aria-atomic="true">
                {isBusy && (
                  <Stack align="center" gap="condensed" paddingBlock="condensed">
                    <Stack direction="horizontal" align="center" gap="condensed">
                      <Spinner size="small" srText={null} />
                      <Text size="medium" className="text-(--fgColor-muted)">
                        {isLoading ? 'Processing file...' : 'Loading sample data...'}
                      </Text>
                    </Stack>
                    {isLoading && (
                      <div className="w-full max-w-sm">
                        <ProgressBar progress={progress} bg="accent.emphasis" aria-label="File processing progress" />
                      </div>
                    )}
                    {totalRowsProcessed > 0 && (
                      <Text as="p" size="small" className="text-(--fgColor-muted)">
                        {totalRowsProcessed.toLocaleString()} rows processed
                      </Text>
                    )}
                  </Stack>
                )}
              </div>

            </Stack>
            <div role="alert" aria-atomic="true">
              {error && (
                <div className="mt-4">
                  <Banner variant="critical" layout="compact" title="Error processing file" hideTitle description={error} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby={`${fileInputId}-help`} className="rounded-md border border-(--borderColor-default) bg-(--bgColor-default)">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <Text as="h3" id={`${fileInputId}-help`} size="medium" weight="semibold">How to get this report</Text>
          </div>
          <div className="px-5 py-4">
            <Text as="p" size="medium">
              Download your GitHub Copilot AI Usage report as a CSV file, then upload it here.
              {' '}For export instructions,{' '}
              <Link
                href="https://docs.github.com/en/enterprise-cloud@latest/billing/how-tos/products/view-productlicense-use#downloading-usage-reports"
                target="_blank"
                rel="noopener noreferrer"
              >
                view GitHub documentation <LinkExternalIcon size={16} className="inline-block align-text-bottom" />
              </Link>
              .
            </Text>
          </div>
        </section>

        <div className="rounded-md border border-(--borderColor-default) bg-(--bgColor-muted)">
          <Stack direction="horizontal" align="start" gap="cozy" paddingInline="normal" paddingBlock="cozy">
            <LockIcon size={16} className="shrink-0 mt-0.5 text-(--fgColor-muted)" />
            <Text as="p" size="small" className="text-(--fgColor-muted)">
              <Text weight="semibold" className="text-(--fgColor-default)">Your data stays private.</Text>
              {' '}All processing of your uploaded CSV happens in your browser. The file contents are not uploaded, stored, or cached on any server.
              {' '}This page does not send the contents of your uploaded CSV to external endpoints.
              {' '}When you close or reload this tab, the app does not retain your uploaded CSV file.
              {' '}You can verify this yourself — the source code is{' '}
              <Link
                href="https://github.com/asizikov-demos/copilot-premium-requests-report-viewer"
                target="_blank"
                rel="noopener noreferrer"
              >
                open source
              </Link>
              .
            </Text>
          </Stack>
        </div>
      </Stack>
    </div>
  );
}
