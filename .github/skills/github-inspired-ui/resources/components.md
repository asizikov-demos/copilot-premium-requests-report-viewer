# Component Patterns

Interactive controls use `@primer/react`; icons use `@primer/octicons-react`. The app is wrapped in `PrimerProviders` (`src/app/providers.tsx`), so components work without extra setup. All custom colors are Primer tokens; see `color-system.md`.

## Adopted Primer React Components

| Need | Component | Used in |
| --- | --- | --- |
| Actions | `Button` (`variant="primary"` for the main CTA, `size="small"` inside cards and tables, `leadingVisual`/`trailingVisual` for Octicons) | `page.tsx`, `CSVUploader`, `InsightsOverview`, `AdvisorySection`, `UserCategoryTable`, `UsersOverview`, `CodingAgentOverview` |
| Icon-only actions | `IconButton` with a required `aria-label` | `UsersOverview`, `BillingGroupDetailsView` |
| Text actions inside tables and copy | `Link as="button" type="button"` | `UsersOverview`, `BillingGroupTable`, `AgentUsersTable` |
| Labelled fields | `FormControl` + `FormControl.Label` (add `visuallyHidden` when the context already names the field) | filters and searches |
| Text and search inputs | `TextInput` with `leadingVisual={SearchIcon}` | `UsersOverview`, `BillingGroupDetailsView`, `UserCategoryTable` |
| Single choice | `Select` + `Select.Option` | `UsersOverview`, `UserConsumptionMetrics` |
| Multiple choice | `Checkbox` inside a `fieldset` + `legend` | `DataAnalysis` billing periods |
| Error and status messages | `Banner` | `page.tsx` |
| Indeterminate loading | `Spinner` | `CSVUploader` |
| Determinate progress or meters | `ProgressBar` | `CSVUploader`, `UserDetailsHeader` |
| Section navigation | `NavList` (desktop) and `UnderlineNav` (mobile) | `DataAnalysis` |

Primer React CSS is not inside a cascade layer, so it beats Tailwind utilities for any property it sets. Pass layout utilities only (`min-w-56`, `max-w-full`, `flex-1`) through `className`. On `TextInput` and `Select` they land on the outer wrapper. Do not restyle Primer colors, padding or typography with Tailwind.

## Retained Custom Controls

Keep these hand-built. Their behavior is required and the Primer counterpart does not provide it:

| Control | Why it stays custom |
| --- | --- |
| `SortableColumnHeader` | Puts `aria-sort` on the `<th>` and a keyboard-focusable `<button>` inside it. The tables are not Primer `DataTable`. |
| Numbered pagination buttons | Primer `Pagination` renders anchors with hash links and disabled `<span>`s. Our pages are in-memory state and need real `<button>`s with `disabled`. Previous/next use `IconButton`. |
| Breadcrumb buttons | Primer `Breadcrumbs` renders links. Ours are `text-2xl` heading-sized buttons that change in-memory state. |
| `AdvisorySection` `<details>` | Native disclosure with no Primer equivalent. |
| CSV dropzone | Drag-and-drop file target wrapped around a hidden `<input type="file">`. |
| Insight category cards and mobile summary cards | Large card-shaped buttons. `InsightsOverview` returns focus to the card when the user goes back. |
| Compact sidebar notes (for example "Auto-selected …" in `DataAnalysis`) | A `Banner` is too large for the 224px sidebar. |
| Recharts charts and the feature-reach SVG | Data visualization. See `chart-styling.md`. |

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

Use `SortableColumnHeader` from `src/components/primitives/SortableColumnHeader.tsx`. It renders `<th scope="col" aria-sort>` wrapping a keyboard-focusable `<button>`, hides the arrow from assistive tech, and applies the selected background to the active column:

```tsx
<SortableColumnHeader
  label="Total AI Credits"
  active={sortField === 'totalCredits'}
  direction={sortDirection}
  onSort={() => handleSort('totalCredits')}
  className="min-w-32"
/>
```

Never put `onClick` directly on a `<th>`; it is not reachable by keyboard. Give non-sortable headers `scope="col"`.

## Labels / Counters (Primer: Label, CounterLabel)

No labels or counters exist today. If you add one, use Primer `Label` or `CounterLabel` from `@primer/react`.

## Buttons (Primer: Button, IconButton)

```tsx
import { Button, IconButton } from '@primer/react';
import { ArrowLeftIcon, ChevronLeftIcon, XIcon } from '@primer/octicons-react';

<Button variant="primary" size="large" onClick={loadSample}>Try with sample data</Button>
<Button leadingVisual={ArrowLeftIcon} onClick={onBack}>Back to overview</Button>
<Button size="small" onClick={toggle}>Show all</Button>
<IconButton icon={XIcon} variant="invisible" size="small" aria-label="Hide chart" onClick={hide} />
<IconButton icon={ChevronLeftIcon} variant="invisible" aria-label="Previous page" disabled={page === 1} onClick={prev} />
```

`Button` and `IconButton` default to `type="button"`. `IconButton` shows its `aria-label` as a Primer tooltip and names itself with `aria-labelledby`. Do not wrap it in another tooltip. In the dark app header, use a default `Button`.

## Banners / Callouts (Primer: Banner)

```tsx
import { Banner } from '@primer/react';

<Banner variant="critical" title="Error processing file" description={error} />
```

Use `variant` `critical`, `warning`, `success`, `info` or `upsell`. `Banner` adds the matching Octicon and heading.

Static explanatory notes inside cards may stay as token-styled boxes:

```tsx
<div className="p-4 rounded-md border border-(--borderColor-default) bg-(--bgColor-muted)">
  <p className="text-xs text-(--fgColor-muted)"><span className="font-semibold text-(--fgColor-default)">Note:</span> Description.</p>
</div>
```

## Tooltips

Use Primer's `Tooltip` from `@primer/react` for UI controls. Chart hover details use Recharts' `Tooltip`. `IconButton` already displays its accessible label as a tooltip, so do not wrap it in another tooltip.

## Breadcrumbs (custom; Primer: Breadcrumbs)

These stay as buttons because they change in-memory state and are heading-sized. See Retained Custom Controls.

```tsx
<nav aria-label="Breadcrumb">
  <ol className="flex items-center gap-2">
    <li><button onClick={onBack} className="text-2xl font-semibold tracking-tight text-(--fgColor-accent) hover:underline">users</button></li>
    <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-(--fgColor-muted)">/</li>
    <li aria-current="page" className="text-2xl font-semibold tracking-tight text-(--fgColor-default)">{name}</li>
  </ol>
</nav>
```

## Form Controls (Primer: FormControl, TextInput, Select)

```tsx
import { FormControl, Select, TextInput } from '@primer/react';
import { SearchIcon } from '@primer/octicons-react';

<FormControl>
  <FormControl.Label>Search users</FormControl.Label>
  <TextInput block size="large" leadingVisual={SearchIcon} className="min-w-56" value={query} onChange={e => setQuery(e.target.value)} />
</FormControl>

<FormControl>
  <FormControl.Label>Copilot Plan</FormControl.Label>
  <Select block size="large" className="min-w-56" value={plan} onChange={e => setPlan(e.target.value)}>
    <Select.Option value="all">All plans</Select.Option>
  </Select>
</FormControl>
```

- `FormControl` connects the label to the input. Do not add a redundant `aria-label`.
- When surrounding UI already names the field, keep the label for assistive tech with `<FormControl.Label visuallyHidden>`.
- `FormControl` lays out as a column aligned to the start. Use `block` to stretch an input across its column, and `className` (wrapper) for min/max widths.
- Use `size="large"` in filter bars and the default `medium` in compact card headers. Primer sets control heights from `--control-*-size`.

### Multiple selection (Primer: Checkbox)

Do not use `<select multiple>` for user-facing multi-select: it requires Ctrl/Cmd-click and is hard to discover. Use a `fieldset` of Primer checkboxes:

```tsx
<fieldset aria-describedby="period-hint" className="flex flex-col gap-1.5 text-sm">
  <legend className="font-medium text-(--fgColor-default)">Billing Period</legend>
  {options.map(o => (
    <label key={o.value} className="inline-flex items-center gap-2 text-(--fgColor-default)">
      <Checkbox value={o.value} checked={selected.includes(o.value)} onChange={toggle} />
      {o.label}
    </label>
  ))}
  <p id="period-hint" className="text-xs text-(--fgColor-muted)">Leave all unchecked to include every month</p>
</fieldset>
```

## Pagination (custom page buttons + IconButton)

Wrap the controls in `<nav aria-label="… pagination">`. Previous/next use `IconButton` with `ChevronLeftIcon`/`ChevronRightIcon`, `variant="invisible"` and labels such as "Previous page"/"Next page". Numbered page buttons stay hand-built because Primer `Pagination` renders hash links. Give each one `type="button"` and `aria-label="Page N"`, and give the current page `aria-current="page"`:

```tsx
<IconButton icon={ChevronLeftIcon} variant="invisible" aria-label="Previous page" disabled={page === 1} onClick={prev} />
<button type="button" aria-label="Page 1" aria-current="page" className="w-8 h-8 text-sm font-medium rounded-md border bg-(--bgColor-accent-emphasis) text-(--fgColor-onEmphasis) border-(--borderColor-accent-emphasis)">1</button>
<button type="button" aria-label="Page 2" className="w-8 h-8 text-sm font-medium rounded-md border border-(--borderColor-default) text-(--fgColor-muted) hover:bg-(--control-transparent-bgColor-hover)">2</button>
<span className="text-sm text-(--fgColor-muted)">1–25 of 142</span>
```

## Chart / Table Toggles

Use a single `Button size="small"` whose label names the next view ("Show Table", "Chart"). No segmented controls exist today. If you need one, use Primer `SegmentedControl`.

## Progress Bars and Loading (Primer: ProgressBar, Spinner)

```tsx
import { ProgressBar, Spinner } from '@primer/react';

<ProgressBar progress={pct} bg="accent.emphasis" aria-label="File processing progress" />
<ProgressBar barSize="small" progress={daysPercent} aria-label="Days active" aria-valuetext="19 of 31 days" className="flex-1" />
<Spinner size="medium" srText={null} className="text-(--fgColor-accent)" />
```

Always give `ProgressBar` an `aria-label`, and add `aria-valuetext` when the percentage alone is unclear. The default fill is the success color. Pass `srText={null}` to `Spinner` only when visible text already describes the loading state.

## Drill-Down Links (Primer: Link)

```tsx
import { Link } from '@primer/react';

<Link as="button" type="button" className="font-medium" onClick={() => onSelect(user)}>username</Link>
```

Set font size on the parent element. Primer's button-link CSS sets `font-size: inherit` and overrides `text-*` utilities.

## Empty States (Primer: Blankslate)

```tsx
<div className="flex items-center justify-center h-64 text-(--fgColor-muted) text-sm">No data available</div>
```

## Data-Semantic Text Colors

- **Discounts / savings:** `text-(--fgColor-success)` (discounts prefixed with `-$`)
- **Overages / alerts:** `text-(--fgColor-danger) font-medium`
- **Warnings:** `text-(--fgColor-attention)`
