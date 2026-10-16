"use client";
import React, {
  ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  delay?: number; // ms
  className?: string;
}

const OFFSET_PX = 8;

const TRANSFORM_BY_SIDE: Record<TooltipSide, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
};

function getAnchorPoint(rect: DOMRect, side: TooltipSide): { top: number; left: number } {
  switch (side) {
    case 'bottom':
      return { top: rect.bottom + OFFSET_PX, left: rect.left + rect.width / 2 };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - OFFSET_PX };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + OFFSET_PX };
    case 'top':
    default:
      return { top: rect.top - OFFSET_PX, left: rect.left + rect.width / 2 };
  }
}

/**
 * Accessible, lightweight tooltip primitive (Primer Tooltip pattern).
 * - Shows on hover and keyboard focus; Esc dismisses (WCAG 1.4.13)
 * - Renders in a portal with fixed positioning so overflow-hidden containers cannot clip it
 * - Links the tooltip to the trigger element via aria-describedby
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delay = 150,
  className = ''
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = `tooltip-${useId()}`;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, []);

  useEffect(() => clearTimer, []);

  useLayoutEffect(() => {
    if (!visible) return;
    const updatePosition = () => {
      const node = triggerRef.current;
      if (node) setPosition(getAnchorPoint(node.getBoundingClientRect(), side));
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, side]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, hide]);

  const describedBy = visible ? tooltipId : undefined;
  const trigger = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { 'aria-describedby': describedBy })
    : children;

  return (
    <span
      className="inline-flex"
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {trigger}
      {visible && position && createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          style={{ position: 'fixed', top: position.top, left: position.left, transform: TRANSFORM_BY_SIDE[side] }}
          className={`pointer-events-none z-50 px-2.5 py-1.5 rounded-md bg-(--tooltip-bgColor) text-(--tooltip-fgColor) text-xs whitespace-nowrap max-w-xs ${className}`}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
};
