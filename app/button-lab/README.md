# Portfolio – Opening Scene + Interactive Hero (Next.js)

One page experience made of three pieces that hand off to each other:

1. **Opening scene** – your loader: grid pops in, PORTFOLIO letters rise, then the spinner stops, "Loading" becomes **Ready**, one small bounce, and flat cards **ripple outward from the icon**, each flipping around its own radial axis.
2. **Hand-off** – on desktop the backs of those flipping cards *are* the hero tiles (identical geometry), so the ripple lands directly on the finished hero. On phones the ripple lands on the page colour and the hero tiles flip in.
3. **Hero** – 24 tiles (desktop 6×4) / 16 tiles (phone 4×4) that form one continuous portrait, a hover **pop** (same feeling as the opening grid) with a neighbour ripple, and a smooth **scroll exit** where the type leaves and every tile flips back in a diagonal wave.

Page gutter: `--pad = clamp(24px, 5vw, 72px)` → **72px at 1440px wide, shrinking smoothly to 24px on phones**. The header and the hero type both use it.

---

## 1. Quick start

**New project**

```bash
npm install
npm run dev        # http://localhost:3000
```

**Existing Next.js project (App Router, TypeScript)** – copy the folders listed in section 2, then:

1. Make sure `tsconfig.json` has the `@/*` path alias (`"paths": { "@/*": ["./*"] }`). Next.js's default setup already does.
2. Replace your `app/layout.tsx` with the one here, or merge it (fonts + the small inline script + `import "./globals.css"`).
3. Use the component in `app/page.tsx`:

```tsx
import SiteShell from "@/components/site/SiteShell";

export default function Page() {
  return (
    <SiteShell>
      {/* your sections go here */}
    </SiteShell>
  );
}
```

Requirements: Next.js 13.4+ (App Router), React 18 or 19, TypeScript. No other dependencies.

---

## 2. Where every file goes

```
portfolio-hero/
├─ README.md                          (this file)
├─ package.json / tsconfig.json / next.config.mjs     only needed for a NEW project
│
├─ app/
│  ├─ layout.tsx                      Fonts (DM Sans + Lilita One), global CSS, pre-paint script
│  ├─ globals.css                     Tokens (--bg, --lime, --pad, --nav…), reset, header, scroll-lock
│  └─ page.tsx                        <SiteShell> + your sections
│
├─ components/
│  ├─ site/
│  │  ├─ SiteShell.tsx                Wires Header + Hero + Intro + your content together
│  │  ├─ Header.tsx                   Logo, "UI/UX Designer" tag (shown while loading), nav
│  │  └─ NextSection.tsx              Placeholder for the section after the hero – delete it
│  │
│  ├─ intro/
│  │  ├─ PortfolioIntro.tsx           Markup of the opening scene (letters, spinner, loader grid)
│  │  ├─ intro-controller.ts          The whole choreography (framework-free class)
│  │  └─ intro.css                    Loader grid, cards, letters, spinner
│  │
│  └─ hero/
│     ├─ Hero.tsx                     Markup of the hero + React wrapper
│     ├─ hero-controller.ts           Tiles, hover pop, ripple, scroll exit, optional lines
│     ├─ hero-config.ts               ★ Everything you are likely to tune
│     └─ hero.css                     Hero layout, type, scroll exit, responsive rules
│
└─ public/
   ├─ hero/portrait.webp              The cut-out portrait (transparent background)
   └─ intro/                          Logo, star, tag icon and the 9 letter SVGs
```

Assets are referenced by absolute URL (`/hero/portrait.webp`, `/intro/…`), so keep the `public/` folders exactly as they are.

---

## 3. How the pieces talk to each other

```
SiteShell
 ├─ <Header/>                  ids used by the intro: #tag (visible while loading), #nav (fades in)
 ├─ <Hero ref={heroRef}/>      exposes show() / hide() / play() / tileBack(i) / cols / mobile
 ├─ {children}                 your sections
 └─ <PortfolioIntro getHero={() => heroRef.current}/>
```

The intro never reaches into the hero's DOM except through that ref. At the end of the ripple it does, in one frame:

```
hero.show(); hero.play({ skip: seamless });   // tiles already in place on desktop -> only the type animates
loader layer hidden                           // pixel-identical underneath
```

Ids the intro depends on: `#gA` `#open` `#ld` `#ico` `#star` `#hint` `#tag` `#nav` (and `#replay` if enabled). Don't rename them without changing `intro-controller.ts`.

---

## 4. Configuration

### 4.1 Intro behaviour (props on `<SiteShell intro={{…}}>`)

| Prop | Default | What it does |
|---|---|---|
| `once` | `true` | Play only on the first visit of a browser session. Repeat visits skip straight to the hero (which plays its own tile entrance). |
| `minDuration` | `8000` | Minimum time (ms) the loader stays up. It also waits for fonts and images. |
| `showReplay` | `false` | Dev helper: shows a "↻ Replay intro" button (and the **R** key). Leave off in production. |
| `storageKey` | `"portfolio-intro-seen"` | sessionStorage key. **Must match** the key in the inline script in `app/layout.tsx`. |

```tsx
<SiteShell intro={{ once: false, minDuration: 6000, showReplay: process.env.NODE_ENV === "development" }}>
```

**Remove the intro completely:** `<SiteShell withIntro={false}>` – the hero then plays its own diagonal tile entrance on load.

### 4.2 Hero (`<SiteShell hero={{ config: {…} }}>`, defaults in `hero-config.ts`)

Pass only what you want to change:

```tsx
<SiteShell hero={{ config: { hover: { lift: 10, tilt: 2 }, scroll: { range: 1.2 } } }}>
```

| Setting | Default | Meaning |
|---|---|---|
| `mobileBreakpoint` | `760` | Width (px) at/below which the 4×4 phone layout is used. Keep equal to the `760px` media query in `hero.css`. |
| `layout.desktop.tones` / `layout.mobile.tones` | see file | One letter per tile, row by row (`w` = transparent, `G` = brand green, others = greys/gradients defined in `TONES`). Edit to recolour tiles. |
| `portrait.desktop.heightScale` | `1.02` | Portrait height as a multiple of the grid height. Bigger = more zoomed in. |
| `portrait.desktop.faceX` / `anchor` | `400` / `0.5` | Source-pixel x of the face centre and where it lands horizontally (0–1 of grid width). Move the face left/right with `anchor`. |
| `portrait.desktop.top` | `0.1` | Vertical offset (fraction of grid height). |
| `portrait.mobile.widthScale/left/top` | `1.76 / -0.25 / -0.01` | Same idea for phones. `left` moves the face to reveal more/less of the green tile. |
| `entrance.stagger` | `85` | ms between diagonal neighbours in the entrance wave. |
| `hover.lift` | `16` | px the hovered tile pops toward you. |
| `hover.tilt` | `3` | Max degrees of tilt following the pointer. |
| `hover.scale` | `0.012` | Extra scale on the hovered tile. |
| `hover.shadowRGB` / `shadowAlpha` | `46,54,36` / `0.16` | Shadow under the hovered tile (same as the opening cards). |
| `hover.neighbours` | `0.25 / 0.07` | How strongly adjacent / two-away tiles answer (fraction of the hovered tile). |
| `hover.tabletIntensity` | `0.5` | Multiplier below 1025px wide. Phones/touch have no hover at all. |
| `scroll.range` | `1.0` | Scroll distance (in viewport heights) for the exit. Larger = slower exit. |
| `scroll.smoothing` | `110` | Inertia in ms. Higher = softer, lazier. |
| `scroll.flipSpread` / `flipLength` | `0.5 / 0.42` | How spread-out the diagonal flip-back wave is / how long each tile's flip takes. |
| `lines.enabled` | `false` | The faint curved-lines background. **Off for now.** Set `true` to bring it back (draws on a canvas, bends near the pointer). |

### 4.3 Side gutter / sizes (`app/globals.css`)

```css
--pad: clamp(24px, 5vw, 72px);        /* left/right gutter */
--nav: max(56px, 9vh);                /* header row height; the tile grid starts below it */
--g: 1px;                             /* gap between tiles (loader grid AND hero grid) */
```

`--pad` and `--g` are shared by the header, the hero type and both grids. The loader and hero grids line up exactly **only if both use the same `--nav` and `--g`** – that is what makes the hand-off seamless, so change them in this one place.

### 4.4 Text and portrait

- Change the name / title text in `components/hero/Hero.tsx` (`Designer`, `UI/UX`, `Hey, I'm`, `Dipak Pahari`).
- Replace the portrait: overwrite `public/hero/portrait.webp` with a transparent cut-out. If the size changes, update `portrait.width/height` in `hero-config.ts`, then adjust `anchor`/`faceX`/`heightScale` until the face sits where you want. Tiles are cut from one shared image, so they always stay aligned.
- Fonts come from `next/font/google` in `app/layout.tsx` as CSS variables `--font-dm` and `--font-lilita`.

### 4.5 Scroll exit – what it does

Scroll progress is smoothed, then drives:
- the tile mosaic rising slightly faster than the page, and tiles spreading a touch,
- **every tile flipping back** to the page colour in a top-left → bottom-right wave (the mirror of the entrance),
- three type layers leaving at different speeds, then fading (`DESIGNER` → `UI/UX` → name),
- the "Scroll to Discover" hint fading first.

It is tied to real scroll position: nothing is pinned, nothing blocks scrolling, and it reverses when you scroll back up. Tune it with `scroll.*` above and the `.h-des / .h-ui / .h-hey` speeds at the bottom of the "scroll exit" block in `hero.css`.

---

## 5. Behaviour notes

- **Desktop (>760px):** 6×4 tiles, hover pop + neighbour ripple, seamless hand-off.
- **Tablet (≤1024px):** hover effects at half strength.
- **Phones / touch:** 4×4 tiles, no hover effects, hero text stacked above the grid, ripple lands on the page colour then the tiles flip in.
- **Reduced motion:** the intro is skipped and the hero appears in its final state; no hover, no scroll animation.
- **First visit only:** a tiny inline script in `layout.tsx` locks scrolling during the intro and, on repeat visits, hides the intro layers before first paint (no flash). `<noscript>` styles make sure the page is never left locked.
- The animation loop pauses when the hero is off-screen or the tab is hidden, and wakes on pointer/scroll.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Intro never goes away / page stays locked | An error before the intro finished. Open the console. Make sure the ids in section 3 exist and `public/intro/*` files are present. |
| Loader tiles stay on top of the hero after the ripple | `#gA.hid{display:none}` (end of `intro.css`) was removed or overridden. |
| Portrait tiles don't line up with the loader | `--nav` or `--g` was changed in only one place, or `hero.css` `.h-grid` inset was edited. |
| Hero never appears (white page after the intro) | `PortfolioIntro` isn't receiving the hero ref: pass `getHero={() => heroRef.current}`. |
| Face is cut off / too big | Tune `portrait.*` in `hero-config.ts`. |
| Fonts look wrong | `next/font` variables not applied: check `className` on `<html>` in `layout.tsx`. |
| Class-name clash with your CSS | `intro.css` uses short global names (`.grid .card .f .b .s .title .row .star .ld .ico .hint`). `hero.css` is prefixed `h-`. If something clashes, prefix the intro names (they appear only in `intro.css`, `PortfolioIntro.tsx` and `intro-controller.ts`). |
| Tailwind: spacing looks off | `globals.css` contains a small reset (`*{box-sizing:border-box;margin:0}`). Remove it if Tailwind's preflight already does this. |

---

## 7. What was tested

Bundled the real files (React 18/19, **StrictMode on**) and ran them in headless Chromium:

- intro → ripple → hand-off, replay, repeat-visit skip, reduced motion, no console errors,
- loader tiles vs hero tiles: identical rectangles (0.000px), 1px gaps,
- gutter measured at 1440 / 1280 / 1024 / 768 / 600 / 390 px (72 → 64 → 51 → 38 → 30 → 24 px),
- hover pop (16px lift, soft shadow, neighbours answer, returns flat), scroll exit (staggered wave, restores on scroll-up),
- the three framework-free modules pass strict `tsc`.

**Not done here:** a real `next build`, type-checking the `.tsx` files against `@types/react`, and real-device phone testing. Run `npm run build` once on your side to confirm.
