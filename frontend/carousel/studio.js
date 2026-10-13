// ── カルーセル — the studio (plan 200) ─────────────────────────────
// Pick a sentence of the reading bank, see it drawn in the four
// directions side by side, keep one, export its slides. Everything a
// slide says comes from bank/*.json (backend/scripts/carousel_bank.py);
// everything it looks like, from slides.js.
/* global JSZip */
import { DIRECTIONS, FORMATS, FONT_FACES, deck, font, model, sampleText } from './slides.js'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'

const STORE = 'tsuji-carousel'
const $ = sel => document.querySelector(sel)

const DEFAULTS = {
  level: 'N5', id: 'N5.4', view: 'compare', direction: 'plates', format: 'post', ground: 'paper',
  lang: 'en', script: 'kanji', romaji: false, bonus: 'kanji', kanji: '', handle: '', safe: false,
  slides: { words: true, grammar: true, rating: true, outro: true },
}
const state = load()
const banks = new Map()
const work = document.createElement('canvas')

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}')
    return { ...DEFAULTS, ...saved, slides: { ...DEFAULTS.slides, ...(saved.slides || {}) } }
  } catch {
    return structuredClone(DEFAULTS)
  }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)) } catch { /* a private window keeps nothing */ }
}

async function bankOf(level) {
  if (!banks.has(level)) {
    banks.set(level, fetch(`bank/${level}.json`).then(r => {
      if (!r.ok) throw new Error(`bank/${level}.json: ${r.status}`)
      return r.json()
    }))
  }
  return banks.get(level)
}

// ── Fonts: the canvas draws only what the document has loaded ──
const loaded = new Set()
async function fonts(text) {
  const want = [...text].filter(c => !loaded.has(c)).join('')
  if (!want) return
  await Promise.all(FONT_FACES.map(([fam, w]) => document.fonts.load(font(w, 40, fam), want).catch(() => [])))
  for (const c of want) loaded.add(c)
}

// ── The sentence list ─────────────────────────────────────────
async function renderList() {
  const bank = await bankOf(state.level)
  const q = $('#search').value.trim().toLowerCase()
  const list = $('#sentences')
  list.replaceChildren()
  const rows = bank.sentences.filter(s => !q || [s.jp, s.en, s.fr, s.p, s.focus].some(v => v.toLowerCase().includes(q)))
  $('#count').textContent = `${rows.length}`
  for (const s of rows) {
    const li = document.createElement('li')
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sentence'
    b.setAttribute('aria-pressed', String(s.id === state.id))
    b.dataset.id = s.id
    const jp = document.createElement('span')
    jp.className = 'sentence__jp'
    jp.lang = 'ja'
    jp.textContent = s.jp
    const tr = document.createElement('span')
    tr.className = 'sentence__tr'
    tr.textContent = s[state.lang] || s.en
    const pt = document.createElement('span')
    pt.className = 'sentence__pt'
    pt.lang = 'ja'
    pt.textContent = s.p
    b.append(jp, tr, pt)
    li.append(b)
    list.append(li)
  }
  list.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' })
}

// ── The slides ────────────────────────────────────────────────
let current = { decks: [], sentence: null }
let token = 0

async function sentenceNow() {
  const bank = await bankOf(state.level)
  let s = bank.sentences.find(x => x.id === state.id)
  if (!s) { s = bank.sentences[0]; state.id = s.id }
  return { bank, s }
}

async function render() {
  const mine = ++token
  const { bank, s } = await sentenceNow()
  const opts = { ...state }
  const m = model(bank, s, opts)
  renderKanjiPicker(m)
  await fonts(sampleText(m))
  if (mine !== token) return
  const fmt = FORMATS[state.format]
  const ids = state.view === 'compare' ? DIRECTIONS.map(d => d.id) : [state.direction]
  current = { sentence: s, model: m, fmt, decks: ids.map(id => ({ id, slides: deck(id, m, fmt, opts) })) }
  const stage = $('#stage')
  stage.replaceChildren()
  stage.dataset.view = state.view
  stage.style.setProperty('--ratio', `${fmt.w} / ${fmt.h}`)
  for (const d of current.decks) {
    const dir = DIRECTIONS.find(x => x.id === d.id)
    const row = document.createElement('section')
    row.className = 'deck'
    row.setAttribute('aria-label', dir.name[state.lang])
    const head = document.createElement('div')
    head.className = 'deck__head'
    const name = document.createElement('h2')
    name.className = 'deck__name'
    const jp = document.createElement('span')
    jp.lang = 'ja'
    jp.className = 'deck__jp'
    jp.textContent = dir.jp
    name.append(jp, ` ${dir.name[state.lang]}`)
    const n = document.createElement('span')
    n.className = 'deck__count'
    n.textContent = `${d.slides.length} slides`
    head.append(name, n)
    if (state.view === 'compare') {
      const keep = document.createElement('button')
      keep.type = 'button'
      keep.className = 'btn btn--quiet'
      keep.textContent = 'Use this one'
      keep.addEventListener('click', () => { state.direction = d.id; state.view = 'single'; sync(); render() })
      head.append(keep)
    }
    const strip = document.createElement('div')
    strip.className = 'strip'
    d.slides.forEach((slide, i) => {
      const fig = document.createElement('button')
      fig.type = 'button'
      fig.className = 'slide'
      fig.setAttribute('aria-label', `${dir.name[state.lang]}, slide ${i + 1}: ${slide.key}`)
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
  $('#caption').value = captionOf(m)
  $('#export').disabled = false
}

/** Draw a slide whole, at the post's own size, on the work canvas. */
function full(slide, fmt) {
  work.width = fmt.w
  work.height = fmt.h
  const ctx = work.getContext('2d')
  slide.draw(ctx)
  return work
}
function thumb(c, slide, fmt) {
  const box = c.parentElement.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = Math.round(box.width * dpr)
  c.height = Math.round(box.width * dpr * fmt.h / fmt.w)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(full(slide, fmt), 0, 0, c.width, c.height)
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

function renderKanjiPicker(m) {
  const box = $('#kanji')
  box.replaceChildren()
  box.closest('.field').hidden = state.bonus !== 'kanji' || !m.kanjiChars.length
  for (const ch of m.kanjiChars) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip chip--glyph'
    b.lang = 'ja'
    b.textContent = ch
    b.setAttribute('aria-pressed', String(ch === m.kanjiChar))
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
  const slide = d.slides[i]
  const fmt = current.fmt
  const c = $('#viewer canvas')
  c.width = fmt.w
  c.height = fmt.h
  c.getContext('2d').drawImage(full(slide, fmt), 0, 0)
  $('#viewer-title').textContent = `${i + 1} / ${d.slides.length}`
  $('#prev').disabled = i === 0
  $('#next').disabled = i === d.slides.length - 1
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
const baseName = () => `tsuji-${current.sentence.id.replace('.', '-')}-${state.direction}-${state.format}`

async function exportZip() {
  const d = current.decks.find(x => x.id === state.direction) ?? current.decks[0]
  const btn = $('#export')
  btn.disabled = true
  status('Drawing the slides…')
  try {
    if (typeof JSZip === 'undefined') {
      for (let i = 0; i < d.slides.length; i++) {
        await offer(`${baseName()}-${i + 1}.png`, await png(full(d.slides[i], current.fmt)))
      }
      status('Saved one image per slide.')
      return
    }
    const zip = new JSZip()
    for (let i = 0; i < d.slides.length; i++) {
      zip.file(`${String(i + 1).padStart(2, '0')}-${d.slides[i].key}.png`, await png(full(d.slides[i], current.fmt)))
    }
    zip.file('caption.txt', $('#caption').value)
    const blob = await zip.generateAsync({ type: 'blob' })
    const result = await offer(`${baseName()}.zip`, blob)
    status({ saved: `Saved ${d.slides.length} slides and the caption.`, declined: 'Download cancelled.', unavailable: 'Downloads are not available in this view.', failed: 'The download did not go through. Try again.' }[result])
  } finally {
    btn.disabled = false
  }
}
async function exportOne() {
  if (!viewing) return
  const { d, i } = viewing
  const result = await offer(`${baseName()}-${i + 1}.png`, await png(full(d.slides[i], current.fmt)))
  status(result === 'saved' ? `Saved slide ${i + 1}.` : result === 'declined' ? 'Download cancelled.' : 'Downloads are not available in this view.')
}
function status(msg) {
  $('#status').textContent = msg || ''
}

// ── The caption to post with it ───────────────────────────────
function captionOf(m) {
  const s = m.s
  const lv = s.lv.toLowerCase()
  const tags = m.lang === 'fr'
    ? `#japonais #apprendrelejaponais #jlpt${lv} #日本語 #nihongo #tsuji`
    : `#japanese #learnjapanese #jlpt${lv} #日本語 #nihongo #tsuji`
  const ask = m.lang === 'fr' ? 'Tu l’as lue sans aide ?' : 'Could you read it without help?'
  return `${s.jp}\n${m.romaji}\n${m.translation}\n\n${ask} ${s.lv} · ${s.p}\n\n${tags}`
}
async function copyCaption() {
  const area = $('#caption')
  try {
    await navigator.clipboard.writeText(area.value)
    status('Caption copied.')
  } catch {
    area.select()
    status('Select the caption and copy it.')
  }
}

// ── Controls ──────────────────────────────────────────────────
function sync() {
  for (const el of document.querySelectorAll('[data-set]')) {
    const [key, value] = el.dataset.set.split(':')
    el.setAttribute('aria-pressed', String(String(state[key]) === value))
  }
  for (const el of document.querySelectorAll('[data-slide]')) el.checked = !!state.slides[el.dataset.slide]
  $('#romaji').checked = state.romaji
  $('#safe').checked = state.safe
  $('#handle').value = state.handle
  $('#export-name').textContent = DIRECTIONS.find(d => d.id === state.direction).name[state.lang]
  document.querySelectorAll('[data-only]').forEach(el => { el.hidden = el.dataset.only !== state.direction && state.view === 'single' })
  save()
}

function wire() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-set]')
    if (!b) return
    const [key, value] = b.dataset.set.split(':')
    const before = state[key]
    state[key] = value
    if (key === 'level' && before !== value) {
      state.id = `${value}.1`
      bankOf(value).then(renderList)
    }
    if (key === 'direction') state.view = 'single'
    if (key === 'lang') renderList()
    sync()
    render()
  })
  $('#sentences').addEventListener('click', e => {
    const b = e.target.closest('.sentence')
    if (!b) return
    state.id = b.dataset.id
    state.kanji = ''
    for (const x of document.querySelectorAll('.sentence')) x.setAttribute('aria-pressed', String(x === b))
    sync()
    render()
  })
  $('#search').addEventListener('input', () => renderList())
  $('#random').addEventListener('click', async () => {
    const bank = await bankOf(state.level)
    const pool = bank.sentences.filter(s => s.id !== state.id)
    state.id = pool[Math.floor(Math.random() * pool.length)].id
    state.kanji = ''
    sync()
    await renderList()
    render()
  })
  for (const el of document.querySelectorAll('[data-slide]')) {
    el.addEventListener('change', () => { state.slides[el.dataset.slide] = el.checked; sync(); render() })
  }
  $('#romaji').addEventListener('change', e => { state.romaji = e.target.checked; sync(); render() })
  $('#safe').addEventListener('change', e => { state.safe = e.target.checked; sync(); render() })
  let typing
  $('#handle').addEventListener('input', e => {
    state.handle = e.target.value.slice(0, 40)
    clearTimeout(typing)
    typing = setTimeout(() => { sync(); render() }, 300)
  })
  $('#export').addEventListener('click', exportZip)
  $('#copy').addEventListener('click', copyCaption)
  $('#prev').addEventListener('click', () => step(-1))
  $('#next').addEventListener('click', () => step(1))
  $('#save-one').addEventListener('click', exportOne)
  $('#close').addEventListener('click', () => $('#viewer').close())
  $('#viewer').addEventListener('keydown', e => {
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
    status(`The sentence bank did not load (${e.message}). Serve this folder over http, not from a file.`)
  }
}
start()
