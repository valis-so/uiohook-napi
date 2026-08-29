import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const currentFile = fileURLToPath(import.meta.url);
const timeoutMs = 2_000;

function runChildCase(name) {
  const addon = require("./build/Release/handshake_test.node");
  const result = addon.run(name);
  const expected = name === "early-failure" ? 1 : 0;
  assert.equal(result, expected, `${name} returned ${result}, expected ${expected}`);
}

function runBounded(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [currentFile, "--case", name], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${name} exceeded ${timeoutMs} ms (deadlock reproduced)`));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `${name} failed with code ${code}, signal ${signal ?? "none"}\n${stdout}${stderr}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

if (process.argv[2] === "--case") {
  runChildCase(process.argv[3]);
} else {
  let failures = 0;
  for (const name of ["spurious-wake", "early-failure"]) {
    try {
      await runBounded(name);
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${error.message}`);
    }
  }
  process.exitCode = failures === 0 ? 0 : 1;
}
