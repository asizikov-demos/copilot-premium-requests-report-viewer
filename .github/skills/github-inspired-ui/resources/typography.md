# Typography

## Fonts
- **Body:** Inter (loaded via `next/font/google` as `--font-inter`)
- **Monospace:** Geist Mono (loaded as `--font-geist-mono`)

## Text Scale (Tailwind classes used in the project)

| Purpose                      | Class                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| Page title                   | `text-2xl font-semibold tracking-tight text-[#1f2328]`       |
| Hero display heading         | `text-4xl text-[#1f2328]` + `display-heading` class          |
| Big stat number              | `text-3xl font-bold text-[#1f2328]`                          |
| Stat number (card)           | `text-2xl font-semibold text-[#1f2328]`                      |
| Section heading (card title) | `text-sm font-medium text-[#1f2328]`                         |
| Body text                    | `text-sm text-[#636c76]`                                     |
| Description/subtitle         | `text-xs text-[#636c76]`                                     |
| Label/category (uppercase)   | `text-xs font-medium text-[#636c76] uppercase tracking-[0.05em]` |
| Table header                 | `text-[11px] font-semibold text-[#636c76] uppercase tracking-wider` |
| Monospaced data              | `text-sm font-mono text-[#636c76]`                           |
| Monospaced stat (numeric)    | `text-2xl font-bold tabular-nums text-[#1f2328]`            |
| Badge text                   | `text-xs font-medium`                                        |

## Special Classes

- **`tabular-nums`** — Use on all numeric data cells and stat figures so digits align vertically in tables and grids. This is a standard CSS `font-variant-numeric` feature; Tailwind exposes it as a utility.
