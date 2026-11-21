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

const { createGeneratedShapePath } = require("../../lib/magnetic-lines/shapePresets.ts");
const { getEvenlySpacedColors } = require("../../lib/magnetic-lines/colorWeights.ts");
const { RAINBOW_COLORS } = require("../../lib/magnetic-lines/types.ts");
const { computeLine, createLineRuntimeState, pathSegmentsFromResult, SAMPLES } = require("../../lib/magnetic-lines/engine/lineEngine.ts");
const { DEFAULT_SCENE } = require("../../lib/magnetic-lines/defaultScene.ts");

test("cube preset draws each wireframe edge once without joining separate strokes", () => {
  const points = createGeneratedShapePath(
    "cube",
    { from: { x: 0.2, y: 0.5 }, to: { x: 0.8, y: 0.5 } },
    { width: 800, height: 600 },
  );
  const segments = [];

  for (const point of points) {
    if (point.moveTo || segments.length === 0) segments.push([]);
    segments[segments.length - 1].push(point);
  }

  assert.deepEqual(segments.map((segment) => segment.length), [5, 5, 2, 2, 2, 2]);
  const edges = segments.flatMap((segment) => segment.slice(1).map((point, index) => {
    const first = segment[index];
    const endpoints = [
      `${first.x.toFixed(8)},${first.y.toFixed(8)}`,
      `${point.x.toFixed(8)},${point.y.toFixed(8)}`,
    ].sort();
    return endpoints.join("|");
  }));
  assert.equal(edges.length, 12);
  assert.equal(new Set(edges).size, edges.length);
});

test("rainbow custom paths use one solid color per stroke instead of one shared gradient", () => {
  const colors = getEvenlySpacedColors(RAINBOW_COLORS, 6);
  const paths = pathSegmentsFromResult(
    Array.from({ length: 12 }, (_, index) => ({ x: index, y: index % 2 })),
    [2, 2, 2, 2, 2, 2],
    "polyline",
    1,
  );

  assert.equal(colors.length, paths.length);
  assert.equal(new Set(colors).size, colors.length);
  assert.ok(colors.every((color) => /^#[\da-f]{6}$/i.test(color)));
  assert.ok(paths.every((path) => (path.match(/M /g) ?? []).length === 1));
});

test("closed custom contours use a cyclic smooth path", () => {
  const path = pathSegmentsFromResult(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }],
    [5],
    "smooth",
    1,
  )[0];

  assert.match(path, / Z$/);
  assert.equal((path.match(/ C /g) ?? []).length, 4);
});

test("custom path curve smoothing rounds authored corners with dense, stable samples", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.global.environment.enabled = false;
  const line = structuredClone(DEFAULT_SCENE.lines[0]);
  line.geometrySource = "path";
  line.customPath = {
    curveSmoothing: 0,
    points: [
      { id: "start", x: 0.1, y: 0.8 },
      { id: "corner", x: 0.5, y: 0.2 },
      { id: "end", x: 0.9, y: 0.8 },
    ],
  };
  line.from = { x: 0.1, y: 0.8 };
  line.to = { x: 0.9, y: 0.8 };
  line.shape.bendable = false;
  line.motion.enabled = false;
  line.motion.amplitude = 0;
  line.anchorMotion.start.enabled = false;
  line.anchorMotion.end.enabled = false;
  line.environmentEnabled = false;
  line.cursorInfluence.enabled = false;
  line.gravity.enabled = false;

  const viewport = { width: 800, height: 600 };
  const render = (curveSmoothing) => {
    const config = { ...line, customPath: { ...line.customPath, curveSmoothing } };
    return computeLine(config, scene, createLineRuntimeState(), 0, 1 / 60, viewport, null, 0);
  };
  const sharp = render(0);
  const smooth = render(1);
  const maximumTurn = (points) => Math.max(...points.slice(1, -1).map((point, index) => {
    const previous = points[index];
    const next = points[index + 2];
    const first = { x: point.x - previous.x, y: point.y - previous.y };
    const second = { x: next.x - point.x, y: next.y - point.y };
    const cosine = (first.x * second.x + first.y * second.y) /
      (Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y));
    return Math.acos(Math.max(-1, Math.min(1, cosine)));
  }));

  assert.equal(sharp.segmentLengths.length, 1);
  assert.equal(sharp.segmentLengths[0], SAMPLES);
  assert.ok(smooth.segmentLengths[0] > SAMPLES);
  assert.ok(maximumTurn(smooth.points) < maximumTurn(sharp.points) * 0.5);
  assert.ok(Math.abs(smooth.points[0].x - viewport.width * line.from.x) < 1e-8);
  assert.ok(Math.abs(smooth.points.at(-1).x - viewport.width * line.to.x) < 1e-8);
});

test("smooth custom paths keep separate strokes disconnected", () => {
  const scene = structuredClone(DEFAULT_SCENE);
  scene.global.environment.enabled = false;
  const line = structuredClone(DEFAULT_SCENE.lines[0]);
  line.geometrySource = "path";
  line.customPath = {
    curveSmoothing: 1,
    points: [
      { id: "first", x: 0.1, y: 0.2 },
      { id: "first-end", x: 0.3, y: 0.2 },
      { id: "second", x: 0.7, y: 0.8, moveTo: true },
      { id: "second-end", x: 0.9, y: 0.8 },
    ],
  };
  line.shape.bendable = false;
  line.motion.enabled = false;
  line.anchorMotion.start.enabled = false;
  line.anchorMotion.end.enabled = false;
  line.environmentEnabled = false;
  line.cursorInfluence.enabled = false;
  line.gravity.enabled = false;

  const result = computeLine(line, scene, createLineRuntimeState(), 0, 1 / 60, { width: 800, height: 600 }, null, 0);
  assert.equal(result.segmentLengths.length, 2);
  assert.ok(result.d.includes("M ") && result.d.includes(" C "));
});
