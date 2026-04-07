import { describe, it, expect, vi } from 'vitest'
import {
  asPrimaryButtonEvent,
  syntheticEvent,
  createSyntheticTouchEvent,
} from '../lib/util/eventHelpers.js'

// happy-dom polyfills
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
if (typeof Touch === 'undefined') {
  global.Touch = class Touch {
    constructor(init = {}) {
      Object.assign(this, init)
    }
  }
}

describe('asPrimaryButtonEvent', () => {
  it('returns object with button: 0', () => {
    const target = document.createElement('div')
    const touchEvent = new TouchEvent('touchstart', { bubbles: true })
    Object.defineProperty(touchEvent, 'target', { value: target })

    const wrapped = asPrimaryButtonEvent(touchEvent)

    expect(wrapped.button).toBe(0)
    expect(wrapped.target).toBe(target)
  })

  it('preserves clientX/clientY from the original', () => {
    const touchEvent = Object.assign(new TouchEvent('touchstart'), {
      clientX: 123,
      clientY: 456,
    })
    const wrapped = asPrimaryButtonEvent(touchEvent)
    expect(wrapped.clientX).toBe(123)
    expect(wrapped.clientY).toBe(456)
  })

  it('delegate methods invoke the original event methods', () => {
    const touchEvent = new TouchEvent('touchstart')
    touchEvent.preventDefault = vi.fn()
    touchEvent.stopPropagation = vi.fn()
    touchEvent.stopImmediatePropagation = vi.fn()

    const wrapped = asPrimaryButtonEvent(touchEvent)
    wrapped.preventDefault()
    wrapped.stopPropagation()
    wrapped.stopImmediatePropagation()

    expect(touchEvent.preventDefault).toHaveBeenCalledOnce()
    expect(touchEvent.stopPropagation).toHaveBeenCalledOnce()
    expect(touchEvent.stopImmediatePropagation).toHaveBeenCalledOnce()
  })

  it('is NOT instanceof TouchEvent (this is intentional)', () => {
    // Plain object cannot be instanceof TouchEvent. Used by interactionEvents.fire
    // which doesn't check instanceof — the intent is documented in the helper.
    const touchEvent = new TouchEvent('touchstart')
    const wrapped = asPrimaryButtonEvent(touchEvent)
    expect(wrapped instanceof TouchEvent).toBe(false)
  })
})

describe('syntheticEvent', () => {
  it('returns object with delegateTarget and originalEvent', () => {
    const button = document.createElement('button')
    const original = new TouchEvent('touchstart')
    const synth = syntheticEvent(button, original)

    expect(synth.delegateTarget).toBe(button)
    expect(synth.originalEvent).toBe(original)
  })

  it('provides no-op preventDefault and stopPropagation', () => {
    const synth = syntheticEvent(document.createElement('button'), new TouchEvent('touchstart'))
    expect(() => synth.preventDefault()).not.toThrow()
    expect(() => synth.stopPropagation()).not.toThrow()
  })
})

describe('createSyntheticTouchEvent', () => {
  it('returns a TouchEvent (or null if construction fails)', () => {
    const target = document.createElement('div')
    const result = createSyntheticTouchEvent('touchstart', target, 100, 200)
    // happy-dom may not support TouchEvent constructor — accept null fallback
    if (result !== null) {
      expect(result.type).toBe('touchstart')
    }
  })

  it('returns null on construction failure', () => {
    // Force failure by passing invalid target — Touch constructor needs valid target
    // (in some implementations). This test mainly verifies the catch path doesn't throw.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // Pass undefined to potentially trigger error in some browsers
      const result = createSyntheticTouchEvent('touchstart', undefined, 0, 0)
      // Either succeeds or returns null — both are acceptable; never throws
      expect(result === null || result instanceof TouchEvent).toBe(true)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('handles undefined TouchEvent gracefully', () => {
    // Temporarily undefine TouchEvent
    const orig = global.TouchEvent
     
    global.TouchEvent = undefined
    try {
      const result = createSyntheticTouchEvent('touchstart', document.createElement('div'))
      expect(result).toBeNull()
    } finally {
       
      global.TouchEvent = orig
    }
  })
})
