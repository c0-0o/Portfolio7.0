# AnimatedLogo

One reusable Next.js (App Router, client component) logo that morphs from your normal logo into your cat logo, with eye blinking and random idle appearances. Built from your actual SVGs, not a redraw.

## Installed in this project

The reusable package lives in `components/AnimatedLogo/`; the QA page is available at `/logo-lab`.

The logo component uses Next.js `Link` and React without an animation dependency.

The QA page imports `@/components/AnimatedLogo` (the default Next.js alias). No new dependencies: no Framer Motion, no GSAP. Needs `next/link` and React 18+ only.

## Usage

```tsx
import AnimatedLogo from "@/components/AnimatedLogo";

// Navbar: links home, hover + idle
<AnimatedLogo size={48} href="/" interactive idleAnimation priority />

// Tiny: automatically the compact logo (below 38px)
<AnimatedLogo size={32} />

// Hero: big, hover only
<AnimatedLogo size={120} interactive />

// Footer: quiet idle, slower than default
<AnimatedLogo size={56} interactive idleAnimation idleMinDelay={15000} idleMaxDelay={40000} />

// Loading screen: no idle, you decide when the cat appears
<AnimatedLogo size={72} showCat={isReady} />

// Dark background
<AnimatedLogo size={48} interactive color="#fff" />
```

`size` is the **height** in px (or any CSS length like `"3rem"`); width follows the artwork's aspect ratio, so it is never stretched.

## Props

| Prop | Default | Notes |
|---|---|---|
| `size` | `48` | Rendered height. Number = px, string = CSS length |
| `width` / `height` | – | Independent override. If both are given the logo is fitted inside, never stretched |
| `interactive` | `false` | Hover, keyboard focus, and tap reveal the cat |
| `idleAnimation` | `false` | Random automatic cat appearances |
| `idleMinDelay` / `idleMaxDelay` | `8000` / `20000` | ms between appearances (randomized) |
| `idleHoldMin` / `idleHoldMax` | `600` / `1200` | ms the cat stays after the morph finishes |
| `coordinate` | `true` | Only one logo on the page idle-animates at a time |
| `breakpoint` | `38` | Rendered height (px) below which the compact logo is used |
| `animate` | `true` | `false` = always the static logo |
| `showCat` | – | Externally pin the cat on/off (loaders, reveals) |
| `priority` | `false` | Start animation controller immediately; otherwise it starts on browser idle so it never competes with hydration. Use for the navbar |
| `href` | – | Renders a Next `<Link>` |
| `onClick` | – | Renders a `<button>` (or fires on the link) |
| `ariaLabel` | `"Home"` with `href`, else `"Logo"` | Set this to your name/brand |
| `color` / `eyeColor` | `#050505` / `#ADEB66` | Original values by default |
| `className` / `style` | – | Applied to the root element |

## What I found in your assets (and how it's used)

- **`Logow.svg` = normal logo** (ears folded into the head, no eyes). **`logo.svg` = cat** (ears up, two green eyes).
- The body paths are byte-identical in both files. The two ear paths have the same command structure, so the ear animation is a **genuine path morph**, not a crossfade.
- The eyes are **separate paths** (`#ADEB66`), so they have their own controller.
- The compact artwork in `Small_symbol_checks.svg` (16px and 32px) is geometrically identical to `Logow.svg` (max deviation 0.0016 units), so compact mode reuses it. One source of truth, no duplicate assets.
- Path data is embedded in `logo-paths.ts` (extracted verbatim). The original SVG files are untouched and are **not loaded at runtime**: zero extra requests.

**Assumption to confirm:** I treated "normal logo" and "compact" as the same artwork (`Logow.svg`) and "cat" as `logo.svg`, because that is what the files and your size-check sheet show. If your normal logo is meant to be something else, send it and only `logo-paths.ts` changes.

## Behaviour

- **Below 38px** (measured from the actual rendered size via `ResizeObserver`, not viewport): static compact logo, no eye elements rendered, no controller, no JS cost.
- **38px and above:** normal logo at rest.
- **Hover/focus:** big ear rises first with a slight anticipation dip and settle, small ear follows 70ms later, eyes open from a slit once the ears are mostly up, then a blink. Irregular blinking continues while hovered (gaps vary ~0.9–5.6s, 20% double blinks). Leaving closes the eyes first, then lowers the ears (~450ms). Re-entering mid-return reverses from wherever it is, with no jump.
- **Idle:** random wait → cat → one blink (sometimes two) → hold → back. Never starts during hover, hover takes over smoothly if it arrives mid-idle, pauses when the tab is hidden or the logo is off-screen, resumes when visible.
- **Touch:** a tap shows the cat for ~2s (there is no hover on phones).
- **Keyboard:** focusing a linked logo with Tab shows the cat (focus-visible only).
- **Reduced motion:** no idle, no blinking, no anticipation; hover/focus is a ~170ms swap.

## Integrating into your site

The animated logo is integrated in the primary navigation. These examples show optional uses in other site regions:

```tsx
// components/Navbar.tsx
<AnimatedLogo size={44} href="/" interactive idleAnimation priority ariaLabel="Your Name, home" />

// components/Footer.tsx
<AnimatedLogo size={56} interactive idleAnimation idleMinDelay={15000} idleMaxDelay={40000} />

// components/Loader.tsx  (no idle, drive it yourself)
<AnimatedLogo size={72} showCat={progress >= 100} />
```

Because idle is coordinated by default, a navbar logo and a footer logo will never animate at the same moment.

## How it's built

| File | Role |
|---|---|
| `AnimatedLogo.tsx` | Component: sizing, SSR-safe rendering, events, a11y |
| `logo-engine.ts` | Path morph + eye reveal + blink; one rAF loop that only runs while something is moving |
| `logo-controller.ts` | Per-instance behaviour: hover priority, idle scheduler, visibility, reduced motion, cleanup |
| `logo-coordinator.ts` | Shared "one idle logo at a time" lock |
| `logo-paths.ts` | Path data extracted from your SVGs |
| `animated-logo.module.css` | Layout, focus ring, brand colours |

React only re-renders when the logo crosses the breakpoint; all animation writes straight to SVG attributes.

## Tested (headless Chromium, real DOM)

- **Modes:** 16/24/32/37px compact, 38/48/64/80/120px full. `2rem` is compact, `2.375rem` (=38px) is full. Live resizing across the breakpoint works.
- **Accuracy:** at rest, 0.000% of pixels differ from `Logow.svg`; the settled cat differs from `logo.svg` by 0.005% (sub-pixel anti-aliasing).
- **Hover:** ~450ms in, ~450ms out, no flicker, hover keeps the cat visible. CLS = 0, box size unchanged.
- **Blinking:** 8 blinks in 22s with irregular gaps, includes double blinks.
- **Idle:** randomized waits and durations, 1 or 2 blinks. Across 15 simultaneous animated logos, never more than 1 cat at once.
- **Priority:** hover mid-idle stays cat; leave returns to normal and idle resumes.
- **Environment:** hidden tab and off-screen both stop idle (resume on return); reduced-motion verified; touch tap, keyboard focus/blur, and 5× rapid mount/unmount (StrictMode-style) with no errors; zero leftover timers/observers after unmount.

**Verification:** The current project passes TypeScript, ESLint, the production Next.js build, and desktop/mobile browser smoke tests. Physical phones were not tested; check the focus ring against the final design.
