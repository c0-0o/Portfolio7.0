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
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const originalPassword = process.env.EDITOR_PASSWORD;
process.env.EDITOR_PASSWORD = "test-editor-password";
const {
  createEditorSessionToken,
  EDITOR_SESSION_COOKIE,
  hasValidEditorSession,
  verifyEditorPassword,
} = require("../../lib/editorAuth.ts");

test.after(() => {
  if (originalPassword === undefined) delete process.env.EDITOR_PASSWORD;
  else process.env.EDITOR_PASSWORD = originalPassword;
});

test("editor password validation rejects incorrect and non-string values", () => {
  assert.equal(verifyEditorPassword("test-editor-password"), true);
  assert.equal(verifyEditorPassword("incorrect"), false);
  assert.equal(verifyEditorPassword(undefined), false);
});

test("editor session validation accepts a signed cookie and rejects a tampered cookie", () => {
  const token = createEditorSessionToken();
  assert.ok(token);
  const validRequest = new Request("http://localhost/editor", {
    headers: { cookie: `${EDITOR_SESSION_COOKIE}=${token}` },
  });
  assert.equal(hasValidEditorSession(validRequest), true);

  const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  const tamperedRequest = new Request("http://localhost/editor", {
    headers: { cookie: `${EDITOR_SESSION_COOKIE}=${tamperedToken}` },
  });
  assert.equal(hasValidEditorSession(tamperedRequest), false);
});
