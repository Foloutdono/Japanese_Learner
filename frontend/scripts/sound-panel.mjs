// The listening panel: every voice in the palette, on a page that
// plays on a phone.
//
// /dev/sounds is the palette inside the app, which means a dev server,
// which means a desk. The choice it asks for is best made in a hand,
// on the speaker most learners hear the app through -- so this writes
// the same palette as one self-contained HTML page (the shipped
// recipes, bundled by voices-bundle.mjs), with a switch that plays
// everything through a model of a phone speaker, the meter's figures
// beside each voice, and the moments where several sounds meet played
// together as the app plays them.
//
// Picks are kept by the page when it is published as an Artifact with
// the `db` capability (collection `picks`, one document per event,
// `{ variant }`); anywhere else they stay in the browser and "Copy"
// hands them over as text.
//
//   node scripts/measure-voices.mjs --json > figures.json
//   node scripts/sound-panel.mjs --out panel.html --figures figures.json \
//     [--since old-figures.json] [--advice advice.json]
//
// --since   a meter run from before a round of new voices: any voice
//           not in it is marked New
// --advice  { eventKey: { pick, why } } -- a recommendation per event,
//           and `rating-rhythm` for the scenes' one timing question
import { readFileSync, writeFileSync } from 'node:fs'
import { voicesBundle } from './voices-bundle.mjs'

const args = process.argv.slice(2)
const opt = name => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}
const readJson = file => (file ? JSON.parse(readFileSync(file, 'utf8')) : null)

const out = opt('out')
if (!out) {
  console.error('usage: node scripts/sound-panel.mjs --out panel.html --figures figures.json [--since old.json] [--advice advice.json]')
  process.exit(1)
}

const figures = readJson(opt('figures')) ?? []
const since = readJson(opt('since'))
const advice = readJson(opt('advice')) ?? {}

const meta = {
  figures: Object.fromEntries(figures.map(r => [`${r.event}/${r.variant}`, {
    loss: r.loss, len: r.len, peak: r.peak,
  }])),
  fresh: since ? figures
    .filter(r => !since.some(o => o.event === r.event && o.variant === r.variant))
    .map(r => `${r.event}/${r.variant}`) : [],
  advice,
}

// Kept out of a template literal's reach: the bundle is minified code
// that may itself hold backticks and `${`.
const json = value => JSON.stringify(value).replace(/</g, '\\u003c')

const page = `<title>Tsuji Sound Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@600;900&family=Space+Grotesk:wght@500;600&display=swap">
<style>
/* A station's listening room: the app's own sumi and washi, its
   vermillion for a pick and its gold for the pass's metal. One column
   of moments, each a platform of voices; a sticky console on top. */
:root {
  --ground: #f6f1e4;
  --card: #efe6d0;
  --card-hi: #e7dabd;
  --ink: #221d15;
  --ink-soft: #665c4a;
  --rule: #c3af7c;
  --pick: #b7402a;
  --metal: #a97a25;
  --warn: #9a3b1f;
  --sumi: #1e1912;
  --on-sumi: #f3ecdf;
  --font-display: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;
  --font-jp: 'Noto Sans JP', 'Yu Gothic', system-ui, -apple-system, sans-serif;
  --font-serif: 'Noto Serif JP', 'Yu Mincho', serif;
  --r: 10px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #17151a; --card: #201d24; --card-hi: #2a2530; --ink: #ece5d8;
    --ink-soft: #a79c8c; --rule: #35303a; --pick: #d4563d; --metal: #c99a3e;
    --warn: #e0835f; --sumi: #100e13; --on-sumi: #f3ecdf; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #17151a; --card: #201d24; --card-hi: #2a2530; --ink: #ece5d8;
  --ink-soft: #a79c8c; --rule: #35303a; --pick: #d4563d; --metal: #c99a3e;
  --warn: #e0835f; --sumi: #100e13; --on-sumi: #f3ecdf; color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  background: var(--ground); color: var(--ink);
  font: 15px/1.55 var(--font-jp);
  padding-inline: 16px; padding-block: 0 64px;
}
.wrap { max-width: 880px; margin-inline: auto; }
header.mast { padding-block: 28px 18px; display: grid; gap: 6px; }
.mast__mark { font: 900 40px/1 var(--font-serif); color: var(--ink); }
.mast__mark b { color: var(--metal); font-weight: 900; }
h1 { font: 600 26px/1.2 var(--font-display); margin: 0; text-wrap: balance; }
.lede { margin: 0; color: var(--ink-soft); max-width: 62ch; }
.console {
  position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5;
  background: var(--sumi); color: var(--on-sumi);
  border-radius: var(--r); padding: 10px 12px; margin-block: 8px 20px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px;
}
.seg { display: inline-flex; border: 1px solid color-mix(in srgb, var(--on-sumi) 30%, transparent); border-radius: 999px; padding: 2px; }
.seg button {
  font: 600 13px/1 var(--font-display); letter-spacing: .02em;
  color: var(--on-sumi); background: none; border: 0; border-radius: 999px;
  padding: 8px 12px; cursor: pointer;
}
.seg button[aria-pressed="true"] { background: var(--metal); color: var(--sumi); }
.console label { font: 500 13px/1 var(--font-display); display: inline-flex; align-items: center; gap: 8px; }
.console input[type=range] { width: 110px; accent-color: var(--metal); }
.tally { margin-left: auto; font: 500 13px/1 var(--font-display); font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--on-sumi) 75%, transparent); }
.save-state { font: 500 12px/1 var(--font-display); color: color-mix(in srgb, var(--on-sumi) 60%, transparent); }
.family { margin-block: 28px 0; display: grid; gap: 14px; }
.family__head { display: flex; align-items: baseline; gap: 10px; border-bottom: 1px solid var(--rule); padding-bottom: 6px; }
.family__head h2 { font: 600 18px/1.2 var(--font-display); margin: 0; }
.family__head span { font: 600 15px/1 var(--font-serif); color: var(--ink-soft); }
.moment { background: var(--card); border-radius: var(--r); padding: 14px; display: grid; gap: 10px; }
.moment__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.moment__head h3 { font: 600 17px/1.3 var(--font-display); margin: 0; }
.moment__jp { font: 600 15px/1 var(--font-serif); color: var(--metal); }
.moment__where { margin: 0; color: var(--ink-soft); font-size: 14px; }
.advice { margin: 0; font-size: 14px; padding: 8px 10px; border-left: 3px solid var(--metal); background: color-mix(in srgb, var(--metal) 10%, transparent); border-radius: 0 6px 6px 0; }
.advice b { font-family: var(--font-display); font-weight: 600; }
.voices { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.voice {
  display: grid; grid-template-rows: auto 1fr auto; gap: 6px;
  background: var(--ground); border: 1.5px solid transparent; border-radius: 8px;
  padding: 10px; min-width: 0;
}
.voice.is-picked { border-color: var(--pick); }
.voice__play {
  all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px;
  font: 600 15px/1.25 var(--font-display); border-radius: 6px;
}
.voice__play:focus-visible, .seg button:focus-visible, .pick input:focus-visible + span, .btn:focus-visible, .scene__play:focus-visible {
  outline: 2px solid var(--metal); outline-offset: 2px;
}
.voice__play .tri {
  flex: none; width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; background: var(--sumi); color: var(--on-sumi);
  font-size: 11px; transition: transform .12s;
}
.voice__play.is-sounding .tri { background: var(--metal); color: var(--sumi); transform: scale(1.08); }
.voice__note { margin: 0; font-size: 13.5px; color: var(--ink-soft); }
.voice__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tag { font: 600 11px/1 var(--font-display); letter-spacing: .06em; text-transform: uppercase; padding: 4px 6px; border-radius: 4px; background: var(--card-hi); color: var(--ink-soft); }
.tag--now { background: var(--sumi); color: var(--on-sumi); }
.tag--new { background: color-mix(in srgb, var(--metal) 22%, transparent); color: var(--ink); }
.tag--warn { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.tag--rec { background: var(--metal); color: var(--sumi); }
.pick { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font: 600 13px/1 var(--font-display); }
.pick input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.pick span { padding: 7px 12px; border-radius: 999px; border: 1.5px solid var(--rule); }
.pick input:checked + span { background: var(--pick); border-color: var(--pick); color: #fff8ef; }
.scenes { display: grid; gap: 8px; }
.scene { background: var(--card); border-radius: var(--r); padding: 12px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.scene__text { flex: 1 1 260px; min-width: 0; }
.scene__text h3 { margin: 0; font: 600 16px/1.3 var(--font-display); }
.scene__text p { margin: 2px 0 0; font-size: 13.5px; color: var(--ink-soft); }
.scene__play { font: 600 13px/1 var(--font-display); background: var(--sumi); color: var(--on-sumi); border: 0; border-radius: 999px; padding: 10px 14px; cursor: pointer; }
.rhythm { background: var(--card); border-radius: var(--r); padding: 14px; display: grid; gap: 10px; }
.rhythm .voices { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.notes { display: grid; gap: 8px; margin-block: 28px 0; }
.notes label { font: 600 16px/1.3 var(--font-display); }
textarea { width: 100%; min-height: 96px; font: 15px/1.5 var(--font-jp); color: var(--ink); background: var(--card); border: 1px solid var(--rule); border-radius: 8px; padding: 10px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 16px 0; }
.btn { font: 600 14px/1 var(--font-display); background: var(--card-hi); color: var(--ink); border: 1px solid var(--rule); border-radius: 999px; padding: 11px 16px; cursor: pointer; }
.fine { color: var(--ink-soft); font-size: 13px; max-width: 70ch; }
@media (max-width: 480px) {
  .tally { margin-left: 0; }
  h1 { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .voice__play .tri { transition: none; } }
</style>

<div class="wrap">
  <header class="mast">
    <div class="mast__mark" lang="ja" aria-hidden="true">音<b>色</b></div>
    <h1>Tsuji Sound Panel</h1>
    <p class="lede">Every sound the app makes, with the new candidates beside the ones shipping now. Tap a voice to hear it; pick one per moment. Every voice of a moment is set to the same loudness, so you can compare them fairly. Your picks are saved on this page, and I make them the app's defaults.</p>
  </header>

  <div class="console" role="group" aria-label="Listening">
    <div class="seg" role="group" aria-label="Hear as">
      <button type="button" id="hear-open" aria-pressed="true">Headphones</button>
      <button type="button" id="hear-phone" aria-pressed="false">Phone speaker</button>
    </div>
    <label for="vol">Volume <input id="vol" type="range" min="0" max="1.5" step="0.05" value="1"></label>
    <span class="tally" id="tally">0 picked</span>
    <span class="save-state" id="save-state"></span>
  </div>

  <main id="moments"></main>

  <section class="family" aria-labelledby="scenes-title">
    <div class="family__head"><h2 id="scenes-title">Heard together</h2><span>同時</span></div>
    <p class="moment__where">The moments where several sounds meet, played with your picks (or the shipping sound where you have not picked) at the app's own timings.</p>
    <div class="rhythm" id="rhythm"></div>
    <div class="scenes" id="scenes"></div>
  </section>

  <section class="notes">
    <label for="notes">Anything else about the sound?</label>
    <textarea id="notes" placeholder="Too loud, too long, a moment that should be silent, a sound you miss…"></textarea>
    <div class="actions">
      <button type="button" class="btn" id="copy">Copy my picks as text</button>
    </div>
    <p class="fine">"Phone speaker" plays everything through a model of a phone's speaker: a steep roll-off below 400 Hz. It is where the wrong-answer and stamp sounds lose most of their weight. The dB figure on a voice is how much of it a phone loses.</p>
  </section>
</div>

<script>${await voicesBundle()}</script>
<script>
const META = ${json(meta)};
${panelScript.toString()}
panelScript(META)
</script>
`

// Runs in the page. Written as a function so it is linted as code here
// and stringified into the page whole.
function panelScript(META) {
  const { VOICE_EVENTS, VOICE_FAMILIES, voiceOut, voiceLevel } = globalThis.TsujiVoices
  const ORDER = ['study', 'rewards', 'station', 'interface']
  const byKey = new Map(VOICE_EVENTS.map(e => [e.key, e]))
  const fresh = new Set(META.fresh)
  const $ = sel => document.querySelector(sel)

  // ── Audio ──
  let ctx = null
  let input = null
  let volume = null
  let phone = false
  let filters = []
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      volume = ctx.createGain()
      volume.gain.value = Number($('#vol').value)
      volume.connect(ctx.destination)
      input = ctx.createGain()
      filters = [0, 1].map(() => {
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 400
        hp.Q.value = 20 * Math.log10(Math.SQRT1_2)   // Butterworth: Web Audio's Q is in dB
        return hp
      })
      filters[0].connect(filters[1])
      filters[1].connect(volume)
      route()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  function route() {
    if (!input) return
    input.disconnect()
    input.connect(phone ? filters[0] : volume)
  }
  function sound(eventKey, variantKey, delay = 0) {
    const event = byKey.get(eventKey)
    const variant = event?.variants.find(v => v.key === variantKey)
    if (!variant) return
    const c = audio()
    const go = () => variant.play(c, voiceOut(c, input, voiceLevel(event, variant)))
    if (delay > 0) setTimeout(go, delay * 1000)
    else go()
  }

  // ── Picks ──
  const picks = {}
  let db = null
  let saved = null
  try { saved = JSON.parse(localStorage.getItem('tsuji-sound-picks') || 'null') } catch { saved = null }
  if (saved && typeof saved === 'object') Object.assign(picks, saved)
  const keepLocal = () => { try { localStorage.setItem('tsuji-sound-picks', JSON.stringify(picks)) } catch { /* private window */ } }
  const state = text => { $('#save-state').textContent = text }

  async function choose(eventKey, variantKey) {
    picks[eventKey] = variantKey
    keepLocal()
    paint()
    if (!db) { state('Saved in this browser'); return }
    state('Saving…')
    try {
      await db.doc('picks/' + eventKey).set({ variant: variantKey, at: new Date().toISOString() })
      state('Saved')
    } catch {
      state('Not saved to the page. Use Copy below.')
    }
  }

  const current = eventKey => picks[eventKey] ?? byKey.get(eventKey)?.variants[0].key

  // ── Drawing ──
  function db_(n) { return (n >= 0 ? '−' : '+') + Math.abs(n).toFixed(0) + ' dB' }
  function voiceTile(event, variant, i) {
    const id = 'pick-' + event.key + '-' + variant.key
    const fig = META.figures[event.key + '/' + variant.key]
    const rec = META.advice[event.key]?.pick === variant.key
    const tags = []
    if (i === 0) tags.push('<span class="tag tag--now">Shipping now</span>')
    if (fresh.has(event.key + '/' + variant.key)) tags.push('<span class="tag tag--new">New</span>')
    if (rec) tags.push('<span class="tag tag--rec">Recommended</span>')
    if (variant.space) tags.push('<span class="tag">Hall</span>')
    if (fig && fig.loss !== null && fig.loss >= 8) tags.push('<span class="tag tag--warn" title="Loudness lost through a phone speaker">Phone ' + db_(fig.loss) + '</span>')
    return '<div class="voice" data-event="' + event.key + '" data-variant="' + variant.key + '">' +
      '<button type="button" class="voice__play" data-play="' + event.key + '|' + variant.key + '"><span class="tri" aria-hidden="true">▶</span><span>' + esc(variant.label) + '</span></button>' +
      '<p class="voice__note">' + esc(variant.note) + '</p>' +
      '<div class="voice__foot">' + tags.join('') +
      '<label class="pick" for="' + id + '"><input type="radio" id="' + id + '" name="pick-' + event.key + '" value="' + variant.key + '"><span>Pick</span></label>' +
      '</div></div>'
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]) }

  const families = ORDER.map(k => VOICE_FAMILIES.find(f => f.key === k)).filter(Boolean)
  $('#moments').innerHTML = families.map(family => {
    const events = VOICE_EVENTS.filter(e => e.family === family.key)
    return '<section class="family"><div class="family__head"><h2>' + esc(family.label) + '</h2><span>' + esc(family.jp) + '</span></div>' +
      events.map(event => {
        const adv = META.advice[event.key]
        const advLine = adv ? '<p class="advice"><b>' + (adv.pick === event.variants[0].key ? 'Keep' : 'My pick') + ':</b> ' + esc(adv.why) + '</p>' : ''
        return '<article class="moment" id="m-' + event.key + '"><div class="moment__head"><h3>' + esc(event.label) + '</h3><span class="moment__jp">' + esc(event.jp) + '</span></div>' +
          '<p class="moment__where">' + esc(event.where) + '</p>' + advLine +
          '<div class="voices" role="radiogroup" aria-label="' + esc(event.label) + '">' + event.variants.map((v, i) => voiceTile(event, v, i)).join('') + '</div></article>'
      }).join('') + '</section>'
  }).join('')

  // The one timing question: a rating's three sounds together, as the
  // app plays them, or the fare a beat after the answer.
  const RHYTHM = [
    { key: 'together', label: 'Together (as now)', note: 'The answer, the fare coin and the card turn start on the same instant.' },
    { key: 'apart', label: 'A beat apart', note: 'The answer first, the fare coin 110 ms later, where the levels were set expecting it.' },
  ]
  const rhythmAdv = META.advice['rating-rhythm']
  $('#rhythm').innerHTML = '<div class="moment__head"><h3>After a rating</h3><span class="moment__jp">評価</span></div>' +
    '<p class="moment__where">Every rating plays the answer, the XP fare and the card turning. Today they start together.</p>' +
    (rhythmAdv ? '<p class="advice"><b>My pick:</b> ' + esc(rhythmAdv.why) + '</p>' : '') +
    '<div class="voices" role="radiogroup" aria-label="After a rating">' + RHYTHM.map((r, i) =>
      '<div class="voice" data-event="rating-rhythm" data-variant="' + r.key + '">' +
      '<button type="button" class="voice__play" data-rhythm="' + r.key + '"><span class="tri" aria-hidden="true">▶</span><span>' + r.label + '</span></button>' +
      '<p class="voice__note">' + r.note + '</p><div class="voice__foot">' +
      (i === 0 ? '<span class="tag tag--now">Shipping now</span>' : '<span class="tag tag--new">New</span>') +
      (rhythmAdv?.pick === r.key ? '<span class="tag tag--rec">Recommended</span>' : '') +
      '<label class="pick" for="pick-rating-rhythm-' + r.key + '"><input type="radio" id="pick-rating-rhythm-' + r.key + '" name="pick-rating-rhythm" value="' + r.key + '"><span>Pick</span></label></div></div>').join('') + '</div>'

  const fareDelay = rhythm => (rhythm === 'apart' ? 0.11 : 0)
  const rating = (answer, rhythm, at = 0) => [[answer, at], ['fare-tick', at + fareDelay(rhythm)], ['card-transition', at]]
  const SCENES = [
    { title: 'A right answer', text: 'Rated right: the answer, the fare, the next card.', steps: r => rating('correct', r) },
    { title: 'A wrong answer', text: 'Rated wrong. On a phone, listen for whether it is there at all.', steps: r => rating('wrong', r) },
    { title: 'Turn, then rate', text: 'The card turned over, a moment to read it, then rated right.', steps: r => [['card-flip', 0], ...rating('correct', r, 1.1)] },
    { title: 'A card climbs a stage', text: 'Rated right and stamped 習; the next card comes after the seal.', steps: r => [['correct', 0], ['fare-tick', fareDelay(r)], ['card-stamp', 0], ['card-transition', 0.7]] },
    { title: 'The run ends', text: 'The last card rated, then the arrival.', steps: r => [...rating('correct', r), ['arrival', 0.35]] },
    { title: 'Level up', text: 'The answer, then the gate’s punch clipping your pass.', steps: () => [['correct', 0], ['pass-clip', 0.55]] },
    { title: 'Boarding a platform', text: 'A platform tapped, the door chime, the doors running open.', steps: () => [['click-mode-selection', 0], ['door-chime', 0.26], ['door-slide', 0.30]] },
    { title: 'Through the gate', text: 'A line chosen, and the pass read at the gate.', steps: () => [['click-screen-selection', 0], ['gate-chime', 0.42]] },
  ]
  $('#scenes').innerHTML = SCENES.map((s, i) =>
    '<div class="scene"><div class="scene__text"><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></div>' +
    '<button type="button" class="scene__play" data-scene="' + i + '">▶ Play</button></div>').join('')

  function paint() {
    document.querySelectorAll('.voice').forEach(el => {
      const ev = el.dataset.event
      const on = picks[ev] === el.dataset.variant
      el.classList.toggle('is-picked', on)
      const radio = el.querySelector('input[type=radio]')
      if (radio) radio.checked = on
    })
    const total = VOICE_EVENTS.length + 1
    const n = Object.keys(picks).filter(k => k === 'rating-rhythm' || byKey.has(k)).length
    $('#tally').textContent = n + ' of ' + total + ' picked'
  }

  function flash(btn, seconds) {
    btn.classList.add('is-sounding')
    setTimeout(() => btn.classList.remove('is-sounding'), Math.max(180, seconds * 1000))
  }

  document.addEventListener('click', e => {
    const play = e.target.closest('[data-play]')
    if (play) {
      const [ev, v] = play.dataset.play.split('|')
      sound(ev, v)
      flash(play, META.figures[ev + '/' + v]?.len ?? 0.3)
      return
    }
    const rhythm = e.target.closest('[data-rhythm]')
    if (rhythm) {
      rating(current('correct'), rhythm.dataset.rhythm).forEach(([ev, at]) => sound(ev, current(ev), at))
      flash(rhythm, 0.4)
      return
    }
    const scene = e.target.closest('[data-scene]')
    if (scene) {
      SCENES[Number(scene.dataset.scene)].steps(picks['rating-rhythm'] ?? 'together')
        .forEach(([ev, at]) => sound(ev, current(ev), at))
    }
  })
  document.addEventListener('change', e => {
    const radio = e.target.closest('input[type=radio][name^="pick-"]')
    if (radio) choose(radio.name.slice(5), radio.value)
  })

  const setHear = toPhone => {
    phone = toPhone
    $('#hear-open').setAttribute('aria-pressed', String(!toPhone))
    $('#hear-phone').setAttribute('aria-pressed', String(toPhone))
    route()
  }
  $('#hear-open').addEventListener('click', () => setHear(false))
  $('#hear-phone').addEventListener('click', () => setHear(true))
  $('#vol').addEventListener('input', e => { if (volume) volume.gain.value = Number(e.target.value) })

  $('#copy').addEventListener('click', () => {
    const lines = Object.entries(picks).map(([k, v]) => k + ': ' + v)
    const note = $('#notes').value.trim()
    const text = 'Tsuji sound picks\n' + lines.join('\n') + (note ? '\n\nNotes: ' + note : '')
    navigator.clipboard?.writeText(text).then(() => state('Copied'), () => state('Copy blocked: select the text below'))
  })

  let noteTimer = null
  $('#notes').addEventListener('input', e => {
    try { localStorage.setItem('tsuji-sound-notes', e.target.value) } catch { /* private window */ }
    clearTimeout(noteTimer)
    noteTimer = setTimeout(async () => {
      if (!db) return
      try { await db.doc('notes/general').set({ text: e.target.value, at: new Date().toISOString() }); state('Saved') } catch { state('Notes not saved to the page') }
    }, 900)
  })
  try { $('#notes').value = localStorage.getItem('tsuji-sound-notes') || '' } catch { /* private window */ }

  paint()

  // The page's store, where it has one: the picks live there, for
  // Claude to read back and make the app's defaults.
  if (window.claude?.use) {
    window.claude.use('db').then(store => {
      if (!store) { state('Saved in this browser'); return }
      db = store
      state('Picks save to this page')
      db.collection('picks').onSnapshot(snap => {
        snap.docs.forEach(doc => {
          const v = doc.data()?.variant
          if (typeof v === 'string') picks[doc.id] = v
        })
        keepLocal()
        paint()
      }, () => state('Could not read saved picks'))
      db.doc('notes/general').get().then(doc => {
        const text = doc.exists ? doc.data()?.text : null
        if (typeof text === 'string' && !$('#notes').value) $('#notes').value = text
      }).catch(() => {})
    })
  } else {
    state('Saved in this browser')
  }
}

writeFileSync(out, page)
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`)
