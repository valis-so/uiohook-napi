import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const prebuildScript = packageJson.scripts?.prebuild;
const electronTarget =
  typeof prebuildScript === "string"
    ? prebuildScript.match(
        /(?:^|\s)--target(?:=|\s+)electron@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=\s|$)/,
      )
    : null;
if (!electronTarget) {
  throw new Error(
    "package.json scripts.prebuild must contain an exact --target electron@<version>",
  );
}

const expectedElectron = electronTarget[1];
const smokeScript = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "runtime-smoke.cjs",
);
const npmArgs = [
  "exec",
  "--yes",
  `--package=electron@${expectedElectron}`,
  "--",
  "electron",
  smokeScript,
];
const windowsSmokeScript = path.relative(process.cwd(), smokeScript);
const command =
  process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const commandArgs =
  process.platform === "win32"
    ? [
        "/d",
        "/s",
        "/c",
        `npm exec --yes --package=electron@${expectedElectron} -- electron ${windowsSmokeScript}`,
      ]
    : npmArgs;

const result = spawnSync(
  command,
  commandArgs,
  {
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      EXPECTED_ELECTRON: expectedElectron,
    },
    stdio: "inherit",
    timeout: 120_000,
  },
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  throw new Error(
    `Electron ${expectedElectron} smoke test exited ${result.status ?? "without a status"}`,
  );
}
