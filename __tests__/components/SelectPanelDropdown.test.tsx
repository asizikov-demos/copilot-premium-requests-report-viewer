import { fireEvent, render, screen } from '@testing-library/react';

import { SelectPanelDropdown } from '@/components/primitives/SelectPanelDropdown';

const options = [
  { value: '', label: 'All organizations' },
  { value: 'test-org-one', label: 'test-org-one' },
  { value: 'test-org-two', label: 'test-org-two' },
];

describe('SelectPanelDropdown', () => {
  it('filters options without losing the selected value and resets search on close', () => {
    const onChange = jest.fn();
    render(
      <SelectPanelDropdown
        label="Organization"
        options={options}
        value="test-org-one"
        onChange={onChange}
      />
    );

    const anchor = screen.getByRole('button', { name: 'Organization test-org-one' });
    fireEvent.click(anchor);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'TEST-ORG-TWO' } });
    expect(screen.getByRole('option', { name: 'test-org-two' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'test-org-one' })).not.toBeInTheDocument();
    expect(anchor).toHaveAccessibleName('Organization test-org-one');

    fireEvent.click(screen.getByRole('option', { name: 'test-org-two' }));
    expect(onChange).toHaveBeenCalledWith('test-org-two');
    fireEvent.click(anchor);
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('announces the current selection, including the empty-valued all option', () => {
    const { rerender } = render(
      <SelectPanelDropdown label="Organization" options={options} value="" onChange={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Organization All organizations' })).toBeInTheDocument();
    rerender(
      <SelectPanelDropdown label="Organization" options={options} value="test-org-two" onChange={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Organization test-org-two' })).toBeInTheDocument();
  });
});
