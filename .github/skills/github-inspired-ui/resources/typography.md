# Typography

## Fonts

Primer's system font stack, wired in `globals.css`:

- **Body:** `--fontStack-sansSerif` → Tailwind `font-sans` (default on `body`)
- **Monospace:** `--fontStack-monospace` → Tailwind `font-mono`

Do not load web fonts (`next/font/google`, `@font-face`). See https://primer.style/product/primitives/typography.

## Text Scale

Minimum size is **12px** (`text-xs`, Primer `--text-body-size-small`). Never use `text-[11px]` or smaller.

| Purpose | Class |
| --- | --- |
| Page title | `text-2xl font-semibold tracking-tight text-(--fgColor-default)` |
| Hero display heading | `text-4xl text-(--fgColor-default)` |
| Big stat number | `text-3xl font-bold text-(--fgColor-default)` |
| Stat number (card) | `text-2xl font-semibold text-(--fgColor-default)` |
| Section heading (card title) | `text-sm font-medium text-(--fgColor-default)` |
| Body text | `text-sm text-(--fgColor-muted)` |
| Description/subtitle | `text-xs text-(--fgColor-muted)` |
| Label/category (uppercase) | `text-xs font-medium text-(--fgColor-muted) uppercase tracking-[0.05em]` |
| Table header | `text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider` |
| Monospaced data | `text-sm font-mono text-(--fgColor-muted)` |
| Monospaced stat (numeric) | `text-2xl font-bold tabular-nums text-(--fgColor-default)` |
| Label / counter text | `text-xs font-medium` |

Headings (`h1`–`h6`) default to `--base-text-weight-semibold` via `globals.css`.

## Special Classes

- **`tabular-nums`** — use on all numeric data cells and stat figures so digits align.
