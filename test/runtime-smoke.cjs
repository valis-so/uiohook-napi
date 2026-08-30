const assert = require("node:assert/strict");

const expectedElectron = process.env.EXPECTED_ELECTRON;
if (expectedElectron) {
  assert.equal(
    process.versions.electron,
    expectedElectron,
    `expected Electron ${expectedElectron}, got ${process.versions.electron ?? "plain Node"}`,
  );
} else {
  assert.equal(
    process.versions.electron,
    undefined,
    `expected plain Node, got Electron ${process.versions.electron}`,
  );
}

const { uIOhook } = require("..");
assert.equal(typeof uIOhook.start, "function");
assert.equal(typeof uIOhook.stop, "function");

const runtime = process.versions.electron
  ? `Electron ${process.versions.electron}`
  : `Node ${process.versions.node}`;
console.log(
  `loaded uiohook-napi under ${runtime} (${process.platform}-${process.arch})`,
);
