import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from '@/components/primitives/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders outside clipping containers and describes the focused trigger', () => {
    render(
      <div data-testid="clipping-card" style={{ overflow: 'hidden' }}>
        <Tooltip content="Helpful information">
          <button type="button">Trigger</button>
        </Tooltip>
      </div>
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.focus(trigger);
    act(() => jest.advanceTimersByTime(200));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Helpful information');
    expect(within(screen.getByTestId('clipping-card')).queryByRole('tooltip')).not.toBeInTheDocument();
    expect(tooltip.style.position).toBe('fixed');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('dismisses with Escape while visible', () => {
    render(
      <Tooltip content="Helpful information">
        <button type="button">Trigger</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }).parentElement!);
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trigger' })).not.toHaveAttribute('aria-describedby');
  });
});
