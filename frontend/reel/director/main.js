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
import { createPhone, framing, BOARD_W as BOARD_W_, BOARD_H as BOARD_H_, APP_W as APP_W_ } from './phone'
import { createFinger } from './finger'
import { createCaptions } from './captions'
import { createKeyboard } from './keyboard'
import { createStage } from './stage'
import { buildHook, puzzle } from './hooks'
import { TRANSITIONS, swap, recede } from './transitions'
import { APPS } from './apps'
import { playEnd } from './endcard'
import { sfx } from './sfx'
import { STRINGS } from './strings'
import { kanaToRomaji } from '../../src/lib/romaji'

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
  review: '--accent2', pass: '--pass-ink', learn: '--accent2',
}

// `clips`: where a video hook's own sound plays in the film (the renderer
// mixes the file in at `at`, faded out from `until`).
const state = { ready: false, done: false, error: null, duration: 0, sound: null, clips: [] }
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
  const keyboard = createKeyboard(phone, { sfx, lang: script.lang })

  const appBeats = beats.filter(b => b.kind === 'app')
  // The stage's part: what its backend answers, and for which beat.
  window.__reelHost = {
    clock: () => clock.now(),
    stage: {
      lang: script.lang, theme: script.theme, learner: script.learner, level: script.level,
      plan: script.plan, streak: script.streak, xpLevel: script.xpLevel, xpShort: script.levelUpIn, ambiance: script.ambiance,
      bundle, beats: appBeats.map(b => ({ ...b })), current: 0,
    },
  }
  stage = createStage(phone, { host: window.__reelHost })

  const ctx = {
    script, bundle, strings, seed: script.seed, lang: script.lang,
    layers, phone, finger, captions, keyboard, stage, sfx, files,
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
      ctx.framed = null
      stage.setBeat(appBeats.findIndex(b => b.index === beat.index))
      const scene = APPS[beat.feature]
      const route = scene.route(beat, ctx)
      if (route !== ctx.appRoute) {
        ctx.appRoute = route
        stage.navigate(route)
      } else if (ctx.enteredBeat != null && ctx.enteredBeat !== beat.index) {
        // The same place for another beat (two runs of one line): the
        // screen is left and come back to, so it starts afresh.
        stage.navigate('/learn')
        await clock.nextFrame()
        await clock.nextFrame()
        stage.navigate(route)
      }
      ctx.enteredBeat = beat.index
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
      // Only what the app is showing can be framed: a box running past
      // the app's own fold is framed down to the fold.
      const view = { w: stage.win?.innerWidth ?? 390, h: stage.win?.innerHeight ?? 800 }
      const rects = els.map(e => stage.appRect(e)).filter(r => r && r.w > 0).map(r => {
        const y = Math.max(0, r.y)
        const h = Math.min(view.h, r.y + r.h) - y
        return h > 0 ? { x: Math.max(0, r.x), y, w: Math.min(view.w, r.x + r.w) - Math.max(0, r.x), h } : null
      }).filter(Boolean)
      if (!rects.length) return
      const x0 = Math.min(...rects.map(r => r.x))
      const y0 = Math.min(...rects.map(r => r.y))
      const x1 = Math.max(...rects.map(r => r.x + r.w))
      const y1 = Math.max(...rects.map(r => r.y + r.h))
      const top = captions.showing ? 168 : 56
      ctx.framed = { el, opts: { duration, margin, max, min, fill, bottom }, captioned: captions.showing }
      const band = BOARD_H_ - top - bottom
      const lo = min ?? framing('screen').s
      const zoom = Math.max(lo, Math.min(max, ((BOARD_W_ - 2 * margin) / (x1 - x0)) * fill, (band / (y1 - y0)) * fill))
      const pose = phone.focusOn((x0 + x1) / 2, (y0 + y1) / 2, zoom, { x: BOARD_W_ / 2, y: top + band / 2 })
      // A phone smaller than the board stands in its middle; a larger one
      // never leaves a gap at an edge (the world showing past the glass).
      const halfW = (APP_W_ / 2) * zoom
      const halfH = (844 / 2) * zoom
      pose.x = halfW * 2 < BOARD_W_ ? BOARD_W_ / 2 : Math.min(halfW, Math.max(BOARD_W_ - halfW, pose.x))
      pose.y = halfH * 2 < BOARD_H_ ? framing('screen').y : Math.min(halfH, Math.max(BOARD_H_ - halfH, pose.y))
      await phone.move(pose, duration)
    },
    /**
     * Press an element of the app, as a thumb would: brought into view
     * first if the app's scroller or the camera has it out of sight.
     */
    async tap(el, opts = {}) {
      const target = typeof el === 'string' ? await stage.waitFor(el, { timeout: opts.timeout ?? 6 }) : el
      if (!target) throw new Error(`stage: nothing to press (${el})`)
      const inApp = stage.appRect(target)
      const view = stage.win.innerHeight
      if (inApp && (inApp.y < 0 || inApp.y + inApp.h > view)) await stage.scrollTo(target, { at: 0.5, duration: 0.45 })
      const r = stage.boardRect(target)
      if (!r || r.y < 30 || r.y + r.h > BOARD_H_ - 30 || r.x < 0 || r.x + r.w > BOARD_W_) {
        await ctx.look([target], { duration: 0.45, max: Math.max(phone.pose.s, framing('screen').s) })
      }
      // A thumb waits for the screen it is aiming at to stop moving.
      await phone.settled()
      return finger.tap(stage.point(target, opts), opts)
    },
    /**
     * Where the text stands in the photo `app` reads, as fractions: the
     * creator's own picture says (its `subject`); a snap's photo is the
     * world framed on the text (the photo pass's 432×576 feed).
     */
    photoCrop(app) {
      const hook = ctx.hook?.beat
      const box = hook?.scene === 'media' && hook.style === 'photo'
        ? (hook.subject ? { x: hook.subject[0], y: hook.subject[1], w: hook.subject[2], h: hook.subject[3] } : null)
        : ctx.hook?.photoBox(BOARD_W_, (BOARD_W_ * 4) / 3, 0.72)
      if (!box || !app) return null
      const pad = 0.035
      const x = Math.max(0.02, box.x - pad)
      const y = Math.max(0.02, box.y - pad)
      return { x, y, w: Math.min(0.98, box.x + box.w + pad) - x, h: Math.min(0.98, box.y + box.h + pad) - y }
    },
    /** Show a beat's caption (a string, or { text, at, hold }). */
    say(caption, fallback = {}) {
      if (!caption) return
      const c = typeof caption === 'string' ? { text: caption } : caption
      const at = c.at ?? fallback.at ?? 'top'
      captions.show(c.text, { at, hold: c.hold === undefined ? (fallback.hold ?? 2.4) : c.hold })
      // A caption arriving over a shot framed without one: the shot
      // eases down under it rather than reading through it.
      const shot = ctx.framed
      if (at === 'top' && shot && !shot.captioned) ctx.look(shot.el, { ...shot.opts, duration: 0.5 })
    },
    /** Paste `text` into the focused field. */
    async paste(text) { send({ kind: 'text', text }) },
    /** Type `text` a character at a time, as a thumb does. */
    async type(text, { cps = 11 } = {}) {
      for (const ch of [...text]) {
        keyboard.press(ch)
        send({ kind: 'text', text: ch })
        await clock.wait((1 / cps) * finger.jitter(0.6, 1.5))
      }
    },
    /**
     * Type Japanese as a phone does: each mora's romaji on the keys, the
     * kana growing underlined in the field (the IME's composition), the
     * candidates over the keys, and `commit` (kanji and all) chosen.
     */
    async typeJa(kana, { commit = kana, cps = 10 } = {}) {
      const morae = [...kana].reduce((out, c) => {
        if (/[ゃゅょぁぃぅぇぉ]/.test(c) && out.length) out[out.length - 1] += c
        else out.push(c)
        return out
      }, [])
      let typed = ''
      for (const mora of morae) {
        for (const key of kanaToRomaji(mora)) {
          keyboard.press(key)
          await clock.wait((1 / cps) * finger.jitter(0.6, 1.4))
        }
        typed += mora
        if (rendering) send({ kind: 'compose', text: typed })
      }
      keyboard.candidates([commit, ...(commit === kana ? [] : [kana])])
      await clock.wait(0.45)
      if (rendering) send({ kind: 'compose', text: '' })
      send({ kind: 'text', text: commit })
      keyboard.candidates([])
      await clock.wait(0.15)
    },
    /**
     * Write `text` on a drawing board (its holder, the square the app's
     * answer is laid over): each character's strokes, KanjiVG's own paths
     * in their order, traced by the finger at a brush's pace. A pair of
     * kana shares the board as the app's answer shares it, a square each.
     */
    async write(text, board, { pace = 1 } = {}) {
      const chars = [...text]
      for (const [n, ch] of chars.entries()) {
        const box = stage.boardRect(board)
        if (!box) return
        const cell = { x: box.x + (box.w / chars.length) * n, y: box.y, w: box.w / chars.length, h: box.h }
        const size = Math.min(cell.w, cell.h)
        const ox = cell.x + (cell.w - size) / 2
        const oy = cell.y + (cell.h - size) / 2
        for (const stroke of await strokesOf(ch)) {
          const points = stroke.points.map(p => ({ x: ox + (p.x / 109) * size, y: oy + (p.y / 109) * size }))
          await finger.trace(points, { duration: (0.14 + 0.5 * Math.min(1, stroke.length / 90)) / pace })
          await clock.wait(0.07 / pace)
        }
      }
    },
    /** Return on the keyboard: the field's form is sent. */
    async submit() {
      keyboard.press('\n')
      send({ kind: 'key', key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' })
      await clock.wait(0.12)
    },
  }

  // The world of the first beat, drawn before the first frame.
  if (beats[0].kind === 'hook') ctx.hook = buildHook(beats[0], layers.world, { seed: script.seed, files, breaks: breaksOf(bundle, beats[0].text) })
  await loadFonts(texts)
  // Footage is loaded before the first frame: the first hook's, and every
  // later video hook's, held so its pictures come from memory when it plays.
  await ctx.hook?.ready
  ctx.held = await preloadClips(beats.slice(1), files)

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
    layers.dim.style.opacity = '0.84'
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
  // Off the app (a hook, a transition, the end), no shot is held.
  if (beat.kind !== 'app') ctx.framed = null
  switch (beat.kind) {
    case 'hook': return playHook(beat, ctx)
    case 'app': {
      endClip(ctx)
      // Straight from another app beat: the next station's plate.
      if (prev?.kind === 'app') await swap(beat, ctx)
      // From the world with no transition named: the phone rises.
      else if (prev?.kind === 'hook' || !prev) {
        if (!prev) await ctx.enterApp(beat)
        else await TRANSITIONS.rise({ caption: null }, ctx)
      }
      return APPS[beat.feature].play(beat, ctx)
    }
    case 'end': endClip(ctx); return playEnd(beat, ctx)
    default: return TRANSITIONS[beat.kind](beat, ctx)
  }
}

// ── A character's strokes, as KanjiVG draws them (0–109 square) ──
const SVG = 'http://www.w3.org/2000/svg'
let probe = null

/** Each stroke of `ch` in order: points along it, and its length. */
async function strokesOf(ch) {
  const file = ch.codePointAt(0).toString(16).padStart(5, '0')
  const text = await fetch(`/__reel/kanjivg/${file}.svg`).then(r => (r.ok ? r.text() : ''), () => '')
  const paths = [...new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('path')]
  if (!probe) {
    const holder = document.createElementNS(SVG, 'svg')
    holder.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden')
    probe = document.createElementNS(SVG, 'path')
    holder.appendChild(probe)
    document.body.appendChild(holder)
  }
  return paths.map(path => {
    probe.setAttribute('d', path.getAttribute('d') ?? '')
    const length = probe.getTotalLength()
    const n = Math.max(2, Math.ceil(length / 2))
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const p = probe.getPointAtLength((length * i) / n)
      return { x: p.x, y: p.y }
    })
    return { points, length }
  })
}

/** Every picture of the later video hooks, loaded and kept. */
function preloadClips(beats, files) {
  const held = []
  for (const beat of beats) {
    if (beat.kind !== 'hook' || !beat.clip) continue
    for (let i = 0; i < beat.clip.count; i++) {
      const img = new Image()
      img.src = files(`${beat.clip.dir}/${String(i + 1).padStart(5, '0')}.jpg`)
      held.push(new Promise(r => { img.onload = img.onerror = r }).then(() => img))
    }
  }
  return Promise.all(held)
}

/** A video hook's sound stops where the app takes over. */
function endClip(ctx) {
  if (ctx.clip) ctx.clip.until = clock.now()
  ctx.clip = null
}

async function playHook(beat, ctx) {
  const { layers, phone } = ctx
  if (!ctx.hook || ctx.hook.beat !== beat) {
    ctx.hook?.dispose()
    // A whip left the last world swept aside.
    layers.world.style.transform = ''
    layers.world.style.filter = ''
    ctx.hook = buildHook(beat, layers.world, { seed: ctx.seed, files: ctx.files, breaks: breaksOf(ctx.bundle, beat.text) })
    // Back to the world: the phone goes down, the world comes back.
    recede(ctx, 0, 0.5)
    phone.move(framing('pocket'), 0.6)
  }
  endClip(ctx)
  ctx.hook.play()
  if (beat.clip?.sound) {
    ctx.clip = { file: beat.clip.sound, at: clock.now(), until: null, volume: beat.volume ?? 1 }
    state.clips.push(ctx.clip)
  }
  const hold = beat.duration ?? 2.7
  ctx.say(beat.caption, { hold: Math.max(1.6, hold - 1) })
  ctx.hook.lean(beat.lean ?? 1.1, hold)
  await clock.wait(Math.min(0.9, hold * 0.33))
  // The marks of not reading it, around what cannot be read; footage
  // with no subject marked has nothing to stand them around.
  const asks = beat.puzzle ?? !(beat.scene === 'media' && !beat.subject)
  const marks = asks ? await puzzle(ctx.hook, layers.fx, { seed: ctx.seed, sound: i => ctx.sfx.huh(i) }) : null
  await clock.wait(Math.max(0.3, hold - 0.9 - 0.75))
  await marks?.clear()
}

// A line may break before a word, never before what leans on the word
// before it (a particle, an auxiliary, a suffix, a mark) nor inside a
// grammar pattern: 降るかもしれない stays one phrase, as a printed sign
// or a speech bubble sets it.
const LEANS = new Set(['particle', 'auxiliary', 'suffix', 'symbol'])

/** Where `text` may break: the breakdown's phrases, if it has one. */
function breaksOf(bundle, text) {
  const answer = text ? bundle.analyze?.[text.trim()] : null
  if (!answer) return []
  const out = []
  let cursor = 0
  for (const sentence of answer.sentences) {
    const at = text.indexOf(sentence.text, cursor)
    if (at < 0) continue
    const inside = (sentence.grammar ?? []).filter(g => g.kind === 'pattern')
    for (const tok of sentence.tokens) {
      if (LEANS.has(tok.pos)) continue
      if (inside.some(g => g.start < tok.start && tok.start < g.end)) continue
      out.push(at + tok.start)
    }
    cursor = at + sentence.text.length
  }
  return out
}

// ── The still the camera takes ────────────────────────────────────
async function drawPhoto(beat, layers, script, files, texts) {
  document.body.classList.add('photo-mode')
  const hook = buildHook(beat, layers.world, { seed: script.seed, files, breaks: breaksOf(window.__reelBundle ?? {}, beat.text) })
  await loadFonts(texts)
  // Footage is taken where the snap's shutter falls, a moment past its hook.
  await hook.ready
  hook.seek((beat.duration ?? 2.7) + 1.4)
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
  return { wav: btoa(binary), duration: state.duration, sources: parts.length, clips: state.clips }
}

boot().catch(fail)
