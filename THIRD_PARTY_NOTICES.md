# Third-party notices

The `uiohook-napi` wrapper source is licensed under the MIT License in
[`LICENSE`](LICENSE).

The package also contains and statically links
[libuiohook](https://github.com/kwhat/libuiohook), licensed under
LGPL-3.0-or-later. The `1.5.5-valis.2` prebuilds use libuiohook commit
`f259ff37e81125f6f91ebac5439e7cde1e78b296` with the changes recorded in
[`src/libuiohook.patch`](src/libuiohook.patch).

The applicable GPLv3 and LGPLv3 texts are included as
[`libuiohook/COPYING.md`](libuiohook/COPYING.md) and
[`libuiohook/COPYING.LESSER.md`](libuiohook/COPYING.LESSER.md). The package
includes the libuiohook source and headers used by `binding.gyp`; the complete
corresponding repository revision is available at:

<https://github.com/kwhat/libuiohook/tree/f259ff37e81125f6f91ebac5439e7cde1e78b296>

Valis fork source and build instructions for this package release are available
at:

<https://github.com/valis-so/uiohook-napi/tree/v1.5.5-valis.2>
