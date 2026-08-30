# uiohook-napi (Valis fork)

[![GitHub release](https://img.shields.io/github/v/release/valis-so/uiohook-napi?label=release)](https://github.com/valis-so/uiohook-napi/releases)

N-API bindings for [libuiohook](https://github.com/kwhat/libuiohook), providing
global keyboard and mouse events and keyboard event posting for Node.js and
Electron.

This repository is a Valis-maintained fork of
[SnosMe/uiohook-napi](https://github.com/SnosMe/uiohook-napi). It publishes the
startup-handshake fix proposed in
[upstream PR #66](https://github.com/SnosMe/uiohook-napi/pull/66), together with
the prebuilt binaries used by Valis. Upstream changes are incorporated as
needed for Valis releases; there is no fixed rebase schedule.

## Installation

Valis releases are distributed as versioned package archives attached to
[GitHub Releases](https://github.com/valis-so/uiohook-napi/releases). Install
the release archive directly:

```sh
npm install https://github.com/valis-so/uiohook-napi/releases/download/v1.5.5-valis.1/uiohook-napi-1.5.5-valis.1.tgz
```

To pin the same release explicitly in `package.json`:

```json
{
  "dependencies": {
    "uiohook-napi": "https://github.com/valis-so/uiohook-napi/releases/download/v1.5.5-valis.1/uiohook-napi-1.5.5-valis.1.tgz"
  }
}
```

`npm install uiohook-napi` installs the upstream npm package, not this fork.
Installing this repository from a Git branch or tag is also unsupported because
the Git tree does not contain the compiled `dist` or `prebuilds` artifacts.

## Prebuilt binaries

Release `1.5.5-valis.1` contains prebuilt binaries for these CI-tested targets:

| Platform | Architecture | Prebuild directory |
| --- | --- | --- |
| macOS | arm64 (Apple silicon) | `darwin-arm64` |
| macOS | x64 (Intel) | `darwin-x64` |
| Windows | x64 | `win32-x64` |

Release CI uses Node.js 24 as the build host, targets Electron 42.9.3 headers,
and smoke-loads each binary with Electron 42.9.3. The resulting binaries use
N-API, while the package declares Node.js 16 or newer. The release gate covers
only the targets and runtime above.

If no matching prebuild exists and dependency lifecycle scripts are enabled,
the `node-gyp-build` install hook attempts a local `node-gyp rebuild`. Package
managers configured to block dependency install scripts cannot perform this
fallback until the script is approved. Other platforms are not part of the
Valis release test matrix and require a compatible native build toolchain and
platform development libraries. Linux source builds use the bundled X11
backend and do not provide native Wayland support. See the
[`node-gyp` installation requirements](https://github.com/nodejs/node-gyp#installation)
and [`binding.gyp`](binding.gyp) before relying on a source build.

## macOS permissions

Before calling `uIOhook.start()`, `uIOhook.keyTap()`, or `uIOhook.keyToggle()`,
grant the host process access in **System Settings > Privacy & Security >
Accessibility**. The current libuiohook code checks this permission before
starting, and macOS also uses it for synthetic keyboard events.

During development, the host may be Terminal, your IDE, or Electron; for a
packaged application, grant access to that application. Restart the host after
changing the permission. macOS may separately request **Input Monitoring** for
global event capture; if it does, grant it to the same host process. If event
capture remains unavailable and no prompt appears, manually enable the same
host under **System Settings > Privacy & Security > Input Monitoring**.

## Usage

```typescript
import { uIOhook, UiohookKey } from 'uiohook-napi'

uIOhook.on('keydown', (event) => {
  console.log(event.type, event.time, event.keycode)

  if (event.keycode === UiohookKey.Escape) {
    uIOhook.stop()
  }
})

uIOhook.start()
```

Keyboard events can also be posted using numeric key codes or the exported
`UiohookKey` constants:

```typescript
uIOhook.keyTap(UiohookKey.A, [UiohookKey.Ctrl])
uIOhook.keyToggle(UiohookKey.Shift, 'down')
uIOhook.keyToggle(UiohookKey.Shift, 'up')
```

## Worker threads

The addon may be loaded from multiple Node.js environments, and `keyTap()` or
`keyToggle()` may be called from any of them. Only one environment can own the
active input listener at a time.

- Calling `start()` again from the owner is a no-op.
- Calling `start()` from another environment throws
  `UIOHOOK_ERROR_ALREADY_RUNNING`.
- Calling `stop()` from another environment throws `UIOHOOK_ERROR_NOT_OWNER`.
- Exiting an environment that does not own the listener does not stop it.

The public methods are:

- `start(): void`
- `stop(): void`
- `keyTap(key: number, modifiers?: number[]): void`
- `keyToggle(key: number, toggle: 'down' | 'up'): void`
- Typed event listeners for `input`, `keydown`, `keyup`, `mousedown`,
  `mouseup`, `mousemove`, `click`, and `wheel`

Event objects include the discriminating `type` and numeric `time` fields in
addition to their keyboard, mouse, or wheel fields. The package ships its full
TypeScript declarations in `dist/index.d.ts`;
[`src/index.ts`](https://github.com/valis-so/uiohook-napi/blob/master/src/index.ts)
is the source of truth.

## License

The `uiohook-napi` wrapper source is licensed under the
[MIT License](LICENSE). Distributed packages also contain and statically link
[libuiohook](https://github.com/kwhat/libuiohook), licensed under
LGPL-3.0-or-later. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the
applicable license texts, source revision, and patch information.
