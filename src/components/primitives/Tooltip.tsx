"use client";
import React, { ReactNode, useState, useRef, useEffect, useCallback, useId } from 'react';
interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // ms
  className?: string;
}

/**
 * Accessible, lightweight tooltip primitive.
 * - Uses focus + hover to show
 * - Esc to dismiss while focused
 * - Positions with basic CSS (no portal yet for simplicity)
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delay = 150,
  className = ''
}) => {
  const [visible, setVisible] = useState(false);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const reactId = useId();
  const tooltipId = `tooltip-${reactId}`;

  const show = useCallback(() => {
    if (timerId) clearTimeout(timerId);
    setTimerId(setTimeout(() => setVisible(true), delay));
  }, [timerId, delay]);
  const hide = useCallback(() => {
    if (timerId) clearTimeout(timerId);
    setVisible(false);
  }, [timerId]);

  useEffect(() => {
    const node = triggerRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [hide]);

  return (
    <span
      className="relative inline-flex"
      ref={triggerRef}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-50 px-2.5 py-1.5 rounded-md bg-[#24292f] text-white text-xs shadow-sm whitespace-nowrap max-w-xs ${className} ${
            side === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : ''
          } ${side === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' : ''} ${
            side === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2' : ''
          } ${side === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2' : ''}`}
        >
          {content}
        </span>
      )}
    </span>
  );
};
