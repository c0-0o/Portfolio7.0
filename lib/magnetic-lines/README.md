# Magnetic Background Lines System

A data-driven, configurable magnetic-line background for a Next.js site, plus a
dev-only visual editor that art-directs it. One engine powers both — the
editor's preview *is* the production component (`interactive` prop just adds
selection/handles/debug on top).

## Install

Drop the `magnetic-lines/` folder into your project (e.g. `src/lib/magnetic-lines/`).
No extra dependencies — just React + TypeScript, which you already have.

## Production usage

```tsx
// app/layout.tsx (or wherever your page shell lives)
import { MagneticBackgroundLines, DEFAULT_SCENE } from "@/lib/magnetic-lines";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MagneticBackgroundLines config={DEFAULT_SCENE} />
      {children}
    </>
  );
}
```

Swap `DEFAULT_SCENE` for whatever you export from the editor (see below).
The component renders `position: fixed; inset: 0; pointer-events: none`,
so it never blocks clicks, scrolling, or text selection.

## Registering magnetic targets

Only elements you explicitly wrap participate — nothing else in the DOM is
scanned or made magnetic.

```tsx
import { MagneticTarget } from "@/lib/magnetic-lines";

<MagneticTarget id="hero-title" priority={2}>
  <h1>LET&apos;S</h1>
</MagneticTarget>

<MagneticTarget id="wordmark" as="span">
  <svg>...</svg>
</MagneticTarget>
```

Or, for more control (custom ref target, SVG group, etc.):

```tsx
import { useMagneticTarget } from "@/lib/magnetic-lines";

function Cta() {
  const ref = useMagneticTarget<HTMLButtonElement>({ id: "cta", strength: 1.2 });
  return <button ref={ref}>Get in touch</button>;
}
```

Geometry (via `getBoundingClientRect`) is cached and only re-measured on
resize/scroll/orientation change/fonts-ready/element resize (`ResizeObserver`)
— never every frame. Targets that scroll out of view auto-release
(`IntersectionObserver`). Hover, focus, and tap/touch all activate a target;
scrolling is never blocked.

## Running the editor

Mount it on any dev-only route, e.g. `app/dev/magnetic-editor/page.tsx`:

```tsx
"use client";
import { MagneticLinesEditor } from "@/lib/magnetic-lines";

export default function Page() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ height: "100vh" }}>
      <MagneticLinesEditor
        onChange={(config) => {
          // e.g. write to a file via an API route, or just copy from the
          // in-editor Export panel — see below.
        }}
      />
    </div>
  );
}
```

Register your real page's magnetic targets somewhere the editor route also
mounts (or temporarily render your hero inside the editor page) so the
Targets panel shows them and you can tune per-target strength/radius/priority
against the real geometry.

The editor autosaves its working config to `localStorage` (so a refresh
doesn't lose your work) and exposes **Export → Copy / Download** to get a
clean `MagneticLinesSceneConfig` JSON you paste into your production code
(or fetch at build/runtime). Production never reads `localStorage`.

## What's genuinely implemented

- One physics/rendering engine (`engine/lineEngine.ts`) used by both
  production and the editor's live preview — not two renderers.
- Three motion types (tension / floating / vibration), each with an
  envelope that anchors the ends and concentrates movement mid-line.
- Per-line motion start delays let matching lines begin at different times
  while preserving their configured motion speed and phase.
- Magnetic pull toward the **target's perimeter** (nearest point on its
  bounding rect), not its center and not the cursor — with smooth
  (smoothstep-based) falloff, per-line max-deformation clamp, and
  spring easing on both engage and release (no snapping/teleporting).
- Ambient cursor glow, fully separate from magnetic deformation: it only
  ever brightens nearby lines, never bends them, and is computed via cheap
  broad-phase distance checks.
- Zero React re-renders in the hot path: pointer position lives in a ref,
  target geometry lives in a plain-JS registry, and each frame mutates SVG
  `d`/`opacity`/gradient-stop attributes directly via refs.
- Per-line z-index layering, solo/hide, drag-to-reorder (including a
  Ctrl/Cmd-selected block), right-click duplicate/delete, motion presets,
  global-settings-as-defaults, undo/redo
  that coalesces a whole drag or text edit
  into one step, JSON import (validated + clamped, never crashes on bad
  data) and export, `prefers-reduced-motion` handling, and a dev-only
  editor with debug overlays (endpoint handles, IDs, target bounds).
- Independently ordered anchor routes can attach to either line endpoint or
  any editable custom-shape vertex. Routes have draggable, selectable
  waypoints, per-segment easing, and always/hover/click activation.
- Generated shape presets (triangle, rectangle, circle, smile, cylinder,
  cube, and more) are directly editable without a conversion step. Presets
  preserve their proportions in the preview; the smile preset includes a
  separate face outline, eyes, and mouth. Modified outlines and their line
  styles can be saved as reusable browser-local shapes.
  Lines and groups can be moved, scaled, rotated, and flipped from the inspector;
  selected lines can also be dragged in the preview.
- Anchor waypoint coordinates use compact, precise scrub fields. Each handle
  maintains a unique contiguous order; moving a point to an occupied order
  swaps the two points. Hover and click triggers use a wider invisible target
  that follows the animated line, so activation does not require pixel-perfect
  pointer placement. Selecting Hover starts the sequence on entry and defaults
  to continuing after the pointer leaves; returning or freezing are optional.
- While editing a selected line's geometry or anchors, the large canvas freezes
  at its current pose and labels the original Start/End handles. The sidebar
  keeps a compact, live animation preview of that selected line.
- Layer groups persist in scene configs and can be selected and moved together;
  Ctrl/Cmd-click ungrouped layers to form one, expand a group to view its
  members, then drag the group outline, resize/rotation handles, or use the
  group transform sliders. Double-click a line or group name to rename it.
- The editor keeps **Save & Test** in the top toolbar; playback, view, history,
  presets/templates, import/export, and reset actions are grouped in the
  adjacent three-dot menu. Right-click a line to duplicate/delete selected
  lines; right-click a group to duplicate, ungroup, or delete it.
- The selected-line inspector groups Start and End coordinates into compact
  X/Y pairs. Numeric values throughout the editor can be dragged vertically
  using each control's configured step, or clicked to type an exact value;
  anchor guidance is in the section help tooltip.
- Line appearance supports solid, linear, radial, center-out diamond, rainbow,
  and smoothly cycling random color modes. Rainbow displays the full spectrum
  across a line at once. Custom gradient and random modes use two to six
  editable colors with a draggable saturation/brightness picker, hue strip,
  and exact hex entry. Linear, radial, and diamond modes let you set each
  color's coverage along the line. Changing one color redistributes the
  remaining coverage proportionally across the others. Colors can be reordered
  by dragging or with the arrow keys. Random colors cycle while
  animation is playing, with an adjustable seconds-per-color transition.
  Legacy scenes default to evenly distributed colors and solid color.
- Base endpoints are always clamped to `[0,1]`; the animated/deformed
  curve is free to visually extend past the viewport edge.
- Type-checked end-to-end in strict TypeScript with zero `any` outside
  one documented ref-cast in `MagneticTarget`.

## Documented simplifications

Given the scope, a few things are deliberately simplified rather than
faked. None of these are "TODO / not implemented" stubs — they're real,
working, just less elaborate than the fullest possible version:

- **Target geometry is a bounding rect**, including for SVG targets (per
  the brief's own "use bounding-box info where practical"). It is not an
  arbitrary path outline, so a magnetic line seeks the nearest point on a
  rectangle, not the exact silhouette of non-rectangular SVG art.
- **One dominant active target at a time** (highest `priority`, ties
  broken by whichever was hit first) drives magnetic deformation, rather
  than a weighted blend of every simultaneously-active target. Multiple
  targets can each be independently registered/configured and used one at
  a time; true multi-target blending would be a follow-up.
- **Glow gradients run along the line's base (undeformed) axis**
  (`userSpaceOnUse` from the base `from`→`to` points), not along the live
  curved arc-length. For the intended thin/restrained lines this tracks
  the visible glow position closely; it's a simplification for sharply
  curved states.
- **"Inherited vs. custom" per-field indicators** aren't wired up — global
  settings act as the defaults new lines are built from, and "Apply to
  all lines" pushes them onto existing lines per-section on demand,
  rather than a live, always-on inheritance chain per field.
- **Layering (z-index) controls SVG paint order**, giving lines a
  behind/between/in-front relationship to each other and to fixed-position
  UI via normal stacking context — there's no true masking/clipping
  against a specific object's exact silhouette for pass-through effects.
- Reduced motion scales amplitude and magnetic pull down (≈15%) rather
  than disabling motion outright, per the brief's "keep visual structure
  where possible."

## File map

```
types.ts                    Scene/line/target data model
engine/math.ts               clamp/lerp/falloff/rect-perimeter/Catmull-Rom→Bezier
engine/targetRegistry.ts     Non-React runtime registry for magnetic targets
engine/lineEngine.ts         The one per-frame compute function
useMagneticTarget.tsx        Hook + <MagneticTarget> wrapper for registration
MagneticBackgroundLines.tsx  Production component (also used as editor preview)
defaultScene.ts              Starter 12-line deterministic composition + presets
editor/validate.ts           Import sanitation/clamping, line factory helpers
editor/history.ts            Coalescing undo/redo stack
editor/MagneticLinesEditor.tsx  The full visual editor
index.ts                     Barrel export
```
