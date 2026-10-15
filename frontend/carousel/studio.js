// ── カルーセル — the studio (plans 210, 210c) ──────────────────────
// Pick what to post (a sentence, a translation, a grammar lesson, a word,
// a kanji, a kana, a passage), see it drawn as every type of carousel it
// can be side by side, keep one, pick its questions, export its slides.
// Everything a slide says comes from bank/*.json
// (backend/scripts/carousel_bank.py) through sources.js and quizzes.js;
// everything it looks like, from slides.js.
/* global JSZip */
import { ENDING_IDS, FORMATS, TYPES, TYPE_OPTIONS, available, deck, endingSlide } from './slides.js'
import { FONT_FACES, font, palette } from './draw.js'
import { BONUS, LEVELS, MAX_QUESTIONS, OPTIONAL, SOURCES, TITLE_MAX, depsOf, itemsOf, picked, plan, sampleText, sourceOf, titleOf } from './sources.js'
import { STRINGS } from './strings.js'
import { PROMO, STORIES } from './promo.js'
import { PRINT_HOURS, loadPrint } from './app.js'
import { RATE, clipAudio, decoded, loadVoices } from './sound.js'
import { voiceSpan } from './echo.js'
import { LONG_SITE, describe as describeLong, drawLong, longCommand, longFiles, longItems, longListFiles, longPick, longPlan, timeline, WIDE } from './long.js'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'

const STORE = 'tsuji-carousel'
const $ = sel => document.querySelector(sel)

// What each optional slide is called in the settings.
const TOGGLE_LABELS = {
  words: 'Word by word', grammar: 'Grammar at work, stacked particles', watch: 'Watch out',
  more: 'Other sentences with the point', check: 'The questions picked, at the end',
  yourturn: 'Your turn (composition)', rating: 'How did you do? (self-check)', outro: 'The station, last',
  examples: 'Examples', scene: 'Conversation, and what would you say?', twist: 'Twist', usage: 'A second twist',
  rival: 'The point it is confused with', parts: 'Its kanji', family: 'More words with its kanji',
  strokes: 'Stroke order', readings: 'Readings', lookalike: 'Lookalikes', vocab: 'Words to know first',
  cover: 'Cover page', sheet: 'Answer sheet', recap: 'Recap of the list',
  apart: 'What tells them apart', pair: 'The two side by side', careful: 'Watch out',
}
const T = STRINGS.en
const LIST_NAME = { long: 'Video', promo: 'Story', echo: 'Word', sentence: 'Sentence', translation: 'Sentence', lesson: 'Grammar point', word: 'Word', kanji: 'Kanji', kana: 'Kana', passage: 'Passage', theme: 'Theme', lookalike: 'Set', dialogue: 'Conversation', trap: 'Trap' }

const DEFAULTS = {
  source: 'sentence', level: 'N5', kanaSet: 'hiragana', story: 'pitch', hour: 'day', ids: { sentence: 'N5.4', translation: 'N5.4', 'promo:card': '友達::ともだち', 'promo:analyser': 'N5.4', 'promo:exam': 'N5.20' },
  view: 'compare', type: 'plates', format: 'post', ground: 'paper',
  lang: 'en', script: 'kanji', romaji: false, bonus: 'kanji', kanji: '', handle: '', safe: false, slides: {},
  picks: {}, types: {}, ending: 'mark',
}
const state = load()
const files = new Map()
const work = document.createElement('canvas')

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}')
    // Plan 210c retired the departure board and the study card.
    const type = TYPES.some(x => x.id === saved.type) ? saved.type : 'plates'
    if (saved.ending && !ENDING_IDS.includes(saved.ending)) delete saved.ending
    if (saved.hour && !PRINT_HOURS.includes(saved.hour)) delete saved.hour
    if (saved.story && !STORIES.includes(saved.story)) delete saved.story
    return {
      ...DEFAULTS, ...saved, type, ids: { ...DEFAULTS.ids, ...(saved.ids || {}) }, slides: { ...(saved.slides || {}) },
      picks: { ...(saved.picks || {}) }, types: { ...(saved.types || {}) },
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)) } catch { /* a private window keeps nothing */ }
}

function fetchJson(name) {
  if (!files.has(name)) {
    files.set(name, fetch(`bank/${name}`, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`bank/${name}: ${r.status}`)
      return r.json()
    }).catch(e => {
      // A failed file is asked for again next time, not remembered.
      files.delete(name)
      throw e
    }))
  }
  return files.get(name)
}
// A source with sets of its own (kana's two scripts, the promo stories)
// keeps the one picked under its own key.
const setKey = src => (src.id === 'promo' ? 'story' : 'kanaSet')
// A promo story keeps its own pick: a word, a sentence, a question.
const idKey = () => (state.source === 'promo' ? `promo:${state.story}` : state.source)
const fileFor = src => src.file(src.levels ? state[setKey(src)] : state.level)
// A long video reads several bank files at once, by name (long.js says which).
async function banksOf(names) {
  const out = {}
  await Promise.all([...new Set(names)].map(async n => { out[n] = await fetchJson(n) }))
  return out
}
const dataNow = () => (state.source === 'long' ? banksOf(longListFiles(state.level)) : fetchJson(fileFor(sourceOf(state.source))))

// Where the app's own files are, as the page sees them: the print, the voices.
const BASE = '../'
// Today's print of the hour, for the promo stories: fetched once an hour.
const prints = new Map()
function printFor(hour) {
  if (!prints.has(hour)) prints.set(hour, loadPrint(hour, { base: BASE }).catch(e => { prints.delete(hour); throw e }))
  return prints.get(hour)
}
// A word echo's voice (plan 213): voices/index.json names each reading's
// clip; the clip is decoded once, and where its voice starts and stops
// measured from the sound.
const spoken = new Map()
function voiceFor(reading) {
  if (!spoken.has(reading)) {
    spoken.set(reading, (async () => {
      const index = await (await fetch('voices/index.json', { cache: 'no-cache' })).json()
      const file = index.words[reading]
      if (!file) throw new Error(`no voice for ${reading}`)
      const src = `voices/${file}`
      const audio = await decoded(src)
      return { src, ...voiceSpan(audio.getChannelData(0), audio.sampleRate) }
    })().catch(e => { spoken.delete(reading); throw e }))
  }
  return spoken.get(reading)
}

// ── Fonts: the canvas draws only what the document has loaded ──
const loaded = new Set()
async function fonts(text) {
  const want = [...text].filter(c => !loaded.has(c)).join('')
  if (!want) return
  await Promise.all(FONT_FACES.map(([fam, w]) => document.fonts.load(font(w, 40, fam), want).catch(() => [])))
  for (const c of want) loaded.add(c)
}

// ── The source, its levels, its list ──────────────────────────
function renderSources() {
  const box = $('#sources')
  box.replaceChildren()
  const lines = palette(state.ground).line
  for (const s of SOURCES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'source'
    b.dataset.source = s.id
    b.setAttribute('aria-pressed', String(s.id === state.source))
    b.style.setProperty('--src', lines[s.line] || palette(state.ground).gold)
    const jp = document.createElement('b')
    jp.lang = 'ja'
    jp.textContent = s.jp
    const name = document.createElement('span')
    name.textContent = s.name.en
    b.append(jp, name)
    box.append(b)
  }
}

function renderLevels() {
  const box = $('#levels')
  box.replaceChildren()
  const src = sourceOf(state.source)
  // A theme, a set of kanji and a conversation are one list, not a level's.
  box.hidden = !!src.noLevels
  if (src.noLevels) return
  const options = src.levels || LEVELS
  const current = src.levels ? state[setKey(src)] : state.level
  for (const lv of options) {
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset.level = lv
    b.textContent = src.levelNames?.[lv] || (lv === 'hiragana' ? 'ひらがな' : lv === 'katakana' ? 'カタカナ' : lv)
    if (src.levels && !src.levelNames) b.lang = 'ja'
    b.setAttribute('aria-pressed', String(lv === current))
    box.append(b)
  }
}

let listCache = []
let listShown = []
let listToken = 0
const LIST_MAX = 400
async function renderList() {
  // Only the latest call draws: a slower file for a level left behind
  // never overwrites the list of the one picked after it.
  const mine = ++listToken
  const data = await dataNow()
  if (mine !== listToken) return
  const src = sourceOf(state.source)
  let items = state.source === 'long' ? longItems(data, state.level, state.lang) : itemsOf(state.source, data, state.lang, src.levels ? state[setKey(src)] : null)
  if (src.byLevel) items = items.filter(x => x.tag === state.level)
  listCache = items
  const q = $('#search').value.trim().toLowerCase()
  const list = $('#items')
  list.replaceChildren()
  const shown = items.filter(x => !q || [x.jp, x.sub, x.tag].some(v => String(v || '').toLowerCase().includes(q)))
  listShown = shown
  $('#count').textContent = shown.length > LIST_MAX ? `first ${LIST_MAX} of ${shown.length}` : `${shown.length}`
  $('#list-name').textContent = state.source === 'promo' ? PROMO.en.lists[state.story] : LIST_NAME[state.source]
  const current = currentId(items)
  for (const x of shown.slice(0, LIST_MAX)) {
    const li = document.createElement('li')
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sentence'
    b.setAttribute('aria-pressed', String(x.id === current))
    b.dataset.id = x.id
    const jp = document.createElement('span')
    jp.className = 'sentence__jp'
    jp.lang = 'ja'
    jp.textContent = x.jp
    const sub = document.createElement('span')
    sub.className = 'sentence__tr'
    sub.textContent = x.sub
    const tag = document.createElement('span')
    tag.className = 'sentence__pt'
    tag.lang = 'ja'
    tag.textContent = x.tag
    b.append(jp, sub, tag)
    li.append(b)
    list.append(li)
  }
  list.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' })
}
function currentId(items = listCache) {
  const id = state.ids[idKey()]
  return items.some(x => x.id === id) ? id : items[0]?.id
}

function renderToggles() {
  const box = $('#toggles')
  box.replaceChildren()
  const mine = state.slides[state.source] || {}
  for (const [key, def] of OPTIONAL[state.source] || []) {
    const label = document.createElement('label')
    label.className = 'check'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = mine[key] ?? def
    input.addEventListener('change', () => {
      state.slides[state.source] = { ...(state.slides[state.source] || {}), [key]: input.checked }
      save()
      render()
    })
    label.append(input, ` ${TOGGLE_LABELS[key] || key}`)
    box.append(label)
  }
  $('#bonus-field').hidden = !BONUS.has(state.source)
  // The chosen type's own options.
  const tbox = $('#type-toggles')
  tbox.replaceChildren()
  const theirs = state.types[state.type] || {}
  for (const [key, def] of TYPE_OPTIONS[state.type] || []) {
    const label = document.createElement('label')
    label.className = 'check'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = theirs[key] ?? def
    input.addEventListener('change', () => {
      state.types[state.type] = { ...(state.types[state.type] || {}), [key]: input.checked }
      save()
      render()
    })
    label.append(input, ` ${TOGGLE_LABELS[key] || key}`)
    tbox.append(label)
  }
  tbox.closest('.field').hidden = !(TYPE_OPTIONS[state.type] || []).length
  $('#type-name').textContent = T.types[state.type].name
}

// ── The last slide ────────────────────────────────────────────
function renderEndings() {
  const box = $('#endings')
  box.replaceChildren()
  for (const id of ENDING_IDS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.dataset.set = `ending:${id}`
    b.setAttribute('aria-pressed', String(state.ending === id))
    b.textContent = T.end.names[id]
    box.append(b)
  }
}

// ── The carousel types, and the questions ─────────────────────
function renderTypes(pl) {
  const box = $('#types')
  box.replaceChildren()
  for (const ty of TYPES) {
    const ok = !pl || available(ty.id, pl)
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'dir'
    b.dataset.set = `type:${ty.id}`
    b.disabled = !ok
    b.title = ok ? T.types[ty.id].desc : `${T.types[ty.id].desc} (not for this item)`
    b.setAttribute('aria-pressed', String(state.type === ty.id))
    const jp = document.createElement('b')
    jp.lang = 'ja'
    jp.textContent = ty.jp
    const name = document.createElement('span')
    name.textContent = T.types[ty.id].name
    b.append(jp, name)
    box.append(b)
  }
}
const pickKey = () => `${idKey()}:${currentId()}`
function renderQuestions(pl) {
  const box = $('#questions')
  box.replaceChildren()
  const field = box.closest('.field')
  field.hidden = !pl?.quizzes?.length
  if (field.hidden) return
  // As many as the deck asks: three on a mock exam, one at the walk's end.
  const chosen = new Set(picked(pl, state.picks[pickKey()], state.type === 'exam' ? 3 : 1).map(q => q.id))
  for (const q of pl.quizzes) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.setAttribute('aria-pressed', String(chosen.has(q.id)))
    b.textContent = q.label
    b.title = q.ask
    b.addEventListener('click', () => {
      const next = new Set(chosen)
      if (next.has(q.id)) next.delete(q.id)
      else if (next.size < MAX_QUESTIONS) next.add(q.id)
      else return
      if (!next.size) return
      state.picks[pickKey()] = pl.quizzes.map(x => x.id).filter(x => next.has(x))
      save()
      render()
    })
    box.append(b)
  }
}

// ── What else a word's carousel reads ─────────────────────────
async function depsFor(data, id) {
  if (state.source !== 'word') return {}
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

// ── The slides ────────────────────────────────────────────────
let current = { decks: [], plan: null }
let token = 0
let captionFor = ''
let titleFor = ''

async function render() {
  const mine = ++token
  stopPlayer()
  document.body.dataset.mode = state.source === 'long' ? 'long' : ''
  // A render a newer one has overtaken stops at its next await, before it
  // touches the page or the state.
  const data = await dataNow()
  if (mine !== token) return
  if (!listCache.length) await renderList()
  if (mine !== token) return
  if (state.source === 'long') return renderLong(mine)
  const id = currentId()
  const deps = await depsFor(data, id)
  if (mine !== token) return
  const figures = (await fetchJson('index.json').catch(() => null))?.figures
  if (mine !== token) return
  const opts = { ...state, figures, ending: state.ending }
  const promo = state.source === 'promo'
  // A promo story's Today stands on the print of the hour (plan 212).
  if (promo) {
    opts.print = await printFor(state.hour).catch(e => { status(`Today's print did not load (${e.message}).`); return null })
    if (mine !== token) return
  }
  const pl = plan(state.source, data, id, opts, deps)
  if (!pl) return
  // A word echo is timed on its voice: heard before it is drawn.
  const echo = state.source === 'echo'
  if (echo) {
    opts.voice = await voiceFor(pl.echo.word.r).catch(e => { status(`The word's voice did not load (${e.message}).`); return null })
    if (mine !== token) return
  }
  // A clip (a promo story, a word echo) is a story and nothing else.
  const clipped = promo || echo
  opts.picks = state.picks[pickKey()]
  // A type the item cannot be drawn as falls back to the walk.
  const types = TYPES.map(x => x.id).filter(x => available(x, pl))
  if (!types.includes(state.type)) { state.type = types.includes('plates') ? 'plates' : types[0]; renderToggles() }
  for (const el of document.querySelectorAll('[data-promo]')) el.hidden = el.dataset.promo === 'only' ? !promo : clipped
  $('#export-clip').hidden = !clipped
  $('#export-clip').textContent = echo ? 'Download the clip (.mp4, 10 s, with the voice)' : 'Download the cover clip (.mp4, 7 s, with sound)'
  renderKanjiPicker(pl)
  renderTypes(pl)
  renderQuestions(pl)
  await fonts(sampleText(pl))
  if (mine !== token) return
  // A story is 9:16, whatever the post's format.
  const fmt = FORMATS[clipped ? 'story' : state.format]
  const ids = state.view === 'compare' ? types : [state.type]
  current = { plan: pl, fmt, decks: ids.map(d => ({ id: d, slides: deck(d, pl, fmt, opts) })) }
  const typeName = id => (promo ? PROMO.en.names[state.story] : T.types[id].name)
  $('#export-name').textContent = typeName(state.type)
  const stage = $('#stage')
  stage.replaceChildren()
  stage.dataset.view = state.view
  stage.style.setProperty('--ratio', `${fmt.w} / ${fmt.h}`)
  for (const d of current.decks) {
    const dir = { ...TYPES.find(x => x.id === d.id), name: { en: typeName(d.id) } }
    const row = document.createElement('section')
    row.className = 'deck'
    row.setAttribute('aria-label', dir.name.en)
    const head = document.createElement('div')
    head.className = 'deck__head'
    const name = document.createElement('h2')
    name.className = 'deck__name'
    const jp = document.createElement('span')
    jp.lang = 'ja'
    jp.className = 'deck__jp'
    jp.textContent = dir.jp
    name.append(jp, ` ${dir.name.en}`)
    const n = document.createElement('span')
    n.className = 'deck__count'
    n.textContent = `${d.slides.length} slides`
    head.append(name, n)
    if (state.view === 'compare' && !clipped) {
      const keep = document.createElement('button')
      keep.type = 'button'
      keep.className = 'btn btn--quiet'
      keep.textContent = 'Use this one'
      keep.addEventListener('click', () => { state.type = d.id; state.view = 'single'; sync(); render() })
      head.append(keep)
    }
    const strip = document.createElement('div')
    strip.className = 'strip'
    d.slides.forEach((slide, i) => {
      const fig = document.createElement('button')
      fig.type = 'button'
      fig.className = 'slide'
      fig.setAttribute('aria-label', `${dir.name.en}, slide ${i + 1}: ${slide.key}`)
      const c = document.createElement('canvas')
      fig.append(c)
      if (state.safe) fig.append(safeZone(fmt))
      fig.addEventListener('click', () => openViewer(d, i))
      strip.append(fig)
      requestAnimationFrame(() => { if (mine === token) thumb(c, slide, fmt) })
    })
    row.append(head, strip)
    stage.append(row)
  }
  // Every ending side by side, to pick the last slide from (a story ends on its own).
  if (state.view === 'compare' && !clipped) {
    const row = document.createElement('section')
    row.className = 'deck'
    row.setAttribute('aria-label', 'Last slide')
    const head = document.createElement('div')
    head.className = 'deck__head'
    const name = document.createElement('h2')
    name.className = 'deck__name'
    const jp = document.createElement('span')
    jp.lang = 'ja'
    jp.className = 'deck__jp'
    jp.textContent = '終点'
    name.append(jp, ' Last slide')
    const n = document.createElement('span')
    n.className = 'deck__count'
    n.textContent = 'pick one'
    head.append(name, n)
    const strip = document.createElement('div')
    strip.className = 'strip'
    for (const id of ENDING_IDS) {
      const slide = endingSlide(id, state.type, pl, fmt, opts)
      const fig = document.createElement('button')
      fig.type = 'button'
      fig.className = 'slide slide--ending'
      fig.setAttribute('aria-pressed', String(state.ending === id))
      fig.setAttribute('aria-label', `Last slide: ${T.end.names[id]}`)
      fig.title = T.end.names[id]
      const c = document.createElement('canvas')
      fig.append(c)
      fig.addEventListener('click', () => { state.ending = id; sync(); render() })
      strip.append(fig)
      requestAnimationFrame(() => { if (mine === token) thumb(c, slide, fmt) })
    }
    row.append(head, strip)
    stage.append(row)
  }
  // The caption is written when the item or its language changes, never
  // over the reader's own edits on a redraw.
  const captionKey = `${state.source}|${state.story}|${pl.id}|${state.lang}|${state.type === 'spelling'}|${state.type === 'impostor'}`
  if (captionKey !== captionFor) { $('#caption').value = captionOf(pl); captionFor = captionKey }
  // The title names the type and the questions asked too (plan 210l).
  const asked = state.type === 'exam' ? picked(pl, state.picks[pickKey()], 3).length : 1
  const titleKey = `${captionKey}|${state.type}|${asked}`
  if (titleKey !== titleFor) { $('#title').value = titleOf(pl, state.type, asked); titleFor = titleKey; countTitle() }
  $('#export').disabled = false
}

// ── The long videos (plan 214) ────────────────────────────────
// A video is drawn here as it will be made: the same frames, the same
// timeline, played in place. Its voices are made where it is rendered
// (long/render.mjs, with the voice engine), so the preview is silent and
// its timing a close guess: every line is measured when it is voiced.
let player = null
function stopPlayer() {
  if (player?.raf) cancelAnimationFrame(player.raf)
  if (player) player.raf = 0
}
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
async function renderLong(mine) {
  const id = currentId()
  const banks = await banksOf([...longListFiles(state.level), ...longFiles(id, state.level), 'index.json'])
  if (mine !== token) return
  const { kind, opts } = longPick(id, state.level, state.lang)
  const pl = longPlan(kind, banks, opts)
  const tl = timeline(pl)
  const page = describeLong(pl, tl, state.lang === 'en' ? `${LONG_SITE}/en` : LONG_SITE, banks['index.json']?.figures)
  await fonts(JSON.stringify(pl.items).slice(0, 40000) + pl.title + page.title)
  if (mine !== token) return
  current = { plan: pl, fmt: WIDE, decks: [], long: { id, page, tl } }
  const stage = $('#stage')
  stage.replaceChildren()
  stage.dataset.view = 'long'
  const row = document.createElement('section')
  row.className = 'deck'
  row.setAttribute('aria-label', 'Long video')
  const head = document.createElement('div')
  head.className = 'deck__head'
  const name = document.createElement('h2')
  name.className = 'deck__name'
  const jp = document.createElement('span')
  jp.lang = 'ja'
  jp.className = 'deck__jp'
  jp.textContent = '長編'
  name.append(jp, ` ${pl.title}`)
  const n = document.createElement('span')
  n.className = 'deck__count'
  n.textContent = `about ${clock(tl.seconds)} · ${pl.items.length} stations · 16:9`
  head.append(name, n)
  const screen = document.createElement('div')
  screen.className = 'player'
  const c = document.createElement('canvas')
  c.width = WIDE.w
  c.height = WIDE.h
  c.setAttribute('aria-label', 'The video, drawn frame by frame')
  screen.append(c)
  const bar = document.createElement('div')
  bar.className = 'player__bar'
  const play = document.createElement('button')
  play.type = 'button'
  play.className = 'btn btn--quiet'
  play.textContent = 'Play'
  const scrub = document.createElement('input')
  scrub.type = 'range'
  scrub.min = '0'
  scrub.max = String(tl.seconds)
  scrub.step = '0.1'
  scrub.setAttribute('aria-label', 'Where in the video')
  const time = document.createElement('span')
  time.className = 'player__time'
  bar.append(play, scrub, time)
  const note = document.createElement('p')
  note.className = 'player__note'
  note.textContent = 'A silent preview: the voices are made, and every line measured, when the video is rendered (the command below).'
  const chapters = document.createElement('ol')
  chapters.className = 'chapters'
  row.append(head, screen, bar, note, chapters)
  stage.append(row)
  player = { c, pl, tl, t: Math.min(player?.id === id ? player.t : 4.5, tl.seconds), raf: 0, id, play, scrub, time }
  const draw = () => {
    drawLong(c.getContext('2d'), pl, tl, player.t)
    scrub.value = String(player.t)
    time.textContent = `${clock(player.t)} / ${clock(tl.seconds)}`
  }
  player.draw = draw
  const seek = t => { player.t = Math.max(0, Math.min(tl.seconds, t)); draw() }
  for (const ch of tl.chapters) {
    const li = document.createElement('li')
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = `${clock(ch.at)} ${ch.title}`
    b.addEventListener('click', () => seek(ch.at + 0.01))
    li.append(b)
    chapters.append(li)
  }
  scrub.addEventListener('input', () => seek(Number(scrub.value)))
  play.addEventListener('click', () => {
    if (player.raf) { stopPlayer(); play.textContent = 'Play'; return }
    if (player.t >= tl.seconds - 0.05) player.t = 0
    play.textContent = 'Pause'
    let last = performance.now()
    const tick = now => {
      player.t = Math.min(tl.seconds, player.t + (now - last) / 1000)
      last = now
      draw()
      if (player.t >= tl.seconds) { player.raf = 0; play.textContent = 'Play'; return }
      player.raf = requestAnimationFrame(tick)
    }
    player.raf = requestAnimationFrame(tick)
  })
  draw()
  // The video's page: written when the video or its language changes.
  const key = `long|${id}|${state.level}|${state.lang}`
  if (key !== captionFor) {
    $('#caption').value = page.description
    $('#title').value = page.title
    $('#tags').value = page.tags
    captionFor = key
    titleFor = key
    countTitle()
  }
  $('#command').textContent = longCommand(id, state.level, state.lang)
}
async function exportThumb() {
  if (!current.long) return
  const c = document.createElement('canvas')
  c.width = WIDE.w
  c.height = WIDE.h
  drawLong(c.getContext('2d'), current.plan, current.long.tl, 4.5)
  const name = `tsuji-${safeName(current.long.id.replace(':', '-'))}-${state.level}-${state.lang}.png`
  const result = await offer(name, await png(c))
  status(result === 'saved' ? 'Saved the thumbnail.' : MESSAGE[result])
}

/** Draw a slide whole, at the post's own size, on the work canvas. */
function full(slide, fmt) {
  work.width = fmt.w
  work.height = fmt.h
  slide.draw(work.getContext('2d'))
  return work
}
function thumb(c, slide, fmt) {
  const box = c.parentElement.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = Math.round(box.width * dpr)
  c.height = Math.round(box.width * dpr * fmt.h / fmt.w)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  try {
    ctx.drawImage(full(slide, fmt), 0, 0, c.width, c.height)
  } catch (e) {
    status(`A slide could not be drawn (${e.message}).`)
  }
}

/** Where the feed's own chrome lands on a post: a guide, never exported. */
function safeZone(fmt) {
  const z = document.createElement('span')
  z.className = 'safe'
  z.setAttribute('aria-hidden', 'true')
  const { w, h, safe } = fmt
  z.style.setProperty('--t', `${safe.t / h * 100}%`)
  z.style.setProperty('--b', `${safe.b / h * 100}%`)
  z.style.setProperty('--l', `${safe.l / w * 100}%`)
  z.style.setProperty('--r', `${safe.r / w * 100}%`)
  return z
}

function renderKanjiPicker(pl) {
  const box = $('#kanji')
  box.replaceChildren()
  const chars = pl.kanjiChars || []
  box.closest('.field').hidden = !BONUS.has(state.source) || state.bonus !== 'kanji' || !chars.length
  for (const ch of chars) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip chip--glyph'
    b.lang = 'ja'
    b.textContent = ch
    b.setAttribute('aria-pressed', String(ch === pl.kanjiChar))
    b.addEventListener('click', () => { state.kanji = ch; save(); render() })
    box.append(b)
  }
}

// ── The viewer: one slide at its size ─────────────────────────
let viewing = null
function openViewer(d, i) {
  viewing = { d, i }
  const dialog = $('#viewer')
  if (!dialog.open) dialog.showModal()
  drawViewer()
}
function drawViewer() {
  const { d, i } = viewing
  const fmt = current.fmt
  const c = $('#viewer canvas')
  c.width = fmt.w
  c.height = fmt.h
  c.getContext('2d').drawImage(full(d.slides[i], fmt), 0, 0)
  $('#viewer-title').textContent = `${i + 1} / ${d.slides.length}`
  const prev = $('#prev'), next = $('#next')
  const lost = document.activeElement
  prev.disabled = i === 0
  next.disabled = i === d.slides.length - 1
  // A button disabled under the focus hands it to the other one.
  if (lost === prev && prev.disabled) next.focus()
  if (lost === next && next.disabled) prev.focus()
}
function step(by) {
  if (!viewing) return
  const i = viewing.i + by
  if (i < 0 || i >= viewing.d.slides.length) return
  viewing.i = i
  drawViewer()
}

// ── Export ────────────────────────────────────────────────────
// In the claude.ai viewer a page cannot start a download itself: the
// `downloads` capability hands the file over, with the viewer's consent.
// Anywhere else (a local server) a plain link does it.
let downloads
function downloadsApi() {
  if (downloads === undefined) {
    downloads = window.claude?.use
      ? Promise.race([window.claude.use('downloads'), new Promise(r => setTimeout(() => r(null), 10000))]).catch(() => null)
      : Promise.resolve(null)
  }
  return downloads
}
async function offer(filename, blob) {
  const api = await downloadsApi()
  if (api) {
    try {
      await api.save({ filename, data: blob })
      return 'saved'
    } catch (e) {
      return e?.code === 'declined' ? 'declined' : 'failed'
    }
  }
  if (window.claude?.use) return 'unavailable'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'saved'
}
const png = canvas => new Promise(r => canvas.toBlob(r, 'image/png'))
const safeName = s => String(s).replace(/[\\/:*?"<>|.\s]+/g, '-').replace(/^-+|-+$/g, '')
const baseName = () => `tsuji-${state.source}-${safeName(current.plan.id)}-${state.type}-${current.fmt.id}`

async function exportZip() {
  // What was on screen when it started: a click during the export changes
  // neither the size the slides are drawn at nor the file's name.
  const d = current.decks.find(x => x.id === state.type) ?? current.decks[0]
  const fmt = current.fmt
  const name = `tsuji-${state.source}-${safeName(current.plan.id)}-${d.id}-${fmt.id}`
  const btn = $('#export')
  btn.disabled = true
  status('Drawing the slides…')
  try {
    if (typeof JSZip === 'undefined') {
      let result = 'saved'
      for (let i = 0; i < d.slides.length && result === 'saved'; i++) result = await offer(`${name}-${i + 1}.png`, await png(full(d.slides[i], fmt)))
      status(result === 'saved' ? 'Saved one image per slide.' : MESSAGE[result])
      return
    }
    const zip = new JSZip()
    for (let i = 0; i < d.slides.length; i++) {
      zip.file(`${String(i + 1).padStart(2, '0')}-${d.slides[i].key}.png`, await png(full(d.slides[i], fmt)))
    }
    zip.file('title.txt', $('#title').value)
    zip.file('caption.txt', $('#caption').value)
    const result = await offer(`${name}.zip`, await zip.generateAsync({ type: 'blob' }))
    status(result === 'saved' ? `Saved ${d.slides.length} slides, the title and the caption.` : MESSAGE[result])
  } catch (e) {
    status(`The export failed (${e.message}).`)
  } finally {
    btn.disabled = false
  }
}
async function exportOne() {
  if (!viewing) return
  const { d, i } = viewing
  const result = await offer(`${baseName()}-${i + 1}.png`, await png(full(d.slides[i], current.fmt)))
  status(result === 'saved' ? `Saved slide ${i + 1}.` : MESSAGE[result])
}
// ── The clips (plan 212) ──────────────────────────────────────
// A promo story's cover, or its call to action, in motion, seven
// seconds, encoded here as the feeds take a video: H.264 in an MP4
// (WebCodecs, muxed by mp4-muxer).
const MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm'
const CLIPS = { cover: { btn: '#export-clip', name: 'cover', said: 'cover clip' }, end: { btn: '#export-end-clip', name: 'cta', said: 'call-to-action clip' } }
async function exportClip(which = 'cover') {
  const d = current.decks[0]
  const clip = d?.slides.clips?.[which]
  if (!clip) return
  const fmt = current.fmt
  const echo = current.plan.source === 'echo'
  const { btn: sel, name: kind, said } = echo ? { btn: '#export-clip', name: 'echo', said: 'clip' } : CLIPS[which]
  const name = echo ? `tsuji-echo-${safeName(current.plan.id)}-${state.lang}` : `tsuji-${kind}-${state.story}-${safeName(current.plan.id)}-${state.lang}`
  const btn = $(sel)
  btn.disabled = true
  try {
    const config = { codec: 'avc1.640028', width: fmt.w, height: fmt.h, bitrate: 8_000_000, framerate: clip.fps }
    if (typeof VideoEncoder === 'undefined' || !(await VideoEncoder.isConfigSupported(config)).supported) {
      status('This browser cannot encode H.264 video: open the studio in Chrome, Edge or Safari.')
      return
    }
    // Its sound: AAC where the browser encodes it, else Opus, else none.
    let sound = null
    if (clip.sounds.length && typeof AudioEncoder !== 'undefined') {
      for (const [codec, muxed] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
        const audio = { codec, sampleRate: RATE, numberOfChannels: 2, bitrate: 160_000 }
        if ((await AudioEncoder.isConfigSupported(audio)).supported) { sound = { audio, muxed }; break }
      }
    }
    const { Muxer, ArrayBufferTarget } = await import(MUXER)
    const target = new ArrayBufferTarget()
    const muxer = new Muxer({
      target, fastStart: 'in-memory',
      video: { codec: 'avc', width: fmt.w, height: fmt.h, frameRate: clip.fps },
      ...(sound ? { audio: { codec: sound.muxed, numberOfChannels: 2, sampleRate: RATE } } : {}),
    })
    let failed = null
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failed = e } })
    encoder.configure(config)
    const print = clip.print ? await printFor(state.hour) : null
    const frames = clip.seconds * clip.fps
    work.width = fmt.w
    work.height = fmt.h
    const ctx = work.getContext('2d')
    for (let i = 0; i < frames && !failed; i++) {
      const t = i / clip.fps
      clip.draw(ctx, t, print ? await print.moment(t) : null)
      const frame = new VideoFrame(work, { timestamp: Math.round((i * 1e6) / clip.fps), duration: Math.round(1e6 / clip.fps) })
      encoder.encode(frame, { keyFrame: i % clip.fps === 0 })
      frame.close()
      if (i % 10 === 0) status(`Drawing the clip… ${Math.round((i / frames) * 100)}%`)
      // The encoder keeps up: never more than a second of frames waiting.
      while (encoder.encodeQueueSize > clip.fps) await new Promise(r => setTimeout(r, 10))
    }
    await encoder.flush()
    if (failed) throw failed
    if (sound) {
      status('Scoring the clip…')
      const mix = await clipAudio(clip.sounds, clip.seconds, await loadVoices(BASE))
      const audio = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: e => { failed = e } })
      audio.configure(sound.audio)
      const step = RATE / 10
      for (let at = 0; at < mix[0].length; at += step) {
        const m = Math.min(step, mix[0].length - at)
        const planar = new Float32Array(m * 2)
        planar.set(mix[0].subarray(at, at + m), 0)
        planar.set(mix[1].subarray(at, at + m), m)
        const data = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round((at / RATE) * 1e6), data: planar })
        audio.encode(data)
        data.close()
      }
      await audio.flush()
      if (failed) throw failed
    }
    muxer.finalize()
    const result = await offer(`${name}.mp4`, new Blob([target.buffer], { type: 'video/mp4' }))
    status(result === 'saved' ? `Saved the ${said}${sound ? ', with its sounds' : ' (this browser encodes no sound)'}.` : MESSAGE[result])
  } catch (e) {
    status(`The clip failed (${e.message}).`)
  } finally {
    btn.disabled = false
  }
}
const MESSAGE = { declined: 'Download cancelled.', unavailable: 'Downloads are not available in this view.', failed: 'The download did not go through. Try again.' }
function status(msg) {
  $('#status').textContent = msg || ''
}

// ── The caption to post with it ───────────────────────────────
function captionOf(pl) {
  const c = pl.caption
  const fr = pl.lang === 'fr'
  const base = fr ? ['#japonais', '#apprendrelejaponais'] : ['#japanese', '#learnjapanese']
  const tags = [...base, ...c.tags.map(t => `#${t}`), '#日本語', '#nihongo', '#tsuji'].join(' ')
  // A passage's line is the question picked for it, not always its first.
  const tr = pl.source === 'passage' ? picked(pl, state.picks[pickKey()], 1)[0]?.ask || c.tr : c.tr
  // A spelling quiz never prints the kanji it asks for: the word in kana.
  const spelling = state.type === 'spelling'
  const jp = spelling ? /（(.+)）/.exec(c.jp)?.[1] || c.jp : c.jp
  const head = [jp, c.romaji, tr].filter(Boolean).join('\n')
  // The point once: a lesson's ask names it already.
  const ask = spelling ? pl.t.spellingAsk
    : state.type === 'impostor' && pl.impostor ? pl.t.modes.impostorAsk(pl.impostor.name)
      : c.point && !c.ask.includes(c.point) ? `${c.ask} · ${c.point}` : c.ask
  return `${head}\n\n${ask}\n\n${tags}`
}
async function copyField(id, name) {
  const area = $(id)
  try {
    await navigator.clipboard.writeText(area.value)
    status(`${name} copied.`)
  } catch {
    area.select()
    status(`Select the ${name.toLowerCase()} and copy it.`)
  }
}
/** The title's length against the feed's limit. */
function countTitle() {
  // A video's title is YouTube's, a hundred characters at most.
  const max = state.source === 'long' ? 100 : TITLE_MAX
  $('#title').maxLength = max
  $('#title-count').textContent = `${[...$('#title').value].length}/${max}`
}

// ── Controls ──────────────────────────────────────────────────
function sync() {
  for (const el of document.querySelectorAll('[data-set]')) {
    const [key, value] = el.dataset.set.split(':')
    el.setAttribute('aria-pressed', String(String(state[key]) === value))
  }
  $('#romaji').checked = state.romaji
  $('#safe').checked = state.safe
  $('#handle').value = state.handle
  renderSources()
  renderLevels()
  renderToggles()
  renderEndings()
  save()
}

async function switchList() {
  listCache = []
  $('#search').value = ''
  sync()
  await renderList()
  render()
}

function wire() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-set]')
    if (!b) return
    const [key, value] = b.dataset.set.split(':')
    state[key] = value
    if (key === 'type') state.view = 'single'
    if (key === 'lang') { sync(); renderList().then(render); return }
    sync()
    render()
  })
  $('#sources').addEventListener('click', e => {
    const b = e.target.closest('[data-source]')
    if (!b || b.dataset.source === state.source) return
    state.source = b.dataset.source
    switchList()
  })
  $('#levels').addEventListener('click', e => {
    const b = e.target.closest('[data-level]')
    if (!b) return
    const src = sourceOf(state.source)
    if (src.levels) state[setKey(src)] = b.dataset.level
    else state.level = b.dataset.level
    switchList()
  })
  $('#items').addEventListener('click', e => {
    const b = e.target.closest('.sentence')
    if (!b) return
    state.ids[idKey()] = b.dataset.id
    state.kanji = ''
    for (const x of document.querySelectorAll('#items .sentence')) x.setAttribute('aria-pressed', String(x === b))
    save()
    render()
  })
  $('#search').addEventListener('input', () => renderList())
  $('#random').addEventListener('click', async () => {
    const pool = listShown.slice(0, LIST_MAX).filter(x => x.id !== currentId())
    if (!pool.length) return
    state.ids[idKey()] = pool[Math.floor(Math.random() * pool.length)].id
    state.kanji = ''
    save()
    await renderList()
    render()
  })
  $('#romaji').addEventListener('change', e => { state.romaji = e.target.checked; sync(); render() })
  $('#safe').addEventListener('change', e => { state.safe = e.target.checked; sync(); render() })
  let typing
  $('#handle').addEventListener('input', e => {
    state.handle = e.target.value.slice(0, 40)
    clearTimeout(typing)
    typing = setTimeout(() => { save(); render() }, 300)
  })
  $('#export').addEventListener('click', exportZip)
  $('#export-clip').addEventListener('click', () => exportClip('cover'))
  $('#export-end-clip').addEventListener('click', () => exportClip('end'))
  $('#copy').addEventListener('click', () => copyField('#caption', state.source === 'long' ? 'Description' : 'Caption'))
  $('#copy-tags').addEventListener('click', () => copyField('#tags', 'Tags'))
  $('#copy-command').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#command').textContent); status('Command copied: run it from frontend/.') } catch { status('Select the command and copy it.') }
  })
  $('#export-thumb').addEventListener('click', exportThumb)
  $('#copy-title').addEventListener('click', () => copyField('#title', 'Title'))
  $('#title').addEventListener('input', countTitle)
  $('#prev').addEventListener('click', () => step(-1))
  $('#next').addEventListener('click', () => step(1))
  $('#save-one').addEventListener('click', exportOne)
  $('#close').addEventListener('click', () => $('#viewer').close())
  document.addEventListener('keydown', e => {
    if (!$('#viewer').open) return
    if (e.key === 'ArrowLeft') step(-1)
    if (e.key === 'ArrowRight') step(1)
  })
  let resize
  window.addEventListener('resize', () => { clearTimeout(resize); resize = setTimeout(render, 200) })
}

async function start() {
  $('#mark').innerHTML = `<path d="${MARK_ROAD}" fill="var(--gold)"/><path d="${MARK_INK}" fill="var(--ink)"/>`
  wire()
  sync()
  try {
    await renderList()
    await render()
  } catch (e) {
    status(`The bank did not load (${e.message}). Serve this folder over http, not from a file.`)
  }
}
start()
