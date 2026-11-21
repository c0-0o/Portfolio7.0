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

const { IntroController } = require("../../components/portfolio/intro/intro-controller.ts");

test("deactivating the intro cancels Web Animations but leaves CSS animations alone", () => {
  const originalDocument = global.document;
  let webAnimationCancelled = false;
  let cssAnimationCancelled = false;
  const webAnimation = { cancel: () => { webAnimationCancelled = true; } };
  const cssAnimation = {
    animationName: "opening-loader",
    cancel: () => { cssAnimationCancelled = true; },
  };
  const layer = { getAnimations: () => [webAnimation, cssAnimation] };
  const intro = {
    querySelector: () => layer,
    toggleAttribute: () => {},
  };
  global.document = {
    querySelector: () => intro,
    documentElement: { classList: { toggle: () => {} } },
  };

  try {
    const controller = Object.create(IntroController.prototype);
    controller.setActive(false);
    assert.equal(webAnimationCancelled, true);
    assert.equal(cssAnimationCancelled, false);
  } finally {
    global.document = originalDocument;
  }
});
