"use strict";

const assert = require("node:assert/strict");
const addon = require("./build/Release/late_event_test.node");

const index = Number(process.argv[2]);
const eventField = ["keycode", "button", "rotation"][index];
let delivered = false;

addon.start((event) => {
  assert.equal(delivered, false, "teardown event reached a JavaScript listener");
  delivered = true;
  assert.ok(Object.hasOwn(event, eventField), `expected ${eventField} on the live event`);
  addon.armCleanupEvent(index);
});

process.once("exit", () => {
  assert.equal(delivered, true, "the live event was never delivered");
});

addon.queueEvent(index);
