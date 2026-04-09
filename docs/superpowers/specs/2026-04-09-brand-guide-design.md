# Honkers Brand Guide

**Direction:** Terminal Luxe — institutional, dark-mode-first, single accent color.
**Logo:** Wordmark only. The typography is the brand.

---

## 1. Color System

### Primary Palette (Dark Mode — Default)

| Role | Hex | Usage |
|------|-----|-------|
| **Background** | `#0A0A0F` | App background, primary surface |
| **Surface** | `#12121A` | Cards, modals, panels |
| **Surface Raised** | `#1A1A25` | Hover states, elevated components |
| **Border** | `#2A2A3A` | Dividers, input borders, table lines |

### Text Hierarchy

| Role | Hex | Usage |
|------|-----|-------|
| **Text Primary** | `#F0F0F5` | Headings, primary content |
| **Text Secondary** | `#9898A8` | Labels, captions, secondary info |
| **Text Muted** | `#5A5A6E` | Placeholders, disabled states |

### Accent (Single Signature Color)

| Role | Hex | Usage |
|------|-----|-------|
| **Accent** | `#00D1C6` | CTAs, links, active states, focus rings |
| **Accent Hover** | `#00E8DC` | Button hover, link hover |
| **Accent Muted** | `#00D1C614` | Accent backgrounds (8% opacity), subtle highlights |

### Semantic Colors

| Role | Hex | Usage |
|------|-----|-------|
| **Positive / YES** | `#00C478` | Win, profit, YES side, success toasts |
| **Negative / NO** | `#E5484D` | Loss, NO side, errors, destructive actions |
| **Warning** | `#F5A623` | Slippage warnings, backup banners, pending states |
| **Info** | `#3B82F6` | Informational callouts, privacy caveats |

### Light Mode (Secondary — Optional)

Inverted for accessibility contexts only (legal pages, print). Background `#FAFAFC`, Surface `#FFFFFF`, Text Primary `#0A0A0F`. Same accent `#00D1C6`.

---

## 2. Typography

### Typeface Selection

| Role | Typeface | Why |
|------|----------|-----|
| **Wordmark** | **Satoshi Black (900)** | Geometric sans-serif with personality. Slightly rounded terminals give "Honkers" a distinctive feel without being playful. Custom letter-spacing at display sizes. |
| **Headings** | **Satoshi Bold (700)** | Same family, consistent visual identity across the product. |
| **Body / UI** | **Inter Regular (400) / Medium (500)** | Industry-standard UI typeface. Optimized for screens, excellent at small sizes, wide language support. Pairs cleanly with Satoshi without competing. |
| **Monospace** | **JetBrains Mono Regular (400)** | For addresses, transaction hashes, proof status, code-like data. Clear distinction between similar characters (0/O, 1/l). |

### Type Scale (rem-based, 16px root)

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 2.5rem (40px) | Satoshi 900 | 1.1 | Landing hero, marketing |
| `h1` | 2rem (32px) | Satoshi 700 | 1.2 | Page titles |
| `h2` | 1.5rem (24px) | Satoshi 700 | 1.25 | Section headings |
| `h3` | 1.25rem (20px) | Satoshi 700 | 1.3 | Card titles, subsections |
| `body-lg` | 1rem (16px) | Inter 400 | 1.5 | Primary body text |
| `body` | 0.875rem (14px) | Inter 400 | 1.5 | Default UI text, form labels |
| `caption` | 0.75rem (12px) | Inter 500 | 1.4 | Timestamps, metadata, badges |
| `mono` | 0.8125rem (13px) | JetBrains Mono 400 | 1.5 | Addresses, hashes, proof data |

### Wordmark Specifications

- Typeface: Satoshi Black
- Letter-spacing: `-0.02em` (tightened for display)
- All lowercase: **honkers**
- Minimum size: 24px height
- Clear space: 1x the height of the "h" on all sides

---

## 3. Spacing, Layout & Grid

### Spacing Scale (4px base unit)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps: icon-to-label, badge padding |
| `space-2` | 8px | Default inline spacing, input padding vertical |
| `space-3` | 12px | Small component gaps |
| `space-4` | 16px | Standard component padding, form gaps |
| `space-5` | 20px | Card padding |
| `space-6` | 24px | Section padding horizontal |
| `space-8` | 32px | Section gaps, major component separation |
| `space-10` | 40px | Page section breaks |
| `space-12` | 48px | Layout-level vertical rhythm |
| `space-16` | 64px | Hero sections, major page divisions |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Badges, small tags |
| `radius-md` | 8px | Buttons, inputs, cards |
| `radius-lg` | 12px | Modals, panels, larger containers |
| `radius-full` | 9999px | Pills, status indicators, avatars |

### Grid System

- **Max content width:** 1200px
- **Columns:** 12-column grid
- **Gutter:** 24px (`space-6`)
- **Margin (desktop):** 48px (`space-12`) on each side
- **Margin (tablet, <1024px):** 24px
- **Margin (mobile, <640px):** 16px
- **Breakpoints:** `sm: 640px` / `md: 768px` / `lg: 1024px` / `xl: 1280px`

### Elevation (Dark Mode Layering)

No drop shadows on dark mode. Elevation is communicated through background lightness stepping:

| Level | Background | Usage |
|-------|-----------|-------|
| Base | `#0A0A0F` | Page background |
| Level 1 | `#12121A` | Cards, sidebars |
| Level 2 | `#1A1A25` | Modals, dropdowns, popovers |
| Level 3 | `#222233` | Tooltips, floating elements |

Border (`#2A2A3A` at 1px) reinforces edges where needed. No stacking shadows.

---

## 4. Tone of Voice & Writing Principles

### Brand Voice

Honkers speaks like a **senior trader who respects your intelligence**. No hype, no jargon-for-jargon's-sake, no exclamation marks. Direct, precise, occasionally dry.

### Voice Attributes

| Attribute | What it means | What it doesn't mean |
|-----------|--------------|---------------------|
| **Direct** | Say it in fewer words. Lead with the point. | Blunt or rude. Still respectful. |
| **Honest** | State limitations clearly (L1 leaks, proof times). Never oversell privacy. | Apologetic or defensive. State facts, move on. |
| **Confident** | We know what we built and why. | Arrogant. Never dismiss competitors or users. |
| **Technical when needed** | Use precise terms (nullifier, PXE, note) with context. | Gatekeeping. Always provide enough context for a smart newcomer. |

### Writing Rules

1. **No superlatives.** Not "the most private" or "revolutionary." Say what it does.
2. **Active voice.** "Your PXE generates the proof" not "The proof is generated by your PXE."
3. **Privacy claims are precise.** "Positions are hidden in private notes" not "fully anonymous trading."
4. **Sentence case for all UI text.** "Create market" not "Create Market." Headings included.
5. **No exclamation marks** in product UI. Reserve for error states if absolutely needed.
6. **Numbers over words.** "72h grace period" not "seventy-two hour grace period."

### Example Copy

| Context | Do | Don't |
|---------|-----|-------|
| Landing headline | "Trade predictions. Keep your positions private." | "The MOST Private Prediction Market Ever Built!" |
| Deposit warning | "Your L1 address and deposit amount are visible on Ethereum. Your Aztec recipient is hidden." | "Don't worry, your privacy is fully protected!" |
| Proof progress | "Generating proof... this may take 15-30 seconds." | "Hang tight! We're working our magic!" |
| Error | "Proof generation failed. Try a smaller trade size." | "Oops! Something went wrong :(" |
| Backup banner | "Back up your notes. Without a backup, lost browser data means lost funds." | "Hey! Don't forget to back up your super important data!!!" |

### Naming Conventions

- Product name: **honkers** (lowercase in wordmark, capitalize "Honkers" in sentences)
- Internal features use plain language: "backup," "trade," "claim" — not branded feature names
- No acronyms in user-facing copy without first defining them

---

## 5. Iconography & Visual Elements

### Icon Style

| Property | Value |
|----------|-------|
| **Style** | Outline (1.5px stroke), not filled |
| **Size grid** | 20x20px default, 16x16px compact, 24x24px large |
| **Corner radius** | Match stroke joins: rounded caps and joins |
| **Color** | `Text Secondary (#9898A8)` default; `Text Primary (#F0F0F5)` active/hover; `Accent (#00D1C6)` for interactive |
| **Library** | Lucide Icons (open source, consistent outline style, wide coverage) |

### Core Icon Mapping

| Concept | Icon | Notes |
|---------|------|-------|
| Wallet / Connect | `wallet` | Connection state indicator |
| Trade | `arrow-left-right` | Side-neutral, implies exchange |
| YES position | `trending-up` | Paired with Positive green |
| NO position | `trending-down` | Paired with Negative red |
| Privacy / Shield | `shield-check` | Used sparingly — privacy caveats, model page |
| Proof in progress | `loader` (animated) | 1.5s rotation, `Accent` color |
| Backup | `download` | Export notes |
| Restore | `upload` | Import notes |
| Warning | `alert-triangle` | Warning color `#F5A623` |
| Settings | `settings` | Gear, standard |
| Markets | `layout-grid` | Browse markets |
| Portfolio | `briefcase` | Positions overview |
| Claim winnings | `circle-check` | Positive green on completion |
| Admin | `shield` | Role-gated contexts only |

### Illustration Style

No illustrations in Phase 1. If introduced later:

- **Flat geometric** shapes only — no gradients, no 3D, no characters
- Composed from basic forms: circles, rectangles, lines
- Use palette colors only: `Accent`, `Surface`, `Border`
- Reserved for: empty states, onboarding, error pages

### Data Visualization

| Element | Style |
|---------|-------|
| **Odds bars (YES/NO)** | Horizontal stacked bar. Positive green left, Negative red right. No border radius on the split point, `radius-sm` on outer edges. |
| **Price/probability** | Single large number (`h2` weight), color-coded by side |
| **Countdown timers** | Monospace (`JetBrains Mono`), `Warning` color when < 24h remaining |
| **Status badges** | Pill shape (`radius-full`), uppercase `caption` weight, background at 12% opacity of semantic color |

### Dividers & Separators

- Horizontal rules: 1px `Border (#2A2A3A)`
- Section breaks: `space-10` gap, no visible line
- Card separation: rely on surface color stepping, not borders (add border only if adjacent cards share the same elevation)

---

## 6. Component Styling Patterns

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| **Primary** | `Accent #00D1C6` | `#0A0A0F` (dark on accent) | none | Main CTAs: "Connect wallet," "Trade," "Claim" |
| **Secondary** | `transparent` | `Text Primary #F0F0F5` | 1px `Border #2A2A3A` | Secondary actions: "Cancel," "Back" |
| **Ghost** | `transparent` | `Text Secondary #9898A8` | none | Tertiary: "Skip," inline links |
| **Destructive** | `Negative #E5484D` at 12% opacity | `#E5484D` | none | "Disconnect," "Void market" |

All buttons: `radius-md (8px)`, `body` size text (14px, Inter Medium 500), height 40px, horizontal padding `space-6 (24px)`. Disabled state: 40% opacity, no pointer events.

### Inputs

- Height: 40px
- Background: `Surface #12121A`
- Border: 1px `Border #2A2A3A`, transitions to `Accent` on focus
- Text: `Text Primary` for value, `Text Muted` for placeholder
- Padding: `space-3` vertical, `space-4` horizontal
- Radius: `radius-md`
- Error state: border changes to `Negative`, helper text below in `Negative` at `caption` size

### Cards

- Background: `Surface #12121A`
- Border: 1px `Border #2A2A3A`
- Radius: `radius-lg (12px)`
- Padding: `space-5 (20px)`
- Hover (if interactive): background shifts to `Surface Raised #1A1A25`

### Badges / Status Pills

- Shape: `radius-full`
- Padding: `space-1` vertical, `space-3` horizontal
- Text: `caption` size, Inter Medium 500, uppercase
- Background: semantic color at 12% opacity
- Examples: `Open` = Accent bg, `Resolved` = Positive bg, `Void` = Warning bg, `Halted` = Negative bg

### Toasts / Notifications

- Position: bottom-right, 24px from edges
- Background: `Surface Raised #1A1A25`
- Border-left: 3px solid semantic color (success/error/warning/info)
- Auto-dismiss: 5 seconds (errors persist until dismissed)
- Max width: 380px

### Modals

- Overlay: `#0A0A0F` at 70% opacity
- Modal surface: `Surface Raised #1A1A25`
- Radius: `radius-lg`
- Padding: `space-6`
- Max width: 480px (forms), 640px (confirmation/detail)

---

## 7. Motion & Interaction

### Timing Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `instant` | 100ms | `ease-out` | Color changes, opacity toggles |
| `fast` | 150ms | `ease-out` | Button hover/press, focus rings |
| `normal` | 250ms | `ease-in-out` | Card hover, panel expand/collapse |
| `slow` | 400ms | `ease-in-out` | Modal open/close, page transitions |

### Interaction States

| State | Treatment |
|-------|-----------|
| **Hover** | Background lightens one elevation step, `fast` transition |
| **Active/Press** | Scale `0.98`, `instant` transition |
| **Focus** | 2px `Accent` outline, 2px offset from element. Never remove — keyboard accessibility. |
| **Disabled** | 40% opacity, cursor `not-allowed`, no hover effect |
| **Loading** | Content replaced with skeleton pulse (linear gradient sweep on `Surface` to `Surface Raised` to `Surface`, 1.5s loop) |

### Proof Progress Animation

The signature interaction — users will stare at this for 15-30 seconds:

- Circular progress ring, `Accent` stroke, 3px weight
- Indeterminate mode: ring rotates with a 120-degree arc gap, 1.5s per rotation
- Determinate mode (if stages known): ring fills, percentage in center as `h2` monospace
- Below ring: current step label in `body` size ("Generating witness...", "Computing proof...", "Submitting transaction...")
- Elapsed time in `mono` at `caption` size, `Text Muted`

### Page Transitions

- Fade in: opacity 0 to 1, `slow` timing
- No slide animations — keep it still and grounded
- Content loads top-down with 50ms stagger between sections (subtle, not dramatic)

### Reduced Motion

Respect `prefers-reduced-motion`:
- Disable all animations except opacity transitions
- Proof progress becomes a static spinner or text-only "Generating proof..."
- Skeleton loading becomes a static gray block

---

## 8. Brand Application Rules

### Logo Usage

| Rule | Specification |
|------|--------------|
| **Primary form** | Wordmark "honkers" in Satoshi Black, lowercase |
| **Minimum size** | 24px cap height (digital), 10mm (print) |
| **Clear space** | 1x height of "h" on all sides — nothing enters this zone |
| **Color on dark** | `Text Primary #F0F0F5` |
| **Color on light** | `#0A0A0F` |
| **Accent variant** | `Accent #00D1C6` — use only on dark backgrounds, only for marketing/hero contexts |

### Logo Don'ts

- Never stretch, rotate, or skew the wordmark
- Never add drop shadows, outlines, or gradients
- Never change the letter-spacing from `-0.02em`
- Never set in a different typeface
- Never lock up with other logos without clear space rules

### Favicon & App Icon

- Letterform "h" extracted from the wordmark, Satoshi Black
- Background: `#0A0A0F`
- Letter color: `Accent #00D1C6`
- Radius: platform-native (iOS rounds automatically; Android use `radius-lg`)
- Sizes: 16x16, 32x32, 180x180 (apple-touch), 512x512 (PWA)

### Social & Marketing Templates

| Context | Format | Notes |
|---------|--------|-------|
| **OG image** | 1200x630px | `#0A0A0F` background, wordmark centered, tagline below in Inter Regular `Text Secondary` |
| **Twitter card** | 1200x600px | Same treatment as OG |
| **Discord banner** | 960x540px | Wordmark + accent underline |

### Tagline

Primary: **"Private predictions."**

Secondary (for contexts needing more): **"Trade predictions. Keep your positions private."**

Never use both together. Pick one per context.

### Co-branding

When appearing alongside "Built on Aztec" or similar:
- Honkers wordmark on left, separator line (`Border` color, vertical, 1px), partner mark on right
- Equal clear space around both marks
- Never merge or overlap marks

---

*Honkers Brand Guide v1.0 — April 9, 2026*
