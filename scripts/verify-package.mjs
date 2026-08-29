import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_NAME = "uiohook-napi";
const EXPECTED_VERSION = "1.5.5-valis.1";
const EXPECTED_LICENSE = "MIT AND LGPL-3.0-or-later";
const EXPECTED_REPOSITORY = "https://github.com/valis-so/uiohook-napi.git";

export const REQUIRED_PREBUILDS = Object.freeze([
  "prebuilds/darwin-arm64/uiohook-napi.node",
  "prebuilds/darwin-x64/uiohook-napi.node",
  "prebuilds/win32-x64/uiohook-napi.node",
]);

const REQUIRED_FILES = Object.freeze([
  "LICENSE",
  "libuiohook/COPYING.md",
  "libuiohook/COPYING.LESSER.md",
  "THIRD_PARTY_NOTICES.md",
  "binding.gyp",
  "src/libuiohook.patch",
  "libuiohook/include/uiohook.h",
  "libuiohook/src/logger.c",
]);

async function requireNonemptyFile(root, relativePath, failures) {
  try {
    const details = await stat(path.join(root, relativePath));
    if (!details.isFile() || details.size === 0) {
      failures.push(`${relativePath} is not a non-empty file`);
    }
  } catch {
    failures.push(`${relativePath} is missing`);
  }
}

export async function verifyPackageRoot(root) {
  const failures = [];
  let packageJson;

  try {
    packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  } catch (error) {
    throw new Error(`cannot read package.json: ${error.message}`);
  }

  if (packageJson.name !== EXPECTED_NAME) {
    failures.push(`name must be ${EXPECTED_NAME}`);
  }
  if (packageJson.version !== EXPECTED_VERSION) {
    failures.push(`version must be ${EXPECTED_VERSION}`);
  }
  if (packageJson.license !== EXPECTED_LICENSE) {
    failures.push(`license must be ${EXPECTED_LICENSE}`);
  }

  const repository =
    typeof packageJson.repository === "string"
      ? packageJson.repository
      : packageJson.repository?.url;
  if (repository !== EXPECTED_REPOSITORY) {
    failures.push(`repository must be ${EXPECTED_REPOSITORY}`);
  }

  await Promise.all(
    [...REQUIRED_FILES, ...REQUIRED_PREBUILDS].map((file) =>
      requireNonemptyFile(root, file, failures),
    ),
  );

  if (failures.length > 0) {
    throw new Error(`invalid uiohook package:\n- ${failures.join("\n- ")}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  try {
    await verifyPackageRoot(root);
    console.log(`verified ${EXPECTED_NAME}@${EXPECTED_VERSION} at ${root}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
