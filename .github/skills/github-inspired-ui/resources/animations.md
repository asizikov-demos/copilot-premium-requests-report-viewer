# Animations & Transitions

## Keyframe Animations (defined in `globals.css`)

| Animation               | Effect                              | Duration | Class                     |
| ------------------------ | ----------------------------------- | -------- | ------------------------- |
| `fadeInUp`               | Fade in + translate up 12px         | 0.5s     | `.animate-fade-in-up`     |
| `scaleIn`                | Fade in + scale from 0.95           | 0.4s     | `.animate-scale-in`       |
| `slideInRight`           | Fade in + translate right 16px      | 0.5s     | `.animate-slide-in-right` |
| `countUp`                | Fade in + translate up 8px          | 0.6s     | `.animate-count-up`       |

## Staggered Delays

```tsx
<div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
<div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
<div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
```

CSS delay classes are also available: `.delay-1` (50ms) through `.delay-5` (250ms).

> **Important:** Elements that animate in should start with `opacity-0` so they're invisible until the animation fires.

## Transition Patterns

All interactive elements use short, consistent transitions:
```
transition-colors duration-150     /* Hover state color changes */
transition-all duration-150        /* Multi-property transitions */
transition-transform duration-150  /* Chevron rotations, transforms */
```
