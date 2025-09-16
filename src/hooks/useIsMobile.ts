import { useEffect, useState } from 'react';

/**
 * SSR-safe mobile viewport detection hook.
 * Uses a passive resize listener and matches against a configurable breakpoint (default 768px).
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Guard for SSR
    if (typeof window === 'undefined') return;

    const check = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
