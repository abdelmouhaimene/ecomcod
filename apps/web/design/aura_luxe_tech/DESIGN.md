---
name: Aura Luxe Tech
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#4e4639'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#7f7667'
  outline-variant: '#d1c5b4'
  surface-tint: '#775a19'
  primary: '#775a19'
  on-primary: '#ffffff'
  primary-container: '#c5a059'
  on-primary-container: '#4e3700'
  inverse-primary: '#e9c176'
  secondary: '#575e70'
  on-secondary: '#ffffff'
  secondary-container: '#d9dff5'
  on-secondary-container: '#5c6274'
  tertiary: '#735c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c5a129'
  on-tertiary-container: '#493900'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdea5'
  primary-fixed-dim: '#e9c176'
  on-primary-fixed: '#261900'
  on-primary-fixed-variant: '#5d4201'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-numeric:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.12em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 4rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses modern industrial luxury for high-end consumer hardware, precision engineering, and premium tech accessories. It balances architectural restraint with radiant warmth, avoiding the austere coldness of traditional consumer electronics while eschewing traditional ornamental luxury. 

The aesthetic is built upon crisp precision, immaculate negative space, razor-thin structural framing, and soft warm-light luminescence. Surfaces evoke machined titanium, optical glass, and fine matte ceramics. Interactions feel deliberate, weighted, and friction-free, communicating mechanical mastery and digital refinement.

## Colors

The palette leverages high-contrast architectural tones balanced by warm precious-metal accents and tactile ivory substrates:

- **Primary (`#C5A059`) & Tertiary (`#D4AF37`)**: Brushed champagne and radiant warm gold. Used intentionally for focal interactive states, key callouts, polished badges, and micro-accents. Never used in heavy, solid background blocks; instead applied linearly or through subtle glowing highlights.
- **Secondary (`#111827`) & Neutral (`#1E293B`)**: Obsidian ink and sleek deep slate. Provide high-contrast grounding for primary typography, primary structural CTA buttons, hero visual framing, and technical product specifications.
- **Canvas & Surface Palette**:
  - `surface-canvas`: `#FFFFFF` — Pure clinical white for baseline negative space and product backdrops.
  - `surface-warm-primary`: `#FDFBF7` — Warm alabaster ivory for subtle section differentiation.
  - `surface-warm-secondary`: `#F8F6F0` — Satin ivory tone for contained modules, inset cards, and toolbars.
  - `border-hairline`: `rgba(17, 24, 39, 0.08)` — Precision border tone.
  - `border-gold-accent`: `rgba(197, 160, 89, 0.35)` — Subtle luxury edge trim for elevated elements.

## Typography

The typography system pairs **Plus Jakarta Sans** with **Space Grotesk** to evoke precision craftsmanship:

- **Plus Jakarta Sans**: Governs all brand headlines, editorial titles, and standard interface copy. Geometric yet sculpted, its refined proportions bring an air of luxury minimalism.
- **Space Grotesk**: Utilized strictly for technical indicators, pricing readouts, hardware specs, status chips, and tracking uppercase meta tags (`label-caps`). It lends a calibrated, horological engineering tone.
- **OpenType Attributes**: Activate tabular numbers (`tnum`) across all pricing and spec modules to preserve alignment across catalog comparisons.

## Layout & Spacing

The layout structure relies on a disciplined 12-column grid anchored by generous outer negative space:

- **Desktop (>= 1280px)**: 12 columns, `gutter-desktop` (32px), `margin-desktop` (64px), max-width bounded at 1440px to retain gallery-like editorial control.
- **Tablet (768px - 1279px)**: 8 columns, `gutter` (24px), `margin-tablet` (32px).
- **Mobile (< 768px)**: 4 columns, `gutter` (16px), `margin` (16px).

Use horizontal rhythm breaks with hairline borders and expansive vertical padding (80px to 120px on desktop sections) to give product silhouettes room to breathe.

## Elevation & Depth

Visual hierarchy does not use harsh, generic drop shadows. Instead, it relies on low-contrast hairline borders, subtle warm ivory surface tiering, and soft gold photonic blooms:

- **Surface Tiers**:
  - `Base`: Pure `#FFFFFF` canvas.
  - `Sub-tier`: `#FDFBF7` for secondary zones and drawers.
  - `Container`: `#F8F6F0` encased with a 1px border of `rgba(17, 24, 39, 0.06)`.
- **Radiant Luminescence (Gold Bloom)**:
  - `Glow Subtle`: `0 8px 24px -4px rgba(197, 160, 89, 0.12), 0 2px 6px -1px rgba(17, 24, 39, 0.04)` — Default state for high-tier accessory cards and featured badges.
  - `Glow Interactive`: `0 16px 36px -6px rgba(212, 175, 55, 0.22), 0 0 0 1px rgba(197, 160, 89, 0.4)` — Active focus, hovered hero cards, and primary checkout buttons.
- **Precision Floating Surface**: Modals and dropdowns use background backdrop blur (`backdrop-filter: blur(16px)`), a crisp 1px hairline (`rgba(17, 24, 39, 0.08)`), and an ambient soft shadow (`0 20px 40px -10px rgba(17, 24, 39, 0.08)`).

## Shapes

The design system enforces architectural sharpness with subtle chamfer-like softening. Base radius is locked to `0.25rem` (4px), increasing to `0.5rem` (8px) on larger container cards, and `0.75rem` (12px) on modal viewports. 

Interactive tags, technical badges, and system controls adhere to pure architectural rectangles or micro-radii to maintain high-precision industrial styling. Circles are reserved exclusively for color-swatch selectors and icon-only micro-buttons.

## Components

### Buttons
- **Primary Action**: Solid `#111827` surface with `#FFFFFF` text. Finished with an inset 1px gold hairline (`rgba(197, 160, 89, 0.4)`). Hover states trigger a subtle forward transition and an ambient glow of `rgba(212, 175, 55, 0.25)`.
- **Secondary / Accent Action**: `#FDFBF7` surface with a 1px border of `#C5A059`, typography set in `#111827`. Hover shifts the background to `#F8F6F0` with border intensification to `#D4AF37`.
- **Text Action**: Monospaced uppercase styling via `label-caps` in `#1E293B`, paired with a 1px underline that expands from center on hover.

### Product & Gallery Cards
- Built on `#FDFBF7` or `#FFFFFF` with a 1px hairline border (`rgba(17, 24, 39, 0.07)`).
- Images feature minimal shadows on neutral staging.
- On hover: The border transitions to `rgba(197, 160, 89, 0.4)` accompanied by the `Glow Subtle` shadow.

### Badges & Status Chips
- Height set to 24px with `label-caps` typography.
- **Polished Gold Tier**: `#FDFBF7` background, 1px solid border in `#C5A059`, and text rendered in `#111827`. Accompanied by a 4px radiant gold circular indicator.
- **Obsidian Tier**: `#111827` background with `#FDFBF7` text for high-impact drops (e.g., "EDITION OF 50").

### Input Fields
- Understated input field with a `#FFFFFF` fill and a crisp 1px border in `rgba(17, 24, 39, 0.12)`.
- Focused state eliminates conventional thick outlines, adopting a 1px `#C5A059` border and a micro-glow (`0 0 0 3px rgba(197, 160, 89, 0.12)`).
- Floating labels transition into `label-caps` in `#1E293B`.

### Lists & Hardware Specifications
- Alternating subtle rows (`#FFFFFF` to `#FDFBF7`).
- Spec labels set in `body-sm` (`#1E293B`), values set in `label-numeric` with tabular numerals.
- Separated by horizontal 1px hairline dividers (`rgba(17, 24, 39, 0.05)`).

### Checkboxes & Radios
- Square with micro-rounded corners (2px radius).
- Unchecked: 1px border (`rgba(17, 24, 39, 0.2)`), white background.
- Checked: `#111827` fill with `#C5A059` checkmark icon or center pip, framed by an exterior gold micro-halo.

### Luxury Hardware Selectors (Custom Component)
- Segmented material/finish switches (e.g., "Titanium Gold", "Space Slate", "Ceramic Ivory").
- Consists of a recessed `#F8F6F0` track holding pill-shaped color swatches bordered with ultra-fine precision gold rings upon selection.