# Layout Patterns

## Page Structure (Sidebar + Content)

```tsx
<div className="flex gap-6">
  <aside className="hidden lg:block w-56 shrink-0">
    <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md sticky top-24">
      <nav className="p-3 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-(--fgColor-muted) hover:bg-(--control-transparent-bgColor-hover) hover:text-(--fgColor-default)">
          <svg className="w-4 h-4" aria-hidden="true" .../>
          Label
        </button>
        {/* Active state */}
        <button aria-current="page" className="... bg-(--control-transparent-bgColor-selected) text-(--fgColor-default) font-semibold">
          Active Item
        </button>
      </nav>
    </div>
  </aside>

  <div className="flex-1 min-w-0">{/* View content */}</div>
</div>
```

## Mobile Navigation (underline nav)

```tsx
<div className="lg:hidden mb-6">
  <div className="flex flex-wrap gap-2">
    <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-(--bgColor-default) text-(--fgColor-muted) border border-(--borderColor-default) hover:bg-(--control-transparent-bgColor-hover)">
      Tab
    </button>
    {/* Active tab */}
    <button aria-current="page" className="... bg-(--bgColor-default) text-(--fgColor-default) border-b-2 border-(--underlineNav-borderColor-active) font-semibold">
      Active Tab
    </button>
  </div>
</div>
```

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
<header className="bg-(--header-bgColor) sticky top-0 z-50">
  <div className="px-6">
    <div className="flex items-center justify-between h-16">
      <div className="flex items-center gap-3">
        <svg height="32" viewBox="0 0 16 16" width="32" className="fill-(--header-fgColor-logo)" aria-hidden="true">
          <path d="..." />
        </svg>
        <h1 className="text-lg font-semibold tracking-tight text-(--header-fgColor-logo)">App Title</h1>
      </div>
      <button className="px-4 py-2 text-sm font-medium text-(--header-fgColor-logo) bg-transparent hover:bg-(--fgColor-onEmphasis)/10 rounded-md transition-all duration-150 border border-(--header-borderColor-divider)">
        Action
      </button>
    </div>
  </div>
</header>
```
