/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const config = require("../lib/cursor-effects/config.ts");
const registry = require("../lib/cursor-effects/registry.ts");
const model = require("../lib/cursor-effects/model.ts");
const creatureRenderers = require("../lib/cursor-effects/creature-renderers.ts");
require("../lib/cursor-effects/romance-dessert-renderers.ts");
require("../lib/cursor-effects/weather-space-renderers.ts");
const animation = require("../lib/cursor-effects/animation.ts");
const movement = require("../lib/cursor-effects/movement.ts");
const interactions = require("../lib/cursor-effects/interactions.ts");
const runtimeModule = require("../lib/cursor-effects/runtime.ts");
const library = require("../lib/cursor-effects/library.ts");

class MemoryStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("registry includes all existing built-ins and their renderer metadata", () => {
  assert.equal(config.CURSOR_PRESETS.length, 107);
  assert.equal(registry.getCursorDefinitions().length, 109);
  for (const preset of config.CURSOR_PRESETS) {
    const definition = registry.getCursorDefinition(preset.id);
    assert.ok(definition, `${preset.id} is registered`);
    assert.equal(definition.name, preset.name);
    assert.equal(definition.rendererKey, preset.id);
    assert.equal(definition.defaultConfig().cursor, preset.id);
  }
  assert.ok(registry.getCursorDefinition("spider").specializedSettings.includes("spider"));
  assert.equal(registry.getCursorDefinition("spider").animation.idle, false);
  assert.equal(registry.getCursorDefinition("black-circle").defaultConfig().color, "#101216");
  assert.equal(model.CREATURE_CURSOR_IDS.length, 80);
  for (const id of model.CREATURE_CURSOR_IDS) {
    assert.ok(creatureRenderers.isCreatureCursor(id), `${id} has a dedicated creature renderer`);
    assert.ok(registry.getCursorRenderer(id), `${id} is connected to the renderer registry`);
    assert.equal(registry.getCursorDefinition(id).animation.idle, true);
    assert.equal(registry.getCursorDefinition(id).defaultConfig().creatures[id].directionalFollow, true);
    assert.ok(registry.getCursorDefinition(id).specializedSettings.includes("creature"));
  }
  for (const definition of registry.getCursorDefinitions()) {
    if (definition.id !== "native" && definition.id !== "custom-image" && definition.id !== "spider") {
      assert.equal(definition.animation.idle, true, `${definition.id} supports a live idle state`);
      assert.equal(definition.defaultConfig().directionalFollow, definition.id !== "pointer", `${definition.id} follows movement direction by default`);
      assert.ok(definition.defaultConfig().clickDurationMs >= 100, `${definition.id} has usable interaction timing`);
    }
  }
  const pointer = registry.getCursorDefinition("pointer");
  assert.equal(pointer.name, "Pointer");
  assert.equal(pointer.category, "Classic");
  assert.equal(pointer.defaultConfig().color, "#ffffff");
  assert.equal(pointer.defaultConfig().borderColor, "#080808");
  assert.equal(pointer.defaultConfig().pointerAccentColor, "#ADEB66");
  assert.equal(pointer.defaultConfig().directionalFollow, false);
  assert.equal(pointer.defaultConfig().size, 28);
  assert.equal(pointer.defaultConfig().cursorStates.link.enabled, true);
  assert.equal(pointer.defaultConfig().cursorStates.disabled.enabled, true);
  for (const [state, cursor] of Object.entries({
    pointer: "pointer",
    link: "pointer-hand",
    text: "pointer-text",
    move: "pointer-move",
    "resize-ew": "pointer-resize-ew",
    "resize-ns": "pointer-resize-ns",
    "resize-nesw": "pointer-resize-nesw",
    "resize-nwse": "pointer-resize-nwse",
    wait: "pointer-wait",
    disabled: "pointer-not-allowed",
  })) {
    assert.equal(pointer.defaultConfig().cursorStates[state].cursor, cursor, `${state} uses its matching pointer shape`);
    assert.equal(pointer.defaultConfig().cursorStates[state].enabled, true, `${state} is enabled by the Pointer preset`);
    assert.equal(pointer.defaultConfig().cursorStates[state].accentColor, "#ADEB66", `${state} keeps the lime offset`);
    assert.equal(pointer.defaultConfig().cursorStates[state].size, 28, `${state} uses the refined Pointer size`);
  }
  for (const cursor of model.POINTER_CURSOR_SHAPE_IDS) {
    assert.equal(config.sanitizeCursorEffects({ ...config.DEFAULT_CURSOR_EFFECTS, cursor }).cursor, cursor);
  }
});

test("Pointer preset serves and renders the supplied SVG cursor artwork unchanged", () => {
  const files = [
    "pointer.svg",
    "pointer-click.svg",
    "hand.svg",
    "text.svg",
    "move.svg",
    "resize-ew.svg",
    "resize-ns.svg",
    "resize-nesw.svg",
    "resize-nwse.svg",
    "loading.svg",
    "not-allowed.svg",
  ];
  const implementation = fs.readFileSync(require.resolve("../lib/cursor-effects/CursorEffects.tsx"), "utf8");
  assert.match(implementation, /"pointer-resize-nesw": \{ src: "\/cursorsvggs\/resize-nwse\.svg"/);
  assert.match(implementation, /"pointer-resize-nwse": \{ src: "\/cursorsvggs\/resize-nesw\.svg"/);
  for (const file of files) {
    const served = fs.readFileSync(`${__dirname}/../public/cursorsvggs/${file}`);
    assert.ok(implementation.includes(`/cursorsvggs/${file}`), `${file} is wired into the cursor renderer`);
    assert.ok(served.toString("utf8").includes("#ADEB66"), `${file} preserves the reference lime accent`);
  }
});

test("Pointer state previews are prominent, labeled, and pulse loading tiles in place", () => {
  const implementation = fs.readFileSync(require.resolve("../lib/cursor-effects/CursorEffects.tsx"), "utf8");
  const styles = fs.readFileSync(`${__dirname}/../app/globals.css`, "utf8");
  for (const label of [
    "Text / I-beam",
    "Wait / loading",
    "Blocked",
    "Resize left–right",
    "Resize up–down",
  ]) {
    assert.ok(implementation.includes(`"${label}"`), `${label} has a visible state preview`);
  }
  assert.match(implementation, /<div className="cursor-effects-preview-column">\s*<CursorEffectsPreview config=\{config\} \/>\s*\{config\.cursor === "pointer" && <CursorPointerSetPreview \/>/);
  assert.match(implementation, /cursor-effects-pointer-family-swatch--loading/);
  assert.match(implementation, /const sizeScale = id === "pointer-wait" \? 0\.9 : 1;\s*const scale = \(\(radius \/ 0\.52\) \/ 48\) \* sizeScale;/);
  assert.match(implementation, /const phase = \(time \/ 360\) % squares\.length;/);
  assert.match(implementation, /const sequencePositionBySquare = \[0, 1, 3, 2\] as const;/);
  assert.match(implementation, /const colors = \["#75866A", "#91A186", "#ADB6A5", "#C7CDC1"\] as const;/);
  assert.match(implementation, /const sequencePosition = sequencePositionBySquare\[index\];\s*const distance = \(phase - sequencePosition \+ squares\.length\) % squares\.length;/);
  assert.match(implementation, /const opacity = 1 - Math\.min\(distance, 3\) \* 0\.3;/);
  assert.match(implementation, /const sizeScale = 1 \+ Math\.max\(0, 1 - distance\) \* 0\.08;/);
  assert.match(implementation, /squares\.forEach\(\(\[squareX, squareY, squareWidth, squareHeight\], index\)/);
  assert.doesNotMatch(implementation, /activeSquare/);
  assert.match(implementation, /globalCompositeOperation = "source-atop"/);
  assert.match(implementation, /cursor === "pointer-wait" && !reducedMotion\.matches/);
  assert.equal((implementation.match(/frame === 0\) \{\s*frame = window\.requestAnimationFrame\(animate\);/g) ?? []).length, 2);
  assert.equal((implementation.match(/const onCursorImageLoaded = \(\) => draw\(\);/g) ?? []).length, 2);
  assert.doesNotMatch(styles, /cursor-pointer-loading-preview|rotate\(360deg\)/);
});

test("Rapid clicks keep active burst rendering bounded", () => {
  const implementation = fs.readFileSync(require.resolve("../lib/cursor-effects/CursorEffects.tsx"), "utf8");
  assert.match(implementation, /const MAX_ACTIVE_CLICK_BURSTS = 8;/);
  assert.match(implementation, /function addClickBurst\(bursts: Burst\[\], burst: Burst\) \{\s*bursts\.push\(burst\);\s*if \(bursts\.length > MAX_ACTIVE_CLICK_BURSTS\) \{\s*bursts\.splice\(0, bursts\.length - MAX_ACTIVE_CLICK_BURSTS\);/);
  assert.equal((implementation.match(/addClickBurst\(/g) ?? []).length, 3, "website and editor clicks both use the burst cap");
});

test("Text cursor state only activates over visible selectable glyphs", () => {
  const implementation = fs.readFileSync(require.resolve("../lib/cursor-effects/CursorEffects.tsx"), "utf8");
  assert.match(implementation, /function hasTextCursorAtPoint\(target: Element, x: number, y: number\): boolean/);
  assert.match(implementation, /!target\.contains\(node\.parentElement\) \|\| window\.getComputedStyle\(node\.parentElement\)\.userSelect === "none"/);
  assert.match(implementation, /range\.getClientRects\(\)[\s\S]*?x >= rect\.left - 1 && x <= rect\.right \+ 1 && y >= rect\.top - 2 && y <= rect\.bottom \+ 2/);
  assert.match(implementation, /if \(cursor === "text"\) \{\s*return clientX !== undefined && clientY !== undefined && hasTextCursorAtPoint\(target, clientX, clientY\)/);
  assert.match(implementation, /hasTextCursorAtPoint\(target, clientX, clientY\)\) return "text";/);
  assert.match(implementation, /function isNativeCursorTarget\(target: EventTarget \| null\): boolean/);
  assert.match(implementation, /\[popover\]:popover-open, select, input\[type="color"\]/);
  assert.match(implementation, /!pointer\.current\.native && !nativePreview/);
  assert.match(implementation, /getCursorState\(event\.target, event\.clientX, event\.clientY\)/);
  assert.match(implementation, /getCursorState\(hovered, pointer\.current\.x, pointer\.current\.y\)/);
  assert.match(implementation, /getCursorState\(hovered, rect\.left \+ pointer\.x, rect\.top \+ pointer\.y\)/);
});

test("eighty creature and themed cursors draw independently defined scenes", () => {
  const silhouettes = new Set();
  for (const id of model.CREATURE_CURSOR_IDS) {
    const operations = [];
    const target = {
      createRadialGradient: (...args) => {
        operations.push(["createRadialGradient", ...args]);
        return { addColorStop: (...stopArgs) => operations.push(["addColorStop", ...stopArgs]) };
      },
      createLinearGradient: (...args) => {
        operations.push(["createLinearGradient", ...args]);
        return { addColorStop: (...stopArgs) => operations.push(["addColorStop", ...stopArgs]) };
      },
    };
    const context = new Proxy(target, {
      get(object, property) {
        if (property in object) return object[property];
        return (...args) => operations.push([property, ...args]);
      },
      set(object, property, value) {
        operations.push(["set", property, value]);
        object[property] = value;
        return true;
      },
    });
    const definition = registry.getCursorDefinition(id);
    const render = registry.getCursorRenderer(definition.rendererKey);
    const cursorConfig = config.sanitizeCursorEffects({
      ...config.DEFAULT_CURSOR_EFFECTS,
      cursor: id,
    });
    const frame = {
      context,
      config: cursorConfig,
      fillStyle: cursorConfig.color,
      x: 0,
      y: 0,
      hovered: true,
      time: 420,
      interaction: { ...interactions.createCursorInteractionState(), current: "click", lastClickAt: 180, hovered: true },
      motion: {
        directionX: 1,
        directionY: 0.3,
        speed: 0.8,
        angle: 0.3,
        walking: true,
        pounceProgress: null,
        gaitSpeed: 1,
        walkingIntensity: 1,
        legArticulation: 1,
        bodyBounce: 0,
      },
      reducedMotion: false,
    };
    assert.ok(render, `${id} has a registered renderer`);
    render(frame);
    assert.ok(operations.some(([name]) => name === "beginPath"), `${id} draws vector anatomy`);
    assert.ok(operations.some(([name]) => ["ellipse", "arc", "bezierCurveTo", "lineTo"].includes(name)), `${id} draws shaped body parts`);
    silhouettes.add(JSON.stringify(operations));

    operations.length = 0;
    if (cursorConfig.creatures[id].directionalFollow) {
      render({
        ...frame,
        motion: { ...frame.motion, directionX: 1, directionY: 0, speed: 0.2 },
      });
      const rightRotation = operations.find(([name]) => name === "rotate")?.[1];
      operations.length = 0;
      render({
        ...frame,
        motion: { ...frame.motion, directionX: 0, directionY: -1, speed: 0.2 },
      });
      const upRotation = operations.find(([name]) => name === "rotate")?.[1];
      assert.notEqual(rightRotation, upRotation, `${id} changes heading with movement direction`);
      operations.length = 0;
    }
    render({ ...frame, reducedMotion: true, time: 0 });
    assert.ok(operations.length > 0, `${id} retains a static reduced-motion appearance`);
  }
  assert.equal(silhouettes.size, 80, "each cursor has a distinct rendering path");
});

test("Phase 4, 5, and 6 cursors animate at idle and react independently to hover and click", () => {
  const phase4 = model.CREATURE_CURSOR_IDS.slice(20);
  const renderOperations = (id, time, hovered, clicked, settingsPatch = {}, reducedMotion = false) => {
    const operations = [];
    const target = {
      createRadialGradient: (...args) => {
        operations.push(["createRadialGradient", ...args]);
        return { addColorStop: (...stopArgs) => operations.push(["addColorStop", ...stopArgs]) };
      },
      createLinearGradient: (...args) => {
        operations.push(["createLinearGradient", ...args]);
        return { addColorStop: (...stopArgs) => operations.push(["addColorStop", ...stopArgs]) };
      },
    };
    const context = new Proxy(target, {
      get(object, property) {
        if (property in object) return object[property];
        return (...args) => operations.push([property, ...args]);
      },
      set(object, property, value) {
        operations.push(["set", property, value]);
        object[property] = value;
        return true;
      },
    });
    const cursorConfig = config.sanitizeCursorEffects({
      ...config.DEFAULT_CURSOR_EFFECTS,
      cursor: id,
      creatures: {
        [id]: { ...config.DEFAULT_CURSOR_EFFECTS.creatures[id], ...settingsPatch },
      },
    });
    const render = registry.getCursorRenderer(id);
    render({
      context,
      config: cursorConfig,
      fillStyle: cursorConfig.color,
      x: 0,
      y: 0,
      hovered,
      time,
      interaction: {
        ...interactions.createCursorInteractionState(),
        hovered,
        lastClickAt: clicked ? time - 160 : -10_000,
      },
      motion: {
        directionX: 1,
        directionY: 0,
        speed: 0,
        angle: 0,
        walking: false,
        pounceProgress: null,
        gaitSpeed: 1,
        walkingIntensity: 1,
        legArticulation: 1,
        bodyBounce: 0,
      },
      reducedMotion,
    });
    return JSON.stringify(operations);
  };

  assert.equal(phase4.length, 60);
  for (const id of phase4) {
    const idleFrame = renderOperations(id, 500, false, false);
    assert.notEqual(renderOperations(id, 1500, false, false), idleFrame, `${id} changes during idle animation`);
    assert.notEqual(renderOperations(id, 500, true, false), idleFrame, `${id} responds to hover`);
    assert.notEqual(renderOperations(id, 500, false, true), idleFrame, `${id} responds to click`);
    if (model.CREATURE_CURSOR_IDS.indexOf(id) >= 60) {
      assert.equal(
        renderOperations(id, 500, false, false, {}, true),
        renderOperations(id, 1500, false, false, {}, true),
        `${id} stays static under reduced motion`,
      );
      assert.notEqual(
        renderOperations(id, 500, false, true, {}, true),
        renderOperations(id, 500, false, false, {}, true),
        `${id} retains restrained click feedback under reduced motion`,
      );
      assert.equal(
        renderOperations(id, 500, false, false, { idleEnabled: false }),
        renderOperations(id, 1500, false, false, { idleEnabled: false }),
        `${id} respects the idle-animation toggle`,
      );
    }
    const settings = config.DEFAULT_CURSOR_EFFECTS.creatures[id];
    for (const [key, value] of Object.entries({
      bodyColor: "#123456",
      accentColor: "#654321",
      detailColor: "#abcdef",
      speed: settings.speed === 3 ? 2 : 3,
      intensity: settings.intensity === 2 ? 1 : 2,
      articulation: settings.articulation === 2 ? 1 : 2,
      segments: settings.segments === 16 ? 15 : settings.segments + 1,
    })) {
      assert.notEqual(
        renderOperations(id, 500, true, true, { [key]: value }),
        renderOperations(id, 500, true, true),
        `${id} ${key} customization affects its rendering`,
      );
    }
  }
});

test("registered cursors can be sanitized and unregistered independently", () => {
  const definition = {
    id: "foundation-test-cursor",
    name: "Foundation test",
    description: "Test registration.",
    category: "Test",
    rendererKey: "foundation-test-renderer",
    version: 1,
    defaultConfig: () => config.sanitizeCursorEffects({
      ...config.DEFAULT_CURSOR_EFFECTS,
      cursor: "foundation-test-cursor",
    }),
    sections: [],
    interactions: [],
    animation: { idle: false, movement: false, interaction: false },
    specializedSettings: [],
  };
  const unregisterDefinition = registry.registerCursorDefinition(definition);
  const renderer = () => {};
  const unregisterRenderer = registry.registerCursorRenderer(definition.rendererKey, renderer);

  assert.equal(definition.defaultConfig().cursor, definition.id);
  assert.equal(registry.getCursorRenderer(definition.rendererKey), renderer);
  assert.throws(() => registry.registerCursorDefinition(definition), /already registered/);
  assert.throws(() => registry.registerCursorRenderer(definition.rendererKey, () => {}), /already registered/);
  const replacement = () => {};
  const unregisterReplacement = registry.registerCursorRenderer(definition.rendererKey, replacement, true);
  assert.equal(registry.getCursorRenderer(definition.rendererKey), replacement);
  unregisterRenderer();
  assert.equal(registry.getCursorRenderer(definition.rendererKey), replacement);
  unregisterReplacement();
  unregisterDefinition();
  assert.equal(registry.getCursorDefinition(definition.id), undefined);
  assert.equal(config.sanitizeCursorEffects({ cursor: definition.id }).cursor, config.DEFAULT_CURSOR_EFFECTS.cursor);
});

test("the universal configuration is the runtime model and retains Spider settings", () => {
  const spiderConfig = config.sanitizeCursorEffects({
    ...config.DEFAULT_CURSOR_EFFECTS,
    cursor: "spider",
    spider: { ...config.DEFAULT_CURSOR_EFFECTS.spider, followDelayMs: 180 },
    color: "#123456",
    borderWidth: 3,
    widthScale: 1.5,
    heightScale: 0.75,
    rotation: 30,
    offsetX: 12,
    gradientEnabled: true,
    gradientEndColor: "#abcdef",
    gradientAngle: 120,
    animationDurationMs: 1400,
    animationEasing: "ease-out",
    followSmoothing: 0.6,
  });
  assert.equal(spiderConfig.schemaVersion, model.CURSOR_CONFIGURATION_VERSION);
  assert.equal(spiderConfig.cursor, "spider");
  assert.equal(spiderConfig.color, "#123456");
  assert.equal(spiderConfig.widthScale, 1.5);
  assert.equal(spiderConfig.heightScale, 0.75);
  assert.equal(spiderConfig.rotation, 30);
  assert.equal(spiderConfig.offsetX, 12);
  assert.equal(spiderConfig.gradientEnabled, true);
  assert.equal(spiderConfig.gradientEndColor, "#abcdef");
  assert.equal(spiderConfig.gradientAngle, 120);
  assert.equal(spiderConfig.borderWidth, 3);
  assert.equal(spiderConfig.spider.followDelayMs, 180);
  assert.equal(spiderConfig.animationDurationMs, 1400);
  assert.equal(spiderConfig.animationEasing, "ease-out");
  assert.equal(spiderConfig.followSmoothing, 0.6);
  assert.deepEqual(config.sanitizeCursorEffects(spiderConfig), spiderConfig);
});

test("animation timelines handle delay, easing, direction, and loops", () => {
  assert.equal(animation.sampleTimeline({ time: 50, delay: 100, duration: 200 }), 0);
  assert.equal(animation.sampleTimeline({ time: 200, delay: 100, duration: 200 }), 0.5);
  assert.equal(animation.sampleTimeline({ time: 200, delay: 100, duration: 200, easing: "smoothstep" }), 0.5);
  assert.equal(animation.sampleTimeline({ time: 300, delay: 100, duration: 200 }), 1);
  assert.equal(animation.sampleTimeline({ time: 150, delay: 100, duration: 200, direction: "reverse" }), 0.75);
  assert.equal(animation.sampleTimeline({ time: 350, delay: 0, duration: 200, loop: true }), 0.75);
  assert.equal(animation.sampleAnimationTrack({
    from: 4,
    to: 12,
    intensity: 0.5,
    timeline: { time: 100, delay: 0, duration: 100 },
  }), 8);
});

test("directional rotation covers eight headings and remains stable while stationary", () => {
  const directions = [
    [0, -1, 0],
    [1, -1, Math.PI / 4],
    [1, 0, Math.PI / 2],
    [1, 1, (3 * Math.PI) / 4],
    [0, 1, -Math.PI],
    [-1, 1, (-3 * Math.PI) / 4],
    [-1, 0, -Math.PI / 2],
    [-1, -1, -Math.PI / 4],
  ];
  for (const [x, y, expected] of directions) {
    const actual = animation.directionalRotation(x, y, 0.2, 1, -Math.PI / 2);
    assert.ok(Math.abs(actual - expected) < 1e-10, `direction (${x}, ${y}) has the expected smooth heading`);
  }
  assert.equal(animation.directionalRotation(-1, 0, 0, 1, -Math.PI / 2), 0);
  assert.equal(animation.sampleInteractionProgress(120, 100, 30, 200), null);
  assert.ok(animation.sampleInteractionProgress(230, 100, 30, 200) > 0.5);
  assert.equal(animation.sampleInteractionProgress(400, 100, 30, 200), 1);
});

test("pointer heading smoothing handles turns, angle wrapping, and low-velocity jitter", () => {
  const pointer = {
    x: 0, y: 0, lastX: 0, lastY: 0, lastMove: 0, active: false,
    directionX: 0, directionY: 0, speed: 0,
  };
  runtimeModule.updateCursorPointer(pointer, 0, 0, 0);
  runtimeModule.updateCursorPointer(pointer, 10, 0, 10, 0.35);
  assert.equal(pointer.directionX, 1);
  runtimeModule.updateCursorPointer(pointer, 9.5, -8, 20, 0.35);
  const turn = Math.atan2(pointer.directionY, pointer.directionX);
  assert.ok(turn < 0 && turn > -Math.PI / 2, "direction interpolates instead of snapping");
  const beforeJitter = { x: pointer.directionX, y: pointer.directionY };
  runtimeModule.updateCursorPointer(pointer, 9.7, -8, 30, 0.35);
  assert.deepEqual({ x: pointer.directionX, y: pointer.directionY }, beforeJitter);
  runtimeModule.updateCursorPointer(pointer, 10, -16, 40, 0.35);
  assert.ok(Math.abs(Math.hypot(pointer.directionX, pointer.directionY) - 1) < 1e-10);
});

test("delayed pointer sampling preserves linear interpolation and trims old samples", () => {
  const path = [
    { x: 0, y: 0, time: 0 },
    { x: 10, y: 20, time: 100 },
    { x: 20, y: 40, time: 200 },
    { x: 30, y: 60, time: 300 },
  ];
  assert.deepEqual(movement.sampleDelayedPointer(path, 300, 120), { x: 18, y: 36, time: 180 });
  assert.equal(path.length, 3);
  assert.deepEqual(movement.interpolatePoint({ x: 0, y: 10 }, { x: 10, y: 0 }, 0.5), { x: 5, y: 5 });
  assert.equal(movement.calculatePointerSpeed({ x: 0, y: 0, time: 0 }, { x: 3, y: 4, time: 10 }), 0.5);
  assert.deepEqual(movement.stepSpring({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
  }, { x: 10, y: 0 }, 2, 0.4, 0.1), {
    position: { x: 0.05, y: 0 },
    velocity: { x: 1, y: 0 },
  });
  const boundedPath = [];
  for (let time = 0; time < 300; time++) movement.recordPointerSample(boundedPath, { x: time, y: 0, time });
  assert.equal(boundedPath.length, 256);
  assert.equal(boundedPath[0].time, 44);
});

test("Spider click policy is shared across reduced and normal motion", () => {
  const state = {
    x: 10,
    y: 20,
    spiderX: 2,
    spiderY: 3,
    spiderReady: true,
    spiderPath: [],
    pounce: null,
  };
  movement.applySpiderClick(state, { x: 80, y: 90 }, 500, 120, true);
  assert.deepEqual(state, {
    x: 10,
    y: 20,
    spiderX: 80,
    spiderY: 90,
    spiderReady: true,
    spiderPath: [{ x: 80, y: 90, time: 500 }],
    pounce: null,
  });

  movement.applySpiderClick(state, { x: 100, y: 110 }, 700, 120, false);
  assert.deepEqual(state.pounce, {
    startedAt: 700,
    fromX: 80,
    fromY: 90,
    toX: 100,
    toY: 110,
  });
  assert.deepEqual(state.spiderPath, [
    { x: 100, y: 110, time: 580 },
    { x: 100, y: 110, time: 700 },
  ]);
  const reducedState = {
    ...state,
    spiderAngle: 0,
  };
  const frame = movement.sampleSpiderFrame(
    reducedState,
    720,
    config.DEFAULT_CURSOR_EFFECTS.spider,
    "linear",
    true,
  );
  assert.deepEqual(frame, { x: 100, y: 110, walking: false, pounceAge: -1 });
  assert.equal(reducedState.pounce, null);
});

test("shared runtime centralizes pointer transitions, frame deduplication, and cleanup", () => {
  const activeLoop = {
    reducedMotion: false,
    movement: false,
    bursts: false,
    glitch: false,
    spider: false,
    follow: false,
    idle: true,
    interaction: false,
    loading: false,
    simulated: false,
  };
  assert.equal(runtimeModule.shouldContinueCursorRuntime(activeLoop), true);
  assert.equal(runtimeModule.shouldContinueCursorRuntime({ ...activeLoop, reducedMotion: true }), false);
  assert.equal(runtimeModule.shouldContinueCursorRuntime({ ...activeLoop, idle: false }), false);
  assert.equal(runtimeModule.shouldContinueCursorRuntime({ ...activeLoop, idle: false, loading: true }), true);
  const originalRequest = global.requestAnimationFrame;
  const originalCancel = global.cancelAnimationFrame;
  const pendingFrames = new Map();
  const cancelledFrames = [];
  let nextFrameId = 1;
  global.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  };
  global.cancelAnimationFrame = (id) => {
    cancelledFrames.push(id);
    pendingFrames.delete(id);
  };
  try {
    const drawn = [];
    const runtime = runtimeModule.createCursorRuntime((time) => drawn.push(time));
    const distance = runtime.updatePointer(10, 20, 100, "text");
    assert.equal(distance, 0);
    assert.equal(runtime.pointer.speed, 0);
    assert.equal(runtime.interaction.current, "text-hover");
    runtime.updatePointer(20, 20, 110, "link");
    assert.equal(runtime.pointer.directionX, 1);
    assert.equal(runtime.pointer.directionY, 0);
    assert.equal(runtime.pointer.speed, 1);

    runtime.schedule();
    runtime.schedule();
    assert.equal(pendingFrames.size, 1);
    const [frameId, callback] = pendingFrames.entries().next().value;
    pendingFrames.delete(frameId);
    callback(120);
    assert.deepEqual(drawn, [120]);

    const eventTarget = new EventTarget();
    let eventCount = 0;
    runtime.listen(eventTarget, "test-event", () => eventCount++);
    eventTarget.dispatchEvent(new Event("test-event"));
    assert.equal(eventCount, 1);
    runtime.schedule();
    runtime.dispose();
    assert.equal(cancelledFrames.length, 1);
    eventTarget.dispatchEvent(new Event("test-event"));
    assert.equal(eventCount, 1);
    runtime.schedule();
    assert.equal(pendingFrames.size, 0);
  } finally {
    if (originalRequest === undefined) delete global.requestAnimationFrame;
    else global.requestAnimationFrame = originalRequest;
    if (originalCancel === undefined) delete global.cancelAnimationFrame;
    else global.cancelAnimationFrame = originalCancel;
  }
});

test("disabled native cursor configurations skip pointer tracking unless a feature needs it", () => {
  const native = config.NATIVE_CURSOR_EFFECTS;
  assert.equal(runtimeModule.hasCursorRuntimeFeatures(native), false);
  assert.equal(runtimeModule.hasCursorRuntimeFeatures({ ...native, cursor: "modern-arrow" }), true);
  assert.equal(runtimeModule.hasCursorRuntimeFeatures({ ...native, movement: "particles" }), true);
  assert.equal(runtimeModule.hasCursorRuntimeFeatures({ ...native, click: "ripple" }), true);
  assert.equal(runtimeModule.hasCursorRuntimeFeatures({ ...native, soundHover: true }), true);
  assert.equal(runtimeModule.hasCursorRuntimeFeatures({ ...native, gameEffect: true }), true);
  assert.equal(runtimeModule.hasCursorRuntimeFeatures({
    ...native,
    cursorStates: {
      ...native.cursorStates,
      link: { ...native.cursorStates.link, enabled: true, cursor: "pointer" },
    },
  }), true);
});

test("website, editor preview, and showcase preserve shared runtime behavior", () => {
  const source = fs.readFileSync(require.resolve("../lib/cursor-effects/CursorEffects.tsx"), "utf8");
  const overlay = source.slice(
    source.indexOf("export function CursorEffectsOverlay()"),
    source.indexOf("const MOVEMENT_OPTIONS"),
  );
  const preview = source.slice(
    source.indexOf("function CursorEffectsPreview"),
    source.indexOf("function CursorShowcaseCard"),
  );
  const showcase = source.slice(
    source.indexOf("function CursorShowcaseCard"),
    source.indexOf("function CursorEffectsShowcase"),
  );

  for (const [name, adapter] of [["website", overlay], ["editor preview", preview], ["showcase", showcase]]) {
    assert.ok(adapter.length > 0, `${name} adapter source is present`);
    assert.match(adapter, /createCursorRuntime\(/, `${name} uses the shared runtime`);
    assert.match(adapter, /shouldContinueCursorRuntime\(/, `${name} uses shared animation continuation`);
    assert.match(adapter, /runtime\.dispose\(\)/, `${name} disposes its runtime`);
    assert.match(adapter, /(?:particles(?:\.current)?|scene\.particles)\.length > 700/, `${name} caps particle arrays`);
  }
  assert.match(overlay, /runtime\.listen\(window, "pointercancel"/);
  assert.match(overlay, /cursorRuntimeEnabled = hasCursorRuntimeFeatures\(configRef\.current\)/);
  assert.match(overlay, /const onMove = \(event: PointerEvent\) => \{\s*if \(!cursorRuntimeEnabled\) return;/);
  assert.match(preview, /runtime\.listen\(host, "pointercancel"/);
  assert.match(overlay, /const onSelectionChange = \(\) => \{\s*runtime\.transition\(\{ type: "text-selection", active: hasTextSelection\(\) \}\);\s*if \(pointer\.current\.active\) \{[\s\S]*?pointer\.current\.native = activeCursor === null \|\| activeCursor\.cursor === "spider" \|\| isNativeCursorTarget\(hovered\);[\s\S]*?applyMode\(\);/);
  assert.match(preview, /const onSelectionChange = \(\) => \{\s*runtime\.transition\(\{ type: "text-selection", active: hasTextSelection\(\) \}\);\s*if \(pointer\.active\) \{[\s\S]*?isNativeCursorTarget\(hovered\)/);
  assert.match(showcase, /runtime\.updatePointer\(/, "showcase pointer state is simulated through the runtime");
  assert.match(overlay, /configRef\.current\s*=/, "website configuration changes reach its renderer");
  assert.match(preview, /configRef\.current = config/, "preview configuration changes reach its renderer");
  assert.match(showcase, /configRef\.current = config/, "showcase configuration changes reach its renderer");

  const originalConfig = config.sanitizeCursorEffects({
    ...config.DEFAULT_CURSOR_EFFECTS,
    cursor: "modern-arrow",
  });
  const switchedConfig = config.sanitizeCursorEffects({
    ...originalConfig,
    cursor: "spider",
    size: originalConfig.size + 4,
  });
  assert.equal(originalConfig.cursor, "modern-arrow");
  assert.equal(switchedConfig.cursor, "spider");
  assert.equal(switchedConfig.size, originalConfig.size + 4);

  const surfaces = [
    { name: "website", origin: { x: 0, y: 0 } },
    { name: "editor preview", origin: { x: 120, y: 80 } },
    { name: "showcase", origin: { x: 240, y: 160 } },
  ];
  const snapshots = surfaces.map(({ name, origin }) => {
    const runtime = runtimeModule.createCursorRuntime(() => false);
    const toLocal = (x, y) => ({ x: x - origin.x, y: y - origin.y });
    const first = toLocal(420, 260);
    const second = toLocal(440, 280);
    runtime.updatePointer(first.x, first.y, 100, "pointer");
    runtime.transition({ type: "hover", active: true });
    runtime.updatePointer(second.x, second.y, 120, "text");
    runtime.transition({ type: "click", time: 200 });
    runtime.transition({ type: "click", time: 350 });
    runtime.transition({ type: "drag", active: true });
    runtime.transition({ type: "drag", active: false });
    runtime.transition({ type: "text-selection", active: true });
    runtime.transition({ type: "focus", active: true });
    runtime.transition({ type: "idle" });

    const snapshot = {
      pointer: {
        x: runtime.pointer.x + origin.x,
        y: runtime.pointer.y + origin.y,
        directionX: runtime.pointer.directionX,
        directionY: runtime.pointer.directionY,
        speed: runtime.pointer.speed,
        state: runtime.pointer.state,
      },
      interaction: runtime.interaction,
      motionContinues: runtimeModule.shouldContinueCursorRuntime({
        reducedMotion: false,
        movement: true,
        bursts: false,
        glitch: false,
        spider: false,
        follow: false,
        idle: false,
        loading: false,
        simulated: false,
      }),
      reducedMotionContinues: runtimeModule.shouldContinueCursorRuntime({
        reducedMotion: true,
        movement: true,
        bursts: true,
        glitch: true,
        spider: true,
        follow: true,
        idle: true,
        loading: false,
        simulated: true,
      }),
    };

    const eventTarget = new EventTarget();
    let deliveredEvents = 0;
    runtime.listen(eventTarget, "probe", () => deliveredEvents++);
    runtime.leave();
    assert.equal(runtime.pointer.active, false, `${name} leaves its active pointer state`);
    assert.equal(runtime.pointer.state, null, `${name} clears its cursor state on exit`);
    assert.equal(runtime.interaction.current, "exit", `${name} reports the exit transition`);
    runtime.dispose();
    eventTarget.dispatchEvent(new Event("probe"));
    assert.equal(deliveredEvents, 0, `${name} removes its listeners on disposal`);
    return snapshot;
  });

  for (const snapshot of snapshots.slice(1)) assert.deepEqual(snapshot, snapshots[0]);
  assert.equal(snapshots[0].pointer.x, 440);
  assert.equal(snapshots[0].pointer.y, 280);
  assert.ok(Math.abs(snapshots[0].pointer.directionX - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(snapshots[0].pointer.directionY - Math.SQRT1_2) < 1e-12);
  assert.equal(snapshots[0].pointer.speed, Math.sqrt(800) / 20);
  assert.equal(snapshots[0].pointer.state, "text");
  assert.equal(snapshots[0].interaction.current, "idle");
  assert.equal(snapshots[0].interaction.hovered, true);
  assert.equal(snapshots[0].interaction.selectedText, true);
  assert.equal(snapshots[0].interaction.focused, true);
  assert.equal(snapshots[0].interaction.dragging, false);
  assert.equal(snapshots[0].motionContinues, true);
  assert.equal(snapshots[0].reducedMotionContinues, false);
});

test("interaction transitions record hover, drag, text selection, and double click", () => {
  let state = interactions.createCursorInteractionState();
  state = interactions.transitionCursorInteraction(state, { type: "hover", active: true });
  assert.equal(state.hovered, true);
  assert.equal(state.hoverStartedAt, 0);
  state = interactions.transitionCursorInteraction(state, { type: "hover", active: true, time: 80 });
  assert.equal(state.hoverStartedAt, 0, "repeated hover events do not restart the transition");
  state = interactions.transitionCursorInteraction(state, { type: "hover", active: false, time: 100 });
  assert.equal(state.hoverStartedAt, Number.NEGATIVE_INFINITY);
  state = interactions.transitionCursorInteraction(state, { type: "hover", active: true, time: 140 });
  assert.equal(state.hoverStartedAt, 140);
  state = interactions.transitionCursorInteraction(state, { type: "drag", active: true });
  assert.equal(state.dragging, true);
  state = interactions.transitionCursorInteraction(state, { type: "text-selection", active: true });
  assert.equal(state.selectedText, true);
  state = interactions.transitionCursorInteraction(state, { type: "click", time: 100 });
  state = interactions.transitionCursorInteraction(state, { type: "click", time: 250 });
  assert.equal(state.current, "double-click");
  assert.equal(interactions.canHandleInteraction(["click"], "double-click"), true);
  assert.equal(interactions.canHandleInteraction(["movement"], "drag"), false);
});

test("legacy cursor templates migrate to independent, versioned library records", () => {
  const storage = new MemoryStorage();
  const oldConfig = { ...config.DEFAULT_CURSOR_EFFECTS, cursor: "spider" };
  storage.setItem(config.CURSOR_EFFECTS_STORAGE_KEY + ":presets", JSON.stringify([
    { name: "Spider setup", config: oldConfig },
  ]));
  const loaded = library.loadCursorLibrary(storage, new Date("2025-01-01T00:00:00.000Z"));
  assert.equal(loaded.migratedLegacy, true);
  assert.equal(loaded.state.templates[0].sourceCursorId, "spider");
  assert.equal(loaded.state.templates[0].version, model.CURSOR_CONFIGURATION_VERSION);
  assert.ok(storage.getItem(config.CURSOR_EFFECTS_STORAGE_KEY + ":presets"));

  const duplicate = library.duplicateCursorTemplate(
    loaded.state,
    loaded.state.templates[0].id,
    "Spider copy",
    new Date("2025-01-02T00:00:00.000Z"),
  );
  duplicate.templates[1].configuration.spider.gaitSpeed = 2;
  assert.equal(duplicate.templates[0].configuration.spider.gaitSpeed, 1);

  const exported = library.exportCursorTemplate(duplicate.templates[0]);
  const imported = library.importCursorTemplate(exported, new Date("2025-01-03T00:00:00.000Z"));
  assert.notEqual(imported.id, duplicate.templates[0].id);
  assert.equal(imported.configuration.cursor, "spider");

  library.saveCursorLibrary(storage, duplicate);
  const restored = library.loadCursorLibrary(storage).state;
  assert.equal(restored.templates.length, 2);
  assert.deepEqual(restored.templates[0].configuration, duplicate.templates[0].configuration);
});

test("cursor customizations and template CRUD remain independent", () => {
  const storage = new MemoryStorage();
  const spiderConfig = config.sanitizeCursorEffects({
    ...config.DEFAULT_CURSOR_EFFECTS,
    cursor: "spider",
    spider: { ...config.DEFAULT_CURSOR_EFFECTS.spider, gaitSpeed: 1.8 },
  });
  let state = library.saveCursorCustomization(library.createEmptyCursorLibrary(), "spider", spiderConfig);
  assert.equal(state.customizations.spider.configuration.spider.gaitSpeed, 1.8);
  state = library.removeCursorCustomization(state, "spider");
  assert.equal(state.customizations.spider, undefined);

  const template = library.createSavedCursorTemplate("Spider gait", spiderConfig);
  state = library.putCursorTemplate(state, template);
  state = library.renameCursorTemplate(state, template.id, "Fast spider");
  assert.equal(state.templates[0].name, "Fast spider");
  state = library.deleteCursorTemplate(state, template.id);
  assert.equal(state.templates.length, 0);
  assert.equal(library.saveCursorLibrary(storage, state).templates.length, 0);
});

test("corrupt library data is reported and unsupported template imports are rejected", () => {
  const storage = new MemoryStorage();
  storage.setItem(library.CURSOR_LIBRARY_STORAGE_KEY, "{not-json");
  const result = library.loadCursorLibrary(storage);
  assert.match(result.warning, /JSON|property|position/i);
  assert.equal(result.state.templates.length, 0);
  assert.throws(() => library.importCursorTemplate('{"format":"wrong","version":1}'), /not a supported cursor template/);
  assert.throws(() => library.validateCursorLibrary({ version: 99, customizations: {}, templates: [] }), /version 99 is not supported/);
});

test("legacy and invalid Spider settings sanitize to bounded defaults", () => {
  const legacy = config.sanitizeCursorEffects({ cursor: "spider" });
  assert.deepEqual(legacy.spider, config.DEFAULT_CURSOR_EFFECTS.spider);
  const bounded = config.sanitizeCursorEffects({
    cursor: "spider",
    spider: { followDelayMs: 9999, gaitSpeed: -1, bodyBounce: 5 },
  });
  assert.equal(bounded.spider.followDelayMs, 500);
  assert.equal(bounded.spider.gaitSpeed, 0.25);
  assert.equal(bounded.spider.bodyBounce, 1);
});

test("universal appearance and motion settings sanitize for old and imported configs", () => {
  const legacy = config.sanitizeCursorEffects({ cursor: "modern-arrow", size: 32 });
  assert.equal(legacy.widthScale, 1);
  assert.equal(legacy.heightScale, 1);
  assert.equal(legacy.pointerAccentColor, "#ADEB66");
  assert.equal(legacy.animationDurationMs, config.DEFAULT_CURSOR_EFFECTS.animationDurationMs);
  const bounded = config.sanitizeCursorEffects({
    widthScale: 99,
    heightScale: 0,
    rotation: 999,
    offsetX: -999,
    gradientAngle: 900,
    animationDurationMs: 20,
    animationEasing: "bounce",
    followSmoothing: -2,
  });
  assert.equal(bounded.widthScale, 2.5);
  assert.equal(bounded.heightScale, 0.4);
  assert.equal(bounded.rotation, 180);
  assert.equal(bounded.offsetX, -100);
  assert.equal(bounded.gradientAngle, 360);
  assert.equal(bounded.animationDurationMs, 100);
  assert.equal(bounded.animationEasing, "linear");
  assert.equal(bounded.followSmoothing, 0.05);
  assert.equal(config.sanitizeCursorEffects({ ...config.DEFAULT_CURSOR_EFFECTS, schemaVersion: 1 }).schemaVersion, model.CURSOR_CONFIGURATION_VERSION);
  assert.throws(() => config.sanitizeCursorEffects({ schemaVersion: 99 }), /version 99 is not supported/);
  assert.equal(config.sanitizeCursorEffects({ ...config.DEFAULT_CURSOR_EFFECTS, unusedFutureField: true }).unusedFutureField, undefined);
});

test("creature settings migrate safely and survive template persistence", () => {
  const legacy = config.sanitizeCursorEffects({ cursor: "tiny-cat" });
  assert.deepEqual(legacy.creatures["tiny-cat"], config.DEFAULT_CURSOR_EFFECTS.creatures["tiny-cat"]);
  const customized = config.sanitizeCursorEffects({
    ...config.DEFAULT_CURSOR_EFFECTS,
    cursor: "caterpillar",
    creatures: {
      caterpillar: {
        ...config.DEFAULT_CURSOR_EFFECTS.creatures.caterpillar,
        bodyColor: "#198a43",
        accentColor: "#8ccf66",
        speed: 2.4,
        intensity: 1.7,
        articulation: 1.8,
        segments: 9,
        idleEnabled: false,
        hoverEnabled: true,
        clickEnabled: false,
      },
    },
  });
  const storage = new MemoryStorage();
  const template = library.createSavedCursorTemplate("Caterpillar crawl", customized);
  library.saveCursorLibrary(storage, library.putCursorTemplate(library.createEmptyCursorLibrary(), template));
  const restored = library.loadCursorLibrary(storage).state.templates[0].configuration;
  assert.deepEqual(restored.creatures.caterpillar, customized.creatures.caterpillar);

  const bounded = config.sanitizeCursorEffects({
    cursor: "caterpillar",
    creatures: {
      caterpillar: {
        bodyColor: "javascript:alert(1)",
        speed: 999,
        intensity: -1,
        articulation: Infinity,
        segments: 99,
        idleEnabled: false,
        hoverEnabled: false,
        clickEnabled: false,
      },
    },
  });
  assert.equal(bounded.creatures.caterpillar.bodyColor, config.DEFAULT_CURSOR_EFFECTS.creatures.caterpillar.bodyColor);
  assert.equal(bounded.creatures.caterpillar.speed, 3);
  assert.equal(bounded.creatures.caterpillar.intensity, 0);
  assert.equal(bounded.creatures.caterpillar.articulation, config.DEFAULT_CURSOR_EFFECTS.creatures.caterpillar.articulation);
  assert.equal(bounded.creatures.caterpillar.segments, 9);
  assert.equal(bounded.creatures.caterpillar.idleEnabled, false);
  assert.equal(bounded.creatures.caterpillar.hoverEnabled, false);
  assert.equal(bounded.creatures.caterpillar.clickEnabled, false);
});

test("Phase 4, 5, and 6 cursor counts sanitize and survive saved templates", () => {
  const customized = config.sanitizeCursorEffects({
    ...config.DEFAULT_CURSOR_EFFECTS,
    cursor: "maple-seeds",
    creatures: {
      "maple-seeds": {
        ...config.DEFAULT_CURSOR_EFFECTS.creatures["maple-seeds"],
        bodyColor: "#a65b2b",
        segments: 99,
        speed: 1.8,
      },
    },
  });
  assert.equal(customized.creatures["maple-seeds"].segments, 16);
  assert.equal(customized.creatures["maple-seeds"].bodyColor, "#a65b2b");
  const storage = new MemoryStorage();
  const template = library.createSavedCursorTemplate("Maple flight", customized);
  library.saveCursorLibrary(storage, library.putCursorTemplate(library.createEmptyCursorLibrary(), template));
  const restored = library.loadCursorLibrary(storage).state.templates[0].configuration;
  assert.deepEqual(restored.creatures["maple-seeds"], customized.creatures["maple-seeds"]);
  for (const id of model.CREATURE_CURSOR_IDS.slice(20)) {
    assert.ok(creatureRenderers.getCreatureSettingsLabels(id).count, `${id} has a relevant bounded count control`);
  }
});

test("Phase 5 and 6 cursor configuration and customizations survive saved-template round trips", () => {
  for (const id of model.CREATURE_CURSOR_IDS.slice(40)) {
    const customized = config.sanitizeCursorEffects({
      ...config.DEFAULT_CURSOR_EFFECTS,
      cursor: id,
      creatures: {
        [id]: {
          ...config.DEFAULT_CURSOR_EFFECTS.creatures[id],
          bodyColor: "#a65b2b",
          segments: 99,
          speed: 1.8,
        },
      },
    });
    const storage = new MemoryStorage();
    const template = library.createSavedCursorTemplate(`${id} demo`, customized);
    library.saveCursorLibrary(storage, library.putCursorTemplate(library.createEmptyCursorLibrary(), template));
    const restored = library.loadCursorLibrary(storage).state.templates[0].configuration;
    assert.equal(restored.cursor, id);
    assert.deepEqual(restored.creatures[id], customized.creatures[id]);
    assert.ok(restored.creatures[id].segments <= 16, `${id} count remains bounded`);
  }
});

test("cursor configuration saves and restores the complete canonical shape", () => {
  const storage = new MemoryStorage();
  const originalWindow = global.window;
  global.window = { localStorage: storage, dispatchEvent() {} };
  const expected = config.sanitizeCursorEffects({
    ...config.DEFAULT_CURSOR_EFFECTS,
    cursor: "spider",
    widthScale: 1.7,
    heightScale: 0.8,
    gradientEnabled: true,
    gradientEndColor: "#123abc",
    glassEffect: true,
    glitchEffect: true,
    gameEffect: true,
    soundClick: true,
    spider: { ...config.DEFAULT_CURSOR_EFFECTS.spider, followDelayMs: 200 },
    creatures: {
      ...config.DEFAULT_CURSOR_EFFECTS.creatures,
      "firefly": {
        ...config.DEFAULT_CURSOR_EFFECTS.creatures.firefly,
        accentColor: "#d8ff50",
        intensity: 1.5,
      },
    },
  });
  try {
    config.saveCursorEffects(expected);
    assert.deepEqual(config.loadCursorEffects(), expected);
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
