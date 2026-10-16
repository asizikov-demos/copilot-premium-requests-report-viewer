# Component Patterns

Hand-built components mirror their Primer React counterparts (named in each heading) so they can be swapped for `@primer/react` later. All colors are Primer tokens — see `color-system.md`.

## Cards (Primer: Box)

```tsx
<div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
  <div className="px-5 py-4 border-b border-(--borderColor-default)">
    <h3 className="text-sm font-medium text-(--fgColor-default)">Title</h3>
    <p className="text-xs text-(--fgColor-muted) mt-0.5">Subtitle</p>
  </div>
  <div className="p-5">{/* content */}</div>
</div>
```

Hero/landing cards may add `shadow-(--shadow-resting-small)`.

## Stat Tiles

```tsx
{/* Status-tinted */}
<div className="p-4 rounded-md border border-(--borderColor-success-muted) bg-(--bgColor-success-muted)">
  <p className="text-xs font-medium text-(--fgColor-success) uppercase tracking-[0.05em]">Label</p>
  <p className="text-2xl font-semibold text-(--fgColor-default) mt-1 tabular-nums">42</p>
</div>

{/* Neutral with left accent indicator */}
<div className="p-4 bg-(--bgColor-default) border border-(--borderColor-default) rounded-md border-l-[3px] border-l-(--borderColor-accent-emphasis)">
  <p className="text-xs font-medium text-(--fgColor-muted) uppercase tracking-[0.05em] mb-2">Feature</p>
  <p className="text-2xl font-semibold text-(--fgColor-default) tabular-nums">123</p>
</div>
```

## Tables (Primer: DataTable)

```tsx
<table className="min-w-full">
  <thead>
    <tr className="border-b border-(--borderColor-default)">
      <th className="px-6 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
        Column
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-(--borderColor-muted)">
    <tr className="hover:bg-(--bgColor-muted) transition-colors duration-150">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-(--fgColor-default)">Cell</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-(--fgColor-muted) text-right tabular-nums">123.45</td>
    </tr>
  </tbody>
</table>
```

### Sortable headers

```tsx
<th aria-sort={sortDir === 'asc' ? 'ascending' : 'descending'} className="... bg-(--control-transparent-bgColor-selected)">
  <button type="button" onClick={toggleSort} className="inline-flex items-center gap-1">
    Column {sortIndicator}
  </button>
</th>
```

## Labels / Counters (Primer: Label, CounterLabel)

```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-(--borderColor-success-muted) bg-(--bgColor-success-muted) text-(--fgColor-success)">
  95.2%
</span>

<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-(--bgColor-neutral-muted) text-(--fgColor-default)">
  12
</span>
```

## Buttons (Primer: Button)

```tsx
{/* Primary — main CTA */}
<button className="px-5 py-2.5 text-sm font-semibold rounded-md border transition-all duration-150
  text-(--button-primary-fgColor-rest) bg-(--button-primary-bgColor-rest) border-(--button-primary-borderColor-rest)
  hover:bg-(--button-primary-bgColor-hover) active:bg-(--button-primary-bgColor-active)
  disabled:bg-(--button-primary-bgColor-disabled) disabled:text-(--button-primary-fgColor-disabled)">
  Action
</button>

{/* Default / secondary */}
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors duration-150
  text-(--button-default-fgColor-rest) bg-(--button-default-bgColor-rest) border-(--button-default-borderColor-rest)
  hover:bg-(--button-default-bgColor-hover)">
  Back
</button>
```

## Banners / Callouts (Primer: Banner)

```tsx
{/* Info */}
<div className="p-4 rounded-md border border-(--borderColor-accent-muted) bg-(--bgColor-accent-muted)">
  <h4 className="text-xs font-semibold text-(--fgColor-accent)">Title</h4>
  <p className="text-xs text-(--fgColor-default)">Description.</p>
</div>

{/* Error */}
<div className="p-4 rounded-md border border-(--borderColor-danger-muted) bg-(--bgColor-danger-muted) text-(--fgColor-danger)">
  Something went wrong.
</div>

{/* Neutral note */}
<div className="p-4 rounded-md border border-(--borderColor-default) bg-(--bgColor-muted)">
  <p className="text-xs text-(--fgColor-muted)"><span className="font-semibold text-(--fgColor-default)">Note:</span> Description.</p>
</div>
```

Swap `accent` for `success`, `attention`, `severe`, `danger`, or `done` as needed.

## Expandable Sections (Primer: Details)

Use `ExpandableSection` from `src/components/primitives/ExpandableSection.tsx`:

```tsx
<ExpandableSection id="section-id" title="Title" subtitle="Optional" expanded={isExpanded} onToggle={() => setIsExpanded(e => !e)}>
  {/* Content */}
</ExpandableSection>
```

## Tooltips (Primer: Tooltip)

Use `Tooltip` from `src/components/primitives/Tooltip.tsx` (`bg-(--tooltip-bgColor) text-(--tooltip-fgColor)`):

```tsx
<Tooltip content="Helpful information" side="top"><span>Hover me</span></Tooltip>
```

## Breadcrumbs (Primer: Breadcrumbs)

```tsx
<nav aria-label="Breadcrumb">
  <ol className="flex items-center gap-2">
    <li><button onClick={onBack} className="text-2xl font-semibold tracking-tight text-(--fgColor-accent) hover:underline">users</button></li>
    <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-(--fgColor-muted)">/</li>
    <li aria-current="page" className="text-2xl font-semibold tracking-tight text-(--fgColor-default)">{name}</li>
  </ol>
</nav>
```

## Form Controls (Primer: TextInput, Select, FormControl)

```tsx
<div className="flex flex-col gap-1.5 text-sm text-(--fgColor-muted)">
  <label htmlFor="filter" className="font-medium text-(--fgColor-default)">Label</label>
  <select id="filter" className="h-(--control-large-size) min-w-56 rounded-md border border-(--borderColor-default) bg-(--bgColor-default) px-3 py-2 text-sm text-(--fgColor-default) shadow-(--shadow-inset) transition duration-150 focus:border-(--borderColor-accent-emphasis)">
    <option>All</option>
  </select>
</div>
```

The Primer focus outline comes from `globals.css`; do not add `outline-none` or `focus:ring-*`.

Always set an explicit control height (`h-(--control-large-size)`, or `--control-medium-size` for compact UIs) on inputs and selects. Safari ignores padding on native `<select>` elements, so padding alone gives inconsistent heights. Do not set a fixed height on `<select multiple>` or listboxes with `size`; their row count determines the height.

## Pagination (Primer: Pagination)

```tsx
<button aria-current="page" className="w-8 h-8 text-sm font-medium rounded-md border bg-(--bgColor-accent-emphasis) text-(--fgColor-onEmphasis) border-(--borderColor-accent-emphasis)">1</button>
<button className="w-8 h-8 text-sm font-medium rounded-md border border-(--borderColor-default) text-(--fgColor-muted) hover:bg-(--control-transparent-bgColor-hover)">2</button>
<span className="text-sm text-(--fgColor-muted)">1–25 of 142</span>
```

## Segmented Control (Primer: SegmentedControl)

```tsx
<div className="flex bg-(--bgColor-muted) border border-(--borderColor-default) rounded-md p-0.5">
  <button aria-pressed="true" className="px-3 py-1.5 text-sm font-medium rounded-md bg-(--bgColor-default) text-(--fgColor-default) border border-(--borderColor-default)">Chart</button>
  <button aria-pressed="false" className="px-3 py-1.5 text-sm font-medium rounded-md text-(--fgColor-muted) hover:text-(--fgColor-default)">Table</button>
</div>
```

## Progress Bars (Primer: ProgressBar)

```tsx
<div className="h-1.5 rounded-full bg-(--progressBar-track-bgColor) overflow-hidden">
  <div className="h-full bg-(--progressBar-bgColor-success)" style={{ width: `${pct}%` }} />
</div>
```

## Drill-Down Links

```tsx
<button className="text-(--fgColor-accent) hover:underline font-medium">username</button>
```

## Empty States (Primer: Blankslate)

```tsx
<div className="flex items-center justify-center h-64 text-(--fgColor-muted) text-sm">No data available</div>
```

## Data-Semantic Text Colors

- **Discounts / savings:** `text-(--fgColor-success)` (discounts prefixed with `-$`)
- **Overages / alerts:** `text-(--fgColor-danger) font-medium`
- **Warnings:** `text-(--fgColor-attention)`
