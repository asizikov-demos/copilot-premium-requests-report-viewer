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

  it('renders per-request billing advisory from weekly breakdown counts', () => {
    const { container } = render(
      <AdvisorySection
        userData={[
          { user: 'test-user-one', totalRequests: 80, modelBreakdown: { 'model-a': 80 } },
          { user: 'test-user-two', totalRequests: 85, modelBreakdown: { 'model-a': 85 } },
          { user: 'test-user-three', totalRequests: 10, modelBreakdown: { 'model-a': 10 } },
          { user: 'test-user-four', totalRequests: 5, modelBreakdown: { 'model-a': 5 } },
          { user: 'test-user-five', totalRequests: 5, modelBreakdown: { 'model-a': 5 } }
        ]}
        processedData={[]}
        weeklyExhaustion={{
          totalUsersExhausted: 3,
          weeks: [
            { weekNumber: 1, startDate: '2025-06-01', endDate: '2025-06-07', usersExhaustedInWeek: 1 },
            { weekNumber: 4, startDate: '2025-06-22', endDate: '2025-06-28', usersExhaustedInWeek: 1 },
            { weekNumber: 5, startDate: '2025-06-29', endDate: '2025-06-30', usersExhaustedInWeek: 1 }
          ]
        }}
      />
    );

    expect(screen.getByText('Consider Per-Request Billing for Power Users')).toBeInTheDocument();
    expect(container).toHaveTextContent('2 users (40%) exhaust their quota before day 28 of the month.');
  });
});
