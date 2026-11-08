import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CSVUploader } from '@/components/CSVUploader';
import { validCSVString, validCSVData } from '../fixtures/validCSVData';
import { invalidCSVData } from '../fixtures/invalidCSVData';
import { newFormatRows } from '../fixtures/newFormatCSVData';
import { createMockFile } from '../helpers/testUtils';
import type { IngestionResult } from '@/utils/ingestion';

// Mock the ingestion module
jest.mock('@/utils/ingestion', () => {
  const actual = jest.requireActual('@/utils/ingestion');
  return {
    ...actual,
    ingestStream: jest.fn(),
  };
});

// Helper to create mock IngestionResult
function createMockIngestionResult(rows: unknown[]): IngestionResult {
  return {
    outputs: {
      'quota': { quotaByUser: new Map(), conflicts: new Map(), distinctQuotas: new Set(), hasMixedQuotas: false, hasMixedLicenses: false },
      'usage': { userTotals: new Map(), modelBreakdown: new Map(), globalModelTotals: new Map(), topModelPerUser: new Map() },
      'dailyBuckets': { dailyUserTotals: new Map(), startDate: new Date(), endDate: new Date() },
      'rawData': rows
    },
    rowsProcessed: rows.length,
    durationMs: 100,
    warnings: []
  };
}

describe('CSVUploader', () => {
  const mockOnDataLoad = jest.fn();
  const mockOnError = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock('@/utils/ingestion').ingestStream.mockReset();
  });

  afterEach(() => {
    // Ensure we don't leak fetch mocks between tests.
    delete (global as { fetch?: unknown }).fetch;
  });

  it('should render upload interface', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    expect(screen.getByText(/drop your csv file here/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'GitHub Copilot AI Usage' })).toBeInTheDocument();
  });

  it('should show accepted file hint', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    expect(screen.getByText(/Accepted:/i)).toBeInTheDocument();
    expect(screen.getByText('Accepted: .csv files from the GitHub Copilot AI Usage report')).toBeInTheDocument();
  });

  it.each(['{Enter}', ' '])('opens the single CSV picker with the keyboard: %s', async (key) => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const input = screen.getByLabelText('Upload CSV file');
    const openPicker = jest.spyOn(input, 'click');
    const browse = screen.getByRole('button', { name: /upload csv file by dragging/i });

    await user.tab();
    expect(browse).toHaveFocus();
    expect(browse).toHaveAccessibleDescription('Accepted: .csv files from the GitHub Copilot AI Usage report');
    await user.keyboard(key);

    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('accept', '.csv');
    expect(input).not.toHaveAttribute('multiple');
    openPicker.mockRestore();
  });

  it('announces processing and prevents browsing or additional drops while busy', async () => {
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onProgress: (progress: { rowsProcessed: number }) => void }) => {
      options.onProgress({ rowsProcessed: 1000 });
    });
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const input = screen.getByLabelText('Upload CSV file');
    const browse = screen.getByRole('button', { name: /upload csv file by dragging/i });
    await user.upload(input, createMockFile(validCSVString, 'test.csv'));

    expect(screen.getByRole('status')).toHaveTextContent('Processing file...');
    expect(screen.getByRole('status')).toHaveTextContent('1,000 rows processed');
    expect(screen.getByRole('progressbar', { name: 'File processing progress' })).toBeInTheDocument();
    expect(browse).toBeDisabled();
    expect(screen.getByRole('button', { name: /try with sample/i })).toBeDisabled();

    const openPicker = jest.spyOn(input, 'click');
    fireEvent.drop(browse, { dataTransfer: { files: [createMockFile(validCSVString, 'second.csv')] } });
    await user.click(browse);
    expect(ingestStream).toHaveBeenCalledTimes(1);
    expect(openPicker).not.toHaveBeenCalled();
    openPicker.mockRestore();
  });

  it('renders updated errors in a persistent alert region inside the upload card', () => {
    const { rerender } = render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeEmptyDOMElement();

    rerender(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} error="CSV file is empty" />);

    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert).toHaveTextContent('CSV file is empty');
    expect(screen.getByRole('region', { name: 'Error processing file' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Upload usage file' })).toContainElement(alert);
  });
  it('forwards ingestion completion with the filename and includes the tokens aggregator', async () => {
    const mockFile = createMockFile('new-format.csv content', 'new-format.csv');
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onComplete: (result: IngestionResult) => void }) => {
      setTimeout(() => {
        options.onComplete(createMockIngestionResult(newFormatRows));
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(expect.objectContaining({ rowsProcessed: newFormatRows.length }), 'new-format.csv');
    });
    expect(ingestStream).toHaveBeenCalledWith(
      mockFile,
      expect.arrayContaining([expect.objectContaining({ id: 'tokens' })]),
      expect.any(Object)
    );
  });

  it('should handle file validation errors for non-CSV files', async () => {
    const mockFile = createMockFile('test content', 'test.txt', 'text/plain');
    
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Use fireEvent instead of userEvent for file upload
    fireEvent.change(hiddenInput, {
      target: { files: [mockFile] }
    });

    // Should not call ingestStream for non-CSV files
    expect(jest.requireMock('@/utils/ingestion').ingestStream).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Please select a CSV file');
    });
  });

  it.each([
    ['Missing required columns: quantity', invalidCSVData.missingColumns],
    ['Missing required columns: date', invalidCSVData.missingRequiredColumns],
  ])('forwards the ingestion error callback: %s', async (error, content) => {
    const mockFile = createMockFile(content, 'test.csv');
    
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onError: (error: string) => void }) => {
      setTimeout(() => {
        options.onError(error);
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(error);
    });
  });

  it('should handle empty CSV files', async () => {
    const mockFile = createMockFile(invalidCSVData.emptyFile, 'empty.csv');
    
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onComplete: (result: IngestionResult) => void }) => {
      setTimeout(() => {
        options.onComplete(createMockIngestionResult([]));
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('CSV file is empty');
    });
  });

  it('should handle Papa Parse errors', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onError: (error: string) => void }) => {
      setTimeout(() => {
        options.onError('CSV parsing error: Parse error');
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('CSV parsing error: Parse error');
    });
  });

  it('should handle file reading errors', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onError: (error: string) => void }) => {
      setTimeout(() => {
        options.onError('File reading error: File reading failed');
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('File reading error: File reading failed');
    });
  });

  it('should show loading state during file processing', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    // Mock ingestStream to not call complete immediately
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation(() => {
      // Don't call any callback immediately
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    // Should show loading state
    expect(screen.getByText(/processing file/i)).toBeInTheDocument();
  });

  it('should handle drag and drop functionality', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onComplete: (result: IngestionResult) => void }) => {
      setTimeout(() => {
        options.onComplete(createMockIngestionResult(validCSVData));
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const dropZone = screen.getByRole('button', { name: /upload csv file by dragging/i });
    
    // Test drop - this is the main functionality we care about
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [mockFile]
      }
    });

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(expect.objectContaining({ rowsProcessed: validCSVData.length }), 'test.csv');
    });
  });

  it('should load and ingest sample data when button is clicked', async () => {
    const sampleCsv = 'date,username,sku,unit_type,model,quantity\n2025-10-01,test-user-one,copilot_ai_credit,ai-credits,GPT-5,1';

    // Mock fetch to return the sample CSV as a blob.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([sampleCsv], { type: 'text/csv' })
    } as unknown as Response);

    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onComplete: (result: IngestionResult) => void }) => {
      setTimeout(() => {
        options.onComplete(createMockIngestionResult([{ date: '2025-10-01', username: 'test-user-one', sku: 'copilot_ai_credit', unit_type: 'ai-credits', model: 'GPT-5', quantity: '1' }]));
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    const sampleButton = screen.getByRole('button', { name: /try with sample data/i });
    await user.click(sampleButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/ai-credits-example\.csv$/));
      expect(mockOnDataLoad).toHaveBeenCalledWith(
        expect.objectContaining({ rowsProcessed: 1 }),
        'ai-credits-example.csv'
      );
    });
  });

  it('should prevent concurrent sample downloads when clicked multiple times', async () => {
    const sampleCsv = 'date,username,sku,unit_type,model,quantity\n2025-10-01,test-user-one,copilot_ai_credit,ai-credits,GPT-5,1';

    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = jest.fn().mockReturnValue(fetchPromise as unknown as Promise<Response>);

    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onComplete: (result: IngestionResult) => void }) => {
      setTimeout(() => {
        options.onComplete(createMockIngestionResult([{ date: '2025-10-01', username: 'test-user-one', sku: 'copilot_ai_credit', unit_type: 'ai-credits', model: 'GPT-5', quantity: '1' }]));
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    const sampleButton = screen.getByRole('button', { name: /try with sample data/i });
    await user.click(sampleButton);
    await user.click(sampleButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading sample data...');
    expect(screen.getByRole('button', { name: /upload csv file by dragging/i })).toBeDisabled();

    resolveFetch!({
      ok: true,
      blob: async () => new Blob([sampleCsv], { type: 'text/csv' })
    } as unknown as Response);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(
        expect.objectContaining({ rowsProcessed: 1 }),
        'ai-credits-example.csv'
      );
    });
  });

  it('should surface an error if sample data fails to load', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      blob: async () => new Blob([], { type: 'text/csv' })
    } as unknown as Response);

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    const sampleButton = screen.getByRole('button', { name: /try with sample data/i });
    await user.click(sampleButton);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Failed to load sample data'));
    });
  });

  it('should show inline privacy information', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    expect(screen.getByText(/Your data stays private/i)).toBeInTheDocument();
    expect(screen.getByText(/All processing of your uploaded CSV happens in your browser/i)).toBeInTheDocument();
    expect(screen.getByText(/does not send the contents of your uploaded CSV to external endpoints/i)).toBeInTheDocument();
  });

  it('should show source code link inside privacy information', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    const sourceCodeLink = screen.getByRole('link', {
      name: /open source/i,
    });

    expect(sourceCodeLink).toHaveAttribute(
      'href',
      'https://github.com/asizikov-demos/copilot-premium-requests-report-viewer'
    );
  });

  it('should show documentation link', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const docLink = screen.getByRole('link', { name: /view github documentation/i });
    expect(docLink).toBeInTheDocument();
    expect(docLink).toHaveAttribute('href', expect.stringContaining('docs.github.com'));
  });

  it('should accept files with extra columns', async () => {
    const mockFile = createMockFile(invalidCSVData.extraColumns, 'test.csv');
    
    const { ingestStream } = jest.requireMock('@/utils/ingestion');
    const testData = [{
      date: '2025-06-03',
      username: 'test-user-a',
      model: 'gpt-4.1-2025-04-14',
      quantity: '1.00',
      total_monthly_quota: 'Unknown',
      extra_column: 'extra_value'
    }];
    ingestStream.mockImplementation((_file: File, _aggregators: unknown[], options: { onComplete: (result: IngestionResult) => void }) => {
      setTimeout(() => {
        options.onComplete(createMockIngestionResult(testData));
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });
});
