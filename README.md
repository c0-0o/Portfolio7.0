# Magnetic Lines Editor

This guide covers the Magnetic Lines Editor. The Cursor Effects editor is
available as a mode on the same `/editor` page.

## Open the editor

1. Install the project dependencies with `npm install` if needed.
2. Start the development server with `npm run dev`.
3. Open [`http://localhost:3000/editor`](http://localhost:3000/editor) and enter
   the shared editor password.

The Magnetic Lines and Cursor Effects editors are modes on `/editor`. They are
available only in development; the `/editor` page intentionally renders nothing
in production. The editor page, page-discovery API, and scene-writing API require
an authenticated editor session.

Set `EDITOR_PASSWORD` in the ignored `.env.local` file for local development and
in the server environment when sharing the editor. Do not commit the password.

## Basic workflow

1. Choose a route in **Editing page**. Each route has its own background scene;
   edits auto-save in this browser. The menu includes the 404 and
   under-construction pages.
2. Edit the scene in the live canvas and the left/right panels. Use the layer
   list to select, hide, solo, reorder, rename, duplicate, or delete lines.
3. Use **Preview page** to inspect the current unsaved scene with the selected
   route's real page content. Use **Pick target** to register an element from
   that preview.
4. Choose **Save & Test** to save and open the selected route with its scene.
5. Use the three-dot menu to undo/redo, change playback, apply presets or
   templates, import/export JSON, reset the scene, or clear a route override.

If you want to compare an existing design before editing, open **Presets &
templates → Open scene template library** from the three-dot menu. Search and
filter the bundled library, preview a scene, and apply it to the selected route.
You can also save, duplicate, rename, and delete your own browser-local scene
templates.

## What you can edit

### Lines, shapes, and composition

- Add lines and generated shape presets, or draw/edit custom paths directly.
- Adjust endpoints, custom path points, and curve smoothness. Choose separate
  strokes or join path segments; save reusable custom shapes in this browser.
- Move, resize, rotate, and flip selected lines or groups. Drag lines and path
  points on the canvas for direct manipulation.
- Group lines, rename groups and lines, and transform or reorder groups.
- Control layer order, visibility, solo preview, and crossing gaps. Higher
  layers render over lower layers.

### Appearance and materials

- Set stroke color, opacity, and width. Color styles include solid, linear,
  radial, diamond, rainbow, and animated random gradients; gradient colors and
  their distribution are editable.
- Add surface treatments such as film grain, fibers, silk filaments, rope,
  beads, and metal. Material controls include weight and available strand,
  thread, or surface details.
- Add Flow & Energy overlays that follow the animated line, including electric
  current, continuous light, plasma, fiber optic, and energy pulse effects.
  Configure effect style, movement, intensity, and layering independently of
  the underlying material.

### Motion and physical effects

- Animate lines with tension, floating, or vibration motion. Tune speed,
  amplitude, frequency, phase, flexibility, and per-line start delay.
- Edit generated-shape parameters such as amplitude, frequency, cycles, phase,
  smoothness, irregularity, distortion, roughness, and pixel step.
- Configure cursor influence, target magnetism, and inner/outer glow separately.
- Add smooth environmental airflow and moving colored lights. Airflow paths,
  influence radii, speed, and strength are adjustable; lights have editable
  travel paths, color, radius, intensity, speed, and playback.
- Enable gravity and pin endpoints or custom-shape vertices. Enable line-to-line
  interaction and tune crossing gaps for layered intersections.
- Set reduced-motion behavior and use the toolbar playback controls to pause,
  play, reset, or change the preview speed.

### Targets and anchors

- Add page targets by picking elements in **Preview page**. Targets can activate
  on hover, focus, click, and touch; click can be press-based or toggled.
- Assign targets to all lines or selected lines. Configure each line's magnet
  and glow responses, trigger behavior, priority, strength, and radius.
- Attach ordered anchor routes to line endpoints or editable shape vertices.
  Drag route waypoints, set easing, and choose always, hover, or click activation.

## Scene, page, and template storage

- Page scenes and saved templates live in this browser's local storage; they are
  not automatically shared across browsers or devices.
- **Use page default** removes the selected route's saved override and restores
  its built-in scene. **Remove selected page from list** only removes the route
  from the editor's visited-page list.
- **Export** copies or downloads the current scene as JSON. **Import** accepts
  scene JSON and validates/clamps values before applying it.
- **Save & Test** persists the selected route's scene before navigating to it.
  Use the browser's back button to return to the editor.

## Handy editing tips

- Collapse the side panels to get more room for the canvas; reopen them with
  **Show panels**.
- Open the **Layers** list and drag entries to change draw order. Use Ctrl/Cmd
  selection to move a block together.
- Expand the line's environment section to view airflow guides and light handles.
- Open a line's texture or Flow & Energy section to preview material-specific
  controls without changing the rest of the scene.
- Use Undo/Redo after canvas transforms or numeric edits; a drag or text edit is
  grouped into a history step.

For implementation details about the shared renderer and scene format, see
[`lib/magnetic-lines/README.md`](./lib/magnetic-lines/README.md).
