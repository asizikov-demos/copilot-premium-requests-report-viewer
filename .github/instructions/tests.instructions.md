---
applyTo: '**/__tests__/**/*.{ts,tsx}'
---

# Test Data Instructions

- Never use real or realistic PII in tests, fixtures, snapshots, or helpers.
- Treat usernames, org names, and cost center names as PII, even when shown in prompts/examples.
- Use generic values like `test-user-one`, `test-org-one`, and `test-cost-center-one`.
- Keep synthetic identifiers consistent within each test.
