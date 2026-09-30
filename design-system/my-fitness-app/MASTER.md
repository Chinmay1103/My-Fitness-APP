# Design System Master File

## Project decisions (these override the generated sections below)

The generated sections further down come from the ui-ux-pro-max skill
(`search.py "fitness wearable recovery tracker dark" --design-system --motion 5 --density 6`).
Its Fitness/Gym match leans towards marketing sites, so this app keeps only part of it:

| Area | Decision | Why |
|---|---|---|
| Typography | **Changed (Sep 30, 2026):** Inter for all words (titles, overlines, body, tab bar); Barlow Condensed only for numbers (ring values, stats, deltas) | Condensed numerals look sporty and fit inside rings, but condensed words looked cramped next to wide body text. Inter was picked over Manrope after the Sep 30 design review |
| Colors | **Changed (Sep 30, 2026):** no blue or navy anywhere. Near-black `#050505` page, warm greys (`#FAFAF9` text, `#A8A29E` muted). Orange primary still not used as a brand color | Chinmay found the navy/blue dashboard look generic; warm neutrals let the score colors carry the screen |
| Score colors | Recovery green/yellow/red unchanged. **Strain orange `#FF8A1F`** (was blue) and **sleep violet `#9D7CFF`** (was periwinkle); each has a two-stop gradient (light end → the flat color). HR zones: grey, green, yellow, orange, red | Same split as Bevel: warm effort, cool-but-not-blue rest |
| Layout | **Not kept:** landing-page "hero + feature grid + CTA" pattern | This is a native dashboard app with tabs, not a marketing page |
| Motion | Rings fill from 12 o'clock (1100 ms, ease-out cubic) with a counting number; bars grow in with a 35 ms stagger. All of it is skipped when the phone's "reduce motion" setting is on | One key animation per view; motion shows the value rather than decorating |
| Haptics | Light selection tick on tapping a ring and switching tabs; light impact on pull-to-refresh. Nothing else | Feedback for touches, never a notification-like buzz |
| Charts | **Changed (Sep 30, 2026):** one style for every 14-day trend: bars in the ring gradients at full strength, dashed average line, only the selected day labelled (today until you tap another bar) | Three chart styles read as three apps; a number on every bar was crowded on a phone |
| Surfaces | **Changed (Sep 30, 2026):** each screen's color tints the whole page (strongest at the top); the tab bar is see-through. Cards are **glass**: white at 3.5–8.5% opacity with a brighter top edge, no drop shadow, so the tint shows through | Chinmay asked for transparent tiles; a solid navy card looked generic |
| Accessibility | Muted text ≥ 4.5:1 on cards; charts have a spoken summary (average and today); color is always paired with a label or number | Skill pro-rules checklist |

Code: tokens in `apps/mobile/constants/theme.ts`, motion hooks in `apps/mobile/lib/animation.ts`,
haptics in `apps/mobile/lib/haptics.ts`.

---


> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** My Fitness App
**Generated:** 2026-09-30 09:37:24
**Category:** Fitness/Gym App
**Design Dials:** Motion 5/10 (Standard) | Density 6/10 (Standard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#F97316` | `--color-primary` |
| On Primary | `#0F172A` | `--color-on-primary` |
| Secondary | `#FB923C` | `--color-secondary` |
| On Secondary | `#0F172A` | `--color-on-secondary` |
| Accent/CTA | `#22C55E` | `--color-accent` |
| On Accent/CTA | `#0F172A` | `--color-on-accent` |
| Background | `#1F2937` | `--color-background` |
| Foreground | `#F8FAFC` | `--color-foreground` |
| Card | `#313742` | `--color-card` |
| Card Foreground | `#F8FAFC` | `--color-card-foreground` |
| Muted | `#37414F` | `--color-muted` |
| Muted Foreground | `#CBD5E1` | `--color-muted-foreground` |
| Border | `#374151` | `--color-border` |
| Destructive | `#EF4444` | `--color-destructive` |
| On Destructive | `#000000` | `--color-on-destructive` |
| Ring | `#F97316` | `--color-ring` |

**Color Notes:** Energy orange + success green

### Typography

- **Text Font:** Inter (400, 500, 600, 700): headings, overlines, body
- **Number Font:** Barlow Condensed (600, 700): scores, stats, deltas only
- **Overlines:** Inter SemiBold 12, letter-spacing 1, muted color
- **Mood:** sports, fitness, athletic, clean
- **Google Fonts:** [Inter + Barlow Condensed](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
```

### Spacing Variables

*Density: 6/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #22C55E;
  color: #0F172A;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #F97316;
  border: 2px solid #F97316;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #1F2937;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #F97316;
  outline: none;
  box-shadow: 0 0 0 3px #F9731620;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Vibrant & Block-based

**Keywords:** Bold, energetic, playful, block layout, geometric shapes, high color contrast, duotone, modern, energetic

**Best For:** Startups, creative agencies, gaming, social media, youth-focused, entertainment, consumer

**Key Effects:** Large sections (48px+ gaps), animated patterns, bold hover (color shift), scroll-snap, large type (32px+), 200-300ms

### Page Pattern

**Pattern Name:** Feature-Rich Showcase

- **Conversion Strategy:** Clear feature hierarchy. One key message per card. Strong CTA repetition.
- **CTA Placement:** Hero (sticky) + After features + Bottom
- **Section Order:** Hero (value prop) > Feature grid/cards (4-6) > Use cases or benefits > Social proof or logos > CTA

---

## Motion

**Stagger List** (Standard) — Trigger: load or scroll | Duration: 300-450ms | Easing: `back.out(1.4)`

```js
gsap.from('.grid-item', { opacity: 0, scale: 0.92, y: 16, duration: 0.4, stagger: { each: 0.06, from: 'start', grid: 'auto' }, ease: 'back.out(1.4)' });
```

**Framework notes:** grid: 'auto' lets GSAP infer rows/columns from a CSS grid layout for a natural wave stagger; Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Combine with from: 'center' for a bento-grid layout to draw the eye inward first
- ❌ Don't use back.out on dense data tables; the overshoot reads as sloppy on informational UI
- ⚡ Group DOM writes; avoid interleaving layout reads (getBoundingClientRect) between staggered tweens

---

## Anti-Patterns (Do NOT Use)

- ❌ Static design
- ❌ No gamification

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
