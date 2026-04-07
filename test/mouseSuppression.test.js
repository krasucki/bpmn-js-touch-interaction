import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMouseSuppression } from '../lib/patches/mouseSuppression.js'
import { SUPPRESSED_MOUSE_EVENTS } from '../lib/util/constants.js'

describe('createMouseSuppression', () => {
  let container
  let getContainer

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    getContainer = () => container
    vi.useFakeTimers()
  })

  afterEach(() => {
    container.remove()
    vi.useRealTimers()
  })

  it('blocks click events when started', () => {
    const suppression = createMouseSuppression(getContainer)
    const innerHandler = vi.fn()

    container.addEventListener('click', innerHandler)
    suppression.start()

    container.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(innerHandler).not.toHaveBeenCalled()
  })

  it('does not block events before start', () => {
    createMouseSuppression(getContainer)
    const handler = vi.fn()
    container.addEventListener('click', handler)
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('end() removes the listeners and unblocks events', () => {
    const suppression = createMouseSuppression(getContainer)
    const handler = vi.fn()
    container.addEventListener('click', handler)

    suppression.start()
    suppression.end()

    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('schedule() calls end() after the timeout', () => {
    const suppression = createMouseSuppression(getContainer)
    const handler = vi.fn()
    container.addEventListener('click', handler)

    suppression.start()
    suppression.schedule()
    vi.advanceTimersByTime(600)

    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('schedule() resets the timer on each call', () => {
    const suppression = createMouseSuppression(getContainer)
    const handler = vi.fn()
    container.addEventListener('click', handler)

    suppression.start()
    suppression.schedule()
    vi.advanceTimersByTime(300)
    suppression.schedule() // reset
    vi.advanceTimersByTime(300)

    // Total elapsed: 600ms, but second schedule reset → only 300ms since last
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300) // now 600ms since last schedule
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('start() is idempotent — multiple calls do not double-bind', () => {
    const suppression = createMouseSuppression(getContainer)
    suppression.start()
    suppression.start()
    suppression.end()
    // After end(), no more suppression — handler should fire
    const handler = vi.fn()
    container.addEventListener('click', handler)
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('destroy() clears timers and ends suppression', () => {
    const suppression = createMouseSuppression(getContainer)
    suppression.start()
    suppression.schedule()
    suppression.destroy()
    // No timers left, no listeners — events flow normally
    const handler = vi.fn()
    container.addEventListener('click', handler)
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('handles missing container gracefully', () => {
    const suppression = createMouseSuppression(() => null)
    expect(() => suppression.start()).not.toThrow()
    expect(() => suppression.end()).not.toThrow()
  })

  it('blocks all suppressed mouse event types', () => {
    const suppression = createMouseSuppression(getContainer)
    const handlers = SUPPRESSED_MOUSE_EVENTS.map(type => {
      const h = vi.fn()
      container.addEventListener(type, h)
      return { type, handler: h }
    })

    suppression.start()

    handlers.forEach(({ type }) => {
      container.dispatchEvent(new MouseEvent(type, { bubbles: true }))
    })

    handlers.forEach(({ handler }) => {
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
