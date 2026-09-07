import { describe, it, expect, vi } from 'vitest'
import { swUpdate } from './swUpdate'

describe('swUpdate', () => {
  it('applies the offered worker exactly once and clears the offer', () => {
    const apply = vi.fn()
    swUpdate.offer(apply)
    swUpdate.apply()
    swUpdate.apply()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('a dismissed offer does not reload on a later apply', () => {
    const apply = vi.fn()
    swUpdate.offer(apply)
    swUpdate.dismiss()
    swUpdate.apply()
    expect(apply).not.toHaveBeenCalled()
  })
})
