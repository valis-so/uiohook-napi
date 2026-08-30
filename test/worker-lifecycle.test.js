'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const fixture = path.join(__dirname, 'fixtures', 'worker-lifecycle-child.js')
const requireHook = process.env.UIOHOOK_TEST_REQUIRE_HOOK === '1'

function formatResult (result) {
  return [
    `status: ${result.status}`,
    `signal: ${result.signal}`,
    `stdout:\n${result.stdout || ''}`,
    `stderr:\n${result.stderr || ''}`
  ].join('\n')
}

function runScenario (t, scenario) {
  const result = spawnSync(process.execPath, [fixture, scenario], {
    encoding: 'utf8',
    env: process.env,
    timeout: 20000
  })

  assert.equal(result.error, undefined, formatResult(result))

  if (result.status === 77 && !requireHook) {
    t.skip(result.stdout.trim() || 'Global input hooks are unavailable')
    return
  }

  assert.equal(result.signal, null, formatResult(result))
  assert.equal(result.status, 0, formatResult(result))
}

test('terminating a non-owner environment leaves the owner usable', (t) => {
  runScenario(t, 'non-owner-exit')
})

test('a second environment cannot start the active listener', (t) => {
  runScenario(t, 'competing-start')
})

test('a non-owner environment cannot stop the active listener', (t) => {
  runScenario(t, 'non-owner-stop')
})

test('listener ownership is released when the owner environment terminates', (t) => {
  runScenario(t, 'owner-termination')
})
