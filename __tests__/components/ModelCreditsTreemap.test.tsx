import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ModelCreditsTreemap } from '@/components/charts/ModelCreditsTreemap';
import { PrimerProviders, useAppTheme } from '@/app/providers';
import { bgColor, fgColor } from '@/constants/primerTokens';
import { getModelColor } from '@/utils/modelColors';

let mockChartSize = { width: 1200, height: 320 };

jest.mock('recharts', () => {
  const actual = jest.requireActual<typeof import('recharts')>('recharts');
  const { cloneElement } = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
      cloneElement(children, mockChartSize),
  };
});

describe('ModelCreditsTreemap', () => {
  beforeEach(() => {
    mockChartSize = { width: 1200, height: 320 };
  });

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
    expect(smallTile.querySelector('text')).not.toBeInTheDocument();

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

  it('keeps labels on neutral Primer surfaces instead of assuming a hue-specific text contrast', () => {
    render(
      <ModelCreditsTreemap data={[
        { fullModel: 'Claude Sonnet 4.5', credits: 50 },
        { fullModel: 'GPT-5', credits: 50 },
      ]} />
    );
    for (const name of ['Claude Sonnet 4.5', 'GPT-5']) {
      const tile = screen.getByRole('img', { name: new RegExp(`^${name}:`) });
      expect(tile.querySelector('text')).toHaveAttribute('fill', fgColor.default);
      expect(tile.querySelector('svg > rect')).toHaveAttribute('fill', bgColor.default);
    }
  });

  it('rounds large credit labels to two decimal places without rounding tile values', () => {
    render(<ModelCreditsTreemap data={[{ fullModel: 'test-model-one', credits: 32487904.53922278 }]} />);
    expect(screen.getByText('32,487,904.54 AI Credits')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('test-model-one: 32,487,904.54 AI Credits (100%)');
  });

  it('keeps the mounted chart, model hues and keyboard details when the theme changes', () => {
    function ThemeSwitch() {
      const { setTheme } = useAppTheme();
      return <button onClick={() => setTheme('dimmed')}>Switch theme</button>;
    }
    localStorage.clear();
    render(
      <PrimerProviders>
        <ThemeSwitch />
        <ModelCreditsTreemap data={[{ fullModel: 'GPT-5', credits: 50 }]} />
      </PrimerProviders>
    );
    const tile = screen.getByRole('img', { name: /GPT-5:/ });
    fireEvent.focus(tile);
    fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
    expect(screen.getByRole('img', { name: /GPT-5:/ })).toBe(tile);
    expect(tile.querySelector('rect')).toHaveAttribute('fill', getModelColor('GPT-5'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('GPT-5: 50.00 AI Credits');
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');
    expect(tile.querySelector('text')).toHaveAttribute('fill', fgColor.default);
    expect(tile.querySelector('svg > rect')).toHaveAttribute('fill', bgColor.default);
    localStorage.clear();
  });

  it('renders compact labels as clipped native SVG rather than HTML foreign objects', () => {
    mockChartSize = { width: 436, height: 288 };
    const { container } = render(<ModelCreditsTreemap data={[
      { fullModel: 'Claude Sonnet 4.5', credits: 38 },
      { fullModel: 'Claude Sonnet 4', credits: 17 },
      { fullModel: 'Coding Agent model', credits: 15 },
      { fullModel: 'Claude Opus 4.5', credits: 10 },
      { fullModel: 'Code Review model', credits: 10 },
      { fullModel: 'Claude Opus 4.1', credits: 8 },
      { fullModel: 'test-model-small', credits: 2 },
    ]} />);

    expect(container.querySelector('foreignObject')).not.toBeInTheDocument();
    const tile = screen.getByRole('img', { name: /^Claude Sonnet 4.5:/ });
    const viewport = tile.querySelector('svg')!;
    expect(viewport).toHaveAttribute('overflow', 'hidden');
    expect(viewport).toHaveAttribute('pointer-events', 'none');
    expect(viewport).toHaveAttribute('aria-hidden', 'true');
    expect(viewport.querySelector('text')).toHaveTextContent('Claude Sonnet 4.5');
    expect(viewport.querySelector('text')).toHaveAttribute('fill', fgColor.default);
    expect(viewport.querySelector('text')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(viewport.querySelector('rect')).toHaveAttribute('fill', bgColor.default);
    expect(Number(viewport.querySelector('rect')?.getAttribute('width'))).toBeLessThanOrEqual(Number(viewport.getAttribute('width')));
    expect(Number(viewport.querySelector('rect')?.getAttribute('height'))).toBeLessThanOrEqual(Number(viewport.getAttribute('height')));
    fireEvent.focus(tile);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Claude Sonnet 4.5: 38.00 AI Credits');
  });

  it('fits a single name line inside the shortest labeled tile', () => {
    mockChartSize = { width: 436, height: 48 };
    render(<ModelCreditsTreemap data={[{ fullModel: 'test-model-with-a-long-name', credits: 1 }]} />);
    const tile = screen.getByRole('img', { name: /^test-model-with-a-long-name:/ });
    const viewport = tile.querySelector('svg')!;
    expect(viewport.querySelectorAll('text')).toHaveLength(1);
    expect(viewport.querySelector('rect')).toHaveAttribute('height', '24');
    expect(viewport).toHaveAttribute('height', '32');
  });
});
