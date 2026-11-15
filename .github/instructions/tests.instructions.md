---
applyTo: '**/__tests__/**/*.{ts,tsx}'
---

# Test Data Instructions

- Never use real or realistic PII in tests, fixtures, snapshots, or helpers.
- Treat usernames, org names, and cost center names as PII, even when shown in prompts/examples.
- Use generic values like `test-user-one`, `test-org-one`, and `test-cost-center-one`.
- Keep synthetic identifiers consistent within each test.
- Keep report fixtures within one calendar month, except fixtures explicitly testing
  multi-month upload rejection. Cover inactive boundary days with the report's full
  UTC billing-month timeline.
- Use `ingestRows` from `__tests__/helpers/aggregateRows.ts` for full-report fixtures
  instead of duplicating the registry/dispatch loop. Detail behavior tests should
  exercise precomputed scopes, including unassigned groups and missing token fields.
- Preserve the detail semantic goldens captured against the former re-stream path;
  update them only for intentional, explained behavior changes.
