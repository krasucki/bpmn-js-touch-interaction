import { closest as domClosest } from 'min-dom';

/**
 * Single-gesture tool mode for connect / lasso / space.
 *
 * Desktop flow is: tap palette, tap canvas, drag, release. Three steps. That
 * two-step canvas/drag pattern does not translate to touch: for connect,
 * `hover.startTarget` updates as the finger moves, so on release `startTarget`
 * is the destination, not the source. For all three tools the "tap to confirm
 * start, then drag" desktop flow becomes a wasted tap on touch.
 *
 * Fix: replace each tool's `activateSelection` / `start` with a flag-setter
 * (`setActiveTool('connect' | 'lasso' | 'space')`). A capture-phase touchstart
 * handler on the canvas SVG then dispatches the touch directly to the real
 * `*.activate*` / `connect.start` method.
 *
 * Touch flow: tap palette, touch + drag + release. Two steps, single gesture.
 *
 * The context pad's "connect" entry knows the source up front (the element the
 * pad is open for). The caller passes it via `setActiveTool('connect', source)`
 * and the dispatcher skips touch-based element discovery.
 *
 * @param {Object} services — { canvas, palette, elementRegistry, rules, connect, lassoTool, spaceTool, globalConnect }
 * @returns {{ setActiveTool, isActive, getActiveTool, attachCanvasInterceptor }}
 */
export function createToolMode(services) {
  const { canvas, palette, elementRegistry, rules, connect, lassoTool, spaceTool, globalConnect } = services;

  let activeTool = null;
  let connectSource = null;

  // Maps internal tool name → palette entry id (sans `-tool` suffix that
  // diagram-js strips in updateToolHighlight).
  const TOOL_HIGHLIGHT = {
    connect: 'global-connect',
    lasso: 'lasso',
    space: 'space',
  };

  function setActiveTool(tool, source = null) {
    activeTool = tool;
    connectSource = source;
    if (palette && typeof palette.updateToolHighlight === 'function') {
      palette.updateToolHighlight(tool ? TOOL_HIGHLIGHT[tool] : '');
    }
    const container = canvas.getContainer();
    if (container) {
      container.classList.toggle('djs-touch-tool-active', !!tool);
    }
  }

  // Replace tool activation methods with flag-setters. The dispatcher will
  // call the real activation methods on the next canvas touch.
  // PATCH: globalConnect.start
  if (globalConnect && connect) {
    globalConnect.start = function() { setActiveTool('connect'); };
  }

  // PATCH: lassoTool.activateSelection
  if (lassoTool) {
    lassoTool.activateSelection = function() { setActiveTool('lasso'); };
  }

  // PATCH: spaceTool.activateSelection
  if (spaceTool) {
    spaceTool.activateSelection = function() { setActiveTool('space'); };
  }

  /**
   * Attach a capture-phase touchstart listener on the canvas SVG to dispatch
   * to the active tool's real activation method.
   *
   * @param {SVGElement} svg
   * @returns {() => void} cleanup
   */
  function attachCanvasInterceptor(svg) {
    function handleToolModeTouch(e) {
      if (!activeTool) return;
      if (e.touches.length !== 1) return;

      if (activeTool === 'connect') {
        let element = connectSource;
        if (!element) {

          // Palette flow: discover source from touch position
          const touch = e.touches[0];
          const target = document.elementFromPoint(touch.clientX, touch.clientY);
          if (!target) return;
          const gfx = domClosest(target, '.djs-element', true);
          if (!gfx) return;
          element = elementRegistry.get(gfx);
          if (!element || !element.parent) return; // skip root
          if (rules && !rules.allowed('connection.start', { source: element })) return;
        }
        setActiveTool(null);
        e.preventDefault();
        e.stopPropagation();
        connect.start(e, element);
      } else if (activeTool === 'lasso') {
        setActiveTool(null);
        e.preventDefault();
        e.stopPropagation();
        lassoTool.activateLasso(e, true);
      } else if (activeTool === 'space') {
        setActiveTool(null);
        e.preventDefault();
        e.stopPropagation();
        spaceTool.activateMakeSpace(e);
      }
    }
    svg.addEventListener('touchstart', handleToolModeTouch, { passive: false, capture: true });
    return () => svg.removeEventListener('touchstart', handleToolModeTouch, { capture: true });
  }

  return {
    setActiveTool,
    isActive: () => !!activeTool,
    getActiveTool: () => activeTool,
    attachCanvasInterceptor,
  };
}
