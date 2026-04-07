import { PATCHED_TOOL_EVENTS, TOOL_EVENT_PRIORITY } from '../util/constants.js';

/**
 * Patch `event.originalEvent` on tool end events.
 *
 * Several diagram-js tools (LassoTool, SpaceTool) read `event.originalEvent`
 * from drag end events and pass it forward to `dragging.init` / `activate*`.
 * On touch, `event.originalEvent` is a touchend with empty `touches` →
 * `toPoint()` returns `{x: undefined, y: undefined}` → NaN propagates through
 * SVG transforms and crashes (`setTranslate` non-finite, `<rect> NaN`).
 *
 * Fix: at high priority (before tool handlers), replace `event.originalEvent`
 * with a real `TouchEvent('touchstart')` carrying the same touches from
 * `changedTouches`. The synthetic event has populated `touches`, passes
 * `isTouchEvent()`, and `target` is preserved via `Object.defineProperty`
 * (target is read-only on Event prototype).
 *
 * @param {EventBus} eventBus
 */
export function installToolEventPatcher(eventBus) {
  eventBus.on(PATCHED_TOOL_EVENTS, TOOL_EVENT_PRIORITY, function(event) {
    const orig = event.originalEvent;
    if (!orig || typeof TouchEvent === 'undefined') return;
    if (!(orig instanceof TouchEvent)) return;
    if (orig.touches?.length) return; // already has populated touches

    const touches = Array.from(orig.changedTouches || []);
    if (!touches.length) return;

    const patched = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches,
      changedTouches: touches,
      targetTouches: touches,
    });
    Object.defineProperty(patched, 'target', { value: orig.target });
    event.originalEvent = patched;
  });
}
