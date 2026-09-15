import { describe, it, expect, beforeEach } from 'vitest'
import { forgetOnboarded, rememberOnboarded, wasOnboardedHere } from './onboarded'

// The gate's per-device memory (stores/onboarded.js): who it has
// already let through, and so who it may fail open for.
describe('stores/onboarded', () => {
  beforeEach(() => { window.localStorage.removeItem('jp-onboarded') })

  it('knows nobody until told', () => {
    expect(wasOnboardedHere('u1')).toBe(false)
    expect(wasOnboardedHere(null)).toBe(false)
    expect(wasOnboardedHere(undefined)).toBe(false)
  })

  it('remembers an id, and only that id', () => {
    rememberOnboarded('u1')
    expect(wasOnboardedHere('u1')).toBe(true)
    expect(wasOnboardedHere('u2')).toBe(false)
  })

  it('survives a reload: the note is in localStorage', () => {
    rememberOnboarded('u1')
    expect(JSON.parse(window.localStorage.getItem('jp-onboarded'))).toEqual(['u1'])
  })

  it('forgets on request and clears the key when nobody is left', () => {
    rememberOnboarded('u1')
    rememberOnboarded('u2')
    forgetOnboarded('u1')
    expect(wasOnboardedHere('u1')).toBe(false)
    expect(wasOnboardedHere('u2')).toBe(true)
    forgetOnboarded('u2')
    expect(window.localStorage.getItem('jp-onboarded')).toBeNull()
  })

  it('ignores a null id and a value it cannot read', () => {
    rememberOnboarded(null)
    expect(window.localStorage.getItem('jp-onboarded')).toBeNull()
    window.localStorage.setItem('jp-onboarded', '{not json')
    expect(wasOnboardedHere('u1')).toBe(false)
    rememberOnboarded('u1')
    expect(wasOnboardedHere('u1')).toBe(true)
  })

  it('keeps the most recent ids and caps the list', () => {
    for (let i = 0; i < 12; i++) rememberOnboarded(`u${i}`)
    const ids = JSON.parse(window.localStorage.getItem('jp-onboarded'))
    expect(ids.length).toBe(8)
    expect(ids[0]).toBe('u11')
    expect(wasOnboardedHere('u0')).toBe(false)
  })
})
