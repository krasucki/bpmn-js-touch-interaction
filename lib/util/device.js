/**
 * Detect whether the current device uses touch as its primary input.
 *
 * Uses the `(pointer: coarse)` media query, which is the standard CSS-spec
 * way to detect "primary input is coarse" (touch). This correctly handles:
 *
 *   - Mobile phones / tablets → true (primary input is touch)
 *   - Desktop with mouse → false
 *   - Laptops with touchscreen + trackpad → false (primary is the trackpad,
 *     not touch — we don't want to break mouse interactions)
 *   - iPad with attached keyboard/mouse → still true (primary is the screen)
 *
 * The plugin's monkey-patches REPLACE several diagram-js methods (e.g.
 * globalConnect.start, lassoTool.activateSelection) with touch-only flag-setters.
 * Activating those on a mouse-primary device would break the mouse tool flow.
 * Returning false here causes services to early-return without patching anything.
 *
 * @returns {boolean}
 */
export function isTouchPrimaryDevice() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
