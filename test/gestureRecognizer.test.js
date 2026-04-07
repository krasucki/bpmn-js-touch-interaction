import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGestureRecognizer } from '../lib/recognizers/gestureRecognizer.js'

// happy-dom may not support TouchEvent — polyfill if missing
if (typeof TouchEvent === 'undefined') {
  global.TouchEvent = class TouchEvent extends Event {
    constructor(type, init = {}) {
      super(type, init)
      this.touches = init.touches || []
      this.changedTouches = init.changedTouches || []
      this.targetTouches = init.targetTouches || []
    }
  }
}

function touchEvent(type, touches, target) {
  const changedTouches = touches.map(t => ({
    identifier: t.id ?? 0,
    clientX: t.x ?? 0,
    clientY: t.y ?? 0,
    target: target,
  }))
  const allTouches = type === 'touchend' || type === 'touchcancel' ? [] : changedTouches
  return new TouchEvent(type, {
    touches: allTouches,
    changedTouches,
    cancelable: true,
    bubbles: true,
  })
}

describe('gestureRecognizer', () => {
  let el
  let callbacks

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    el = document.createElement('div')
    document.body.appendChild(el)
    callbacks = {
      onTap: vi.fn(),
      onDoubleTap: vi.fn(),
      onPanStart: vi.fn(),
      onPanMove: vi.fn(),
      onPanEnd: vi.fn(),
      onPinchStart: vi.fn(),
      onPinchMove: vi.fn(),
      onPinchEnd: vi.fn(),
      onPress: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.removeChild(el)
  })

  // === TAP ===
  describe('tap', () => {
    it('fires on quick touch-and-release', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 200 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 100, y: 200 }], el))

      expect(callbacks.onTap).toHaveBeenCalledOnce()
      expect(callbacks.onTap.mock.calls[0][0].center).toEqual({ x: 100, y: 200 })
      cleanup()
    })

    it('includes target in event', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 50, y: 50 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 50, y: 50 }], el))

      expect(callbacks.onTap.mock.calls[0][0].target).toBe(el)
      cleanup()
    })

    it('does not fire if movement exceeds threshold (becomes pan)', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 10 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 20, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 20, y: 0 }], el))

      expect(callbacks.onTap).not.toHaveBeenCalled()
      expect(callbacks.onPanStart).toHaveBeenCalledOnce()
      cleanup()
    })

    it('fires tap (not press) when released after press delay', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, pressDelay: 300 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 10, y: 10 }], el))
      vi.advanceTimersByTime(350)
      expect(callbacks.onPress).toHaveBeenCalledOnce()

      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 10, y: 10 }], el))
      // After press, touchend still fires tap
      expect(callbacks.onTap).toHaveBeenCalledOnce()
      cleanup()
    })
  })

  // === PAN ===
  describe('pan', () => {
    it('fires onPanStart and onPanMove when movement exceeds threshold', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 10 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 115, y: 100 }], el))

      expect(callbacks.onPanStart).toHaveBeenCalledOnce()
      expect(callbacks.onPanStart.mock.calls[0][0].center).toEqual({ x: 100, y: 100 })

      expect(callbacks.onPanMove).toHaveBeenCalledOnce()
      expect(callbacks.onPanMove.mock.calls[0][0].deltaX).toBe(15)
      expect(callbacks.onPanMove.mock.calls[0][0].deltaY).toBe(0)
      cleanup()
    })

    it('fires onPanEnd on touchend', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 5 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 50, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 50, y: 0 }], el))

      expect(callbacks.onPanEnd).toHaveBeenCalledOnce()
      cleanup()
    })

    it('does not fire pan if movement is below threshold', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 10 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 5, y: 0 }], el))

      expect(callbacks.onPanStart).not.toHaveBeenCalled()
      expect(callbacks.onPanMove).not.toHaveBeenCalled()
      cleanup()
    })

    it('transitions to pan from press when movement exceeds threshold', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 10, pressDelay: 300 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      vi.advanceTimersByTime(350) // enter PRESS state
      expect(callbacks.onPress).toHaveBeenCalledOnce()

      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 30, y: 0 }], el))
      expect(callbacks.onPanStart).toHaveBeenCalledOnce()
      expect(callbacks.onPanMove).toHaveBeenCalledOnce()
      cleanup()
    })
  })

  // === PINCH ===
  describe('pinch', () => {
    it('fires onPinchStart with center and scale=1 on two-finger touchstart', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      // Two-finger touchstart: need touches with 2 entries
      const e = new TouchEvent('touchstart', {
        touches: [
          { identifier: 0, clientX: 100, clientY: 100, target: el },
          { identifier: 1, clientX: 200, clientY: 100, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 100, clientY: 100, target: el },
          { identifier: 1, clientX: 200, clientY: 100, target: el },
        ],
        cancelable: true,
        bubbles: true,
      })
      el.dispatchEvent(e)

      expect(callbacks.onPinchStart).toHaveBeenCalledOnce()
      expect(callbacks.onPinchStart.mock.calls[0][0].scale).toBe(1)
      expect(callbacks.onPinchStart.mock.calls[0][0].center).toEqual({ x: 150, y: 100 })
      cleanup()
    })

    it('fires onPinchMove with correct cumulative scale', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      // Start pinch with distance = 100
      el.dispatchEvent(new TouchEvent('touchstart', {
        touches: [
          { identifier: 0, clientX: 100, clientY: 0, target: el },
          { identifier: 1, clientX: 200, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 100, clientY: 0, target: el },
          { identifier: 1, clientX: 200, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      // Move to distance = 200 → scale = 2
      el.dispatchEvent(new TouchEvent('touchmove', {
        touches: [
          { identifier: 0, clientX: 50, clientY: 0, target: el },
          { identifier: 1, clientX: 250, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 50, clientY: 0, target: el },
          { identifier: 1, clientX: 250, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      expect(callbacks.onPinchMove).toHaveBeenCalledOnce()
      expect(callbacks.onPinchMove.mock.calls[0][0].scale).toBe(2)
      expect(callbacks.onPinchMove.mock.calls[0][0].center).toEqual({ x: 150, y: 0 })
      cleanup()
    })

    it('fires onPinchEnd on touchend', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      el.dispatchEvent(new TouchEvent('touchstart', {
        touches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 100, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 100, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 0, y: 0 }], el))

      expect(callbacks.onPinchEnd).toHaveBeenCalledOnce()
      cleanup()
    })

    it('cumulative scale across successive moves', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      // Start pinch: distance = 100
      el.dispatchEvent(new TouchEvent('touchstart', {
        touches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 100, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 100, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      // Move 1: distance = 150 → scale = 1.5
      el.dispatchEvent(new TouchEvent('touchmove', {
        touches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 150, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 150, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      // Move 2: distance = 200 → scale = 2.0 (still relative to initial 100)
      el.dispatchEvent(new TouchEvent('touchmove', {
        touches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 200, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 200, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      expect(callbacks.onPinchMove).toHaveBeenCalledTimes(2)
      expect(callbacks.onPinchMove.mock.calls[0][0].scale).toBe(1.5)
      expect(callbacks.onPinchMove.mock.calls[1][0].scale).toBe(2)
      cleanup()
    })
  })

  // === DOUBLE-TAP ===
  describe('double-tap', () => {
    it('fires on second tap within doubleTapWindow', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, doubleTapWindow: 300 })

      // First tap
      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 100, y: 100 }], el))
      expect(callbacks.onTap).toHaveBeenCalledOnce()

      // Second tap within window
      vi.advanceTimersByTime(100)
      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 100, y: 100 }], el))

      expect(callbacks.onDoubleTap).toHaveBeenCalledOnce()
      expect(callbacks.onDoubleTap.mock.calls[0][0].center).toEqual({ x: 100, y: 100 })
      // Second tap should not also fire onTap
      expect(callbacks.onTap).toHaveBeenCalledOnce()
      cleanup()
    })

    it('does not fire if taps are too far apart in distance', () => {
      const cleanup = createGestureRecognizer(el, {
        ...callbacks, doubleTapWindow: 300, tapThreshold: 10,
      })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 0, y: 0 }], el))

      vi.advanceTimersByTime(50)

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 50, y: 50 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 50, y: 50 }], el))

      expect(callbacks.onDoubleTap).not.toHaveBeenCalled()
      expect(callbacks.onTap).toHaveBeenCalledTimes(2)
      cleanup()
    })

    it('does not fire if taps are too slow (outside doubleTapWindow)', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, doubleTapWindow: 300 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 100, y: 100 }], el))

      vi.advanceTimersByTime(400)

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 100, y: 100 }], el))

      expect(callbacks.onDoubleTap).not.toHaveBeenCalled()
      expect(callbacks.onTap).toHaveBeenCalledTimes(2)
      cleanup()
    })
  })

  // === CLEANUP ===
  describe('cleanup', () => {
    it('removes all listeners so no callbacks fire after cleanup', () => {
      const cleanup = createGestureRecognizer(el, callbacks)
      cleanup()

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 0, y: 0 }], el))

      expect(callbacks.onTap).not.toHaveBeenCalled()
      expect(callbacks.onPanStart).not.toHaveBeenCalled()
      expect(callbacks.onPress).not.toHaveBeenCalled()
    })
  })

  // === TOUCHCANCEL ===
  describe('touchcancel', () => {
    it('resets state and fires onPanEnd during pan', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 5 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 30, y: 0 }], el))
      expect(callbacks.onPanStart).toHaveBeenCalledOnce()

      el.dispatchEvent(touchEvent('touchcancel', [{ id: 0, x: 30, y: 0 }], el))
      expect(callbacks.onPanEnd).toHaveBeenCalledOnce()
      cleanup()
    })

    it('allows new gestures after cancel', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 5 })

      // Start a pan then cancel
      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 30, y: 0 }], el))
      el.dispatchEvent(touchEvent('touchcancel', [{ id: 0, x: 30, y: 0 }], el))

      // New gesture should work
      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 10, y: 10 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 10, y: 10 }], el))

      expect(callbacks.onTap).toHaveBeenCalledOnce()
      cleanup()
    })

    it('fires onPinchEnd during pinch cancel', () => {
      const cleanup = createGestureRecognizer(el, callbacks)

      el.dispatchEvent(new TouchEvent('touchstart', {
        touches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 100, clientY: 0, target: el },
        ],
        changedTouches: [
          { identifier: 0, clientX: 0, clientY: 0, target: el },
          { identifier: 1, clientX: 100, clientY: 0, target: el },
        ],
        cancelable: true, bubbles: true,
      }))

      el.dispatchEvent(touchEvent('touchcancel', [{ id: 0, x: 0, y: 0 }], el))
      expect(callbacks.onPinchEnd).toHaveBeenCalledOnce()
      cleanup()
    })
  })

  // === PRESS ===
  describe('press', () => {
    it('fires after pressDelay with no movement', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, pressDelay: 300 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 50, y: 60 }], el))
      vi.advanceTimersByTime(350)

      expect(callbacks.onPress).toHaveBeenCalledOnce()
      expect(callbacks.onPress.mock.calls[0][0].center).toEqual({ x: 50, y: 60 })
      expect(callbacks.onPress.mock.calls[0][0].target).toBe(el)
      cleanup()
    })

    it('does not fire if touch moves before delay', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, pressDelay: 300, panThreshold: 10 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      vi.advanceTimersByTime(100)
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 30, y: 0 }], el))
      vi.advanceTimersByTime(300)

      expect(callbacks.onPress).not.toHaveBeenCalled()
      expect(callbacks.onPanStart).toHaveBeenCalledOnce()
      cleanup()
    })

    it('does not fire if touch ends before delay', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, pressDelay: 300 })

      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 0, y: 0 }], el))
      vi.advanceTimersByTime(100)
      el.dispatchEvent(touchEvent('touchend', [{ id: 0, x: 0, y: 0 }], el))
      vi.advanceTimersByTime(300)

      expect(callbacks.onPress).not.toHaveBeenCalled()
      expect(callbacks.onTap).toHaveBeenCalledOnce()
      cleanup()
    })
  })

  // === STUCK STATE RECOVERY ===
  describe('stuck state recovery', () => {
    it('recovers from PAN state if touchend was consumed by external system', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, panThreshold: 10 })

      // Start a pan gesture
      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      el.dispatchEvent(touchEvent('touchmove', [{ id: 0, x: 120, y: 100 }], el))
      expect(callbacks.onPanStart).toHaveBeenCalledOnce()

      // Simulate: external drag system consumed touchend via stopPropagation
      // (we never receive touchend, recognizer stuck in PAN)

      // New touchstart should reset and work
      el.dispatchEvent(touchEvent('touchstart', [{ id: 1, x: 50, y: 50 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 1, x: 50, y: 50 }], el))

      expect(callbacks.onTap).toHaveBeenCalledOnce()
      cleanup()
    })

    it('recovers from PRESS state if touchend was consumed', () => {
      const cleanup = createGestureRecognizer(el, { ...callbacks, pressDelay: 300 })

      // Enter PRESS state
      el.dispatchEvent(touchEvent('touchstart', [{ id: 0, x: 100, y: 100 }], el))
      vi.advanceTimersByTime(350)
      expect(callbacks.onPress).toHaveBeenCalledOnce()

      // Simulate: touchend consumed by external system
      // New touchstart should reset and work
      el.dispatchEvent(touchEvent('touchstart', [{ id: 1, x: 50, y: 50 }], el))
      el.dispatchEvent(touchEvent('touchend', [{ id: 1, x: 50, y: 50 }], el))

      expect(callbacks.onTap).toHaveBeenCalledOnce()
      cleanup()
    })
  })
})
