# Layout Patterns

## Page Structure (Sidebar + Content)

The desktop sidebar uses Primer `NavList`. Render each item as a button because sections are in-memory state, not routes:

```tsx
import { NavList } from '@primer/react';

<div className="flex gap-6">
  <aside className="hidden lg:block w-56 shrink-0">
    <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md sticky top-24">
      <div className="py-2">
        <NavList aria-label="Report sections">
          {navItems.map(item => (
            <NavList.Item key={item.key} as="button" type="button" aria-current={view === item.key ? 'page' : undefined} onClick={() => setView(item.key)}>
              <NavList.LeadingVisual><item.icon /></NavList.LeadingVisual>
              {item.label}
            </NavList.Item>
          ))}
        </NavList>
      </div>
    </div>
  </aside>

  <div className="flex-1 min-w-0">{/* View content */}</div>
</div>
```

## Mobile Navigation (Primer: UnderlineNav)

```tsx
import { UnderlineNav } from '@primer/react';

<div className="lg:hidden mb-6">
  <UnderlineNav aria-label="Report sections">
    {navItems.map(item => (
      <UnderlineNav.Item key={item.key} as="button" type="button" aria-current={view === item.key ? 'page' : undefined} onSelect={() => setView(item.key)}>
        {item.label}
      </UnderlineNav.Item>
    ))}
  </UnderlineNav>
</div>
```

`UnderlineNav` moves items that do not fit into a "More" menu. Do not pass `icon` to its items. In the overflow menu, Primer forwards `icon` to a DOM element and React logs an error.

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
