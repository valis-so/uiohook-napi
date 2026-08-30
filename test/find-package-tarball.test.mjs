import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("../scripts/find-package-tarball.mjs", import.meta.url),
);

async function withTemporaryDirectory(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "uiohook-tarball-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function findPackageTarball(directory) {
  return spawnSync(process.execPath, [scriptPath, directory], {
    encoding: "utf8",
  });
}

test("prints the only package tarball's absolute path", () =>
  withTemporaryDirectory(async (directory) => {
    const tarball = path.join(directory, "uiohook-napi-1.5.5-valis.1.tgz");

    await writeFile(tarball, "package");
    await writeFile(path.join(directory, "other-package-1.0.0.tgz"), "other");
    await mkdir(path.join(directory, "uiohook-napi-directory.tgz"));

    const result = findPackageTarball(directory);

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), tarball);
    assert.equal(result.stderr, "");
  }));

test("fails when no package tarball exists", () =>
  withTemporaryDirectory(async (directory) => {
    const result = findPackageTarball(directory);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /expected exactly one package tarball, found 0/i);
  }));

test("fails when multiple package tarballs exist", () =>
  withTemporaryDirectory(async (directory) => {
    await writeFile(path.join(directory, "uiohook-napi-1.0.0.tgz"), "first");
    await writeFile(path.join(directory, "uiohook-napi-2.0.0.tgz"), "second");

    const result = findPackageTarball(directory);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /expected exactly one package tarball, found 2/i);
  }));
