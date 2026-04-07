/**
 * Minimap touch support via mouse event synthesis.
 *
 * `diagram-js-minimap` uses ONLY mouse events. It binds `mousedown` on its
 * container/svg, then `mousemove`/`mouseup` on `document`. Since it doesn't
 * register any touch handlers, we synthesize mouse events from touch events
 * on the `.djs-minimap` container.
 *
 * This is the ONE place mouse synthesis is correct — minimap is a self-
 * contained mouse-only component with no touch handlers to conflict with.
 *
 * @param {Element} minimapEl — the .djs-minimap DOM element
 * @returns {() => void} cleanup function
 */
export function attachMinimapTouchBridge(minimapEl) {
  function synthMouse(type, touch) {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
    });
  }

  let activeTouch = null;

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    activeTouch = e.touches[0];
    e.target.dispatchEvent(synthMouse('mousedown', activeTouch));
    e.preventDefault();
  }

  function onTouchMove(e) {
    if (!activeTouch) return;
    const t = e.touches[0];
    if (t) {

      // mousemove dispatched on document — that's where minimap binds it
      document.dispatchEvent(synthMouse('mousemove', t));
    }
    e.preventDefault();
  }

  function onTouchEnd(e) {
    if (!activeTouch) return;
    const t = e.changedTouches[0];
    if (t) {
      document.dispatchEvent(synthMouse('mouseup', t));
    }
    activeTouch = null;
  }

  const opts = { passive: false };
  minimapEl.addEventListener('touchstart', onTouchStart, opts);
  minimapEl.addEventListener('touchmove', onTouchMove, opts);
  minimapEl.addEventListener('touchend', onTouchEnd, opts);
  minimapEl.addEventListener('touchcancel', onTouchEnd, opts);

  return function cleanup() {
    minimapEl.removeEventListener('touchstart', onTouchStart, opts);
    minimapEl.removeEventListener('touchmove', onTouchMove, opts);
    minimapEl.removeEventListener('touchend', onTouchEnd, opts);
    minimapEl.removeEventListener('touchcancel', onTouchEnd, opts);
  };
}
