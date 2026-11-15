---
applyTo: '**/*.{ts,tsx}'
---

# TypeScript Instructions

- Prefer interfaces for exported object shapes.
- Avoid `any`; use `unknown` and narrow.
- Remove unused imports, variables, parameters, and types.
- Keep exports minimal.
- Keep UI formatting in components, not data strings.
- Escape JSX apostrophes/entities, e.g. `organization&apos;s`.
- Group imports: external, `@/`, relative; separate groups with blank lines.
- Prefer named exports for utilities; default exports are acceptable for React components.
- Reports cover one calendar month. Validate the source date month during ingestion
  before skipping unsupported or malformed rows; do not add month partitions or month-selection state.
- Build date-axis timelines with `buildBillingMonthDates(reportMonth)` using the
  report-wide `YYYY-MM` key. Preserve UTC source dates and observed `dateRange`.
- Precompute drill-down aggregates in the initial streaming pass through `detailPages`.
  Never retain parsed rows or the uploaded File for later re-parsing. Keep only
  occupied keyed totals and packed numeric cells; derive sorted/padded presentation
  rows and percentages in selected-scope selectors, not for every user at upload.
