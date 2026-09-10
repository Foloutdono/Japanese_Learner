import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The two env files the native shell and the web build read (ADR 0008).
// .env.native mirrors the Supabase values because Vite loads .env.[mode]
// and not .env.production under `--mode native`; this keeps the mirror
// honest, and keeps the origin knob out of the web build's file.
function parse(name) {
  const text = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
  const out = {}
  // Split on both endings: a Windows checkout has CRLF here (git normalises
  // to LF in the repo, so CI never sees it), and `.` does not match \r — a
  // plain \n split leaves one on every line, so /(.*)$/ matches no key at all.
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

describe('the native env file', () => {
  const native = parse('.env.native')
  const production = parse('.env.production')

  it('mirrors the Supabase values of .env.production', () => {
    expect(native.VITE_SUPABASE_URL).toBe(production.VITE_SUPABASE_URL)
    expect(native.VITE_SUPABASE_ANON_KEY).toBe(production.VITE_SUPABASE_ANON_KEY)
    expect(native.VITE_SUPABASE_URL).toBeTruthy()
  })

  it('points the shell at the Vercel origin, never at Render', () => {
    expect(native.VITE_API_ORIGIN).toBe('https://japanese-learner-seven.vercel.app')
    expect(native.VITE_API_ORIGIN).not.toContain('onrender')
  })

  it('keeps the knob out of the web build', () => {
    expect(production.VITE_API_ORIGIN).toBeUndefined()
  })
})
