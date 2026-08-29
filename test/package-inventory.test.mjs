import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  REQUIRED_PREBUILDS,
  verifyPackageRoot,
} from "../scripts/verify-package.mjs";

async function makePackageFixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "uiohook-package-"));
  const packageJson = {
    name: "uiohook-napi",
    version: "1.5.5-valis.1",
    license: "MIT AND LGPL-3.0-or-later",
    repository: {
      type: "git",
      url: "https://github.com/valis-so/uiohook-napi.git",
    },
    ...overrides,
  };

  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  for (const file of [
    "LICENSE",
    "libuiohook/COPYING.md",
    "libuiohook/COPYING.LESSER.md",
    "THIRD_PARTY_NOTICES.md",
    "binding.gyp",
    "src/libuiohook.patch",
    "libuiohook/include/uiohook.h",
    "libuiohook/src/logger.c",
    ...REQUIRED_PREBUILDS,
  ]) {
    const absolute = path.join(root, file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, "fixture\n");
  }

  return root;
}

test("accepts the complete Valis package contract", async (t) => {
  const root = await makePackageFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.doesNotReject(verifyPackageRoot(root));
});

test("rejects the wrong package identity", async (t) => {
  const root = await makePackageFixture({ version: "1.5.5" });
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(verifyPackageRoot(root), /version/);
});

test("rejects a package missing a required prebuild", async (t) => {
  const root = await makePackageFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(root, REQUIRED_PREBUILDS[1]));

  await assert.rejects(verifyPackageRoot(root), /darwin-x64/);
});

test("rejects a package missing LGPL notice material", async (t) => {
  const root = await makePackageFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(root, "libuiohook/COPYING.LESSER.md"));

  await assert.rejects(verifyPackageRoot(root), /COPYING\.LESSER/);
});
