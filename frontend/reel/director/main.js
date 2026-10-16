// ── 監督 — the director (plan 210) ────────────────────────────────────
// Plays a reel's script on the board: the hook's world, the phone, the
// real app inside it, the finger, the captions and the end card. The
// renderer (reel.mjs) loads it at /__reel/director?reel=<file>, steps
// its clock a frame at a time and drives it through window.__reel:
//
//   ready        true once fonts, the first hook and the app are up
//   start()      begin the film (its clock starts at 0)
//   tick()       before each frame: render the sound to now, hand over
//                the presses the finger made ({ inputs, done, t, error })
//   soundtrack() after the last frame: the whole sound, mixed, as WAV
//
// With ?photo=<beat> it draws one still instead (the picture the snap
// takes, for the analyzer's photo input), and opened by hand in a
// browser it plays in real time, presses dispatched as DOM events.

import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-serif-jp/500.css'
import '@fontsource/noto-serif-jp/700.css'
import '@fontsource/noto-serif-jp/900.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/700.css'
import '@fontsource/noto-sans-jp/900.css'
import { DARK, LIGHT, SCALE } from '../../landing/tokens.mjs'
import { installAudio, audioClock } from '../stage/audio'
import * as clock from './clock'
import { createPhone, framing, BOARD_W as BOARD_W_, BOARD_H as BOARD_H_ } from './phone'
import { createFinger } from './finger'
import { createCaptions } from './captions'
import { createStage } from './stage'
import { buildHook, puzzle } from './hooks'
import { TRANSITIONS, swap, recede } from './transitions'
import { APPS } from './apps'
import { playEnd } from './endcard'
import { sfx } from './sfx'
import { STRINGS } from './strings'

const FONTS = {
  '--font-display': "'Space Grotesk', system-ui, sans-serif, 'Noto Color Emoji'",
  '--font-jp': "'Noto Sans JP', 'IPAGothic', sans-serif, 'Noto Color Emoji'",
  '--font-serif': "'Noto Serif JP', 'Noto Sans JP', serif",
}

// Each feature's line, for the plate a swap passes over the screen.
const LINES = {
  analyzer: '--line-kaiseki', reading: '--line-reading', dictation: '--line-kakitori',
  translation: '--line-honyaku', composition: '--line-sakubun', comprehension: '--line-rikai',
  kana: '--line-kana', vocab: '--line-vocab', kanji: '--line-kanji', grammar: '--line-grammar',
  exam: '--line-exam', dictionary: '--line-jisho', decks: '--line-vocab', today: '--accent2',
  review: '--accent2', pass: '--pass-ink',
}

const state = { ready: false, done: false, error: null, duration: 0, sound: null }
const inputs = []
const rendering = Boolean(window.__REEL_RENDER__)

function fail(err) {
  state.error = `${err?.message ?? err}\n${err?.stack ?? ''}`
  console.error('[reel]', err)
}

window.__reel = {
  get ready() { return state.ready },
  get done() { return state.done },
  get error() { return state.error },
  // Not awaited: the film runs on the clock the renderer steps, so
  // waiting here for its end would wait forever.
  start() { start().catch(fail); return true },
  tick() {
    return { inputs: inputs.splice(0), done: state.done, t: clock.now(), error: state.error }
  },
  // The sound is rendered once, at the end, while the renderer keeps
  // the page's clock running: mix() starts it, `sound` holds it when done.
  mix() {
    soundtrack().then(s => { state.sound = s }, fail)
    return true
  },
  get sound() { return state.sound ?? null },
}

let stage = null

function applyTokens(theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries({ ...DARK, ...(theme === 'light' ? LIGHT : {}), ...SCALE, ...FONTS })) {
    root.style.setProperty(k, v)
  }
  root.style.setProperty('--line-decks', '#5d72ab')
}

async function loadFonts(texts) {
  const all = texts.filter(Boolean).join('')
  const faces = ['500 20px "Noto Sans JP"', '700 20px "Noto Sans JP"', '900 20px "Noto Sans JP"',
    '500 20px "Noto Serif JP"', '700 20px "Noto Serif JP"', '900 20px "Noto Serif JP"',
    '700 20px "Space Grotesk"', '600 20px "Space Grotesk"', '500 20px "Space Grotesk"']
  await Promise.all(faces.map(f => document.fonts.load(f, all || 'あ').catch(() => {})))
  await document.fonts.ready
}

// ── The film ───────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search)
const reelFile = params.get('reel')
const photoBeat = params.get('photo')

async function boot() {
  const data = await (await fetch(`/__reel/files/${reelFile}`)).json()
  const { script, bundle = {}, assets = {} } = data
  applyTokens(script.theme)
  const strings = STRINGS[script.lang] ?? STRINGS.en
  const layers = {
    board: document.getElementById('board'),
    world: document.getElementById('world'),
    rig: document.getElementById('rig'),
    fx: document.getElementById('fx'),
    captions: document.getElementById('captions'),
    end: document.getElementById('end'),
    finger: document.getElementById('finger'),
  }
  layers.dim = document.createElement('div')
  layers.dim.className = 'world__dim'
  layers.world.appendChild(layers.dim)

  const beats = script.beats.map((b, index) => ({ ...b, index }))
  const files = name => (name ? `/__reel/files/${assets.base ?? ''}${name}` : '')
  const texts = beats.flatMap(b => [b.text, b.sub, b.title, b.caption?.text, b.translation, b.reveal])

  window.__reelBundle = bundle
  if (photoBeat != null) {
    await drawPhoto(beats[Number(photoBeat)], layers, script, files, texts)
    return
  }

  audioClock.length(Math.min(180, (script.maxSeconds ?? 90) + 4))
  audioClock.use(() => clock.now())
  installAudio()

  const phone = createPhone(layers.rig, { seed: script.seed, clockText: script.clock ?? '12:30', statusInk: script.theme === 'light' ? '#221d15' : '#ece5d8' })
  const send = rendering ? input => inputs.push(input) : input => dispatchInPage(input, phone)
  const finger = createFinger(layers.finger, { kind: script.finger, seed: script.seed, send })
  const captions = createCaptions(layers.captions, { style: script.captions })

  const appBeats = beats.filter(b => b.kind === 'app')
  // The stage's part: what its backend answers, and for which beat.
  window.__reelHost = {
    clock: () => clock.now(),
    stage: {
      lang: script.lang, theme: script.theme, learner: script.learner, level: script.level,
      plan: script.plan, streak: script.streak, due: script.due, ambiance: script.ambiance,
      bundle, beats: appBeats.map(b => ({ ...b })), current: 0,
    },
  }
  stage = createStage(phone, { host: window.__reelHost })

  const ctx = {
    script, bundle, strings, seed: script.seed, lang: script.lang,
    layers, phone, finger, captions, stage, sfx, files,
    hook: null,
    index: 0,
    drift: clock.drift,
    statusInk: script.theme === 'light' ? '#221d15' : '#ece5d8',
    closeLabel: script.lang === 'fr' ? 'Fermer' : 'Close',
    appRoute: null,
    nextApp() { return beats.slice(ctx.index + 1).find(b => b.kind === 'app') },
    photoUrl(beat) { return assets.photos?.[beat.index] ? files(assets.photos[beat.index]) : null },
    lineColor(feature) { return `var(${LINES[feature] ?? '--accent2'})` },
    /** Make the app ready for `beat`: its route, its answers, its state. */
    async enterApp(beat, opts = {}) {
      if (!beat) return null
      stage.setBeat(appBeats.findIndex(b => b.index === beat.index))
      const scene = APPS[beat.feature]
      const route = scene.route(beat, ctx)
      if (route !== ctx.appRoute) {
        ctx.appRoute = route
        stage.navigate(route)
      }
      await stage.waitFor(scene.ready(beat, ctx), { timeout: 12 })
      return (await scene.before?.(beat, ctx, opts)) ?? null
    },
    /**
     * Frame what matters: zoom the phone so `el` (an element, a selector
     * or a list of them, framed together) fills the band of the board a
     * viewer reads, below a caption when one stands and clear of a short
     * video app's own foot. Never wider than the whole phone.
     */
    async look(el, { duration = 0.75, margin = 22, max = 1.75, min, fill = 1, bottom = 150 } = {}) {
      const els = (Array.isArray(el) ? el : [el]).map(e => stage.find(e)).filter(Boolean)
      const rects = els.map(e => stage.appRect(e)).filter(r => r && r.w > 0)
      if (!rects.length) return
      const x0 = Math.min(...rects.map(r => r.x))
      const y0 = Math.min(...rects.map(r => r.y))
      const x1 = Math.max(...rects.map(r => r.x + r.w))
      const y1 = Math.max(...rects.map(r => r.y + r.h))
      const top = captions.showing ? 168 : 56
      const band = BOARD_H_ - top - bottom
      const lo = min ?? framing('screen').s
      const zoom = Math.max(lo, Math.min(max, ((BOARD_W_ - 2 * margin) / (x1 - x0)) * fill, (band / (y1 - y0)) * fill))
      const pose = phone.focusOn((x0 + x1) / 2, (y0 + y1) / 2, zoom, { x: BOARD_W_ / 2, y: top + band / 2 })
      // Never past the phone's own edge sideways when it is narrower than the board.
      if (zoom * 412 < BOARD_W_) pose.x = BOARD_W_ / 2
      await phone.move(pose, duration)
    },
    /** Show a beat's caption (a string, or { text, at, hold }). */
    say(caption, fallback = {}) {
      if (!caption) return
      const c = typeof caption === 'string' ? { text: caption } : caption
      captions.show(c.text, { at: c.at ?? fallback.at ?? 'top', hold: c.hold === undefined ? (fallback.hold ?? 2.4) : c.hold })
    },
    /** Paste `text` into the focused field. */
    async paste(text) { send({ kind: 'text', text }) },
    /** Type `text` a character at a time, as a thumb does. */
    async type(text, { cps = 9 } = {}) {
      for (const ch of [...text]) {
        send({ kind: 'text', text: ch })
        await clock.wait((1 / cps) * finger.jitter(0.6, 1.5))
      }
    },
  }

  // The world of the first beat, drawn before the first frame.
  if (beats[0].kind === 'hook') ctx.hook = buildHook(beats[0], layers.world, { seed: script.seed, files, breaks: breaksOf(bundle, beats[0].text) })
  await loadFonts(texts)

  // The app, booted at the first scene's place, waiting off screen.
  const first = appBeats[0]
  if (first) {
    ctx.appRoute = APPS[first.feature].route(first, ctx)
    await stage.load(ctx.appRoute)
    await stage.waitFor(APPS[first.feature].ready(first, ctx), { timeout: 30 })
  }
  for (const url of Object.values(assets.photos ?? {})) {
    await new Promise(resolve => { const img = new Image(); img.onload = img.onerror = resolve; img.src = files(url) })
  }
  if (beats[0].kind !== 'hook') {
    phone.set(framing('screen'))
    layers.dim.style.opacity = '0.7'
  }
  ctx.beats = beats
  window.__reelCtx = ctx
  state.ready = true
  if (!rendering) {
    // A preview plays at once.
    window.__reel.start()
  }
}

async function start() {
  const ctx = window.__reelCtx
  const { script, beats } = ctx
  clock.start(script.pace)
  // The director's own sounds are recorded from the first frame: the
  // app's audio module waits for a gesture, and this is the film's.
  window.dispatchEvent(new Event('pointerdown'))
  for (let i = 0; i < beats.length; i++) {
    ctx.index = i
    await playBeat(beats[i], ctx)
  }
  await clock.wait(0.4)
  state.duration = clock.now()
  state.done = true
}

async function playBeat(beat, ctx) {
  const prev = ctx.beats[beat.index - 1]
  switch (beat.kind) {
    case 'hook': return playHook(beat, ctx)
    case 'app': {
      // Straight from another app beat: the next station's plate.
      if (prev?.kind === 'app') await swap(beat, ctx)
      // From the world with no transition named: the phone rises.
      else if (prev?.kind === 'hook' || !prev) {
        if (!prev) await ctx.enterApp(beat)
        else await TRANSITIONS.rise({ caption: null }, ctx)
      }
      return APPS[beat.feature].play(beat, ctx)
    }
    case 'end': return playEnd(beat, ctx)
    default: return TRANSITIONS[beat.kind](beat, ctx)
  }
}

async function playHook(beat, ctx) {
  const { layers, phone } = ctx
  if (!ctx.hook || ctx.hook.beat !== beat) {
    ctx.hook?.dispose()
    ctx.hook = buildHook(beat, layers.world, { seed: ctx.seed, files: ctx.files, breaks: breaksOf(ctx.bundle, beat.text) })
    // Back to the world: the phone goes down, the world comes back.
    recede(ctx, 0, 0.5)
    phone.move(framing('pocket'), 0.6)
  }
  const hold = beat.duration ?? 2.7
  ctx.say(beat.caption, { hold: Math.max(1.6, hold - 1) })
  ctx.hook.lean(1.1, hold)
  await clock.wait(Math.min(0.9, hold * 0.33))
  const marks = beat.puzzle === false ? null : await puzzle(ctx.hook, layers.fx, { seed: ctx.seed, sound: i => ctx.sfx.huh(i) })
  await clock.wait(Math.max(0.3, hold - 0.9 - 0.75))
  await marks?.clear()
}

/** Where the words of `text` start: the breakdown's tokens, if it has one. */
function breaksOf(bundle, text) {
  const answer = text ? bundle.analyze?.[text.trim()] : null
  if (!answer) return []
  const out = []
  let cursor = 0
  for (const sentence of answer.sentences) {
    const at = text.indexOf(sentence.text, cursor)
    if (at < 0) continue
    for (const tok of sentence.tokens) out.push(at + tok.start)
    cursor = at + sentence.text.length
  }
  return out
}

// ── The still the camera takes ────────────────────────────────────
async function drawPhoto(beat, layers, script, files, texts) {
  document.body.classList.add('photo-mode')
  const hook = buildHook(beat, layers.world, { seed: script.seed, files, breaks: breaksOf(window.__reelBundle ?? {}, beat.text) })
  await loadFonts(texts)
  const holder = document.createElement('div')
  holder.className = 'photo'
  document.body.appendChild(holder)
  hook.feed(holder, window.innerWidth, window.innerHeight, 0.72)
  window.__reel = { photoReady: true }
}

// ── Presses, in a preview: DOM events into the stage ───────────────
let pressed = null
function dispatchInPage(input, phone) {
  const win = stage?.win
  if (!win) return
  if (input.kind === 'text') {
    win.document.execCommand('insertText', false, input.text)
    return
  }
  if (input.kind !== 'mouse') return
  const p = phone.boardToApp(input.x, input.y)
  const el = win.document.elementFromPoint(p.x, p.y)
  const opts = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 1, pointerType: 'mouse', isPrimary: true }
  if (input.type === 'mousePressed' && el) {
    pressed = el
    el.dispatchEvent(new win.PointerEvent('pointerdown', opts))
    el.dispatchEvent(new win.MouseEvent('mousedown', opts))
  } else if (input.type === 'mouseReleased' && pressed) {
    const target = el ?? pressed
    target.dispatchEvent(new win.PointerEvent('pointerup', opts))
    target.dispatchEvent(new win.MouseEvent('mouseup', opts))
    if (target === pressed || pressed.contains(target)) target.click()
    pressed = null
  } else if (input.type === 'mouseMoved' && el && input.drag) {
    el.dispatchEvent(new win.PointerEvent('pointermove', opts))
  }
}

// ── The sound, mixed ───────────────────────────────────────────────
async function soundtrack() {
  const parts = [...await audioClock.finish(), ...(await stage?.api?.audio.finish() ?? [])]
  const rate = 48000
  const length = Math.ceil(rate * state.duration)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  for (const part of parts) {
    const offset = Math.round(part.bornAt * part.sampleRate)
    const [l, r] = part.channels
    for (let i = Math.max(0, -offset); i < l.length && i + offset < length; i++) {
      left[i + offset] += l[i]
      right[i + offset] += r[i]
    }
  }
  // 16-bit PCM WAV, base64 for the trip back to the renderer.
  const bytes = new Uint8Array(44 + length * 4)
  const view = new DataView(bytes.buffer)
  const ascii = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  ascii(0, 'RIFF'); view.setUint32(4, 36 + length * 4, true); ascii(8, 'WAVE')
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true)
  ascii(36, 'data'); view.setUint32(40, length * 4, true)
  const clip = x => Math.max(-1, Math.min(1, x))
  for (let i = 0; i < length; i++) {
    view.setInt16(44 + i * 4, clip(left[i]) * 0x7fff, true)
    view.setInt16(46 + i * 4, clip(right[i]) * 0x7fff, true)
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { wav: btoa(binary), duration: state.duration, sources: parts.length }
}

boot().catch(fail)
