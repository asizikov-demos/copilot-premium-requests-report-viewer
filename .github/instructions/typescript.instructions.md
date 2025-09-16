---
applyTo: '**/*.{ts,tsx}'
---

# TypeScript & Code Quality Instructions

The goal is to keep the codebase consistently **lint-clean**, **type-safe**, and **maintainable**.

## Core Principles
- Prefer **interfaces** over `type` aliases for object shapes exported across modules.
- Avoid `any`. If narrowing is incremental, use `unknown` first, then refine.
- Eliminate dead code: no unused imports, variables, parameters, or types.
- Keep exported surfaces minimal; avoid exporting things "just in case".
- Encode UI formatting logic in components — never embed HTML tags in data strings.

## JSX & Text Content
- Escape apostrophes and other special characters in JSX text to satisfy `react/no-unescaped-entities` (e.g., use `organization&apos;s`).

## Imports & Module Hygiene
- Group imports: external libs, absolute `@/` aliases, then relative paths — each group separated by a blank line when adding new blocks.
- Remove unused symbols immediately; if work-in-progress requires a placeholder, prefix variable with `_` to silence intentional unused warnings.
- Prefer named exports in utility modules; default exports reserved for React components when it improves DX (current project largely uses named).
