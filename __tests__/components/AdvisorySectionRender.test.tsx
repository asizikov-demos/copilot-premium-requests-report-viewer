import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AdvisorySection } from '@/components/insights/AdvisorySection';

describe('AdvisorySection component', () => {
  it('renders No Action Required when no advisories produced', () => {
    render(
      <AdvisorySection
        userData={[]}
        processedData={[]}
        weeklyExhaustion={{ week1Exhausted: [], week2Exhausted: [], week3Exhausted: [], currentPeriodOnly: true }}
      />
    );
    expect(screen.getByText('No Action Required')).toBeInTheDocument();
  });
});
