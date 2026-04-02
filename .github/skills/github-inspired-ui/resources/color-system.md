# Color System

## CSS Custom Properties (defined in `src/app/globals.css`)

All UI colors are expressed as CSS custom properties. **Use these tokens — never hard-code raw hex values for structural UI elements.**

```
:root {
  /* Core */
  --background: #f6f8fa;        /* Page background — light warm gray */
  --foreground: #1f2328;        /* Primary text — near-black */
  --text-secondary: #636c76;    /* Secondary/muted text */
  --muted: #57606a;             /* Tertiary text, less prominent */

  /* Accent */
  --accent: #6366f1;            /* Primary accent — indigo-500 */
  --accent-soft: #818cf8;       /* Lighter accent variant */
  --accent-glow: rgba(99, 102, 241, 0.15);  /* Focus glow, selection bg */

  /* Semantic */
  --link: #0969da;              /* Link text — GitHub blue */
  --success: #2da44e;           /* Success state — GitHub green */
  --success-bg: #f0fdf4;        /* Success background */
  --success-border: #bbf7d0;    /* Success border */
  --warning: #d97706;           /* Warning state — amber */
  --error: #cf222e;             /* Error/danger — GitHub red */
  --error-bg: #fef2f2;          /* Error background */
  --error-border: #fecdd3;      /* Error border */

  /* Surfaces & borders */
  --border: #d1d9e0;            /* Standard border */
  --border-subtle: #e8ecf0;     /* Lighter border for dividers */
  --card: #ffffff;              /* Card/panel background */
  --card-hover: #fcfdff;        /* Card/row hover state */

  /* Chart palette */
  --chart-1: #6366f1;           /* Indigo */
  --chart-2: #22c55e;           /* Green */
  --chart-3: #f59e0b;           /* Amber */
  --chart-4: #ef4444;           /* Red */
  --chart-5: #8b5cf6;           /* Violet */
  --chart-6: #06b6d4;           /* Cyan */

  /* Shadows — intentionally flat */
  --shadow-sm: 0 1px 3px rgba(31, 35, 40, 0.04);
  --shadow-md: 0 1px 3px rgba(31, 35, 40, 0.04);
  --shadow-lg: 0 1px 3px rgba(31, 35, 40, 0.04);
}
```

> **Key insight:** Shadows are deliberately identical at all sizes — the design is flat. Depth is communicated through borders and background contrast, not shadow elevation.

## Severity / Status Color Map

Use these consistently for categorized content (badges, cards, callouts, advisory panels):

| Severity    | Background  | Border     | Text       | Tailwind shorthand                        |
| ----------- | ----------- | ---------- | ---------- | ----------------------------------------- |
| **Success** | `#f0fdf4`   | `#bbf7d0`  | `#2da44e`  | `bg-[#f0fdf4] border-[#bbf7d0]`          |
| **Warning** | `#fffbeb`   | `#fde68a`  | `#d97706`  | `bg-[#fffbeb] border-[#fde68a]`          |
| **Error**   | `#fef2f2`   | `#fecdd3`  | `#cf222e`  | `bg-[#fef2f2] border-[#fecdd3]`          |
| **Info**    | `#eef2ff`   | `#c7d2fe`  | `#6366f1`  | `bg-[#eef2ff] border-[#c7d2fe]`          |
| **Neutral** | `#f6f8fa`   | `#d1d9e0`  | `#636c76`  | `bg-[#f6f8fa] border-[#d1d9e0]`          |

## How to Reference Colors in Tailwind Classes

Use bracket notation with the hex values from the token system:

```tsx
// ✅ Correct — uses the project's token values
<div className="bg-[#f6f8fa] border border-[#d1d9e0] text-[#1f2328]">

// ❌ Wrong — generic Tailwind colors break visual consistency
<div className="bg-gray-100 border border-gray-300 text-gray-900">
```

Exception: Tailwind's `indigo-500` / `indigo-50` are acceptable for drag-over states and focus rings since they match `--accent`.
