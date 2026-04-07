import { create as svgCreate, append as svgAppend, attr as svgAttr } from 'tiny-svg';

import { isTouchPrimaryDevice } from '../util/device.js';

/**
 * Safari iOS workaround: touchstart does not fire on empty SVG areas.
 *
 * Adding invisible 10x10 rects at far-off coordinates extends the SVG's
 * bounding box, which makes touchstart events fire reliably anywhere
 * inside the canvas. Two opposite corners (top-right and top-left at
 * y=10000) are sufficient to span the diagonal — additional rects would
 * be redundant. Ported from the old diagram-js TouchInteractionEvents.
 *
 * `_canvas` is injected (not used at runtime) so diagram-js eagerly
 * instantiates the Canvas service before this one — guarantees `canvas.init`
 * fires after our listener is registered.
 */

export default function TouchFix(_canvas, eventBus) {

  // Skip on mouse-primary devices — the workaround is iOS-specific.
  if (!isTouchPrimaryDevice()) return;

  eventBus.on('canvas.init', function(event) {
    const svg = event.svg;

    function addRect(x, y) {
      const rect = svgCreate('rect');
      svgAttr(rect, {
        x, y,
        width: 10,
        height: 10,
        fill: 'none',
        stroke: 'none',
        'pointer-events': 'all',
      });
      svgAppend(svg, rect);
    }

    addRect(-10000, 10000);
    addRect(10000, 10000);
  });
}

TouchFix.$inject = [ 'canvas', 'eventBus' ];
