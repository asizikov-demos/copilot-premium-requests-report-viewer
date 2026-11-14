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
<ChevronRightIcon size={16} />
<Button leadingVisual={SearchIcon}>Search</Button>
```

- Use `@primer/octicons-react` for every interface icon. Do not add inline `<svg>` icons or icon fonts.
- Shared viewer contract: use native 16px icons for navigation, inline/table controls, search, copy, pagination, sorting and disclosure. Use 24px for prominent metric/status/upload visuals and the header GitHub mark. Native 12px is reserved for genuinely condensed cases supported by the icon. Never override native icon dimensions with CSS; keep control hit areas independent of icon size.
- Category mapping: Overview=`HomeIcon`, Users=`PeopleIcon`, Models/model usage=`AiModelIcon`, agent-specific adoption=`AgentIcon`, Insights=`LightBulbIcon`, AI Credits/financial AI Usage=`CreditCardIcon`, Organizations=`OrganizationIcon`, Cost Centers=`BriefcaseIcon`. Do not give generic Copilot adoption agent-specific meaning.
- Action mapping: `UploadIcon`, `LockIcon`, `CopyIcon`, `SearchIcon`, `ChevronLeftIcon`/`ChevronRightIcon` for pagination, `ChevronRightIcon`/`ChevronDownIcon` for disclosure, `AlertIcon` for warnings, `XCircleFillIcon` for errors and `XIcon` for close. Sorting uses `ArrowSwitchIcon` when inactive and `TriangleUpIcon`/`TriangleDownIcon` when active, with `aria-sort` on the header. Back/external-link actions may use `ArrowLeftIcon`/`ArrowRightIcon`.
- Generic unattributed model fallbacks use `AiModelIcon`, not a clock; generic client fallbacks may use `TerminalIcon`.
- Preserve recognizable third-party IDE/vendor marks as deliberate brand exceptions, with brand colors and aspect ratios intact at 16px compact or 24px prominent. Data-bearing chart SVGs (including feature reach and heatmaps) and visualization geometry are not interface icons and must not be replaced.
- Color comes from `currentColor`. Set it on the parent with a `text-(--fgColor-*)` token, or on the icon with `className` (`fill-(--header-fgColor-logo)`).
- Octicons render `aria-hidden="true"` unless you pass `aria-label`. Give icon-only actions an accessible name with `IconButton aria-label` instead of labelling the icon.
- Pass icon components, not elements, to Primer slots (`leadingVisual={SearchIcon}`, `icon={XIcon}`). Inside `NavList.LeadingVisual`, render the element.
- Icons supplement labels; keep decorative icons hidden from assistive technology and name icon-only controls. Use the matching Octicon rather than decorative font glyphs.
- Data-bearing SVG charts are not decorative: give the `<svg>` `role="img"` and an `aria-label` that summarizes it.

## ARIA Patterns

- Expandable sections: `aria-expanded`, `aria-controls`, `aria-labelledby`
- Tooltips: use Primer's `Tooltip` from `@primer/react`. `IconButton` brings its own label tooltip.
- Navigation: label the navigation and indicate the active item with `aria-current="page"` in `NavList`; compact `ActionMenu` navigation uses single selection.
- Sortable table headers: use `SortableColumnHeader` (a `<button>` inside `<th>` with `aria-sort` on the `<th>`)
- Multi-select: a `fieldset` + `legend` of Primer `Checkbox`es, never `<select multiple>`
- Form fields: label every `TextInput`/`Select` through `FormControl.Label` (add `visuallyHidden` when needed), not `aria-label`
- Buttons: Primer `Button`/`IconButton` default to `type="button"`. Hand-built `<button>`s and `Link as="button"` must set `type="button"` unless they submit a form
