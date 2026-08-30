import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedElectron = "42.9.3";
const smokeScript = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "electron-smoke.cjs",
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
