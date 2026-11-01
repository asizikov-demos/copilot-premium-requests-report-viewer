'use client';

import { useId, useState } from 'react';
import { Button, FormControl, SelectPanel } from '@primer/react';
import type { SelectPanelItemInput } from '@primer/react';

export interface SelectPanelOption {
  label: string;
  value: string;
}

interface SelectPanelDropdownProps {
  label: string;
  options: SelectPanelOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  filterLabel?: string;
}

export function SelectPanelDropdown({
  label,
  options,
  value,
  onChange,
  className,
  filterLabel = 'Filter options',
}: SelectPanelDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const id = useId();
  const items = options.map(({ label, value: optionValue }) => ({
    id: optionValue,
    text: label,
  }));
  const selected = items.find((item) => item.id === value);

  return (
    <FormControl id={id}>
      <FormControl.Label as="span" id={`${id}-label`}>{label}</FormControl.Label>
      <div>
        <SelectPanel
          id={id}
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) setFilterValue('');
          }}
          items={items.filter((item) => item.text.toLowerCase().includes(filterValue.toLowerCase()))}
          selected={selected}
          onSelectedChange={(item: SelectPanelItemInput | undefined) => {
            if (item?.id !== undefined) onChange(String(item.id));
          }}
          filterValue={filterValue}
          onFilterChange={setFilterValue}
          placeholderText={filterLabel}
          inputLabel={filterLabel}
          textInputProps={{ leadingVisual: null }}
          disableFullscreenOnNarrow
          renderAnchor={(props) => (
            <Button {...props} aria-labelledby={`${id}-label ${id}-selected-value`} block size="large" className={className}>
              <span id={`${id}-selected-value`}>{props.children}</span>
            </Button>
          )}
        />
      </div>
    </FormControl>
  );
}
