import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AdvisorySection } from '@/components/insights/AdvisorySection';

describe('AdvisorySection component', () => {
  it('renders No Action Required when no advisories produced', () => {
    render(
      <AdvisorySection
        userData={[]}
        processedData={[]}
        weeklyExhaustion={{ totalUsersExhausted: 0, weeks: [] }}
      />
    );
    expect(screen.getByText('No Action Required')).toBeInTheDocument();
  });
});
