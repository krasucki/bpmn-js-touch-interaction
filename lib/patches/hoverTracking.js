import { closest as domClosest } from 'min-dom';

/**
 * Touch drag hover tracking.
 *
 * On mouse, `mouseover`/`mouseout` events fire as the cursor moves and HoverFix
 * sets `dragging.hover()` for the drag system. On touch, those events don't fire
 * (no hover concept). This module mirrors HoverFix._findTargetGfx specifically
 * for touch — it listens to `drag.move` and uses `document.elementFromPoint()`
 * to find the BPMN element under the finger, then calls `dragging.hover()/out()`.
 *
 * NOTE: HoverFix explicitly bails on non-MouseEvent — that's why we need this.
 *
 * @param {EventBus} eventBus
 * @param {Dragging} dragging
 * @param {ElementRegistry} elementRegistry
 * @param {Canvas} canvas
 * @returns {{ destroy: () => void }}
 */
export function createHoverTracking(eventBus, dragging, elementRegistry, canvas) {

  // lastHover stays null until the first drag.move with a hit; comparing
  // null !== element on first move correctly fires the initial hover.
  let lastHover = null;

  // Match either '.djs-element' (specific BPMN element) or 'svg' (canvas root).
  // SVG fallback handles the empty-canvas case where elementFromPoint returns
  // the <svg> itself, which has no .djs-element class.
  function findElementAtPoint(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target) return null;

    const gfx = domClosest(target, '.djs-element', true);
    if (gfx) {
      const element = elementRegistry.get(gfx);
      if (element) return { element, gfx };
    }

    if (domClosest(target, 'svg', true)) {
      const root = canvas.getRootElement();
      if (root) {
        return { element: root, gfx: elementRegistry.getGraphics(root) };
      }
    }

    return null;
  }

  function onDragMove(event) {
    if (!event.isTouch) return;

    const originalEvent = event.originalEvent;
    if (!originalEvent) return;

    const touch = originalEvent.touches?.[0] || originalEvent.changedTouches?.[0];
    if (!touch) return;

    const hit = findElementAtPoint(touch.clientX, touch.clientY);

    if (hit && hit.element !== lastHover) {
      if (lastHover) {
        dragging.out({ element: lastHover, gfx: elementRegistry.getGraphics(lastHover) });
      }
      lastHover = hit.element;
      dragging.hover({ element: hit.element, gfx: hit.gfx });
    } else if (!hit && lastHover) {
      dragging.out({ element: lastHover, gfx: elementRegistry.getGraphics(lastHover) });
      lastHover = null;
    }
  }

  function onDragLifecycleEnd() {
    lastHover = null;
  }

  eventBus.on('drag.move', onDragMove);
  eventBus.on([ 'drag.end', 'drag.cancel', 'drag.cleanup' ], onDragLifecycleEnd);

  // EventBus listeners are released when the diagram is destroyed (eventBus is
  // garbage collected with the Modeler), so no explicit destroy is required.
  // Function provided for symmetry/future-proofing.
  return {
    destroy() {

      // EventBus listeners can't be removed without storing the original references;
      // diagram-js cleans them on diagram.destroy. No-op here.
    },
  };
}
