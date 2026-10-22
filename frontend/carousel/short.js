// ── 短編 — a carousel as a short video (plan 233) ───────────────────
// Any carousel the studio draws can also be a 9:16 video for YouTube
// Shorts, Reels or TikTok: its slides in their order, each held as long
// as it takes to read (a question longer, its seconds ticked), swiped to
// the next as a carousel is, the item's Japanese said once everything is
// revealed. The studio encodes it at once with the app's sounds
// (studio.js); long/render.mjs --carousel makes it with the voice, as
// it makes the long videos.
//
// Pure but for the canvas it draws on: `chars` counts what a slide
// writes, `shortTimeline` times the slides, `drawShortFrame` draws any
// second of it and returns a key that is the same for two frames that
// look the same.
import { formatOf } from './draw.js'
import { FORMATS, deck } from './slides.js'
import { depsOf, picked, plan as sourcePlan, sourceOf, titleOf } from './sources.js'
import { tuned } from './tune.js'
import { feedPosts } from './feeds.js'

export const SWIPE = 0.35 // a swipe from one slide to the next
export const FPS = 30
// A conversion carousel's hook asks too (plan 234).
const ASKS = /^(question-|scene-question|round-|ask$)/
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

/** How long a slide is held: its reading time (times the tuned pace),
 *  and the tuned time to answer more on a question (plan 248). */
export function slideSeconds(chars, key, tune) {
  const ask = ASKS.test(key)
  const read = clamp(1.2 + chars * 0.045, 2.4, 7) * tuned(tune, 'short.pace')
  return { hold: +(read + (ask ? tuned(tune, 'short.answer') : 0)).toFixed(3), ask }
}

/** What a slide writes, counted as it draws (each character once). */
export function chars(slide, ctx) {
  let n = 0
  const fill = ctx.fillText
  ctx.fillText = function (t, ...rest) { n += [...String(t)].length; return fill.call(this, t, ...rest) }
  try { slide.draw(ctx) } finally { ctx.fillText = fill }
  return n
}

/** The one line a carousel says: its sentence, its word, its kana; none
 *  where it has none to say (a kanji's readings, a set of lookalikes). */
export function spokenLine(pl) {
  const jp = pl.caption?.jp || ''
  if (pl.source === 'sentence' || pl.source === 'short' || pl.source === 'kana') return jp || null
  const reading = /（(.+?)）/.exec(jp)?.[1]
  if (reading) return reading
  const rows = pl.slides.find(s => s.rows?.length)?.rows || pl.slides.find(s => s.items?.[0]?.rows)?.items[0].rows
  return rows ? rows.map(r => r.t).join('') : null
}

/** The video, timed: each slide held, swiped to the next; the line said on
 *  the last slide before the station, once all is revealed. `dur(cue)`
 *  is how long a line lasts once voiced, else a guess; `tune` the
 *  studio's (plan 248). */
export function shortTimeline(slides, counts, spoken = null, dur = null, tune = null) {
  const segs = []
  const cues = []
  const sfx = [{ at: 0.1, key: 'board-flap' }]
  // Said where the item is revealed: its answer, its built sentence, its recap; else before the station.
  const reveals = slides.map((s, i) => (/^(answer|built|scene-answer|recap)/.test(s.key) ? i : -1)).filter(i => i >= 0)
  const sayAt = reveals.length ? reveals.at(-1) : Math.max(0, slides.length - 2)
  let at = 0
  slides.forEach((s, i) => {
    let { hold, ask } = slideSeconds(counts[i] || 0, s.key, tune)
    const answer = ask ? tuned(tune, 'short.answer') : 0
    let floor = Math.max(2.4, ask ? 2 + answer : 0)
    if (i) sfx.push({ at: +at.toFixed(3), key: 'card-transition', gain: 0.7 })
    if (ask) for (let k = 0; k < Math.floor(answer); k++) sfx.push({ at: +(at + hold - Math.floor(answer) + k).toFixed(3), key: 'click', gain: 0.35 })
    if (i && ASKS.test(slides[i - 1].key)) sfx.push({ at: +(at + SWIPE).toFixed(3), key: 'correct' })
    if (spoken && i === sayAt) {
      const cue = { at: +(at + SWIPE + 0.5).toFixed(3), text: spoken, who: 'reader' }
      cues.push(cue)
      const said = dur?.(cue) ?? 0.35 + [...spoken].length * 0.14
      hold = Math.max(hold, SWIPE + 0.5 + said + 1.2)
      // Tightened, the slide still lets its line be said whole.
      floor = Math.max(floor, SWIPE + 0.5 + said + 0.6)
    }
    if (i === slides.length - 1) sfx.push({ at: +(at + 0.3).toFixed(3), key: 'platform-chime' })
    segs.push({ i, key: s.key, start: +at.toFixed(3), dur: +hold.toFixed(3), ask, floor: +floor.toFixed(3) })
    at += hold
  })
  return fitted({ seconds: +at.toFixed(3), segs, cues, sfx, chapters: [] }, tuned(tune, 'short.limit'))
}

// A short holds under a minute where it can (the tuned limit): past it,
// every hold is tightened alike (to three quarters at most), never under
// its floor: a slide's least reading time, a question's time to answer,
// its line said whole.
export const LIMIT = 59
function fitted(tl, limit = LIMIT) {
  if (tl.seconds <= limit) return tl
  const k = Math.max(0.75, limit / tl.seconds)
  const floor = sg => sg.floor ?? 2.4
  let at = 0
  const moved = []
  const segs = tl.segs.map(sg => {
    const dur = +Math.max(floor(sg), sg.dur * k).toFixed(3)
    moved.push({ from: sg.start, to: at, dur, old: sg.dur })
    const out = { ...sg, start: +at.toFixed(3), dur }
    at += dur
    return out
  })
  // Each sound and line keeps its place in its slide: from its start, or from its end for a question's ticks.
  const place = x => {
    const m = moved.findLast(mv => x.at >= mv.from) || moved[0]
    const into = x.at - m.from
    const fromEnd = m.old - into
    const at2 = x.key === 'click' ? m.to + m.dur - fromEnd : m.to + Math.min(into, m.dur)
    return { ...x, at: +at2.toFixed(3) }
  }
  return { ...tl, seconds: +at.toFixed(3), segs, cues: tl.cues.map(place), sfx: tl.sfx.map(place) }
}

/** The frame at second `t`: the slide, or two of them in a swipe. */
export function drawShortFrame(ctx, slides, tl, t, fmt = FORMATS.story) {
  let n = tl.segs.findIndex(s => t < s.start + s.dur)
  if (n < 0) n = tl.segs.length - 1
  const sg = tl.segs[n]
  const into = (t - sg.start) / SWIPE
  if (n > 0 && into < 1) {
    const e = Math.round(ease(into) * 15) / 15
    ctx.save()
    ctx.translate(-e * fmt.w, 0)
    slides[n - 1].draw(ctx)
    ctx.restore()
    ctx.save()
    ctx.translate((1 - e) * fmt.w, 0)
    slides[n].draw(ctx)
    ctx.restore()
    return `${n}|${e}`
  }
  ctx.save()
  slides[n].draw(ctx)
  ctx.restore()
  return `${n}`
}

/** What a word's carousel reads besides its own file: its sentences, its kanji's strokes. */
export async function depsFor(sourceId, data, id, fetchJson) {
  if (sourceId !== 'word') return {}
  const need = depsOf('word', data, id)
  const index = await fetchJson('kanji-index.json')
  const sentences = {}
  for (const lv of need.levels) for (const s of (await fetchJson(`${lv}.json`)).sentences) sentences[s.id] = s
  const strokes = {}
  for (const c of need.chars) {
    const lv = index.kanji[c]?.lv
    if (!lv) continue
    const k = (await fetchJson(`kanji-${lv}.json`)).kanji[c]
    if (k) strokes[c] = k
  }
  return { index, sentences, strokes }
}

/** A carousel's slides, standing, from what the studio holds of it (`st`:
 *  its source, level or set, id, type and settings): what render.mjs
 *  --carousel draws, as the studio would. */
export async function carouselShort(st, fetchJson) {
  const src = sourceOf(st.source)
  const file = src.file(src.levels ? st.set : st.level)
  const data = await fetchJson(file)
  const deps = await depsFor(st.source, data, st.id, fetchJson)
  const figures = (await fetchJson('index.json').catch(() => null))?.figures
  const opts = { ...st, figures }
  const pl = sourcePlan(st.source, data, st.id, opts, deps)
  // At the margins the studio chose: TikTok's, Instagram's or none (plan 239).
  const slides = deck(st.type, pl, formatOf('story', st.fit), opts)
  return { pl, slides }
}

/** The studio's carousel as the render command carries it (base64url
 *  JSON, the same in a browser and in Node), and back. */
export function recipeOf(st) {
  let bin = ''
  for (const byte of new TextEncoder().encode(JSON.stringify(st))) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const fromRecipe = r => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))))

/** A carousel short's page: the carousel's own title (plan 229l) for the
 *  feed, its caption, the app, the voice's credit when it speaks, tags. */
export function shortPage(pl, type, picks, site, voiced) {
  const fr = pl.lang === 'fr'
  const n = type === 'exam' ? picked(pl, picks, 3).length : 1
  const c = pl.caption
  const base = fr ? ['japonais', 'apprendrelejaponais'] : ['japanese', 'learnjapanese']
  const tags = [...base, ...c.tags, '日本語', 'shorts']
  const head = [c.jp, c.romaji, c.tr].filter(Boolean).join('\n')
  const credit = voiced ? (fr ? 'Voix : VOICEVOX Nemo.' : 'Voices: VOICEVOX Nemo.') : null
  const lines = [
    head,
    c.ask,
    `${fr ? 'Continue sur Tsuji' : 'Keep going on Tsuji'}: ${site}`,
    credit,
    tags.map(t => `#${t}`).join(' '),
  ].filter(Boolean)
  const hook = titleOf(pl, type, n)
  const page = { title: `${hook} #shorts`, description: lines.join('\n\n'), tags: tags.join(', ') }
  // The same short in Reels and on TikTok (plan 251): the item's own two hashtags among the five.
  const feed = {
    hook, lines: [head, c.ask], app: fr ? 'Continue sur Tsuji.' : 'Keep going on Tsuji.', credits: [credit],
    hashtags: [base[1], base[0], ...c.tags.slice(0, 2), '日本語'],
  }
  return { ...page, feeds: feedPosts(page, feed, pl.lang) }
}
