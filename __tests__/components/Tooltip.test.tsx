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

  it('cancels a pending tooltip when Escape is pressed during the opening delay', () => {
    render(
      <Tooltip content="Helpful information">
        <button type="button">Trigger</button>
      </Tooltip>
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    act(() => jest.advanceTimersByTime(50));
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => jest.advanceTimersByTime(500));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('preserves the trigger existing aria-describedby and appends the tooltip id while open', () => {
    render(
      <>
        <p id="helper-text">Helper text</p>
        <Tooltip content="Helpful information">
          <button type="button" aria-describedby="helper-text">Trigger</button>
        </Tooltip>
      </>
    );

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('aria-describedby', 'helper-text');

    fireEvent.focus(trigger);
    act(() => jest.advanceTimersByTime(200));
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', `helper-text ${tooltip.id}`);

    fireEvent.blur(trigger);
    expect(trigger).toHaveAttribute('aria-describedby', 'helper-text');
  });
});
