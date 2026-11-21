/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { CATS, CAT_CSS } = require("../../components/Button/buttonCats.ts");

test("peek cat uses the cursor-side reaching paw animation", () => {
  const markup = CATS.peek.render(190);

  assert.match(markup, /mbc-arm mbc-al/);
  assert.match(markup, /mbc-arm mbc-ar/);
  assert.doesNotMatch(markup, /mbc-cp/);
  assert.match(CAT_CSS, /mbc-hov\.mbc-v-peek\[data-side=l\].*mbc-al/);
  assert.match(CAT_CSS, /@keyframes mbc-reach/);
});

test("smashed cat uses a dedicated drop-in, breathing body, and escape wiggle", () => {
  const markup = CATS.flat.render(190);

  assert.match(markup, /mbc-fb/);
  assert.match(markup, /M80 77l8 4-8 4M110 77l-8 4 8 4/);
  assert.match(CAT_CSS, /@keyframes mbc-drop/);
  assert.match(CAT_CSS, /@keyframes mbc-flatb/);
  assert.match(CAT_CSS, /@keyframes mbc-squirm2/);
  assert.doesNotMatch(CAT_CSS, /\.mbc-hov\.mbc-v-flat \.mbc-h\{/);
});

test("sleeping cat's hover reaction keeps its eye waves soft and its movement restrained", () => {
  const markup = CATS.sleep.render(190);

  assert.match(markup, /mbc-sleep-eyes/);
  assert.match(CAT_CSS, /\.mbc-v-sleep \.mbc-es,\.mbc-v-sleep \.mbc-sleep-eyes\{transition:opacity \.35s ease\}/);
  assert.match(CAT_CSS, /\.mbc-hov\.mbc-v-sleep \.mbc-sleep-wave\{animation:mbc-wriggle 1\.6s ease-in-out infinite alternate\}/);
  assert.match(CAT_CSS, /@keyframes mbc-wriggle\{from\{transform:translateX\(0\)\}to\{transform:translateX\(-1\.5px\)\}\}/);
  assert.match(CAT_CSS, /\.mbc-hov\.mbc-v-sleep \.mbc-h\{animation:mbc-grumble 1\.8s ease-in-out infinite\}/);
  assert.doesNotMatch(CAT_CSS, /\.mbc-hov\.mbc-v-sleep \.mbc-br\{animation:mbc-shiver/);
});
