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
  before applying row predicates; do not add month partitions or month-selection state.
- Build date-axis timelines with `buildBillingMonthDates(reportMonth)` using the
  report-wide `YYYY-MM` key. Preserve UTC source dates and observed `dateRange`.
