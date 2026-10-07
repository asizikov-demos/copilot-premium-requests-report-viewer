# Chart Styling

## Model Color System (`src/utils/modelColors.ts`)

Use `getModelColor(modelName)` from `@/utils/modelColors` for single lookups and `generateModelColors(models)` for batch.

## Chart Tooltip Styling (`src/components/charts/chartTooltipStyles.ts`)

Import and apply `chartTooltipContentStyle` and `chartTooltipLabelStyle`.

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
