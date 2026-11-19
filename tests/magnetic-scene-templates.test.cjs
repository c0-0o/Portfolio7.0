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
const { getHeartbeatCycles } = require("../lib/magnetic-lines/engine/flowEngine.ts");
const { resolveLineConfig } = require("../lib/magnetic-lines/engine/resolveConfig.ts");
const { sanitizeSceneConfig } = require("../lib/magnetic-lines/sceneValidation.ts");
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

test("the bundled scene catalog contains 35 unique, valid templates", () => {
  assert.equal(ORGANIC_ATMOSPHERIC_TEMPLATES.length, 35);
  assert.equal(new Set(ORGANIC_ATMOSPHERIC_TEMPLATES.map((template) => template.id)).size, 35);

  for (const category of SCENE_TEMPLATE_CATEGORIES) {
    const expectedCount = category === "Organic & Nature" ? 6 : category === "Geometric & Structural" ? 5 : 4;
    assert.equal(ORGANIC_ATMOSPHERIC_TEMPLATES.filter((template) => template.category === category).length, expectedCount, category);
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

test("EDITORIAL MAGNETIC ARCHITECTURE is an editable ten-line homepage scene with a registered CTA target", () => {
  const template = ORGANIC_ATMOSPHERIC_TEMPLATES.find(({ id }) => id === "editorial-magnetic-architecture");
  assert.ok(template);
  assert.equal(template.name, "EDITORIAL MAGNETIC ARCHITECTURE");
  assert.equal(template.config.lines.length, 10);
  assert.equal(template.config.lines.filter((line) => line.texture.enabled && line.texture.type === "silk").length, 1);
  assert.ok(template.config.lines.every((line) => line.appearance.width <= 0.9 || line.id.endsWith("line-10")));
  assert.ok(template.config.lines.every((line) => line.flow.effectType !== "energy-pulse"));
  const focalLine = template.config.lines.find((line) => line.magnet.targetId === "portfolio-work-cta");
  assert.ok(focalLine?.flow.enabled);
  assert.equal(template.config.targets[0].lineIds?.[0], focalLine.id);
  assert.deepEqual(template.config.targets[0].lineTriggers?.[focalLine.id]?.magnet, ["hover", "focus", "touch"]);
  assert.ok(template.config.lines.every((line) => !line.id.includes("opening-")));
});

test("Organic Lime Filaments keeps the title and loader clear while using restrained supported effects", () => {
  const template = ORGANIC_ATMOSPHERIC_TEMPLATES.find(({ id }) => id === "opening-organic-lime-filaments");
  assert.ok(template);
  assert.equal(template.config.lines.length, 6);
  assert.ok(template.config.lines.every((line) => line.customPath.curveSmoothing >= 0.9));

  const points = template.config.lines.flatMap((line) => line.customPath.points);
  assert.ok(points.every((point) => !(point.x > 0.36 && point.x < 0.64 && point.y > 0.25 && point.y < 0.72)));
  assert.equal(template.config.lines.filter((line) => line.texture.enabled && line.texture.type === "silk").length, 2);
  assert.equal(template.config.lines.filter((line) => line.flow.enabled).length, 1);
  assert.ok(template.config.lines.filter((line) => line.cursorInfluence.enabled).every((line) => line.cursorInfluence.maxDeformation <= 0.016));
  assert.equal(template.config.global.environment.airflowBehavior, "gentle");
  assert.equal(template.config.global.environment.lightColor, "#D8F0C2");
});

test("the luminous opening preset layers silk, dotted guides, cursor-responsive pulses, and breathing nodes", () => {
  const template = ORGANIC_ATMOSPHERIC_TEMPLATES.find(({ id }) => id === "opening-luminous-silk-filaments");
  assert.ok(template);
  assert.equal(template.config.lines.length, 17);
  assert.ok(template.config.lines.every((line) => line.customPath.curveSmoothing === 1));
  assert.equal(template.config.lines.filter((line) => line.texture.enabled && line.texture.type === "silk").length, 6);
  assert.equal(template.config.lines.filter((line) => line.texture.enabled && line.texture.type === "fiber").length, 4);
  assert.equal(template.config.lines.filter((line) => line.id.includes("-node-")).length, 3);
  const filaments = template.config.lines.filter((line) => !line.id.includes("-node-"));
  const flowingSilk = filaments.filter((line) => line.texture.enabled && line.texture.type === "silk");
  assert.equal(filaments.length, 14);
  assert.equal(flowingSilk.length, 6);
  assert.ok(template.config.lines.filter((line) => line.id.includes("-node-")).every((line) => !line.flow.enabled));
  assert.ok(filaments.every((line) =>
    line.flow.enabled &&
    line.flow.effectType === "energy-pulse" &&
    line.flow.pulseRhythm === "heartbeat" &&
    line.flow.streamCount === 1 &&
    line.flow.intensity === 0.88 &&
    line.flow.width <= 1.2 &&
    line.flow.coreWidth === 1.5 &&
    line.flow.glowWidth === 4.4 &&
    line.flow.opacity === 0.97 &&
    line.flow.speed === 0.16 &&
    line.flow.pulseWidth === 0.06 &&
    line.flow.layers.current === false &&
    line.flow.coreColor === "#7AD321" &&
    line.flow.glowColor === "#A6E96B"
  ));
  assert.ok(flowingSilk.filter((line) => ["line-01", "line-05", "line-09", "line-12"].some((suffix) => line.id.endsWith(suffix)))
    .every((line) => line.texture.intensity >= 0.8));
  assert.ok(filaments.every((line) => {
    const first = line.customPath.points[0];
    const last = line.customPath.points.at(-1);
    const direction = first.x > 0.5 && last.x > first.x ? "reverse" : "forward";
    const phaseAtReveal = ((line.flow.phase + (direction === "reverse" ? -1 : 1) * getHeartbeatCycles(line.startDelay, line.flow.speed)) % 1 + 1) % 1;
    const phaseDistance = Math.min(phaseAtReveal, 1 - phaseAtReveal);
    return line.flow.direction === direction && phaseDistance < 1e-8;
  }), "each flash starts at its outer endpoint as the filament reveals");
  assert.ok(template.config.lines.filter((line) => line.cursorInfluence.enabled).every((line) => line.cursorInfluence.maxDeformation <= 0.007));

  const points = template.config.lines.filter((line) => !line.id.includes("-node-")).flatMap((line) => line.customPath.points);
  assert.ok(points.every((point) => !(point.x > 0.4 && point.x < 0.6 && point.y > 0.25 && point.y < 0.72)));
  assert.equal(template.config.global.environment.airflowBehavior, "random");
  assert.equal(template.config.global.environment.airflowPaths.length, 0);
  assert.equal(template.config.global.environment.airflowEnabled, true);
  assert.equal(template.config.global.environment.airflowStrength, 0.12);
  assert.ok(template.config.global.environment.airflowSpeed >= 0.28 && template.config.global.environment.airflowSpeed <= 0.35);
  assert.ok(template.config.lines.filter((line) => !line.id.includes("-node-")).every((line) => line.motion.amplitude <= 0.003));
  assert.ok(template.config.lines.filter((line) => !line.id.includes("-node-")).some((line) => line.motion.amplitude >= 0.0028));
});

test("opening lines unfurl like growing stems in slow waves with a one-second beat between groups", () => {
  const styles = fs.readFileSync("app/globals.css", "utf8");
  const renderer = fs.readFileSync("lib/magnetic-lines/MagneticBackgroundLines.tsx", "utf8");

  assert.match(styles, /opening-line-enter 1\.65s cubic-bezier\(\.22, 1, \.36, 1\) calc\(var\(--opening-order, 0\) \* 1s\)/);
  assert.match(styles, /opening-line-draw 1\.7s cubic-bezier\(\.2, \.8, \.2, 1\) calc\(var\(--opening-order, 0\) \* 1s\)/);
  assert.match(styles, /transform-origin: center bottom/);
  assert.match(styles, /translateY\(3px\) scaleY\(\.94\)/);
  assert.match(renderer, /Math\.ceil\(visibleLines\.length \/ 3\) - 1\) \* 1_000 \+ 2_000/);
  assert.match(renderer, /Math\.ceil\(visibleLines\.length \/ 3\)}s/);
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
