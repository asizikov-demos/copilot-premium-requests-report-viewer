# Icons, Interaction & Accessibility

## Focus

- A global Primer focus style lives in `globals.css`: `*:focus-visible { outline: var(--focus-outline); outline-offset: var(--focus-outline-offset); }`.
- **Never** add `outline-none`, `focus:outline-none`, or custom `focus:ring-*` utilities — they remove or duplicate the Primer focus indicator.
- Text inputs/selects may additionally set `focus:border-(--borderColor-accent-emphasis)`.

## Hover / Selected States

| Element | Token |
| --- | --- |
| Nav items, ghost buttons, expandable headers | `hover:bg-(--control-transparent-bgColor-hover)` |
| Selected nav item / sorted column | `bg-(--control-transparent-bgColor-selected)` |
| Table rows | `hover:bg-(--bgColor-muted)` (sticky cells: add `group` on `<tr>` + `group-hover:bg-(--bgColor-muted)` on the sticky `<td>`) |
| Cards (interactive) | `hover:border-(--borderColor-emphasis)` |
| Links | `text-(--fgColor-accent) hover:underline` |

## SVG Icons

```tsx
<svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" d="..." />
</svg>
```

- Size: `w-4 h-4` (16px) for nav/button icons, `w-5 h-5` for callout icons
- Color inherited via `currentColor`; set color on the parent with a `text-(--fgColor-*)` token
- Always `aria-hidden="true"` on decorative icons, including icons inside buttons that already have text or an `aria-label`. Wrap decorative text glyphs (`✕`, `←`, `↕`) in `<span aria-hidden="true">`
- Data-bearing SVG charts are not decorative: give the `<svg>` `role="img"` and an `aria-label` that summarizes it
- Octicons (`@primer/octicons-react`) are the long-term target; prefer them when adding new icons once adopted

## ARIA Patterns

- Expandable sections: `aria-expanded`, `aria-controls`, `aria-labelledby`
- Tooltips: `aria-describedby` and `role="tooltip"`, rendered in a portal, dismissible with Escape (use the `Tooltip` primitive)
- Navigation: wrap in `<nav aria-label>` and indicate the active item with `aria-current="page"` in addition to styling
- Sortable table headers: use `SortableColumnHeader` (a `<button>` inside `<th>` with `aria-sort` on the `<th>`)
- Multi-select: a `fieldset` + `legend` of checkboxes, never `<select multiple>`
- Buttons: always set `type="button"` unless the button submits a form
