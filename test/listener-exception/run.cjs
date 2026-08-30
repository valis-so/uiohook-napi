"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const child = spawnSync(
  process.execPath,
  [path.join(__dirname, "child.cjs")],
  { encoding: "utf8" },
);

assert.equal(child.error, undefined);
assert.equal(child.status, 1, child.stderr);
assert.equal(child.signal, null, child.stderr);
assert.match(
  child.stderr,
  /UIOHOOK_LISTENER_EXCEPTION_MONITOR\|uncaughtException\|Error: UIOHOOK_LISTENER_FAILURE/,
);
assert.match(child.stderr, /at .*child\.cjs:\d+:\d+/);
assert.doesNotMatch(child.stderr, /FATAL ERROR/);
