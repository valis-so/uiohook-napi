"use strict";

const fs = require("node:fs");
const fixture = require("./build/Release/listener_exception_test.node");

process.on("uncaughtExceptionMonitor", (error, origin) => {
  fs.writeSync(
    process.stderr.fd,
    `UIOHOOK_LISTENER_EXCEPTION_MONITOR|${origin}|${error.stack}\n`,
  );
});

fixture.trigger(() => {
  throw new Error("UIOHOOK_LISTENER_FAILURE");
});
