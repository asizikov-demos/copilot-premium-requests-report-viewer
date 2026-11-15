import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CSVUploader } from '@/components/CSVUploader';
import { validCSVString, validCSVData } from '../fixtures/validCSVData';
import { invalidCSVData } from '../fixtures/invalidCSVData';
import { newFormatRows } from '../fixtures/newFormatCSVData';
import { createMockFile } from '../helpers/testUtils';
import type { IngestionResult } from '@/utils/ingestion';
import { streamFile, type StreamFileOptions } from '@/utils/ingestion/streamFile';

jest.mock('@/utils/ingestion/streamFile', () => ({
  ...jest.requireActual('@/utils/ingestion/streamFile'),
  streamFile: jest.fn(),
}));

const mockStreamFile = jest.mocked(streamFile);

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
    mockStreamFile.mockReset();
    mockStreamFile.mockImplementation(() => new Promise(() => {}));
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
    const browse = screen.getByRole('button', { name: 'Drag & drop your CSV file here, or click to browse' });

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
    mockStreamFile.mockImplementation((_file, _ids, _filter, options?: StreamFileOptions) => {
      options?.onProgress?.({ rowsProcessed: 1000 });
      return new Promise(() => {});
    });
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const input = screen.getByLabelText('Upload CSV file');
    const browse = screen.getByRole('button', { name: 'Drag & drop your CSV file here, or click to browse' });
    await user.upload(input, createMockFile(validCSVString, 'test.csv'));

    expect(screen.getByRole('status')).toHaveTextContent('Processing file...');
    expect(screen.getByRole('status')).toHaveTextContent('1,000 rows processed');
    expect(screen.getByRole('progressbar', { name: 'File processing progress' })).toBeInTheDocument();
    expect(browse).toBeDisabled();
    expect(screen.getByRole('button', { name: /try with sample/i })).toBeDisabled();

    const openPicker = jest.spyOn(input, 'click');
    fireEvent.drop(browse, { dataTransfer: { files: [createMockFile(validCSVString, 'second.csv')] } });
    await user.click(browse);
    expect(mockStreamFile).toHaveBeenCalledTimes(1);
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
    mockStreamFile.mockResolvedValue(createMockIngestionResult(newFormatRows));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(expect.objectContaining({ rowsProcessed: newFormatRows.length }), 'new-format.csv', mockFile);
    });
    expect(mockStreamFile).toHaveBeenCalledWith(
      mockFile,
      expect.arrayContaining(['tokens']),
      undefined,
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

    expect(mockStreamFile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Please select a CSV file');
    });
  });

  it.each([
    ['Missing required columns: quantity', invalidCSVData.missingColumns],
    ['Missing required columns: date', invalidCSVData.missingRequiredColumns],
  ])('forwards the ingestion error callback: %s', async (error, content) => {
    const mockFile = createMockFile(content, 'test.csv');
    
    mockStreamFile.mockRejectedValue(new Error(error));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(error);
    });
  });

  it('should handle empty CSV files', async () => {
    const mockFile = createMockFile(invalidCSVData.emptyFile, 'empty.csv');
    
    mockStreamFile.mockResolvedValue(createMockIngestionResult([]));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('CSV file is empty');
    });
  });

  it('should handle Papa Parse errors', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    mockStreamFile.mockRejectedValue(new Error('CSV parsing error: Parse error'));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('CSV parsing error: Parse error');
    });
  });

  it('should handle file reading errors', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    mockStreamFile.mockRejectedValue(new Error('File reading error: File reading failed'));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('File reading error: File reading failed');
    });
  });

  it('should show loading state during file processing', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    // Should show loading state
    expect(screen.getByText(/processing file/i)).toBeInTheDocument();
  });

  it('should handle drag and drop functionality', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    mockStreamFile.mockResolvedValue(createMockIngestionResult(validCSVData));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const dropZone = screen.getByRole('button', { name: 'Drag & drop your CSV file here, or click to browse' });
    
    // Test drop - this is the main functionality we care about
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [mockFile]
      }
    });

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(expect.objectContaining({ rowsProcessed: validCSVData.length }), 'test.csv', mockFile);
    });
  });

  it('should load and ingest sample data when button is clicked', async () => {
    const sampleCsv = 'date,username,sku,unit_type,model,quantity\n2025-10-01,test-user-one,copilot_ai_credit,ai-credits,GPT-5,1';

    // Mock fetch to return the sample CSV as a blob.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([sampleCsv], { type: 'text/csv' })
    } as unknown as Response);

    mockStreamFile.mockResolvedValue(createMockIngestionResult([{ date: '2025-10-01', username: 'test-user-one', sku: 'copilot_ai_credit', unit_type: 'ai-credits', model: 'GPT-5', quantity: '1' }]));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    const sampleButton = screen.getByRole('button', { name: /try with sample data/i });
    await user.click(sampleButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/data\/ai-credits-example\.csv$/));
      expect(mockOnDataLoad).toHaveBeenCalledWith(
        expect.objectContaining({ rowsProcessed: 1 }),
        'ai-credits-example.csv',
        expect.any(File)
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

    mockStreamFile.mockResolvedValue(createMockIngestionResult([{ date: '2025-10-01', username: 'test-user-one', sku: 'copilot_ai_credit', unit_type: 'ai-credits', model: 'GPT-5', quantity: '1' }]));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);

    const sampleButton = screen.getByRole('button', { name: /try with sample data/i });
    await user.click(sampleButton);
    await user.click(sampleButton);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading sample data...');
    expect(screen.getByRole('button', { name: 'Drag & drop your CSV file here, or click to browse' })).toBeDisabled();

    resolveFetch!({
      ok: true,
      blob: async () => new Blob([sampleCsv], { type: 'text/csv' })
    } as unknown as Response);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(
        expect.objectContaining({ rowsProcessed: 1 }),
        'ai-credits-example.csv',
        expect.any(File)
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
    
    const testData = [{
      date: '2025-06-03',
      username: 'test-user-a',
      model: 'gpt-4.1-2025-04-14',
      quantity: '1.00',
      total_monthly_quota: 'Unknown',
      extra_column: 'extra_value'
    }];
    mockStreamFile.mockResolvedValue(createMockIngestionResult(testData));

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });
});
