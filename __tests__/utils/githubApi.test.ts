/**
 * Tests for GitHub API utility module.
 */

import {
  validateToken,
  listEnterprises,
  requestBillingReport,
  pollReportStatus,
  downloadReport,
  waitForReport,
  isGitHubApiError,
  PAT_CREATION_URL,
} from '@/utils/githubApi';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// PAT_CREATION_URL
// ---------------------------------------------------------------------------

describe('PAT_CREATION_URL', () => {
  it('includes required scopes', () => {
    expect(PAT_CREATION_URL).toContain('manage_billing:enterprise');
    expect(PAT_CREATION_URL).toContain('read:enterprise');
  });

  it('points to GitHub token creation page', () => {
    expect(PAT_CREATION_URL).toMatch(/^https:\/\/github\.com\/settings\/tokens\/new/);
  });
});

// ---------------------------------------------------------------------------
// validateToken
// ---------------------------------------------------------------------------

describe('validateToken', () => {
  it('returns user info on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://example.com/avatar.png' }),
    });

    const user = await validateToken('ghp_test123');

    expect(user.login).toBe('octocat');
    expect(user.name).toBe('The Octocat');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ghp_test123' }),
      }),
    );
  });

  it('throws GitHubApiError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });

    try {
      await validateToken('bad_token');
      fail('Expected error');
    } catch (err) {
      expect(isGitHubApiError(err)).toBe(true);
      if (isGitHubApiError(err)) {
        expect(err.status).toBe(401);
        expect(err.message).toBe('Bad credentials');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// listEnterprises
// ---------------------------------------------------------------------------

describe('listEnterprises', () => {
  it('returns enterprise list from GraphQL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            viewer: {
              enterprises: {
                nodes: [
                  { slug: 'acme-corp', name: 'Acme Corporation' },
                  { slug: 'globex', name: 'Globex Inc' },
                ],
              },
            },
          },
        }),
    });

    const enterprises = await listEnterprises('ghp_test123');

    expect(enterprises).toHaveLength(2);
    expect(enterprises[0].slug).toBe('acme-corp');
    expect(enterprises[1].name).toBe('Globex Inc');
  });

  it('throws on GraphQL errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          errors: [{ message: 'Insufficient scopes' }],
        }),
    });

    await expect(listEnterprises('ghp_test123')).rejects.toEqual(
      expect.objectContaining({ message: 'Insufficient scopes' }),
    );
  });

  it('returns empty array when no enterprises', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { viewer: { enterprises: { nodes: [] } } },
        }),
    });

    const enterprises = await listEnterprises('ghp_test123');
    expect(enterprises).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// requestBillingReport
// ---------------------------------------------------------------------------

describe('requestBillingReport', () => {
  it('sends correct POST request and returns report', async () => {
    const mockReport = {
      id: 'report-123',
      report_type: 'premium_request',
      status: 'processing',
      download_urls: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 202,
      json: () => Promise.resolve(mockReport),
    });

    const report = await requestBillingReport('ghp_test', 'acme', '2026-01-01', '2026-01-31');

    expect(report.id).toBe('report-123');
    expect(report.status).toBe('processing');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/enterprises/acme/settings/billing/reports');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body);
    expect(body.report_type).toBe('premium_request');
    expect(body.start_date).toBe('2026-01-01');
    expect(body.end_date).toBe('2026-01-31');
  });
});

// ---------------------------------------------------------------------------
// pollReportStatus
// ---------------------------------------------------------------------------

describe('pollReportStatus', () => {
  it('fetches report status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'report-123',
          status: 'completed',
          download_urls: ['https://blob.example.com/report.csv'],
        }),
    });

    const report = await pollReportStatus('ghp_test', 'acme', 'report-123');

    expect(report.status).toBe('completed');
    expect(report.download_urls[0]).toContain('report.csv');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/enterprises/acme/settings/billing/reports/report-123',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ghp_test' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// downloadReport
// ---------------------------------------------------------------------------

describe('downloadReport', () => {
  it('returns CSV text on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('date,user,model\n2026-01-01,alice,gpt-4'),
    });

    const csv = await downloadReport('https://blob.example.com/report.csv');
    expect(csv).toContain('alice');
  });

  it('returns null on CORS/network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const csv = await downloadReport('https://blob.example.com/report.csv');
    expect(csv).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const csv = await downloadReport('https://blob.example.com/report.csv');
    expect(csv).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// waitForReport
// ---------------------------------------------------------------------------

describe('waitForReport', () => {
  it('returns immediately when report is already completed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'r1',
          status: 'completed',
          download_urls: ['https://example.com/report.csv'],
        }),
    });

    const report = await waitForReport('ghp_test', 'acme', 'r1', undefined, 10, 3);
    expect(report.status).toBe('completed');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on failed report', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: 'r1', status: 'failed', download_urls: [] }),
    });

    await expect(waitForReport('ghp_test', 'acme', 'r1', undefined, 10, 3)).rejects.toEqual(
      expect.objectContaining({ message: 'Report generation failed' }),
    );
  });

  it('respects AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForReport('ghp_test', 'acme', 'r1', undefined, 10, 3, controller.signal),
    ).rejects.toEqual(expect.objectContaining({ message: 'Report polling was cancelled' }));
  });
});

// ---------------------------------------------------------------------------
// isGitHubApiError
// ---------------------------------------------------------------------------

describe('isGitHubApiError', () => {
  it('identifies GitHubApiError objects', () => {
    expect(isGitHubApiError({ message: 'test', status: 404 })).toBe(true);
  });

  it('rejects non-error objects', () => {
    expect(isGitHubApiError(new Error('test'))).toBe(false);
    expect(isGitHubApiError(null)).toBe(false);
    expect(isGitHubApiError('string')).toBe(false);
  });
});
