# Typography

## Fonts
- **Body:** Inter (loaded via `next/font/google` as `--font-inter`)
- **Monospace:** Geist Mono (loaded as `--font-geist-mono`)
- Applied globally: `font-family: var(--font-inter), system-ui, -apple-system, sans-serif`
- Font smoothing: `-webkit-font-smoothing: antialiased` (WebKit) and `-moz-osx-font-smoothing: grayscale` (Firefox on macOS)

## Heading Style
All headings use:
```css
letter-spacing: -0.01em;
font-weight: 700;
```

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
- **`display-heading`** — Used on hero/page-level headings (e.g., the upload screen title, cost optimization title). Currently referenced in code but not defined as a custom CSS class — it serves as a semantic marker and may be styled in future.
