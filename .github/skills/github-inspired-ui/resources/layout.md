# Layout Patterns

## Report Navigation

`DataAnalysis` uses a fixed Primer `NavList` sidebar at viewport widths of at least
63.25rem and heights of at least 42rem. The sidebar collapses from 16rem to 4rem;
its labelled icon buttons retain the active view and show tooltips. The collapse
state is local to the loaded report. At narrower or shorter sizes, a Primer
`ActionMenu` shows the current section and the same conditional navigation items.
The full-width report information bar sticks below the primary header, with the
sidebar positioned below it. The billing-period filter stays in the content area
so it remains accessible in either layout.

Report sections use all available content width; there is no right-side Summary
panel.

## Grid Layouts

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
<div className="space-y-6">
```

## Info Bar (attached to header)

```tsx
<section aria-label="Report information" className={`${styles.infoBar} -mx-6 -mt-8 mb-6 px-6 py-3 bg-(--bgColor-muted) border-b border-(--borderColor-default)`}>
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--fgColor-muted)">
    <span>Label: <span className="font-semibold text-(--fgColor-default)">Value</span></span>
    <span className="hidden sm:inline text-(--fgColor-disabled)">|</span>
  </div>
</section>
```

## App Header (Primer header tokens)

```tsx
import { MarkGithubIcon } from '@primer/octicons-react';
import { Button } from '@primer/react';

import styles from '@/app/page.module.css';

<header className={`${styles.header} sticky top-0 z-50`}>
  <div className="px-6">
    <div className="flex items-center justify-between h-16">
      <div className="flex items-center gap-3">
        <MarkGithubIcon size={32} className="fill-(--header-fgColor-logo)" />
        <h1 className="text-lg font-semibold tracking-tight text-(--header-fgColor-logo)">App Title</h1>
      </div>
      <Button onClick={onAction}>Action</Button>
    </div>
  </div>
</header>
```

The primary header's CSS module layers `--header-bgColor` over opaque
`--bgColor-inset`. The Dimmed header token is translucent, so using it alone lets
scrolled content bleed through. The same-color `linear-gradient` is a flat paint
layer, not a decorative gradient; it preserves the header token in both themes.
The secondary report information bar already uses opaque `--bgColor-muted`.
