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

const { createAirflowField, getAirflowBehaviorEnvelope, getEnvironmentLightPosition, getEnvironmentLights, resolveLineAirflowPath, resolveLineAirflowPaths, resolveLineAirflowRadii, resolveLineEnvironment, smoothAirflowPath } = require("../lib/magnetic-lines/environment.ts");
const { getTextureGravityResponse, getTextureLightResponse, getTextureMaterialResponse } = require("../lib/magnetic-lines/texture.ts");
const { makeBlankLine, sanitizeSceneConfig } = require("../lib/magnetic-lines/editor/validate.ts");
const { createGeneratedShapePath } = require("../lib/magnetic-lines/editor/shapePresets.ts");
const { DEFAULT_SCENE } = require("../lib/magnetic-lines/defaultScene.ts");
const { computeLine, createLineRuntimeState } = require("../lib/magnetic-lines/engine/lineEngine.ts");
const { resolveLineConfig } = require("../lib/magnetic-lines/engine/resolveConfig.ts");
const { getTargetAssignedLineIds, updateTargetLineAssignments } = require("../lib/magnetic-lines/editor/targetAssignments.ts");
const { computeLineInteractionOffsets } = require("../lib/magnetic-lines/engine/lineInteraction.ts");
const { getActiveTargets, registerTarget, setTargetActive } = require("../lib/magnetic-lines/engine/targetRegistry.ts");

const baseEnvironment = {
  enabled: true,
  airflowEnabled: true,
  airflowBehavior: "steady",
  airflowPath: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
  airflowSpeed: 0.4,
  airflowStrength: 0.8,
  airflowRadius: 0.3,
  lightEnabled: true,
  lightColor: "#a6dcff",
  lightPosition: { x: 0.5, y: 0.3 },
  lightIntensity: 0.4,
  lightRadius: 0.3,
};

test("airflow follows its drawn direction and eases strength with distance", () => {
  const airflow = createAirflowField(baseEnvironment, { width: 1000, height: 1000 });
  assert.ok(airflow);

  const near = airflow({ x: 500, y: 510 }, { x: 0, y: 1 }, 0.25, 1);
  const far = airflow({ x: 500, y: 900 }, { x: 0, y: 1 }, 0.25, 1);
  const parallel = airflow({ x: 500, y: 500 }, { x: 1, y: 0 }, 0.25, 1);

  assert.ok(near.x > 0);
  assert.ok(Math.abs(near.x) > Math.abs(far.x));
  assert.ok(Math.abs(parallel.x) < 1e-10);
  assert.ok(Math.abs(parallel.y) < 1e-10);
});

test("small airflow radius stays local while broad radius reaches farther", () => {
  const narrow = createAirflowField({
    ...baseEnvironment,
    airflowPath: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }],
    airflowRadius: 0.005,
    airflowStrength: 1,
  }, { width: 1000, height: 800 }, false, 30);
  const broad = createAirflowField({
    ...baseEnvironment,
    airflowPath: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }],
    airflowRadius: 0.4,
    airflowStrength: 1,
  }, { width: 1000, height: 800 });
  const tangent = { x: 1, y: 0 };
  const localEffect = narrow({ x: 500, y: 400 }, tangent, 0, 1);
  const outsideNarrow = narrow({ x: 560, y: 400 }, tangent, 0, 1);
  const outsideBroad = broad({ x: 560, y: 400 }, tangent, 0, 1);

  assert.ok(Math.abs(localEffect.y) > 0);
  assert.deepEqual(outsideNarrow, { x: 0, y: 0 });
  assert.ok(Math.abs(outsideBroad.y) > 0);
});

test("airflow paths use independent radii and refresh cached segments after radius edits", () => {
  const paths = [[{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }]];
  const environment = {
    ...baseEnvironment,
    airflowPath: paths[0],
    airflowPaths: paths,
    airflowRadii: [0.05],
    airflowStrength: 1,
  };
  const query = { x: 560, y: 400 };
  const tangent = { x: 1, y: 0 };
  assert.deepEqual(createAirflowField(environment, { width: 1000, height: 800 })(query, tangent, 0, 1), { x: 0, y: 0 });

  environment.airflowRadii[0] = 0.2;
  const widened = createAirflowField(environment, { width: 1000, height: 800 });
  assert.notDeepEqual(widened(query, tangent, 0, 1), { x: 0, y: 0 });
});

test("silk uses one coherent gust envelope across its bundle", () => {
  const gustyEnvironment = { ...baseEnvironment, airflowBehavior: "gusty" };
  const ordinaryAirflow = createAirflowField(gustyEnvironment, { width: 1000, height: 1000 });
  const silkAirflow = createAirflowField(gustyEnvironment, { width: 1000, height: 1000 }, true);
  const firstPoint = { x: 300, y: 510 };
  const lastPoint = { x: 500, y: 510 };
  const tangent = { x: 0, y: 1 };
  const firstOrdinary = ordinaryAirflow(firstPoint, tangent, 0.7, 1);
  const lastOrdinary = ordinaryAirflow(lastPoint, tangent, 0.7, 1);
  const firstSilk = silkAirflow(firstPoint, tangent, 0.7, 1);
  const lastSilk = silkAirflow(lastPoint, tangent, 0.7, 1);

  assert.notEqual(firstOrdinary.x, lastOrdinary.x);
  assert.equal(firstSilk.x, lastSilk.x);
  assert.equal(firstSilk.y, lastSilk.y);
});

test("airflow is disabled without an active path and light materials resist more", () => {
  assert.equal(createAirflowField({ ...baseEnvironment, airflowEnabled: false }, { width: 800, height: 600 }), null);
  assert.equal(createAirflowField({ ...baseEnvironment, airflowPath: [] }, { width: 800, height: 600 }), null);
  assert.ok(getTextureMaterialResponse("silk", 0.55, true) > getTextureMaterialResponse("metal", 2.2, true));
  assert.equal(getTextureMaterialResponse("silk", 0.55, false), 1);
  assert.ok(getTextureLightResponse("silk", true) > getTextureLightResponse("rope", true));
});

test("global and individual environment settings respect each line's opt-in and effect modes", () => {
  assert.ok(DEFAULT_SCENE.lines.every((line) => !line.environmentEnabled));
  const global = { ...baseEnvironment, airflowPaths: undefined, airflowPath: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }] };
  const line = structuredClone(DEFAULT_SCENE.lines[0]);
  const disabled = resolveLineEnvironment(global, line.environment, false);
  assert.equal(disabled.enabled, false);

  const globallyEnabled = resolveLineEnvironment(global, line.environment, true);
  assert.equal(globallyEnabled.airflowEnabled, true);
  assert.equal(globallyEnabled.airflowBehavior, global.airflowBehavior);
  assert.equal(globallyEnabled.lightEnabled, true);
  assert.deepEqual(globallyEnabled.airflowPath, global.airflowPath);

  const individual = resolveLineEnvironment(
    { ...global, enabled: false },
    {
      ...line.environment,
      airflowMode: "individual",
      airflowBehavior: "gusty",
      airflowPath: [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.8 }],
      airflowPaths: undefined,
      lightMode: "off",
    },
    true,
  );
  assert.equal(individual.enabled, true);
  assert.equal(individual.airflowEnabled, true);
  assert.equal(individual.airflowBehavior, "gusty");
  assert.equal(individual.lightEnabled, false);
  assert.deepEqual(individual.airflowPath, [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.8 }]);

  const individualLight = resolveLineEnvironment(
    global,
    {
      ...line.environment,
      airflowMode: "off",
      lightMode: "individual",
      lightColor: "#ff8800",
      lightPosition: { x: 0.8, y: 0.2 },
      lights: undefined,
    },
    true,
  );
  assert.equal(individualLight.airflowEnabled, false);
  assert.equal(individualLight.lightEnabled, true);
  assert.equal(individualLight.lightColor, "#ff8800");
  assert.deepEqual(individualLight.lightPosition, { x: 0.8, y: 0.2 });

  const globalAirflow = { ...baseEnvironment, airflowPaths: undefined, airflowPath: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }] };
  const lineAirflow = {
    ...line.environment,
    airflowMode: "individual",
    airflowPath: [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.8 }],
    airflowPaths: undefined,
    airflowBehavior: "gusty",
  };
  assert.deepEqual(resolveLineAirflowPath(globalAirflow, { ...lineAirflow, airflowMode: "global" }, true), globalAirflow.airflowPath);
  assert.equal(resolveLineEnvironment(globalAirflow, { ...lineAirflow, airflowMode: "global" }, true).airflowBehavior, globalAirflow.airflowBehavior);
  assert.deepEqual(resolveLineAirflowPath(globalAirflow, lineAirflow, true), lineAirflow.airflowPath);
  assert.deepEqual(resolveLineAirflowPath(globalAirflow, { ...lineAirflow, airflowMode: "off" }, true), []);
  assert.deepEqual(resolveLineAirflowPath(globalAirflow, lineAirflow, false), []);
  assert.deepEqual(resolveLineAirflowPath({ ...globalAirflow, enabled: false }, { ...lineAirflow, airflowMode: "global" }, true), []);
});

test("individual environment keeps multiple airflow paths and animated light sources", () => {
  const global = structuredClone(DEFAULT_SCENE.global.environment);
  const line = structuredClone(DEFAULT_SCENE.lines[0].environment);
  line.airflowMode = "individual";
  line.lightMode = "individual";
  line.airflowStrength = 1;
  line.airflowPaths = [
    [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }],
    [{ x: 0.1, y: 0.8 }, { x: 0.9, y: 0.8 }],
  ];
  line.airflowRadii = [0.1, 0.3];
  line.lights = [{
    id: "moving",
    color: "#ffffff",
    position: { x: 0.1, y: 0.2 },
    endPosition: { x: 0.9, y: 0.8 },
    intensity: 0.7,
    radius: 0.25,
    speed: 0.5,
    playback: "loop",
  }];
  const resolved = resolveLineEnvironment(global, line, true);

  assert.deepEqual(resolveLineAirflowPaths(global, line, true), line.airflowPaths);
  assert.deepEqual(resolveLineAirflowRadii(global, line, true), line.airflowRadii);
  assert.equal(resolved.airflowPaths.length, 2);
  assert.deepEqual(resolved.airflowRadii, line.airflowRadii);
  assert.deepEqual(resolved.lights, line.lights);
  const field = createAirflowField(resolved, { width: 1000, height: 800 });
  assert.notDeepEqual(field({ x: 500, y: 160 }, { x: 0, y: 1 }, 0, 1), { x: 0, y: 0 });
  assert.notDeepEqual(field({ x: 500, y: 640 }, { x: 0, y: 1 }, 0, 1), { x: 0, y: 0 });
  assert.deepEqual(getEnvironmentLightPosition(line.lights[0], 1), { x: 0.5, y: 0.5 });
  assert.deepEqual(getEnvironmentLightPosition({ ...line.lights[0], playback: "once" }, 4), line.lights[0].endPosition);
});

test("airflow profiles include steady, gentle, storm, and intermittent phases", () => {
  const steady = getAirflowBehaviorEnvelope("steady", 2, 1, 0.5);
  const gentle = getAirflowBehaviorEnvelope("gentle", 2, 1, 0.5);
  const storm = getAirflowBehaviorEnvelope("storm", 2, 1, 0.5);
  assert.equal(steady, 1);
  assert.ok(gentle > 0.25 && gentle < 0.55);
  assert.ok(storm >= 0.6 && storm <= 2);

  const randomValues = Array.from({ length: 2400 }, (_, index) =>
    getAirflowBehaviorEnvelope("random", index * 0.1, 0.35, 0.5));
  assert.ok(Math.min(...randomValues) >= 0.06);
  assert.ok(Math.min(...randomValues) < 0.2);
  assert.ok(Math.max(...randomValues) > 1.2);
  assert.ok(randomValues.filter((value) => value < 0.2).length > 100);
  assert.ok(randomValues.filter((value) => value >= 0.28 && value < 0.7).length > 300);
  assert.ok(randomValues.filter((value) => value >= 0.78).length > 100);
  assert.deepEqual(
    randomValues.slice(0, 20),
    Array.from({ length: 20 }, (_, index) => getAirflowBehaviorEnvelope("random", index * 0.1, 0.35, 0.5)),
  );
});

test("random airflow varies smoothly with irregular phase durations", () => {
  const sample = (time) => getAirflowBehaviorEnvelope("random", time, 1, 0.5);
  const duration = 0.001;
  const randomUnit = (index) => {
    let value = (index | 0) + 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const knotTimes = Array.from({ length: 8 }, (_, index) =>
    5.2 * index + (randomUnit(index + 0x6a09e667) - 0.5) * 1.2,
  );
  const intervals = knotTimes.slice(1).map((time, index) => time - knotTimes[index]);
  assert.ok(Math.max(...intervals) - Math.min(...intervals) > 0.1);

  for (const knotTime of knotTimes.slice(2, 6)) {
    const before = (sample(knotTime) - sample(knotTime - duration)) / duration;
    const after = (sample(knotTime + duration) - sample(knotTime)) / duration;
    assert.ok(Math.abs(before - after) < 0.02);
  }

  const values = Array.from({ length: 4800 }, (_, index) => sample(index * 0.05));
  assert.ok(Math.min(...values) >= 0.06);
  assert.ok(Math.max(...values) > 1.4);
  assert.ok(values.filter((value) => value < 0.22).length > 100);
  assert.ok(values.filter((value) => value >= 0.28 && value < 0.7).length > 200);
  assert.ok(values.filter((value) => value >= 0.78).length > 50);
  assert.ok(Math.max(...values.slice(1).map((value, index) => Math.abs(value - values[index]))) < 0.05);
});

test("random airflow creates a smooth drifting field beyond its authored breeze paths", () => {
  const environment = {
    ...baseEnvironment,
    airflowBehavior: "random",
    airflowPath: [],
    airflowPaths: [],
    airflowRadii: [],
    airflowSpeed: 0.72,
    airflowStrength: 0.38,
  };
  const airflow = createAirflowField(environment, { width: 1000, height: 800 });
  const point = { x: 420, y: 650 };
  const tangent = { x: 1, y: 0 };
  const first = airflow(point, tangent, 1.5, 1);
  const nearby = airflow({ x: point.x + 1, y: point.y }, tangent, 1.5, 1);
  const later = airflow(point, tangent, 2.5, 1);

  assert.ok(Math.hypot(first.x, first.y) > 2, "the ambient field remains active without guide paths");
  assert.ok(Math.hypot(first.x - nearby.x, first.y - nearby.y) < 0.2, "nearby samples move continuously");
  assert.ok(Math.hypot(first.x - later.x, first.y - later.y) > 0.5, "the ambient field visibly drifts over time");
});

test("airflow drawing paths are smoothly interpolated and legacy paths stay bounded", () => {
  const drawnPath = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }];
  const smoothPath = smoothAirflowPath(drawnPath);
  assert.equal(smoothPath.length, 5);
  assert.deepEqual(smoothPath[0], drawnPath[0]);
  assert.deepEqual(smoothPath.at(-1), drawnPath.at(-1));
  assert.ok(smoothPath[1].y > 0);

  const legacyScene = structuredClone(DEFAULT_SCENE);
  delete legacyScene.global.environment;
  delete legacyScene.global.textureWeight;
  for (const line of legacyScene.lines) {
    line.environmentEnabled = true;
    delete line.environment;
    delete line.texture.weight;
  }
  const restored = sanitizeSceneConfig(legacyScene);
  assert.equal(restored.global.environment.enabled, false);
  assert.equal(restored.lines[0].environmentEnabled, false);
  assert.equal(restored.lines[0].environment.airflowMode, "global");
  assert.equal(restored.lines[0].texture.weight, 1);

  const bounded = sanitizeSceneConfig({
    ...legacyScene,
    global: {
      ...legacyScene.global,
      environment: {
        ...baseEnvironment,
        airflowPath: Array.from({ length: 140 }, () => ({ x: 2, y: -1 })),
      },
    },
  });
  assert.equal(bounded.global.environment.airflowPath.length, 128);
  assert.deepEqual(bounded.global.environment.airflowPath[0], { x: 1, y: 0 });
});

test("silk responds more to cursor influence and drawn airflow than heavier metal", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.lines = [scene.lines[0]];
  const line = scene.lines[0];
  line.from = { x: 0.5, y: 0.15 };
  line.to = { x: 0.5, y: 0.85 };
  line.shape = { ...line.shape, type: "straight", amplitude: 0 };
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: false },
    end: { ...line.anchorMotion.end, enabled: false },
  };
  line.inherit = { ...line.inherit, texture: false };
  scene.global.cursorInfluence = {
    enabled: true,
    strength: 1,
    radius: 0.4,
    falloff: 0.5,
    maxDeformation: 0.1,
    profile: "balanced",
    smoothing: 0,
    mode: "attract",
  };

  function centerDisplacement(type, weight, environmentEnabled) {
    line.texture = { ...line.texture, enabled: true, type, weight };
    line.environmentEnabled = true;
    scene.global.environment = environmentEnabled
      ? { ...baseEnvironment, airflowPath: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }] }
      : { ...baseEnvironment, enabled: false, airflowEnabled: false };
    const resolved = resolveLineConfig(line, scene.global);
    const state = createLineRuntimeState();
    let result;
    for (let frame = 0; frame < 36; frame++) {
      result = computeLine(
        resolved,
        scene,
        state,
        frame / 60,
        1 / 60,
        { width: 1000, height: 800 },
        { x: 600, y: 400, active: true },
      );
    }
    return Math.abs(result.points[12].x - 500);
  }

  const silkCursor = centerDisplacement("silk", 0.55, false);
  const metalCursor = centerDisplacement("metal", 2.2, false);
  const silkAir = centerDisplacement("silk", 0.55, true);
  const metalAir = centerDisplacement("metal", 2.2, true);

  assert.ok(silkCursor > metalCursor * 1.5);
  assert.ok(silkAir > metalAir * 1.5);
});

test("connected closed paths stay joined under airflow; breakable seams can separate", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  line.geometrySource = "path";
  line.shape = { ...line.shape, type: "straight", amplitude: 0 };
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: false },
    end: { ...line.anchorMotion.end, enabled: false },
  };
  line.environmentEnabled = true;
  line.environment.airflowMode = "global";
  line.customPath = {
    closedJoint: "connected",
    points: [
      { id: "a", x: 0.15, y: 0.2 },
      { id: "b", x: 0.8, y: 0.22 },
      { id: "c", x: 0.55, y: 0.8 },
      { id: "d", x: 0.15, y: 0.2 },
    ],
  };
  scene.lines = [line];
  scene.global.environment = {
    ...baseEnvironment,
    airflowBehavior: "gusty",
    airflowPath: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }],
    airflowRadius: 0.5,
  };

  function endpointDistance(closedJoint) {
    line.customPath.closedJoint = closedJoint;
    const state = createLineRuntimeState();
    let result;
    for (let frame = 0; frame < 60; frame++) {
      result = computeLine(
        resolveLineConfig(line, scene.global),
        scene,
        state,
        frame / 60,
        1 / 60,
        { width: 1000, height: 800 },
        null,
      );
    }
    return Math.hypot(
      result.points[0].x - result.points[result.points.length - 1].x,
      result.points[0].y - result.points[result.points.length - 1].y,
    );
  }

  assert.equal(endpointDistance("connected"), 0);
  assert.ok(endpointDistance("breakable") > 0);
});

test("line gravity sags between fixed endpoints and free lines fall", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  line.from = { x: 0.1, y: 0.3 };
  line.to = { x: 0.9, y: 0.3 };
  line.shape = { ...line.shape, type: "straight", amplitude: 0 };
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: false },
    end: { ...line.anchorMotion.end, enabled: false },
  };
  line.gravity = { enabled: true, strength: 0.5, fixedPointIds: ["start", "end"] };
  scene.lines = [line];

  function render(fixedPointIds) {
    line.gravity.fixedPointIds = fixedPointIds;
    return computeLine(
      resolveLineConfig(line, scene.global),
      scene,
      createLineRuntimeState(),
      0,
      1 / 60,
      { width: 1000, height: 800 },
      null,
    ).points;
  }

  const pinned = render(["start", "end"]);
  const free = render([]);
  const singlePinned = render(["start"]);
  const baseline = { ...line, gravity: { ...line.gravity, enabled: false } };
  const unweighted = computeLine(
    resolveLineConfig(baseline, scene.global),
    scene,
    createLineRuntimeState(),
    0,
    1 / 60,
    { width: 1000, height: 800 },
    null,
  ).points;

  assert.equal(pinned[0].y, unweighted[0].y);
  assert.equal(pinned.at(-1).y, unweighted.at(-1).y);
  assert.ok(pinned[12].y > unweighted[12].y);
  assert.ok(free.every((point) => Math.abs(point.y - 800) < 0.01));
  assert.equal(singlePinned[0].y, unweighted[0].y);
  assert.ok(Math.abs(singlePinned.at(-1).y - 800) < 0.01);
  assert.ok(singlePinned[12].y > unweighted[12].y);
});

test("cursor influence bends a gravity-sagged line while keeping gravity pins fixed", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  line.from = { x: 0.1, y: 0.3 };
  line.to = { x: 0.9, y: 0.3 };
  line.shape = { ...line.shape, type: "straight", amplitude: 0 };
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: false },
    end: { ...line.anchorMotion.end, enabled: false },
  };
  line.gravity = { enabled: true, strength: 0.5, fixedPointIds: ["start", "end"] };
  scene.lines = [line];
  scene.global.cursorInfluence = {
    enabled: true,
    strength: 1,
    radius: 0.8,
    falloff: 0.5,
    maxDeformation: 0.1,
    profile: "balanced",
    smoothing: 0,
    mode: "attract",
  };

  const config = resolveLineConfig(line, scene.global);
  const state = createLineRuntimeState();
  let result;
  for (let frame = 0; frame < 36; frame++) {
    result = computeLine(
      config,
      scene,
      state,
      frame / 60,
      1 / 60,
      { width: 1000, height: 800 },
      { x: 500, y: 180, active: true },
    );
  }
  const baseline = computeLine(
    { ...config, cursorInfluence: { ...config.cursorInfluence, enabled: false } },
    scene,
    createLineRuntimeState(),
    0,
    1 / 60,
    { width: 1000, height: 800 },
    null,
  );

  assert.ok(result.points[12].y < baseline.points[12].y);
  assert.equal(result.points[0].y, baseline.points[0].y);
  assert.equal(result.points.at(-1).y, baseline.points.at(-1).y);

  const activeCursorOffset = Math.max(...state.cursorOffset.map(({ x, y }) => Math.hypot(x, y)));
  for (let frame = 36; frame < 60; frame++) {
    computeLine(
      config,
      scene,
      state,
      frame / 60,
      1 / 60,
      { width: 1000, height: 800 },
      { x: 500, y: 180, active: false },
    );
  }
  const releasedCursorOffset = Math.max(...state.cursorOffset.map(({ x, y }) => Math.hypot(x, y)));
  assert.ok(releasedCursorOffset < activeCursorOffset, "cursor influence eases away after the pointer leaves");
});

test("rigid custom shapes keep their exact contour despite motion and interactive forces", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  line.from = { x: 0.2, y: 0.2 };
  line.to = { x: 0.8, y: 0.8 };
  line.geometrySource = "path";
  line.customPath = {
    points: createGeneratedShapePath("triangle", line, { width: 1000, height: 800 }),
    aspectRatio: 1000 / 800,
  };
  line.inherit.shape = false;
  line.shape = { ...line.shape, bendable: false, type: "liquid", amplitude: 0.08 };
  line.inherit.motion = true;
  line.motion = { ...line.motion, enabled: true, type: "floating", amplitude: 0.08, speed: 1 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: true, radius: 0.1 },
    end: { ...line.anchorMotion.end, enabled: true, radius: 0.1 },
  };
  line.gravity = { enabled: true, strength: 1, fixedPointIds: [] };
  line.environmentEnabled = true;
  line.cursorInfluence = {
    ...line.cursorInfluence,
    enabled: true,
    strength: 1,
    radius: 1,
    maxDeformation: 0.2,
  };
  scene.lines = [line];
  scene.global.environment = {
    ...baseEnvironment,
    enabled: true,
    airflowEnabled: true,
    airflowPath: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
    airflowStrength: 1,
    airflowRadius: 0.8,
  };
  scene.global.cursorInfluence = { ...line.cursorInfluence };

  const config = resolveLineConfig(line, scene.global);
  assert.equal(config.shape.bendable, false);
  const rigidState = createLineRuntimeState();
  for (const offsets of [rigidState.deformOffset, rigidState.environmentOffset, rigidState.cursorOffset]) {
    for (const offset of offsets) {
      offset.x = 100;
      offset.y = -100;
    }
  }
  const result = computeLine(
    config,
    scene,
    rigidState,
    2,
    1 / 60,
    { width: 1000, height: 800 },
    { x: 500, y: 300, active: true },
  );
  const baselineScene = {
    ...scene,
    global: {
      ...scene.global,
      environment: { ...scene.global.environment, enabled: false, airflowEnabled: false },
      cursorInfluence: { ...scene.global.cursorInfluence, enabled: false },
      motionEnabled: false,
    },
  };
  const baselineConfig = resolveLineConfig(
    { ...line, gravity: { ...line.gravity, enabled: false } },
    baselineScene.global,
  );
  const baseline = computeLine(
    baselineConfig,
    baselineScene,
    createLineRuntimeState(),
    2,
    1 / 60,
    { width: 1000, height: 800 },
    null,
  );

  assert.deepEqual(baseline.points, result.points);
  assert.ok([...rigidState.deformOffset, ...rigidState.environmentOffset, ...rigidState.cursorOffset]
    .every((offset) => offset.x === 0 && offset.y === 0));
  const bendable = computeLine(
    { ...config, shape: { ...config.shape, bendable: true } },
    scene,
    createLineRuntimeState(),
    2,
    1 / 60,
    { width: 1000, height: 800 },
    { x: 500, y: 300, active: true },
  );
  assert.notDeepEqual(bendable.points, result.points);
  const repeated = computeLine(
    config,
    scene,
    createLineRuntimeState(),
    2,
    1 / 60,
    { width: 1000, height: 800 },
    null,
  );
  assert.deepEqual(result.points, repeated.points);
});

test("lightweight silk gravity sag stays above rope and metal", () => {
  const endpointY = (type, weight) => {
    const scene = structuredClone(DEFAULT_SCENE);
    const line = structuredClone(scene.lines[0]);
    line.from = { x: 0.1, y: 0.15 };
    line.to = { x: 0.9, y: 0.15 };
    line.gravity = { enabled: true, strength: 0.5, fixedPointIds: ["start"] };
    line.inherit.motion = false;
    line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
    line.inherit.texture = false;
    line.texture = { ...line.texture, enabled: true, type, weight };
    scene.lines = [line];
    const result = computeLine(
      resolveLineConfig(line, scene.global),
      scene,
      createLineRuntimeState(),
      0,
      1 / 60,
      { width: 1000, height: 800 },
      null,
    );
    return result.points.at(-1).y;
  };

  const silkY = endpointY("silk", 0.55);
  const ropeY = endpointY("rope", 1.25);
  const metalY = endpointY("metal", 2.2);
  assert.ok(silkY < ropeY);
  assert.ok(silkY < metalY);
  assert.ok(getTextureGravityResponse("silk", 0.55, true) < getTextureGravityResponse("rope", 1.25, true));
});

test("legacy lines without gravity settings keep rendering unchanged", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  delete line.gravity;
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  const result = computeLine(
    resolveLineConfig(line, scene.global),
    scene,
    createLineRuntimeState(),
    0,
    1 / 60,
    { width: 800, height: 600 },
    null,
  );

  assert.equal(result.points.length, 24);
  assert.ok(result.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test("gravity can pin a selected custom-shape vertex", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  line.geometrySource = "path";
  line.customPath = {
    points: [
      { id: "a", x: 0.1, y: 0.2 },
      { id: "b", x: 0.5, y: 0.25 },
      { id: "c", x: 0.9, y: 0.2 },
    ],
  };
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: false },
    end: { ...line.anchorMotion.end, enabled: false },
  };
  line.gravity = { enabled: true, strength: 0.5, fixedPointIds: ["b"] };
  scene.lines = [line];
  const result = computeLine(
    resolveLineConfig(line, scene.global),
    scene,
    createLineRuntimeState(),
    0,
    1 / 60,
    { width: 1000, height: 800 },
    null,
  );
  const pinnedIndex = result.points.reduce((bestIndex, point, index) => {
    const best = result.points[bestIndex];
    return Math.hypot(point.x - 500, point.y - 200) < Math.hypot(best.x - 500, best.y - 200) ? index : bestIndex;
  }, 0);

  assert.ok(Math.hypot(result.points[pinnedIndex].x - 500, result.points[pinnedIndex].y - 200) < 0.01);
  assert.ok(result.points.some((point) => point.y > 200));
});

test("gravity supports duplicated vertices across generated multi-stroke shapes", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = structuredClone(scene.lines[0]);
  line.from = { x: 0.1, y: 0.3 };
  line.to = { x: 0.9, y: 0.3 };
  line.geometrySource = "path";
  line.customPath = { points: createGeneratedShapePath("cube", line, { width: 1000, height: 800 }) };
  line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0 };
  line.anchorMotion = {
    ...line.anchorMotion,
    start: { ...line.anchorMotion.start, enabled: false },
    end: { ...line.anchorMotion.end, enabled: false },
  };
  const selectedVertex = line.customPath.points[0];
  line.gravity = { enabled: true, strength: 0.5, fixedPointIds: [selectedVertex.id] };
  scene.lines = [line];

  const result = computeLine(
    resolveLineConfig(line, scene.global),
    scene,
    createLineRuntimeState(),
    0,
    1 / 60,
    { width: 1000, height: 800 },
    null,
  );
  const vertex = { x: selectedVertex.x * 1000, y: selectedVertex.y * 800 };
  const matchingSamples = result.points.filter((point) => Math.hypot(point.x - vertex.x, point.y - vertex.y) < 0.01);

  assert.ok(line.customPath.points.length > 10);
  assert.ok(matchingSamples.length >= 3);
  assert.ok(result.points.some((point) => point.y > vertex.y));
});

test("gravity settings are bounded and discard points missing from imported shapes", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.lines[0].gravity = {
    enabled: true,
    strength: 10,
    fixedPointIds: ["start", "missing", "start"],
  };
  const restored = sanitizeSceneConfig(scene);

  assert.equal(restored.lines[0].gravity.strength, 1.5);
  assert.deepEqual(restored.lines[0].gravity.fixedPointIds, ["start"]);
});

test("individual environment paths and lights are sanitized with legacy compatibility", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.lines[0].environment.airflowPaths = [
    [{ x: -1, y: 0.2 }, { x: 1.4, y: 0.8 }],
    [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.9 }],
  ];
  scene.lines[0].environment.lights = [{
    id: "moving",
    color: "#ffffff",
    position: { x: -1, y: 0.25 },
    endPosition: { x: 1.2, y: 0.75 },
    intensity: 2,
    radius: 0.01,
    speed: 9,
    playback: "once",
  }, {
    ...scene.lines[0].environment.lights[0],
    id: "moving",
  }];
  const restored = sanitizeSceneConfig(scene).lines[0].environment;

  assert.equal(restored.airflowPaths.length, 2);
  assert.deepEqual(restored.airflowPaths[0], [{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }]);
  assert.equal(restored.lights[0].position.x, 0);
  assert.equal(restored.lights[0].endPosition.x, 1);
  assert.equal(restored.lights[0].intensity, 1);
  assert.equal(restored.lights[0].radius, 0.05);
  assert.equal(restored.lights[0].speed, 4);
  assert.equal(restored.lights[0].playback, "once");
  assert.notEqual(restored.lights[0].id, restored.lights[1].id);
});

test("global environment preserves multiple sources and explicit empty lists", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.global.environment.enabled = true;
  scene.global.environment.airflowEnabled = true;
  scene.global.environment.lightEnabled = true;
  scene.global.environment.airflowPaths = [
    [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }],
    [{ x: 0.1, y: 0.8 }, { x: 0.9, y: 0.8 }],
  ];
  scene.global.environment.airflowRadii = [0.12, 0.36];
  scene.global.environment.lights = [{
    id: "global-moving",
    color: "#ffffff",
    position: { x: 0.1, y: 0.2 },
    endPosition: { x: 0.9, y: 0.8 },
    intensity: 0.8,
    radius: 0.3,
    speed: 0.5,
    playback: "loop",
  }];
  const restored = sanitizeSceneConfig(scene).global.environment;
  const line = {
    ...DEFAULT_SCENE.lines[0].environment,
    airflowMode: "global",
    lightMode: "global",
  };
  const resolved = resolveLineEnvironment(restored, line, true);

  assert.equal(restored.airflowPaths.length, 2);
  assert.deepEqual(restored.airflowRadii, [0.12, 0.36]);
  assert.deepEqual(resolved.airflowPaths, restored.airflowPaths);
  assert.deepEqual(resolveLineAirflowRadii(restored, line, true), restored.airflowRadii);
  assert.equal(getEnvironmentLights(resolved)[0].id, "global-moving");

  const legacyGlobal = sanitizeSceneConfig({
    ...scene,
    global: {
      ...scene.global,
      environment: { ...scene.global.environment, airflowRadii: undefined },
    },
  }).global.environment;
  assert.deepEqual(legacyGlobal.airflowRadii, [legacyGlobal.airflowRadius, legacyGlobal.airflowRadius]);

  const noSources = sanitizeSceneConfig({
    ...scene,
    global: {
      ...scene.global,
      environment: { ...scene.global.environment, airflowPaths: [], lights: [] },
    },
  }).global.environment;
  assert.deepEqual(noSources.airflowPaths, []);
  assert.deepEqual(getEnvironmentLights(noSources), []);
});

test("line interaction preserves a soft visible-stroke gap and checks between obstacle samples", () => {
  const config = {
    enabled: true,
    strength: 1,
    clearance: 0.1,
    radius: 0,
    falloff: 0.6,
    mode: "avoid",
  };
  const offsets = computeLineInteractionOffsets([
    { id: "moving", points: [{ x: 50, y: 5 }], width: 2, config },
    { id: "obstacle", points: [{ x: 0, y: 10 }, { x: 100, y: 10 }], width: 2, config: { ...config, enabled: false } },
  ], 100);

  assert.ok(offsets.get("moving")[0].y < -5);
  assert.deepEqual(offsets.get("obstacle"), [{ x: 0, y: 0 }, { x: 0, y: 0 }]);

  const approaching = computeLineInteractionOffsets([
    {
      id: "approaching",
      points: [{ x: 50, y: 0 }],
      width: 2,
      config: { ...config, clearance: 0.05, radius: 0.3 },
    },
    {
      id: "fixed-obstacle",
      points: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
      width: 2,
      config: { ...config, enabled: false },
    },
  ], 100);
  assert.ok(approaching.get("approaching")[0].y < 0);
});

test("line interaction smooths within strokes, preserves stroke ends, and avoids joining separate strokes", () => {
  const config = {
    enabled: true,
    strength: 1,
    clearance: 0.05,
    radius: 0,
    falloff: 0.6,
    mode: "avoid",
  };
  const offsets = computeLineInteractionOffsets([
    {
      id: "moving",
      points: [
        { x: 0, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 5 },
        { x: 30, y: 5 }, { x: 35, y: 5 }, { x: 40, y: 5 },
      ],
      segmentLengths: [3, 3],
      width: 2,
      config,
    },
    {
      id: "obstacle",
      points: [{ x: 0, y: 10 }, { x: 40, y: 10 }],
      width: 2,
      config: { ...config, enabled: false },
    },
  ], 100);
  const moving = offsets.get("moving");

  assert.ok(Math.abs(moving[0].y) < 1e-10);
  assert.ok(Math.abs(moving[2].y) < 1e-10);
  assert.ok(Math.abs(moving[3].y) < 1e-10);
  assert.ok(Math.abs(moving[5].y) < 1e-10);
  assert.ok(moving[1].y < 0);
  assert.ok(moving[4].y < 0);
});

test("picked targets preserve activation and line-scope settings through scene sanitization", () => {
  const scene = sanitizeSceneConfig({
    ...DEFAULT_SCENE,
    targets: [{
      id: "picked-cta",
      name: "Contact button",
      tagName: "BUTTON",
      selector: "main > button:nth-of-type(1)",
      lineIds: ["line-01"],
      activations: ["hover", "click", "invalid"],
      clickBehavior: "toggle",
      enabled: true,
      magnetic: true,
      strength: 1.2,
      radius: 0.04,
      priority: 3,
    }],
  });

  assert.deepEqual(scene.targets[0], {
    id: "picked-cta",
    name: "Contact button",
    tagName: "button",
    selector: "main > button:nth-of-type(1)",
    lineIds: ["line-01"],
    activations: ["hover", "click"],
    clickBehavior: "toggle",
    enabled: true,
    magnetic: true,
    strength: 1.2,
    radius: 0.04,
    priority: 3,
  });
});

test("target activation combines hover and focus and supports click toggles", () => {
  const listeners = new Map();
  const element = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }),
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener() {},
  };
  const fire = (type, event = {}) => listeners.get(type)?.forEach((listener) => listener(event));
  const unregister = registerTarget("activation-test", element, {
    activations: ["hover", "focus", "click"],
    clickBehavior: "toggle",
  });
  try {
    fire("pointerenter", { pointerType: "mouse" });
    fire("focus");
    fire("pointerleave");
    assert.deepEqual(getActiveTargets().map((target) => target.id), ["activation-test"]);
    fire("blur");
    assert.deepEqual(getActiveTargets().map((target) => target.id), []);
    fire("click");
    assert.deepEqual(getActiveTargets().map((target) => target.id), ["activation-test"]);
    fire("click");
    assert.deepEqual(getActiveTargets().map((target) => target.id), []);
  } finally {
    unregister();
  }
});

test("picked target line scope prevents unassigned lines from reacting", () => {
  const element = {
    getBoundingClientRect: () => ({ left: 490, top: 220, right: 510, bottom: 240, width: 20, height: 20 }),
    addEventListener() {},
    removeEventListener() {},
  };
  const unregister = registerTarget("line-scope-test", element);
  setTargetActive("line-scope-test", true);
  try {
    const scene = structuredClone(DEFAULT_SCENE);
    scene.lines = [scene.lines[0]];
    scene.global.magnetismEnabled = true;
    scene.global.strength = 100;
    scene.global.radius = 0.5;
    scene.global.maxDeformation = 0.5;
    scene.targets = [{
      id: "line-scope-test",
      name: "Scoped element",
      selector: "main > button",
      lineIds: [],
      activations: ["hover"],
      clickBehavior: "toggle",
      enabled: true,
      magnetic: true,
      strength: 1,
      radius: 0,
      priority: 1,
    }];
    assert.deepEqual(getActiveTargets(scene.targets).map((target) => target.id), ["line-scope-test"]);
    const line = scene.lines[0];
    line.from = { x: 0.1, y: 0.45 };
    line.to = { x: 0.9, y: 0.45 };
    line.shape = { ...line.shape, type: "straight", bendable: true, amplitude: 0 };
    line.motion = { ...line.motion, enabled: false, amplitude: 0, speed: 0, deformability: 1 };
    line.anchorMotion = {
      ...line.anchorMotion,
      start: { ...line.anchorMotion.start, enabled: false },
      end: { ...line.anchorMotion.end, enabled: false },
    };
    line.inherit = { ...line.inherit, magnet: false };
    line.magnet = { ...line.magnet, enabled: true, targetId: "line-scope-test", strength: 100, radius: 0.5, maxDeformation: 0.5 };
    const resolved = resolveLineConfig(line, scene.global);
    const unassigned = computeLine(resolved, scene, createLineRuntimeState(), 1, 1 / 60, { width: 1000, height: 800 }, null);
    scene.targets[0].lineIds = [line.id];
    const assigned = computeLine(resolved, scene, createLineRuntimeState(), 1, 1 / 60, { width: 1000, height: 800 }, null);
    assert.ok(unassigned.points.some((point, index) =>
      Math.abs(point.x - assigned.points[index].x) > 0.01 || Math.abs(point.y - assigned.points[index].y) > 0.01
    ));
  } finally {
    unregister();
  }
});

test("exact line crossings choose a stable separating side", () => {
  const config = {
    enabled: true,
    strength: 1,
    clearance: 0.01,
    radius: 0,
    falloff: 0.6,
    mode: "avoid",
  };
  const offsets = computeLineInteractionOffsets([
    {
      id: "a-vertical",
      points: [{ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 10 }],
      width: 1,
      config,
    },
    {
      id: "b-horizontal",
      points: [{ x: 0, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 5 }],
      width: 1,
      config,
    },
  ], 100);

  assert.ok(offsets.get("a-vertical")[1].x < 0);
  assert.ok(offsets.get("b-horizontal")[1].y < 0);
});

test("new lines start as plain two-endpoint strokes with effects disabled", () => {
  const line = makeBlankLine();

  assert.equal(line.geometrySource, "shape");
  assert.equal(line.customPath.points.length, 2);
  assert.deepEqual(line.anchorPoints, []);
  assert.equal(line.shape.type, "straight");
  assert.equal(line.motion.enabled, false);
  assert.equal(line.magnet.enabled, false);
  assert.equal(line.glow.enabled, false);
  assert.equal(line.outerGlow.enabled, false);
  assert.equal(line.cursorGlow.enabled, false);
  assert.equal(line.texture.enabled, false);
  assert.equal(line.environmentEnabled, false);
  assert.equal(line.environment.airflowMode, "off");
  assert.equal(line.environment.lightMode, "off");
  assert.equal(line.cursorInfluence.enabled, false);
  assert.equal(line.lineInteraction.enabled, false);
  assert.equal(line.constraint.enabled, false);
  assert.equal(line.gravity.enabled, false);
  assert.equal(line.occlusion.enabled, false);
  assert.equal(line.occlusion.gapWidth, 2);
  assert.ok(Object.values(line.inherit).every((inherits) => !inherits));
});

test("crossing gap settings default safely and clamp imported values", () => {
  const restored = sanitizeSceneConfig({
    ...DEFAULT_SCENE,
    global: { ...DEFAULT_SCENE.global, occlusion: { enabled: true } },
    lines: DEFAULT_SCENE.lines.map((line, index) => ({
      ...line,
      occlusion: index === 0 ? { enabled: true, gapWidth: 100 } : { enabled: false, gapWidth: -5 },
    })),
  });

  assert.equal(restored.global.occlusion.gapWidth, 2);
  assert.equal(restored.lines[0].occlusion.gapWidth, 24);
  assert.equal(restored.lines[1].occlusion.gapWidth, 0);
});

test("global and individual silk filament counts resolve independently", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = scene.lines[0];
  scene.global.textureSilkStrands = 12;
  line.inherit.texture = true;
  assert.equal(resolveLineConfig(line, scene.global).texture.silkStrands, 12);

  line.inherit.texture = false;
  line.texture.silkStrands = 4;
  assert.equal(resolveLineConfig(line, scene.global).texture.silkStrands, 4);
});

test("shape bendability inherits globally, supports per-line overrides, and defaults on for old scenes", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const line = scene.lines[0];
  scene.global.shape.bendable = false;
  line.inherit.shape = true;
  assert.equal(resolveLineConfig(line, scene.global).shape.bendable, false);

  line.inherit.shape = false;
  line.shape.bendable = true;
  assert.equal(resolveLineConfig(line, scene.global).shape.bendable, true);

  const legacyScene = structuredClone(DEFAULT_SCENE);
  delete legacyScene.global.shape.bendable;
  for (const sceneLine of legacyScene.lines) delete sceneLine.shape.bendable;
  const restored = sanitizeSceneConfig(legacyScene);
  assert.equal(restored.global.shape.bendable, true);
  assert.ok(restored.lines.every((sceneLine) => sceneLine.shape.bendable === true));
});

test("target line assignment stays exclusive and matches effective line target filters", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  const [first, second] = scene.lines;
  const lines = [first, second];
  const targets = [
    { id: "target-a", enabled: true, magnetic: true, strength: 1, radius: 0, priority: 1 },
    { id: "target-b", enabled: true, magnetic: true, strength: 1, radius: 0, priority: 1 },
  ];

  let assigned = updateTargetLineAssignments(targets, lines, "target-a", [first.id], scene.global);
  assert.deepEqual(getTargetAssignedLineIds(assigned.targets[0], assigned.lines, scene.global), [first.id]);
  assert.deepEqual(getTargetAssignedLineIds(assigned.targets[1], assigned.lines, scene.global), [second.id]);
  assert.equal(assigned.lines[0].magnet.targetId, "target-a");

  assigned = updateTargetLineAssignments(assigned.targets, assigned.lines, "target-b", [first.id], scene.global);
  assert.deepEqual(assigned.targets[0].lineIds, []);
  assert.equal(assigned.lines[0].magnet.targetId, "target-b");
  assert.deepEqual(getTargetAssignedLineIds(assigned.targets[0], assigned.lines, scene.global), []);
  assert.ok(getTargetAssignedLineIds(assigned.targets[1], assigned.lines, scene.global).includes(first.id));

  assigned = updateTargetLineAssignments(assigned.targets, assigned.lines, "target-b", [], scene.global);
  assert.deepEqual(getTargetAssignedLineIds(assigned.targets[1], assigned.lines, scene.global), []);
  assert.equal(assigned.lines[0].magnet.targetId, null);

  assigned = updateTargetLineAssignments(assigned.targets, assigned.lines, "target-b", null, scene.global);
  assert.deepEqual(getTargetAssignedLineIds(assigned.targets[1], assigned.lines, scene.global), [first.id, second.id]);
});
