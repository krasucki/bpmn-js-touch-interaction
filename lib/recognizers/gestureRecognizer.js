const STATES = {
  IDLE: 'IDLE',
  TOUCH_START: 'TOUCH_START',
  PAN: 'PAN',
  PRESS: 'PRESS',
  PINCH: 'PINCH',
};

export function createGestureRecognizer(element, {
  onTap, onDoubleTap, onPanStart, onPanMove, onPanEnd,
  onPinchStart, onPinchMove, onPinchEnd, onPress,
  tapThreshold = 10, panThreshold = 10,
  doubleTapWindow = 300, pressDelay = 300,
} = {}) {

  let state = STATES.IDLE;
  let startTouch = null; // { x, y, time, target, id }
  let pressTimer = null;
  let lastTapTime = 0;
  let lastTapCenter = null;

  // Pinch state
  let pinchStartDist = 0;

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function clearPress() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function getTouch(e, id) {
    for (const t of e.changedTouches) {
      if (t.identifier === id) return t;
    }
    return null;
  }

  function handleTouchStart(e) {
    const touches = e.touches;

    if (touches.length === 2 && state !== STATES.PINCH) {
      clearPress();

      // End active pan before entering pinch — prevents panActive staying true
      if (state === STATES.PAN) {
        onPanEnd?.({ originalEvent: e });
      }
      const t0 = touches[0], t1 = touches[1];
      const a = { x: t0.clientX, y: t0.clientY };
      const b = { x: t1.clientX, y: t1.clientY };
      pinchStartDist = dist(a, b);
      state = STATES.PINCH;
      const center = midpoint(a, b);
      onPinchStart?.({
        center,
        scale: 1,
        originalEvent: e,
      });
      e.preventDefault();
      return;
    }

    // Reset stuck state: if a drag system (e.g. diagram-js Dragging) consumed
    // touchend via stopPropagation in capture phase, we never received it and
    // are stuck in PAN/PRESS. A new touchstart means the previous gesture is over.
    if (touches.length === 1 && state !== STATES.IDLE && state !== STATES.PINCH) {
      clearPress();
      state = STATES.IDLE;
      startTouch = null;
    }

    if (touches.length !== 1 || state !== STATES.IDLE) return;

    const t = touches[0];
    startTouch = {
      x: t.clientX,
      y: t.clientY,
      time: Date.now(),
      target: t.target,
      id: t.identifier,
      event: e, // preserve touchstart — touchend has no coordinates for toPoint()
    };

    state = STATES.TOUCH_START;
    pressTimer = setTimeout(() => {
      if (state === STATES.TOUCH_START) {
        state = STATES.PRESS;
        onPress?.({
          center: { x: startTouch.x, y: startTouch.y },
          target: startTouch.target,
          originalEvent: e,
        });
      }
    }, pressDelay);

    e.preventDefault();
  }

  function handleTouchMove(e) {
    if (state === STATES.PINCH) {
      if (e.touches.length < 2) return;
      const t0 = e.touches[0], t1 = e.touches[1];
      const a = { x: t0.clientX, y: t0.clientY };
      const b = { x: t1.clientX, y: t1.clientY };
      const currentDist = dist(a, b);
      const scale = pinchStartDist > 0 ? currentDist / pinchStartDist : 1;
      const center = midpoint(a, b);
      onPinchMove?.({
        center,
        scale,
        originalEvent: e,
      });
      e.preventDefault();
      return;
    }

    if (!startTouch) return;
    const t = getTouch(e, startTouch.id);
    if (!t) return;

    const dx = t.clientX - startTouch.x;
    const dy = t.clientY - startTouch.y;
    const moved = Math.sqrt(dx * dx + dy * dy);

    if (state === STATES.TOUCH_START && moved > panThreshold) {
      clearPress();
      state = STATES.PAN;
      onPanStart?.({
        center: { x: startTouch.x, y: startTouch.y },
        target: startTouch.target,
        originalEvent: e,
      });
    }

    if (state === STATES.PRESS && moved > panThreshold) {
      state = STATES.PAN;
      onPanStart?.({
        center: { x: startTouch.x, y: startTouch.y },
        target: startTouch.target,
        originalEvent: e,
      });
    }

    if (state === STATES.PAN) {
      onPanMove?.({
        center: { x: t.clientX, y: t.clientY },
        deltaX: dx,
        deltaY: dy,
        target: startTouch.target,
        originalEvent: e,
      });
      e.preventDefault();
    }
  }

  function handleTouchEnd(e) {

    // First touchend during pinch ends the entire gesture (even if one finger remains).
    // The remaining finger's touchend will arrive with state=IDLE and no-op.
    if (state === STATES.PINCH) {
      onPinchEnd?.({ originalEvent: e });
      pinchStartDist = 0;
      state = STATES.IDLE;
      startTouch = null;
      return;
    }

    clearPress();

    if (state === STATES.TOUCH_START || state === STATES.PRESS) {
      const center = { x: startTouch.x, y: startTouch.y };
      const target = startTouch.target;

      // Use touchstart event, not touchend — touchend.touches is empty so
      // toPoint() in diagram-js can't extract coordinates, producing NaN.
      const originalEvent = startTouch.event;

      // Check for double-tap
      const now = Date.now();
      if (lastTapTime && (now - lastTapTime) < doubleTapWindow && lastTapCenter &&
          dist(center, lastTapCenter) < tapThreshold) {
        onDoubleTap?.({ center, target, originalEvent });
        lastTapTime = 0;
        lastTapCenter = null;
      } else {
        onTap?.({ center, target, originalEvent });
        lastTapTime = now;
        lastTapCenter = center;
      }
    }

    if (state === STATES.PAN) {
      onPanEnd?.({ originalEvent: e });
    }

    state = STATES.IDLE;
    startTouch = null;
  }

  function handleTouchCancel(e) {
    clearPress();
    if (state === STATES.PAN) {
      onPanEnd?.({ originalEvent: e });
    }
    if (state === STATES.PINCH) {
      onPinchEnd?.({ originalEvent: e });
    }
    state = STATES.IDLE;
    startTouch = null;
    pinchStartDist = 0;
  }

  const opts = { passive: false };
  element.addEventListener('touchstart', handleTouchStart, opts);
  element.addEventListener('touchmove', handleTouchMove, opts);
  element.addEventListener('touchend', handleTouchEnd, opts);
  element.addEventListener('touchcancel', handleTouchCancel, opts);

  return function cleanup() {
    clearPress();
    element.removeEventListener('touchstart', handleTouchStart, opts);
    element.removeEventListener('touchmove', handleTouchMove, opts);
    element.removeEventListener('touchend', handleTouchEnd, opts);
    element.removeEventListener('touchcancel', handleTouchCancel, opts);
  };
}
