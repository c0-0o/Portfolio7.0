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

const { DEFAULT_SCENE, applyScenePreset } = require("../lib/magnetic-lines/defaultScene.ts");
const { ORGANIC_ATMOSPHERIC_TEMPLATES, SCENE_TEMPLATE_CATEGORIES } = require("../lib/magnetic-lines/sceneTemplates.ts");
const { resolveLineConfig } = require("../lib/magnetic-lines/engine/resolveConfig.ts");
const { sanitizeSceneConfig } = require("../lib/magnetic-lines/editor/validate.ts");
const { getTextureLayerStrokeWidth, getTextureStrokeLayers } = require("../lib/magnetic-lines/texture.ts");
const persistence = require("../lib/magnetic-lines/persistence.ts");

function countAuthoredPaths(line) {
  return line.customPath.points.filter((point) => point.moveTo).length + 1;
}

function installStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  global.window = {
    localStorage: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, value); },
    },
    dispatchEvent() {},
  };
  return values;
}

test("the bundled scene catalog contains 32 unique, valid templates with four per category", () => {
  assert.equal(ORGANIC_ATMOSPHERIC_TEMPLATES.length, 32);
  assert.equal(new Set(ORGANIC_ATMOSPHERIC_TEMPLATES.map((template) => template.id)).size, 32);

  for (const category of SCENE_TEMPLATE_CATEGORIES) {
    assert.equal(ORGANIC_ATMOSPHERIC_TEMPLATES.filter((template) => template.category === category).length, 4, category);
  }

  for (const template of ORGANIC_ATMOSPHERIC_TEMPLATES) {
    const config = sanitizeSceneConfig(template.config);
    const lineIds = config.lines.map((line) => line.id);
    const pointIds = config.lines.flatMap((line) => line.customPath.points.map((point) => point.id));
    assert.ok(config.lines.length > 0, template.name);
    assert.equal(new Set(lineIds).size, lineIds.length, `${template.name}: line IDs`);
    assert.equal(new Set(pointIds).size, pointIds.length, `${template.name}: point IDs`);
    assert.ok(config.lines.every((line) => line.customPath.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)), template.name);
  }
});

test("template line features survive global config resolution", () => {
  const lines = ORGANIC_ATMOSPHERIC_TEMPLATES.flatMap((template) => template.config.lines.map((line) => ({
    line: resolveLineConfig(line, template.config.global),
    config: template.config,
  })));

  assert.ok(lines.some(({ line }) => line.flow.enabled), "at least one line keeps its authored flow");
  assert.ok(lines.some(({ line }) => line.texture.enabled), "at least one line keeps its authored texture");
  assert.ok(lines.some(({ line }) => line.cursorInfluence.enabled), "at least one line keeps cursor influence");
  assert.ok(lines.some(({ line, config }) => line.environment.airflowMode === "global" && config.global.environment.airflowEnabled), "wind lines use global airflow paths");
  assert.ok(lines.some(({ line }) => line.environment.lightMode === "global"), "light-enabled scenes expose global lights to their lines");
});

test("Spider Web has clear radial supports, an irregular broken spiral, and three air currents", () => {
  const template = ORGANIC_ATMOSPHERIC_TEMPLATES.find(({ id }) => id === "spider-web-suspended-silk");
  const { config } = template;
  const supports = config.lines.slice(0, 18);
  const spiral = config.lines[18];

  assert.equal(supports.length, 18);
  assert.ok(supports.every((line) => line.customPath.points.length === 6));
  assert.ok(supports.every((line) => line.appearance.opacity >= 0.7 && line.appearance.width >= 0.8));
  assert.ok(spiral.customPath.points.length >= 230 && spiral.customPath.points.length < 253);
  assert.equal(countAuthoredPaths(spiral), 9, "each winding has an offset natural gap");
  assert.ok(spiral.appearance.opacity >= 0.65 && spiral.appearance.width >= 0.7);
  assert.ok(config.lines.every((line) =>
    line.customPath.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)));
  assert.equal(config.global.environment.airflowPaths.length, 3);
  assert.deepEqual(config.global.environment.airflowRadii, [0.62, 0.22, 0.12]);
  assert.equal(config.global.environment.airflowBehavior, "random");
  assert.ok(config.lines.every((line) => !line.flow.enabled));
  assert.ok(config.lines.filter((line) => line.cursorInfluence.enabled).every((line) => line.cursorInfluence.maxDeformation <= 0.008));
  assert.ok(new Set(config.lines.map((line) => line.appearance.zIndex)).size > 4, "depth uses varied layers");
  assert.equal(config.global.environment.lights.length, 1);
});

test("silk-focused templates keep silk strands visible at preview scale", () => {
  const templates = ORGANIC_ATMOSPHERIC_TEMPLATES.filter(({ id }) =>
    id === "spider-web-suspended-silk" || id === "floating-silk-garden");
  const silkLines = templates.flatMap(({ config }) =>
    config.lines.filter((line) => line.texture.enabled && line.texture.type === "silk"));

  assert.ok(silkLines.length > 0);
  assert.ok(silkLines.every((line) => line.texture.intensity >= 0.7));
  const silkLayers = getTextureStrokeLayers("silk", 0.018, true, 3);
  assert.ok(silkLines.every((line) => silkLayers.every((layer) =>
    getTextureLayerStrokeWidth(line.appearance.width, layer) >= 0.45)));
});

test("Floating Silk stays an open field of 20–35 independently moving paths", () => {
  const template = ORGANIC_ATMOSPHERIC_TEMPLATES.find(({ id }) => id === "floating-silk-garden");
  const { config } = template;
  const authoredPaths = config.lines.reduce((count, line) => count + countAuthoredPaths(line), 0);

  assert.ok(authoredPaths >= 20 && authoredPaths <= 35, `expected 20–35 paths, received ${authoredPaths}`);
  assert.equal(config.global.environment.airflowPaths.length, 4);
  assert.equal(new Set(config.global.environment.airflowRadii).size, 4);
  assert.deepEqual(
    new Set(config.lines.map((line) => line.motion.type)),
    new Set(["floating", "tension", "vibration"]),
  );
  assert.ok(new Set(config.lines.map((line) => line.motion.phase)).size >= 15);
  assert.ok(config.lines.some((line) => line.texture.type === "silk" && line.texture.enabled));
  assert.ok(config.lines.some((line) => line.texture.type === "fiber" && line.texture.enabled));
  assert.ok(config.lines.some((line) => line.cursorInfluence.mode === "repel"));
  assert.ok(config.lines.some((line) => line.cursorInfluence.mode === "attract"));
});

test("Electric Neural Network has five stable clusters, local pointer response, and selective flow", () => {
  const template = ORGANIC_ATMOSPHERIC_TEMPLATES.find(({ id }) => id === "electric-neural-network");
  const { config } = template;
  const flowLines = config.lines.filter((line) => line.flow.enabled);

  assert.equal(config.lines.slice(0, 5).filter((line) => !line.shape.bendable).length, 5);
  assert.ok(config.lines.slice(6, 11).every((line) => line.glow.enabled && !line.shape.bendable), "stable junctions are individually highlighted");
  assert.equal(flowLines.filter((line) => line.flow.effectType === "plasma").length, 1);
  assert.ok(flowLines.some((line) => line.flow.effectType === "electric-current"));
  assert.ok(flowLines.some((line) => line.flow.effectType === "energy-pulse"));
  assert.ok(new Set(flowLines.map((line) => line.flow.phase)).size >= 4, "signals use staggered phases");
  assert.ok(flowLines.every((line) => line.flow.intensity < 0.6 && line.flow.width < 1.1), "energy overlays remain restrained");
  assert.ok(config.lines.some((line) => line.cursorInfluence.enabled && line.glow.enabled), "pointer response bends and highlights only selected branches");
  assert.ok(config.global.environment.lights.length === 1 && config.global.environment.lightIntensity <= 0.12);
});

test("applying a visual preset preserves the scene schema version", () => {
  const scene = sanitizeSceneConfig({
    ...DEFAULT_SCENE,
    version: 8,
    lines: DEFAULT_SCENE.lines.map((line) => ({
      ...line,
      glow: { ...line.glow, enabled: true, intensity: 37 },
    })),
  });
  const preset = applyScenePreset(scene, "Minimal Straight");

  assert.equal(preset.version, scene.version);
  assert.equal(sanitizeSceneConfig(preset).version, scene.version);
});

test("saved templates support safe save, duplicate, rename, and delete operations", () => {
  const values = installStorage();
  const scene = sanitizeSceneConfig(DEFAULT_SCENE);

  assert.equal(persistence.saveSceneTemplate("  First  ", scene), true);
  assert.deepEqual(persistence.listSceneTemplates(), ["First"]);
  assert.ok(persistence.loadSceneTemplate("First"));
  assert.equal(persistence.duplicateSceneTemplate("First", "Copy"), true);
  assert.equal(persistence.duplicateSceneTemplate("First", "Copy"), false);
  assert.equal(persistence.renameSceneTemplate("First", "Renamed"), true);
  assert.equal(persistence.renameSceneTemplate("Renamed", "Renamed"), true);
  assert.equal(persistence.renameSceneTemplate("Renamed", "Copy"), false);
  assert.deepEqual(persistence.listSceneTemplates(), ["Copy", "Renamed"]);
  assert.equal(persistence.deleteSceneTemplate("Copy"), true);
  assert.deepEqual(persistence.listSceneTemplates(), ["Renamed"]);
  assert.ok(values.has(persistence.TEMPLATE_STORAGE_KEY));
});

test("saved-template snapshots remain stable until storage changes", () => {
  installStorage();
  assert.equal(persistence.saveSceneTemplate("First", DEFAULT_SCENE), true);
  const firstSnapshot = persistence.listSceneTemplates();

  assert.strictEqual(persistence.listSceneTemplates(), firstSnapshot);
  assert.equal(persistence.saveSceneTemplate("Second", DEFAULT_SCENE), true);
  assert.notStrictEqual(persistence.listSceneTemplates(), firstSnapshot);
  assert.deepEqual(persistence.listSceneTemplates(), ["First", "Second"]);
});

test("corrupt template storage is reported without replacing or crashing", () => {
  const values = installStorage({ [persistence.TEMPLATE_STORAGE_KEY]: "{broken json" });

  assert.deepEqual(persistence.listSceneTemplates(), []);
  assert.equal(persistence.loadSceneTemplate("Lost"), null);
  assert.equal(persistence.saveSceneTemplate("New", DEFAULT_SCENE), false);
  assert.equal(values.get(persistence.TEMPLATE_STORAGE_KEY), "{broken json");
  assert.equal(persistence.deleteSceneTemplate("Lost"), false);
});

test("valid JSON with malformed template records is ignored", () => {
  installStorage({ [persistence.TEMPLATE_STORAGE_KEY]: JSON.stringify({ Broken: { version: 8 } }) });

  assert.deepEqual(persistence.listSceneTemplates(), []);
  assert.equal(persistence.loadSceneTemplate("Broken"), null);
});
