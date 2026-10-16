'use client';

import { BaseStyles } from '@primer/react';
import { ThemeProvider } from '@primer/react/next';

// The light theme attributes live on <html>, so the provider only supplies context.
export function PrimerProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider colorMode="day" dayScheme="light" contextOnly>
      <BaseStyles>{children}</BaseStyles>
    </ThemeProvider>
  );
}
