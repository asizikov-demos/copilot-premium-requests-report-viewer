import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ModelCreditsTreemap } from '@/components/charts/ModelCreditsTreemap';
import { getModelColor } from '@/utils/modelColors';

jest.mock('recharts', () => {
  const actual = jest.requireActual<typeof import('recharts')>('recharts');
  const { cloneElement } = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
      cloneElement(children, { width: 1200, height: 320 }),
  };
});

describe('ModelCreditsTreemap', () => {
  it('packs solid model-colored tiles across a wide container with areas proportional to credits', () => {
    const { container } = render(
      <ModelCreditsTreemap data={[
        { fullModel: 'GPT-5', credits: 25 },
        { fullModel: 'Claude Sonnet 4.5', credits: 75 },
        { fullModel: 'test-model-zero', credits: 0 },
      ]} />
    );

    const tiles = screen.getAllByRole('img');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveAccessibleName('Claude Sonnet 4.5: 75.00 AI Credits (75%)');
    expect(tiles[1]).toHaveAccessibleName('GPT-5: 25.00 AI Credits (25%)');
    const rectangles = tiles.map((tile) => tile.querySelector('rect')!);
    const areas = rectangles.map((rect) => Number(rect.getAttribute('width')) * Number(rect.getAttribute('height')));
    expect(areas[0] / areas[1]).toBeCloseTo(3);
    expect(areas[0] + areas[1]).toBeCloseTo(1200 * 320);
    expect(rectangles[0]).toHaveAttribute('fill', getModelColor('Claude Sonnet 4.5'));
    expect(rectangles[1]).toHaveAttribute('fill', getModelColor('GPT-5'));
    expect(container.querySelector('linearGradient')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('w-full', 'h-72', 'sm:h-80', '2xl:h-96');
    expect(container.firstChild).not.toHaveClass('aspect-square', 'max-w-[40rem]', 'mx-auto');
    expect(screen.queryByText('test-model-zero')).not.toBeInTheDocument();
  });

  it('keeps tiny fractional usage visible and exposes full details on hover and keyboard focus', async () => {
    const { container } = render(
      <ModelCreditsTreemap data={[
        { fullModel: 'test-model-large', credits: 1 },
        { fullModel: 'test-model-small-with-a-long-name', credits: 0.004 },
      ]} />
    );
    const smallTile = screen.getByRole('img', { name: /test-model-small-with-a-long-name:/ });
    const rectangle = smallTile.querySelector('rect')!;
    expect(Number(rectangle.getAttribute('width')) * Number(rectangle.getAttribute('height'))).toBeGreaterThan(0);
    expect(smallTile.querySelector('foreignObject')).not.toBeInTheDocument();

    fireEvent.focus(smallTile);
    expect(screen.getByRole('tooltip')).toHaveTextContent('test-model-small-with-a-long-name: 0.00 AI Credits');
    expect(smallTile).toHaveAccessibleDescription(/test-model-small-with-a-long-name/);
    fireEvent.blur(smallTile);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(smallTile.parentElement!);
    await waitFor(() => {
      expect(container.querySelector('.recharts-tooltip-wrapper')).toHaveTextContent('test-model-small-with-a-long-name');
      expect(container.querySelector('.recharts-tooltip-wrapper')).toHaveTextContent('0.00 AI Credits (0.4%)');
    });
  });

  it('shows an empty state when there is no positive credit usage', () => {
    const { rerender } = render(<ModelCreditsTreemap data={[]} />);
    expect(screen.getByText('No AI Credits usage for the selected filters.')).toBeInTheDocument();
    rerender(<ModelCreditsTreemap data={[{ fullModel: 'test-model-zero', credits: 0 }]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('No AI Credits usage for the selected filters.')).toBeInTheDocument();
  });

  it('fills the entire rectangle for a single model and updates when filtered data changes', () => {
    const { rerender } = render(
      <ModelCreditsTreemap data={[{ fullModel: 'test-model-one', credits: 12.5 }]} />
    );
    const tile = screen.getByRole('img', { name: 'test-model-one: 12.50 AI Credits (100%)' });
    expect(tile.querySelector('rect')).toHaveAttribute('width', '1200');
    expect(tile.querySelector('rect')).toHaveAttribute('height', '320');
    rerender(<ModelCreditsTreemap data={[{ fullModel: 'test-model-two', credits: 5 }]} />);
    expect(screen.getByRole('img', { name: 'test-model-two: 5.00 AI Credits (100%)' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /test-model-one:/ })).not.toBeInTheDocument();
  });

  it('uses a contrasting Primer foreground token for tile labels based on the model hue', () => {
    render(
      <ModelCreditsTreemap data={[
        { fullModel: 'Claude Sonnet 4.5', credits: 50 },
        { fullModel: 'GPT-5', credits: 50 },
      ]} />
    );
    const labelColor = (name: string) => screen.getByText(name, { selector: 'p' }).parentElement!.style.color;
    expect(labelColor('Claude Sonnet 4.5')).toBe('var(--fgColor-onEmphasis)');
    expect(labelColor('GPT-5')).toBe('var(--fgColor-default)');
  });

  it('rounds large credit labels to two decimal places without rounding tile values', () => {
    render(<ModelCreditsTreemap data={[{ fullModel: 'test-model-one', credits: 32487904.53922278 }]} />);
    expect(screen.getByText('32,487,904.54 AI Credits')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('test-model-one: 32,487,904.54 AI Credits (100%)');
  });
});
