# Layout Patterns

## Report Navigation

`DataAnalysis` uses a fixed Primer `NavList` sidebar at viewport widths of at least
63.25rem and heights of at least 42rem. The sidebar collapses from 16rem to 4rem;
its labelled icon buttons retain the active view and show tooltips. The collapse
state is local to the loaded report. At narrower or shorter sizes, a Primer
`ActionMenu` shows the current section and the same conditional navigation items.
The billing-period filter stays in the content area so it remains accessible in
either layout.

## Grid Layouts

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
<div className="space-y-6">
```

## Info Bar (attached to header)

```tsx
<div className="-mx-6 -mt-8 mb-6 px-6 py-3 bg-(--bgColor-muted) border-b border-(--borderColor-default)">
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--fgColor-muted)">
    <span>Label: <span className="font-semibold text-(--fgColor-default)">Value</span></span>
    <span className="hidden sm:inline text-(--fgColor-disabled)">|</span>
  </div>
</div>
```

## App Header (Primer header tokens)

```tsx
import { MarkGithubIcon } from '@primer/octicons-react';
import { Button } from '@primer/react';

<header className="bg-(--header-bgColor) sticky top-0 z-50">
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
