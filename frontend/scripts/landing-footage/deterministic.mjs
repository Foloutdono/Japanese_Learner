// Frame-by-frame filming, for the screens a CPU-only machine cannot paint
// in real time (Today's gate is a print of a few dozen animated layers:
// about 10 frames a second here, 60 on any phone).
//
// The browser's clock is made ours: every frame advances it by exactly 1/30 s
// (timers, animations and transitions included, through virtual time and
// HeadlessExperimental.beginFrame), then renders and hands back that frame.
// However slowly a frame paints, the film runs at its own right speed, at a
// steady 30 fps. The script's `beat(ms)` waits on that clock, not the wall's.
import { chromium } from 'playwright'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

export const HEADLESS_SHELL = process.env.HEADLESS_SHELL || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
export const FLAGS = ['--enable-begin-frame-control', '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout',
  '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging', '--disable-image-animation-resync']

const FPS = 30
const STEP = 1000 / FPS

export class Driver {
  constructor(cdp, { width, height }) {
    this.cdp = cdp
    this.size = { width, height }
    this.now = 0                       // virtual ms since the pump began
    this.ticks0 = Number(process.hrtime.bigint() / 1000n) / 1000   // CLOCK_MONOTONIC, ms
    this.waiters = []
    this.recording = null
    this.running = false
    this.error = null
  }

  start() {
    this.running = true
    this.loop = this.#pump().catch(e => { this.error = e; this.waiters.splice(0).forEach(w => w.reject(e)) })
  }

  async stop() { this.running = false; await this.loop }

  beat(ms) {
    if (this.error) return Promise.reject(this.error)
    return new Promise((resolve, reject) => this.waiters.push({ at: this.now + ms, resolve, reject }))
  }

  async #pump() {
    let first = true
    while (this.running) {
      const expired = new Promise(r => this.cdp.once('Emulation.virtualTimeBudgetExpired', r))
      await this.cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: STEP, ...(first ? { initialVirtualTime: Date.now() / 1000 } : {}) })
      first = false
      await Promise.race([expired, new Promise(r => setTimeout(r, 3000))])
      this.now += STEP
      const rec = this.recording
      const r = await this.cdp.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: this.ticks0 + this.now, interval: STEP,
        ...(rec ? { screenshot: { format: 'jpeg', quality: 92 } } : {}),
      })
      if (rec) {
        if (r.screenshotData) { rec.last = join(rec.dir, `${String(rec.n).padStart(6, '0')}.jpg`); writeFileSync(rec.last, Buffer.from(r.screenshotData, 'base64')) }
        if (rec.last) rec.list.push(rec.last)
        rec.n++
      }
      for (const w of this.waiters.filter(w => w.at <= this.now)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve() }
    }
  }

  startRecording() { this.recording = { dir: mkdtempSync(join(tmpdir(), 'footage-bf-')), n: 0, list: [], last: null } }

  // Cuts what was filmed into a 30 fps h264 file (a frame the page did not
  // change is the previous one, held for 1/30 s) and a still of its first frame.
  stopRecording(out, { still, crf = 26 } = {}) {
    const rec = this.recording
    this.recording = null
    const lines = rec.list.flatMap(f => [`file '${f}'`, `duration ${(1 / FPS).toFixed(5)}`])
    lines.push(`file '${rec.list.at(-1)}'`)
    const txt = join(rec.dir, 'list.txt')
    writeFileSync(txt, lines.join('\n'))
    const { width, height } = this.size
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', txt,
      '-vf', `fps=${FPS},scale=${width}:${height}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
      '-movflags', '+faststart', '-an', out], { encoding: 'utf8' })
    if (r.status) throw new Error(r.stderr)
    if (still) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rec.list[0], '-q:v', '3', still])
    const info = { frames: rec.list.length, seconds: +(rec.list.length / FPS).toFixed(2), rendered: rec.n }
    rmSync(rec.dir, { recursive: true, force: true })
    return info
  }
}

export async function launch(args) {
  return chromium.launch({ executablePath: HEADLESS_SHELL, args: [...FLAGS, ...args] })
}
