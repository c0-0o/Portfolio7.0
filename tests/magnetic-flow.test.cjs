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
    },
  }).outputText;
  module._compile(output, filename);
};

const { DEFAULT_FLOW, DEFAULT_SCENE } = require("../lib/magnetic-lines/defaultScene.ts");
const { createFlowGeometry, renderFlowEffect, sampleFlowPath, FLOW_LAYER_COUNT } = require("../lib/magnetic-lines/engine/flowEngine.ts");
const { getMaterialFlowPaths, getMaterialFlowWidthScale, getTextureStrokeLayers, offsetTexturePoints } = require("../lib/magnetic-lines/texture.ts");
const { FLOW_PRESETS } = require("../lib/magnetic-lines/flowPresets.ts");
const { sanitizeSceneConfig } = require("../lib/magnetic-lines/editor/validate.ts");

test("flow geometry measures distance along independent paths", () => {
  const geometry = createFlowGeometry(
    [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 20, y: 20 }, { x: 23, y: 24 }],
    [3, 2],
  );

  assert.equal(geometry.paths.length, 2);
  assert.equal(geometry.totalLength, 12);
  assert.equal(geometry.paths[0].at(-1).progress, 1);
  assert.equal(geometry.pathData.match(/M /g).length, 2);
  const sample = sampleFlowPath(geometry.paths[0], 0.6);
  assert.equal(sample.point.x, 3);
  assert.ok(Math.abs(sample.point.y - 1.2) < 1e-10);
});

test("flow geometry keeps closed custom contours continuous at the seam", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  const geometry = createFlowGeometry(points, [5, 2]);
  const loop = geometry.paths[0];

  assert.equal(loop[0].closed, true);
  assert.equal(geometry.paths[1][0].closed, false);
  assert.match(geometry.pathData, /Z M /);
  assert.deepEqual(loop[0].tangent, loop.at(-1).tangent);
  assert.equal(sampleFlowPath(loop, 0).point.x, sampleFlowPath(loop, 1).point.x);
  assert.equal(sampleFlowPath(loop, 0).point.y, sampleFlowPath(loop, 1).point.y);
});

test("all flow effects follow the individual paths of a silk bundle", () => {
  const points = Array.from({ length: 21 }, (_, index) => ({ x: index * 2, y: 20 + Math.sin(index / 4) * 3 }));
  const silkLayers = getTextureStrokeLayers("silk", 0.02, true);
  const silkPaths = silkLayers.flatMap((layer) => offsetTexturePoints(
    points,
    2,
    layer.offset,
    [points.length],
    layer.offsetWave,
    layer.offsetPhase,
  ));
  const geometry = createFlowGeometry(silkPaths.flat(), silkPaths.map((path) => path.length));

  assert.equal(geometry.paths.length, silkLayers.length);
  assert.equal((geometry.pathData.match(/M /g) ?? []).length, silkLayers.length);

  for (const effectType of ["electric-current", "continuous-light", "plasma", "fiber-optic", "energy-pulse"]) {
    const frames = renderFlowEffect(
      geometry,
      geometry.pathData,
      { ...DEFAULT_FLOW, enabled: true, effectType },
      1.25,
      0.56,
      false,
    );
    assert.ok(frames[0]?.pathData.includes("M "), `${effectType} renders on silk geometry`);
    assert.equal((frames[0].pathData.match(/M /g) ?? []).length, silkLayers.length);
  }
});

test("all flow effects render on texture-matched geometry for every material", () => {
  const points = Array.from({ length: 17 }, (_, index) => ({ x: index * 3, y: 40 + Math.sin(index / 3) * 2 }));
  const materials = ["grain", "fiber", "silk", "rope", "beads", "metal"];

  for (const textureType of materials) {
    const textureLayers = getTextureStrokeLayers(textureType, 0.02, true, 4);
    const paths = getMaterialFlowPaths(textureType, points, 2, [points.length], textureLayers);
    const geometry = createFlowGeometry(paths.flat(), paths.map((path) => path.length));

    assert.ok(getMaterialFlowWidthScale(textureType) > 0);
    for (const effectType of ["electric-current", "continuous-light", "plasma", "fiber-optic", "energy-pulse"]) {
      const frames = renderFlowEffect(
        geometry,
        geometry.pathData,
        { ...DEFAULT_FLOW, enabled: true, effectType },
        0.75,
        2 * getMaterialFlowWidthScale(textureType),
        false,
      );
      assert.equal(frames.length, FLOW_LAYER_COUNT);
      assert.ok(frames.some((frame) => frame?.pathData.includes("M ")), `${effectType} renders on ${textureType}`);
    }
  }
});

test("all implemented flow effects produce bounded visible SVG layers", () => {
  const geometry = createFlowGeometry(
    Array.from({ length: 41 }, (_, index) => ({ x: index * 2, y: 20 + Math.sin(index / 5) * 4 })),
    [41],
  );
  const implementedEffects = ["electric-current", "continuous-light", "plasma", "fiber-optic", "energy-pulse"];

  for (const effectType of implementedEffects) {
    const layers = renderFlowEffect(
      geometry,
      geometry.pathData,
      { ...DEFAULT_FLOW, enabled: true, effectType },
      1.25,
      1.5,
      false,
    );
    assert.equal(layers.length, FLOW_LAYER_COUNT);
    assert.ok(layers.some((layer) => layer && layer.pathData.length > 0), `${effectType} renders visible paths`);
    assert.ok(layers.filter(Boolean).every((layer) => layer.width > 0 && layer.opacity > 0 && layer.opacity <= 1));
  }
});

test("turning off every layer hides every implemented flow effect", () => {
  const geometry = createFlowGeometry(
    Array.from({ length: 20 }, (_, index) => ({ x: index * 2, y: 12 + index })),
    [20],
  );
  const layers = { current: false, core: false, secondary: false, glow: false, branches: false, sparks: false };

  for (const effectType of ["electric-current", "continuous-light", "plasma", "fiber-optic", "energy-pulse"]) {
    const frames = renderFlowEffect(
      geometry,
      geometry.pathData,
      { ...DEFAULT_FLOW, effectType, layers },
      1,
      1,
      false,
    );
    assert.ok(frames.every((frame) => frame === null), `${effectType} respects disabled layers`);
  }
});

test("reduced motion suppresses electric branches and sparks", () => {
  const geometry = createFlowGeometry(
    Array.from({ length: 30 }, (_, index) => ({ x: index * 2, y: 40 })),
    [30],
  );
  const layers = renderFlowEffect(
    geometry,
    geometry.pathData,
    { ...DEFAULT_FLOW, layers: { ...DEFAULT_FLOW.layers, branches: true, sparks: true } },
    2,
    1,
    true,
  );

  assert.equal(layers[3], null);
  assert.equal(layers[4], null);
});

test("reduced motion slows traveling light and pulse bands", () => {
  const geometry = createFlowGeometry(
    Array.from({ length: 41 }, (_, index) => ({ x: index * 2, y: 30 })),
    [41],
  );
  const firstPoint = (pathData) => {
    const match = pathData.match(/M\s*(-?[\d.]+)\s+(-?[\d.]+)/);
    return { x: Number(match[1]), y: Number(match[2]) };
  };
  const displacement = (effectType, reducedMotion) => {
    const config = { ...DEFAULT_FLOW, effectType, speed: 0.25, phase: 0.5, tailLength: 0.2, pulseWidth: 0.2 };
    const initial = renderFlowEffect(geometry, geometry.pathData, config, 0, 1, reducedMotion)[2];
    const later = renderFlowEffect(geometry, geometry.pathData, config, 1, 1, reducedMotion)[2];
    const start = firstPoint(initial.pathData);
    const end = firstPoint(later.pathData);
    return Math.hypot(end.x - start.x, end.y - start.y);
  };

  for (const effectType of ["continuous-light", "energy-pulse"]) {
    assert.ok(displacement(effectType, true) < displacement(effectType, false), `${effectType} slows down with reduced motion`);
  }
});

test("flow presets are complete and legacy scenes receive safe defaults", () => {
  assert.equal(FLOW_PRESETS.length, 15);
  assert.ok(FLOW_PRESETS.every((preset) => preset.config.enabled && preset.config.effectType === preset.effectType));

  const legacy = {
    ...DEFAULT_SCENE,
    version: 7,
    global: { ...DEFAULT_SCENE.global, flow: undefined, textureFlow: { enabled: true, speed: 4, direction: "reverse", offset: 0.5 } },
    lines: DEFAULT_SCENE.lines.map((line) => ({ ...line, flow: undefined, textureFlow: { enabled: true, speed: 4, direction: "reverse", offset: 0.5 } })),
  };
  const sanitized = sanitizeSceneConfig(legacy);

  assert.equal(sanitized.global.flow.enabled, DEFAULT_FLOW.enabled);
  assert.equal(sanitized.lines[0].inherit.flow, true);
  assert.equal(sanitized.lines[0].flow.enabled, DEFAULT_FLOW.enabled);
  assert.equal("textureFlow" in sanitized.global, false);
  assert.equal("textureFlow" in sanitized.lines[0], false);

  const bounded = sanitizeSceneConfig({
    ...DEFAULT_SCENE,
    global: { ...DEFAULT_SCENE.global, flow: { ...DEFAULT_FLOW, streamCount: 20, strandCount: 20 } },
  });
  assert.equal(bounded.global.flow.streamCount, 3);
  assert.equal(bounded.global.flow.strandCount, 7);
});
