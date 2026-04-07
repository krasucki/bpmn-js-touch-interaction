import {
  MOUSE_SUPPRESSION_MS,
  SUPPRESSED_MOUSE_EVENTS,
} from '../util/constants.js';

/**
 * Mouse event suppression — prevents browser-synthesized mouse events
 * (click from tap, etc.) from firing during and shortly after a touch.
 *
 * Uses capture-phase listeners on the canvas container, scoped to bpmn-js.
 * Does NOT affect document-level handlers (like Dragging's), which is correct.
 *
 * @param {() => Element} getContainer — accessor for the canvas container
 *   (lazy: container may not exist when this is constructed)
 * @returns {{ start, schedule, end, destroy }}
 */
export function createMouseSuppression(getContainer) {
  let suppressing = false;
  let timer = null;

  function stopEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function start() {
    if (suppressing) return;
    const container = getContainer();
    if (!container) return;
    suppressing = true;
    SUPPRESSED_MOUSE_EVENTS.forEach((type) => {
      container.addEventListener(type, stopEvent, true);
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(end, MOUSE_SUPPRESSION_MS);
  }

  function end() {
    if (!suppressing) return;
    const container = getContainer();
    if (!container) {
      suppressing = false;
      return;
    }
    suppressing = false;
    SUPPRESSED_MOUSE_EVENTS.forEach((type) => {
      container.removeEventListener(type, stopEvent, true);
    });
  }

  function destroy() {
    clearTimeout(timer);
    end();
  }

  return { start, schedule, end, destroy };
}
