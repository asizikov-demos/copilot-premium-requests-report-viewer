---
name: github-inspired-ui
description: Build UI components that follow this project's GitHub-inspired design language. Use this skill when creating or modifying any UI — components, pages, charts, tables, modals, or layouts. Ensures visual consistency with the established color tokens, spacing, typography, and interaction patterns across the application.
---

This skill encodes the design language for a Next.js data analytics dashboard. The aesthetic is **functional minimalism** — flat surfaces, subtle borders, restrained color, generous whitespace. Think GitHub's own UI.

Detailed reference material lives in the `resources/` directory. **Load only the resources you need for the task at hand.**

---

## Decision Tree — What to Load

Determine which resource files to read based on the task:

### Creating or modifying a chart / data visualization?
→ Load **`resources/chart-styling.md`**
  - Model & user color palettes, tooltip styles, axis/grid colors, heatmap gradient, Recharts conventions, responsive chart heights

### Building a new component (card, table, badge, button, callout, form)?
→ Load **`resources/components.md`**
  - Cards, stat cards, tables, badges/pills, buttons, callouts, expandable sections, tooltips, breadcrumbs, dropdowns, pagination, segmented controls, sortable headers, drill-down links, empty states, data-semantic text colors

### Working on page layout, navigation, or responsive design?
→ Load **`resources/layout.md`**
  - App header (dark bar), sidebar + content structure, mobile tab nav, grid patterns, info bar

### Need to pick colors, status variants, or understand the token system?
→ Load **`resources/color-system.md`**
  - All CSS custom properties, severity/status color map (success/warning/error/info/neutral), Tailwind bracket notation rules

### Adjusting text styles, font sizes, or heading hierarchy?
→ Load **`resources/typography.md`**
  - Inter & Geist Mono fonts, full text scale table, `tabular-nums` and `display-heading` usage

### Adding entrance animations or transitions?
→ Load **`resources/animations.md`**
  - 4 keyframe animations (`fadeInUp`, `scaleIn`, `slideInRight`, `countUp`), stagger delay patterns, transition conventions

### Working on icons, focus states, accessibility, or hover behavior?
→ Load **`resources/interaction.md`**
  - Heroicons conventions, focus ring, hover states, ARIA patterns, scrollbar styling

### Multiple concerns?
Load multiple resource files. For a brand-new page you'd typically need: `color-system.md` + `components.md` + `layout.md`.

---

## Anti-Patterns — Always Enforced

These rules apply regardless of the task. Do **not** load a resource file for these — they are always in effect:

1. **No dark mode.** Light-only. Never add `dark:` prefixes.
2. **No shadow elevation hierarchy on structural surfaces.** Card/panel shadows are identical and flat (`0 1px 3px rgba(31,35,40,0.04)`). No `shadow-lg` or `shadow-xl` on cards or containers. Stronger shadows are allowed for overlays and tooltips (e.g., chart tooltip uses `0 4px 12px rgba(31,35,40,0.12)`).
3. **No generic Tailwind color utilities** (`bg-gray-100`, `text-gray-600`). Use exact hex tokens via bracket notation (`bg-[#f6f8fa]`). Exceptions: `indigo-500/600` (matches `--accent`), `emerald-600` (discount amounts), `red-600` (overage/alert amounts), `blue-500`/`purple-500` (feature accent borders) — these are established data-semantic colors.
4. **No rounded-lg or rounded-xl.** Use `rounded-md` (6px). Exception: `rounded-full` for badges/pills.
5. **No heavy borders.** Always 1px `#d1d9e0`. Only exception: `border-l-[3px]` accent indicators.
6. **No gradient backgrounds** on structural elements. Gradients only in heatmap data visualization.
7. **No custom fonts.** Inter for body, Geist Mono for code — no additions.
8. **Never hard-code pricing values.** Import from `@/constants/pricing`.
9. **No inline `style` objects for colors.** Use Tailwind bracket notation. Exception: `animationDelay` and Recharts props.
