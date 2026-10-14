// Every app sound event, its shipped (first) variant, rendered offline to WAV.
import { createRequire } from 'module'
import fs from 'fs'
const FRONT = process.argv[2], OUT = process.argv[3]
fs.mkdirSync(OUT, { recursive: true })
const require = createRequire(FRONT + '/package.json')
const { chromium } = require('playwright')
const { voicesBundle } = await import(FRONT + '/scripts/voices-bundle.mjs')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
await page.setContent('<!doctype html><title>sfx</title>')
await page.addScriptTag({ content: await voicesBundle() })
const res = await page.evaluate(async () => {
  const { VOICE_EVENTS, voiceOut, voiceLevel } = globalThis.TsujiVoices
  const RATE = 48000, out = {}
  for (const ev of VOICE_EVENTS) {
    const v = ev.variants[0]
    const ctx = new OfflineAudioContext(2, RATE * 4, RATE)
    v.play(ctx, voiceOut(ctx, ctx.destination, voiceLevel(ev, v)))
    const b = await ctx.startRendering()
    const l = b.getChannelData(0), r = b.getChannelData(1)
    let last = 0; for (let i = 0; i < l.length; i++) if (Math.abs(l[i]) > 1e-4 || Math.abs(r[i]) > 1e-4) last = i
    const n = Math.min(l.length, last + 2400)
    const pcm = new Int16Array(n * 2)
    for (let i = 0; i < n; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, l[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, r[i])) * 32767 }
    let s = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
    out[ev.key] = { variant: v.key, b64: btoa(s), n }
  }
  return out
})
await browser.close()
for (const [k, { variant, b64, n }] of Object.entries(res)) {
  const data = Buffer.from(b64, 'base64'); const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(48000, 24); h.writeUInt32LE(48000 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  fs.writeFileSync(`${OUT}/${k}.wav`, Buffer.concat([h, data]))
  console.log(k.padEnd(24), variant.padEnd(20), (n / 48000).toFixed(2) + 's')
}
