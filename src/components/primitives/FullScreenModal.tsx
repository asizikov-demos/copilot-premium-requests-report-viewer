"use client";
import React, { ReactNode, useEffect, useRef } from 'react';

interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  ariaDescriptionId?: string;
  /**
   * Provide a fully custom header (including close button). When supplied, the default header is skipped.
   * Implementers MUST ensure an element with id="modal-title" exists for accessibility if they want a title announced.
   */
  customHeader?: ReactNode;
  /**
   * Extra classes for content wrapper. Can be used to enable flex layouts for children (e.g. charts needing height).
   */
  contentClassName?: string;
}

/**
 * Accessible full-screen modal primitive.
 * - focus trap (simple: contain focus cycling)
 * - body scroll lock
 * - closes on ESC & overlay click
 */
export const FullScreenModal: React.FC<FullScreenModalProps> = ({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  ariaDescriptionId,
  customHeader,
  contentClassName
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<Element | null>(null);

  // Scroll lock
  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement;
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // focus handling
      const toFocus = initialFocusRef?.current || dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]') || dialogRef.current;
      toFocus?.focus();
      return () => {
        document.body.style.overflow = original;
        if (lastFocusedRef.current instanceof HTMLElement) {
          lastFocusedRef.current.focus();
        }
      };
    }
  }, [open, initialFocusRef]);

  // ESC handling
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        // rudimentary focus trap
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 backdrop-blur-sm"
      aria-hidden={false}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={ariaDescriptionId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative flex flex-col w-full h-full bg-white focus:outline-none"
        tabIndex={-1}
      >
        {customHeader ? (
          customHeader
        ) : (
          <header className="flex items-start justify-between px-5 py-4 border-b border-zinc-100">
            <h2 id="modal-title" className="text-lg font-semibold text-zinc-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="ml-4 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
        )}
        <div className={`flex-1 overflow-y-auto p-4 ${contentClassName || ''}`}>{children}</div>
      </div>
    </div>
  );
};
