'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BaseStyles } from '@primer/react';
import { ThemeProvider } from '@primer/react/next';

type AppTheme = 'light' | 'dimmed';

interface AppThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const STORAGE_KEY = 'copilot-billing-theme';
const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

function applyDocumentTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.dataset.colorMode = theme === 'dimmed' ? 'dark' : 'light';
  root.dataset.lightTheme = 'light';
  root.dataset.darkTheme = 'dark_dimmed';
  root.style.colorScheme = theme === 'dimmed' ? 'dark' : 'light';
}

export function PrimerProviders({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    let restoredTheme: AppTheme = 'light';
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'dimmed') restoredTheme = 'dimmed';
    } catch (error) {
      console.warn('Unable to read the saved theme preference.', error);
    }
    applyDocumentTheme(restoredTheme);
    // Restore browser-only state after the deterministic static-export render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(restoredTheme);
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    applyDocumentTheme(nextTheme);
    setThemeState(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      console.warn('Unable to save the theme preference.', error);
    }
  }, []);

  useEffect(() => {
    // Print on light surfaces even when the browser omits background graphics.
    const beforePrint = () => applyDocumentTheme('light');
    const afterPrint = () => applyDocumentTheme(theme);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <AppThemeContext.Provider value={value}>
      <ThemeProvider colorMode={theme === 'dimmed' ? 'night' : 'day'} dayScheme="light" nightScheme="dark_dimmed" contextOnly>
        <BaseStyles>{children}</BaseStyles>
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used within PrimerProviders');
  return context;
}
