# Color System

All colors come from **Primer Primitives** functional tokens (`@primer/primitives/dist/css/functional/themes/light.css`), imported in `src/app/globals.css`. Browse the full list at https://primer.style/product/primitives/color.

**Never hard-code hex values or use Tailwind palette colors.** Pick a token by its role.

## Core Tokens

| Role | Token | Tailwind usage |
| --- | --- | --- |
| Page background | `--bgColor-muted` | set on `body` in `globals.css` |
| Card / panel / input surface | `--bgColor-default` | `bg-(--bgColor-default)` |
| Inset / table header / subtle surface | `--bgColor-muted` | `bg-(--bgColor-muted)` |
| Primary text | `--fgColor-default` | `text-(--fgColor-default)` |
| Secondary text, labels, icons | `--fgColor-muted` | `text-(--fgColor-muted)` |
| Disabled text, separators like `\|` | `--fgColor-disabled` | `text-(--fgColor-disabled)` |
| Links, accent text | `--fgColor-accent` | `text-(--fgColor-accent)` |
| Text on emphasis backgrounds | `--fgColor-onEmphasis` | `text-(--fgColor-onEmphasis)` |
| Standard border | `--borderColor-default` | `border-(--borderColor-default)` |
| Dividers / subtle borders | `--borderColor-muted` | `divide-(--borderColor-muted)` |
| Stronger border (hover) | `--borderColor-emphasis` | `hover:border-(--borderColor-emphasis)` |
| Selected / emphasis accent fill | `--bgColor-accent-emphasis` | `bg-(--bgColor-accent-emphasis)` |
| Accent focus border | `--borderColor-accent-emphasis` | `focus:border-(--borderColor-accent-emphasis)` |

## Interactive (control) Tokens

| State | Token |
| --- | --- |
| Hover on transparent controls (nav items, ghost buttons, rows) | `--control-transparent-bgColor-hover` |
| Pressed | `--control-transparent-bgColor-active` |
| Selected (nav item, sorted column) | `--control-transparent-bgColor-selected` |

## Status / Severity Map

Use these consistently for banners, labels, stat tiles, and data-semantic text.

| Status | Muted background | Border | Text / icon | Emphasis fill (dots, bars) |
| --- | --- | --- | --- | --- |
| **Accent / info** | `--bgColor-accent-muted` | `--borderColor-accent-muted` | `--fgColor-accent` | `--bgColor-accent-emphasis` |
| **Success** | `--bgColor-success-muted` | `--borderColor-success-muted` | `--fgColor-success` | `--bgColor-success-emphasis` |
| **Attention / warning** | `--bgColor-attention-muted` | `--borderColor-attention-muted` | `--fgColor-attention` | `--bgColor-attention-emphasis` |
| **Severe** | `--bgColor-severe-muted` | `--borderColor-severe-muted` | `--fgColor-severe` | `--bgColor-severe-emphasis` |
| **Danger / error** | `--bgColor-danger-muted` | `--borderColor-danger-muted` | `--fgColor-danger` | `--bgColor-danger-emphasis` |
| **Done** | `--bgColor-done-muted` | `--borderColor-done-muted` | `--fgColor-done` | `--bgColor-done-emphasis` |
| **Neutral** | `--bgColor-neutral-muted` | `--borderColor-default` | `--fgColor-muted` | `--bgColor-neutral-emphasis` |

```tsx
<div className="p-4 rounded-md border border-(--borderColor-attention-muted) bg-(--bgColor-attention-muted)">
  <p className="text-xs font-medium text-(--fgColor-attention)">Warning</p>
</div>
```

## Component Tokens

Prefer these over generic tokens when building the matching component:

- **Header:** `--header-bgColor`, `--header-fgColor-default`, `--header-fgColor-logo`, `--header-borderColor-divider`
- **Primary button:** `--button-primary-{bgColor,borderColor,fgColor}-{rest,hover,active,disabled}`
- **Default button:** `--button-default-{bgColor,borderColor,fgColor}-{rest,hover,active}`
- **Progress bar:** `--progressBar-track-bgColor`, `--progressBar-bgColor-{accent,success,attention,severe,danger,done,neutral}`
- **Tooltip:** `--tooltip-bgColor`, `--tooltip-fgColor`
- **Underline nav:** `--underlineNav-borderColor-active`
- **Labels:** `--label-{hue}-bgColor-rest`, `--label-{hue}-fgColor-rest`

## Data Visualization

Primer provides 17 categorical hues as `--data-{hue}-color-emphasis` / `--data-{hue}-color-muted`:
`auburn, blue, brown, coral, gray, green, lemon, lime, olive, orange, pine, pink, plum, purple, red, teal, yellow`.

- Class usage: `bg-(--data-blue-color-emphasis)`, `bg-(--data-blue-color-emphasis)/35` for stepped intensity.
- JS usage: `dataVizColor('blue')`, `dataVizColor('blue', 'muted')`, `dataVizScale('blue', 0.4)` (mixes muted → emphasis).

## JS Helpers (`src/constants/primerTokens.ts`)

Exports `fgColor`, `bgColor`, `borderColor`, `shadow`, `dataVizColor`, `dataVizTextColor` (contrasting foreground for an emphasis hue), `dataVizScale`, and the `DataVizHue` type. Values are `var(--token)` strings, valid for Recharts props, SVG `fill`/`stroke`, and inline styles. Add a key there (don't inline `var(--...)` strings in components) when a new token is needed in JS.

## ✅ / ❌

```tsx
// ✅ Primer tokens
<div className="bg-(--bgColor-muted) border border-(--borderColor-default) text-(--fgColor-default)">

// ❌ Hard-coded hex or Tailwind palette
<div className="bg-[#f6f8fa] border border-gray-300 text-indigo-600">
```
