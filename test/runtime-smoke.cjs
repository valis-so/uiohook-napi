const assert = require("node:assert/strict");

if (process.argv.length !== 3) {
  throw new Error(
    "usage: node test/runtime-smoke.cjs <node|electron@<version>>",
  );
}

const target = process.argv[2];
const expectedElectron = target.startsWith("electron@")
  ? target.slice("electron@".length)
  : undefined;

if (target === "node") {
  assert.equal(
    process.versions.electron,
    undefined,
    `expected plain Node, got Electron ${process.versions.electron}`,
  );
} else if (expectedElectron) {
  assert.equal(
    process.versions.electron,
    expectedElectron,
    `expected Electron ${expectedElectron}, got ${process.versions.electron ?? "plain Node"}`,
  );
} else {
  throw new Error(
    `invalid runtime target ${JSON.stringify(target)}; expected "node" or "electron@<version>"`,
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
