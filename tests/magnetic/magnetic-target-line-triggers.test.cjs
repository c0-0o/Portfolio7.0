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

const { DEFAULT_SCENE } = require("../../lib/magnetic-lines/defaultScene.ts");
const { sanitizeSceneConfig } = require("../../lib/magnetic-lines/sceneValidation.ts");
const {
  getTargetLineActivations,
  getTargetRegisteredActivations,
  isTargetLineEffectActive,
} = require("../../lib/magnetic-lines/engine/targetLineTriggers.ts");
const {
  getActiveTargets,
  getTargetActiveActivations,
  registerTarget,
  setTargetActive,
} = require("../../lib/magnetic-lines/engine/targetRegistry.ts");

test("line effects inherit target triggers unless independently overridden", () => {
  const target = {
    activations: ["hover", "focus"],
    lineTriggers: {
      "line-a": { magnet: ["click"], glow: [] },
    },
  };

  assert.deepEqual(getTargetLineActivations(target, "line-a", "magnet"), ["click"]);
  assert.deepEqual(getTargetLineActivations(target, "line-a", "glow"), []);
  assert.deepEqual(getTargetLineActivations(target, "line-b", "magnet"), ["hover", "focus"]);
  assert.equal(isTargetLineEffectActive(target, "line-a", "magnet", ["click"]), true);
  assert.equal(isTargetLineEffectActive(target, "line-a", "glow", ["click"]), false);
  assert.equal(isTargetLineEffectActive(target, "line-b", "glow", ["hover"]), true);
});

test("line-specific triggers are included when registering target events", () => {
  assert.deepEqual(getTargetRegisteredActivations({
    activations: ["hover"],
    lineTriggers: {
      "line-a": { magnet: ["click"], glow: ["touch"] },
      "line-b": { glow: ["focus"] },
    },
  }), ["hover", "focus", "click", "touch"]);
});

test("active event sources remain distinct for per-effect trigger matching", () => {
  assert.deepEqual(getTargetActiveActivations({
    activeSources: new Set(["hover", "click-toggle", "touch"]),
    activations: new Set(["hover", "focus", "click", "touch"]),
  }), ["hover", "click", "touch"]);
});

test("active glow-only targets remain available when target magnetism is disabled", () => {
  const element = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20 }),
    addEventListener() {},
    removeEventListener() {},
  };
  const unregister = registerTarget("glow-only-test", element, { magnetic: false });
  try {
    setTargetActive("glow-only-test", true, "hover");
    assert.deepEqual(getActiveTargets().map((target) => target.id), ["glow-only-test"]);
  } finally {
    unregister();
  }
});

test("scene validation sanitizes line triggers and removes deleted line references", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const lineId = scene.lines[0].id;
  scene.targets = [{
    id: "cta",
    enabled: true,
    magnetic: true,
    strength: 1,
    radius: 0,
    priority: 0,
    lineTriggers: {
      [lineId]: { magnet: ["click", "invalid"], glow: ["touch"] },
      "missing-line": { magnet: ["hover"] },
      "empty-line": { glow: ["invalid"] },
    },
  }];

  const [target] = sanitizeSceneConfig(scene).targets;
  assert.deepEqual(target.lineTriggers, {
    [lineId]: { magnet: ["click"], glow: ["touch"] },
  });
});
