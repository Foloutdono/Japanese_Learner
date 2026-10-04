// ── 辻 — the 30-second practice ad's timeline ───────────────────
// window.seek(t) lays the stage out as it stands t seconds in. Nothing
// here plays: every style is computed from t alone, so render.mjs can
// capture frame n by seeking n / fps, in any order, and get the same
// picture twice. The cuts sit on a 120 BPM grid (a beat is 0.5s), and
// window.CUES hands the moments to score.js, so every sound lands on
// the frame that makes it.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  const mix = (a, b, k) => a + (b - a) * k
  const E = {
    lin: x => x,
    out: x => 1 - (1 - x) ** 3,
    in: x => x ** 3,
    io: x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
    back: x => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  }
  // The eased share of [a, b] that t has covered.
  const p = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)))
  const show = (el, on) => { el.style.display = on ? 'block' : 'none' }
  const style = (el, s) => Object.assign(el.style, s)

  // ── The plan, in seconds ──────────────────────────────────
  const FEATS = [[5.0, 8.5], [8.5, 11.5], [11.5, 14.5], [14.5, 17.5], [17.5, 20.5], [20.5, 24.5]]
  const T = {
    hook1: [0, 1.25], hook2: [1.25, 2.25], miss: [2.25, 3.5], brand: [3.5, 5.0],
    board: [24.5, 26.5], cta: [26.5, 30],
  }
  // Each stop's beats, from its start.
  const F = {
    reading: { type: [0.45, 1.25], check: 1.4, rows: 1.6 },
    rikai: { mark: [0.6, 0.95], pick: 1.35 },
    honyaku: { type: [0.4, 1.1], convert: 1.2, ok: 1.38, tutor: 1.58 },
    kakitori: { play: 0.3, wave: [0.35, 1.7], type: [0.9, 1.6], check: 1.72, answer: 1.84 },
    sakubun: { type: [0.35, 1.0], convert: 1.1, found: 1.3, tutor: 1.55 },
    exam: { clock: [0.2, 1.6], pick: 1.0, flip: [1.6, 1.9], count: [1.95, 2.7], stamp: 2.85 },
  }
  const READING = 'eki de koohii o nomimasu'
  const HEARD = 'gakkou wa kuji kara desu'
  const IME = [
    { kana: 'えきのまえでともだちにあいます', done: '駅の前で友だちに会います。' },
    { kana: 'にほんにいきたいです', done: '日本に行きたいです。' },
  ]

  // The keystrokes a run of typing makes: one every few letters is
  // heard, which is how fast typing sounds.
  const keyTimes = (a, [t0, t1], n, every = 2) => {
    const out = []
    for (let i = 1; i <= n; i += every) out.push(a + t0 + (t1 - t0) * (i / n))
    return out
  }
  const cards = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(j => 0.10 + j * 0.115)
  const FLAP_ROWS = [24.75, 24.95, 25.15]
  const CUES = {
    beat: 0.5,
    feats: FEATS.map(f => f[0]),
    swipes: cards,
    sentence: 1.27,
    wrong: 1.55,
    queries: [1.6, 1.72],
    impact: 2.5,
    brand: 3.5,
    pops: [0, 1, 2, 3, 4, 5].map(i => 3.9 + i * 0.07),
    toRail: 4.72,
    keys: [
      ...keyTimes(FEATS[0][0], F.reading.type, READING.length),
      ...keyTimes(FEATS[2][0], F.honyaku.type, IME[0].kana.length),
      ...keyTimes(FEATS[3][0], F.kakitori.type, HEARD.length),
      ...keyTimes(FEATS[4][0], F.sakubun.type, IME[1].kana.length),
    ],
    presses: [FEATS[0][0] + F.reading.check, FEATS[3][0] + F.kakitori.play, FEATS[3][0] + F.kakitori.check,
      FEATS[2][0] + F.honyaku.convert, FEATS[4][0] + F.sakubun.convert],
    correct: [FEATS[0][0] + F.reading.check + 0.05, FEATS[1][0] + F.rikai.pick, FEATS[2][0] + F.honyaku.ok,
      FEATS[3][0] + F.kakitori.check + 0.05, FEATS[4][0] + F.sakubun.found, FEATS[5][0] + F.exam.pick],
    panels: [FEATS[2][0] + F.honyaku.tutor, FEATS[4][0] + F.sakubun.tutor, FEATS[0][0] + F.reading.rows],
    flip: FEATS[5][0] + F.exam.flip[0],
    ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => FEATS[5][0] + F.exam.count[0] + i * 0.085),
    stamp: FEATS[5][0] + F.exam.stamp,
    flaps: FLAP_ROWS,
    cta: 26.5,
    end: 30,
  }
  window.CUES = CUES

  // ── The camera: a jolt where something lands ──────────────
  const JOLTS = [[1.29, 7], [2.5, 12], [3.5, 4], [CUES.stamp, 9], [26.5, 5]]
  const FLASHES = [[1.25, 0.25, 0.05], [2.5, 0.42, 0.1], [3.5, 0.22, 0.08], [26.5, 0.2, 0.08]]
  function camera(t) {
    let x = 0, y = 0
    for (const [at, amp] of JOLTS) {
      const d = t - at
      if (d < 0 || d > 0.3) continue
      const k = amp * (1 - d / 0.3) ** 2
      x += Math.sin(d * 95) * k
      y += Math.cos(d * 70) * k * 0.6
    }
    style($('#cam'), { transform: `translate(${x}px, ${y}px)` })
    let f = 0
    for (const [at, peak, dur] of FLASHES) if (t >= at && t < at + dur) f = Math.max(f, peak * (1 - (t - at) / dur))
    $('#flash').style.opacity = f
  }

  // ── The ground ────────────────────────────────────────────
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const GLOWS = [
    [0, '--state-learning'], [1.25, '--rating-wrong'], [2.25, '--gate-gold'], [3.5, '--gate-gold'],
    [5.0, '--line-reading'], [8.5, '--line-rikai'], [11.5, '--line-honyaku'], [14.5, '--line-kakitori'],
    [17.5, '--line-sakubun'], [20.5, '--line-exam'], [24.5, '--line-vocab'], [26.5, '--gate-gold'],
  ]
  let glows = null
  function ground(t) {
    glows ??= GLOWS.map(([at, v]) => [at, rgb(css(v))])
    let i = 0
    while (i + 1 < glows.length && glows[i + 1][0] <= t) i++
    const prev = glows[Math.max(0, i - 1)][1]
    const k = p(t, glows[i][0], glows[i][0] + 0.25)
    const c = glows[i][1].map((v, n) => Math.round(mix(prev[n], v, i ? k : 1)))
    $('#glow').style.setProperty('--glow', `rgb(${c.join(',')})`)
    // The sleepers run faster once the line is moving.
    const run = t < 3.5 ? t * 30 : 105 + (t - 3.5) * 170
    $('#speed').style.backgroundPosition = `${-run}px 0`
    $('#strip').style.transform = `scaleX(${p(t, 3.5, 4.0, E.io)})`
  }

  // Words arriving one after another, each a punch from a little big.
  function punch(els, t, at, gap = 0.05, from = 1.35) {
    els.forEach((el, i) => {
      const k = p(t, at + i * gap, at + i * gap + 0.12)
      style(el, { opacity: k, transform: `scale(${mix(from, 1, E.back(clamp(k)))})` })
    })
  }

  // ── 0.00 Months of flashcards… ────────────────────────────
  const fcs = $$('#hk-deck .fc').reverse()   // in the order they are swiped
  function hook1(t) {
    style($('#hk1'), { transform: `scale(${mix(1, 1.04, t / 1.25)})` })
    const day = Math.max(1, Math.round(180 * p(t, 0.05, 1.18, E.in)))
    $('#hk-day b').textContent = day
    let gone = 0
    fcs.forEach((el, j) => {
      const s = cards[j]
      const k = s === undefined ? 0 : p(t, s, s + 0.14, E.in)
      const d = j - gone
      gone += k
      const depth = Math.min(Math.max(d, 0), 3)
      const dir = j % 2 ? 1 : -1
      style(el, {
        opacity: d > 3.5 ? 0 : 1,
        zIndex: 20 - j,
        transform: `translate(${dir * 430 * k}px, ${depth * 12 - 40 * k}px) rotate(${dir * 24 * k}deg) scale(${1 - depth * 0.05})`,
      })
    })
  }

  // ── 1.25 …and you still can't read this? ──────────────────
  function hook2(t) {
    punch($$('#hk2 .w'), t, 1.25, 0.065)
    const k = p(t, CUES.sentence, CUES.sentence + 0.12)
    const shake = t > CUES.wrong && t < CUES.wrong + 0.35 ? Math.sin((t - CUES.wrong) * 80) * 7 * (1 - (t - CUES.wrong) / 0.35) : 0
    const out = p(t, 2.15, 2.25, E.in)
    style($('#hk-sent'), {
      opacity: k * (1 - out),
      transform: `translateX(${shake}px) scale(${mix(1.8, 1, k) * mix(1, 0.9, out)})`,
      filter: `blur(${out * 6}px)`,
    })
    $$('#hk-sent .q').forEach((q, i) => {
      const kk = p(t, CUES.queries[i], CUES.queries[i] + 0.14)
      style(q, { opacity: kk, transform: `scale(${E.back(kk)}) rotate(${i ? 10 : -10}deg)` })
    })
    const path = $('#hk-sq path')
    const len = 380
    path.style.strokeDasharray = len
    path.style.strokeDashoffset = len * (1 - p(t, 1.5, 1.75, E.io))
    $('#hk-sq').style.opacity = 1 - out
    $('#hk2').style.opacity = 1 - out
  }

  // ── 2.25 You're missing practice. ─────────────────────────
  function miss(t) {
    const a = p(t, 2.25, 2.37)
    style($('#miss1'), { opacity: a, transform: `translateY(${(1 - a) * 14}px)` })
    const k = p(t, CUES.impact, CUES.impact + 0.13)
    const out = p(t, 3.36, 3.5, E.in)
    style($('#miss2'), {
      opacity: k,
      transform: `scale(${mix(2.4, 1, k) * mix(1, 1.08, (t - 2.5) / 1) * mix(1, 1.6, out)})`,
    })
    $$('#rays line').forEach((l, i) => {
      l.style.strokeDasharray = 600
      l.style.strokeDashoffset = 600 * (1 - p(t, CUES.impact + i * 0.02, CUES.impact + 0.4 + i * 0.02, E.out))
    })
    style($('#rays'), { opacity: 0.6 * (1 - out), transform: `rotate(${(t - 2.5) * 6}deg)`, transformOrigin: '216px 310px' })
    $('#s-miss').style.opacity = 1 - out
    $('#s-miss').style.filter = `blur(${out * 8}px)`
  }

  // ── 3.50 辻 Tsuji — 6 ways to practise Japanese ───────────
  function brandMark(root, t, at) {
    const k = p(t, at, at + 0.16)
    style($('.mark', root), { opacity: k, transform: `scale(${mix(0.6, 1, E.back(k))})` })
    const r = p(t, at + 0.06, at + 0.36, E.io)
    $('.road', root).style.clipPath = `inset(0 ${100 - r * 100}% 0 0)`
    const n = p(t, at + 0.12, at + 0.3)
    style($('.brand-name', root), { opacity: n, letterSpacing: `${mix(0.6, 0.32, n)}em` })
  }
  function brand(t) {
    const root = $('#s-brand')
    brandMark(root, t, T.brand[0])
    punch($$('#brand-head .w'), t, 3.68, 0.05)
    const out = p(t, CUES.toRail, CUES.toRail + 0.2, E.in)
    style(root, { opacity: 1 - out, transform: `translateY(${-30 * out}px)` })
  }

  // ── The rail: six rings, born in the brand's row ──────────
  const RAIL_X = i => 52 + i * 60.8
  const ROW_X = i => 64 + i * 56
  const rings = $$('#rail .ring')
  function stopAt(t) {
    let i = -1
    FEATS.forEach(([a], n) => { if (t >= a) i = n })
    return i
  }
  function rail(t) {
    const on = t >= CUES.pops[0] && t < 24.62
    show($('#rail'), on)
    if (!on) return
    const fly = p(t, CUES.toRail, CUES.toRail + 0.28, E.io)
    const now = stopAt(t)
    const leave = p(t, 24.3, 24.6, E.in)
    rings.forEach((el, i) => {
      const pop = p(t, CUES.pops[i], CUES.pops[i] + 0.16)
      const x = mix(ROW_X(i), RAIL_X(i), fly)
      const y = mix(478, 76, fly)
      const lit = i === now ? p(t, FEATS[i][0], FEATS[i][0] + 0.2) : 0
      const s = mix(1, 0.64, fly) * (1 + 0.28 * lit) * E.back(pop)
      el.classList.toggle('is-now', i === now)
      el.classList.toggle('is-past', now > i)
      style(el, { opacity: pop * (1 - leave), transform: `translate(${x}px, ${y}px) scale(${s})` })
    })
    const line = p(t, 4.86, 5.06, E.io)
    style($('.rail-line'), { opacity: 1 - leave, transform: `scaleX(${line})` })
    // The train runs to the stop being shown, and off the end at last.
    let tx = RAIL_X(0)
    if (now >= 0) {
      const [a] = FEATS[now]
      const from = now ? RAIL_X(now - 1) : RAIL_X(0)
      tx = mix(from, RAIL_X(now), p(t, a - 0.06, a + 0.26, E.io))
    }
    tx = mix(tx, 440, leave)
    const on5 = p(t, 4.95, 5.1)
    style($('.train'), { opacity: on5, left: `${tx}px` })
    style($('.rail-done'), { opacity: on5 * (1 - leave), width: `${Math.max(0, Math.min(tx, RAIL_X(5)) - 52)}px` })
  }

  // ── A practice stop's arrival and departure ───────────────
  function stopFrame(root, t, [a, b]) {
    const enter = p(t, a, a + 0.22)
    const exit = p(t, b - 0.13, b, E.in)
    const x = (1 - enter) * 70 - exit * 80
    style(root, { transform: `translateX(${x}px)`, filter: `blur(${(1 - enter) * 7 + exit * 9}px)`, opacity: Math.min(1, 0.3 + enter * 1.4) * (1 - exit * 0.6) })
    const plate = $('.plate', root)
    style(plate, { transform: `translateY(${(1 - p(t, a, a + 0.2)) * -16}px)` })
    punch($$('.head .w', root), t, a + 0.04, 0.04, 1.25)
    const c = p(t, a + 0.08, a + 0.3)
    style($('.card', root), { opacity: c, transform: `translateY(${(1 - c) * 28}px) scale(${mix(0.96, 1, c)})` })
    const v = p(t, a + 0.2, a + 0.4)
    style($('.value', root), { opacity: v, transform: `translateY(${(1 - v) * 10}px)` })
  }

  // A field being typed in: the placeholder until the first letter,
  // the caret while typing and blinking after.
  function typing(well, t, text, [t0, t1], after = 0.35) {
    const n = Math.round(p(t, t0, t1, E.lin) * text.length)
    $('.typed', well).textContent = text.slice(0, n)
    const ph = $('.ph', well)
    if (ph) ph.style.display = n ? 'none' : 'inline'
    const blink = Math.floor(t * 4) % 2 === 0
    $('.caret', well).style.opacity = t >= t0 - 0.3 && (t < t1 || (t < t1 + after && blink)) ? 1 : 0
  }
  function press(el, t, at) {
    const k = t >= at && t < at + 0.12 ? Math.sin(((t - at) / 0.12) * Math.PI) : 0
    el.style.transform = `scale(${1 - 0.08 * k})`
  }
  function verdict(well, t, at) {
    const k = p(t, at, at + 0.16)
    const v = $('.verdict', well)
    style(v, { opacity: k, transform: `scale(${E.back(k)})` })
    well.classList.toggle('ok', t >= at)
    const check = $('.check', well)
    if (check) check.style.opacity = t >= at ? 0 : 1
  }
  const rise = (el, t, at, dy = 14) => {
    const k = p(t, at, at + 0.2)
    style(el, { opacity: k, transform: `translateY(${(1 - k) * dy}px)` })
  }

  function reading(root, t, a) {
    const f = F.reading
    const well = $('.well', root)
    typing(well, t, READING, [a + f.type[0], a + f.type[1]], 0)
    press($('.check', well), t, a + f.check)
    verdict(well, t, a + f.check + 0.05)
    $('.caret', well).style.opacity = t < a + f.check && t >= a + f.type[0] - 0.3 ? 1 : 0
    $$('rt', root).forEach(rt => { rt.style.opacity = p(t, a + f.check + 0.1, a + f.check + 0.3) })
    $$('.bd-row', root).forEach((r, i) => rise(r, t, a + f.rows + i * 0.15))
  }

  function rikai(root, t, a) {
    const f = F.rikai
    $('mark', root).style.setProperty('--hl', `${p(t, a + f.mark[0], a + f.mark[1], E.io) * 100}%`)
    $$('.opt', root).forEach((o, i) => {
      const picked = i === 1 && t >= a + f.pick
      o.classList.toggle('ok', picked)
      o.style.opacity = t >= a + f.pick && i !== 1 ? 0.45 : 1
      if (i === 1) press(o, t, a + f.pick - 0.06)
      else o.style.transform = ''
    })
  }

  function ime(root, t, a, f, { kana, done }) {
    const well = $('.well', root)
    const typed = $('.typed', well)
    const n = Math.round(p(t, a + f.type[0], a + f.type[1], E.lin) * kana.length)
    const converted = t >= a + f.convert
    typed.textContent = converted ? done : kana.slice(0, n)
    typed.classList.toggle('ime', !converted && n > 0)
    const blink = Math.floor(t * 4) % 2 === 0
    $('.caret', well).style.opacity = t >= a + f.type[0] - 0.3 && (!converted || (t < a + f.convert + 0.6 && blink)) ? 1 : 0
    return well
  }

  function honyaku(root, t, a) {
    const f = F.honyaku
    const well = ime(root, t, a, f, IME[0])
    verdict(well, t, a + f.ok)
    rise($('.tutor', root), t, a + f.tutor, 20)
  }

  function kakitori(root, t, a) {
    const f = F.kakitori
    press($('.play', root), t, a + f.play)
    const playing = t >= a + f.wave[0] && t < a + f.wave[1]
    const pulse = playing ? ((t - a - f.wave[0]) % 0.5) / 0.5 : 1
    style($('.pulse', root), { opacity: playing ? 1 - pulse : 0, transform: `scale(${1 + pulse * 0.5})` })
    $$('.wave i', root).forEach((bar, i) => {
      const env = playing ? 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + t * 11) * Math.sin(i * 0.45 + t * 5.3)) : 0.08
      const done = p(t, a + f.wave[0], a + f.wave[1], E.lin) * 26
      bar.style.height = `${Math.max(8, env * 100)}%`
      bar.style.opacity = i < done ? 1 : 0.45
    })
    const well = $('.well', root)
    typing(well, t, HEARD, [a + f.type[0], a + f.type[1]], 0)
    $('.caret', well).style.opacity = t < a + f.check && t >= a + f.type[0] - 0.3 ? 1 : 0
    press($('.check', well), t, a + f.check)
    verdict(well, t, a + f.check + 0.05)
    rise($('.answer', root), t, a + f.answer)
  }

  function sakubun(root, t, a) {
    const f = F.sakubun
    ime(root, t, a, f, IME[1])
    const k = p(t, a + f.found, a + f.found + 0.16)
    style($('.found', root), { opacity: k, transform: `scale(${E.back(k)})` })
    rise($('.tutor', root), t, a + f.tutor, 20)
  }

  function exam(root, t, a) {
    const f = F.exam
    const score = $('.score', root).dataset
    const total = $$('.sheet i', root).length
    const start = Number($('.face--q .timer', root).dataset.minutes) * 60
    const left = Math.round(start - p(t, a + f.clock[0], a + f.clock[1], E.lin) * 73)
    $('.face--q .timer', root).textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
    $$('.face--q .opt', root).forEach((o, i) => {
      o.classList.toggle('ok', i === 0 && t >= a + f.pick)
      o.style.opacity = t >= a + f.pick && i ? 0.45 : 1
    })
    const turn = p(t, a + f.flip[0], a + f.flip[1], E.io) * 180
    style($('.face--q', root), { transform: `rotateY(${turn}deg)` })
    style($('.face--s', root), { transform: `rotateY(${turn - 180}deg)` })
    const c = p(t, a + f.count[0], a + f.count[1], E.out)
    const k = Number(score.knowledge), l = Number(score.listening)
    $('.score b', root).textContent = Math.round((k + l) * c)
    $('.n1', root).textContent = `${Math.round(k * c)} / 120`
    $('.n2', root).textContent = `${Math.round(l * c)} / 60`
    const bars = $$('.bar i', root)
    bars[0].style.width = `${(k / 120) * 100 * c}%`
    bars[1].style.width = `${(l / 60) * 100 * c}%`
    // The answer sheet fills as the score counts: one cell a question,
    // the misses spread through it as a real paper's are.
    $$('.sheet i', root).forEach((cell, i) => {
      const on = c * total > i
      const missed = (i * 37) % total < Math.round(total * 0.21)
      cell.className = on ? (missed ? 'x' : 'r') : ''
    })
    const s = p(t, a + f.stamp, a + f.stamp + 0.12, E.in)
    style($('.stamp', root), { opacity: s, transform: `rotate(-14deg) scale(${mix(2.6, 1, s)})` })
    $('.note', root).style.opacity = p(t, a + 0.3, a + 0.5)
  }

  const STOP_FNS = [reading, rikai, honyaku, kakitori, sakubun, exam]
  const stopEls = $$('.feat')

  // ── 24.50 Plus the whole course ───────────────────────────
  const flapSets = $$('#s-board .flaps').map(el => {
    const to = el.dataset.to
    el.innerHTML = [...to].map(ch => `<div class="flap${/\d/.test(ch) ? '' : ' sep'}">${ch}</div>`).join('')
    return [...el.children].map(c => [c, c.textContent])
  })
  function board(t) {
    const [a, b] = T.board
    punch($$('#board-head .w'), t, a + 0.04, 0.05)
    const k = p(t, a + 0.1, a + 0.32)
    style($('.board'), { opacity: k, transform: `translateY(${(1 - k) * 30}px)` })
    flapSets.forEach((flaps, r) => {
      const at = FLAP_ROWS[r]
      flaps.forEach(([el, ch], c) => {
        if (!/\d/.test(ch)) { el.style.opacity = t >= at ? 1 : 0; return }
        const settle = at + 0.22 + c * 0.05
        if (t < at) { el.textContent = ''; return }
        el.textContent = t >= settle ? ch : String(Math.floor((Math.sin((t * 25 | 0) * 12.9898 + c * 78.233 + r) * 43758.5453 % 1 + 1) * 10) % 10)
      })
    })
    rise($('#board-sub'), t, 25.55)
    const out = p(t, b - 0.12, b, E.in)
    style($('#s-board'), { opacity: 1 - out, filter: `blur(${out * 8}px)` })
  }

  // ── 26.50 Start practising today ──────────────────────────
  function cta(t) {
    const root = $('#s-cta')
    const a = T.cta[0]
    brandMark(root, t, a)
    punch($$('#cta-head .w'), t, a + 0.12, 0.06)
    const g = p(t, a + 0.35, a + 0.55)
    const breathe = 1 + 0.018 * Math.sin((t - a) * Math.PI * 2)
    style($('.gate'), { opacity: g, transform: `translateY(${(1 - g) * 26}px) scale(${mix(0.88, 1, E.back(g)) * breathe})` })
    $('.gate__halo').style.opacity = 0.55 + 0.45 * Math.sin((t - a) * Math.PI * 2)
    $$('.ripple').forEach((r, i) => {
      const ph = ((t - a - 0.5 - i * 0.25) % 0.5 + 0.5) % 0.5 / 0.5
      const on = t > a + 0.5
      style(r, { opacity: on ? (1 - ph) * 0.9 : 0, transform: `scale(${1 + ph * 0.8})` })
    })
    rise($('.url'), t, a + 0.55, 10)
    rise($('.terms'), t, a + 0.65, 10)
    const d = p(t, a + 0.85, a + 1.05)
    const bob = Math.abs(Math.sin((t - a) * Math.PI * 2)) * 9
    style($('.down'), { opacity: d, transform: `translateY(${bob}px)` })
  }

  // ── The one entry point ───────────────────────────────────
  window.seek = t => {
    camera(t)
    ground(t)
    const inside = ([a, b]) => t >= a && t < b
    show($('#s-hook1'), inside(T.hook1)); if (inside(T.hook1)) hook1(t)
    show($('#s-hook2'), inside(T.hook2)); if (inside(T.hook2)) hook2(t)
    show($('#s-miss'), inside(T.miss)); if (inside(T.miss)) miss(t)
    show($('#s-brand'), inside(T.brand)); if (inside(T.brand)) brand(t)
    rail(t)
    stopEls.forEach((el, i) => {
      const on = inside(FEATS[i])
      show(el, on)
      if (!on) return
      stopFrame(el, t, FEATS[i])
      STOP_FNS[i](el, t, FEATS[i][0])
    })
    show($('#s-board'), inside(T.board)); if (inside(T.board)) board(t)
    show($('#s-cta'), t >= T.cta[0]); if (t >= T.cta[0]) cta(t)
  }
})()
