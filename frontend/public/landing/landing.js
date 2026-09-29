// ── 辻 — the landing page's client script (plan 167) ──
// The page is whole without this file (frontend/landing/page.mjs draws
// every word and card); this turns the demos on and lets the footage in.
// Footage lives in a public Supabase Storage bucket, by file name
// (frontend/landing/README.md): a slot looks for its still first, and
// only a still that loads brings in a player, so an empty bucket shows
// the drawn slots and never a broken video.

const data = JSON.parse(document.getElementById('landing-data').textContent)
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const DAY_MS = 86400000

function el(tag, cls, text, attrs = {}) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
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

// ── Your line: the pace moves every arrival ──
const monthYear = new Intl.DateTimeFormat(data.lang, { month: 'long', year: 'numeric' })
const arrival = $('[data-pass-arrival]')

function setRhythm(per) {
  for (const button of $$('[data-per]')) {
    const on = Number(button.dataset.per) === per
    button.classList.toggle('on', on)
    button.setAttribute('aria-pressed', String(on))
  }
  for (const eta of $$('[data-eta]')) eta.textContent = eta.getAttribute(`data-per-${per}`)
  $('[data-at]').textContent = data.at[per]
  $('[data-pass-per]').textContent = data.per[per]
  arrival.textContent = monthYear.format(new Date(Date.now() + data.n5Days[per] * DAY_MS))
}

for (const button of $$('[data-per]')) {
  button.addEventListener('click', () => setRhythm(Number(button.dataset.per)))
}
setRhythm(data.rhythm)

// ── The pass takes the name typed beside it ──
const passName = $('[data-pass-name]')
$('[data-pass-input]').addEventListener('input', event => {
  passName.textContent = event.target.value.trim() || data.passName
})

// ── The trial: flip, rate, the next card ──
const trial = $('[data-trial]')
const slot = $('[data-card]', trial)
const rates = $$('[data-rate]', trial)
const live = $('[data-trial-live]', trial)
let at = 0
let xp = 0

function band(card) {
  const band = el('span', 'qcard__band')
  const fill = el('i')
  fill.style.width = `${card.progress * 100}%`
  band.append(fill)
  return band
}

function front(card) {
  const face = el('button', 'qcard', null, { type: 'button', 'aria-label': data.trial.flipAria })
  face.append(
    el('span', `qcard__stage st-${card.stage}`, card.stageWord),
    el('span', `qcard__glyph${card.serif ? ' serif' : ''}`, card.glyph, { lang: 'ja' }),
    el('span', 'qcard__hint', data.trial.flip),
    band(card),
  )
  face.addEventListener('click', flip)
  return face
}

function back(card) {
  const face = el('div', 'qcard qcard--back')
  face.append(
    el('span', `qcard__stage st-${card.stage}`, card.stageWord),
    el('span', 'qcard__reading', card.reading, { lang: 'ja' }),
    el('span', `qcard__glyph${card.serif ? ' serif' : ''}`, card.glyph, { lang: 'ja' }),
    el('span', 'qcard__meaning', card.meaning),
    el('span', 'qcard__example', card.example, { lang: 'ja' }),
    el('span', 'qcard__trans', card.translation),
    band(card),
  )
  return face
}

function showCard(focus) {
  const card = data.cards[at]
  slot.replaceChildren(front(card))
  $('[data-trial-pos]', trial).textContent = data.trial.pos[at]
  $('[data-trial-kind]', trial).textContent = card.kind
  rates.forEach((button, k) => {
    button.disabled = true
    $('.rbar__t', button).textContent = card.due[k]
  })
  if (focus) $('button', slot).focus()
}

function flip() {
  const card = data.cards[at]
  slot.replaceChildren(back(card))
  for (const button of rates) button.disabled = false
  live.textContent = `${card.glyph} · ${card.meaning}`
  slot.focus()
}

for (const button of rates) {
  button.addEventListener('click', () => {
    xp += 1
    at = (at + 1) % data.cards.length
    $('[data-xp]', trial).textContent = data.trial.xp[Math.min(xp, 5)]
    $('[data-xp-bar]', trial).style.width = `${34 + 12 * Math.min(xp, 5)}%`
    showCard(true)
  })
}
$('[data-flip]', trial).addEventListener('click', flip)

// ── The mock exam's question ──
const verdict = $('[data-verdict]')
const options = $$('[data-opt]')
for (const option of options) {
  option.addEventListener('click', () => {
    const picked = Number(option.dataset.opt)
    options.forEach((o, k) => {
      o.classList.toggle('opt--right', k === 0)
      o.classList.toggle('opt--wrong', k === picked && picked !== 0)
    })
    verdict.textContent = picked === 0 ? data.exam.right : data.exam.wrong
  })
}

// ── The analyser: a word tapped, its entry beside it ──
const tokens = $$('[data-tok]')
for (const token of tokens) {
  token.addEventListener('click', () => {
    const picked = data.tokens[Number(token.dataset.tok)]
    for (const other of tokens) {
      const on = other === token
      other.classList.toggle('tok--on', on)
      other.setAttribute('aria-pressed', String(on))
    }
    for (const field of $$('[data-ti]')) field.textContent = picked[field.dataset.ti]
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
  if (!('IntersectionObserver' in window)) return then()
  const seen = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      seen.disconnect()
      then()
    }
  }, { rootMargin: '400px 0px' })
  seen.observe(node)
}

// The features, one by one: a tab each, a clip in the frame.
const features = $('.features')
const tabs = $$('[role="tab"]', features)
const panel = $('[role="tabpanel"]', features)
const frame = $('[data-frame]', features)
const screen = $('[data-clip]', features)
let feature = 0
let device = 'phone'
let armed = false

async function loadClip() {
  $('video', screen)?.remove()
  $('.clip__play', screen)?.remove()
  if (!armed) return
  const f = data.features[feature]
  const base = `${data.media}/${device === 'desk' ? `${f.id}-desk` : f.id}`
  const wanted = `${feature}:${device}`
  if (!(await still(`${base}.jpg`)) || wanted !== `${feature}:${device}`) return
  const video = el('video', null, null, { muted: '', loop: '', playsinline: '', preload: 'metadata', poster: `${base}.jpg`, 'aria-label': f.name })
  video.muted = true
  video.append(el('source', null, null, { src: `${base}.mp4`, type: 'video/mp4' }))
  video.addEventListener('error', () => video.remove(), true)
  screen.append(video)
  if (reducedMotion.matches) {
    const play = el('button', 'clip__play', null, { type: 'button', 'aria-label': f.play })
    play.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>'
    play.addEventListener('click', () => { play.remove(); video.controls = true; video.play().catch(() => {}) })
    screen.append(play)
  } else {
    video.play().catch(() => {})
  }
}

function pick(k, focus) {
  feature = k
  tabs.forEach((tab, j) => {
    const on = j === k
    tab.setAttribute('aria-selected', String(on))
    tab.tabIndex = on ? 0 : -1
  })
  if (focus) tabs[k].focus()
  const f = data.features[k]
  panel.setAttribute('aria-labelledby', tabs[k].id)
  screen.style.setProperty('--c', f.line)
  $('[data-clip-glyph]', screen).textContent = f.glyph
  $('[data-clip-name]', screen).textContent = f.name
  $('[data-clip-what]', panel).textContent = f.what
  // Re-run the arrival, as the canvas does on every pick.
  screen.style.animation = 'none'
  void screen.offsetWidth
  screen.style.animation = ''
  loadClip()
}

tabs.forEach((tab, k) => {
  tab.addEventListener('click', () => pick(k, false))
  tab.addEventListener('keydown', event => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    const to = step != null ? (k + step + tabs.length) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (to == null) return
    event.preventDefault()
    pick(to, true)
  })
})

for (const button of $$('[data-device]')) {
  button.addEventListener('click', () => {
    device = button.dataset.device
    for (const other of $$('[data-device]')) {
      const on = other === button
      other.classList.toggle('on', on)
      other.setAttribute('aria-pressed', String(on))
    }
    frame.dataset.frame = device
    loadClip()
  })
}

// Only the desk shows the Computer switch; a phone keeps phone clips.
window.matchMedia('(min-width: 1100px)').addEventListener('change', event => {
  if (!event.matches && device === 'desk') $('[data-device="phone"]').click()
})

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
