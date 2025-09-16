"use client";
import React, { ReactNode, useState, useRef, useEffect } from 'react';

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
  const idRef = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);

  const show = () => {
    if (timerId) clearTimeout(timerId);
    setTimerId(setTimeout(() => setVisible(true), delay));
  };
  const hide = () => {
    if (timerId) clearTimeout(timerId);
    setVisible(false);
  };

  useEffect(() => {
    const node = triggerRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, []);

  return (
    <span
      className="relative inline-flex"
      ref={triggerRef}
      aria-describedby={visible ? idRef.current : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          id={idRef.current}
          role="tooltip"
            className={`pointer-events-none absolute z-50 px-2 py-1 rounded bg-gray-900 text-white text-xs shadow-lg whitespace-nowrap ${className} ${
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
