/**
 * Pure event-construction helpers for the touch interaction plugin.
 *
 * These wrap or synthesize DOM events to satisfy diagram-js's mouse-only
 * assumptions (`isPrimaryButton`, `isTouchEvent`, `toPoint`).
 */

/**
 * Wrap a TouchEvent so it passes diagram-js `isPrimaryButton(event)` check
 * (which reads `event.button === 0` — undefined on TouchEvent).
 *
 * Cannot use `Object.create(touchEvent)` — native DOM methods (`stopPropagation`,
 * `preventDefault`) throw "Illegal invocation" when called with a non-Event `this`.
 * Use a plain object with bound delegate methods instead.
 *
 * NOTE: lost `instanceof TouchEvent`. Only use for `interactionEvents.fire`,
 * NOT for `dragging.init` (which checks `isTouchEvent` via `instanceof`).
 */
export function asPrimaryButtonEvent(touchEvent) {
  return {
    button: 0,
    target: touchEvent.target,
    clientX: touchEvent.clientX,
    clientY: touchEvent.clientY,
    preventDefault: () => touchEvent.preventDefault(),
    stopPropagation: () => touchEvent.stopPropagation(),
    stopImmediatePropagation: () => touchEvent.stopImmediatePropagation(),
  };
}

/**
 * Synthetic event for `palette.trigger` / `contextPad.trigger`. Both methods
 * expect an event with `delegateTarget` (the element with `data-action`) and
 * may call `preventDefault()` on the fallback path — provide no-op stubs.
 */
export function syntheticEvent(delegateTarget, originalEvent) {
  return {
    delegateTarget,
    originalEvent,
    preventDefault() {},
    stopPropagation() {},
  };
}

/**
 * Construct a real TouchEvent that passes `isTouchEvent()` (instanceof check)
 * AND has populated `touches` so `toPoint()` can extract coordinates.
 *
 * Used to substitute for `null` events passed to `connect.start(null, ...)` —
 * without this, `Dragging.init` binds mouse handlers and touch events are lost.
 *
 * TouchEvent constructor requires REAL Touch instances (not plain objects),
 * hence the `new Touch({...})` call.
 *
 * @returns {TouchEvent|null} null if Touch/TouchEvent unavailable or construction fails
 */
export function createSyntheticTouchEvent(type, target, x = 0, y = 0) {
  if (typeof TouchEvent === 'undefined' || typeof Touch === 'undefined') return null;
  try {
    const touch = new Touch({
      identifier: 0,
      target,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
      screenX: x,
      screenY: y,
    });
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: [ touch ],
      changedTouches: [ touch ],
      targetTouches: [ touch ],
    });
  } catch (e) {
    console.warn('[touch] failed to construct synthetic TouchEvent:', e);
    return null;
  }
}
