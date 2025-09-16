"use client";
import React, { ReactNode } from 'react';

interface ExpandableSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  badge?: ReactNode;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({ id, title, subtitle, expanded, onToggle, children, badge }) => {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden" aria-labelledby={`${id}-header`}>
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 border-b border-gray-200 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors flex items-center justify-between"
        aria-expanded={expanded}
        aria-controls={`${id}-content`}
        id={`${id}-header`}
      >
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            {title}
            {badge}
          </h3>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div id={`${id}-content`} className="overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
};
