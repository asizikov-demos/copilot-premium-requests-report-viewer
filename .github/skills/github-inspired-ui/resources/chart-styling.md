# Chart Styling

All chart colors come from Primer tokens via `src/constants/primerTokens.ts`. Never hard-code series, axis, or grid colors.

## Model Colors (`src/utils/modelColors.ts`)

Use `getModelColor(modelName)` for single lookups and `generateModelColors(models)` for batch. Known models map to Primer data-viz hues (`dataVizColor(hue)`); unknown models get a stable hue from a 17-hue fallback palette.

## Other Categorical Series

Use `dataVizColor(hue)` with a distinct hue per series, e.g. `TOKEN_COLUMNS` in `src/components/TokenValue.tsx` and `PRODUCT_CATEGORY_COLORS` in `BillingGroupDetailsView.tsx`.

## Chart Tooltip Styling (`src/components/charts/chartTooltipStyles.ts`)

Apply `contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle}`. They use `bgColor.default`, `borderColor.default`, `fgColor.default`, and `shadow.floatingSmall`.

## Shared Chart Element Colors

| Element | Value |
| --- | --- |
| Grid lines | `borderColor.muted` |
| Axis tick text | `fgColor.muted`, `fontSize: 12` |
| Axis lines | `borderColor.default` (SVG charts: `borderColor.emphasis`) |
| Cursor hover fill | `bgColor.neutralMuted` |
| Included / additional usage bars | `bgColor.successEmphasis` / `bgColor.dangerEmphasis` |
| Quota line (single, enterprise) | `fgColor.danger` |
| Quota line (business) | `fgColor.severe` |
| Cell separators | `bgColor.default` |

## Sequential Scales (heatmaps, intensity)

- **JS / SVG:** `dataVizScale('blue', intensity)` where `intensity` is 0..1 (muted → emphasis). Zero values use `bgColor.muted`. Build legends from the same function so they never drift.
- **Class-based:** `bg-(--data-blue-color-muted)` for the lightest step, then `bg-(--data-blue-color-emphasis)/20 … /75`, and `bg-(--data-blue-color-emphasis)` for the strongest. Use `text-(--fgColor-onEmphasis)` only on the full-emphasis step; keep `text-(--fgColor-default)` elsewhere for contrast.

## Recharts Conventions

```tsx
import { borderColor, fgColor } from '@/constants/primerTokens';

<ResponsiveContainer>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke={borderColor.muted} />
    <XAxis tick={{ fill: fgColor.muted, fontSize: 12 }} axisLine={{ stroke: borderColor.default }} />
    <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle} />
    <Bar dataKey="value" fill={getModelColor(model)} />
  </BarChart>
</ResponsiveContainer>
```

## Chart Container Heights

```tsx
{/* Standard chart */}
<div className="h-72 sm:h-96 2xl:h-[28rem] w-full">

{/* Shorter chart (model trends) */}
<div className="h-80 2xl:h-96">
```

Charts should be inside a card with a minimum height: `min-h-[20rem]`.
