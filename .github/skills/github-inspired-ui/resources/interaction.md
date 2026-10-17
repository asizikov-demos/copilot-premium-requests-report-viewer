# Icons, Interaction & Accessibility

## Focus

- A global Primer focus style lives in `globals.css`: `*:focus-visible { outline: var(--focus-outline); outline-offset: var(--focus-outline-offset); }`. Primer React components apply the same focus outline.
- **Never** add `outline-none`, `focus:outline-none`, or custom `focus:ring-*` utilities — they remove or duplicate the Primer focus indicator.
- Hand-built text inputs may additionally set `focus:border-(--borderColor-accent-emphasis)`. Primer `TextInput`/`Select` handle this themselves.

## Hover / Selected States

| Element | Token |
| --- | --- |
| Nav items, ghost buttons, expandable headers | `hover:bg-(--control-transparent-bgColor-hover)` |
| Selected nav item / sorted column | `bg-(--control-transparent-bgColor-selected)` |
| Table rows | `hover:bg-(--bgColor-muted)` (sticky cells: add `group` on `<tr>` + `group-hover:bg-(--bgColor-muted)` on the sticky `<td>`) |
| Cards (interactive) | `hover:border-(--borderColor-emphasis)` |
| Links | `text-(--fgColor-accent) hover:underline` |

## Icons (Octicons)

```tsx
import { SearchIcon, ChevronRightIcon } from '@primer/octicons-react';

<SearchIcon />                 {/* 16px, aria-hidden by default */}
<ChevronRightIcon size={20} />
<Button leadingVisual={SearchIcon}>Search</Button>
```

- Use `@primer/octicons-react` for every interface icon. Do not add inline `<svg>` icons or icon fonts.
- Size: the default 16px for nav, button and inline icons. Pass `size={20}`/`size={24}` for larger callout icons and `size={32}` for the header mark.
- Color comes from `currentColor`. Set it on the parent with a `text-(--fgColor-*)` token, or on the icon with `className` (`fill-(--header-fgColor-logo)`).
- Octicons render `aria-hidden="true"` unless you pass `aria-label`. Give icon-only actions an accessible name with `IconButton aria-label` instead of labelling the icon.
- Pass icon components, not elements, to Primer slots (`leadingVisual={SearchIcon}`, `icon={XIcon}`). Inside `NavList.LeadingVisual`, render the element.
- Wrap decorative text glyphs (`✕`, `←`, `↕`) in `<span aria-hidden="true">`, or prefer the matching Octicon.
- Data-bearing SVG charts are not decorative: give the `<svg>` `role="img"` and an `aria-label` that summarizes it.

## ARIA Patterns

- Expandable sections: `aria-expanded`, `aria-controls`, `aria-labelledby`
- Tooltips: use Primer's `Tooltip` from `@primer/react`. `IconButton` brings its own label tooltip.
- Navigation: wrap in `<nav aria-label>` and indicate the active item with `aria-current="page"` in addition to styling. `NavList` and `UnderlineNav` do this when you pass `aria-current` to the item.
- Sortable table headers: use `SortableColumnHeader` (a `<button>` inside `<th>` with `aria-sort` on the `<th>`)
- Multi-select: a `fieldset` + `legend` of Primer `Checkbox`es, never `<select multiple>`
- Form fields: label every `TextInput`/`Select` through `FormControl.Label` (add `visuallyHidden` when needed), not `aria-label`
- Buttons: Primer `Button`/`IconButton` default to `type="button"`. Hand-built `<button>`s and `Link as="button"` must set `type="button"` unless they submit a form
