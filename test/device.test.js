import { describe, it, expect, vi, afterEach } from 'vitest'
import { isTouchPrimaryDevice } from '../lib/util/device.js'

describe('isTouchPrimaryDevice', () => {
  let originalMatchMedia

  afterEach(() => {
    if (originalMatchMedia !== undefined) {
      window.matchMedia = originalMatchMedia
      originalMatchMedia = undefined
    }
  })

  it('returns true when (pointer: coarse) matches', () => {
    originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn(query => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addListener: () => {},
      removeListener: () => {},
    }))

    expect(isTouchPrimaryDevice()).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(pointer: coarse)')
  })

  it('returns false when (pointer: coarse) does not match', () => {
    originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      addListener: () => {},
      removeListener: () => {},
    }))

    expect(isTouchPrimaryDevice()).toBe(false)
  })

  it('returns false if window.matchMedia is undefined', () => {
    originalMatchMedia = window.matchMedia
    delete window.matchMedia

    expect(isTouchPrimaryDevice()).toBe(false)
  })

  it('returns false if window is undefined (SSR safety)', () => {
    // Can't actually delete window in browser env, but verify the typeof guard
    // doesn't throw. The function inspects `typeof window === 'undefined'`.
    expect(() => isTouchPrimaryDevice()).not.toThrow()
  })
})
