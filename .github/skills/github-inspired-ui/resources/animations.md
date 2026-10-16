# Animations & Transitions

## Keyframe Animations (defined in `globals.css`)

| Animation | Effect | Duration | Class |
| --- | --- | --- | --- |
| `fadeInUp` | Fade in + translate up 12px | 0.5s | `.animate-fade-in-up` |
| `scaleIn` | Fade in + scale from 0.95 | 0.4s | `.animate-scale-in` |
| `slideInRight` | Fade in + translate right 16px | 0.5s | `.animate-slide-in-right` |

## Staggered Delays

```tsx
<div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
<div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
```

> Elements that animate in should start with `opacity-0` so they're invisible until the animation fires.

## Reduced Motion

`globals.css` contains a `@media (prefers-reduced-motion: reduce)` block that shortens the entrance animations to ~1ms and removes delays. Any **new** animation class must be added to that block.

## Transition Patterns

```
transition-colors duration-150     /* Hover state color changes */
transition-all duration-150        /* Multi-property transitions */
transition-transform duration-150  /* Chevron rotations, transforms */
```
