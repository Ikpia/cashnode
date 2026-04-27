---
name: Organic Wealth
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#8d4b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b15f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  stack-xs: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system is anchored in a philosophy of "Quiet Confidence." It moves away from the volatile aesthetics of traditional crypto platforms, instead embracing the stability of private banking and the warmth of modern editorial design. The system evokes a sense of permanence and growth through a "Warm Minimalist" approach—utilizing significant whitespace, a natural color palette, and high-fidelity depth. 

The emotional response should be one of calm control. Users should feel they are interacting with a premium physical vault that is digitally accessible. This is achieved through tactile card layouts, soft transitions, and an intentional lack of visual noise.

## Colors
The palette is centered on a warm, off-white "Sand" foundation (#FAF9F6) to reduce eye strain and provide a more organic feel than pure white. Typography is strictly "Deep Charcoal" (#1A1A1A) to ensure high contrast and authority. 

Emerald and Teal are used for primary actions and growth indicators, representing financial vitality. Amber is reserved specifically for high-priority transaction highlights, cash-outs, or critical balance changes, acting as a sophisticated focal point against the cooler greens. Muted Jade serves as a secondary accent for subtle UI elements like inactive states or background fills for components.

## Typography
This design system utilizes a dual-typeface system to balance character with utility. **Plus Jakarta Sans** is the primary headline face; its modern, geometric construction and slightly wider stance provide a premium, "tech-forward" feel for balances and page titles. 

**Inter** is utilized for all body copy and functional labels. Its exceptional legibility at small sizes makes it ideal for complex transaction data and dense financial tables. Headlines should use tighter letter-spacing to appear more cohesive, while labels utilize a slight positive tracking to ensure clarity in uppercase or small-caps treatments.

## Layout & Spacing
The layout philosophy follows a **Fixed-Fluid Hybrid Grid**. Content is housed within a maximum container width of 1280px to maintain readability on ultra-wide monitors. A 12-column system is used for desktop, collapsing to 4 columns for mobile.

Generosity in whitespace is a core requirement; padding within cards and containers should lean toward "oversized" to convey a sense of premium luxury. Vertical rhythm is established using a 4px baseline grid, with standard component spacing favoring 24px (md) and 48px (lg) increments to create clear separation between distinct financial modules.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** and **Ambient Shadows**. Instead of heavy borders, the system uses subtle color shifts in the background and soft, multi-layered shadows to indicate height.

- **Level 0 (Base):** The #FAF9F6 Sand background.
- **Level 1 (Cards):** Pure white (#FFFFFF) surfaces with a 20% opacity shadow (12px blur, 4px offset).
- **Level 2 (Modals/Popovers):** Pure white surfaces with a more pronounced, diffused shadow (32px blur, 16px offset) and a subtle 1px border in #E5E4E0.
- **Depth Detail:** Use backdrop blurs (20px) on fixed navigation bars to maintain a sense of layered space as the user scrolls.

## Shapes
The design system uses a **Rounded** shape language to appear approachable and modern. Main containers and dashboard cards utilize a 1rem (16px) radius, while interactive elements like buttons and input fields use a 0.5rem (8px) radius. 

Status pills and "active" indicators use a full pill-shape (999px) to contrast against the structured rectangular layout of the cards. This creates a visual distinction between "containers" and "actions/statuses."

## Components
- **Buttons:** Primary buttons use a solid Emerald-to-Teal linear gradient (slight 15-degree angle) with white text. Secondary buttons use a Sand background with a Charcoal border.
- **Status Pills:** Utilize a "Muted Jade" background with Deep Emerald text for "Success," and a "Pale Amber" background with Deep Amber text for "Pending." No icons are required inside pills; the color and bold typography carry the meaning.
- **Cards:** White backgrounds, 1rem corner radius, and generous 32px internal padding. Cards should feel like "sheets" of paper resting on the sand background.
- **Input Fields:** Minimalist style with a 1px border (#E5E4E0). On focus, the border transitions to Teal with a soft 4px outer glow.
- **Timelines:** For transaction history, use a thin 1px vertical line in Charcoal (10% opacity) with Emerald dots for completions and Amber dots for cash-outs.
- **Responsive Layouts:** Navigation shifts from a horizontal top-bar on desktop to a refined bottom-tab bar on mobile, utilizing haptic-inspired icons and no labels to maintain a clean aesthetic.