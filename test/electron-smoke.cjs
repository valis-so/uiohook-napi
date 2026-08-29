const assert = require("node:assert/strict");

assert.equal(
  process.versions.electron,
  "42.9.3",
  `expected Electron 42.9.3, got ${process.versions.electron ?? "plain Node"}`,
);

const { uIOhook } = require("..");
assert.equal(typeof uIOhook.start, "function");
assert.equal(typeof uIOhook.stop, "function");

console.log(
  `loaded uiohook-napi under Electron ${process.versions.electron} (${process.platform}-${process.arch})`,
);
