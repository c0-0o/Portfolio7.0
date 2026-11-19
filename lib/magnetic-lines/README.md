# Magnetic Background Lines System

A data-driven, configurable magnetic-line background for a Next.js site, plus an
optional dev-only visual editor that art-directs it. One engine powers both —
the editor's preview *is* the production component (`interactive` prop just adds
selection/handles/debug on top). The production entry point does not import the
editor folder, so the background continues to work if the editor and its route
are removed later.

For a focused, editor-only feature and workflow guide, see the project
[`README.md`](../../README.md).

## Install

Drop the production files from `magnetic-lines/` into your project (e.g.
`src/lib/magnetic-lines/`). The background has no extra dependencies beyond
React + TypeScript; the optional editor folder is not required.

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

`PersistentMagneticBackground` can be mounted once in the root layout to make
the renderer available on every route. An optional route scene overrides that
route's built-in default. Selecting a page in the visual editor loads the same
route scene shown on the live page, including its built-in default when no
override exists. Edits are saved automatically to the selected route; **Use
page default** removes that route's override.
Built-in routes and routes visited in this browser appear in the dropdown;
saved overrides remain listed until removed. Page scene edits are written to
`data/magnetic-page-scenes.json` through the development server, so they persist
across browser sessions and are tracked with the project. Commit that file to
ship the saved backgrounds. Browser storage is only a preview/cache; existing
browser-only scene overrides are imported into the project file once, on the
first development-editor sync. The client loads project scenes through the
server API instead of importing the editable JSON file, so auto-saves do not
force a full development-page reload.
Visited routes are collected automatically in the editor's page dropdown.
**Preview page** shows the selected route inside the editor with the current
in-progress scene, without navigating away or requiring the scene to be saved.

## Registering magnetic targets

You can add targets without changing page code: open the editor's **Targets**
panel, choose **Pick page element**, and click an element in the live preview.
The editor saves a unique selector with the page scene and binds that element
when the page is rendered. If page markup changes and a selector stops matching
exactly one element, re-pick it from the preview. The editor keeps the page
visible while you edit, highlights the selected target in place, and shows a
small element preview in the target list (hover it to enlarge it).

Each saved target can activate on hover, keyboard focus, click, and/or touch.
Click can stay active while pressed or toggle on/off. Assign a target to all
lines or choose individual lines. Expand a line's separate **Magnet** and
**Glow** controls to edit that line's existing effect settings and choose its
own triggers; effects inherit the target's default triggers until customized.
A line can be assigned to one specific target at a time; the target panel
reflects both its line list and the line's target setting, and moving a line to
another target clears its old explicit assignment.
Use **None** to clear the selected target's scope; its lines become available
for other targets that include them. The target's hover, focus, click, and touch
settings provide defaults; each line's **Magnet** and **Glow** dropdowns can
edit that effect and override its triggers independently. Disabled effects are
identified in the target line list. Use **Open full line settings** for the
complete editor for that line. Target-level strength, radius, and priority
remain shared by assigned lines. New targets respond on all lines by default.
Page content remains above the background; the target editor can reorder
background lines, and the same order controls which lines occlude one another
at crossings.
Pausing the editor preview freezes motion without replacing path geometry with
its straight-line fallback.

The code API is still available for elements that need a stable, explicit
identifier or custom registration:

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
import { MagneticLinesEditor } from "@/lib/magnetic-lines/editor/MagneticLinesEditor";

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

Targets picked from the live preview are saved with that page's scene and do
not require editor-route wrappers. Existing `MagneticTarget` / `useMagneticTarget`
registrations remain available for code-defined targets. Open **Preview page**
to validate saved selectors against the actual route; missing or ambiguous
selectors are reported in the Targets panel and can be re-picked there.

The editor still keeps temporary workspace state and reusable shapes/templates
in `localStorage`. Selected page backgrounds autosave to the project file above;
the editor API is development-only, and production reads the committed file.
**Export → Copy / Download** remains available for standalone scene configs.

## What's genuinely implemented

- One physics/rendering engine (`engine/lineEngine.ts`) used by both
  production and the editor's live preview — not two renderers.
- Three motion types (tension / floating / vibration), each with an
  envelope that anchors the ends and concentrates movement mid-line.
- Motion speed is cycles per second and amplitude is peak displacement;
  spatial frequency applies to floating/vibration (not tension), while
  magnetic response is a separate setting.
- Per-line motion start delays let matching lines begin at different times
  while preserving their configured motion speed and phase.
- Magnetic pull toward the **target's perimeter** (nearest point on its
  bounding rect), not its center and not the cursor — with smooth
  (smoothstep-based) falloff, per-line max-deformation clamp, and
  spring easing on both engage and release (no snapping/teleporting).
- Ambient cursor glow, fully separate from magnetic deformation: it only
  ever brightens nearby lines, never bends them, and is computed via cheap
  broad-phase distance checks.
- Optional per-line surface texture with filtered film grain, directional
  fibers, adjustable lightweight silk filaments, braided rope plies, rounded
  necklace beads, or polished interlocking metal links. Bead threads can be shown or hidden.
  Material weight affects cursor, airflow, and gravity response: silk sags less,
  while rope, beads, and metal carry more weight. Silk filaments use irregular,
  lightly overlapping spacing and share a smoothed airflow bend instead of
  wobbling independently. Merging path points across separate strokes now
  joins those strokes; selected points can also be explicitly connected or
  kept as separate strokes. Closed custom paths keep their seam connected by
  default, with an option to let airflow separate it. Flow and energy overlays
  and silk filaments use cyclic tangents at closed seams to prevent visible
  kinks.
- Optional scene environment with smoothly sampled airflow paths, adjustable
speed, strength, and radius. Narrow airflow radii make localized bends, while
wider radii spread the wind across more of a line. Colored lights have draggable travel
  endpoints, adjustable intensity, radius, speed, and loop/once playback.
  Global settings and individual lines can each have several airflow paths and
  light sources. Each airflow path has its own radius and a translucent
  on-canvas corridor shows its influence. Lines are opted in individually;
  each line can use the shared airflow and lights, configure either effect
  independently, or turn it off.
  Environment guides and light handles appear in the editor only while the
  Environment section is open. Random airflow drifts smoothly through longer,
  irregular-duration calm, breeze, and gust periods rather than switching on a
  fixed turn-by-turn schedule.
  Global and individual settings share the existing animation loop and spring
  easing.
- The opening-scene line reveal runs alongside ambient line motion and flow.
  Lines unfurl upward like growing stems in slow, three-line waves, with a
  gradual draw and fade between waves. Once the reveal finishes, completed CSS
  draw animations are cleared.
  Every non-node filament carries three slow inward pulls with rests between
  them. Each pull grows wider and brighter while retaining its configured green
  color; the sequence quickens before the 10-second opening exits. The three
  nodes keep their separate breathing animation, and low-strength random
  airflow keeps filament drift softly varied.
- Optional Flow & Energy overlays follow each line's live, multi-stroke geometry
  in that same animation loop, in both the editor and production renderer. The
  initial set includes electric current, continuous light, plasma, fiber optic,
  and energy pulse effects, with global defaults, per-line overrides, editable
  placement, movement, appearance, pulse rhythm, layers, and 15 bundled presets.
  Selected-line editor previews keep enabled flow and silk effects moving while
  line geometry is paused, so effect changes remain visible during editing.
  Flow settings are
  backward-compatible with older saved scenes and do not alter the line's
  material texture. On silk, effects follow each filament at a matching
  thread-scale width; on rope, they follow the braid plies. Paper, beads, and
  metal keep their distinct surface detailing while energy travels at a
  material-matched width along the line or supporting thread.
- Optional line-to-line interaction treats other visible lines as soft
  obstacles. Enabled lines begin bending within the influence radius and
  maintain a configurable gap between their visible stroke edges; disabled
  lines remain obstacles but do not move in response. The solver checks
  segment geometry (not just sampled vertices), combines nearby obstacle
  forces, and smooths each stroke independently to reduce abrupt bends;
  separate shape strokes never influence one another as self-obstacles.
- Per-line gravity can be enabled independently, tuned by strength, and pinned
  at either endpoint or any editable shape vertex, including vertices on
  multi-stroke presets such as cubes. Unpinned sections fall toward the
  viewport bottom; a line with no pins settles along the bottom edge. Gravity
  is disabled by default.
- Generated and custom shapes can be marked non-bendable in the shape controls.
  Rigid contours ignore shape motion, endpoint/path anchors, gravity, magnetism,
  airflow, cursor influence, and line-to-line interaction while preserving
  their editable preset geometry. The setting can inherit globally or be
  overridden per line.
- Cursor influence offsets clear immediately when disabled, rather than
  continuing to repel or attract during the spring-release period. Cursor
  deformation follows gravity-sagged geometry and respects gravity-pinned points.
- The editor toolbar switches between the Magnetic Lines editor and a
  full-page Cursor Effects settings view.
- The shared-layout background supports exact pathname-specific scene
  overrides, with route-specific defaults, automatic page loading and saving,
  and an editor action for clearing a route override.
- Cursor settings update an isolated preview that responds to pointer
  movement and clicks. Website-wide cursor changes require an explicit
  apply action; saved templates can be reused later. The editor includes
  light/dark behavior previews, editable cursor/border/trail/click colors,
  glass blur and transparency, glitch and arcade feedback, and opt-in
  synthesized hover/click sounds. The system-cursor option leaves the native
  OS pointer intact, and website-wide changes require explicit application.
  Reset restores the native cursor; pointer states stay native until customized.
  PNG, JPEG, WebP, or sanitized SVG cursor images support editable size and hotspot.
  Custom cursor presets are drawn shapes rather than emoji glyphs.
  The built-in Spider Pounce preset leaves the native pointer visible, trails
  it with a walking spider, crouches when the pointer stops, and pounces to the
  click location without drawing a web trail.
- Zero React re-renders in the hot path: pointer position lives in a ref,
  target geometry lives in a plain-JS registry, and each frame mutates SVG
  `d`/`opacity`/gradient-stop attributes directly via refs.
- Per-line z-index layering with front/back controls, drag-to-reorder (including a
  Ctrl/Cmd-selected block), adjustable crossing gaps, solo/hide, right-click duplicate/delete, motion presets,
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
- The scene-template library includes 32 bundled scenes across eight searchable
  categories, with a live preview rendered by the production component. Apply
  a bundled or saved scene to the selected page, or save, duplicate, rename,
  and delete browser-local templates without changing the bundled catalog.
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
sceneValidation.ts           Import sanitation/clamping, line factory helpers
shapePresets.ts               Generated shape geometry used by scenes and editor
editor/history.ts            Coalescing undo/redo stack
editor/MagneticLinesEditor.tsx  The full visual editor
index.ts                     Barrel export
```
