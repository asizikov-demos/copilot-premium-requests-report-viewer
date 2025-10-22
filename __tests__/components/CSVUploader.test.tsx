import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CSVUploader } from '@/components/CSVUploader';
import { validCSVString, validCSVData } from '../fixtures/validCSVData';
import { invalidCSVData } from '../fixtures/invalidCSVData';
import { newFormatRows } from '../fixtures/newFormatCSVData';
import { createMockFile } from '../helpers/testUtils';

// Mock PapaParse
jest.mock('papaparse', () => ({
  parse: jest.fn((file, config) => {
    if (!file.name.endsWith('.csv')) {
      return;
    }
    setTimeout(() => {
      if (config.complete) {
        config.complete({
          data: [],
          errors: []
        });
      }
    }, 0);
  })
}));

describe('CSVUploader', () => {
  const mockOnDataLoad = jest.fn();
  const mockOnError = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render upload interface', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    expect(screen.getByText(/drag and drop your csv file here/i)).toBeInTheDocument();
    expect(screen.getByText(/choose file/i)).toBeInTheDocument();
    expect(screen.getByText(/upload csv file/i)).toBeInTheDocument();
  });

  it('should show supported CSV formats message', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    expect(screen.getByText(/Supported formats:/i)).toBeInTheDocument();
    expect(screen.getByText(/Legacy:/i)).toBeInTheDocument();
    expect(screen.getByText(/New:/i)).toBeInTheDocument();
  });
  it('should handle new-format CSV parsing', async () => {
    const mockFile = createMockFile('new-format.csv content', 'new-format.csv');
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: newFormatRows,
          errors: []
        });
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(expect.arrayContaining(newFormatRows), 'new-format.csv');
    });
  });

  it('should handle successful CSV parsing', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete({
          data: validCSVData,
          errors: []
        });
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(validCSVData, 'test.csv');
    });
  });

  it('should handle file validation errors for non-CSV files', async () => {
    const mockFile = createMockFile('test content', 'test.txt', 'text/plain');
    console.log('Created mock file:', mockFile);
    
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Use fireEvent instead of userEvent for file upload
    fireEvent.change(hiddenInput, {
      target: { files: [mockFile] }
    });

    // Should not call Papa.parse for non-CSV files
    expect(jest.requireMock('papaparse').parse).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Please select a CSV file');
    });
  });

  it('should handle missing required columns', async () => {
    const mockFile = createMockFile(invalidCSVData.missingColumns, 'test.csv');
    
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: [{ Timestamp: '2025-06-03T11:05:27Z', User: 'USerA', Model: 'gpt-4.1-2025-04-14' }],
          errors: []
        });
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('Missing required legacy columns')
      );
    });
  });

  it('should handle empty CSV files', async () => {
    const mockFile = createMockFile(invalidCSVData.emptyFile, 'empty.csv');
    
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: [],
          errors: []
        });
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
    
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: [],
          errors: [{ message: 'Parse error', type: 'Quotes', code: 'MissingQuotes', row: 1 }]
        });
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
    
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.error(new Error('File reading failed'));
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
    
    // Mock Papa.parse to not call complete immediately
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation(() => {
      // Don't call complete callback immediately
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    // Should show loading state
    expect(screen.getByText(/processing csv file/i)).toBeInTheDocument();
    expect(screen.getByText(/processing\.\.\./i)).toBeInTheDocument();
  });

  it('should handle drag and drop functionality', async () => {
    const mockFile = createMockFile(validCSVString, 'test.csv');
    
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: validCSVData,
          errors: []
        });
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const dropZone = screen.getByText(/drag and drop your csv file here/i).closest('div');
    
    // Test drop - this is the main functionality we care about
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [mockFile]
      }
    });

    await waitFor(() => {
      expect(mockOnDataLoad).toHaveBeenCalledWith(validCSVData, 'test.csv');
    });
  });

  it('should show privacy dialog when privacy button is clicked', async () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const privacyButton = screen.getByText(/privacy information/i);
    await user.click(privacyButton);
    
    expect(screen.getByText(/Your data is completely secure/i)).toBeInTheDocument();
    expect(screen.getByText(/This is a front-end only application/i)).toBeInTheDocument();
  });

  it('should close privacy dialog when close button is clicked', async () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const privacyButton = screen.getByText(/privacy information/i);
    await user.click(privacyButton);
    
    const closeButton = screen.getByRole('button', { name: /got it/i });
    await user.click(closeButton);
    
    expect(screen.queryByText(/Your data is completely secure/i)).not.toBeInTheDocument();
  });

  it('should show documentation link', () => {
    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    
    const docLink = screen.getByText(/how to obtain this report file/i);
    expect(docLink).toBeInTheDocument();
    expect(docLink.closest('a')).toHaveAttribute('href', expect.stringContaining('docs.github.com'));
  });

  it('should validate all required legacy columns are present (Timestamp present)', async () => {
    const mockFile = createMockFile(invalidCSVData.missingRequiredColumns, 'test.csv');
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: [{ Timestamp: '2025-06-03T11:05:27Z', User: 'USerA', Model: 'gpt-4.1-2025-04-14', 'Requests Used': '1.00' }],
          errors: []
        });
      }, 0);
    });

    render(<CSVUploader onDataLoad={mockOnDataLoad} onError={mockOnError} />);
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(hiddenInput, mockFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('Missing required legacy columns: Exceeds Monthly Quota, Total Monthly Quota')
      );
    });
  });

  it('should accept files with extra columns', async () => {
    const mockFile = createMockFile(invalidCSVData.extraColumns, 'test.csv');
    
    const parse = jest.requireMock('papaparse').parse;
    parse.mockImplementation((file, config) => {
      setTimeout(() => {
        config.complete?.({
          data: [{
            Timestamp: '2025-06-03T11:05:27Z',
            User: 'USerA',
            Model: 'gpt-4.1-2025-04-14',
            'Requests Used': '1.00',
            'Exceeds Monthly Quota': 'false',
            'Total Monthly Quota': 'Unlimited',
            'Extra Column': 'extra_value'
          }],
          errors: []
        });
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