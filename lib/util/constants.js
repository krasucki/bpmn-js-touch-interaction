/**
 * Plugin-wide constants. Hoisted from inline magic numbers for clarity.
 */

/** How long to suppress synthesized mouse events after a touch (ms). */
export const MOUSE_SUPPRESSION_MS = 500;

/** Event priority for tool-end interceptors — must run before tool handlers (default 1000). */
export const TOOL_EVENT_PRIORITY = 1500;

/** Pinch zoom bounds. Mirrors the old diagram-js TouchInteractionEvents module. */
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

/** Mouse events suppressed during touch (capture phase on canvas container). */
export const SUPPRESSED_MOUSE_EVENTS = [
  'mousedown',
  'mouseup',
  'mouseover',
  'mouseout',
  'click',
  'dblclick',
];

/**
 * Tool end events whose `originalEvent` (touchend with empty `touches`) gets
 * passed to subsequent `dragging.init` / `activate*` calls. Patched at high
 * priority to a synthetic TouchEvent with valid coordinates from `changedTouches`.
 */
export const PATCHED_TOOL_EVENTS = [
  'lasso.selection.end', // → activateLasso(event.originalEvent)
  'spaceTool.selection.end', // → activateMakeSpace(event.originalEvent)
  'spaceTool.ended', // → activateSelection(event.originalEvent) after make-space
];
