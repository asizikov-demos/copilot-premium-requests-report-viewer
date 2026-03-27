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
    <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden" aria-labelledby={`${id}-header`}>
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 border-b border-[#d1d9e0] text-left hover:bg-[#f6f8fa] focus:outline-none transition-colors duration-150 flex items-center justify-between"
        aria-expanded={expanded}
        aria-controls={`${id}-content`}
        id={`${id}-header`}
      >
        <div>
          <h3 className="text-sm font-medium text-[#1f2328] flex items-center gap-2">
            {title}
            {badge}
          </h3>
          {subtitle && <p className="text-xs text-[#636c76] mt-0.5">{subtitle}</p>}
        </div>
        <svg
          className={`w-4 h-4 text-[#636c76] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
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
