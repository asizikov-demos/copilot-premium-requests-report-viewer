# Layout Patterns

## Page Structure (Sidebar + Content)

The main analysis view uses a sidebar navigation + content area:

```tsx
<div className="flex gap-6">
  {/* Sidebar — hidden on mobile */}
  <aside className="hidden lg:block w-56 shrink-0">
    <div className="bg-white border border-[#d1d9e0] rounded-md sticky top-24">
      <nav className="p-3 space-y-1">
        {/* Nav items */}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#636c76] hover:bg-[#f6f8fa] hover:text-[#1f2328]">
          <svg className="w-4 h-4" .../>
          Label
        </button>
        {/* Active state */}
        <button className="... bg-[#f6f8fa] text-[#1f2328] font-semibold">
          Active Item
        </button>
      </nav>
    </div>
  </aside>

  {/* Main content */}
  <div className="flex-1 min-w-0">
    {/* View content */}
  </div>
</div>
```

## Mobile Navigation (replaces sidebar on small screens)

```tsx
<div className="lg:hidden mb-6">
  <div className="flex flex-wrap gap-2">
    <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-white text-[#636c76] border border-[#d1d9e0] hover:bg-[#f6f8fa]">
      Tab
    </button>
    {/* Active tab */}
    <button className="... bg-white text-[#1f2328] shadow-sm border-b-2 border-indigo-500 font-semibold">
      Active Tab
    </button>
  </div>
</div>
```

## Grid Layouts

```tsx
{/* 3-column stat grid (collapses to 1 on mobile) */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

{/* 2-column wide grid */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

{/* Vertical stacked sections */}
<div className="space-y-6">
```

## Info Bar (attached to header)

```tsx
<div className="-mx-6 -mt-8 mb-6 px-6 py-3 bg-[#f6f8fa] border-b border-[#d1d9e0]">
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#636c76]">
    <span>Label: <span className="font-semibold text-[#1f2328]">Value</span></span>
    <span className="hidden sm:inline text-[#d1d9e0]">|</span>
    <span>Label: <span className="font-semibold text-[#1f2328]">Value</span></span>
  </div>
</div>
```

## App Header (dark top bar)

The global header uses GitHub's dark chrome:

```tsx
<header className="bg-[#24292f] sticky top-0 z-50">
  <div className="px-6">
    <div className="flex items-center justify-between h-16">
      <div className="flex items-center gap-3">
        {/* GitHub logo SVG — 32×32, fill="#fff" */}
        <svg height="32" viewBox="0 0 16 16" width="32" fill="#fff" aria-hidden="true">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013..." />
        </svg>
        <h1 className="text-lg font-semibold tracking-tight text-white">App Title</h1>
      </div>
      {/* Ghost button for secondary action */}
      <button className="px-4 py-2 text-sm font-medium text-white bg-transparent hover:bg-white/[0.08] rounded-md transition-all duration-150 border border-[#57606a]">
        Action
      </button>
    </div>
  </div>
</header>
```

Key details:
- Background: `#24292f` (GitHub's dark header)
- Height: `h-16`, sticky with `z-50`
- Ghost button: transparent bg, `hover:bg-white/[0.08]`, `border-[#57606a]`
