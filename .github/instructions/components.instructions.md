---
applyTo: 'src/components/**/*.tsx'
---

# Naming Conventions

- For Modal components, use the suffix `Modal` (e.g., `UserConsumptionModal.tsx`).
- For Overview components, use the suffix `Overview` (e.g., `UsersOverview.tsx`).

# Drill-down Data

- User and billing-group detail views render synchronously from
  `AnalysisContext.detailPagesArtifacts`. Memoize selected-scope selectors.
- Do not add detail loading workers, re-streaming, File caches, or raw-row props.
