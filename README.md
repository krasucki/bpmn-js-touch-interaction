[![npm version](https://img.shields.io/npm/v/bpmn-js-touch-interaction)](https://www.npmjs.com/package/bpmn-js-touch-interaction)
[![CI](https://github.com/krasucki/bpmn-js-touch-interaction/actions/workflows/CI.yml/badge.svg)](https://github.com/krasucki/bpmn-js-touch-interaction/actions/workflows/CI.yml)
[![license](https://img.shields.io/npm/l/bpmn-js-touch-interaction)](./LICENSE)

# bpmn-js-touch-interaction

Touch gestures for [bpmn-js](https://github.com/bpmn-io/bpmn-js) 18+ on phones and tablets.

## Install

```bash
npm install bpmn-js-touch-interaction
```

Peer dependency: `bpmn-js@^18`. `diagram-js-minimap` is an optional peer that
enables minimap touch support when present.

## Usage

```js
import BpmnModeler from 'bpmn-js/lib/Modeler';
import touchInteractionModule from 'bpmn-js-touch-interaction';

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [touchInteractionModule],
});
```

If you want to keep it out of your desktop bundle, dynamic-import it:

```js
const { default: touchInteractionModule } =
  await import('bpmn-js-touch-interaction');
```

## TLDR;

bpmn-js dropped touch support in v14 (May 2024) when the HammerJS-based
implementation was removed as unmaintainable
([announcement](https://bpmn.io/blog/posts/2024-bpmn-js-17-removing-touch-interaction-support.html),
[diagram-js#845](https://github.com/bpmn-io/diagram-js/pull/845)).

This plugin restores it using:

- A pure-function gesture recognizer (no HammerJS, no third-party gesture
  library, just native Touch Events)
- Direct calls to diagram-js APIs (`canvas.scroll`, `canvas.zoom`, `move.start`,
  `interactionEvents.fire`)
- A small set of scoped _monkey-patches_ that work around mouse-only assumptions
  in diagram-js (see [Caveats](#caveats))

> Note: I'm not proud of these monkey-patches, but I hope to file small PRs upstream so they can eventually go away.

## Gestures

| Gesture                                       | Action                             |
| --------------------------------------------- | ---------------------------------- |
| Tap element                                   | Select element                     |
| Double-tap element                            | Open label editor                  |
| Pan on empty canvas                           | Scroll viewport                    |
| Pan on element                                | Move element                       |
| Two-finger pinch                              | Zoom (0.2x – 4x)                   |
| Drag from palette                             | Place element at drop position     |
| Tap palette entry                             | Activate tool / enter create mode  |
| Tap connect tool, then touch-drag source→dest | Create connection (single gesture) |
| Tap lasso tool, then touch-drag               | Draw selection rectangle           |
| Tap space tool, then touch-drag               | Make or remove space               |
| Touch-drag a resize handle                    | Resize element                     |
| Touch-drag on minimap                         | Pan via minimap                    |

## Auto-detection

`window.matchMedia('(pointer: coarse)')` is used for activation:

| Device                             | `(pointer: coarse)` | Plugin active |
| ---------------------------------- | ------------------- | ------------- |
| Phone, tablet                      | `true`              | yes           |
| Desktop with mouse                 | `false`             | no            |
| Laptop with touchscreen + trackpad | `false`             | no            |
| iPad with attached keyboard/mouse  | `true`              | yes           |

We don't rely on `ontouchstart in window` — it happen to return true on hybrid laptops where touch is secondary and the plugin would break the desktop mouse tool flow on those machines.

## How it works

The plugin is a thin coordinator (`lib/core/TouchInteraction.js`) that bounds everything together:

```
lib/
├── core/
│   ├── TouchInteraction.js      coordinator
│   └── TouchFix.js              Safari iOS empty-canvas workaround
├── recognizers/
│   ├── gestureRecognizer.js     pure tap/pan/pinch/press/double-tap state machine
│   └── buttonRecognizer.js      gesture wiring for palette and context pad
├── patches/
│   ├── toolMode.js              single-gesture connect / lasso / space
│   ├── toolEventPatcher.js      fix NaN coords from touchend originalEvent
│   ├── hoverTracking.js         drag-time hover for touch (HoverFix is mouse-only)
│   └── mouseSuppression.js      block synthesized mouse events during touch
├── bridges/
│   └── minimapTouchBridge.js    mouse-event synthesis for diagram-js-minimap
├── util/
│   ├── eventHelpers.js          event wrappers for diagram-js compatibility
│   ├── device.js                (pointer: coarse) detection
│   └── constants.js             zoom bounds, suppression timing, event names
└── styles/
    └── touch-interaction.css    touch-action: none + active-tool cursor
```

## Caveats

### Touch-primary devices only

The plugin is a no-op on mouse-primary devices, including hybrid touchscreen
laptops where the trackpad is the primary input. The patches it installs would
break the desktop mouse tool flow if enabled there. To force-enable for
testing, use Chrome DevTools mobile emulation, which sets `(pointer: coarse)`.

### Monkey-patch surface

The plugin patches the following diagram-js services. All patches are scoped
to the Modeler instance, never global. Search the source for `// PATCH:` to
find each one with its rationale.

| Patched symbol                | Reason                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `globalConnect.start`         | Replaced with a flag-setter so connect uses single-gesture flow instead of desktop two-step.                               |
| `lassoTool.activateSelection` | Same: single-gesture lasso.                                                                                                |
| `spaceTool.activateSelection` | Same: single-gesture space tool.                                                                                           |
| `resizeHandles.makeDraggable` | Original bails on `isPrimaryButton(event)`, which returns false for TouchEvent. Replacement skips the check on touch.      |
| `dragging.init`               | Injects `keepSelection: true` for resize drags to keep handle DOM nodes alive mid-drag.                                    |
| `connect.start`               | Substitutes a synthetic touchstart for the `null` event passed by `globalConnect.start`, so Dragging binds touch handlers. |

These patches target private implementation details of diagram-js. They are
documented and scoped, but an upstream change to any patched method or its
call sites could silently break the corresponding gesture. Verified against
`diagram-js@15.11.0` (the version shipped with `bpmn-js@18.14.0`).

### diagram-js mouse-only assumptions

Eight assumptions in diagram-js needed workarounds:

1. `isPrimaryButton(event)` checks `event.button === 0`. TouchEvent has no
   `.button`, so the check always fails and events are silently dropped.
   Fix: `asPrimaryButtonEvent()` in `util/eventHelpers.js`.
2. `toPoint(event)` falls back to `event.clientX` / `clientY` on `touchend`,
   where `event.touches` is empty, producing NaN coordinates.
   Fix: `patches/toolEventPatcher.js` substitutes valid coordinates from
   `changedTouches`.
3. `isTouchEvent(event)` uses `instanceof TouchEvent`. Plain object wrappers
   fail this check.
   Fix: `createSyntheticTouchEvent()` in `util/eventHelpers.js` constructs
   real `TouchEvent` instances.
4. `element.out` is mapped from `mouseout`, which never fires on touch.
   Fix: `patches/hoverTracking.js` reimplements hover/out detection for
   touch drags.
5. The two-step desktop interaction pattern (palette tap → canvas tap → drag)
   does not map to touch.
   Fix: `patches/toolMode.js` collapses it to a single gesture (tap palette,
   then touch-drag).
6. `Dragging.stopPropagation()` in capture phase prevents bubble-phase gesture
   recognizers from receiving subsequent events, leaving the recognizer stuck.
   Fix: `gestureRecognizer.js` resets stuck state on a new `touchstart`.
7. Tool-end events pass `originalEvent` (a `touchend` with empty `touches`)
   to the next `dragging.init` call, producing NaN coordinates.
   Fix: `patches/toolEventPatcher.js`.
8. `autoActivate: true` without `keepSelection: true` removes decorations
   mid-drag, which fires `touchcancel` on the removed DOM node and ends the
   drag prematurely.
   Fix: `dragging.init` patch in `core/TouchInteraction.js`.

## Browser support

Requires native `TouchEvent` and the `Touch` constructor. Tested on Chrome on
Android and Safari on iOS. The minimap touch bridge needs `Touch`/`TouchEvent`
constructors; primary canvas gestures use real browser TouchEvents and work
without them.

## License

MIT
