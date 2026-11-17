import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@primer/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';

import { PrimerProviders, useAppTheme } from '@/app/providers';

function ThemeConsumer() {
  const { theme, setTheme } = useAppTheme();
  const { colorScheme } = useTheme();
  const [filter, setFilter] = useState('');
  return (
    <>
      <button onClick={() => setTheme(theme === 'light' ? 'dimmed' : 'light')}>{theme}</button>
      <output aria-label="Primer scheme">{colorScheme}</output>
      <input aria-label="Report filter" value={filter} onChange={(event) => setFilter(event.target.value)} />
    </>
  );
}

describe('PrimerProviders', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-color-mode');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('renders deterministic light markup without reading browser storage on the server', () => {
    const read = jest.spyOn(Storage.prototype, 'getItem');
    localStorage.setItem('copilot-billing-theme', 'dimmed');
    expect(renderToString(<PrimerProviders><ThemeConsumer /></PrimerProviders>)).toContain('light');
    expect(read).not.toHaveBeenCalled();
  });

  it('synchronizes root attributes, native controls and Primer without losing report state', () => {
    render(<PrimerProviders><ThemeConsumer /></PrimerProviders>);
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test-filter' } });
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');
    expect(document.documentElement).toHaveAttribute('data-light-theme', 'light');
    expect(document.documentElement).toHaveAttribute('data-dark-theme', 'dark_dimmed');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(screen.getByLabelText('Primer scheme')).toHaveTextContent('dark_dimmed');
    expect(screen.getByRole('textbox')).toHaveValue('test-filter');
    expect(localStorage.getItem('copilot-billing-theme')).toBe('dimmed');
    fireEvent.click(screen.getByRole('button', { name: 'dimmed' }));
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'light');
    expect(screen.getByLabelText('Primer scheme')).toHaveTextContent('light');
    expect(localStorage.getItem('copilot-billing-theme')).toBe('light');
  });

  it('restores a saved dimmed preference after mounting and on a subsequent visit', () => {
    localStorage.setItem('copilot-billing-theme', 'dimmed');
    const first = render(<PrimerProviders><ThemeConsumer /></PrimerProviders>);
    expect(screen.getByRole('button', { name: 'dimmed' })).toBeInTheDocument();
    first.unmount();
    render(<PrimerProviders><ThemeConsumer /></PrimerProviders>);
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');
    expect(screen.getByLabelText('Primer scheme')).toHaveTextContent('dark_dimmed');
  });

  it('ignores unrecognized saved preferences', () => {
    localStorage.setItem('copilot-billing-theme', 'invalid-theme');
    render(<PrimerProviders><ThemeConsumer /></PrimerProviders>);
    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'light');
  });

  it('warns about unavailable storage but keeps theme switching usable', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    render(<PrimerProviders><ThemeConsumer /></PrimerProviders>);
    expect(warning).toHaveBeenCalledWith('Unable to read the saved theme preference.', expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(warning).toHaveBeenCalledWith('Unable to save the theme preference.', expect.any(Error));
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');
    expect(screen.getByLabelText('Primer scheme')).toHaveTextContent('dark_dimmed');
  });

  it('prints with light tokens and restores dimmed without changing the saved preference', () => {
    localStorage.setItem('copilot-billing-theme', 'dimmed');
    const view = render(<PrimerProviders><ThemeConsumer /></PrimerProviders>);
    fireEvent(window, new Event('beforeprint'));
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'light');
    expect(localStorage.getItem('copilot-billing-theme')).toBe('dimmed');
    fireEvent(window, new Event('afterprint'));
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');
    view.unmount();
    fireEvent(window, new Event('beforeprint'));
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');
  });
});
