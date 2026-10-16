"use client";
import React, { ReactNode } from 'react';
import { ChevronDownIcon } from '@primer/octicons-react';

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
    <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden" aria-labelledby={`${id}-header`}>
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 border-b border-(--borderColor-default) text-left hover:bg-(--control-transparent-bgColor-hover) transition-colors duration-150 flex items-center justify-between"
        aria-expanded={expanded}
        aria-controls={`${id}-content`}
        id={`${id}-header`}
      >
        <div>
          <h3 className="text-sm font-medium text-(--fgColor-default) flex items-center gap-2">
            {title}
            {badge}
          </h3>
          {subtitle && <p className="text-xs text-(--fgColor-muted) mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDownIcon
          size={16}
          className={`shrink-0 text-(--fgColor-muted) transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div id={`${id}-content`} className="overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
};
