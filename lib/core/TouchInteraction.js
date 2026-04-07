import { closest as domClosest } from 'min-dom';

import { createGestureRecognizer } from '../recognizers/gestureRecognizer.js';
import { createButtonRecognizer } from '../recognizers/buttonRecognizer.js';
import { createMouseSuppression } from '../patches/mouseSuppression.js';
import { createHoverTracking } from '../patches/hoverTracking.js';
import { createToolMode } from '../patches/toolMode.js';
import { installToolEventPatcher } from '../patches/toolEventPatcher.js';
import { attachMinimapTouchBridge } from '../bridges/minimapTouchBridge.js';
import { asPrimaryButtonEvent, createSyntheticTouchEvent } from '../util/eventHelpers.js';
import { isTouchPrimaryDevice } from '../util/device.js';
import { MIN_ZOOM, MAX_ZOOM } from '../util/constants.js';

/**
 * Main service. Wires touch gestures to diagram-js APIs by composing focused
 * modules from `recognizers/`, `patches/`, `bridges/` and `util/`.
 *
 * Search for `// PATCH:` to find every monkey-patch and the bug it fixes.
 *
 * `_touchFix` is unused at runtime but listed in $inject so diagram-js eagerly
 * instantiates the TouchFix service before this one (Safari iOS workaround).
 */
export default function TouchInteraction(injector, canvas, eventBus, elementRegistry, interactionEvents, _touchFix) {

  // --- Auto-detect: skip on mouse-primary devices ---
  // The plugin's monkey-patches replace tool activation methods with touch-only
  // flag-setters; activating them on desktop would break the mouse tool flow.
  // Use (pointer: coarse) media query to detect touch-primary devices.
  if (!isTouchPrimaryDevice()) return;

  // --- Required services ---
  const dragging = injector.get('dragging', false);
  const move = injector.get('move', false);

  // --- Optional services (some only present in Modeler, not Viewer) ---
  const palette = injector.get('palette', false);
  const contextPad = injector.get('contextPad', false);
  const connect = injector.get('connect', false);
  const globalConnect = injector.get('globalConnect', false);
  const lassoTool = injector.get('lassoTool', false);
  const spaceTool = injector.get('spaceTool', false);
  const rules = injector.get('rules', false);
  const resizeHandles = injector.get('resizeHandles', false);
  const resize = injector.get('resize', false);

  const cleanupFns = [];

  // --- Mouse suppression: prevent ghost click/mousedown after touches ---
  const suppression = createMouseSuppression(() => canvas.getContainer());

  // --- Hover tracking: HoverFix bails on non-MouseEvent → reimplement for touch ---
  if (dragging) {
    createHoverTracking(eventBus, dragging, elementRegistry, canvas);
  }

  // --- Tool mode: single-gesture connect/lasso/space ---
  // setActiveTool(tool, source?) — replaces tool activation methods + dispatches canvas touches
  const toolMode = createToolMode({
    canvas, palette, elementRegistry, rules,
    connect, lassoTool, spaceTool, globalConnect,
  });

  // --- Tool event patcher: fix NaN coords from touchend originalEvent ---
  installToolEventPatcher(eventBus);

  // --- PATCH: ResizeHandles.makeDraggable ---
  // Original binds touchstart but startResize() bails on isPrimaryButton (TouchEvent
  // has no .button → false). Replace with version that skips the check on touch.
  if (resizeHandles && resize) {
    resizeHandles.makeDraggable = function(element, gfx, direction) {
      function startResize(event) {
        resize.activate(event, element, direction);
      }
      gfx.addEventListener('mousedown', function(event) {
        if (event.button === 0) startResize(event);
      });
      gfx.addEventListener('touchstart', startResize, { passive: false });
    };
  }

  // --- PATCH: dragging.init injects keepSelection for resize ---
  // Without keepSelection, move(event, true) clears selection → ResizeHandles
  // removes the handle DOM mid-drag → browser fires touchcancel on the removed
  // target → drag ends immediately. With keepSelection, handles stay in DOM.
  if (dragging) {
    const origInit = dragging.init;
    dragging.init = function(event, relativeTo, prefix, options) {
      if (prefix === 'resize') {
        options = Object.assign({ keepSelection: true }, options || {});
      }
      return origInit.call(this, event, relativeTo, prefix, options);
    };
  }

  // --- PATCH: connect.start substitutes synthetic TouchEvent for null event ---
  // GlobalConnect calls connect.start(null, ...) — null event makes Dragging
  // bind mouse handlers → touch events never caught.
  // NOTE: this patches `connect`, but is only triggered when activeTool='connect'
  //   (which only `globalConnect.start` can set, see toolMode.js). The two
  //   patches are co-dependent — if globalConnect is missing the patch is dead code.
  if (connect) {
    const origConnectStart = connect.start;
    connect.start = function(event, start, connectionStart, autoActivate) {
      if (!event) {

        // 0,0 matches desktop's null event behavior (globalStart={0,0}).
        // Actual connection start position is in `connectionStart` arg, stored in data.
        const synthetic = createSyntheticTouchEvent('touchstart', canvas._svg, 0, 0);
        if (synthetic) event = synthetic;
      }
      return origConnectStart.call(this, event, start, connectionStart, autoActivate);
    };
  }

  // --- Canvas gesture setup (runs once per diagram) ---
  eventBus.on('canvas.init', function(event) {
    const svg = event.svg;

    // Tool-mode capture interceptor must run BEFORE the bubble-phase canvas
    // recognizer below, so that tap-on-element-during-tool-mode is handled
    // by the tool dispatcher (which calls preventDefault + stopPropagation).
    cleanupFns.push(toolMode.attachCanvasInterceptor(svg));

    // panActive separates "canvas pan" (canvas.scroll) from "element drag"
    // (move.start). Both come from the same recognizer onPanStart callback,
    // distinguished by whether the touch target is a .djs-element with parent.
    let panActive = false;
    let lastPanX = 0;
    let lastPanY = 0;

    // pinchInitialZoom is captured at pinchStart so onPinchMove can compute
    // newZoom = initialZoom * cumulativeScale (recognizer reports cumulative).
    let pinchInitialZoom = 1;

    const cleanup = createGestureRecognizer(svg, {
      onTap({ target, originalEvent }) {
        suppression.start();
        suppression.schedule();
        const gfx = domClosest(target, '.djs-element', true);
        const element = gfx ? elementRegistry.get(gfx) : elementRegistry.getAll().find(e => !e.parent);
        if (element) {
          interactionEvents.fire('element.click', asPrimaryButtonEvent(originalEvent), element);
        }
      },

      onDoubleTap({ target, originalEvent }) {
        suppression.start();
        suppression.schedule();
        const gfx = domClosest(target, '.djs-element', true);
        const element = gfx ? elementRegistry.get(gfx) : null;
        if (element) {
          interactionEvents.fire('element.dblclick', asPrimaryButtonEvent(originalEvent), element);
        }
      },

      onPanStart({ center, target, originalEvent }) {
        suppression.start();
        const gfx = domClosest(target, '.djs-element', true);
        const element = gfx ? elementRegistry.get(gfx) : null;

        if (element && element.parent && move) {

          // Drag a BPMN element — diagram-js Move handles the rest
          move.start(originalEvent, element, true);
        } else {

          // Pan the canvas viewport
          panActive = true;
          lastPanX = center.x;
          lastPanY = center.y;
        }
      },

      onPanMove({ center }) {
        if (!panActive) return;
        const dx = center.x - lastPanX;
        const dy = center.y - lastPanY;
        if (!isFinite(dx) || !isFinite(dy)) return;
        lastPanX = center.x;
        lastPanY = center.y;
        canvas.scroll({ dx, dy });
      },

      onPanEnd() {
        panActive = false;
        suppression.schedule();
      },

      onPress() {

        // Long press on element — drag starts when recognizer transitions to PAN
      },

      onPinchStart() {
        suppression.start();
        pinchInitialZoom = canvas.zoom();
      },

      onPinchMove({ center, scale }) {
        if (!isFinite(scale) || !isFinite(center.x) || !isFinite(center.y)) return;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchInitialZoom * scale));
        canvas.zoom(newZoom, center);
      },

      onPinchEnd() {
        suppression.schedule();
      },
    });

    cleanupFns.push(cleanup);

    // --- Minimap touch bridge ---
    // Wired here (vs. its own canvas.init listener) so init order is obvious.
    const minimapEl = canvas.getContainer()?.querySelector('.djs-minimap');
    if (minimapEl) {
      cleanupFns.push(attachMinimapTouchBridge(minimapEl));
    }
  });

  // --- Palette touch ---
  if (palette) {
    eventBus.on('palette.create', function(event) {
      const cleanup = createButtonRecognizer(event.container, palette, {
        onTouch: () => {
          suppression.start();
          suppression.schedule();

          // Reset any active tool — replaced activate methods will set it back
          // if this tap activates a tool (connect/lasso/space).
          toolMode.setActiveTool(null);
        },
      });
      cleanupFns.push(cleanup);
    });
  }

  // --- Context pad touch ---
  // contextPad.create fires on every element select — clean up the previous recognizer
  let contextPadCleanup = null;
  let contextPadTarget = null;

  if (contextPad) {
    eventBus.on('contextPad.create', function(event) {
      if (contextPadCleanup) {
        contextPadCleanup();
        contextPadCleanup = null;
      }
      contextPadTarget = event.target || null;

      contextPadCleanup = createButtonRecognizer(event.pad, contextPad, {
        onTouch: () => {
          suppression.start();
          suppression.schedule();
        },
        onTapExtra: (button) => {

          // Short-circuit the connect entry: standard flow calls connect.start
          // immediately on tap, but the user hasn't moved their finger yet →
          // drag waits for movement → user must touch canvas again to continue.
          // Mobile: tap pad → touch + drag from element to target = single gesture.
          if (button.getAttribute('data-action') === 'connect' && contextPadTarget && connect) {
            toolMode.setActiveTool('connect', contextPadTarget);

            // Close the context pad so it doesn't obstruct the next touch
            if (typeof contextPad.close === 'function') contextPad.close();
            return true; // skip default trigger('click')
          }
          return false;
        },
      });
    });

    // Clear stale target reference when context pad is closed (defensive)
    eventBus.on([ 'contextPad.close', 'selection.changed' ], function() {

      // Don't clear immediately — selection.changed fires before contextPad.create.
      // Target will be overwritten on next contextPad.create. Only clear on close.
      if (!contextPad.isOpen?.()) {
        contextPadTarget = null;
      }
    });
  }

  // --- Cleanup on diagram destroy ---
  eventBus.on('diagram.destroy', function() {
    suppression.destroy();
    if (contextPadCleanup) contextPadCleanup();
    cleanupFns.forEach(fn => fn());
    cleanupFns.length = 0;
  });
}

TouchInteraction.$inject = [
  'injector', 'canvas', 'eventBus',
  'elementRegistry', 'interactionEvents', 'touchFix',
];
