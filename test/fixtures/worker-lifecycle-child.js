'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const { once } = require('node:events')
const { Worker } = require('node:worker_threads')

const projectRoot = path.resolve(__dirname, '..', '..')
const addon = require('node-gyp-build')(projectRoot)
const scenario = process.argv[2]
const syntheticInput = process.env.UIOHOOK_TEST_SYNTHETIC_INPUT === '1'
const requireHook = process.env.UIOHOOK_TEST_REQUIRE_HOOK === '1'

const TEST_KEY = 0x001E
const KEY_TAP = 0
const EVENT_KEY_PRESSED = 4

const unavailableHookErrors = new Set([
  'UIOHOOK_ERROR_X_OPEN_DISPLAY',
  'UIOHOOK_ERROR_X_RECORD_NOT_FOUND',
  'UIOHOOK_ERROR_X_RECORD_ALLOC_RANGE',
  'UIOHOOK_ERROR_X_RECORD_CREATE_CONTEXT',
  'UIOHOOK_ERROR_X_RECORD_ENABLE_CONTEXT',
  'UIOHOOK_ERROR_SET_WINDOWS_HOOK_EX',
  'UIOHOOK_ERROR_AXAPI_DISABLED',
  'UIOHOOK_ERROR_CREATE_EVENT_PORT',
  'UIOHOOK_ERROR_CREATE_RUN_LOOP_SOURCE',
  'UIOHOOK_ERROR_GET_RUNLOOP',
  'UIOHOOK_ERROR_CREATE_OBSERVER'
])

const workerSource = `
'use strict'

const { parentPort, workerData } = require('node:worker_threads')
const addon = require('node-gyp-build')(workerData.projectRoot)

function serializeError (error) {
  return {
    kind: 'error',
    code: error && error.code,
    message: error && error.message
  }
}

try {
  switch (workerData.action) {
    case 'load':
      if (workerData.syntheticInput) {
        addon.keyTap(workerData.testKey, workerData.keyTap)
      }
      parentPort.postMessage({ kind: 'loaded' })
      break
    case 'start':
      try {
        addon.start(() => {})
        parentPort.postMessage({ kind: 'returned' })
      } catch (error) {
        parentPort.postMessage(serializeError(error))
      }
      break
    case 'stop':
      try {
        addon.stop()
        parentPort.postMessage({ kind: 'returned' })
      } catch (error) {
        parentPort.postMessage(serializeError(error))
      }
      break
    case 'own':
      try {
        addon.start(() => {})
        parentPort.postMessage({ kind: 'started' })
      } catch (error) {
        parentPort.postMessage(serializeError(error))
      }
      break
    default:
      throw new Error('Unknown worker action: ' + workerData.action)
  }
} catch (error) {
  parentPort.postMessage(serializeError(error))
}
`

function skipForUnavailableHook (error) {
  if (!requireHook && error && unavailableHookErrors.has(error.code)) {
    console.log(`SKIP: ${error.code}: ${error.message}`)
    process.exit(77)
  }
}

function startOwner (callback) {
  try {
    addon.start(callback)
  } catch (error) {
    skipForUnavailableHook(error)
    throw error
  }
}

function createWorker (action) {
  return new Worker(workerSource, {
    eval: true,
    workerData: {
      action,
      projectRoot,
      syntheticInput,
      testKey: TEST_KEY,
      keyTap: KEY_TAP
    }
  })
}

async function runWorkerToExit (action) {
  const worker = createWorker(action)
  const messagePromise = once(worker, 'message')
  const exitPromise = once(worker, 'exit')
  const [[message], [exitCode]] = await Promise.all([messagePromise, exitPromise])
  assert.equal(exitCode, 0)
  return message
}

function assertWorkerError (message, code) {
  assert.equal(message.kind, 'error')
  assert.equal(message.code, code)
}

function createEventProbe () {
  let enabled = false
  let timeout
  let resolveEvent
  let rejectEvent

  const eventPromise = new Promise((resolve, reject) => {
    resolveEvent = resolve
    rejectEvent = reject
  })

  return {
    callback: (event) => {
      if (enabled && event.type === EVENT_KEY_PRESSED && event.keycode === TEST_KEY) {
        clearTimeout(timeout)
        resolveEvent()
      }
    },
    postAndWait: async () => {
      enabled = true
      timeout = setTimeout(() => rejectEvent(new Error('Owner stopped receiving input events')), 5000)
      addon.keyTap(TEST_KEY, KEY_TAP)
      await eventPromise
    }
  }
}

async function testNonOwnerExit () {
  const eventProbe = createEventProbe()
  startOwner(eventProbe.callback)

  const message = await runWorkerToExit('load')
  assert.equal(message.kind, 'loaded')

  if (syntheticInput) {
    await eventProbe.postAndWait()
  }

  addon.stop()
  startOwner(() => {})
  addon.stop()
}

async function testCompetingStart () {
  startOwner(() => {})
  const message = await runWorkerToExit('start')
  assertWorkerError(message, 'UIOHOOK_ERROR_ALREADY_RUNNING')
  addon.stop()
}

async function testNonOwnerStop () {
  startOwner(() => {})
  const message = await runWorkerToExit('stop')
  assertWorkerError(message, 'UIOHOOK_ERROR_NOT_OWNER')
  addon.stop()
}

async function testOwnerTermination () {
  const worker = createWorker('own')
  const [message] = await once(worker, 'message')

  if (message.kind === 'error') {
    skipForUnavailableHook(message)
  }
  assert.equal(message.kind, 'started')

  await worker.terminate()
  startOwner(() => {})
  addon.stop()
}

const scenarios = {
  'non-owner-exit': testNonOwnerExit,
  'competing-start': testCompetingStart,
  'non-owner-stop': testNonOwnerStop,
  'owner-termination': testOwnerTermination
}

async function main () {
  const run = scenarios[scenario]
  assert.ok(run, `Unknown scenario: ${scenario}`)
  await run()
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exit(1)
})
