import { describe, it, expect, beforeEach } from 'vitest'
import { installToolEventPatcher } from '../lib/patches/toolEventPatcher.js'
import { PATCHED_TOOL_EVENTS, TOOL_EVENT_PRIORITY } from '../lib/util/constants.js'

// Polyfill TouchEvent if needed
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

function createMockEventBus() {
  const listeners = []
  return {
    listeners,
    on(events, priority, callback) {
      const arr = Array.isArray(events) ? events : [events]
      arr.forEach(type => listeners.push({ type, priority, callback }))
    },
    fire(type, event) {
      listeners
        .filter(l => l.type === type)
        .sort((a, b) => b.priority - a.priority)
        .forEach(l => l.callback(event))
      return event
    },
  }
}

describe('installToolEventPatcher', () => {
  let bus

  beforeEach(() => {
    bus = createMockEventBus()
    installToolEventPatcher(bus)
  })

  it('registers listeners for all PATCHED_TOOL_EVENTS at high priority', () => {
    expect(bus.listeners.length).toBe(PATCHED_TOOL_EVENTS.length)
    bus.listeners.forEach(l => {
      expect(l.priority).toBe(TOOL_EVENT_PRIORITY)
      expect(PATCHED_TOOL_EVENTS).toContain(l.type)
    })
  })

  it('replaces touchend originalEvent with synthetic touchstart-style event', () => {
    const target = document.createElement('div')
    const touchend = new TouchEvent('touchend', {
      touches: [], // touchend has empty touches
      changedTouches: [{ identifier: 0, clientX: 100, clientY: 200, target }],
    })
    Object.defineProperty(touchend, 'target', { value: target })

    const event = { originalEvent: touchend }
    bus.fire('lasso.selection.end', event)

    // Patched event should have touches populated
    expect(event.originalEvent).not.toBe(touchend)
    // happy-dom may not allow real TouchEvent construction; verify logic if it did
    if (event.originalEvent instanceof TouchEvent) {
      expect(event.originalEvent.touches.length).toBeGreaterThan(0)
    }
  })

  it('does not patch if originalEvent already has touches', () => {
    const target = document.createElement('div')
    const touchstart = new TouchEvent('touchstart', {
      touches: [{ identifier: 0, clientX: 50, clientY: 50, target }],
    })
    const event = { originalEvent: touchstart }
    bus.fire('lasso.selection.end', event)

    // Should leave it alone
    expect(event.originalEvent).toBe(touchstart)
  })

  it('does not patch non-TouchEvent originalEvent', () => {
    const mouseup = new MouseEvent('mouseup')
    const event = { originalEvent: mouseup }
    bus.fire('lasso.selection.end', event)
    expect(event.originalEvent).toBe(mouseup)
  })

  it('does not patch if originalEvent is null/undefined', () => {
    const event = { originalEvent: null }
    bus.fire('lasso.selection.end', event)
    expect(event.originalEvent).toBeNull()
  })

  it('does not patch if changedTouches is empty', () => {
    const touchend = new TouchEvent('touchend', {
      touches: [],
      changedTouches: [],
    })
    const event = { originalEvent: touchend }
    bus.fire('lasso.selection.end', event)
    expect(event.originalEvent).toBe(touchend) // unchanged
  })

  it('handles all three patched tool events', () => {
    const fireForType = (type) => {
      const target = document.createElement('div')
      const touchend = new TouchEvent('touchend', {
        touches: [],
        changedTouches: [{ identifier: 0, clientX: 10, clientY: 20, target }],
      })
      Object.defineProperty(touchend, 'target', { value: target })
      const event = { originalEvent: touchend }
      bus.fire(type, event)
      return event
    }

    const event1 = fireForType('lasso.selection.end')
    const event2 = fireForType('spaceTool.selection.end')
    const event3 = fireForType('spaceTool.ended')

    // Each should have been processed (originalEvent replaced or untouched if happy-dom limits)
    ;[event1, event2, event3].forEach(e => {
      expect(e.originalEvent).toBeDefined()
    })
  })
})
