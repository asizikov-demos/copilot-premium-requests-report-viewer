/**
 * GitHub API utilities for fetching billing reports directly from GitHub.
 *
 * Uses a classic PAT with `manage_billing:enterprise` + `read:enterprise` scopes.
 * Fine-grained PATs are NOT supported for enterprise billing endpoints (GitHub limitation).
 *
 * All requests are made client-side — the token never leaves the browser.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const API_VERSION = '2022-11-28';

const PAT_CREATION_SCOPES = 'manage_billing:enterprise,read:enterprise';
const PAT_CREATION_DESCRIPTION = 'Copilot Premium Requests Viewer';

/** Direct link to create a classic PAT with the minimum required scopes. */
export const PAT_CREATION_URL =
  `https://github.com/settings/tokens/new?scopes=${PAT_CREATION_SCOPES}&description=${encodeURIComponent(PAT_CREATION_DESCRIPTION)}`;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubEnterprise {
  slug: string;
  name: string;
}

export interface BillingReportRequest {
  id: string;
  report_type: string;
  status: 'processing' | 'completed' | 'failed';
  download_urls: string[];
}

export interface GitHubApiError {
  message: string;
  status: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  };
}

function isGitHubApiError(error: unknown): error is GitHubApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'status' in error
  );
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `GitHub API error (${response.status})`;
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch {
      // use default message
    }
    const err: GitHubApiError = { message, status: response.status };
    throw err;
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Validate a PAT by calling GET /user.
 * Returns the authenticated user info, or throws a GitHubApiError.
 */
export async function validateToken(pat: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: authHeaders(pat),
  });
  return handleResponse<GitHubUser>(res);
}

/**
 * Discover enterprises the authenticated user belongs to via GraphQL.
 * Requires `read:enterprise` scope.
 */
export async function listEnterprises(pat: string): Promise<GitHubEnterprise[]> {
  const query = `
    query {
      viewer {
        enterprises(first: 100) {
          nodes {
            slug
            name
          }
        }
      }
    }
  `;

  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      ...authHeaders(pat),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await handleResponse<{
    data?: { viewer: { enterprises: { nodes: GitHubEnterprise[] } } };
    errors?: Array<{ message: string }>;
  }>(res);

  if (data.errors?.length) {
    const err: GitHubApiError = {
      message: data.errors[0].message,
      status: 403,
    };
    throw err;
  }

  return data.data?.viewer.enterprises.nodes ?? [];
}

/**
 * Request a premium_request billing report CSV.
 * Returns the report metadata including its ID for polling.
 *
 * @param startDate YYYY-MM-DD
 * @param endDate   YYYY-MM-DD (max 31 days from startDate)
 */
export async function requestBillingReport(
  pat: string,
  enterprise: string,
  startDate: string,
  endDate: string,
): Promise<BillingReportRequest> {
  const res = await fetch(
    `${GITHUB_API_BASE}/enterprises/${encodeURIComponent(enterprise)}/settings/billing/reports`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(pat),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        report_type: 'premium_request',
        start_date: startDate,
        end_date: endDate,
      }),
    },
  );

  // 202 Accepted is the expected status
  if (res.status === 202 || res.ok) {
    return res.json() as Promise<BillingReportRequest>;
  }
  return handleResponse<BillingReportRequest>(res);
}

/**
 * Poll the status of a previously requested report.
 * Returns updated report metadata including download_urls when completed.
 */
export async function pollReportStatus(
  pat: string,
  enterprise: string,
  reportId: string,
): Promise<BillingReportRequest> {
  const res = await fetch(
    `${GITHUB_API_BASE}/enterprises/${encodeURIComponent(enterprise)}/settings/billing/reports/${encodeURIComponent(reportId)}`,
    { headers: authHeaders(pat) },
  );
  return handleResponse<BillingReportRequest>(res);
}

/**
 * Download the CSV content from a completed report's download URL.
 *
 * The URL points to Azure Blob Storage which may not have CORS headers.
 * Returns the CSV text on success, or `null` if CORS blocks the request.
 */
export async function downloadReport(downloadUrl: string): Promise<string | null> {
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    // CORS or network error
    return null;
  }
}

/**
 * Poll a report until it completes or the timeout is reached.
 *
 * @param onStatusChange  Called each time the status is checked.
 * @param pollIntervalMs  Milliseconds between polls (default 30 000).
 * @param maxAttempts      Maximum number of poll attempts (default 40 ≈ 20 min).
 * @param signal           Optional AbortSignal to cancel polling.
 */
export async function waitForReport(
  pat: string,
  enterprise: string,
  reportId: string,
  onStatusChange?: (report: BillingReportRequest, attempt: number) => void,
  pollIntervalMs = 30_000,
  maxAttempts = 40,
  signal?: AbortSignal,
): Promise<BillingReportRequest> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      const err: GitHubApiError = { message: 'Report polling was cancelled', status: 0 };
      throw err;
    }

    const report = await pollReportStatus(pat, enterprise, reportId);
    onStatusChange?.(report, attempt);

    if (report.status === 'completed') return report;
    if (report.status === 'failed') {
      const err: GitHubApiError = { message: 'Report generation failed', status: 500 };
      throw err;
    }

    // Wait before next poll
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }

  const err: GitHubApiError = { message: 'Report generation timed out', status: 408 };
  throw err;
}

/**
 * Type guard to check if an error is a GitHubApiError.
 */
export { isGitHubApiError };
