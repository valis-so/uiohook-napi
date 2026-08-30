import { readdir } from "node:fs/promises";
import path from "node:path";

const PACKAGE_TARBALL = /^uiohook-napi-.+\.tgz$/;
const directory = path.resolve(process.argv[2] ?? process.cwd());

try {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = entries.filter(
    (entry) => entry.isFile() && PACKAGE_TARBALL.test(entry.name),
  );

  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one package tarball, found ${matches.length}`,
    );
  }

  console.log(path.join(directory, matches[0].name));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
