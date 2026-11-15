# Shared Contact + Footer

## Files
```
components/
  portfolio/
    ContactAndFooter.tsx
    ContactAndFooter.module.css
```

`SiteShell` renders this shared component after its portfolio pages, and the standalone Work page uses the same component. It combines the contact section and footer so their content, assets, animations, and responsive behavior stay consistent.

It uses the project fonts from the root layout and `framer-motion`, which is already installed.

## Responsive
Breakpoint 820px (same as the navbar).

| | mobile (< 820px) | desktop (>= 820px) |
|---|---|---|
| side padding | fluid 16px–40px | fluid 40px–72px, capped at 72px |
| contact | headline, text, then email + small arrow circle on one row | headline + text on the left, big arrow circle on the right, email below |
| footer | brand, tagline, Explore, Elsewhere stacked | brand left, Explore and Elsewhere columns right |
| Explore links | `Home / Work` then `About / Playground / Contact` | `Home / Work`, `About / Playground`, `Contact` |
| bottom row | copyright, then Back to top | copyright left, Back to top right |

Everything else scales smoothly with `clamp()`: headline 44px on a 390px phone up to 86px at 1440px, the arrow circle 48px up to 116px, email 16px up to 26px, section padding 48px up to 80px.
Colors switch like your two designs: eyebrow and description are `#4b741f` on mobile and `#62695c` on desktop.

## Animations (from your video)
The contact band and footer each reveal once when their own section enters the viewport, on mobile and desktop:
1. Each section fades and rises into place.
2. The eyebrow text reveals word by word.
3. The headline reveals word by word (words go from dim to full, 0.09s apart): HAVE, A, GOOD, IDEA?, LET'S, MAKE, IT, REAL.
4. Footer items rise and fade in sequence: brand, tagline, Explore, Elsewhere, bottom row.

Hover and press:
- Contact arrow uses `public/Contactarrow.svg`; the circle grows and the arrow moves up-right on hover, focus, and press.
- Email: the underline grows away from the text.
- Footer social links use `public/Sociallinks.svg`; links turn lime and the arrows nudge on hover, focus, and press. Back to top: the ↑ nudges up and the page scrolls smoothly.

`prefers-reduced-motion`: no stagger, the block just fades in, and Back to top jumps instead of scrolling smoothly.

## Edit your content
Top of `ContactAndFooter.tsx`: `EMAIL`, `EXPLORE` (routes), and `ELSEWHERE` (social URLs). Headline, text and eyebrow are plain strings in the JSX.

## Notes
- The email is now a real `mailto:` link, styled exactly like your underlined input, and the arrow circle uses it too. Your design had an `<input>`, which cannot be clicked to send mail.
- The eyebrow dot is lime on lime, as in your design, so it is invisible. Change `.contactDot` background in the CSS if you want it visible.
- The block starts hidden and appears when it enters the screen. With JavaScript disabled it would stay hidden.
- Typechecked with `tsc --strict` against Next 14 types. I could not view it in a browser, so check the animation timing against your video in your project.
