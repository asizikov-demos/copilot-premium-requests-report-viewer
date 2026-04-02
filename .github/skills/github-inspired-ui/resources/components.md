# Component Patterns

## Cards

The fundamental container. Always flat with a 1px border — never use heavy shadows.

```tsx
{/* Standard card */}
<div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
  {/* Card header */}
  <div className="px-5 py-4 border-b border-[#d1d9e0]">
    <h3 className="text-sm font-medium text-[#1f2328]">Title</h3>
    <p className="text-xs text-[#636c76] mt-0.5">Subtitle</p>
  </div>
  {/* Card body */}
  <div className="p-5">
    {/* content */}
  </div>
</div>
```

The CSS class `card-elevated` is also available (defined in `globals.css`):
```tsx
<div className="card-elevated px-8 py-10">
  {/* Uses white bg, 1px border, rounded-md, shadow-sm, hover transition */}
</div>
```

## Stat Cards

Colored category indicators within a card:

```tsx
{/* Success-tinted stat card */}
<div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-md">
  <p className="text-xs font-medium text-[#2da44e] uppercase tracking-[0.05em]">Label</p>
  <p className="text-2xl font-semibold text-[#1f2328] mt-1">42</p>
  <p className="text-xs text-[#2da44e] mt-0.5">Description</p>
</div>

{/* Warning-tinted stat card */}
<div className="p-4 bg-[#fffbeb] border border-[#fde68a] rounded-md">
  <p className="text-xs font-medium text-[#d97706] uppercase tracking-[0.05em]">Label</p>
  <p className="text-2xl font-semibold text-[#1f2328] mt-1">17</p>
</div>

{/* Neutral stat card with left accent border */}
<div className="p-4 bg-white border border-[#d1d9e0] rounded-md border-l-[3px] border-l-blue-500">
  <p className="text-xs font-medium text-[#636c76] uppercase tracking-[0.05em] mb-2">Feature</p>
  <p className="text-2xl font-semibold text-[#1f2328]">123</p>
  <p className="text-xs text-[#636c76] mt-1">Supporting detail</p>
</div>
```

## Tables

GitHub-style data tables:

```tsx
<table className="min-w-full">
  <thead>
    <tr className="border-b border-[#d1d9e0]">
      <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
        Column
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-[#d1d9e0]">
    <tr className="hover:bg-[#fcfdff] transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1f2328]">Cell</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#636c76]">Value</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">123.45</td>
    </tr>
  </tbody>
</table>
```

Key details:
- Header row: `bg-[#f6f8fa]`, 11px uppercase, semibold, wider tracking
- Body rows: white bg, hover → `#fcfdff`, 150ms transition
- Numeric/monetary cells: right-aligned, `font-mono`
- First column (identifier): `font-medium text-[#1f2328]`
- Other columns: `text-[#636c76]`

## Badges / Pills

```tsx
{/* Status badge (in a table cell or inline) */}
<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#f0fdf4] border border-[#bbf7d0] text-[#2da44e]">
  95.2%
</span>

{/* Count badge (attached to a title) */}
<span className="ml-3 px-2 py-0.5 text-xs font-medium rounded-md bg-white border border-[#d1d9e0] text-[#d97706]">
  12 users
</span>

{/* Full-width pill (CSS class from globals.css) */}
<span className="badge badge-amber">Warning Label</span>
<span className="badge badge-blue">Info Label</span>
```

Badge CSS from globals.css:
- `.badge`: `inline-flex, items-center, px-3, py-1, rounded-full, text-xs, font-medium, tracking-[0.01em]`
- `.badge-amber`: amber bg `#fef3c7`, text `#92400e`, border `#fcd34d`
- `.badge-blue`: blue bg `#dbeafe`, text `#1e40af`, border `#93c5fd`

## Buttons

```tsx
{/* Primary (green) — for main CTAs */}
<button className="px-5 py-2.5 text-sm font-semibold text-white bg-[#2da44e] hover:bg-[#2c974b] border border-[#2da44e] hover:border-[#2c974b] rounded-md transition-all duration-150">
  Action
</button>

{/* Secondary (ghost) — for back/cancel/minor actions */}
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#636c76] bg-white border border-[#d1d9e0] rounded-md hover:bg-[#f6f8fa] hover:border-[#d1d9e0] transition-colors duration-150">
  <svg className="w-4 h-4" .../>
  Back
</button>
```

## Callout / Alert Boxes

```tsx
{/* Success callout */}
<div className="p-5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-md">
  <div className="flex items-start gap-3">
    <div className="w-10 h-10 rounded-md bg-[#2da44e] flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-white" .../>
    </div>
    <div>
      <p className="font-semibold text-[#2da44e]">Headline</p>
      <p className="text-sm text-[#1f2328] mt-1">Description text.</p>
      <p className="text-xs text-[#2da44e] mt-2 italic">Disclaimer or footnote.</p>
    </div>
  </div>
</div>

{/* Info callout */}
<div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-md p-4">
  <h4 className="text-xs font-medium text-[#6366f1] mb-0.5">Title</h4>
  <p className="text-xs text-[#6366f1] opacity-80">Description.</p>
</div>

{/* Neutral note */}
<div className="p-4 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
  <p className="text-xs text-[#636c76]">
    <span className="font-semibold text-[#1f2328]">Note:</span> Description text.
  </p>
</div>
```

## Expandable Sections

Use the `ExpandableSection` primitive from `src/components/primitives/ExpandableSection.tsx`:

```tsx
<ExpandableSection
  id="section-id"
  title="Section Title"
  subtitle="Optional subtitle text"
  expanded={isExpanded}
  onToggle={() => setIsExpanded(e => !e)}
  badge={<span className="badge badge-blue">3</span>}
>
  {/* Content rendered when expanded */}
</ExpandableSection>
```

Pattern: white card with border, clickable header with chevron rotation, content area below.

## Tooltips

Use the `Tooltip` primitive from `src/components/primitives/Tooltip.tsx`:

```tsx
<Tooltip content="Helpful information" side="top">
  <span>Hover me</span>
</Tooltip>
```

Tooltip appearance: dark bg `#24292f`, white text, `text-xs`, rounded-md, max-w-xs.

## Breadcrumbs

GitHub-style breadcrumb navigation with copy-to-clipboard:

```tsx
<nav aria-label="Breadcrumb">
  <ol className="flex items-center gap-2">
    <li>
      <button
        onClick={onBack}
        className="text-2xl font-semibold tracking-tight text-[#0969da] hover:underline"
      >
        users
      </button>
    </li>
    <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-[#8c959f]">/</li>
    <li>
      <button
        onClick={handleCopy}
        title="Click to copy"
        className="text-2xl font-semibold tracking-tight text-[#1f2328] hover:text-indigo-600 transition-colors duration-150 inline-flex items-center gap-2 group"
      >
        {name}
        <svg className="w-5 h-5 text-[#636c76] group-hover:text-indigo-600 transition-colors duration-150" .../>
      </button>
    </li>
  </ol>
</nav>
```

Key details:
- Back link: `text-[#0969da]` (GitHub blue), `hover:underline`
- Separator: `text-[#8c959f]`
- Current item: same size as page title, with copy icon that changes color on `group-hover`

## Filter Dropdowns

```tsx
<div className="flex flex-col gap-1.5 text-sm text-[#636c76]">
  <label className="font-medium text-[#1f2328]">Label</label>
  <select className="min-w-56 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
    <option>All</option>
  </select>
</div>
```

## Sortable Table Headers

```tsx
<th
  onClick={toggleSort}
  className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150"
>
  Column {sortIndicator}  {/* ↓ ↑ or ↕ */}
</th>
```

Active sort column uses `bg-[#eef1f4]` instead of `bg-[#f6f8fa]`.

## Pagination

```tsx
{/* Page number buttons */}
<button className="w-8 h-8 text-sm font-medium rounded-md border transition-colors duration-150 bg-indigo-500 text-white border-indigo-500">
  1  {/* active */}
</button>
<button className="w-8 h-8 text-sm font-medium rounded-md border border-[#d1d9e0] text-[#636c76] hover:bg-[#f6f8fa]">
  2  {/* inactive */}
</button>

{/* "Showing X–Y of Z" label */}
<span className="text-sm text-[#636c76]">1–25 of 142</span>
```

## Segmented Control (chart/table toggle)

```tsx
<div className="flex bg-white border border-[#d1d9e0] rounded-md p-0.5">
  <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-500 text-white">
    Chart
  </button>
  <button className="px-3 py-1.5 text-sm font-medium rounded-md text-[#636c76] hover:text-[#1f2328]">
    Table
  </button>
</div>
```

## Drill-Down Links (clickable data)

For user names or items that navigate to a detail view:

```tsx
<button className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
  username
</button>
```

## Empty States

```tsx
<div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
  No data available
</div>
```

## Data-Semantic Text Colors

These specific Tailwind utilities are approved for data values:
- **Discounts:** `text-emerald-600` with `-$` prefix
- **Overages / alerts:** `text-red-600 font-medium`
- **Savings:** `font-semibold text-[#2da44e]`
