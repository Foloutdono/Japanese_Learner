// ── カルーセル — the studio (plans 229, 229c) ──────────────────────
// Pick what to post (a sentence, a translation, a grammar lesson, a word,
// a kanji, a kana, a passage), see it drawn as every type of carousel it
// can be side by side, keep one, pick its questions, export its slides.
// Everything a slide says comes from bank/*.json
// (backend/scripts/carousel_bank.py) through sources.js and quizzes.js;
// everything it looks like, from slides.js.
/* global JSZip */
import { ENDING_IDS, FORMATS, TYPES, TYPE_OPTIONS, available, deck, endingSlide } from './slides.js'
import { DESIGNS, WORDS as FUNNEL } from './funnel.js'
import { FITS, FONT_FACES, drawFeedHud, font, formatOf, palette } from './draw.js'
import { BONUS, LEVELS, MAX_QUESTIONS, OPTIONAL, SOURCES, TITLE_MAX, itemsOf, picked, plan, sampleText, sourceOf, titleOf } from './sources.js'
import { STRINGS } from './strings.js'
import { PROMO, STORIES } from './promo.js'
import { PRINT_HOURS, loadPrint } from './app.js'
import { RATE, clipAudio, decoded, loadVoices } from './sound.js'
import { voiceSpan } from './echo.js'
import { STYLES as CHALLENGE_STYLES, TRACK, TRACKS, challengeCommand, challengePage, challengePlan, challengeTimeline, drawChallenge } from './challenge.js'
import { FPS as SHORT_FPS, chars, depsFor as depsOfWord, drawShortFrame, recipeOf, shortTimeline } from './short.js'
import { LONG_SITE, TALL, describe as describeLong, drawLong, fitShort, longCommand, longFiles, longItems, longListFiles, longPick, longPlan, stillAt, timeline, WIDE } from './long.js'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'
import { TUNABLES, changed, tuned, tuneFlag, tunablesFor } from './tune.js'
import { FEEDS } from './feeds.js'
import { STYLES as WORDS_STYLES, drawWords, wordsCommand, wordsFiles, wordsItems, wordsPage, wordsPlan, wordsStillAt, wordsTimeline } from './words.js'

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
const LIST_NAME = { long: 'Video', words: 'Short', challenge: 'Text', promo: 'Story', echo: 'Word', sentence: 'Sentence', short: 'Sentence', translation: 'Sentence', lesson: 'Grammar point', word: 'Word', kanji: 'Kanji', kana: 'Kana', passage: 'Passage', theme: 'Theme', lookalike: 'Set', dialogue: 'Conversation', trap: 'Trap' }

const DEFAULTS = {
  source: 'sentence', level: 'N5', longFormat: 'long', kanaSet: 'hiragana', story: 'pitch', hour: 'day', ids: { sentence: 'N5.4', translation: 'N5.4', 'promo:card': '友達::ともだち', 'promo:analyser': 'N5.4', 'promo:exam': 'N5.20' },
  view: 'compare', type: 'plates', format: 'post', fit: 'tiktok', ground: 'paper',
  lang: 'en', script: 'kanji', romaji: false, bonus: 'kanji', kanji: '', handle: '', safe: false, slides: {},
  picks: {}, types: {}, ending: 'mark',
  // Plan 234: the conversion carousel, its look, its length, the feature it shows.
  design: 'clarte', length: '5', feature: 'auto',
  // Plan 247: how a reading challenge's text moves.
  challengeStyle: 'scroll',
  // Plan 248: the values tuned in the Tune panel (tune.js), only those changed.
  tune: {},
  // Plan 251: the feed whose post a 9:16 video's fields hold.
  feed: 'shorts',
  // Plan 252: a vocabulary short's look, and whether a video plays its bed of music.
  wordsStyle: 'card', bed: 'on',
}
const state = load()
// The type drawn: the one chosen (state.type) where the item can be drawn
// as it, else the walk. The choice is kept, so an item without Build or
// a visit to the promo stories does not lose it (plan 248).
let shown = state.type
const files = new Map()
const work = document.createElement('canvas')

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}')
    // Plan 229c retired the departure board and the study card.
    const type = TYPES.some(x => x.id === saved.type) ? saved.type : 'plates'
    if (saved.ending && !ENDING_IDS.includes(saved.ending)) delete saved.ending
    if (saved.design && ![...DESIGNS, 'classic'].includes(saved.design)) delete saved.design
    if (saved.hour && !PRINT_HOURS.includes(saved.hour)) delete saved.hour
    if (saved.story && !STORIES.includes(saved.story)) delete saved.story
    if (saved.fit && !FITS.includes(saved.fit)) delete saved.fit
    if (saved.challengeStyle && !CHALLENGE_STYLES.includes(saved.challengeStyle)) delete saved.challengeStyle
    if (saved.feed && !FEEDS.includes(saved.feed)) delete saved.feed
    if (saved.wordsStyle && !WORDS_STYLES.includes(saved.wordsStyle)) delete saved.wordsStyle
    if (saved.bed && !['on', 'off'].includes(saved.bed)) delete saved.bed
    // A source, a format or a view saved before a rename is forgotten, not drawn as a blank stage.
    if (saved.source && !SOURCES.some(x => x.id === saved.source)) delete saved.source
    if (saved.format && !(saved.format in FORMATS)) delete saved.format
    if (saved.view && !['compare', 'single', 'looks'].includes(saved.view)) delete saved.view
    return {
      ...DEFAULTS, ...saved, type, ids: { ...DEFAULTS.ids, ...(saved.ids || {}) }, slides: { ...(saved.slides || {}) },
      picks: { ...(saved.picks || {}) }, types: { ...(saved.types || {}) }, tune: changed(saved.tune),
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
const dataNow = () => (state.source === 'long' ? banksOf(longListFiles(state.level)) : state.source === 'words' ? banksOf(wordsFiles(state.level)) : fetchJson(fileFor(sourceOf(state.source))))

// Where the app's own files are, as the page sees them: the print, the voices.
const BASE = '../'
// Today's print of the hour, for the promo stories: fetched once an hour.
const prints = new Map()
function printFor(hour) {
  if (!prints.has(hour)) prints.set(hour, loadPrint(hour, { base: BASE }).catch(e => { prints.delete(hour); throw e }))
  return prints.get(hour)
}
// A word echo's voice (plan 232): voices/index.json names each reading's
// clip; the clip is decoded once, and where its voice starts and stops
// measured from the sound. Published as an artifact, whose files are
// counted, the clips travel in one file (plan 248): the index names it
// (`pack`), and it holds each clip as a data URI under its name.
const spoken = new Map()
let voiceIndex = null
const voicesOf = () => (voiceIndex ||= (async () => {
  const index = await (await fetch('voices/index.json', { cache: 'no-cache' })).json()
  if (index.pack) index.packed = await (await fetch(`voices/${index.pack}`, { cache: 'no-cache' })).json()
  return index
})().catch(e => { voiceIndex = null; throw e }))
function voiceFor(reading) {
  if (!spoken.has(reading)) {
    spoken.set(reading, (async () => {
      const index = await voicesOf()
      const file = index.words[reading]
      if (!file) throw new Error(`no voice for ${reading}`)
      const src = index.packed?.[file] || `voices/${file}`
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
// A list or a redraw that fails says so, rather than leaving the last
// item on screen as if it were the one picked (plan 248).
const failed = e => status(`The studio could not draw this (${e.message}). Pick again, or reload the page.`)
async function renderList() {
  try { await listNow() } catch (e) { failed(e) }
}
async function listNow() {
  // Only the latest call draws: a slower file for a level left behind
  // never overwrites the list of the one picked after it.
  const mine = ++listToken
  const data = await dataNow()
  if (mine !== listToken) return
  const src = sourceOf(state.source)
  let items = state.source === 'long' ? longItems(data, state.level, state.lang, state.longFormat) : state.source === 'words' ? wordsItems(data, state.level, state.lang) : itemsOf(state.source, data, state.lang, src.levels ? state[setKey(src)] : null)
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
  // The item picked is always in the list, even past the first rows (Random reaches them all).
  const rows = shown.slice(0, LIST_MAX)
  const picked = shown.find(x => x.id === current)
  if (picked && !rows.includes(picked)) rows.unshift(picked)
  for (const x of rows) {
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

// ── Tune (plan 248) ──────────────────────────────────────────
// The values tune.js lets a maker set for the source in view, a slider
// each, grouped as the registry groups them: kept with the rest of the
// studio, read by the preview and written into every render command.
let tuneFor = null
const shownValue = (t, v) => (t.unit === '×' ? `${v}×` : `${v} ${t.unit}`)
function renderTune() {
  const ts = tunablesFor(state.source)
  tuneFor = state.source
  $('#tune-field').hidden = !ts.length
  const box = $('#tune')
  box.replaceChildren()
  for (const name of new Set(ts.map(t => t.group))) {
    const set = document.createElement('fieldset')
    set.className = 'tune__group'
    const legend = document.createElement('legend')
    legend.textContent = name
    set.append(legend, ...ts.filter(t => t.group === name).map(tuneRow))
    box.append(set)
  }
  syncTune()
}
function tuneRow(t) {
  const id = `tune-${t.key.replace(/\W/g, '-')}`
  const row = document.createElement('div')
  row.className = 'tune__row'
  row.dataset.tune = t.key
  const label = document.createElement('label')
  label.htmlFor = id
  label.textContent = t.label
  const out = document.createElement('output')
  out.htmlFor = id
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'tune__reset'
  reset.textContent = 'Reset'
  reset.setAttribute('aria-label', `Reset ${t.label}`)
  const input = document.createElement('input')
  Object.assign(input, { type: 'range', id, min: t.min, max: t.max, step: t.step, value: tuned(state.tune, t.key) })
  // Dragged, the figure follows; let go, the preview is drawn again.
  input.addEventListener('input', () => { out.value = shownValue(t, +input.value) })
  input.addEventListener('change', () => setTune({ ...state.tune, [t.key]: +input.value }))
  reset.addEventListener('click', () => {
    const rest = { ...state.tune }
    delete rest[t.key]
    setTune(rest)
    input.value = t.def
    input.focus()
  })
  row.append(label, out, reset, input)
  if (t.hint) {
    const hint = document.createElement('small')
    hint.textContent = `${t.hint} (default ${shownValue(t, t.def)})`
    row.append(hint)
  }
  return row
}
function setTune(tune) {
  state.tune = changed(tune)
  save()
  syncTune()
  render()
}
/** Each row's figure and reset, and the count of changed values, as the tune now stands. */
function syncTune() {
  let n = 0
  for (const row of document.querySelectorAll('#tune [data-tune]')) {
    const key = row.dataset.tune
    const t = TUNABLES.find(x => x.key === key)
    const v = tuned(state.tune, key)
    const moved = key in state.tune
    n += moved
    row.classList.toggle('is-changed', moved)
    row.querySelector('output').value = shownValue(t, v)
    row.querySelector('.tune__reset').hidden = !moved
    const input = row.querySelector('input')
    if (+input.value !== v) input.value = v
  }
  $('#tune-count').textContent = n ? `${n} changed` : 'defaults'
  $('#tune-reset').hidden = !n
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
  const theirs = state.types[shown] || {}
  for (const [key, def] of TYPE_OPTIONS[shown] || []) {
    const label = document.createElement('label')
    label.className = 'check'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = theirs[key] ?? def
    input.addEventListener('change', () => {
      state.types[shown] = { ...(state.types[shown] || {}), [key]: input.checked }
      save()
      render()
    })
    label.append(input, ` ${TOGGLE_LABELS[key] || key}`)
    tbox.append(label)
  }
  tbox.closest('.field').hidden = !(TYPE_OPTIONS[shown] || []).length
  $('#type-name').textContent = T.types[shown].name
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
    b.setAttribute('aria-pressed', String(shown === ty.id))
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
  // Only where the deck drawn asks them: the mock exam, the walk's end in
  // the classic look, a passage's caption (plan 248).
  const asks = shown === 'exam' || !DESIGNS.includes(state.design) || pl?.source === 'passage'
  field.hidden = !pl?.quizzes?.length || !asks
  if (field.hidden) return
  // As many as the deck asks: three on a mock exam, one at the walk's end.
  const chosen = new Set(picked(pl, state.picks[pickKey()], shown === 'exam' ? 3 : 1).map(q => q.id))
  for (const q of pl.quizzes) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.setAttribute('aria-pressed', String(chosen.has(q.id)))
    b.dataset.q = q.id
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
const depsFor = (data, id) => depsOfWord(state.source, data, id, fetchJson)

// ── The slides ────────────────────────────────────────────────
let current = { decks: [], plan: null }
let token = 0
let captionFor = ''
let titleFor = ''

async function render() {
  try { await renderNow() } catch (e) { failed(e) }
}
async function renderNow() {
  const fk = focusKey()
  const mine = ++token
  stopPlayer()
  // A video (a long one, a reading challenge) has a page and a command, not slides.
  document.body.dataset.mode = videoSource() ? 'long' : ''
  document.body.dataset.video = ['challenge', 'words'].includes(state.source) ? state.source : ''
  // A 9:16 video is posted to three feeds, a post each (plan 251): Reels
  // and TikTok take a caption alone.
  const feeds = ['challenge', 'words'].includes(state.source) || (state.source === 'long' && state.longFormat === 'short')
  document.body.dataset.feeds = feeds ? 'on' : ''
  document.body.dataset.post = feeds && state.feed !== 'shorts' ? 'caption' : ''
  if (tuneFor !== state.source) renderTune()
  $('#hour-field').hidden = !['promo', 'challenge'].includes(state.source)
  const funnel = DESIGNS.includes(state.design)
  // A promo story and a word echo draw the ground and the handle whatever
  // the look, so they keep those controls (plan 248).
  document.body.dataset.design = funnel && !['promo', 'echo'].includes(state.source) ? 'funnel' : 'classic'
  if (state.view === 'looks' && !funnel) state.view = 'compare'
  // A render a newer one has overtaken stops at its next await, before it
  // touches the page or the state.
  const data = await dataNow()
  if (mine !== token) return
  if (!listCache.length) await renderList()
  if (mine !== token) return
  if (state.source === 'long') return renderLong(mine)
  if (state.source === 'words') return renderWords(mine)
  if (state.source === 'challenge') return renderChallenge(mine)
  const id = currentId()
  const deps = await depsFor(data, id)
  if (mine !== token) return
  const figures = (await fetchJson('index.json').catch(() => null))?.figures
  if (mine !== token) return
  const opts = { ...state, figures, ending: state.ending }
  const promo = state.source === 'promo'
  // A promo story's Today stands on the print of the hour (plan 231).
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
  const drawn = types.includes(state.type) ? state.type : types.includes('plates') ? 'plates' : types[0]
  if (drawn !== shown) { shown = drawn; renderToggles() }
  for (const el of document.querySelectorAll('[data-promo]')) el.hidden = el.dataset.promo === 'only' ? !promo : clipped
  $('#export-clip').hidden = !clipped
  $('#export-clip').textContent = echo ? 'Download the clip (.mp4, with the voice)' : 'Download the cover clip (.mp4, 7 s, with sound)'
  renderKanjiPicker(pl)
  renderTypes(pl)
  renderQuestions(pl)
  refocus(fk)
  await fonts(sampleText(pl))
  if (mine !== token) return
  // A story is 9:16 at TikTok's margins, whatever the post's format.
  const fmt = clipped ? FORMATS.story : formatOf(state.format, state.fit)
  // Nothing is laid over a slide at normal margins: the guide shows them alone.
  $('#safe-label').textContent = fmt.fit === 'normal' ? 'Show the margins' : fmt.fit === 'instagram' ? 'Show Instagram’s crop' : 'Show the feed’s overlays'
  // All looks (plan 234): the type kept, in each look, to pick one from.
  const looks = state.view === 'looks' && !clipped
  const ids = state.view === 'compare' ? types : [shown]
  current = {
    plan: pl, fmt, figures,
    decks: looks
      ? DESIGNS.map(design => ({ id: shown, design, slides: deck(shown, pl, fmt, { ...opts, design }) }))
      : ids.map(d => ({ id: d, slides: deck(d, pl, fmt, opts) })),
  }
  $('#export-short').hidden = clipped
  $('#copy-short').hidden = clipped
  const typeName = id => (promo ? PROMO.en.names[state.story] : T.types[id].name)
  $('#export-name').textContent = typeName(shown)
  const stage = $('#stage')
  stage.replaceChildren()
  stage.dataset.view = state.view
  stage.style.setProperty('--ratio', `${fmt.w} / ${fmt.h}`)
  for (const d of current.decks) {
    const dir = d.design
      ? { jp: { clarte: '清', defi: '挑', fiche: '札' }[d.design], name: { en: `${FUNNEL.en.design[d.design]} · ${typeName(d.id)}` } }
      : { ...TYPES.find(x => x.id === d.id), name: { en: typeName(d.id) } }
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
    if ((state.view === 'compare' || looks) && !clipped) {
      const keep = document.createElement('button')
      keep.type = 'button'
      keep.className = 'btn btn--quiet'
      keep.textContent = 'Use this one'
      keep.addEventListener('click', () => { state.type = d.id; if (d.design) state.design = d.design; state.view = 'single'; sync(); render() })
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
  // Every ending side by side, to pick the last slide from (a story ends
  // on its own, a conversion carousel on its key points).
  if (state.view === 'compare' && !clipped && !funnel) {
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
      const slide = endingSlide(id, shown, pl, fmt, opts)
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
  // The questions picked are in it too: a passage's caption asks the one picked.
  const captionKey = `${state.source}|${state.story}|${pl.id}|${state.lang}|${shown === 'spelling'}|${shown === 'impostor'}|${(state.picks[pickKey()] || []).join(',')}`
  if (captionKey !== captionFor) { $('#caption').value = captionOf(pl); captionFor = captionKey }
  // The title names the type and the questions asked too (plan 229l).
  const asked = shown === 'exam' ? picked(pl, state.picks[pickKey()], 3).length : 1
  const titleKey = `${captionKey}|${shown}|${asked}`
  if (titleKey !== titleFor) { $('#title').value = titleOf(pl, shown, asked); titleFor = titleKey; countTitle() }
  $('#export').disabled = busy.has('#export')
}

// ── The long videos (plan 233) ────────────────────────────────
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
  // The video at its length, or its short: standing, under a minute.
  const short = state.longFormat === 'short'
  const size = short ? TALL : WIDE
  const { kind, opts } = longPick(id, state.level, state.lang, short ? 'short' : 'long')
  // A short at the margins chosen (plan 239): TikTok's, Instagram's or none.
  for (const el of document.querySelectorAll('[data-short]')) el.hidden = !short
  // Its bed of music, or none (plan 252): the command and the credits follow.
  const music = state.bed !== 'off'
  const pl = short ? fitShort(longPlan(kind, banks, { ...opts, fit: state.fit, tune: state.tune, music })) : longPlan(kind, banks, { ...opts, tune: state.tune, music })
  const tl = timeline(pl)
  const page = describeLong(pl, tl, state.lang === 'en' ? `${LONG_SITE}/en` : LONG_SITE, banks['index.json']?.figures)
  await fonts(JSON.stringify(pl.items).slice(0, 40000) + pl.title + page.title)
  if (mine !== token) return
  current = { plan: pl, fmt: size, decks: [], long: { id, page, tl } }
  // A reply video's stations are its questions (plan 249).
  mountVideo({
    id, jp: '長編', title: pl.title, label: 'Long video', size, tl, start: 4.5,
    count: `about ${clock(tl.seconds)} · ${pl.kind === 'reply' ? `${tl.of} questions` : `${tl.of} stations`} · ${short ? '9:16 short' : '16:9'}`,
    draw: (ctx, t) => drawLong(ctx, pl, tl, t),
  })
  // The video's page: written when the video or its language changes.
  const key = `long|${id}|${state.level}|${state.lang}|${state.longFormat}|${state.fit}|${state.feed}|${state.bed}`
  if (key !== captionFor) fillPost(page, key)
  $('#command').textContent = longCommand(id, state.level, state.lang, short ? 'short' : 'long', state.fit) + (music ? '' : ' --music none') + tuneFlag(state.tune, 'long')
}
/** A video in the stage (plans 233, 252): its head, its frames played in
 *  place, a scrub bar, its chapters. The preview is silent: the voices
 *  are made, and every line measured, where it is rendered. */
function mountVideo({ id, jp: station, title, label, size, tl, start, count, draw: paint }) {
  const stage = $('#stage')
  stage.replaceChildren()
  stage.dataset.view = 'long'
  const row = document.createElement('section')
  row.className = 'deck'
  row.setAttribute('aria-label', label)
  const head = document.createElement('div')
  head.className = 'deck__head'
  const name = document.createElement('h2')
  name.className = 'deck__name'
  const jp = document.createElement('span')
  jp.lang = 'ja'
  jp.className = 'deck__jp'
  jp.textContent = station
  name.append(jp, ` ${title}`)
  const n = document.createElement('span')
  n.className = 'deck__count'
  n.textContent = count
  head.append(name, n)
  const screen = document.createElement('div')
  screen.className = 'player'
  const c = document.createElement('canvas')
  c.width = size.w
  c.height = size.h
  c.style.aspectRatio = `${size.w} / ${size.h}`
  if (size.h > size.w) c.style.maxWidth = '420px'
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
  player = { c, tl, t: Math.min(player?.id === id ? player.t : start, tl.seconds), raf: 0, id, play, scrub, time }
  const draw = () => {
    paint(c.getContext('2d'), player.t)
    scrub.value = String(player.t)
    time.textContent = `${clock(player.t)} / ${clock(tl.seconds)}`
  }
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
}
// ── The vocabulary shorts (plan 252) ──────────────────────────
// A level's deck or a theme's words, nine at a time, as a card on washi
// or a quiz on sumi (words.js); made by the same command as the shorts.
async function renderWords(mine) {
  const id = currentId()
  const banks = await banksOf(wordsFiles(state.level))
  if (mine !== token) return
  const pl = wordsPlan(banks, id, { lang: state.lang, style: state.wordsStyle, music: state.bed !== 'off', tune: state.tune, fit: state.fit })
  const tl = wordsTimeline(pl)
  const page = wordsPage(pl, tl, state.lang === 'en' ? `${LONG_SITE}/en` : LONG_SITE, banks['index.json']?.figures)
  await fonts(`${JSON.stringify(pl.items)}${pl.title}${page.title}語彙主題`)
  if (mine !== token) return
  current = { plan: pl, fmt: TALL, decks: [], words: { id, page, tl } }
  mountVideo({
    id, jp: '語彙', title: pl.title, label: 'Word short', size: TALL, tl, start: wordsStillAt(pl, tl),
    count: `about ${clock(tl.seconds)} · ${pl.items.length} words · ${pl.style === 'quiz' ? 'quiz' : 'card'} · 9:16`,
    draw: (ctx, t) => drawWords(ctx, pl, tl, t),
  })
  const key = `words|${id}|${state.level}|${state.lang}|${state.wordsStyle}|${state.fit}|${state.feed}|${state.bed}`
  if (key !== captionFor) fillPost(page, key)
  $('#command').textContent = wordsCommand(pl, tuneFlag(state.tune, 'words'))
}
// ── The reading challenges (plan 247) ─────────────────────────
// A comprehension text as a 9:16 video over Today's print: going slowly
// up the screen as a film's credits do, or read along by the app's
// reader. Drawn here as it is made; the scroll is encoded here too, with
// the app's sounds and its music (the studio's track, or the owner's), and
// the voice of the one read along is made where it is rendered (the
// command below), every word timed on it.
const CHAPTER = { hook: 'Hook', reading: 'Reading', question: 'Question', answer: 'Answer', cta: 'The app' }
// The music laid under it: the studio's own track ({ track }), one picked
// from this computer, kept for the visit only and never stored ({ name,
// url }), or none (null).
let music = { track: TRACK }
const musicOf = () => (music?.track ?? music?.name ?? null)
const musicName = () => (music?.track ? `${TRACKS[music.track].title} · ${TRACKS[music.track].by}` : music?.name ?? 'No music')
async function renderChallenge(mine) {
  const data = await fetchJson('comprehension.json')
  if (mine !== token) return
  const id = currentId()
  const pl = challengePlan(data, id, { lang: state.lang, style: state.challengeStyle, hour: state.hour, music: musicOf(), tune: state.tune })
  $('#music-name').textContent = musicName()
  $('#music-clear').hidden = !music
  $('#music-track').hidden = Boolean(music?.track)
  const tl = challengeTimeline(pl)
  const P = await printFor(state.hour).catch(e => { status(`Today's print did not load (${e.message}).`); return null })
  await fonts(JSON.stringify(pl))
  if (mine !== token) return
  const page = challengePage(pl, tl, state.lang === 'en' ? `${LONG_SITE}/en` : LONG_SITE)
  current = { plan: pl, fmt: FORMATS.story, decks: [], challenge: { id, tl, P, page } }
  const stage = $('#stage')
  stage.replaceChildren()
  stage.dataset.view = 'long'
  const row = document.createElement('section')
  row.className = 'deck'
  row.setAttribute('aria-label', 'Reading challenge')
  const head = document.createElement('div')
  head.className = 'deck__head'
  const name = document.createElement('h2')
  name.className = 'deck__name'
  const jp = document.createElement('span')
  jp.lang = 'ja'
  jp.className = 'deck__jp'
  jp.textContent = '速読'
  name.append(jp, ` ${pl.title}`)
  const n = document.createElement('span')
  n.className = 'deck__count'
  n.textContent = `${clock(tl.seconds)} · ${pl.sents.length} sentences · ${pl.style === 'scroll' ? 'scroll' : 'read along'} · 9:16`
  head.append(name, n)
  const screen = document.createElement('div')
  screen.className = 'player'
  const c = document.createElement('canvas')
  c.width = FORMATS.story.w
  c.height = FORMATS.story.h
  c.style.aspectRatio = `${c.width} / ${c.height}`
  c.style.maxWidth = '420px'
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
  scrub.step = '0.05'
  scrub.setAttribute('aria-label', 'Where in the video')
  const time = document.createElement('span')
  time.className = 'player__time'
  bar.append(play, scrub, time)
  const note = document.createElement('p')
  note.className = 'player__note'
  note.textContent = pl.style === 'scroll'
    ? `A silent preview: the app’s sounds${music ? ' and the music' : ''} are laid under it when it is downloaded or rendered.`
    : 'A silent preview, timed on a guess: the voice is made, and every word lit on it, when the video is rendered (the command below).'
  const chapters = document.createElement('ol')
  chapters.className = 'chapters'
  row.append(head, screen, bar, note, chapters)
  stage.append(row)
  const key = `challenge|${id}|${state.lang}|${state.challengeStyle}|${state.hour}|${musicOf() || ''}`
  const reading = tl.segs.find(sg => sg.key === 'reading')
  player = { c, pl, tl, t: Math.min(player?.key === key ? player.t : reading.start + 12, tl.seconds), raf: 0, id, key, play, scrub, time }
  const draw = () => {
    drawChallenge(c.getContext('2d'), pl, tl, player.t, P)
    scrub.value = String(player.t)
    time.textContent = `${clock(player.t)} / ${clock(tl.seconds)}`
  }
  player.draw = draw
  const seek = t => { player.t = Math.max(0, Math.min(tl.seconds, t)); draw() }
  for (const sg of tl.segs) {
    const li = document.createElement('li')
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = `${clock(sg.start)} ${CHAPTER[sg.key]}`
    b.addEventListener('click', () => seek(sg.start + (sg.key === 'reading' ? 1.2 : 1.6)))
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
  // The post, for the feed chosen: a switch of feed keeps the player where it is.
  if (`${key}|${state.feed}` !== captionFor) fillPost(page, `${key}|${state.feed}`)
  $('#command').textContent = challengeCommand(pl)
  // The scroll is made here, whole; the one read along needs the voice engine.
  $('#export-video').disabled = pl.style !== 'scroll'
  $('#export-video').textContent = pl.style === 'scroll' ? `Download the video (.mp4, ${clock(tl.seconds)}${music ? `, with ${music.track ? TRACKS[music.track].title : 'your track'}` : ''})` : 'Read along is made by the command (the voice)'
}
async function exportChallenge() {
  const ch = current.challenge
  if (!ch || current.plan.style !== 'scroll') return
  // What is drawn, captured when it starts: another text picked meanwhile is not mixed in.
  const { tl, P } = ch
  const plan = current.plan
  await encodeClip({
    btn: '#export-video', name: `tsuji-challenge-${safeName(ch.id)}-${plan.hour}-${state.lang}`, said: 'reading challenge',
    fmt: FORMATS.story, fps: tl.fps, seconds: tl.seconds,
    // The track under it all, looped if it is shorter, coming in and going out.
    sounds: [...(music ? [{ at: 0, src: music.track ? TRACKS[music.track].file : music.url, gain: 0.7 * tuned(state.tune, 'music.volume'), loop: true, fade: tuned(state.tune, 'music.fade') }] : []), ...tl.sfx],
    frame: (ctx, t) => { drawChallenge(ctx, plan, tl, t, P) },
  })
}
async function exportThumb() {
  if (current.challenge) {
    const c = document.createElement('canvas')
    c.width = FORMATS.story.w
    c.height = FORMATS.story.h
    drawChallenge(c.getContext('2d'), current.plan, current.challenge.tl, 1.6, current.challenge.P)
    const result = await offer(`tsuji-challenge-${safeName(current.challenge.id)}-${state.lang}.png`, await png(c))
    status(result === 'saved' ? 'Saved the thumbnail.' : MESSAGE[result])
    return
  }
  if (current.words) {
    const c = document.createElement('canvas')
    c.width = TALL.w
    c.height = TALL.h
    drawWords(c.getContext('2d'), current.plan, current.words.tl, wordsStillAt(current.plan, current.words.tl))
    const result = await offer(`tsuji-words-${safeName(current.words.id.replace(/:/g, '-'))}-${current.plan.style}-${state.lang}.png`, await png(c))
    status(result === 'saved' ? 'Saved the thumbnail.' : MESSAGE[result])
    return
  }
  if (!current.long) return
  const c = document.createElement('canvas')
  c.width = current.fmt.w
  c.height = current.fmt.h
  drawLong(c.getContext('2d'), current.plan, current.long.tl, stillAt(current.plan, current.long.tl))
  const name = `tsuji-${current.plan.format === 'short' ? 'short-' : ''}${safeName(current.long.id.replace(':', '-'))}-${state.level}-${state.lang}.png`
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

/** Where the feed's own chrome lands on a post, or at normal margins the
 *  margins alone: a guide, never exported. */
function safeZone(fmt) {
  const z = document.createElement('span')
  z.className = 'safe'
  z.setAttribute('aria-hidden', 'true')
  const { w, h, safe } = fmt
  z.style.setProperty('--t', `${safe.t / h * 100}%`)
  z.style.setProperty('--b', `${safe.b / h * 100}%`)
  z.style.setProperty('--l', `${safe.l / w * 100}%`)
  z.style.setProperty('--r', `${safe.r / w * 100}%`)
  // On a 9:16 slide, the feed itself: TikTok's photo view, its bars and
  // its buttons; Instagram's feed, what its 4:5 crop cuts and its header.
  if (h === 1920 && fmt.fit !== 'normal') {
    const hud = document.createElement('canvas')
    hud.width = w
    hud.height = h
    hud.className = 'hud'
    drawFeedHud(hud.getContext('2d'), fmt)
    z.append(hud)
  }
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
    // A handshake that timed out is tried again on the next download, not given up for the visit.
    if (window.claude?.use) downloads.then(api => { if (!api) downloads = undefined })
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
// A slide at normal margins says so in its file's name.
const fmtName = fmt => (fmt.fit && fmt.fit !== 'tiktok' ? `${fmt.id}-${fmt.fit}` : fmt.id)
// A file names its item, its type, its look, its format and its language,
// so the English and the French, or two looks, never overwrite each other.
const lookName = d => (d?.design || (DESIGNS.includes(state.design) ? state.design : 'classic'))
const baseName = (d = viewing?.d) => `tsuji-${state.source}-${safeName(current.plan.id)}-${d?.id || shown}-${lookName(d)}-${fmtName(current.fmt)}-${state.lang}`

async function exportZip() {
  // What was on screen when it started: a click during the export changes
  // neither the size the slides are drawn at nor the file's name.
  // In All looks, the look chosen; elsewhere the type drawn.
  const d = current.decks.find(x => x.id === shown && (!x.design || x.design === state.design)) ?? current.decks[0]
  const fmt = current.fmt
  const name = baseName(d)
  const title = $('#title').value
  const caption = $('#caption').value
  const btn = $('#export')
  btn.disabled = true
  busy.add('#export')
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
    zip.file('title.txt', title)
    zip.file('caption.txt', caption)
    const result = await offer(`${name}.zip`, await zip.generateAsync({ type: 'blob' }))
    status(result === 'saved' ? `Saved ${d.slides.length} slides, the title and the caption.` : MESSAGE[result])
  } catch (e) {
    status(`The export failed (${e.message}).`)
  } finally {
    busy.delete('#export')
    btn.disabled = false
  }
}
async function exportOne() {
  if (!viewing) return
  const { d, i } = viewing
  const result = await offer(`${baseName(d)}-${i + 1}.png`, await png(full(d.slides[i], current.fmt)))
  status(result === 'saved' ? `Saved slide ${i + 1}.` : MESSAGE[result])
}
// ── The clips (plan 231) ──────────────────────────────────────
// A promo story's cover, or its call to action, in motion, seven
// seconds, encoded here as the feeds take a video: H.264 in an MP4
// (WebCodecs, muxed by mp4-muxer).
const MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm'
const CLIPS = { cover: { btn: '#export-clip', name: 'cover', said: 'cover clip' }, end: { btn: '#export-end-clip', name: 'cta', said: 'call-to-action clip' } }
async function exportClip(which = 'cover') {
  const d = current.decks[0]
  const clip = d?.slides.clips?.[which]
  if (!clip) return
  const echo = current.plan.source === 'echo'
  const { btn, name: kind, said } = echo ? { btn: '#export-clip', name: 'echo', said: 'clip' } : CLIPS[which]
  const name = echo ? `tsuji-echo-${safeName(current.plan.id)}-${state.lang}` : `tsuji-${kind}-${state.story}-${safeName(current.plan.id)}-${state.lang}`
  let print = null
  try {
    print = clip.print ? await printFor(state.hour) : null
  } catch (e) {
    status(`Today's print did not load (${e.message}).`)
    return
  }
  await encodeClip({
    btn, name, said, fmt: current.fmt, fps: clip.fps, seconds: clip.seconds, sounds: clip.sounds,
    frame: async (ctx, t) => { clip.draw(ctx, t, print ? await print.moment(t) : null) },
  })
}

// ── A carousel as a short video (plan 233) ────────────────────
// Its slides standing, each held as long as it reads, swiped to the
// next, with the app's sounds (short.js). The voice and the music are
// the render command's: long/render.mjs --carousel.
function shortRecipe() {
  // What the carousel is drawn from, without the studio's memory of every other one.
  const rest = Object.fromEntries(Object.entries(state).filter(([key]) => !['ids', 'picks', 'kanaSet', 'story'].includes(key)))
  const src = sourceOf(state.source)
  return { ...rest, set: src.levels ? state[setKey(src)] : null, id: currentId(), picks: state.picks[pickKey()] }
}
async function exportShort() {
  if (!current.plan || clippedSource()) return
  const fmt = formatOf('story', state.fit)
  const slides = deck(shown, current.plan, fmt, { ...state, figures: current.figures, picks: state.picks[pickKey()] })
  work.width = fmt.w
  work.height = fmt.h
  const counts = slides.map(sl => chars(sl, work.getContext('2d')))
  const tl = shortTimeline(slides, counts, null, null, state.tune)
  await encodeClip({
    btn: '#export-short', name: `tsuji-short-${state.source}-${safeName(current.plan.id)}-${shown}-${state.lang}`, said: 'short video',
    fmt, fps: SHORT_FPS, seconds: tl.seconds, sounds: tl.sfx,
    frame: (ctx, t) => { drawShortFrame(ctx, slides, tl, t, fmt) },
  })
}
const clippedSource = () => ['promo', 'echo', 'long', 'challenge', 'words'].includes(state.source)
const videoSource = () => ['long', 'challenge', 'words'].includes(state.source)

/** A clip encoded as the feeds take a video, H.264 in an MP4 with its sounds. */
// The H.264 level a size and a rate need: 4.0 holds 1080×1920 at 30
// frames a second, 4.2 at 60 (245,760 and 522,240 macroblocks a second).
const avcCodec = (w, h, fps) => (Math.ceil(w / 16) * Math.ceil(h / 16) * fps > 245_760 ? 'avc1.64002A' : 'avc1.640028')
// The exports in flight, by their button: a redraw never re-enables one (plan 248).
const busy = new Set()
async function encodeClip({ btn: sel, name, said, fmt, fps, seconds, sounds, frame }) {
  const btn = $(sel)
  btn.disabled = true
  busy.add(sel)
  // Its own canvas: a redraw, a PNG or another export never resizes it between two frames.
  const canvas = document.createElement('canvas')
  canvas.width = fmt.w
  canvas.height = fmt.h
  try {
    // The bitrate tuned for thirty frames a second, scaled with the rate.
    const bitrate = Math.round(tuned(state.tune, 'export.mbps') * 1e6 * Math.max(1, fps / 30))
    const config = { codec: avcCodec(fmt.w, fmt.h, fps), width: fmt.w, height: fmt.h, bitrate, framerate: fps }
    if (typeof VideoEncoder === 'undefined' || !(await VideoEncoder.isConfigSupported(config)).supported) {
      status('This browser cannot encode H.264 video: open the studio in Chrome, Edge or Safari.')
      return
    }
    // Its sound: AAC where the browser encodes it, else Opus, else none.
    let sound = null
    if (sounds.length && typeof AudioEncoder !== 'undefined') {
      for (const [codec, muxed] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
        const audio = { codec, sampleRate: RATE, numberOfChannels: 2, bitrate: tuned(state.tune, 'export.audio') * 1000 }
        if ((await AudioEncoder.isConfigSupported(audio)).supported) { sound = { audio, muxed }; break }
      }
    }
    const { Muxer, ArrayBufferTarget } = await import(MUXER)
    const target = new ArrayBufferTarget()
    const muxer = new Muxer({
      target, fastStart: 'in-memory',
      video: { codec: 'avc', width: fmt.w, height: fmt.h, frameRate: fps },
      ...(sound ? { audio: { codec: sound.muxed, numberOfChannels: 2, sampleRate: RATE } } : {}),
    })
    // The sound is scored first, while every clip it names is still there:
    // a track picked again during a long export is a revoked address.
    let mix = null
    if (sound) {
      status(`Scoring the ${said}…`)
      mix = await clipAudio(sounds, seconds, await loadVoices(BASE))
    }
    let failed = null
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failed = e } })
    encoder.configure(config)
    const frames = Math.round(seconds * fps)
    const ctx = canvas.getContext('2d')
    const key = Math.max(1, Math.round(tuned(state.tune, 'export.keyframe') * fps))
    let said5 = -1
    for (let i = 0; i < frames && !failed; i++) {
      await frame(ctx, i / fps)
      const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
      encoder.encode(vf, { keyFrame: i % key === 0 })
      vf.close()
      // Told every five per cent, not every few frames: a screen reader reads each.
      const pct = Math.floor((i / frames) * 20) * 5
      if (pct !== said5) { said5 = pct; status(`Drawing the ${said}… ${pct}%`) }
      // The encoder keeps up: never more than a second of frames waiting.
      while (encoder.encodeQueueSize > fps) await new Promise(r => setTimeout(r, 10))
    }
    await encoder.flush()
    encoder.close()
    if (failed) throw failed
    if (mix) {
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
      audio.close()
      if (failed) throw failed
    }
    muxer.finalize()
    const result = await offer(`${name}.mp4`, new Blob([target.buffer], { type: 'video/mp4' }))
    status(result === 'saved' ? `Saved the ${said}${sound ? ', with its sounds' : ' (this browser encodes no sound)'}.` : MESSAGE[result])
  } catch (e) {
    status(`The ${said} failed (${e.message}).`)
  } finally {
    busy.delete(sel)
    btn.disabled = false
  }
}
const MESSAGE = { declined: 'Download cancelled.', unavailable: 'Downloads are not available in this view.', failed: 'The download did not go through. Try again.' }
function status(msg) {
  $('#status').textContent = msg || ''
}

// ── The caption to post with it ───────────────────────────────
/** A video's post in the fields: a 16:9 video's YouTube page, a 9:16
 *  one's for the feed chosen (plan 251). */
function fillPost(page, key) {
  const post = page.feeds?.[state.feed] || page
  $('#caption').value = post.caption ?? post.description
  $('#title').value = post.title ?? ''
  $('#tags').value = post.tags ?? ''
  captionFor = key
  titleFor = key
  countTitle()
}
function captionOf(pl) {
  const c = pl.caption
  const fr = pl.lang === 'fr'
  const base = fr ? ['#japonais', '#apprendrelejaponais'] : ['#japanese', '#learnjapanese']
  const tags = [...base, ...c.tags.map(t => `#${t}`), '#日本語', '#nihongo', '#tsuji'].join(' ')
  // A reading challenge never gives its answer away: the sentence as the
  // post sets it, and the question (plan 254).
  if (shown === 'read') {
    const R = pl.t.readPost
    const jp = (pl.script === 'kana' && c.kana ? c.kana : c.jp).replace(/。$/, '')
    return [`${R.hook}${pl.emoji ? ` ${pl.emoji}` : ''}`, jp, R.ask, tags].join('\n\n')
  }
  // A passage's line is the question picked for it, not always its first.
  const tr = pl.source === 'passage' ? picked(pl, state.picks[pickKey()], 1)[0]?.ask || c.tr : c.tr
  // A spelling quiz never prints the kanji it asks for: the word in kana.
  const spelling = shown === 'spelling'
  const jp = spelling ? /（(.+)）/.exec(c.jp)?.[1] || c.jp : c.jp
  const head = [jp, c.romaji, tr].filter(Boolean).join('\n')
  // The point once: a lesson's ask names it already.
  const ask = spelling ? pl.t.spellingAsk
    : shown === 'impostor' && pl.impostor ? pl.t.modes.impostorAsk(pl.impostor.name)
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
  const max = videoSource() ? 100 : TITLE_MAX
  $('#title').maxLength = max
  $('#title-count').textContent = `${[...$('#title').value].length}/${max}`
}

// ── Controls ──────────────────────────────────────────────────
// A button pressed is often drawn again: the focus goes back to its new
// self, so the keyboard carries on from it rather than from the top (plan 248).
function focusKey() {
  const el = document.activeElement
  if (!el || el === document.body) return null
  for (const a of ['set', 'source', 'level', 'q']) if (el.dataset?.[a]) return [a, el.dataset[a]]
  return null
}
function refocus(key) {
  if (!key || (document.activeElement && document.activeElement !== document.body)) return
  document.querySelector(`[data-${key[0]}="${CSS.escape(key[1])}"]`)?.focus()
}
function sync() {
  const fk = focusKey()
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
  refocus(fk)
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
    // A reply short is a scene, its 16:9 two (plan 249b): the list is the format's.
    if (key === 'lang' || key === 'longFormat') { sync(); renderList().then(render); return }
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
    const pool = listShown.filter(x => x.id !== currentId())
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
  $('#copy').addEventListener('click', () => copyField('#caption', videoSource() && document.body.dataset.post !== 'caption' ? 'Description' : 'Caption'))
  $('#copy-tags').addEventListener('click', () => copyField('#tags', 'Tags'))
  $('#copy-command').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#command').textContent); status('Command copied: run it from frontend/.') } catch { status('Select the command and copy it.') }
  })
  $('#export-thumb').addEventListener('click', exportThumb)
  $('#export-video').addEventListener('click', exportChallenge)
  $('#music-add').addEventListener('click', () => $('#music-file').click())
  $('#music-file').addEventListener('change', e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (music?.url) URL.revokeObjectURL(music.url)
    music = { name: file.name, url: URL.createObjectURL(file) }
    e.target.value = ''
    render()
  })
  $('#music-clear').addEventListener('click', () => {
    if (music?.url) URL.revokeObjectURL(music.url)
    music = null
    render()
  })
  $('#music-track').addEventListener('click', () => {
    if (music?.url) URL.revokeObjectURL(music.url)
    music = { track: TRACK }
    render()
  })
  $('#export-short').addEventListener('click', exportShort)
  $('#tune-reset').addEventListener('click', () => setTune({}))
  $('#copy-short').addEventListener('click', async () => {
    const cmd = `VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --carousel ${recipeOf(shortRecipe())}`
    try { await navigator.clipboard.writeText(cmd); status('Command copied: run it from frontend/ for the short with its voice and music.') } catch { status(cmd) }
  })
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
  // The thumbnails are drawn for the screen's pixel density; a resize that
  // keeps it redraws nothing, so a playing preview plays on (plan 248).
  let resize
  let density = window.devicePixelRatio
  window.addEventListener('resize', () => {
    clearTimeout(resize)
    resize = setTimeout(() => { if (window.devicePixelRatio !== density) { density = window.devicePixelRatio; render() } }, 200)
  })
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
