---
name: github-inspired-ui
description: Build UI components that follow this project's Primer-based design language. Use this skill when creating or modifying any UI — components, pages, charts, tables, modals, or layouts. Ensures visual consistency with Primer Primitives design tokens (color, typography, size, shadow, focus) and the established interaction patterns across the application.
---

This skill encodes the design language for a Next.js data analytics dashboard. The aesthetic is **functional minimalism** — flat surfaces, subtle borders, restrained color, generous whitespace. The source of truth is GitHub's design system, **[Primer](https://primer.style/product/primitives/)**.

Design tokens come from [`@primer/primitives`](https://www.npmjs.com/package/@primer/primitives), imported once in `src/app/globals.css` (light theme only; `<html data-color-mode="light" data-light-theme="light">` in `src/app/layout.tsx` activates it).

## How to Use Tokens

| Context | Use | Example |
| --- | --- | --- |
| Tailwind `className` | Tailwind v4 CSS-variable shorthand with the Primer token name verbatim | `text-(--fgColor-muted)`, `bg-(--bgColor-muted)`, `border-(--borderColor-default)`, `shadow-(--shadow-resting-small)` |
| Tailwind with opacity | Opacity modifier on the token | `bg-(--data-blue-color-emphasis)/35` |
| JS / Recharts props / SVG attributes / data-driven inline styles | Helpers from `src/constants/primerTokens.ts` | `fill={fgColor.muted}`, `stroke={borderColor.muted}`, `dataVizColor('green')`, `dataVizScale('blue', 0.4)` |

Pick tokens by **role**, not by appearance: `fgColor-*` for text/icons, `bgColor-*` for surfaces, `borderColor-*` for borders, component tokens (`--button-primary-*`, `--progressBar-*`, `--tooltip-*`, `--header-*`, `--underlineNav-*`, `--control-*`) when building the matching component, and `--data-{hue}-color-*` for data visualization.

Detailed reference material lives in the `resources/` directory. **Load only the resources you need for the task at hand.**

---

## Decision Tree — What to Load

### Creating or modifying a chart / data visualization?
→ Load **`resources/chart-styling.md`**
  - Model colors via Primer data-viz hues, tooltip styles, axis/grid tokens, sequential scales, Recharts conventions, chart heights

### Building a new component (card, table, label, button, callout, form)?
→ Load **`resources/components.md`**
  - Cards, tables, labels/counters, buttons, banners, expandable sections, tooltips, breadcrumbs, form controls, pagination, segmented controls, progress bars, empty states, data-semantic text colors

### Working on page layout, navigation, or responsive design?
→ Load **`resources/layout.md`**
  - App header (Primer header tokens), sidebar + content, mobile underline nav, grids, info bar

### Need to pick colors, status variants, or understand the token system?
→ Load **`resources/color-system.md`**
  - Primer functional color tokens, status/severity map, data-viz hues, JS helpers

### Adjusting text styles, font sizes, or heading hierarchy?
→ Load **`resources/typography.md`**
  - Primer system font stack, text scale (12px minimum), `tabular-nums`

### Adding entrance animations or transitions?
→ Load **`resources/animations.md`**
  - 3 keyframe animations, stagger pattern, reduced-motion handling, transition conventions

### Working on icons, focus states, accessibility, or hover behavior?
→ Load **`resources/interaction.md`**
  - Primer focus outline, hover/selected tokens, icons, ARIA patterns

### Multiple concerns?
Load multiple resource files. For a brand-new page you'd typically need: `color-system.md` + `components.md` + `layout.md`.

---

## Anti-Patterns — Always Enforced

These rules apply regardless of the task. Do **not** load a resource file for these — they are always in effect:

1. **No hard-coded colors.** No hex, `rgb()`, or bracket colors (`bg-[#f6f8fa]`) and no Tailwind palette utilities (`bg-gray-100`, `text-indigo-600`, `text-emerald-600`, `bg-white`, `text-white`). Always use a Primer token. If no token fits, pick the closest semantic token — do not invent a color.
2. **No dark mode (yet).** Light theme only. Never add `dark:` prefixes; tokens will switch automatically once a dark theme is imported.
3. **Flat structural surfaces.** Cards/panels use a border and at most `shadow-(--shadow-resting-small)`. Overlays (tooltips, popovers, menus) use `shadow-(--shadow-floating-small)`. Form inputs use `shadow-(--shadow-inset)`. No Tailwind `shadow-sm/md/lg/xl`.
4. **No rounded-lg or rounded-xl.** Use `rounded-md` (6px = `--borderRadius-medium`). Exceptions: `rounded-full` for pills/counters/avatars, `rounded-sm` for small inline elements.
5. **No heavy borders on structural surfaces.** Preserve semantic indicators only, e.g. `border-l-[3px]` accent indicators and `border-b-2` active tabs.
6. **No gradient backgrounds** on structural elements. Gradients/scales only in data visualization.
7. **No custom fonts.** Use the Primer system font stack (`--fontStack-sansSerif`, `--fontStack-monospace`), already wired to Tailwind `font-sans`/`font-mono`. Do not load web fonts via `next/font`.
8. **No text smaller than 12px.** Minimum is `text-xs` (Primer `--text-body-size-small`). Never `text-[11px]` or `text-[10px]`. Charts use `fontSize: 12` for ticks/legends.
9. **Never remove focus indicators.** No `outline-none`/`focus:outline-none` and no custom `focus:ring-*`. The global Primer `*:focus-visible` outline in `globals.css` is the focus style. For text inputs, add `focus:border-(--borderColor-accent-emphasis)` on top.
10. **Inline `style` only for data-driven values.** Allowed for Recharts props, SVG attributes, `animationDelay`, widths/percentages, and colors computed from `primerTokens.ts` helpers (`getModelColor`, `dataVizScale`). Static colors belong in `className`.
11. **Respect reduced motion.** New animations must be covered by the `prefers-reduced-motion` block in `globals.css`.

## Future Direction

Primer React (`@primer/react`) components and Octicons are the long-term target for interactive widgets (NavList, DataTable, Tooltip, SelectPanel, SegmentedControl, Pagination, Banner, Label, ProgressBar, Button). Until they are adopted, hand-built components must mirror their Primer counterparts' tokens, states, and ARIA semantics so they can be swapped later.
