# Icons, Interaction & Accessibility

## SVG Icons

The project uses inline SVG icons from Heroicons (outline style, 24x24 viewBox):

```tsx
<svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" d="..." />
</svg>
```

Conventions:
- Size: `w-4 h-4` for nav/button icons, `w-5 h-5` for callout icons, `w-7 h-7` for hero icons
- Style: outline (`fill="none" stroke="currentColor"`)
- Stroke width: `1.5` for UI icons, `2` inside filled icon containers
- Always include `aria-hidden="true"` on decorative icons
- Color inherited from parent via `currentColor`

## Focus

```css
*:focus-visible {
  outline: 2px solid var(--accent);  /* indigo-500 */
  outline-offset: 2px;
}
```

## Hover States

- Cards: border darkens to `#c5cdd6`
- Table rows: `bg-[#fcfdff]`
- Nav items: `bg-[#f6f8fa]`, text → `#1f2328`
- Buttons (secondary): `bg-[#f6f8fa]`
- Links: color transition, sometimes underline

## Selection

```css
::selection { background: var(--accent-glow); }
```

## ARIA Patterns

- Expandable sections use `aria-expanded`, `aria-controls`, `aria-labelledby`
- Tooltips use `aria-describedby` and `role="tooltip"`
- Navigation buttons indicate active state via styling (font-semibold + bg change)
- Decorative SVGs use `aria-hidden="true"`

## Scrollbar

Custom WebKit scrollbar styling:
- Width: 10px
- Track: transparent
- Thumb: `#cbd5e1` rounded, 2px border matching background
- Thumb hover: `#94a3b8`
