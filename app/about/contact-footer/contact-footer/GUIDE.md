# Contact + Footer (Next.js App Router) - mobile and desktop in one component

## Files
```
components/
  ContactFooter/
    ContactFooter.tsx          <- NEW
    ContactFooter.module.css   <- NEW
    assets/
      cat-logo.svg             <- your logo (the cat). Used on mobile AND desktop.
```
If your desktop logo (`eye-detail-master-copy.svg`) is a different file from `cat-logo.svg`, drop it in `assets/` and change the one `import logo from ...` line.

Uses `framer-motion` (already in your project) and the same fonts as the navbar (see below). No other setup.

## Add it to the site (app/layout.tsx)
Put it after `{children}` so it shows on every page:
```tsx
import { Navigation } from "@/components/Navigation/Navigation";
import { ContactAndFooter } from "@/components/ContactFooter/ContactFooter";

<body>
  <Navigation />
  {children}
  <ContactAndFooter />
</body>
```
Fonts: if you followed the navbar guide, DM Sans and Lilita One are already set up as `--font-dm-sans` and `--font-lilita` on `<html>`. If not:
```tsx
import { DM_Sans, Lilita_One } from "next/font/google";
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400","500","700"], variable: "--font-dm-sans", display: "swap" });
const lilita = Lilita_One({ subsets: ["latin"], weight: "400", variable: "--font-lilita", display: "swap" });
<html lang="en" className={`${dmSans.variable} ${lilita.variable}`}>
```
To use it only on some pages, render `<ContactAndFooter />` in those pages (or in a route group's layout) instead of the root layout.

## Responsive
Breakpoint 820px (same as the navbar).

| | mobile (< 820px) | desktop (>= 820px) |
|---|---|---|
| side padding | 24px | 72px at 1440px+, shrinks smoothly to 24px at 820px |
| contact | headline, text, then email + small arrow circle on one row | headline + text on the left, big arrow circle on the right, email below |
| footer | brand, tagline, Explore, Elsewhere stacked | brand left, Explore and Elsewhere columns right |
| Explore links | `Home / Work` then `About / Playground / Contact` | `Home / Work`, `About / Playground`, `Contact` |
| bottom row | copyright, then Back to top | copyright left, Back to top right |

Everything else scales smoothly with `clamp()`: headline 44px on a 390px phone up to 86px at 1440px, the arrow circle 48px up to 116px, email 16px up to 26px, section padding 48px up to 80px.
Colors switch like your two designs: eyebrow and description are `#4b741f` on mobile and `#62695c` on desktop.

## Animations (from your video)
Plays once, when the block scrolls into view:
1. The whole block fades in (0.6s).
2. The eyebrow text reveals word by word.
3. The headline reveals word by word (words go from dim to full, 0.09s apart): HAVE, A, GOOD, IDEA?, LET'S, MAKE, IT, REAL.
4. The footer follows in a stagger: brand, tagline, Explore, Elsewhere, bottom row.

Hover and press:
- Arrow circle: grows slightly, the arrow flies up-right, shrinks when pressed.
- Email: the underline grows away from the text.
- Footer links turn lime, and the ↗ arrows nudge. Back to top: the ↑ nudges up and the page scrolls smoothly.

`prefers-reduced-motion`: no stagger, the block just fades in, and Back to top jumps instead of scrolling smoothly.

## Edit your content
Top of `ContactFooter.tsx`: `EMAIL`, `EXPLORE` (routes), `ELSEWHERE` (replace the placeholder social URLs). Headline, text and eyebrow are plain strings in the JSX.

## Notes
- The email is now a real `mailto:` link, styled exactly like your underlined input, and the arrow circle uses it too. Your design had an `<input>`, which cannot be clicked to send mail.
- The eyebrow dot is lime on lime, as in your design, so it is invisible. Change `.contactDot` background in the CSS if you want it visible.
- The block starts hidden and appears when it enters the screen. With JavaScript disabled it would stay hidden.
- Typechecked with `tsc --strict` against Next 14 types. I could not view it in a browser, so check the animation timing against your video in your project.
