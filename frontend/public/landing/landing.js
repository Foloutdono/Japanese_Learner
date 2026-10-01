// ── 辻 — the landing page's client script (plan 167) ──
// The page is whole without this file (frontend/landing/page.mjs draws
// every word and card); this turns the demos on, sets the page in
// motion and lets the footage in. Footage lives in a public Supabase
// Storage bucket, by file name (frontend/landing/README.md): a slot looks
// for its still first, and only a still that loads brings in a player,
// so an empty bucket shows the drawn screens and never a broken video.
//
// Motion follows DESIGN.md: everything arrives once, as it is reached;
// a reader who asks for reduced motion gets the fades and nothing that
// moves or loops (landing.css carries that half).

const data = JSON.parse(document.getElementById('landing-data').textContent)
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const DAY_MS = 86400000
const canWatch = 'IntersectionObserver' in window

function el(tag, cls, text, attrs = {}) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/** Play a class's animation again: take it off, let the box settle, put it back. */
function replay(node, cls) {
  node.classList.remove(cls)
  void node.offsetWidth
  node.classList.add(cls)
}

// ── Arrivals ──
// Each marked block arrives once, when a slice of it is on the screen;
// a figure inside it counts up as it does. .motion tells the stylesheet
// someone is watching, which retires its show-anyway fallback.
const numbers = new Intl.NumberFormat(data.lang === 'fr' ? 'fr-FR' : 'en-GB')

function countUp(node) {
  const to = Number(node.dataset.count)
  if (!to || reducedMotion.matches) return
  const start = performance.now()
  const tick = now => {
    const p = Math.min(1, (now - start) / 1100)
    node.textContent = numbers.format(Math.round(to * (1 - (1 - p) ** 3)))
    if (p < 1) requestAnimationFrame(tick)
  }
  node.textContent = numbers.format(0)
  requestAnimationFrame(tick)
}

function arrive(node) {
  node.classList.add('in')
  for (const figure of $$('[data-count]', node)) countUp(figure)
}

// A stop arrives as one: whichever of its blocks is reached first brings
// in the stop and every block of it already on the screen, in order, a
// beat apart (--at) -- the plate, the heading, then what it shows. A
// block further down a tall stop waits to be reached, as before. A
// section on a band arrives too: its band fades in as it is reached.
const blocks = $$('[data-reveal], [data-stagger], .sec')
if (canWatch) {
  const watcher = new IntersectionObserver(entries => {
    for (const entry of entries) {
      // Its first report comes on watching, however little of it shows.
      if (!entry.isIntersecting || entry.intersectionRatio < 0.12) continue
      const sec = entry.target.closest('.sec')
      if (sec && !sec.classList.contains('in')) {
        sec.classList.add('in')
        watcher.unobserve(sec)
        let k = 0
        for (const block of $$('[data-reveal], [data-stagger]', sec)) {
          if (block.classList.contains('in') || block.getBoundingClientRect().top > window.innerHeight) continue
          watcher.unobserve(block)
          block.style.setProperty('--at', `${k++ * 0.2}s`)
          arrive(block)
        }
        continue
      }
      watcher.unobserve(entry.target)
      if (entry.target !== sec) arrive(entry.target)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
  for (const block of blocks) watcher.observe(block)
} else {
  blocks.forEach(arrive)
}
document.documentElement.classList.add('motion')

// Whatever loops stops while it is off the screen (landing.css, .is-away).
if (canWatch) {
  const away = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('is-away', !entry.isIntersecting)
  })
  for (const node of $$('.hero, .features, .way, .plate--line')) away.observe(node)
}

// ── The header ──
// Its rail is the reading's progress; once the hero's gate has scrolled
// away a small Embarquer stands in the header; the section being read
// is lit in the links, and its stop's sign on the page.
const top = $('[data-top]')
const topBoard = $('[data-top-board]')
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const room = document.documentElement.scrollHeight - window.innerHeight
    top.style.setProperty('--progress', room > 0 ? Math.min(1, window.scrollY / room).toFixed(4) : '0')
  })
}
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

if (canWatch) {
  const gateWatch = new IntersectionObserver(([entry]) => {
    const past = !entry.isIntersecting && entry.boundingClientRect.top < 0
    top.classList.toggle('has-board', past)
    topBoard.tabIndex = past ? 0 : -1
    topBoard.setAttribute('aria-hidden', String(!past))
  })
  gateWatch.observe($('.hero__gate .gate'))

  const links = $$('[data-spy]')
  const stops = $$('[data-stop]')
  const sections = $$('.sec[id]')
  const reading = new Set()
  const spy = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) reading.add(entry.target.id)
      else reading.delete(entry.target.id)
    }
    const here = sections.find(section => reading.has(section.id))?.id
    for (const link of links) {
      if (link.dataset.spy === here) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    }
    for (const sign of stops) sign.classList.toggle('is-here', sign.dataset.stop === here)
  }, { rootMargin: '-40% 0px -55% 0px' })
  for (const section of sections) spy.observe(section)
}

// ── Boarding carries the page's language into the app ──
// The app reads the saved language first (src/LangContext.jsx); a
// visitor who read the English page boards in English unless they have
// already chosen otherwise there.
for (const link of $$('[data-board]')) {
  link.addEventListener('click', () => {
    try {
      if (!localStorage.getItem('lang')) localStorage.setItem('lang', data.lang)
    } catch { /* storage refused: the app falls back to the device's language */ }
  })
}

// ── Sound ──
// The demos sound as the app does: a card turned, a verdict given and
// its fare landing a beat after, a pick, a switch. The voices are the
// app's own recipes (voices.js, which `npm run landing` bundles from
// src/lib/audio/recipes.js), each event's shipped voice, through the
// app's own chain -- the voice's trim, its channel, the master. Only a
// press of the visitor's makes one: nothing sounds on arrival or on the
// page's own motion, the tabs turning by themselves included.
//
// The switch in the header is the app's mute (src/lib/audio/settings.js,
// same key, same origin), and the page plays at the app's volumes: a
// visitor who mutes here boards muted, and a learner who muted the app
// finds the page quiet.
const MUTE_KEY = 'jp-app-muted'
const VOLUME_KEY = 'jp-app-volumes'
const FARE_BEAT = 0.11     // src/lib/audio/chimes.js: the fare lands after the answer
const KANA_TRIM = 0.8      // settings.js BASE_GAIN.kana
const RETRIGGER_MS = 40    // voices.js: one sound per moment

const stored = key => { try { return localStorage.getItem(key) } catch { return null } }
let muted = stored(MUTE_KEY) === '1'
let voices = null
let loading = null
let audio = null
const lastPlayed = new Map()

function loadVoices() {
  loading ||= import('./voices.js')
    .then(() => { voices = globalThis.TsujiVoices })
    .catch(() => { loading = null })
  return loading
}

function volume(channel) {
  let saved = {}
  try { saved = JSON.parse(stored(VOLUME_KEY) ?? 'null') ?? {} } catch { /* the defaults */ }
  const level = n => (typeof n === 'number' ? Math.min(1, Math.max(0, n)) : 1)
  return level(saved.master) * level(saved[channel])
}

/** The one context and its buses, made on the visitor's first press
    (a context made before one is refused by the browser anyway, and a
    press the page makes itself -- the device switch as the window
    narrows -- is none). */
function wake() {
  if (!audio) {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null
    const Context = window.AudioContext || window.webkitAudioContext
    if (!Context) return null
    const ctx = new Context()
    const master = ctx.createGain()
    master.connect(ctx.destination)
    audio = { ctx, master, buses: new Map() }
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {})
  return audio
}

function bus(channel) {
  const { ctx, master, buses } = audio
  if (!buses.has(channel)) {
    const node = ctx.createGain()
    node.connect(master)
    buses.set(channel, node)
  }
  const node = buses.get(channel)
  node.gain.value = volume(channel)
  return node
}

/** An event's shipped voice (its first), `after` seconds on. */
function sound(key, { after = 0 } = {}) {
  if (muted || !voices) return
  const event = voices.VOICE_EVENTS.find(e => e.key === key)
  if (!event || !wake()) return
  const now = performance.now()
  if (now - (lastPlayed.get(key) ?? -Infinity) < RETRIGGER_MS) return
  lastPlayed.set(key, now)
  const voice = event.variants[0]
  const out = voices.voiceOut(audio.ctx, bus(event.category), voices.voiceLevel(event, voice))
  voices.later(after, () => voice.play(audio.ctx, out))
}

// A kana card says its syllable as it turns, as the app's does: the kana
// deck's own clip, fetched ahead and decoded on the first play.
const clipBytes = new Map()
const clipBuffers = new Map()

function fetchClip(url) {
  if (!clipBytes.has(url)) {
    clipBytes.set(url, fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null))
  }
  return clipBytes.get(url)
}

function playClip(url) {
  if (muted || !wake()) return
  if (!clipBuffers.has(url)) {
    clipBuffers.set(url, fetchClip(url)
      .then(bytes => (bytes ? audio.ctx.decodeAudioData(bytes.slice(0)) : null))
      .catch(() => null))
  }
  clipBuffers.get(url).then(buffer => {
    if (!buffer || muted) return
    const source = audio.ctx.createBufferSource()
    const trim = audio.ctx.createGain()
    source.buffer = buffer
    trim.gain.value = KANA_TRIM
    source.connect(trim)
    trim.connect(bus('kana'))
    source.onended = () => { source.disconnect(); trim.disconnect() }
    source.start()
  })
}

const soundSwitch = $('[data-sound]')
function showSound() {
  soundSwitch.setAttribute('aria-pressed', String(!muted))
}
soundSwitch.hidden = false
showSound()
soundSwitch.addEventListener('click', () => {
  muted = !muted
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* this visit only */ }
  showSound()
  if (muted) return
  // The context on this press, while it is one; the switch's own sound
  // once the voices are in.
  wake()
  loadVoices().then(() => sound('toggle'))
})
// The app muted in another tab is the page muted too.
window.addEventListener('storage', event => {
  if (event.key !== MUTE_KEY) return
  muted = event.newValue === '1'
  showSound()
})

// Fetched once the page is idle, so the first card turned is heard; the
// kana clip once the trial is near.
function warm() {
  if (muted) return
  loadVoices()
  nearView($('[data-trial]'), () => {
    if (muted) return
    for (const card of data.cards) if (card.clip) fetchClip(card.clip)
  })
}
if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 })
else window.setTimeout(warm, 1500)

// ── Press here ──
// Each demo's first step wears the app's cue ring (landing.css, .nudge)
// until it is answered: the card until it is turned, then the verdicts
// until one is given; the pace, a word, an answer until one is picked.
// A ring is never put back.
function nudge(node, on) {
  if (node) node.classList.toggle('nudge', on)
}
for (const node of $$('[data-nudge]')) nudge(node, true)

// ── Your line: the pace moves every arrival ──
const monthYear = new Intl.DateTimeFormat(data.lang, { month: 'long', year: 'numeric' })
const arrival = $('[data-pass-arrival]')

function setRhythm(per, shown) {
  for (const button of $$('[data-per]')) {
    const on = Number(button.dataset.per) === per
    button.classList.toggle('on', on)
    button.setAttribute('aria-pressed', String(on))
  }
  for (const eta of $$('[data-eta]')) {
    eta.textContent = eta.getAttribute(`data-per-${per}`)
    if (shown) replay(eta, 'is-new')
  }
  $('[data-at]').textContent = data.at[per]
  $('[data-pass-per]').textContent = data.per[per]
  arrival.textContent = monthYear.format(new Date(Date.now() + data.n5Days[per] * DAY_MS))
}

for (const button of $$('[data-per]')) {
  button.addEventListener('click', () => {
    sound('click-mode-selection')
    nudge($('[data-rhythms]'), false)
    setRhythm(Number(button.dataset.per), true)
  })
}
setRhythm(data.rhythm, false)

// ── The pass: the name typed beside it, and a lean toward the pointer ──
const passName = $('[data-pass-name]')
$('[data-pass-input]').addEventListener('input', event => {
  passName.textContent = event.target.value.trim() || data.passName
})

const tilt = $('[data-tilt]')
const pass = $('.pass', tilt)
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  tilt.addEventListener('pointermove', event => {
    if (reducedMotion.matches) return
    const box = tilt.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    tilt.classList.add('is-tilting')
    pass.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`)
    pass.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`)
    pass.style.setProperty('--sx', `${(x * 70).toFixed(1)}%`)
  })
  tilt.addEventListener('pointerleave', () => {
    tilt.classList.remove('is-tilting')
    for (const prop of ['--rx', '--ry', '--sx']) pass.style.removeProperty(prop)
  })
}

// ── The trial: flip, rate, the next card ──
// Both faces are in the page; the card turns between them, and after a
// rating it slides away and the next one arrives face up.
const trial = $('[data-trial]')
const flipBox = $('[data-card]', trial)
const front = $('.qcard--front', trial)
const back = $('.qcard--back', trial)
const rates = $$('[data-rate]', trial)
const live = $('[data-trial-live]', trial)
const gain = $('[data-xp-gain]', trial)
const rbar = $('.rbar', trial)
let at = 0
let xp = 0

function fill(card) {
  for (const node of $$('[data-face]', trial)) {
    const key = node.dataset.face
    if (key === 'band') node.style.width = `${card.progress * 100}%`
    else if (key === 'stage') {
      node.textContent = card.stageWord
      node.className = `qcard__stage st-${card.stage}`
    } else if (key === 'glyph') {
      node.textContent = card.glyph
      node.classList.toggle('serif', card.serif)
    } else node.textContent = card[key]
  }
  $('[data-trial-pos]', trial).textContent = data.trial.pos[at]
  $('[data-trial-kind]', trial).textContent = card.kind
  rates.forEach((button, k) => { $('.rbar__t', button).textContent = card.due[k] })
}

function facing(backUp) {
  flipBox.classList.toggle('is-flipped', backUp)
  front.inert = backUp
  back.setAttribute('aria-hidden', String(!backUp))
  for (const button of rates) button.disabled = !backUp
}

front.addEventListener('click', () => {
  const card = data.cards[at]
  sound('card-flip')
  if (card.clip) playClip(card.clip)
  if (front.classList.contains('nudge')) {
    nudge(front, false)
    nudge(rbar, xp === 0)
  }
  facing(true)
  live.textContent = `${card.glyph} · ${card.meaning}`
  flipBox.focus({ preventScroll: true })
})

rates.forEach((button, k) => {
  button.addEventListener('click', () => {
    // A rating plays the answer, the fare a beat after it, and the card
    // leaving, as the app's does (RatingBar, XpToast, CardTransition).
    // The bar is drawn worst-first: Difficult and Correct are right.
    sound(k >= 2 ? 'correct' : 'wrong')
    sound('fare-tick', { after: FARE_BEAT })
    sound('card-transition')
    const wasHere = trial.contains(document.activeElement)
    nudge(rbar, false)
    xp += 1
    $('[data-xp]', trial).textContent = data.trial.xp[Math.min(xp, 5)]
    $('[data-xp-bar]', trial).style.width = `${34 + 12 * Math.min(xp, 5)}%`
    replay(button, 'is-pressed')
    replay(gain, 'is-on')
    for (const other of rates) other.disabled = true
    flipBox.classList.add('is-leaving')
    window.setTimeout(() => {
      at = (at + 1) % data.cards.length
      flipBox.classList.add('is-still')
      flipBox.classList.remove('is-leaving')
      facing(false)
      fill(data.cards[at])
      void flipBox.offsetWidth
      flipBox.classList.remove('is-still')
      replay(flipBox, 'is-arriving')
      button.classList.remove('is-pressed')
      if (wasHere) front.focus({ preventScroll: true })
    }, reducedMotion.matches ? 0 : 230)
  })
})

// ── The mock exam's question ──
const verdict = $('[data-verdict]')
const options = $$('[data-opt]')
for (const option of options) {
  option.addEventListener('click', () => {
    const picked = Number(option.dataset.opt)
    sound(picked === 0 ? 'correct' : 'wrong')
    nudge($('.exam__opts'), false)
    options.forEach((o, k) => {
      o.classList.toggle('opt--right', k === 0)
      if (k === picked && picked !== 0) replay(o, 'opt--wrong')
      else o.classList.remove('opt--wrong')
    })
    verdict.textContent = picked === 0 ? data.exam.right : data.exam.wrong
  })
}

// ── The analyser: a word tapped, its entry beside it ──
const tokens = $$('[data-tok]')
const tokinfo = $('.tokinfo')
for (const token of tokens) {
  token.addEventListener('click', () => {
    const picked = data.tokens[Number(token.dataset.tok)]
    sound('click-mode-selection')
    nudge(tokens[0], false)
    for (const other of tokens) {
      const on = other === token
      other.classList.toggle('tok--on', on)
      other.setAttribute('aria-pressed', String(on))
    }
    for (const field of $$('[data-ti]')) field.textContent = picked[field.dataset.ti]
    replay(tokinfo, 'is-new')
  })
}

// ── Footage ──
const stills = new Map()

/** Whether `url` answers with an image: one request per still, kept. */
function still(url) {
  if (!stills.has(url)) {
    stills.set(url, new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    }))
  }
  return stills.get(url)
}

function nearView(node, then) {
  if (!canWatch) return then()
  const seen = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      seen.disconnect()
      then()
    }
  }, { rootMargin: '400px 0px' })
  seen.observe(node)
}

// ── The features, one by one ──
// A tab each; the frame shows the feature's drawn screen, and its clip
// over it once one is filmed. The tabs turn over by themselves, each
// run drawn under its tab (landing.css, tab-run), held while the pointer
// or the focus is on them and while the block is off the screen, and
// stopped for good the moment the reader picks one. A drawn screen's run
// is seven seconds; a clip's is the clip, so the tab turns once the clip
// has played through.
const features = $('.features')
const tablist = $('[role="tablist"]', features)
const tabs = $$('[role="tab"]', features)
const panel = $('[role="tabpanel"]', features)
const frame = $('[data-frame]', features)
const screen = $('[data-clip]', features)
const mocks = $$('[data-mock]', screen)
let feature = 0
let device = 'phone'
let armed = false
let typer = 0

const turning = () => !features.classList.contains('is-manual')

// The clip's run: while the tabs turn, the line under the tab is the
// clip's progress (landing.css, .is-timed) and the clip plays once; its
// end turns the tab. Until it plays the run holds at its start. A clip
// that fails hands the run back to a drawn screen's seven seconds, and
// one that has not started after those seven turns the tab.
const CLIP_WAIT_MS = 7000
let following = 0
let stall = 0

function timed(video) {
  window.cancelAnimationFrame(following)
  window.clearTimeout(stall)
  features.classList.toggle('is-timed', Boolean(video))
  if (!video) return
  tablist.style.setProperty('--run', '0')
  const follow = () => {
    if (!video.isConnected) return
    if (video.duration) tablist.style.setProperty('--run', (video.currentTime / video.duration).toFixed(4))
    following = window.requestAnimationFrame(follow)
  }
  follow()
}

/** Start a clip, and give it a drawn screen's run to begin in. */
function start(video) {
  if (turning() && !video.dataset.untimed) {
    window.clearTimeout(stall)
    stall = window.setTimeout(() => {
      if (video.played.length) return
      video.dataset.untimed = 'true'
      // Its seven seconds are spent: on, unless the reader is on the block.
      if (features.classList.contains('is-hold')) timed(false)
      else pick((feature + 1) % tabs.length, 'auto')
    }, CLIP_WAIT_MS)
  }
  video.play().catch(error => {
    // A pause interrupting the start (the block went away) is no failure.
    if (error?.name === 'AbortError' || video.dataset.untimed || !video.isConnected) return
    video.dataset.untimed = 'true'
    timed(false)
  })
}

function stopTurning() {
  features.classList.add('is-manual')
  timed(false)
  const video = $('video', screen)
  if (video) video.loop = true
}
if (reducedMotion.matches) stopTurning()

/** The reading screen's field types its answer, and types it again. */
function typing() {
  window.clearTimeout(typer)
  const field = $('[data-mock="pratique"]:not([hidden]) .mk-field__typed', screen)
  if (!field) return
  field.dataset.full ||= field.textContent
  const full = field.dataset.full
  if (reducedMotion.matches) {
    field.textContent = full
    return
  }
  let i = 0
  const step = () => {
    if (!features.classList.contains('is-away')) {
      field.textContent = full.slice(0, i)
      i = i > full.length + 16 ? 0 : i + 1
    }
    typer = window.setTimeout(step, i > full.length ? 120 : 65)
  }
  step()
}

/** The kanji screen draws 駅 in its stroke order, and draws it again. */
let drawer = 0
function drawing() {
  window.clearInterval(drawer)
  const box = $('[data-mock="kanji"]:not([hidden]) .mk-strokes', screen)
  if (!box || reducedMotion.matches) return
  const run = () => { if (!features.classList.contains('is-away')) replay(box, 'is-drawing') }
  run()
  drawer = window.setInterval(run, 6500)
}

async function loadClip() {
  $('video', screen)?.remove()
  $('.clip__play', screen)?.remove()
  timed(false)
  if (!armed) return
  const f = data.features[feature]
  const base = `${data.media}/${device === 'desk' ? `${f.id}-desk` : f.id}`
  const wanted = `${feature}:${device}`
  if (!(await still(`${base}.jpg`)) || wanted !== `${feature}:${device}`) return
  const video = el('video', null, null, { muted: '', playsinline: '', preload: 'metadata', poster: `${base}.jpg`, 'aria-label': f.name })
  video.muted = true
  // Once through while the tabs turn; round and round once they stop.
  video.loop = !turning()
  video.append(el('source', null, null, { src: `${base}.mp4`, type: 'video/mp4' }))
  video.addEventListener('error', () => {
    // A clip already replaced has no run left to hand back.
    if (!video.isConnected) return
    video.remove()
    if (!video.dataset.untimed) timed(false)
  }, true)
  video.addEventListener('ended', () => {
    // The reader on the block, or a pick since: the clip again. Else on.
    if (!turning()) video.loop = true
    if (!turning() || features.classList.contains('is-hold')) video.play().catch(() => {})
    else pick((feature + 1) % tabs.length, 'auto')
  })
  screen.append(video)
  if (reducedMotion.matches) {
    const play = el('button', 'clip__play', null, { type: 'button', 'aria-label': f.play })
    play.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>'
    play.addEventListener('click', () => { play.remove(); video.controls = true; video.play().catch(() => {}) })
    screen.append(play)
    return
  }
  if (turning()) timed(video)
  // Off the screen it waits, as the run does, and starts once it is back.
  if (features.classList.contains('is-away')) video.dataset.away = 'true'
  else start(video)
}

function pick(k, how) {
  // The reader's pick is heard; the tabs turning by themselves are not.
  if (how !== 'auto') {
    sound('click-mode-selection')
    stopTurning()
  }
  feature = k
  tabs.forEach((tab, j) => {
    const on = j === k
    tab.setAttribute('aria-selected', String(on))
    tab.tabIndex = on ? 0 : -1
  })
  if (how === 'key') tabs[k].focus()
  // A row of chips on a phone: bring the new one into its row's view
  // without moving the page.
  if (how !== 'click' && tablist.scrollWidth > tablist.clientWidth) {
    const tab = tabs[k]
    tablist.scrollTo({ left: tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2, behavior: reducedMotion.matches ? 'auto' : 'smooth' })
  }
  const f = data.features[k]
  panel.setAttribute('aria-labelledby', tabs[k].id)
  panel.style.setProperty('--c', f.line)
  mocks.forEach((mock, j) => { mock.hidden = j !== k })
  $('[data-clip-what]', panel).textContent = f.what
  loadClip()
  typing()
  drawing()
}

tabs.forEach((tab, k) => {
  tab.addEventListener('click', () => pick(k, 'click'))
  tab.addEventListener('keydown', event => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    const to = step != null ? (k + step + tabs.length) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (to == null) return
    event.preventDefault()
    pick(to, 'key')
  })
})

tablist.addEventListener('animationend', event => {
  if (event.animationName !== 'tab-run' || features.classList.contains('is-manual')) return
  pick((feature + 1) % tabs.length, 'auto')
})
const hold = on => () => features.classList.toggle('is-hold', on)
features.addEventListener('pointerenter', hold(true))
features.addEventListener('pointerleave', hold(false))
features.addEventListener('focusin', hold(true))
features.addEventListener('focusout', event => { if (!features.contains(event.relatedTarget)) features.classList.remove('is-hold') })

// A clip stops while the block is off the screen, as the run does, and
// goes on from there once it is back.
if (canWatch) {
  new IntersectionObserver(([entry]) => {
    const video = $('video', screen)
    if (!video) return
    if (!entry.isIntersecting) {
      window.clearTimeout(stall)
      if (!video.paused) {
        video.pause()
        video.dataset.away = 'true'
      }
    } else if (video.dataset.away) {
      delete video.dataset.away
      start(video)
    }
  }).observe(features)
}

for (const button of $$('[data-device]')) {
  button.addEventListener('click', () => {
    sound('toggle')
    device = button.dataset.device
    for (const other of $$('[data-device]')) {
      const on = other === button
      other.classList.toggle('on', on)
      other.setAttribute('aria-pressed', String(on))
    }
    frame.dataset.frame = device
    stopTurning()
    loadClip()
  })
}

// Only the desk shows the Computer switch; a phone keeps phone clips.
window.matchMedia('(min-width: 1100px)').addEventListener('change', event => {
  if (!event.matches && device === 'desk') $('[data-device="phone"]').click()
})

typing()
nearView(features, () => { armed = true; loadClip() })

// The overview presentation: hidden until its still is in the bucket
// (or its date is in config.mjs), then a player on the first press.
const section = $('[data-presentation]')
const player = $('.player', section)
const src = player.dataset.src
const startAt = Number(new URLSearchParams(window.location.search).get('t')) || 0
let film = null

function open(at) {
  if (!film) {
    film = el('video', null, null, { controls: '', playsinline: '', preload: 'metadata', poster: `${src}.jpg`, crossorigin: 'anonymous' })
    film.append(el('source', null, null, { src: `${src}.mp4`, type: 'video/mp4' }))
    for (const lang of ['fr', 'en']) {
      film.append(el('track', null, null, {
        kind: 'subtitles', srclang: lang, src: `${src}.${lang}.vtt`,
        label: lang === 'fr' ? 'Français' : 'English',
        ...(lang === data.lang ? { default: '' } : {}),
      }))
    }
    player.append(film)
    player.classList.add('player--on')
    film.focus()
  }
  if (at) film.currentTime = at
  film.play().catch(() => {})
}

$('[data-play]', player).addEventListener('click', () => open(startAt))
for (const chapter of $$('[data-seek]', player)) {
  chapter.addEventListener('click', () => open(Number(chapter.dataset.seek)))
}

if (section.hidden) {
  const reveal = () => still(`${src}.jpg`).then(found => {
    if (!found) return
    section.hidden = false
    $('[data-watch]').hidden = false
  })
  if ('requestIdleCallback' in window) window.requestIdleCallback(reveal)
  else window.setTimeout(reveal, 1200)
}
