import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import DUEL from './lib/audio/duel.json'
import { layerOf, nextOn } from './lib/audio/duel'
import { SPRINT_MS } from './domain/duel'

// ── 対戦の曲 — the duel's music and sounds (plan 285) ────────────────
// Drawn ahead of time (scripts/duel-music/build.mjs) into
// public/sounds/duel/<rev>/ and played by lib/audio/duel.js on the
// run's clock. Written apart, held together here: every file the player
// asks for is on disk at the revision it asks for, nothing stale beside
// them, and the music is scored to the sprint the server runs -- its
// bars end on 0:00, its rush is the server's rush, its layers turn on at
// the server's tiers.

const ROOT = new URL('../public/sounds/duel/', import.meta.url)
const read = path => readFileSync(new URL(path, new URL('../', import.meta.url)), 'utf8')
const constant = (file, name) => read(`../backend/${file}`).match(new RegExp(`^${name} = (.+)$`, 'm'))?.[1]
const int = v => Number(String(v).replace(/_/g, ''))
const MUSIC = [...DUEL.layers, 'rush', 'final', 'result']

describe('the duel’s music and sounds', () => {
  it('has every file the player asks for, at its revision, and nothing else', () => {
    expect(readdirSync(ROOT)).toEqual([DUEL.rev])
    const files = readdirSync(new URL(`${DUEL.rev}/`, ROOT)).sort()
    expect(files).toEqual([...MUSIC, ...DUEL.sounds.map(s => `fx-${s}`)].map(n => `${n}.mp3`).sort())
  })

  it('holds each loop whole with its pads', () => {
    // 96 kbps: 12 kB a second.
    for (const layer of DUEL.layers) {
      const seconds = statSync(new URL(`${DUEL.rev}/${layer}.mp3`, ROOT)).size / 12000
      expect(seconds, layer).toBeGreaterThan(DUEL.cycle + 2 * DUEL.pad - 0.1)
    }
    const result = statSync(new URL(`${DUEL.rev}/result.mp3`, ROOT)).size / 12000
    expect(result).toBeGreaterThan(DUEL.resultLoop + 2 * DUEL.pad - 0.1)
  })

  it('is scored to the sprint the server runs', () => {
    // 80 bars end on 0:00; the rush is the last ten, the server's own.
    expect(DUEL.bars * DUEL.bar * 1000).toBe(SPRINT_MS)
    expect(int(constant('study/duels.py', 'SPRINT_MS_BY_REV').match(/"sprint-2": ([\d_]+)/)[1])).toBe(SPRINT_MS)
    expect((DUEL.bars - DUEL.rushFrom + 1) * DUEL.bar * 1000).toBe(int(constant('study/duels.py', 'RUSH_MS')))
    // A cycle is whole bars, and the bars before the rush are whole cycles and a part.
    expect(DUEL.cycle % DUEL.bar).toBe(0)
    expect(DUEL.bar).toBe(4 * 60 / DUEL.bpm)
  })

  it('turns its layers on at the combo’s own tiers', () => {
    const tiers = [...constant('study/duels.py', 'COMBO_TIERS').matchAll(/\((\d+), ([\d.]+)\)/g)].map(m => Number(m[2]))
    expect(tiers).toEqual([1.5, 2, 3])
    expect([1, ...tiers].map(layerOf)).toEqual([0, 1, 2, 3])
    expect(layerOf(1.4)).toBe(0)
    expect(DUEL.layers).toEqual(['base', 'chords', 'arp', 'melody'])
  })

  it('lands a change on the grid it is laid on', () => {
    expect(nextOn(10.01, 10, 0.375)).toBeCloseTo(10.375)
    expect(nextOn(10.375, 10, 0.375)).toBeCloseTo(10.375)
    expect(nextOn(9.5, 10, 0.375)).toBeCloseTo(9.625)
  })

  it('plays every sound it has, and only those', () => {
    const player = read('src/lib/audio/duel.js')
    const literal = [...player.matchAll(/sfx\(\w+, '(\w+)'/g)].map(m => m[1])
    expect(literal.length).toBeGreaterThan(0)
    for (const name of literal) expect(DUEL.sounds, name).toContain(name)
    for (const name of DUEL.sounds) expect(player, name).toContain(`'${name}'`)
  })
})
