import { closest as domClosest } from 'min-dom';

import { createGestureRecognizer } from './gestureRecognizer.js';
import { syntheticEvent } from '../util/eventHelpers.js';

/**
 * Create a gesture recognizer for a "button surface" (palette or context pad).
 *
 * Both surfaces share the same touch flow:
 *   - tap → trigger('click', synthEvent) on the entry under the finger
 *   - pan/press → trigger('dragstart', synthEvent, true) on the entry
 *
 * The `onTapExtra` hook lets the caller intercept the tap before the default
 * `trigger('click')` runs (used by context pad to short-circuit the connect
 * entry into single-gesture mode).
 *
 * @param {Element} container
 * @param {{ trigger: Function }} service — palette or contextPad
 * @param {{ onTapExtra?: (button: Element, originalEvent: TouchEvent) => boolean, onTouch: () => void }} hooks
 *   - onTapExtra: return true to skip default trigger('click') (handled the tap yourself)
 *   - onTouch: called whenever any tap/pan/press fires (for mouse suppression)
 * @returns {() => void} cleanup
 */
export function createButtonRecognizer(container, service, hooks = {}) {
  const { onTapExtra, onTouch } = hooks;

  return createGestureRecognizer(container, {
    onTap({ target, originalEvent }) {
      onTouch?.();
      const button = domClosest(target, '[data-action]', true);
      if (!button) return;
      if (onTapExtra && onTapExtra(button, originalEvent) === true) return;
      service.trigger('click', syntheticEvent(button, originalEvent));
    },

    onPanStart({ target, originalEvent }) {
      onTouch?.();
      const button = domClosest(target, '[data-action]', true);
      if (button) {
        service.trigger('dragstart', syntheticEvent(button, originalEvent), true);
      }
    },

    onPress({ target, originalEvent }) {
      onTouch?.();
      const button = domClosest(target, '[data-action]', true);
      if (button) {
        service.trigger('dragstart', syntheticEvent(button, originalEvent), true);
      }
    },
  });
}
