---
description: |
  Weekly and manual code duplication audit that groups reusable-code findings
  into atomic implementation issues for Copilot.

on:
  workflow_dispatch:
  schedule: weekly on friday around 9am

permissions: read-all

network: defaults

safe-outputs:
  create-issue:
    title-prefix: "[duplication] "
    labels: [enhancement]
    assignees: [copilot]
    max: 8
    group: true
    expires: false

tools:
  github:
    toolsets: [issues, repos]
  bash:
    - find
    - grep
    - sed
    - awk
    - sort
    - uniq
    - head
    - tail
    - wc
    - git status
    - git grep
    - node

timeout-minutes: 20
---

# Code Duplication Scan

Scan `${{ github.repository }}` for duplicated logic and missed code reuse opportunities. This workflow runs every Friday and can also be started manually.

## Goal

Create implementation-ready GitHub issues for code duplication findings. Each issue must describe one atomic root problem that an AI coding agent can fix independently.

## Repository instructions

Before scanning, read and follow:

- `AGENTS.md`
- `.github/instructions/typescript.instructions.md`
- `.github/instructions/components.instructions.md`

Pay special attention to billing date handling, pricing/quota constants, optional commercial CSV fields, and organization/cost center support.

## Scan protocol

1. Inspect the current repository structure and changed source areas.
2. Focus on duplicated logic, not cosmetic duplication. Prioritize duplication that can cause behavior drift, inconsistent billing/date handling, or maintenance risk.
3. Compare these areas:
   - `src/utils/analytics/*`
   - `src/utils/ingestion/*`
   - `src/hooks/*`
   - `src/components/*`
   - `__tests__/helpers/*`, `__tests__/fixtures/*`, and repeated test setup/builders
4. Look for repeated:
   - CSV row parsing and normalization
   - quota parsing and quota breakdown classification
   - date/month/week bucketing and UTC date formatting
   - product/model classification
   - user/model/cost aggregation loops
   - overage and pricing calculations
   - table/card/chart/filter UI primitives
   - test artifact and processed-data builders
5. Search existing open issues with the `[duplication]` title prefix before creating a new issue. Do not create a duplicate if an open issue already covers the same root problem.

## Finding grouping rules

A finding group is atomic when it has one root problem and one coherent implementation path.

Good atomic groups:

- "Centralize CSV row to ProcessedData conversion"
- "Replace inline coding-agent model checks with productClassification helpers"
- "Extract shared date/month/week bucketing helpers"

Bad groups:

- "Clean up all duplication everywhere"
- "Refactor analytics and UI"
- "Improve code quality"

If multiple files duplicate the same logic, group them into one issue. If two findings require unrelated changes or touch unrelated abstractions, create separate issues.

## Issue creation criteria

Create an issue only when all of these are true:

- The duplicated logic is present in two or more places.
- The duplication has a plausible maintenance, correctness, or testability impact.
- The fix can be described as one bounded implementation task.
- You can name specific files, functions, or components as evidence.

Skip findings that are only repeated styling classes, normal React markup, or test assertions unless they hide duplicated behavior or create meaningful maintenance overhead.

## Issue template

For each issue, use this structure:

```markdown
## Problem
[One concise paragraph describing the duplicated logic and why it matters.]

## Evidence
- `[file path]` - [function/component/line area and duplicated behavior]
- `[file path]` - [function/component/line area and duplicated behavior]

## Suggested implementation
1. [Specific refactor step]
2. [Specific wiring/update step]
3. [Specific cleanup step]

## Acceptance criteria
- [ ] The duplicated logic has a single source of truth.
- [ ] Existing behavior is preserved.
- [ ] Billing date handling remains UTC-safe and does not use local timezone conversion.
- [ ] Pricing/quota values continue to come from `src/constants/pricing.ts` when applicable.
- [ ] Relevant tests are updated or added.

## Validation
- [Commands or existing test suites the implementation agent should run.]

## AI implementation notes
[Mention key constraints, edge cases, and files likely involved. Make this detailed enough for Copilot to implement without rediscovering the entire context.]
```

## Output behavior

- Create up to 8 issues per run.
- Assign created issues to Copilot through the configured safe output, using the callable tool name `create_issue`.
- Prefer fewer high-quality issues over many low-value issues.
- If no actionable duplication is found, do not create any issue; finish with a no-op summary.
