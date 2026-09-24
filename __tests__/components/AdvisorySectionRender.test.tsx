import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdvisorySection } from '@/components/insights/AdvisorySection';
import type { Advisory } from '@/utils/analytics/advisory';

describe('AdvisorySection', () => {
  it('shows a neutral empty state rather than inferring healthy usage', () => {
    render(<AdvisorySection advisories={[]} onExplore={jest.fn()} />);
    expect(screen.getByText(/No adoption recommendations for this period/)).toBeInTheDocument();
    expect(screen.getByText('0 recommendations')).toBeInTheDocument();
  });

  it('keeps advice collapsed until requested and supports group exploration', async () => {
    const user = userEvent.setup();
    const onExplore = jest.fn();
    const advisory: Advisory = {
      type: 'training',
      severity: 'medium',
      title: 'Training opportunity',
      description: 'Ask about workflow fit.',
      actionItems: ['Offer office hours.'],
      affectedUsers: 2,
    };
    render(<AdvisorySection advisories={[advisory]} onExplore={onExplore} />);
    expect(screen.getByText('1 recommendation')).toBeInTheDocument();
    expect(screen.getByText(advisory.title).closest('details')).not.toHaveAttribute('open');
    await user.click(screen.getByText(advisory.title));
    expect(screen.getByText(advisory.title).closest('details')).toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: /Explore low-adoption users/ }));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});
