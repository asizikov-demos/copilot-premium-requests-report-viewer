'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import {
  validateToken,
  listEnterprises,
  requestBillingReport,
  waitForReport,
  downloadReport,
  isGitHubApiError,
  PAT_CREATION_URL,
} from '@/utils/githubApi';
import type {
  GitHubUser,
  GitHubEnterprise,
  BillingReportRequest,
} from '@/utils/githubApi';
import {
  ingestStream,
  QuotaAggregator,
  UsageAggregator,
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  BillingAggregator,
  RawDataAggregator,
} from '@/utils/ingestion';
import type { IngestionResult } from '@/utils/ingestion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 'token' | 'enterprise' | 'dateRange' | 'fetching' | 'corsFallback';

interface FetchProgress {
  phase: 'requesting' | 'polling' | 'downloading' | 'parsing' | 'done';
  message: string;
  pollAttempt?: number;
}

type DatePreset = 'currentMonth' | 'last31Days';

interface GitHubImportModalProps {
  open: boolean;
  onClose: () => void;
  onDataLoad: (result: IngestionResult, filename: string) => void;
  onError: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDateRangeForPreset(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = new Date(Date.UTC(year, month, now.getUTCDate()));
  const end = formatDate(today);

  if (preset === 'last31Days') {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 30);
    return { start: formatDate(start), end };
  }

  // currentMonth
  const start = new Date(Date.UTC(year, month, 1));
  return { start: formatDate(start), end };
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'token', label: 'Authenticate' },
  { key: 'enterprise', label: 'Enterprise' },
  { key: 'dateRange', label: 'Date Range' },
  { key: 'fetching', label: 'Fetch' },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  const activeIdx = current === 'corsFallback' ? 3 : idx;

  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((step, i) => {
        const isCompleted = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300
                  ${isCompleted ? 'bg-orange-500 text-white' : ''}
                  ${isActive ? 'bg-stone-900 text-white ring-4 ring-stone-900/10' : ''}
                  ${!isCompleted && !isActive ? 'bg-stone-100 text-stone-400' : ''}
                `}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block transition-colors ${
                  isActive ? 'text-stone-900' : isCompleted ? 'text-stone-600' : 'text-stone-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 mx-1 transition-colors duration-300 ${
                  isCompleted ? 'bg-orange-300' : 'bg-stone-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CORS fallback: auto-download + inline drop zone
// ---------------------------------------------------------------------------

function CorsDropZone({
  downloadUrl,
  onFile,
  onClose,
}: {
  downloadUrl: string;
  onFile: (file: File) => void;
  onClose: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger the download on mount
  useEffect(() => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadUrl]);

  const handleFile = (file: File) => {
    if (file.name.toLowerCase().endsWith('.csv')) {
      onFile(file);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-4">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-stone-900 mb-1">Report Ready!</h4>
        <p className="text-sm text-stone-500 leading-relaxed">
          Your download has started. Drop the CSV file below to import it.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200
          ${isDragOver
            ? 'border-orange-400 bg-orange-50/60'
            : 'border-stone-200 hover:border-stone-300 bg-stone-50'}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) handleFile(files[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) handleFile(files[0]);
          }}
        />
        <svg
          className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDragOver ? 'text-orange-500' : 'text-stone-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3v11.25" />
        </svg>
        <p className="text-sm font-medium text-stone-700">Drop the downloaded CSV here</p>
        <p className="text-xs text-stone-400 mt-1">or click to browse</p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
        >
          Download again →
        </a>
        <button
          onClick={onClose}
          className="text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GitHubImportModal({ open, onClose, onDataLoad, onError }: GitHubImportModalProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('token');

  // Token step
  const [token, setToken] = useState('');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // Enterprise step
  const [enterprises, setEnterprises] = useState<GitHubEnterprise[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<string>('');
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [enterpriseError, setEnterpriseError] = useState('');

  // Date range step
  const [datePreset, setDatePreset] = useState<DatePreset>('currentMonth');
  const { start: startDate, end: endDate } = getDateRangeForPreset(datePreset);

  // Fetching step
  const [fetchProgress, setFetchProgress] = useState<FetchProgress>({
    phase: 'requesting',
    message: 'Requesting report...',
  });
  const abortRef = useRef<AbortController | null>(null);
  const [corsFallbackUrl, setCorsFallbackUrl] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset on close
  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setStep('token');
    setToken('');
    setUser(null);
    setTokenError('');
    setEnterprises([]);
    setSelectedEnterprise('');
    setEnterpriseError('');
    setDatePreset('currentMonth');
    setFetchProgress({ phase: 'requesting', message: 'Requesting report...' });
    setCorsFallbackUrl(null);
    onClose();
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = orig; };
    }
  }, [open]);

  // -------------------------------------------------------------------------
  // Step 1: Token validation
  // -------------------------------------------------------------------------
  const handleConnect = async () => {
    if (!token.trim()) {
      setTokenError('Please enter a token');
      return;
    }
    setTokenLoading(true);
    setTokenError('');
    try {
      const ghUser = await validateToken(token.trim());
      setUser(ghUser);

      // Auto-advance: discover enterprises
      setEnterpriseLoading(true);
      setStep('enterprise');
      try {
        const ents = await listEnterprises(token.trim());
        setEnterprises(ents);
        if (ents.length === 1) setSelectedEnterprise(ents[0].slug);
        if (ents.length === 0) {
          setEnterpriseError(
            'No enterprises found. Make sure your token has the read:enterprise scope and you are a member of an enterprise.',
          );
        }
      } catch (err) {
        setEnterpriseError(
          isGitHubApiError(err) ? err.message : 'Failed to discover enterprises',
        );
      } finally {
        setEnterpriseLoading(false);
      }
    } catch (err) {
      if (isGitHubApiError(err)) {
        setTokenError(
          err.status === 401
            ? 'Invalid token. Make sure you created a classic PAT with the correct scopes.'
            : err.message,
        );
      } else {
        setTokenError('Network error. Please check your connection.');
      }
    } finally {
      setTokenLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step 3 → 4: Start fetching
  // -------------------------------------------------------------------------
  const handleStartFetch = async () => {
    setStep('fetching');
    setFetchProgress({ phase: 'requesting', message: 'Requesting report from GitHub...' });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. Request report
      const report = await requestBillingReport(token, selectedEnterprise, startDate, endDate);

      // 2. Poll for completion
      setFetchProgress({ phase: 'polling', message: 'Generating report...', pollAttempt: 0 });
      const completed = await waitForReport(
        token,
        selectedEnterprise,
        report.id,
        (_r: BillingReportRequest, attempt: number) => {
          setFetchProgress({
            phase: 'polling',
            message: `Waiting for report... (${attempt * 30}s)`,
            pollAttempt: attempt,
          });
        },
        30_000,
        40,
        controller.signal,
      );

      if (!completed.download_urls?.length) {
        throw { message: 'Report completed but no download URL provided', status: 500 };
      }

      // 3. Download CSV
      setFetchProgress({ phase: 'downloading', message: 'Downloading CSV...' });
      const csvText = await downloadReport(completed.download_urls[0]);

      if (csvText === null) {
        // CORS blocked — offer fallback
        setCorsFallbackUrl(completed.download_urls[0]);
        setStep('corsFallback');
        return;
      }

      // 4. Parse & ingest
      setFetchProgress({ phase: 'parsing', message: 'Processing data...' });
      const filename = `${selectedEnterprise}_premium_requests_${startDate}_${endDate}.csv`;
      const blob = new Blob([csvText], { type: 'text/csv' });
      const file = new File([blob], filename, { type: 'text/csv' });
      ingestFile(file, filename);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = isGitHubApiError(err) ? err.message : 'Failed to fetch report';
      onError(msg);
      handleClose();
    }
  };

  // -------------------------------------------------------------------------
  // Shared ingestion (reused by normal flow & CORS fallback)
  // -------------------------------------------------------------------------
  const ingestFile = useCallback(
    (file: File, filename: string) => {
      const quotaAgg = new QuotaAggregator();
      const usageAgg = new UsageAggregator();
      const dailyAgg = new DailyBucketsAggregator();
      const featureAgg = new FeatureUsageAggregator();
      const billingAgg = new BillingAggregator();
      const rawAgg = new RawDataAggregator();

      ingestStream(file, [quotaAgg, usageAgg, dailyAgg, featureAgg, billingAgg, rawAgg], {
        chunkSize: 1024 * 1024,
        progressResolution: 1000,
        onProgress: () => {
          setFetchProgress({ phase: 'parsing', message: 'Processing data...' });
        },
        onComplete: (result) => {
          if (result.rowsProcessed === 0) {
            onError('Downloaded CSV file is empty');
            handleClose();
            return;
          }
          setFetchProgress({ phase: 'done', message: 'Done!' });
          setTimeout(() => {
            onDataLoad(result, filename);
            handleClose();
          }, 300);
        },
        onError: (msg) => {
          onError(msg);
          handleClose();
        },
      });
    },
    [onDataLoad, onError, handleClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-100 animate-scale-in overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="github-import-title"
      >
        {/* Header */}
        <div className="px-7 pt-6 pb-0">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div>
                <h3 id="github-import-title" className="text-lg font-bold text-stone-900">
                  Import from GitHub
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Fetch billing report via API
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-stone-400 hover:text-stone-600 transition-colors p-1.5 hover:bg-stone-100 rounded-lg"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <StepIndicator current={step} />
        </div>

        {/* Body */}
        <div className="px-7 pb-7">
          {/* ---- Step 1: Token ---- */}
          {step === 'token' && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                Enter a <span className="font-semibold text-stone-800">classic</span> Personal Access Token with
                billing permissions. Your token is used client-side only and is never stored.
              </p>

              <div className="mb-4">
                <label htmlFor="pat-input" className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Personal Access Token
                </label>
                <input
                  id="pat-input"
                  type="password"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setTokenError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all bg-stone-50 font-mono placeholder:text-stone-300"
                  autoFocus
                  data-autofocus
                />
              </div>

              {tokenError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{tokenError}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <a
                  href={PAT_CREATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  Create a token with required scopes →
                </a>
                <button
                  onClick={handleConnect}
                  disabled={tokenLoading || !token.trim()}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {tokenLoading && (
                    <div className="w-4 h-4 border-2 border-stone-600 border-t-white rounded-full animate-spin" />
                  )}
                  Connect
                </button>
              </div>

              {/* Info callout */}
              <div className="mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Why a classic token?</span> GitHub&apos;s enterprise billing
                  endpoints do not yet support fine-grained PATs. Only two scopes are needed:
                  {' '}<code className="text-[11px] bg-amber-100 px-1 py-0.5 rounded font-mono">manage_billing:enterprise</code>
                  {' '}and{' '}
                  <code className="text-[11px] bg-amber-100 px-1 py-0.5 rounded font-mono">read:enterprise</code>.
                </p>
              </div>
            </div>
          )}

          {/* ---- Step 2: Enterprise selection ---- */}
          {step === 'enterprise' && (
            <div className="animate-fade-in-up">
              {user && (
                <div className="flex items-center gap-3 mb-5 p-3 bg-stone-50 rounded-xl border border-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                  <div className="text-sm">
                    <span className="font-semibold text-stone-900">{user.name || user.login}</span>
                    <span className="text-stone-400 ml-1.5">@{user.login}</span>
                  </div>
                  <svg className="w-4 h-4 text-green-500 ml-auto" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {enterpriseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-stone-200 border-t-orange-500 rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-stone-500">Discovering enterprises...</span>
                </div>
              ) : enterpriseError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
                  {enterpriseError}
                </div>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">
                    Select Enterprise
                  </label>
                  <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
                    {enterprises.map((ent) => (
                      <button
                        key={ent.slug}
                        onClick={() => setSelectedEnterprise(ent.slug)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                          selectedEnterprise === ent.slug
                            ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100'
                            : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <span className="font-semibold text-stone-900">{ent.name}</span>
                        <span className="text-stone-400 ml-2 text-xs font-mono">{ent.slug}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('token')}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('dateRange')}
                  disabled={!selectedEnterprise}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ---- Step 3: Date range ---- */}
          {step === 'dateRange' && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-stone-600 mb-5 leading-relaxed">
                Choose a period for the premium request report.
              </p>

              <div className="space-y-2 mb-5">
                <button
                  onClick={() => setDatePreset('currentMonth')}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all text-sm ${
                    datePreset === 'currentMonth'
                      ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <span className="font-semibold text-stone-900">Current month</span>
                  <span className="block text-xs text-stone-500 mt-0.5">
                    {startDate} → {endDate} ({daysBetween(startDate, endDate)} days)
                  </span>
                </button>
                <button
                  onClick={() => setDatePreset('last31Days')}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all text-sm ${
                    datePreset === 'last31Days'
                      ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <span className="font-semibold text-stone-900">Last 31 days</span>
                  {/* Show the computed dates for the non-selected preset too */}
                  <span className="block text-xs text-stone-500 mt-0.5">
                    {getDateRangeForPreset('last31Days').start} → {getDateRangeForPreset('last31Days').end} (31 days)
                  </span>
                </button>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-100 rounded-xl mb-5">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Enterprise</span>
                  <span className="font-semibold text-stone-700 font-mono">{selectedEnterprise}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500 mt-1">
                  <span>Report type</span>
                  <span className="font-semibold text-stone-700">Premium Requests</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('enterprise')}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleStartFetch}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
                >
                  Fetch Report
                </button>
              </div>
            </div>
          )}

          {/* ---- Step 4: Fetching progress ---- */}
          {step === 'fetching' && (
            <div className="animate-fade-in-up text-center py-6">
              <div className="relative w-16 h-16 mx-auto mb-5">
                {fetchProgress.phase === 'done' ? (
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 border-4 border-stone-100 rounded-full" />
                    <div className="absolute inset-0 w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </>
                )}
              </div>

              <p className="text-base font-semibold text-stone-900 mb-1">
                {fetchProgress.phase === 'requesting' && 'Requesting Report'}
                {fetchProgress.phase === 'polling' && 'Generating Report'}
                {fetchProgress.phase === 'downloading' && 'Downloading CSV'}
                {fetchProgress.phase === 'parsing' && 'Processing Data'}
                {fetchProgress.phase === 'done' && 'Complete!'}
              </p>
              <p className="text-sm text-stone-500">{fetchProgress.message}</p>

              {fetchProgress.phase === 'polling' && (
                <p className="text-xs text-stone-400 mt-3">
                  Reports typically take 2–5 minutes to generate
                </p>
              )}

              {fetchProgress.phase !== 'done' && (
                <button
                  onClick={() => { abortRef.current?.abort(); handleClose(); }}
                  className="mt-6 text-sm text-stone-500 hover:text-stone-700 font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* ---- CORS Fallback: auto-download + inline drop zone ---- */}
          {step === 'corsFallback' && corsFallbackUrl && (
            <CorsDropZone
              downloadUrl={corsFallbackUrl}
              onFile={(file) => {
                const filename = `${selectedEnterprise}_premium_requests_${startDate}_${endDate}.csv`;
                ingestFile(file, filename);
              }}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
