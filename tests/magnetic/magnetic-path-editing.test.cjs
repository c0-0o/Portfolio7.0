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

const { mergePathPointSequence } = require("../../lib/magnetic-lines/editor/pathEditing.ts");

test("merging a path point across a stroke boundary joins the strokes", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 0.4, y: 0.4 },
    { id: "c", x: 0.4, y: 0.4, moveTo: true },
    { id: "d", x: 1, y: 1 },
  ];

  const merged = mergePathPointSequence(points, "b", "c");

  assert.deepEqual(merged.map((point) => point.id), ["a", "c", "d"]);
  assert.equal(merged[1].moveTo, undefined);
  assert.equal(points[2].moveTo, true);
});

test("merging points within one stroke preserves unrelated breaks", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 0.2, y: 0.2 },
    { id: "c", x: 0.4, y: 0.4 },
    { id: "d", x: 0.6, y: 0.6, moveTo: true },
    { id: "e", x: 0.8, y: 0.8 },
  ];

  const merged = mergePathPointSequence(points, "b", "c");

  assert.deepEqual(merged.map((point) => point.id), ["a", "c", "d", "e"]);
  assert.equal(merged[2].moveTo, true);
});
