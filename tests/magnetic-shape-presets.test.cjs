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

const { createGeneratedShapePath } = require("../lib/magnetic-lines/editor/shapePresets.ts");
const { getEvenlySpacedColors } = require("../lib/magnetic-lines/colorWeights.ts");
const { RAINBOW_COLORS } = require("../lib/magnetic-lines/types.ts");
const { pathSegmentsFromResult } = require("../lib/magnetic-lines/engine/lineEngine.ts");

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
