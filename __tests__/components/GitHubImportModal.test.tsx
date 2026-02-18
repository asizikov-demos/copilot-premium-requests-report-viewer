import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubImportModal } from '@/components/GitHubImportModal';
import type { IngestionResult } from '@/utils/ingestion';

// Mock the GitHub API module
jest.mock('@/utils/githubApi', () => ({
  validateToken: jest.fn(),
  listEnterprises: jest.fn(),
  requestBillingReport: jest.fn(),
  waitForReport: jest.fn(),
  downloadReport: jest.fn(),
  isGitHubApiError: jest.fn((e: unknown) =>
    typeof e === 'object' && e !== null && 'message' in e && 'status' in e
  ),
  PAT_CREATION_URL: 'https://github.com/settings/tokens/new?scopes=test',
}));

// Mock the ingestion module
jest.mock('@/utils/ingestion', () => {
  const actual = jest.requireActual('@/utils/ingestion');
  return {
    ...actual,
    ingestStream: jest.fn(),
  };
});

import {
  validateToken,
  listEnterprises,
} from '@/utils/githubApi';

const mockValidateToken = validateToken as jest.MockedFunction<typeof validateToken>;
const mockListEnterprises = listEnterprises as jest.MockedFunction<typeof listEnterprises>;

describe('GitHubImportModal', () => {
  const mockOnClose = jest.fn();
  const mockOnDataLoad = jest.fn();
  const mockOnError = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderModal(open = true) {
    return render(
      <GitHubImportModal
        open={open}
        onClose={mockOnClose}
        onDataLoad={mockOnDataLoad}
        onError={mockOnError}
      />
    );
  }

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = renderModal(false);
      expect(container.innerHTML).toBe('');
    });

    it('renders the modal when open', () => {
      renderModal();
      expect(screen.getByText('Import from GitHub')).toBeInTheDocument();
    });

    it('shows step 1 (token input) by default', () => {
      renderModal();
      expect(screen.getByLabelText('Personal Access Token')).toBeInTheDocument();
      expect(screen.getByText('Connect')).toBeInTheDocument();
    });

    it('shows PAT creation link', () => {
      renderModal();
      expect(screen.getByText(/Create a token with required scopes/)).toBeInTheDocument();
    });

    it('shows classic PAT explanation', () => {
      renderModal();
      expect(screen.getByText(/Why a classic token/)).toBeInTheDocument();
    });
  });

  describe('step 1: token validation', () => {
    it('disables Connect button when token is empty', async () => {
      renderModal();
      expect(screen.getByText('Connect')).toBeDisabled();
    });

    it('shows error on invalid token (401)', async () => {
      mockValidateToken.mockRejectedValueOnce({ message: 'Bad credentials', status: 401 });

      renderModal();
      const input = screen.getByLabelText('Personal Access Token');
      await user.type(input, 'ghp_bad_token');
      await user.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid token/)).toBeInTheDocument();
      });
    });

    it('advances to enterprise step on valid token', async () => {
      mockValidateToken.mockResolvedValueOnce({
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://example.com/avatar.png',
      });
      mockListEnterprises.mockResolvedValueOnce([
        { slug: 'acme-corp', name: 'Acme Corporation' },
      ]);

      renderModal();
      const input = screen.getByLabelText('Personal Access Token');
      await user.type(input, 'ghp_valid_token');
      await user.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });
    });
  });

  describe('step 2: enterprise selection', () => {
    async function advanceToStep2() {
      mockValidateToken.mockResolvedValueOnce({
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://example.com/avatar.png',
      });
      mockListEnterprises.mockResolvedValueOnce([
        { slug: 'acme-corp', name: 'Acme Corporation' },
        { slug: 'globex', name: 'Globex Inc' },
      ]);

      renderModal();
      const input = screen.getByLabelText('Personal Access Token');
      await user.type(input, 'ghp_valid_token');
      await user.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });
    }

    it('shows authenticated user info', async () => {
      await advanceToStep2();
      expect(screen.getByText('The Octocat')).toBeInTheDocument();
      expect(screen.getByText('@octocat')).toBeInTheDocument();
    });

    it('lists available enterprises', async () => {
      await advanceToStep2();
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByText('Globex Inc')).toBeInTheDocument();
    });

    it('disables Continue until an enterprise is selected', async () => {
      await advanceToStep2();
      expect(screen.getByText('Continue')).toBeDisabled();
    });

    it('enables Continue after selecting an enterprise', async () => {
      await advanceToStep2();
      await user.click(screen.getByText('Acme Corporation'));
      expect(screen.getByText('Continue')).not.toBeDisabled();
    });

    it('allows navigating back', async () => {
      await advanceToStep2();
      await user.click(screen.getByText('← Back'));
      expect(screen.getByLabelText('Personal Access Token')).toBeInTheDocument();
    });

    it('shows error when no enterprises found', async () => {
      mockValidateToken.mockResolvedValueOnce({
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://example.com/avatar.png',
      });
      mockListEnterprises.mockResolvedValueOnce([]);

      renderModal();
      const input = screen.getByLabelText('Personal Access Token');
      await user.type(input, 'ghp_valid_token');
      await user.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText(/No enterprises found/)).toBeInTheDocument();
      });
    });
  });

  describe('step 3: date range', () => {
    async function advanceToStep3() {
      mockValidateToken.mockResolvedValueOnce({
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://example.com/avatar.png',
      });
      mockListEnterprises.mockResolvedValueOnce([
        { slug: 'acme-corp', name: 'Acme Corporation' },
      ]);

      renderModal();
      const input = screen.getByLabelText('Personal Access Token');
      await user.type(input, 'ghp_valid_token');
      await user.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Acme Corporation'));
      await user.click(screen.getByText('Continue'));
    }

    it('shows date preset options', async () => {
      await advanceToStep3();
      expect(screen.getByText('Current month')).toBeInTheDocument();
      expect(screen.getByText('Last 31 days')).toBeInTheDocument();
    });

    it('shows enterprise summary', async () => {
      await advanceToStep3();
      expect(screen.getByText('acme-corp')).toBeInTheDocument();
      expect(screen.getByText('Premium Requests')).toBeInTheDocument();
    });

    it('shows Fetch Report button', async () => {
      await advanceToStep3();
      expect(screen.getByText('Fetch Report')).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      renderModal();
      await user.click(screen.getByLabelText('Close'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose on ESC key', () => {
      renderModal();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
