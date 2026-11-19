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

const { getMaterialFlowPaths, getMaterialFlowWidthScale, getMetalChainPaths, getTextureStrokeLayers, offsetTexturePath, offsetTexturePoints } = require("../lib/magnetic-lines/texture.ts");

test("texture types use distinct rendering layers", () => {
  const types = ["grain", "fiber", "silk", "rope", "beads", "metal"];
  const layers = types.map((type) => getTextureStrokeLayers(type, 0.02, true));

  assert.deepEqual(layers.map((typeLayers) => typeLayers.length), [1, 1, 8, 7, 4, 4]);
  assert.equal(layers[0][0].filter, "grain");
  assert.equal(layers[2][0].id, "silk-filament-1");
  assert.ok(layers[2].every((layer) => layer.opacity < 1));
  assert.ok(layers[2].some((layer) => layer.opacity > 0.8));
  assert.ok(layers[2].every((layer) => layer.dashArray === undefined));
  assert.ok(layers[2].every((layer) => layer.lineCap === "butt"));
  assert.ok(layers[2].every((layer) => layer.offsetWave > 0));
  assert.ok(layers[2].every((layer) => layer.motionSpeed > 0));
  assert.ok(new Set(layers[2].map((layer) => layer.offsetPhase)).size > 1);
  assert.equal(new Set(layers[2].map((layer) => layer.offset)).size, 8);
  assert.ok(layers[2].every((layer) => layer.offsetWaveFollowsAirflow));
  const gaps = layers[2].slice(1).map((layer, index) => layer.offset - layers[2][index].offset);
  assert.ok(Math.max(...gaps) > Math.min(...gaps) * 1.5);
  assert.equal(getTextureStrokeLayers("silk", 0.02, true, 3).length, 3);
  assert.equal(layers[3][0].id, "rope-core");
  assert.equal(layers[3].filter((layer) => layer.id.startsWith("rope-ply-")).length, 3);
  assert.equal(layers[3].filter((layer) => layer.id.startsWith("rope-fiber-")).length, 3);
  assert.ok(layers[3].slice(1).every((layer) => layer.offsetWaveFrequency === 6));
  assert.ok(new Set(layers[3].slice(1).map((layer) => layer.offsetPhase)).size === 3);
  assert.equal(getTextureStrokeLayers("rope", 0.02, true), layers[3]);
  assert.ok(layers[4].some((layer) => layer.id === "bead-thread"));
  assert.ok(layers[4].some((layer) => layer.id === "bead-face" && layer.lineCap === "round"));
  assert.ok(layers[4].some((layer) => layer.id === "bead-highlight" && layer.colorTone === "glint"));
  assert.ok(layers[4].some((layer) => layer.id === "bead-rim" && layer.colorTone === "shadow"));
  assert.ok(layers[5].some((layer) => layer.id === "metal-chain-glint"));
  assert.ok(layers[5].every((layer) => layer.dashArray === undefined));
  assert.deepEqual(layers[5].map((layer) => layer.chainPart), [undefined, "outline", "steel", "glint"]);
  assert.equal(layers[5][1].colorTone, "shadow");
  assert.equal(layers[5][3].colorTone, "glint");
  assert.equal(getMaterialFlowWidthScale("metal"), 0.36);
  assert.equal(getMaterialFlowWidthScale("silk"), 0.3);
});

test("texture scale changes silk bundle size and rope twist detail", () => {
  const fineSilk = getTextureStrokeLayers("silk", 0.01, true, 8);
  const coarseSilk = getTextureStrokeLayers("silk", 0.04, true, 8);
  const fineRope = getTextureStrokeLayers("rope", 0.01, true);
  const coarseRope = getTextureStrokeLayers("rope", 0.04, true);

  assert.notEqual(fineSilk[1].offset, coarseSilk[1].offset);
  assert.notEqual(fineSilk[1].offsetWave, coarseSilk[1].offsetWave);
  assert.notEqual(fineRope[1].offset, coarseRope[1].offset);
  assert.notEqual(fineRope[1].offsetWaveFrequency, coarseRope[1].offsetWaveFrequency);
});

test("flow geometry follows material strands without joining source strokes", () => {
  const points = [
    { x: 0, y: 0 }, { x: 10, y: 2 },
    { x: 30, y: 0 }, { x: 40, y: 2 },
  ];
  const segmentLengths = [2, 2];
  const ropeLayers = getTextureStrokeLayers("rope", 0.02, true);
  const ropePaths = getMaterialFlowPaths("rope", points, 2, segmentLengths, ropeLayers);
  const silkLayers = getTextureStrokeLayers("silk", 0.02, true, 3);
  const silkPaths = getMaterialFlowPaths("silk", points, 2, segmentLengths, silkLayers);
  const paperPaths = getMaterialFlowPaths("grain", points, 2, segmentLengths, getTextureStrokeLayers("grain", 0.02, true));

  assert.equal(ropePaths.length, 6);
  assert.deepEqual(ropePaths.map((path) => path.length), [2, 2, 2, 2, 2, 2]);
  assert.equal(silkPaths.length, 6);
  assert.deepEqual(silkPaths.map((path) => path.length), [2, 2, 2, 2, 2, 2]);
  assert.equal(paperPaths.length, 2);
  assert.deepEqual(paperPaths.map((path) => path.length), [2, 2]);
});

test("metal flow follows the selected texture scale", () => {
  const points = [{ x: 0, y: 10 }, { x: 1000, y: 10 }];
  const layers = getTextureStrokeLayers("metal", 0.02, true);
  const fine = getMaterialFlowPaths("metal", points, 2, [2], layers, 0, 0, 0.01);
  const coarse = getMaterialFlowPaths("metal", points, 2, [2], layers, 0, 0, 0.05);

  assert.notDeepEqual(fine, coarse);
});

test("metal texture renders repeated interlocking chain links with specular arcs", () => {
  const paths = getMetalChainPaths(
    [{ x: 0, y: 10 }, { x: 500, y: 10 }, { x: 1000, y: 10 }],
    2,
    [3],
    0.02,
  );

  assert.ok((paths.outline.match(/ A /g) ?? []).length >= 40);
  assert.equal(paths.outline, paths.steel);
  assert.ok((paths.glint.match(/M /g) ?? []).length >= 20);
  assert.match(paths.outline, /A [\d.]+ [\d.]+ -?[\d.]+ 0 1/);
});

test("beads can render without the necklace thread", () => {
  const layers = getTextureStrokeLayers("beads", 0.02, false);

  assert.equal(layers.some((layer) => layer.id === "bead-thread"), false);
  assert.ok(layers.some((layer) => layer.id === "bead-rim"));
  assert.ok(layers.some((layer) => layer.id === "bead-face"));
});

test("silk strand offsets stay smooth and preserve separate path segments", () => {
  const points = [
    { x: 0, y: 0 }, { x: 5, y: 5 },
    { x: 20, y: 0 }, { x: 25, y: 5 },
  ];
  const center = offsetTexturePath(points, 2, 0, [2, 2]);
  const strand = offsetTexturePath(points, 2, 1, [2, 2]);
  const gentlyWaved = offsetTexturePath(points, 2, 0, [2, 2], 0.2, 0.4);
  const independentlyWaved = offsetTexturePath(points, 2, 0, [2, 2], 0.7, 1.2);

  assert.notEqual(strand, center);
  assert.notEqual(gentlyWaved, center);
  assert.notEqual(independentlyWaved, gentlyWaved);
  assert.equal((strand.match(/M /g) ?? []).length, 2);
});

test("silk offset geometry preserves every strand and separate source stroke", () => {
  const points = [
    { x: 0, y: 0 }, { x: 5, y: 5 },
    { x: 20, y: 0 }, { x: 25, y: 5 },
  ];
  const layer = getTextureStrokeLayers("silk", 0.02, true, 3)[1];
  const paths = offsetTexturePoints(points, 2, layer.offset, [2, 2], layer.offsetWave, layer.offsetPhase);

  assert.equal(paths.length, 2);
  assert.deepEqual(paths.map((path) => path.length), [2, 2]);
  assert.notDeepEqual(paths[0][0], points[0]);
  assert.notDeepEqual(paths[1][0], points[2]);
});

test("silk filaments meet cleanly at a closed outline seam", () => {
  const points = [
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 18 }, { x: 0, y: 0 },
  ];
  const path = offsetTexturePath(points, 2, 1, [points.length]);
  const start = path.match(/^M ([\d.-]+) ([\d.-]+)/);
  const end = path.match(/ ([\d.-]+) ([\d.-]+)(?: Z)?$/);

  assert.ok(start);
  assert.ok(end);
  assert.equal(Number(start[1]), Number(end[1]));
  assert.equal(Number(start[2]), Number(end[2]));
});

test("silk filaments use a smooth cyclic curve on closed custom paths", () => {
  const points = [
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 18 }, { x: 0, y: 0 },
  ];
  const path = offsetTexturePath(points, 2, 1, [points.length], 0.4, 0.8);

  assert.match(path, / Z$/);
  assert.equal((path.match(/ C /g) ?? []).length, points.length - 1);
});

test("rope braid keeps continuous twisted plies joined to a substantial core", () => {
  const layers = getTextureStrokeLayers("rope", 0.02, true);
  const points = [
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 },
  ];
  const paths = layers.slice(1).map((layer) => offsetTexturePath(
    points,
    2,
    layer.offset,
    [points.length],
    layer.offsetWave,
    layer.offsetPhase,
    layer.offsetWaveFrequency,
  ));

  assert.ok(layers[0].width > layers[1].width);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.every((path) => path.startsWith("M ") && path.includes(" C ")));
  assert.ok(layers[0].colorTone === "shadow");
  assert.ok(layers.filter((layer) => layer.id.startsWith("rope-fiber-")).every((layer) => layer.colorTone === "glint"));
});
