/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("portfolio audio starts with the lightweight MP3 and preserves preference/blocked-state handling", () => {
  const audioSource = fs.readFileSync(
    path.join(__dirname, "../../lib/audio/portfolioAudio.ts"),
    "utf8",
  );
  const toggleSource = fs.readFileSync(
    path.join(__dirname, "../../components/portfolio/SoundToggle.tsx"),
    "utf8",
  );

  assert.match(
    audioSource,
    /"\/audio\/cinematic-house-take-1\.mp3"/,
  );
  assert.match(
    audioSource,
    /musicAudio\.preload = "auto"/,
  );
  assert.match(
    audioSource,
    /musicAudio\.volume = 0\.08/,
  );
  assert.match(
    audioSource,
    /playbackStarted = true/,
  );
  assert.match(
    toggleSource,
    /enabled && !isPortfolioSoundPlaying\(\)/,
  );
  assert.match(
    toggleSource,
    /setPortfolioSoundEnabled\(true\)/,
  );
  assert.match(
    audioSource,
    /return preference === "on"/,
  );
});
