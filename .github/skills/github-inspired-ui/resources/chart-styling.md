# Chart Styling

## Model Color System (`src/utils/modelColors.ts`)

Model colors are assigned by vendor family:

| Vendor    | Spectrum       | Example range            |
| --------- | -------------- | ------------------------ |
| Claude    | Purple/Violet  | `#5b21b6` → `#ddd6fe`   |
| GPT       | Green/Teal     | `#065f46` → `#a7f3d0`   |
| Gemini    | Blue           | `#1d4ed8` → `#60a5fa`   |
| Agent     | Indigo/Cyan    | `#6366f1` → `#06b6d4`   |

Use `getModelColor(modelName)` from `@/utils/modelColors` for single lookups and `generateModelColors(models)` for batch. Unknown models get a deterministic fallback from the palette.

## Fallback Palette

```ts
['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
 '#ec4899', '#14b8a6', '#2563eb', '#65a30d', '#dc2626', '#0891b2']
```

## User Color Palette (for per-user charts)

Defined in `src/components/UsersOverview.tsx`:

```ts
['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
 '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1']
```

## Chart Tooltip Styling (`src/components/charts/chartTooltipStyles.ts`)

Import and apply `chartTooltipContentStyle` and `chartTooltipLabelStyle`:

```ts
{
  backgroundColor: '#ffffff',
  borderColor: '#d1d9e0',
  borderRadius: 6,
  color: '#1f2328',
  boxShadow: '0 4px 12px rgba(31, 35, 40, 0.12)',
  padding: '10px 14px',
  fontSize: 13,
  border: '1px solid #d1d9e0',
}
```

## Shared Chart Element Colors

| Element            | Color                           |
| ------------------ | ------------------------------- |
| Grid lines         | `#e2e8f0`                       |
| Axis text          | `#636c76`                       |
| Axis lines         | `#d1d9e0`                       |
| Cursor hover fill  | `rgba(99, 102, 241, 0.05)`     |
| Cumulative line    | `#1f2328` (foreground)          |
| Quota line (single)| `#ef4444` (red)                |
| Quota line (biz)   | `#f97316` (orange)             |
| Quota line (ent)   | `#dc2626` (dark red)           |

## Heatmap Gradient (blue scale)

```
0%:      #f9fafb
<1%:     #dbeafe
1-2%:    #bfdbfe
2-5%:    #93c5fd
5-10%:   #60a5fa
10-15%:  #3b82f6
15-20%:  #2563eb
20-30%:  #1d4ed8
>30%:    #1e40af
```

## Recharts Conventions

- Use `<ResponsiveContainer>` for all charts
- Grid lines via `<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />`
- Tooltip uses imported styles: `contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle}`
- Axis styling: `tick={{ fontSize: 12, fill: '#636c76' }}` and `axisLine={{ stroke: '#d1d9e0' }}`
- Model colors via `getModelColor()` — never hard-code chart series colors

## Chart Container Heights

Use responsive heights for chart wrappers:

```tsx
{/* Standard chart (most pages) */}
<div className="h-72 sm:h-96 2xl:h-[28rem] w-full">

{/* Shorter chart (model trends) */}
<div className="h-80 2xl:h-96">
```

Charts should be inside a card with a minimum height: `min-h-[20rem]`.
