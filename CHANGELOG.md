# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-07

First public release.

### Added

- Touch gesture support for bpmn-js 18+ on touch-primary devices.
- Pure-function gesture recognizer (`lib/recognizers/gestureRecognizer.js`)
  with tap, double-tap, pan, pinch, press and stuck-state recovery.
- Single-gesture tool mode for connect, lasso and space tools
  (`lib/patches/toolMode.js`): tap palette, then touch-drag in one motion.
- Drag-time hover tracking for touch (`lib/patches/hoverTracking.js`),
  replacing diagram-js `HoverFix` which bails on non-MouseEvent input.
- Mouse event suppression during and after touch
  (`lib/patches/mouseSuppression.js`) to block browser-synthesized
  click / mousedown events that would fire on top of taps.
- Tool end event patcher (`lib/patches/toolEventPatcher.js`) that replaces
  the empty-`touches` touchend originalEvent passed to `dragging.init`
  by lasso/space tools, preventing NaN coordinates.
- Minimap touch bridge (`lib/bridges/minimapTouchBridge.js`) that
  synthesizes mouse events for the mouse-only `diagram-js-minimap`.
- Safari iOS empty-canvas workaround (`lib/core/TouchFix.js`) via two
  invisible SVG rects that extend the bounding box so `touchstart` fires
  reliably on empty areas.
- Monkey-patches for `resizeHandles.makeDraggable`, `dragging.init` and
  `connect.start` to handle TouchEvent shape differences. All scoped to
  the Modeler instance, documented inline with `// PATCH:` markers.
- Auto-detection via `(pointer: coarse)` media query
  (`lib/util/device.js`). The plugin is a no-op on mouse-primary devices.
- Self-contained CSS (`lib/styles/touch-interaction.css`): applies
  `touch-action: none` to canvas + palette and sets a crosshair cursor
  for active tool mode. Auto-injected at runtime via the build.
- ESM distribution with sourcemap, built by Rollup.
- 53 unit tests covering gestureRecognizer, eventHelpers, mouseSuppression,
  toolEventPatcher and device detection.

[Unreleased]: https://github.com/krasucki/bpmn-js-touch-interaction/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/krasucki/bpmn-js-touch-interaction/releases/tag/v0.1.0
