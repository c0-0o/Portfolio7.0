# Custom Cursor System Audit

## Scope and evidence

This document began as a read-only audit; the later phase sections record subsequent implementation and validation. The original audit did not change source code, Magnetic Lines settings, browser storage, or dependencies. “Verified” means the behavior or setting was traced through its implementation unless a later phase explicitly records a browser check. The initial snapshot found no cursor-related tests; Phase 2.7 and Phase 3 added the tests described below. This is not an exhaustive cross-browser certification or performance benchmark.

The main implementation is in [CursorEffects.tsx](./lib/cursor-effects/CursorEffects.tsx), its IDs, defaults, and sanitization are in [config.ts](./lib/cursor-effects/config.ts), and the global overlay is mounted from [layout.tsx](./app/layout.tsx). Magnetic Lines has its own runtime and engine; see [MagneticBackgroundLines.tsx](./lib/magnetic-lines/MagneticBackgroundLines.tsx), [lineEngine.ts](./lib/magnetic-lines/engine/lineEngine.ts), and [MagneticLinesEditor.tsx](./lib/magnetic-lines/editor/MagneticLinesEditor.tsx).

## 1. Existing cursor architecture

### Default cursor and activation

- `CursorEffectsOverlay` is mounted globally by the root layout. It draws into a fixed, full-viewport Canvas 2D layer; the canvas and glass lens have `pointer-events: none`.
- The website uses the browser/OS cursor by default. The editor’s initial draft is `modern-arrow`, but it is preview-only until Apply. The overlay reads a separate local-storage applied flag before enabling the website cursor.
- When a custom cursor is active, a root data attribute enables CSS that hides native cursors. State-specific native fallbacks temporarily restore the browser cursor. Selecting System cursor or Reset restores the native cursor.
- Main website rendering is limited to fine-pointer/hover devices. A reduced-motion media query suppresses trails and click bursts.
- The overlay tracks pointer state in refs and draws with Canvas 2D; it does not set React state on every pointer movement. The main overlay, preview, and showcase share drawing helpers, but their pointer/event loops are separate.

### Selection, rendering, animation, and interaction flow

1. `getCursorState` maps text fields, links, buttons, inline/computed CSS cursors, and selected cursor-native markers to a cursor state.
2. `resolveCursorConfig` selects the base cursor or an enabled state override. Unconfigured recognized states deliberately return `null`, preserving the native browser cursor.
3. Pointer movement updates coordinates, hover target, and Spider history; it schedules a canvas frame and optionally creates movement particles/trails.
4. The overlay draws the selected cursor, movement effects, click bursts, glass lens, and optional hover styling. CSS hides the OS cursor only while the custom cursor is active.
5. Click events create click bursts, sound, game feedback, and/or Spider pounce. No event handler prevents the underlying click.

The actual System cursor is the OS/browser cursor, not a drawn approximation. A custom-image cursor is loaded as an image and drawn into Canvas. Canvas shape rendering, image handling, `getCursorState`, and `resolveCursorConfig` are in [CursorEffects.tsx](./lib/cursor-effects/CursorEffects.tsx#L61).

## 2. Complete existing cursor inventory

There are **26 built-in entries** in `CURSOR_PRESETS`, plus the separately handled System cursor and Custom image modes. The preset list is in [config.ts](./lib/cursor-effects/config.ts#L67); shape branches are in [CursorEffects.tsx](./lib/cursor-effects/CursorEffects.tsx#L282).

All built-ins use the same size, color, opacity, border, shadow/glow, hover, movement, and click pipeline unless stated otherwise. The selected cursor does not have individual movement/click/drag handlers. The small default wobble is applied by the shared renderer, not authored separately for each cursor.

| ID / name | Verified appearance and intrinsic animation | Distinctness / limitation |
|---|---|---|
| `modern-arrow` — Modern arrow | Filled pointer polygon with outline. | Same polygon as Minimal pointer; no intrinsic animation. |
| `white-circle` — White circle | Circle with hard-coded white fill and configurable outline. | Same circle geometry as the other circle entries; ignores cursor fill color. |
| `black-circle` — Black circle | Circle with hard-coded near-black fill and configurable outline. | Same geometry; ignores cursor fill color. |
| `outlined-circle` — Outlined circle | Circle filled from the cursor background color, with configurable outline. | Same base geometry as the circle variants. |
| `minimal-pointer` — Minimal pointer | Same filled pointer polygon as Modern arrow. | Visual duplicate of Modern arrow at equal settings. |
| `abstract` — Abstract | Unfilled eight-point diamond/loop outline. | Shares geometry with Artistic. |
| `liquid` — Liquid | Ellipse whose radius and angle oscillate with render time. | The shape only animates while frames are being drawn; the production renderer does not continuously redraw every idle cursor. |
| `blob` — Blob | Ellipse with the shared slight cursor rotation. | Same general base shape as Liquid, without Liquid’s radius oscillation. |
| `artistic` — Artistic | Abstract’s eight-point loop with translucent fill. | Same outline geometry as Abstract; the fill is the principal difference. |
| `cat` — Cat | Cat-head silhouette with ears and eyes. | Static shape apart from shared renderer behavior. |
| `paw` — Cat paw | Paw pads drawn by a shared paw helper. | A single shape; no dedicated gait or paw-step animation. |
| `heart` — Heart | Heart path, fill, and optional outline. | Static shape apart from shared renderer behavior. |
| `flower` — Flower | Six petals and a center. | Same drawing branch as Floral. |
| `smiley` — Smiley | Circular face, eyes, and smile. | Static shape apart from shared renderer behavior. |
| `spider` — Spider | Eight articulated legs, two body sections, eyes, and short mandibles. | Bespoke delayed gait, direction, crouch, and pounce; detailed separately below. |
| `web` — Web | Eight radial lines and three polygonal rings. | Static web; it does not emit a web trail by itself. |
| `ghost` — Ghost | Ghost silhouette with eyes and a scalloped lower edge. | Static shape apart from shared renderer behavior. |
| `skull` — Skull | Rounded skull, eye sockets, and lower jaw/teeth block. | Static shape apart from shared renderer behavior. |
| `pixel-arrow` — Pixel arrow | Angular filled pointer polygon. | Separate geometry from the other arrows; no intrinsic animation. |
| `eight-bit` — 8-bit | Cluster of small square blocks. | Separate block-based silhouette. |
| `neon` — Neon pointer | Ring and crosshair strokes. | The “neon” appearance comes primarily from shared glow/shadow, not a unique animated treatment. |
| `glow-circle` — Glow circle | Circle using the cursor background color and shared glow/shadow. | Same basic geometry as Outlined circle; glow is a global cursor setting, not exclusive to this preset. |
| `leaf` — Leaf | Leaf outline with a central vein. | Static shape apart from shared renderer behavior. |
| `butterfly` — Butterfly | Two upper/lower wing pairs with a central body line. | Wings do not flap. |
| `water-drop` — Water drop | Teardrop-shaped Bézier path. | Static shape apart from shared renderer behavior. |
| `floral` — Floral | Six petals and a center. | Same drawing branch as Flower. |

### Distinct-design count

The 26 entries are not 26 wholly different animated designs. At minimum, Modern arrow/Minimal pointer, Flower/Floral, and the circle family share drawing geometry. Abstract/Artistic share their outline, while Liquid/Blob share an ellipse basis. These are presets/variants, not 26 independent behavior implementations. System cursor and Custom image are modes, not entries in the built-in array.

## 3. Spider Cursor analysis

The Spider is bespoke and should be preserved as its own design and behavior, not replaced by a generic cursor animation. Its path and motion are implemented in `drawCursorShape`, the delayed pointer sampler, and the main/preview animation loops in [CursorEffects.tsx](./lib/cursor-effects/CursorEffects.tsx#L187).

- **Construction:** eight legs, four on each side. Each leg has root, knee, and foot points; the body comprises abdomen and head ellipses, with eyes and mandibles. Border and fill strokes create the leg/body contrast.
- **Walking:** it samples a pointer history delayed by **120 ms**. While that delayed position advances, the spider rotates toward its travel direction and each leg gets a phase-shifted step and lift. The gait phase advances at a fixed time scale; no UI exposes gait speed, stride, or delay.
- **Idle:** when stopped, the legs become still and the body crouches into a ready pose. There is no separate idle animation loop once the spider has settled.
- **Rotation:** `atan2` of the delayed movement vector sets direction; pounce also turns it toward the click location.
- **Click:** the main site uses a **560 ms** pounce timeline. The shape charges, leaps, and lands; position interpolation starts after a short initial delay. The Spider preset selects a shockwave click effect, but the Spider shape and click burst are separate features.
- **Hover:** no special spider-only hover behavior. Shared hover effects apply except the `magneticHover` translation is explicitly skipped for Spider.
- **Trail:** Spider movement-trail particles are a separate optional effect. Its preset uses `movement: "none"` and `spiderWeb: false`, so it does not draw a web trail by default.
- **Reduced motion discrepancy (verified):** the main website click listener returns early on reduced motion before reaching Spider pounce logic, so a reduced-motion user gets no pounce. The preview instead snaps the Spider to the click location before returning. This is inconsistent and should be fixed in a later approved implementation.

Preserve the delayed follow, articulated legs, direction changes, crouched idle pose, and click pounce as Spider-specific behavior. The editor’s “Spider Pounce” preset is in [config.ts](./lib/cursor-effects/config.ts#L204).

## 4. Magnetic Cursor analysis

“Magnetic Cursor” is not the custom cursor image. The Magnetic Lines system has several independent pointer/target effects:

1. **Target magnetism:** an active registered element target attracts/deforms a line toward its perimeter. It is not attraction of the cursor to that element.
2. **Cursor influence:** pointer proximity deforms line geometry around the pointer in attract or repel mode.
3. **Cursor glow:** pointer proximity lights the line without bending its geometry.
4. **Line interaction / outer glow:** separate line-to-line avoidance and neighbor-glow systems.

### Activation and configuration

- `MagneticBackgroundLines` records a viewport-relative pointer and runs one animation loop that computes line paths and updates SVG attributes directly. It does not use React state per pointer frame.
- Cursor influence is a per-line `cursorInfluence` configuration that can inherit global settings. `computeLine` applies it after magnetic target deformation; it uses mode, radius, falloff, strength, max deformation, response profile, and smoothing.
- `DEFAULT_GLOBAL.cursorInfluence.enabled` is **false**. The editor exposes global and per-line enable toggles, response, follow, strength, radius, falloff, max-deformation, and attract/repel mode. A disabled influence explicitly clears its stored pointer offsets in the engine.
- Target magnetism is separately default-enabled globally and on lines. A `MagneticTarget` registers an element; pointer enter/leave, focus/blur, or touch start/end activates/deactivates it. The registry tracks measured bounds and visibility using observers and window events. Target filtering, priority, and inheritance are in [targetRegistry.ts](./lib/magnetic-lines/engine/targetRegistry.ts#L1) and [useMagneticTarget.tsx](./lib/magnetic-lines/useMagneticTarget.tsx#L20).
- Cursor glow is independently enabled on default lines (`cursorGlow.enabled: true`) while global/line glow is enabled. Therefore, a visible glow near the pointer while Cursor Influence is disabled is expected and is **not proof** that attract/repel geometry deformation is active. Target magnetism can also move lines while the pointer hovers/focuses a registered target; that is separate from Cursor Influence.
- `lineInteraction` is line-to-line avoidance, not a cursor interaction.
- The editor’s global/per-line “Cursor Influence” sections map to the geometry feature. Its separate cursor glow smoothing/release controls tune glow response.

### Dormant/legacy cursor interaction fields

`CursorInteractionSettings` also stores `enabled`, `color`, `intensity`, `radius`, `falloff`, `length`, `opacity`, and `maxIntensity`. In the runtime paths traced, these fields are not consumed; the runtime reads `scene.cursor.smoothing` and `scene.cursor.releaseSpeed` for glow smoothing. Actual glow uses line `cursorGlow` plus line/global glow values, and geometry influence uses `cursorInfluence`. Treat the unused fields as legacy/config-schema debt, not as controls that currently enable pointer deformation.

The engine stages are in [lineEngine.ts](./lib/magnetic-lines/engine/lineEngine.ts#L518), defaults are in [defaultScene.ts](./lib/magnetic-lines/defaultScene.ts#L63), and the editor controls are in [MagneticLinesEditor.tsx](./lib/magnetic-lines/editor/MagneticLinesEditor.tsx#L2720). These files and their behavior are out of scope for changes in this audit and should remain untouched absent explicit approval.

### Interaction with Custom Cursor

Both systems observe pointer events independently. The custom cursor canvas is `pointer-events: none`; its listeners do not cancel clicks or stop propagation. Hiding the native pointer does not stop Magnetic Lines pointer tracking. There is no shared cursor-position store, so both systems maintain their own pointer refs and rendering loops.

The Custom Cursor setting named `magneticHover` is different again: it visually nudges the rendered cursor toward the center of hovered links/buttons. It does not activate Magnetic Lines and does not move the underlying DOM element.

## 5. Current customization capabilities

Status definitions: **Fully functional** = setting is wired to the active renderer for its supported scope; **Partially functional** = works only for some shapes/states or has material limitations; **UI exists but does not affect the cursor** = a visible control has no effective implementation; **Not implemented** = no corresponding control/behavior.

### Appearance

| Setting | Status | Evidence / limitation |
|---|---|---|
| Cursor size | Fully functional | One scalar size; no independent width/height. |
| Width and height | Not implemented | Cursor shape is scaled proportionally; image mode is square. |
| Fill and outline colors | Partially functional | Editable, but white/black circle fills are hard-coded; stroke-only shapes use color differently. |
| Gradients | Not implemented | Solid color controls only. |
| Opacity | Fully functional | Applied to the cursor and movement-particle rendering; click bursts have their own lifetime fade. |
| Rotation | Not implemented as a user setting | Spider direction and small common wobble are internal behavior only. |
| Position/offsets | Partially functional | No general X/Y offsets. Custom images have hotspot X/Y; Spider’s delayed position is behavior, not an offset control. |
| Shadows and outlines | Partially functional | Shadow, glow, border color/width are adjustable; glow and shadow share Canvas shadow blur, and preset geometry does not always use fill/border uniformly. |
| Custom image and hotspot | Fully functional for supported image input | Image mode has hotspot controls; the image sanitizer accepts selected base64 image MIME types and applies a length limit. |

### Animation

| Setting | Status | Evidence / limitation |
|---|---|---|
| Speed | Partially functional | Trail speed affects trail/burst lifetimes; it does not tune the built-in cursor animation or Spider gait. |
| Duration | Partially functional | Effect lifetimes are derived from trail speed/length; no independent duration setting. |
| Delay | Not implemented as a general setting | Spider has a hard-coded 120 ms follow delay. |
| Frequency | Not implemented | No general frequency control. |
| Easing | Not implemented as a user setting | Some fixed interpolation/easing is hard-coded. |
| Direction | Not implemented as a user setting | Spider tracks movement; no general direction control. |
| Amplitude | Not implemented | No general cursor animation amplitude control. |
| Rotation | Not implemented as a user setting | Spider orientation and common wobble are fixed behaviors. |
| Looping | Partially functional | Showcase simulations loop; the production renderer is event/animation-driven and does not continuously animate every cursor while idle. |
| Randomness | Partially functional | Particle emission uses random placement/seeds; randomness is not configurable. |
| Animation intensity | Partially functional | Trail density/size and glitch intensity are configurable; no universal animation intensity. |

### Interactions

| Interaction | Status | Evidence / limitation |
|---|---|---|
| Idle animation | Partially functional | Spider settles into a static ready crouch. Other shape wobble/liquid oscillation is not continuously scheduled on the production site after pointer activity stops. |
| Pointer movement | Fully functional | Pointer following, Spider delayed following, and configured trails work on fine-pointer devices. |
| Hover animation | Partially functional | Hover changes target anchors are links, buttons, and `[role=button]`; arbitrary hover targets and general hover timing/easing are not supported. |
| Click animation | Partially functional | Burst, sound, arcade feedback, and Spider pounce are wired; touch/reduced-motion behavior differs by surface and effect. |
| Drag animation | Not implemented | No drag-specific pointer-down/move/up behavior in the cursor system. |
| Text hover animation | Not implemented | Text cursor state is detected, but no text-specific animation exists. |
| Text-selection animation | Not implemented | No selection-change handling or selection effect. |
| Particle effects | Fully functional within caps | Movement and click particles are Canvas-drawn; they are not independent per-cursor designs. |

There are no identified controls that are purely decorative with no code path at all among the cursor editor controls reviewed. The closest misleading case is the unused Magnetic Lines top-level cursor settings noted above; they are data fields, not effective controls for cursor influence.

## 6. Animation engine analysis

- Cursor drawing and effects are hand-authored Canvas 2D code; `package.json` has no animation library. Magnetic Lines also uses a custom geometry/animation engine.
- The website overlay is mostly demand-driven: pointer movement or active effects schedule a frame, and the loop reschedules while trails, bursts, glitch, or Spider motion remain. It does not use a React render per frame.
- Canvas pixel ratio is capped at 2; the main canvas resizes with the viewport. The editor preview and showcase use `ResizeObserver`.
- The four showcase cards each own a Canvas animation loop throttled to about 30 fps. They animate simulated scenes even when the editor is not being interacted with. This is a persistent cost while the editor is mounted.
- Trail particles are capped at 700, trail points at 240, and main click bursts at 40. The preview has similar bounds for trails/bursts. Showcase particles are pruned by lifetime but do not use the same explicit particle cap.
- The custom-image cache is a module-level `Map` with no eviction. Config values and saved templates live in localStorage; multiple large image data URLs can hit browser quota.
- The main overlay, preview, and showcase close their audio contexts and remove their event listeners/observers/animation frames during cleanup. Magnetic Lines also removes pointer/resize/scroll listeners and uses one frame loop. No leak was established by static inspection; performance was not profiled.
- Both cursor systems listen for pointer movement separately. This is correct functionally but duplicates pointer bookkeeping and continuous rendering work.

## 7. Hover and text interaction analysis

- Hover targets are found using `a`, `button`, and `[role=button]`. Hover flags control scale, color, rounded outline, circular outline, cursor-centered magnetic nudge, and arcade reticle. Hover sound is synthesized with Web Audio after audio is unlocked by a click.
- Click effects share a global click handler and are drawn in the canvas. They do not consume the click or block navigation.
- Cursor states include pointer, link, text, grab/grabbing, resize, crosshair, help, wait/progress, not-allowed/no-drop, zoom, move, context-menu, copy, and alias. Text entry controls are explicitly identified; other states use CSS cursor values.
- State overrides are opt-in. By default, recognized links/buttons/text fields and other recognized states keep their native system cursor. The selected base custom cursor is shown on generic pointer regions, not necessarily every control.
- There is no separate text-hover effect, text-selection animation, drag gesture, or selection listener. Native text selection remains the browser’s behavior.

## 8. Persistence and template system analysis

- Cursor configuration is stored at `magnetic-lines-cursor-effects:v1`; the website-applied flag and saved-template list use related keys. Draft edits stay in React state until Apply or Save template.
- `sanitizeCursorEffects` validates cursor IDs, effect IDs, numeric ranges, colors, and image-data shape when loading the main config or applying UI updates.
- Apply saves the config and enables the applied flag; Remove disables website application; Reset stores the native config and removes the flag.
- Templates are whole configuration snapshots in a JSON array in localStorage. Users can save, load, and delete. Saving a matching name replaces the prior item; there is no dedicated rename or edit-existing-template flow, though saving under the same name can overwrite it.
- Built-in cursor definitions are IDs/categories, not separately editable records. Selecting a built-in resets most settings to defaults while retaining state overrides. A saved template can duplicate a configuration but does not create an independently editable built-in.
- There is no import/export UI, template schema versioning, migration, or validation of the saved-template list’s shape at read time. Config selection is sanitized on update, but parsing/consuming malformed template entries can fail or display invalid data.
- `loadCursorEffects` catches storage/parse errors and returns defaults. That path does not surface a warning to the user; explicit save/apply failures do display editor errors.
- Capacity is bounded by browser localStorage rather than an application-level total quota. Uploaded images and template copies increase that usage.

Magnetic Lines uses its own persistence and scene/template structures, separate from cursor templates; see [persistence.ts](./lib/magnetic-lines/persistence.ts). Do not combine the two storage models as part of the future cursor expansion without explicit migration planning.

## 9. Performance and accessibility analysis

### Verified strengths

- Canvas overlays do not intercept clicks or keyboard interaction; the custom cursor is `aria-hidden`.
- State fallback preserves native browser cursors for unconfigured states; text fields and resize/cursor CSS states can keep native behavior.
- Reduced-motion preferences are read in the website overlay and preview; touch-only devices do not receive the applied custom cursor.
- Pointer listeners are passive where appropriate. Resize handling and image/cache logic are bounded in several places. Most cursor drawing is imperative and avoids React re-rendering per pointer frame.
- Magnetic target registration cleans up observers and event listeners when elements unmount.
- The editor CSS has responsive breakpoints at 900px, 560px, and 480px. This is source-level evidence only; this audit did not visually test every viewport.

### Risks / unmeasured areas

- Four always-running showcase loops and Magnetic Lines’ own continuous loop can combine with the global cursor overlay. No CPU/GPU, high-refresh, low-end-device, or multi-line benchmark was run.
- The main canvas scales to device pixel ratio 2, which can still be expensive at high viewport resolutions.
- Showcase particle arrays rely on lifetime pruning rather than the main renderer’s explicit 700-particle cap.
- The image cache has no eviction, and storage usage across templates is not capped globally.
- Touchscreen behavior is intentionally native/no applied cursor, but touch preview behavior and hybrid-device behavior were not browser-tested.
- Reduced-motion behavior is inconsistent for Spider pounce (see above). Other reduced-motion paths suppress particles/bursts and stop active animation.
- Native cursor fallback for controls is intentional in current UI copy, but should be a documented product choice when defining “cursor everywhere.”

## 10. Bugs and missing functionality

### Verified findings

1. **Spider reduced-motion inconsistency:** main site returns from click handling before Spider pounce logic; preview snaps to click. Two surfaces produce different behavior.
2. **Idle cursor animation is not sustained on the website:** shared wobble/liquid drawing depends on render time, but the website renderer stops scheduling frames after activity/effects settle. Showcase cards continue looping, so preview may appear more animated than the applied site.
3. **Preset names overstate the number of unique designs:** Minimal pointer duplicates Modern arrow geometry; Flower duplicates Floral; Glow circle shares the outlined/background-filled circle shape; the circle family shares one branch.
4. **Color control is not universal:** white/black circle fills are hard-coded and do not follow the cursor fill color control. Several line-art shapes interpret fill/border differently.
5. **No drag/text-selection-specific effects:** only pointer movement, hover targets, and click are handled.
6. **No independent size dimensions or general animation controls:** width/height, gradients, general offsets, rotation, timing, easing, frequency, and amplitude are absent.
7. **Native cursor states are the default for recognized controls:** base cursor selection does not automatically override links, buttons, and text inputs; each relevant state must be enabled.
8. **Template list is not schema-validated or versioned:** config is sanitized, but template metadata/list parsing is not equivalently guarded.
9. **Magnetic cursor glow can be mistaken for cursor influence:** default line cursor glow is on while default cursor influence is off. Target magnetism is another distinct source of line deformation.
10. **Top-level Magnetic cursor config includes fields unused by runtime:** only its smoothing/release values are consumed in the traced path; actual influence/glow are driven by separate per-line/global configs.
11. **Preview isolation risk when a website cursor is already applied:** the preview marks its custom mode with `data-preview-cursor="true"`, but the global overlay excludes native-preview markers rather than all preview regions. The global applied cursor can therefore draw over the preview’s separate draft cursor. This is a verified code-path collision; its visible impact depends on whether the applied and draft configurations differ.

### Not established in this audit

No evidence was gathered that the cursor overlay blocks clicks, that listeners leak after unmount, or that high-refresh displays cause incorrect position interpolation. These remain runtime-test/benchmark questions rather than confirmed defects.

## 11. Technical risks and dependencies

- **Protected behavior:** preserve the Spider’s bespoke body, eight-leg gait, 120 ms following lag, ready crouch, direction response, and pounce. Keep the Magnetic Lines engine, target registry, and editor independent unless later approval explicitly expands scope.
- **Shared code:** `drawCursorShape`, `drawCursor`, `drawEffect`, `drawBursts`, cursor-state resolution, sanitizer, and image loading are reused across website/preview/showcase. Changes to these can affect all three surfaces.
- **Duplicate rendering paths:** the draw helpers are shared, but event and Spider timing loops are duplicated across production, preview, and showcase. This already permits reduced-motion and timing drift.
- **Feature entanglement:** movement and click effects are global config independent of cursor identity; hover effects and cursor-state overrides are layered on top. Adding 120 per-preset components without separating configuration from capabilities would multiply conditionals.
- **Storage:** browser quota, image cache lifetime, and unversioned templates limit long-term growth. A 120-entry catalog is easy as metadata, but 120 full image-heavy user snapshots are not safely unbounded.
- **Performance:** one renderer/loop per cursor or per showcase card does not scale. Particle caps must apply to every renderer, including previews.
- **Native semantics:** globally hiding the system cursor requires preserving text, resize, drag, and OS-level cursor feedback. State-resolution changes can regress editing and accessibility.
- **Magnetic Lines visual overlap:** line glow and target deformation may continue while the custom cursor is native or disabled, because they are separate effects. Do not “fix” that by coupling the two systems.

## 12. Recommended architecture for 120 cursors

1. **Keep the library data-driven.** Store built-in metadata under stable IDs: name, category, renderer key, default appearance/motion, supported interactions, and accessibility fallback. Treat built-ins as immutable definitions.
2. **Extract a shared cursor runtime contract.** One pointer-state source and one animation scheduler should feed production and preview adapters. Keep Canvas drawing helpers or individual renderers modular, but eliminate duplicated state-transition logic between the live site and editor preview.
3. **Preserve special designs as specialized renderers.** Spider remains a bespoke renderer with its existing path/gait/pounce contract; do not normalize it into the generic renderer. Magnetic Lines remains a separate system.
4. **Separate configuration layers.** Built-in definition → per-cursor user customization → reusable saved template. Avoid mutating global preset defaults when a user edits one cursor.
5. **Use typed, versioned schemas.** Validate every imported/saved config, migrate schema versions, enforce image dimensions/bytes and total template limits, and report invalid data rather than silently accepting it.
6. **Model capabilities explicitly.** Cursor-specific controls should appear only when supported (for example, wing flap for a flapping design, not a fake universal “animation speed”). Common settings can remain shared; unique behavior controls belong to that renderer.
7. **Use one bounded render scheduler.** Share it across the on-site cursor and preview; stop when idle unless an active cursor has a real idle animation. Apply particle budgets, canvas DPR limits, and image-cache eviction consistently.
8. **Keep interaction handling declarative.** Define hover/click/drag/text-selection support and event lifecycles in one interaction layer. Preserve native cursor behavior in text fields, resize controls, touch-only devices, and reduced-motion mode.
9. **Test both definitions and behavior.** Add renderer/config schema tests, event-sequence tests, preview-vs-production parity tests, and visual snapshots for each family. Performance acceptance should measure the 120-item catalog without mounting 120 render loops.

With this structure, 120 cursors are manageable as a catalog of reusable renderers and data definitions—not 120 independent React components, event listeners, or animation loops.

## 13. Recommended Phase 2 implementation order

1. **Approve this audit and scope.** Confirm the intended meaning of “120 unique”: 120 genuinely distinct designs, or a mix of distinct designs and explicitly labeled variants.
2. **Lock behavior contracts and regression tests.** Capture current System cursor semantics, Spider behavior, Magnetic Lines isolation, and reduced-motion/touch fallbacks before refactoring.
3. **Resolve shared runtime parity.** Unify cursor state and interaction scheduling between website and preview; fix the verified Spider reduced-motion inconsistency and idle-animation mismatch without changing Spider identity.
4. **Add versioned cursor definitions and customization model.** Keep current presets stable; separate immutable defaults from per-cursor edits and reusable templates.
5. **Complete editing controls honestly.** Implement supported dimensions, gradients, offsets, timing, easing, rotation, and per-cursor settings only where the renderer can use them. Do not expose inert controls.
6. **Implement and test genuinely distinct designs in families.** Build a few representative renderers and visual tests first, then expand the library while preserving Spider as a special case.
7. **Add missing interactions selectively.** Add drag/text-selection effects only after explicit UX requirements and native-selection/accessibility behavior are agreed.
8. **Harden templates and asset limits.** Add rename/edit/duplicate, schema validation/migration, import/export, storage error handling, and image/cache budgets.
9. **Profile and verify compatibility.** Measure showcase and production frame costs; test responsive breakpoints, touch/hybrid devices, reduced motion, text inputs, drag handles, high-DPI screens, and high-refresh displays.

## Phase 2 implementation status

Phase 2 foundation work has since been implemented in the cursor system. This addendum records implementation status; it does not change the audit's verified findings about the original system.

- **Implemented:** typed/versioned cursor definitions and renderer registration; bounded animation/movement/interaction utilities; per-cursor customization persistence; named template create/load/update/duplicate/rename/delete/import/export; legacy template migration without deleting the original legacy key; and Spider-specific follow, gait, articulation, body-bounce, and pounce controls.
- **Wired to the editor and renderer:** cursor width/height scale, rotation, offsets, solid/linear-gradient colors, effect duration/easing, and non-Spider follow smoothing. Legacy configs sanitize to defaults for these new fields. Reduced-motion mode uses direct pointer following and suppresses animated effects.
- **Hardened:** malformed and unsupported-version cursor libraries are reported, and a library that cannot be safely loaded is not overwritten by subsequent edits.
- **Verified in code/tests:** built-in and dynamic registry IDs; configuration bounds and legacy defaults; Spider-specialized config; animation/movement/interaction helpers; template CRUD, migration, import/export, and independent customization storage. Browser verification confirmed the new editor controls and live preview load and settings autosave.
- **Still outstanding:** the 120-cursor catalog (not part of this foundation phase); full renderer parity and a single shared scheduler between website, preview, and showcase; renderer-specific Butterfly/Autumn Leaves/Jellyfish behavior; new text-hover/selection visuals; and cross-device/reduced-motion visual QA beyond the focused checks. Universal model fields without corresponding controls/rendering remain schema only and should not be presented as active features.
- **Protected:** Spider remains on its bespoke renderer. Magnetic Cursor/Magnetic Lines source code was not changed as part of the cursor foundation.

The recommendations in sections 12–13 remain the forward plan for expanding beyond this foundation. Begin the 120-design catalog only as a separately scoped phase.

## Phase 2.5 status

The current work makes the flat runtime shape the canonical versioned configuration and shares Spider movement and click-policy helpers between the website and editor preview.

- **Verified in code and unit tests:** canonical defaults/sanitization, legacy configuration defaults, unknown-field removal, rejection of future configuration versions, full local-storage save/restore, full template configuration round-trip, and shared Spider normal/reduced-motion click transitions.
- **Reduced-motion policy:** normal motion keeps the existing Spider pounce. With reduced motion, a Spider click snaps to the click point without a pounce; an in-progress pounce also completes immediately. The live overlay, editor preview, and showcase suppress the pounce animation in reduced-motion mode.
- **Still outstanding:** the website, editor preview, and showcase retain separate frame/event loops; sharing Spider helpers and Canvas drawing does not satisfy the requested single shared runtime. Broad browser regression, touch/hybrid-device testing, leak profiling, and visual parity checks have not been executed. The regression plan is therefore not complete, and Phase 2.5 must not be marked complete.
- **Protected:** no Magnetic Lines implementation was changed. No Phase 3 cursors were added.

### Phase 2.5 regression plan and execution

| Area | Planned check | Result |
|---|---|---|
| Existing presets | Confirm all registered built-ins have definitions/defaults; render, move, idle, hover, click, and switch through each preset | Registry/default metadata verified for all built-ins. Canvas behavior for every preset was not browser-tested. |
| Configuration | Edit, sanitize legacy/invalid/future versions, save, reload, reset, and verify appearance/motion values | Unit-tested sanitization, legacy defaults, unknown-field removal, future-version rejection, and complete storage round-trip. Browser reset and visual application were not tested. |
| Templates | Create/save, apply, edit, duplicate, rename, delete, reload, import/export, and reject malformed/outdated data | Unit-tested create/save/update/duplicate/rename/delete, import/export, legacy migration, malformed/version handling, and complete reload round-trip. Browser apply/reload UI flow was not tested. |
| Reduced motion | Compare website, preview, and showcase; toggle preference and click Spider and other animated cursors | Spider helper tests cover normal pounce, reduced snap, and immediate completion of an in-progress pounce. Browser surface-to-surface visual parity and other cursor effects were not tested. |
| Pointer/device interactions | Mouse, touch, pointer exit, drag, text selection, inputs, buttons/links, and resize controls | Not tested in-browser. |
| Lifecycle/performance | Check console, duplicate listeners, animation cancellation after unmount, particle limits, resize, high-DPI/refresh, and mobile responsiveness | Browser smoke test found no console/page errors and rendered four showcase cards. Listener/leak profiling, device coverage, and performance measurements were not run. |
| Browser build | Open the editor, verify the cursor editor and showcase render, and emulate reduced motion | Passed in the integrated browser on the local editor page; 4 showcase cards and 11 canvases were present, and no console/page errors were recorded. This is a smoke test, not cross-browser coverage. |

Executed commands: `npm run test:cursor` (13 passed), `npx tsc --noEmit` (passed), `npm run lint` (passed), and `npm run build` (passed). The available browser check was an integrated-browser smoke test, not an automated multi-browser suite.

## Phase 2.6 runtime integration and regression status

The Phase 2.5 “still outstanding” statements above describe the state before this Phase 2.6 work. The current implementation adds a shared runtime coordinator in [runtime.ts](./lib/cursor-effects/runtime.ts) and routes the website overlay, editor preview, and showcase through its RAF scheduler, listener registration/disposal, pointer motion updates, interaction transitions, and animation-continuation policy. Canvas drawing and environment-specific event adapters remain in [CursorEffects.tsx](./lib/cursor-effects/CursorEffects.tsx); this is shared runtime infrastructure, not a single surface-independent renderer. Therefore behavioral parity is improved but not proven for every equivalent interaction.

Spider continues to use the same `applySpiderClick` and `sampleSpiderFrame` helpers across surfaces. Normal-motion pounce is retained; reduced-motion click snaps to the target, and animated loops are not continued while reduced motion is active. Pointer history is capped at 256 samples and particle arrays at 700 entries; trails remain capped at 240.

### Phase 2.6 regression plan and execution

| Area | Result |
|---|---|
| Unit regression | `npm run test:cursor`: 14 tests passed, including runtime frame de-duplication/cancellation, pointer state, interaction transitions, reduced-motion continuation policy, configuration and template operations, and bounded Spider path sampling. |
| Type/lint/build | `npx tsc --noEmit`, `npm run lint`, and `npm run build` all passed after the runtime and sample-cap changes. |
| Existing cursor choices | Browser editor selected all 26 built-in presets plus System cursor (27 unique selectable values); the editor preview remained mounted, with four showcase cards and 11 canvases. This verifies selection/render surfaces stay mounted, not visual correctness for every design or every animation. |
| Website activation | Browser test applied `modern-arrow`; the applied flag and configuration persisted, and the website overlay activated on a text target where the cursor state resolves to the custom cursor. A blank background retained the native cursor as configured. |
| Pointer/reduced motion | Browser exercised mouse movement, pointer-down/up and drag-like movement, synthetic touch pointer events, pointer leave, DOM text selection, and reduced-motion preference toggling. These were exploratory checks in one integrated browser, not physical-device tests. |
| Templates and reload | UI create/save/apply/edit/duplicate/rename/delete and reload/restore flows were exercised with browser prompt/confirm mocks; underlying unit tests also cover template CRUD, migration, import/export, and invalid data. Native dialogs were not directly automated. |
| Console and lifecycle | No console/page errors were recorded during the current preset and pointer checks. Code inspection confirms runtimes cancel their pending frame and registered listeners on disposal; observers and showcase timers are cleaned up. A heap/profile-based leak test was not performed. |

### Completion gate and remaining verification

Phase 2.6 is **not fully verified complete**. The browser work is an integrated-browser regression pass, not exhaustive cross-browser coverage. Physical touch and hybrid hardware, every cursor's visual/animation output, inputs and textareas in each environment, all corresponding-event visual comparisons between website/preview/showcase, unmount leak profiling, high-refresh performance, and mobile/responsive layout remain unverified. Website custom cursor activation was exercised only on a compatible target in the current browser; it remains native on states not configured for a custom override. The three surface adapters still compute their own rendering/activity details, so matching behavior across all event combinations is not formally guaranteed by the shared coordinator.

Magnetic Lines implementation files were not edited by this cursor-runtime work. No Phase 3 cursors were added. Do not treat the completion gate as satisfied until the outstanding browser/device and parity checks are run.

## Phase 2.7 final behavioral parity and release validation

The shared runtime remains the common source for pointer updates, interaction transitions, RAF scheduling, reduced-motion continuation policy, and listener disposal. The website overlay is viewport-relative; the editor preview is host-relative and supports real user input; showcase cards intentionally animate simulated scenes, including scripted hover/click/movement examples. These adapter-specific coordinate systems and showcase simulation are intentional. The adapters are not pixel-identical and are not interchangeable input sources.

### Behavioral parity coverage

Added a parity regression in [cursor-foundation.test.cjs](./tests/cursor-foundation.test.cjs). It feeds equivalent local pointer positions (normalized to the same viewport point) and move, hover, click/double-click, drag, text-selection, focus, idle, and exit transitions into three shared runtimes, then compares pointer direction/speed/state and interaction snapshots. It also checks reduced-motion continuation, cursor/config sanitization changes, adapter use of the shared runtime/config updates, disposal, and the 700-particle cap. The test asserts that the live website and preview register `pointercancel` handlers. This checks shared state behavior and adapter wiring; it does not execute the private Canvas draw callbacks or prove visual/animation output is identical across DOM surfaces.

The website and preview now end an in-progress drag on `pointercancel` and pointer leave as well as `pointerup`. The showcase has no physical drag stream because its activity is scripted. Spider keeps its existing normal-motion gait/pounce and reduced-motion snap policy; no Spider or Magnetic Lines renderer was changed for this phase.

### Device and browser coverage

| Input / environment | Result |
|---|---|
| Mouse | Integrated VS Code browser identified itself as Chrome 150 / Electron 43 on Windows. The editor and live preview mounted (1 preview, 4 showcase cards, 11 canvases). This is Chromium-based smoke coverage, not standalone Chrome certification. |
| Touch / hybrid / cancellation | Not verified with physical hardware. A CDP touch tap attempt was blocked because the shared browser context was not created with touch support; no touch emulation result is claimed. Synthetic pointer-event code checks are not equivalent to browser/OS touch dispatch. |
| Viewport exit/re-entry, drag-and-drop, selection, text input/textarea, buttons and links | Focused interactive completion was interrupted while the browser automation was waiting on actions in the editor. Do not count these paths as fully browser-verified. Unit tests cover the shared state machine; the preview provides the corresponding controls. |
| Reduced motion | The shared runtime policy is unit-tested. A browser media-emulation toggle was attempted, but no cross-surface visual or sustained-animation comparison is claimed. |
| Firefox | Not available in the integrated browser; no Firefox executable was found in the standard installation location. Not tested. |
| Safari/WebKit | Unavailable on this Windows environment; not tested. |
| Installed Chrome | A Chrome executable exists, but this run did not launch a standalone Chrome session or have an independently configured cross-browser suite. |

### Performance, lifecycle, and Magnetic Lines

Unit coverage verifies single-pending-frame scheduling, cancellation/disposal, listener removal, Spider path capacity (256), and adapter particle limits (700). Source inspection confirms the adapters dispose their shared runtimes; the showcase additionally clears observers and its replay timer. No browser performance trace or heap snapshot was collected, so active frame counts under sustained idle/animation, CPU use, memory growth, stale references under repeated switching/mount cycles, and high-refresh performance remain unmeasured. The 700-particle bound is verified in code/tests, not reported as a live profile observation.

The cursor work made no changes to Magnetic Lines source. The integrated browser loaded the editor and rendered the Magnetic Lines page during smoke checks, but an exhaustive Magnetic Lines visual/interaction regression was not completed; unrelated pre-existing Magnetic Lines worktree modifications were preserved.

### Required release checks

| Command | Result |
|---|---|
| `npm run test:cursor` | Passed: 15 tests, including the new runtime parity test. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. |
| Browser parity/device suite | Partial: Chromium-based integrated editor smoke check only; standalone multi-browser, physical device, and full interaction/performance coverage unavailable or incomplete. |

### Phase 2 completion gate

**Not satisfied.** The required automated checks pass and shared runtime state parity is covered, but the specified device/browser regression, exhaustive rendering/animation comparisons, repeated lifecycle/performance profiles, and a complete Magnetic Lines regression were not demonstrated. Do not advance to Phase 3 or mark Phase 2 complete based on this run.

## Phase 3: 20 animated animal and insect cursors

Phase 3 was subsequently started at the user's explicit direction. The Phase 2 completion gate above remains a historical result; this section records Phase 3 implementation and verification only. It does not claim the outstanding Phase 2.7 checks have since been completed.

### Implementation and parity

The built-in inventory now contains 46 cursors: the original 26 plus 20 additional animal and insect presets. The System cursor remains a separate mode. Each new creature has a dedicated Canvas renderer registered through the existing renderer registry in [creature-renderers.ts](./lib/cursor-effects/creature-renderers.ts); the website, editor preview, and showcase retain separate rendering/event adapters and use the shared runtime. Their differing coordinate spaces and the showcase's scripted scenarios remain intentional; the new renderers do not make those adapters pixel-identical.

Each creature has sanitized, persisted settings for its palette and motion/articulation controls, plus idle, hover, and click animation toggles. Caterpillar additionally has a bounded segment-count setting. Existing saved configurations are supplied defaults by the sanitizer, without a storage migration. Spider's existing renderer and its normal/reduced-motion behavior were preserved. Magnetic Lines source was not edited as part of this phase; unrelated pre-existing Magnetic Lines worktree changes were left intact.

The cursor tests cover the full built-in inventory, renderer registration and distinct draw paths, static reduced-motion poses, settings sanitization, and template persistence. These checks cover runtime/configuration behavior, not exhaustive visual design review or production performance.

### Browser and device coverage

| Input / environment | Result |
|---|---|
| Mouse and live editor preview | Verified in the integrated browser, Chrome 150 / Electron 43 on Windows. The 46 built-in presets were selected in the editor; each produced preview canvas output when checked with Canvas fill/stroke instrumentation or pixel readback. All 20 new creature renderers produced draw calls, with no captured page errors in the creature-selection loop. This is a rendering smoke test, not a visual-quality certification. |
| Reduced motion | Emulated in the integrated browser. With Tiny Cat selected and the preview idle, the media query reported `reduce`; after the initial render, no additional preview draw calls were observed during a subsequent 200 ms window. Unit tests also verify static reduced-motion renderer output. |
| Touch, hybrid pointer, physical cancellation, and physical devices | Not verified. No physical-device testing was performed; mouse-driven integrated-browser checks are not a substitute. |
| Firefox | Not tested in this phase; no Firefox session was available in the integrated browser. |
| Safari/WebKit | Not tested; unavailable in this Windows environment. |
| Standalone Chrome and exhaustive persistence/browser interactions | Not tested in this phase. Browser testing does not certify every template operation, cursor-setting edit, input/textarea, drag, or hover/click path. Config sanitization and template round-tripping have automated coverage. |

### Performance, lifecycle, and remaining limitations

No CPU profile, heap snapshot, repeated mount/unmount or cursor-switch leak profile, high-refresh test, or cross-browser performance measurement was collected. The observed Canvas draw-call counts above are only evidence of rendering, not performance metrics. Existing automated checks cover runtime disposal/listener cleanup, the Spider history bound (256), and particle-array bounds (700); those bounds were not re-measured through live profiling.

Magnetic Lines was not modified for Phase 3, but a full Magnetic Lines interaction/visual regression was not run. Spider's normal and reduced-motion behavior was preserved and covered by existing cursor regression checks; a dedicated visual certification was not performed. The physical-device, Firefox, WebKit, exhaustive visual-comparison, and live lifecycle/performance gaps remain open.

### Phase 3 validation

| Check | Result |
|---|---|
| `npm run test:cursor` | Passed: 17 tests. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. |
| Integrated-browser smoke test | 46 built-in presets selected; all 20 new creature renderers observed drawing; reduced-motion idle check observed no subsequent preview draws; no page errors captured in the creature-selection loop. |

At the end of Phase 3 validation, its implementation and listed automated checks were complete. Release-level visual/device/browser/performance certification was not complete.

## Phase 4: cursors 21–40

The built-in inventory now contains 66 presets: the previous 46 plus the following 20 botanical and fantasy cursors. The System cursor remains a separate mode. These presets reuse the existing renderer registry, shared runtime, Canvas renderer dispatch, editor preview/settings, showcase scenes, and template/configuration persistence; they add no database migration or dependency.

### New cursor designs and controls

| Cursor | Rendering and behavior | Individual controls |
|---|---|---|
| Autumn Leaves | Veined, lobed maple and oak leaves tumble independently on drifting paths; wind and click scatter affect their trajectories. | Leaf palette, fall speed, wind strength, tumble rotation, leaf count. |
| Cherry Blossom | Curved shaded petals drift and rotate independently; hover scatters them and click bursts them outward. | Petal palette, fall speed, wind drift, petal rotation, petal count. |
| Dandelion | Radial seed head, individual filamented seeds, stem, and leaves; seeds periodically detach and drift, with hover/click dispersal. | Seed/head/stem colors, dispersal speed, wind strength, seed tumble, seed count. |
| Rose Petals | Layered curved petals turn and swirl at varied depths, with petal veins and click dispersal. | Petal palette, fall speed, swirl intensity, petal rotation, petal count. |
| Sunflower | Multi-layer petaled head with a detailed seed disk, leafy stem, independent sway, and click bounce. | Petal/disk/stem colors, sway speed, sway intensity, pointer tracking, petal count. |
| Daisy | Individually spaced white petals, detailed yellow center, and flexible stem; hover spreads petals and click opens a companion bloom. | Petal/center/stem colors, sway speed/intensity, petal spread, petal count. |
| Lavender | Multiple tapered flower spikes with paired buds and leaves; stems sway with separate phases and release petals on click. | Flower/stem palette, sway speed, wind strength, stem flexibility, stem count. |
| Ivy Vine | Curved climbing tendril with individually angled, veined leaves; vine curl and leaf sway respond to motion and interaction. | Leaf/vine palette, growth rate, curl intensity, sway amount, leaf count. |
| Fern | Central stem and paired shaped leaflets bend and curl; hover spreads leaflets and click curls the frond. | Frond/vein colors, sway speed, curl intensity, tip tracking, leaflet pairs. |
| Maple Seeds | Paired-wing samaras rotate independently around seed bodies and drift; hover increases spin and click sends seeds outward. | Seed/wing colors, spin speed, wind strength, fall speed, seed pair count. |
| Fairy | Character with dress, pointed cap, four translucent-looking articulated wings, flight bob, and orbiting sparkles. | Dress/wing/hair colors, wing speed, flight intensity, glow intensity, sparkle count. |
| Magic Wand | Material-shaded wand with a five-point star tip, changing glow, and intermittent sparks; tilt follows movement and clicks burst magic. | Wand/star/sparkle colors, rotation speed, glow intensity, sparkle density, sparkle count. |
| Wizard | Hat, face, beard, robe, and held wand; hat and body move independently and spell sparks appear on hover/click. | Hat/robe/beard/spell colors, float speed, casting intensity, hat/beard sway, spell sparks. |
| Potion Bottle | Outlined glass vial with visible liquid and surface; liquid sloshes as the vial tilts and bubbles rise. | Glass/liquid/highlight colors, bubble speed, slosh sensitivity, glow intensity, bubble count. |
| Crystal | Faceted gemstone with internal planes and shifting highlights; floating, rotation, and hover/click light changes. | Crystal/facet/light colors, rotation speed, facet brightness, float intensity, facet count. |
| Enchanted Mushroom | Cap, stem, underside, spots, and glowing spores; cap bounces and click/hover release spores. | Cap/spot/spore colors, bounce speed, glow intensity, spore lift, spore count. |
| Spellbook | Cover, spine, pages, central sigil, and floating sparks; the book opens and pages flutter on hover/click. | Cover/page/sigil colors, page flutter, opening amount, glow intensity, magic sparks. |
| Unicorn | Head with horn, ears, eye, mane locks, and tail; bobbing and flowing hair react to time, hover, and click. | Body/mane/horn colors, hop speed, hair movement, sparkle intensity, mane locks. |
| Baby Dragon | Head/body, horns, wings, legs, segmented scale details, and harmless stylized breath; wingbeat and tail motion respond to hover/click. | Scale/wing/breath colors, wing beat, tail movement, flight intensity, scale plates. |
| Tiny Ghost | Shaped ghost with scalloped cloth edge, expressive blinking eyes, and soft highlights; it floats, tilts, and compresses on click. | Body/eye/highlight colors, float speed, fabric wave, trail intensity, wave lobes. |

All settings use the existing bounded creature settings model: three color controls, three renderer-specific motion controls, relevant bounded element-count controls (5–16), and idle/hover/click toggles. Caterpillar retains its prior 5–9 segment bound. Each new cursor has a dedicated renderer in [creature-renderers.ts](./lib/cursor-effects/creature-renderers.ts); its per-cursor settings labels are exposed only for the selected preset. The existing sanitizer supplies defaults to older stored configs and template records, so the schema version remains unchanged.

### Integration and regression coverage

The 20 IDs, botanical/fantasy categories, defaults, and cursor-count bounds are in [model.ts](./lib/cursor-effects/model.ts) and [config.ts](./lib/cursor-effects/config.ts). Names, descriptions, metadata, interactions, and idle-animation registration are in [registry.ts](./lib/cursor-effects/registry.ts). The selected cursor's relevant count control is wired in [CursorEffects.tsx](./lib/cursor-effects/CursorEffects.tsx). All renderers use the existing runtime and are available through the existing website, preview, and showcase dispatch; the adapters remain intentionally distinct. Built-in renderer registration replaces its prior entry during module reload, preventing duplicate-registration failures during development hot reload; explicit duplicate registration remains an error by default.

[cursor-foundation.test.cjs](./tests/cursor-foundation.test.cjs) now verifies all 66 preset registrations and 40 creature renderer registrations, unique drawing paths, static reduced-motion appearance, and for each Phase 4 renderer: changing idle frames, hover response, click response, and effect from every palette/motion/count control. It also checks sanitized count limits and a Maple Seeds configuration round-trip through saved-template persistence. Existing shared-runtime adapter, cleanup, Spider, System cursor, and template tests remain in the suite.

### Phase 4 validation

| Check | Result |
|---|---|
| `npm run test:cursor` | Passed: 19 tests, including all 20 Phase 4 renderer interaction and customization checks. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed without warnings. |
| `npm run build` | Passed. |
| Integrated-browser preview | Emulated mouse/integrated Chromium. Selected each of the 20 new cursors in the editor; each rendered nontransparent Canvas pixels, changed between idle readbacks, and exposed its count control. No page errors were captured in that loop. A reload initially exposed duplicate built-in registration (HTTP 500); after the hot-reload-safe registry fix, `/editor` returned HTTP 200. |
| Physical touch/hybrid, Firefox, WebKit/Safari | Not tested in this phase. |
| CPU/heap/leak profiling and exhaustive Magnetic Lines regression | Not performed in this phase. Magnetic Lines source was not modified. |

The browser check is an editor-preview smoke test, not a visual-quality certification or a cross-surface/browser/device guarantee. Automated tests cover configuration/template persistence and adapter wiring; a full website, showcase, Magnetic Lines, and saved-user-data browser regression was not performed. Reduced-motion static output is covered by renderer tests; a Phase 4 browser media-emulation pass was not run. No live performance measurements are claimed.

**Phase 4 implementation is complete.** Remaining limitations: physical-device and additional-browser coverage, exhaustive visual review, full Magnetic Lines browser regression, and runtime CPU/memory/lifecycle profiling.

## Phase 5: cursors 41–60

The built-in inventory now contains 86 presets, with System cursor and Custom image handled as separate modes. This phase adds 20 Romantic and Food cursors while retaining the existing renderer registry, shared runtime, settings model, templates, and separate website/editor/showcase adapters.

### New cursor designs and controls

| Cursor | Rendering and behavior | Individual controls |
|---|---|---|
| Satin Bow | Gradient-shaded bow loops and folded tails flutter independently; hover opens the loops and click cinches them. | Ribbon/shadow/shine colors, flutter, tail length, movement sensitivity, fold count. |
| Flowing Ribbon | Continuous folded ribbon bends into a moving curl; hover deepens the curl and click winds a spiral. | Ribbon/shadow/highlight colors, trailing speed, curl, width, fold count. |
| Pearl Necklace | Individually shaded pearls swing along a curved strand; hover enlarges them and click separates the strand. | Pearl/highlight/chain colors, pearl scale, shine, movement response, pearl count. |
| Heart Locket | Layered metallic heart with hinge and enamel; hover cracks it open and click reveals its inner glow. | Metal/enamel/glow colors, swing, opening, heart scale, layer count. |
| Pink Rose | Veined, shaded rose petals layer around a center and sway; click releases small petals. | Rose/highlight/stem colors, scale, petal motion, rotation, petal count. |
| Cherry Pair | Two shaded cherries swing independently from curved stems; hover changes their swing and click bounces them. | Cherry/highlight/stem colors, size, bounce, spacing, stem details. |
| Strawberry | Shaded fruit with seed details and a leaf crown tilts; click scatters small seed flecks. | Fruit/leaf/seed colors, seed density, tilt, click-particle intensity, seed count. |
| Cupid | Winged figure holds a bow; wings flap and the heart arrow travels on click. | Figure/heart/wing colors, wing speed, hover, animation speed, feather count. |
| Angel Wings | Layered feathered wings flap on articulated arcs and spread on click. | Feather/shadow/highlight colors, span, feather detail, flap speed, feather count. |
| Love Letter | Folded envelope, wax-heart seal, and ruled paper; hover opens the flap and click raises the letter. | Envelope/seal/paper colors, texture, opening, tilt, paper-line count. |
| Donut | Baked ring, icing with a real center hole, and individually scattered sprinkles; click scatters toppings. | Dough/icing/sprinkle colors, topping density, rotation, particle intensity, sprinkle count. |
| Cupcake | Pleated cake wrapper and stacked curved frosting; it bounces at idle and wobbles on hover/click. | Cake/wrapper/frosting colors, bounce, frosting detail, wobble speed, frosting-layer count. |
| Macaron | Two rounded textured shells surround visible filling and separate on click. | Shell/cream/bake colors, rotation, wobble, detail, shell-detail count. |
| Ice Cream | Irregular shaded scoop over a crosshatched waffle cone, with visible sprinkles. | Scoop/cone/highlight colors, wobble, cone detail, articulation, sprinkle count. |
| Bubble Tea | Transparent cup shows tea, sloshing surface, straw, reflections, and bouncing tapioca pearls. | Cup/tea/pearl colors, slosh, tilt, pearl response, pearl count. |
| Matcha Latte | Layered matcha and milk inside a ceramic cup; petal latte-art and click ripples animate on the surface. | Cup/matcha/milk colors, surface motion, ripple, petal detail, art-petal count. |
| Coffee Cup | Shaded handled cup with moving coffee, ripple rings, and separate curling steam trails. | Cup/coffee/steam colors, slosh, steam speed, steam articulation, steam-strand count. |
| Croissant | Curved shaded pastry has distinct laminated layers; click scatters crumbs. | Pastry/layer/highlight colors, rotation, movement response, layer detail, layer count. |
| Watermelon | Juicy triangular slice has pale rind, green skin, and shaped seeds; it tilts on hover and clicks. | Flesh/rind/seed colors, tilt, seed pattern, click response, seed count. |
| Cookie | Rough-edged baked cookie shows individual chocolate chips and a brief click crack before reforming. | Dough/icing/chip colors, bounce, crack intensity, detail, chip count. |

These settings reuse the existing bounded creature settings shape. Each new cursor has three color controls, renderer-specific motion/articulation controls, a bounded element-count control, and idle/hover/click toggles; the configuration schema version is unchanged. The sanitizer supplies defaults to older stored configs and templates.

The new dedicated Canvas renderers are in [romance-dessert-renderers.ts](./lib/cursor-effects/romance-dessert-renderers.ts) and are side-effect registered by the editor/overlay module. The renderer table in [creature-renderers.ts](./lib/cursor-effects/creature-renderers.ts) is now partial so the 40 earlier creature renderers coexist with this separate set; `isCreatureCursor` recognizes all 60 creature IDs for settings and runtime behavior. The editor showcase now offers 20 named, described entries with live swatches. Selecting any entry updates the existing hover, click, movement, and still-demo cards without adding 20 perpetual animation loops. Canvas coordinate spaces and event adapters remain intentionally distinct between website, editor preview, and showcase.

### Automated and browser checks

[cursor-foundation.test.cjs](./tests/cursor-foundation.test.cjs) covers all 86 built-in presets/88 registry definitions, 60 distinct renderer paths, reduced-motion static output, and for all Phase 4 and 5 cursors: idle-frame changes, hover and click response, and palette/motion/count customization. Phase 5 templates are round-tripped individually to verify their chosen ID and settings, including bounded count values. Existing shared-runtime, cleanup, Spider, Magnetic Lines-independent config, and legacy-template tests remain in the suite.

| Environment/check | Result |
|---|---|
| Integrated browser, Chromium-based | Verified the editor showcase renders 20 named Romantic/Food entries. Clicking each entry selected it (`aria-pressed`), with no failures in the 20-entry loop. |
| Canvas swatch output | Verified all 20 showcase swatch canvases had nontransparent pixels. |
| Mouse, touch, hybrid input, pointer cancellation, drag, text selection, and form controls | Not individually tested in this phase. |
| Physical devices | Not tested; browser interactions were emulated and do not establish physical-device coverage. |
| Firefox | Not tested. |
| WebKit/Safari | Not available in this Windows environment; not tested. |
| Reduced-motion browser emulation, website activation, and saved-template UI reload | Not tested in this phase; reduced-motion static output and template persistence are covered by automated tests. |
| Magnetic Lines | No Magnetic Lines source changes were made for Phase 5. A full Magnetic Lines visual/interaction regression was not performed. |

No CPU profile, heap snapshot, repeated mount/unmount or cursor-switch leak profile, or live performance measurements were collected. Automated tests verify runtime cleanup and existing bounded particle/history logic, but do not constitute a Phase 5 runtime performance profile. Visual inspection was limited to rendered Canvas output and the editor showcase smoke test; all-browser/device visual certification remains unverified.

### Phase 5 validation

| Check | Result |
|---|---|
| `npm run test:cursor` | Passed: 20 tests. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed after resolving the showcase state synchronization lint finding. |
| `npm run build` | Passed. |
| Integrated browser showcase smoke test | 20 entries selected successfully; all 20 swatches rendered nontransparent Canvas pixels. |

**Phase 5 implementation is complete.** Remaining limitations are physical-device coverage, Firefox/WebKit coverage, exhaustive visual review, full Magnetic Lines browser regression, and runtime CPU/memory/lifecycle profiling.

## Phase 6: cursors 61–80

Phase 6 adds ten Weather and ten Space presets to the existing cursor system. The 106 built-in preset definitions and 108 renderer definitions now include these designs; System cursor and Custom image remain separate modes.

| Category | Cursor designs |
|---|---|
| Weather | Snowfall, Rain, Wind Gust, Floating Clouds, Rainbow, Northern Lights, Fog, Thunderstorm, Dust Motes, Frost Crystals |
| Space | Saturn, Mini Earth, Shooting Star, Galaxy, Black Hole, Comet, Astronaut, UFO, Rocket, Constellation |

The Canvas 2D implementations are in [weather-space-renderers.ts](./lib/cursor-effects/weather-space-renderers.ts), registered through the existing renderer registry. Each design has its own artwork and time-based animation, responds to hover/click, and uses the existing bounded creature settings for palette, speed, intensity, articulation, and element count. Idle animation can be disabled independently; reduced motion freezes ambient animation while keeping a restrained, short click response. Loops use the configured bounded element count and do not allocate persistent particle collections or create independent animation-frame loops.

The IDs, preset metadata, defaults, accessible descriptions, and editor control labels are wired through the existing config/model/registry/settings flow. The renderer is available to the website overlay, editor preview, and showcase through the existing registration and shared runtime; their rendering adapters remain intentionally separate. The editor showcase catalog includes the Phase 5 and Phase 6 entries. Existing Spider, Magnetic Lines, saved configurations, templates, and configuration versioning are preserved.

### Phase 6 automated and browser checks

[cursor-foundation.test.cjs](./tests/cursor-foundation.test.cjs) now checks 80 creature/themed renderer paths, including all 20 Phase 6 renderers. For these renderers it verifies distinct scene output, idle animation, hover and click response, palette/motion/count customization, idle-animation toggles, reduced-motion static output, and reduced-motion click feedback. Existing coverage verifies registration cleanup, shared runtime cleanup/transitions, bounded settings, and Phase 5/6 template round trips.

| Environment/check | Result |
|---|---|
| Integrated editor browser, Chromium-based | Emulated browser smoke test selected each of the 20 Phase 6 showcase buttons; all were found and reported `aria-pressed=true`. |
| Physical mouse/touch/hybrid devices | Not tested. |
| Firefox | Not tested. |
| WebKit/Safari | Not available in this Windows environment; not tested. |
| Performance/lifecycle profile | No CPU profile, heap snapshot, repeated mount/unmount profile, or measured frame/listener/memory counts were collected. No performance measurements are claimed. |
| Magnetic Lines | No Magnetic Lines source files were changed in Phase 6. This was not a dedicated visual/interaction regression pass. |

### Phase 6 validation

| Check | Result |
|---|---|
| `npm run test:cursor` | Passed: 20 tests. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. |
| Integrated Chromium showcase smoke test | All 20 Phase 6 entries selected successfully. |

**Phase 6 implementation is complete.** Physical-device testing, Firefox/WebKit coverage, exhaustive visual review, a full Magnetic Lines browser regression, and runtime CPU/memory/lifecycle profiling remain limitations. Phase 7 has not been started.

## Full-library animation and directional refinement

The shared runtime remains the common source for pointer, interaction, frame scheduling, and cleanup behavior. Website, editor preview, and showcase keep their separate Canvas/rendering adapters and coordinate spaces; all continue to use the shared runtime and registered cursor renderers. Adapter differences are intentional and are not intended to make their Canvas output pixel-identical.

Each built-in preset keeps its own default palette and behavior profile, while the existing editor controls allow users to change animation speed/intensity, easing, hover/click animation, delays and durations, movement effects, and direction sensitivity. The 80 themed presets continue to use dedicated renderers and per-cursor settings; the original shape presets retain the shared shape renderer with preset-specific settings. Direction-following now defaults on for all custom presets except Spider, whose established articulated motion remains specialized. Users can still disable direction-following, and saved configurations are not forcibly overwritten.

Interaction progress now remains inactive until its configured hover/click delay expires. Reduced-motion rendering skips ambient animation and delay waits while retaining brief, restrained click feedback. Spider's movement and pounce path is kept separate from the generic rotation behavior.

### Refinement validation

The 22 automated cursor tests cover registry defaults and all-preset directional settings, eight-way heading rotation, smoothed turns and jitter, interaction timing, dedicated themed-renderer output and interactions, reduced-motion behavior, configuration/template persistence, and shared runtime adapter/cleanup contracts. These adapter checks combine source-level assertions with equivalent deterministic runtime inputs; they do not prove browser-level visual or timing parity.

| Check | Result |
|---|---|
| `npm run test:cursor` | Passed: 22 tests. |
| `npx tsc --noEmit` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. |
| `git diff --check` | Passed; Git reported existing LF-to-CRLF working-copy warnings in unrelated files. |
| Browser/device behavior for this refinement | Not completed. No physical-device coverage is claimed. |
| Firefox | Not tested in this refinement. |
| WebKit/Safari | Not available/tested in this refinement. |
| Performance and lifecycle profile | Not run. No CPU, heap, frame-count, or memory measurements are claimed. |
| Magnetic Lines | No Magnetic Lines source changes were made for this refinement; a dedicated regression was not run. |

Existing automated tests cover runtime disposal and particle bounds, but no new measured browser profile or exhaustive visual comparison was performed. Physical touch/hybrid-device behavior, pointer cancellation, drag/text-selection behavior in browsers, cross-browser visual checks, and actual memory/CPU growth remain unverified for this refinement.
