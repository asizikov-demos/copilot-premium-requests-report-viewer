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
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50"
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
          <header className="flex items-start justify-between p-4 border-b border-gray-200">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="ml-4 inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </header>
        )}
        <div className={`flex-1 overflow-y-auto p-4 ${contentClassName || ''}`}>{children}</div>
      </div>
    </div>
  );
};
