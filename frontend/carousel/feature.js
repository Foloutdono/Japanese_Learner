// ── 実践 — a practice feature's video (plan 270) ──────────────────────
// The owner's pick A of three drawn (the real screen, over play along
// and the pitch): one 9:16 video per feature of the Practice tab, in the
// tab's order, each the app itself doing one exercise. The app is
// recorded as it runs (long/record.mjs: its pages in a phone-sized
// browser, its API answered from bank/promo.json, the backend's own
// answers for the banks' own content); this module plans the recording,
// times it and draws each frame: a short caption over the screen, the
// screen in a rounded frame on the dark ground, a finger's tap where the
// learner taps, the screen moving to what the beat shows, and the promo
// stories' gate at the end (promo.gateClip). Scored with the app's own
// sounds and its engine's voices where the app speaks.
//
// What a caption says is what the screen shows and the app's own
// description of the feature says (locales: its title and its three
// lines, held equal by a test): no figure, no price, no promise the
// screen does not make.
import { FS, SP, fit, formatOf, frame, palette, paragraph, rrect, text } from './draw.js'
import { gateClip } from './promo.js'
import { feedPosts } from './feeds.js'
import { weldIf } from './strings.js'

// The Practice tab's platforms, in its order (src/config/tabs.js).
export const FEATURE_IDS = ['reading', 'comprehension', 'translation', 'dictation', 'composition', 'exam', 'conversation']
export const FEATURE_FPS = 30
// A shot: the 400 CSS px phone at 2.7 (record.mjs PHONE).
export const SHOT = { w: 1080, h: 2322 }
// The screen's frame on the video: its width, and how far under the
// feed's safe box it may reach (its foot is the screen's, never a word).
const SCREEN = { w: 880, below: 70, radius: 44 }
// A beat's caption comes in, the screen moves to what it shows, a state
// changes in a cross-fade; a finger shows before its tap and its ring after.
const MOTION = { caption: 0.35, pan: 0.5, fade: 0.22, finger: 0.35, ring: 0.5 }
// Typed as a quick hand types, a few keys a shot (record.mjs `chunk`).
const KEYS_PER_SECOND = 13
// A tall screen's scroll: a moment on its head first, a moment on its foot after.
const SCROLL = { wait: 0.9, rest: 0.9 }
// The gate's share of the video: its ask, its note, then the gate, waiting.
const END_SECONDS = 5.5

// The app's own names and descriptions (locales/*/index.js), held equal by a test.
export const APP = {
  en: {
    tab: 'Practice',
    title: { reading: 'Reading practice', comprehension: 'Reading comprehension', translation: 'Translation', dictation: 'Dictation', composition: 'Composition', exam: 'Mock Exam', conversation: 'Conversation' },
    desc: {
      reading: 'Real sentences, pitched at your level\nBy grade, by frequency, or from your own cards\nRead first, check after',
      translation: 'Put it into Japanese yourself\nA reference answer, and a read on yours\nThe hard direction, on purpose',
      dictation: 'Write down what you hear, in romaji\nTwo listens, and no more\nN5 through N1',
      composition: 'Write a sentence with the point you are shown\nA tutor reads it back to you\nN5 through N1',
    },
  },
  fr: {
    tab: 'Pratique',
    title: { reading: 'Entraînement à la lecture', comprehension: 'Compréhension écrite', translation: 'Traduction', dictation: 'Dictée', composition: 'Rédaction', exam: 'Examen blanc', conversation: 'Conversation' },
    desc: {
      reading: 'De vraies phrases, à ton niveau\nPar grade, par fréquence, ou depuis tes cartes\nLire d\'abord, vérifier ensuite',
      translation: 'À toi de le dire en japonais\nUne réponse de référence, et un avis sur la tienne\nDans le sens difficile, exprès',
      dictation: 'Écris en romaji ce que tu entends\nDeux écoutes, pas une de plus\nDe N5 à N1',
      composition: 'Écris une phrase avec le point donné\nUn tuteur te la relit\nDe N5 à N1',
    },
  },
}
const LOCALE_KEYS = { reading: 'reading', comprehension: 'readingComprehension', translation: 'translation', dictation: 'dictation', composition: 'composition', exam: 'exam', conversation: 'conversation' }
export const localeKeys = id => ({ title: `${LOCALE_KEYS[id]}Title`, desc: `${LOCALE_KEYS[id]}Desc` })

// Where a step taps, by what the app names (record.mjs reads these off the page).
const plate = line => `.plate--platform[style*="--line-${line}"]`
const stop = code => `.route-stop:has(.route-stop__code:text-is("${code}"))`
const FIELD = '.stage__foot .field'
const SUBMIT = '.stage__foot .btn-primary'
// What a card says, without the room around it.
const BODY = '.prompt-card__body > *'

// ── The features ──────────────────────────────────────────────
// steps: what record.mjs does in the app (its shots named);
// beats: what the video shows, each with its caption, made of parts:
//   { shot, hold, tap }      a shot held `hold` seconds, tapped at `tap`
//   { seq, by: 'at' }        a sequence of shots at the moments recorded (a clip playing)
//   { seq, by: 'chars' }     a sequence typed, KEYS_PER_SECOND, a key's press each
// A part's `voice` is the line said from its tap (the clip the app plays).
// The opening every feature shares: the Practice gate, the feature's
// plate tapped; then its level list, the level tapped.
const gateSteps = (line, levels, level) => [
  { go: '/practice', ready: '.plate--platform' },
  { shot: 'gate', focus: plate(line), tap: `${plate(line)} .plate__head` },
  { go: levels, ready: '.route-stop' },
  { shot: 'levels', focus: stop(level), tap: stop(level) },
]
const gateBeats = (say, levels = { en: 'N5 to N1.', fr: 'Du N5 au N1.' }) => [
  { say, parts: [{ shot: 'gate', hold: 2.0, tap: 1.5 }] },
  { say: levels, parts: [{ shot: 'levels', hold: 1.4, tap: 0.9 }] },
]

export const FEATURES = {
  reading: {
    jp: '読書', line: 'reading',
    steps: d => [
      ...gateSteps('reading', '/practice/reading/levels', d.level),
      { go: `/practice/reading/level/${d.level}`, ready: '.clip-player__play' },
      { shot: 'ready', focus: '.prompt-card', tap: '.clip-player__play' },
      { click: '.clip-player__play' },
      { wait: 700 },
      { shot: 'shown', focus: '.prompt-card' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 3, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rating-bar' },
      { wait: 1200 },
      { shot: 'checked', focus: '.prompt-card' },
    ],
    beats: [
      ...gateBeats({ en: 'Read real Japanese.', fr: 'Lis du vrai japonais.' }),
      { say: { en: 'A sentence at your level, on the clock.', fr: 'Une phrase à ton niveau, chronométrée.' }, parts: [{ shot: 'ready', hold: 0.8, tap: 0.55 }, { shot: 'shown', hold: 2.4 }] },
      { say: { en: 'Write how it reads, in rōmaji.', fr: 'Écris comment elle se lit, en rōmaji.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Read first, check after.', fr: 'Lire d’abord, vérifier ensuite.' }, parts: [{ shot: 'checked', hold: 4.2 }] },
    ],
    end: { en: 'Read real Japanese on Tsuji.', fr: 'Lis du vrai japonais sur Tsuji.' },
    title: { en: 'Can you read this Japanese before the clock runs out?', fr: 'Sauras-tu lire ce japonais avant la fin du chrono ?' },
  },
  translation: {
    jp: '翻訳', line: 'honyaku',
    steps: d => [
      ...gateSteps('honyaku', '/practice/translation/levels', d.level),
      { go: `/practice/translation/level/${d.level}`, ready: FIELD },
      { wait: 600 },
      { shot: 'prompt', focus: '.prompt-card' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 2, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rvw__verdict' },
      { wait: 1200 },
      { shot: 'reviewed', focus: BODY },
    ],
    beats: [
      ...gateBeats({ en: 'Say it in Japanese.', fr: 'Dis-le en japonais.' }),
      { say: { en: 'The hard direction, on purpose.', fr: 'Dans le sens difficile, exprès.' }, parts: [{ shot: 'prompt', hold: 2.4 }] },
      { say: { en: 'Put it into Japanese yourself.', fr: 'À toi de le dire en japonais.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'A reference, and a read on yours.', fr: 'Une référence, et un avis sur la tienne.' }, parts: [{ shot: 'reviewed', hold: 5.6 }] },
    ],
    end: { en: 'Say it in Japanese on Tsuji.', fr: 'Dis-le en japonais sur Tsuji.' },
    title: { en: 'How would you say this in Japanese?', fr: 'Comment dirais-tu ça en japonais ?' },
  },
  composition: {
    jp: '作文', line: 'sakubun',
    steps: d => [
      ...gateSteps('sakubun', '/practice/composition', d.level),
      { go: `/practice/composition/${d.level}`, ready: FIELD },
      { wait: 600 },
      { shot: 'point', focus: '.prompt-card' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 2, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rvw__verdict' },
      { wait: 1200 },
      { shot: 'reviewed', focus: BODY },
    ],
    beats: [
      ...gateBeats({ en: 'Write your own Japanese.', fr: 'Écris ton propre japonais.' }),
      { say: { en: 'You are shown a grammar point.', fr: 'On te donne un point de grammaire.' }, parts: [{ shot: 'point', hold: 2.4 }] },
      { say: { en: 'Write a sentence that uses it.', fr: 'Écris une phrase qui l’utilise.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'A tutor reads it back to you.', fr: 'Un tuteur te la relit.' }, parts: [{ shot: 'reviewed', hold: 5.6 }] },
    ],
    end: { en: 'Write your own Japanese on Tsuji.', fr: 'Écris ton propre japonais sur Tsuji.' },
    title: { en: 'Write one Japanese sentence with 〜たい', fr: 'Écris une phrase japonaise avec 〜たい' },
  },
  dictation: {
    jp: '書取', line: 'kakitori',
    steps: d => [
      ...gateSteps('kakitori', '/practice/dictation', d.level),
      { go: `/practice/dictation/${d.level}`, ready: '.clip-player__play' },
      { shot: 'listen', focus: '.clip-player', tap: '.clip-player__play' },
      { play: '.clip-player__play', shot: 'playing', seconds: d.seconds, focus: '.clip-player' },
      { type: FIELD, text: d.answer, shot: 'typing', chunk: 3, focus: '.stage__foot' },
      { shot: 'typed', focus: '.stage__foot', tap: SUBMIT },
      { click: SUBMIT, ready: '.rating-bar' },
      { wait: 900 },
      { shot: 'checked', focus: '.prompt-card' },
    ],
    beats: [
      ...gateBeats({ en: 'Train your ear.', fr: 'Entraîne ton oreille.' }),
      { say: { en: 'Hear a line. Twice, no more.', fr: 'Une phrase, deux écoutes. Pas plus.' }, parts: [{ shot: 'listen', hold: 0.8, tap: 0.6, voice: true }, { seq: 'playing', by: 'at', hold: 0.5 }] },
      { say: { en: 'Write what you hear, in rōmaji.', fr: 'Écris en rōmaji ce que tu entends.' }, parts: [{ seq: 'typing', by: 'chars', hold: 0.3 }, { shot: 'typed', hold: 0.9, tap: 0.55 }] },
      { say: { en: 'Every slip marked.', fr: 'Chaque erreur relevée.' }, parts: [{ shot: 'checked', hold: 4.2 }] },
    ],
    end: { en: 'Train your ear on Tsuji.', fr: 'Entraîne ton oreille sur Tsuji.' },
    title: { en: 'Japanese dictation: can you write what you hear?', fr: 'Dictée en japonais : sauras-tu écrire ce que tu entends ?' },
    voice: d => ({ text: d.line, who: 'reader' }),
  },
}

/** The list a studio or a render picks from. */
export function featureItems(lang = 'en') {
  const A = APP[lang] || APP.en
  return FEATURE_IDS.filter(id => FEATURES[id]).map(id => ({ id, jp: FEATURES[id].jp, sub: A.title[id], tag: A.tab }))
}

/** A feature's video, planned: what to record and what to say over it. */
export function featurePlan(banks, id, { lang = 'en', fit = 'tiktok', music = true, handle = '' } = {}) {
  const F = FEATURES[id]
  if (!F) throw new Error(`no feature video for ${id}`)
  const L = lang === 'fr' ? 'fr' : 'en'
  const d = banks['promo.json']?.features?.[id]?.[L]
  if (!d) throw new Error(`bank/promo.json has no ${id} (${L}): run python -m scripts.carousel_bank --only promo.json`)
  const A = APP[L]
  return {
    kind: 'feature', id, lang: L, fit: ['instagram', 'normal'].includes(fit) ? fit : 'tiktok', music: music !== false, handle,
    jp: F.jp, line: F.line, name: A.title[id], tab: A.tab, data: d,
    cue: F.voice ? { ...F.voice(d) } : null,
    end: weldIf(L, F.end[L]), title: weldIf(L, F.title[L]),
    beats: F.beats.map(b => ({ say: weldIf(L, b.say[L]), parts: b.parts })),
  }
}

/** The steps record.mjs takes, once the voice is known (its length is the clip's). */
export const featureSteps = (plan, seconds = 2.5) => FEATURES[plan.id].steps({ ...plan.data, seconds })

// ── Where things stand ────────────────────────────────────────
/** The video's frame: the caption's box, the screen's, the screen's scale. */
export function layoutOf(fit = 'tiktok') {
  const fmt = formatOf('story', fit)
  const fr = frame(fmt)
  const labelZ = FS.caption
  const sayZ = FS.display * 0.62
  // Room for a caption of two lines, so the screen never moves under a short one.
  const capH = labelZ * 1.3 + SP[3] + sayZ * 1.08 * 2
  const top = fr.y + capH + SP[6]
  const w = Math.min(SCREEN.w, fmt.w - 2 * 90)
  const bottom = Math.min(fmt.h - 40, fr.bottom + SCREEN.below)
  const s = w / SHOT.w
  return { fmt, fr, labelZ, sayZ, top, bottom, x: (fmt.w - w) / 2, w, h: bottom - top, s, rows: (bottom - top) / s, safeRows: (fr.bottom - top) / s }
}
const union = boxes => {
  const bs = boxes.filter(Boolean)
  if (!bs.length) return null
  const y = Math.min(...bs.map(b => b.y))
  return { y, h: Math.max(...bs.map(b => b.y + b.h)) - y }
}
/** How far down the shot the screen shows: the least that keeps what
 *  the beat is about (its focus, what it taps) inside the safe box; the
 *  top of it where it is taller than that. */
export function cropFor(focus, L) {
  const most = SHOT.h - L.rows
  if (!focus) return 0
  let off = Math.max(0, focus.y + focus.h + 48 - L.safeRows)
  if (focus.y - 24 < off) off = Math.max(0, focus.y - 24)
  return Math.min(most, off)
}
/** Where a focus taller than the safe box is read to: its foot in the box. */
export function scrollFor(focus, L) {
  if (!focus) return 0
  return Math.max(0, Math.min(SHOT.h - L.rows, focus.y + focus.h + 48 - L.safeRows))
}
// Where a beat leaves the screen: the foot of its scroll, or its crop.
const offAfter = sg => sg.scroll ? sg.scroll.to : sg.crop

// ── The timeline ──────────────────────────────────────────────
/** Each beat timed from the shots recorded: its frames (a shot from a
 *  moment), its taps, its crop; then the gate. `shots` is record.mjs's
 *  list; `voiceDur(cue)` how long the line lasts once voiced. */
export function featureTimeline(plan, shots, voiceDur = null) {
  const L = layoutOf(plan.fit)
  const byName = name => shots.map((s, i) => ({ ...s, idx: i })).filter(s => s.name === name).sort((a, b) => a.i - b.i)
  const segs = []
  const sfx = []
  const cues = []
  let at = 0
  plan.beats.forEach((b, bi) => {
    const start = at
    const frames = []
    const taps = []
    const focus = []
    let tapped = null
    for (const part of b.parts) {
      if (part.shot) {
        const [s] = byName(part.shot)
        if (!s) throw new Error(`no shot named ${part.shot}`)
        frames.push({ t: at, shot: s.idx, change: true })
        focus.push(s.focus, s.tap)
        if (part.tap != null && s.tap) {
          tapped = at + part.tap
          taps.push({ t: tapped, x: s.tap.x + s.tap.w / 2, y: s.tap.y + s.tap.h / 2 })
          sfx.push({ at: +(at + part.tap).toFixed(3), key: 'click', gain: 0.45 })
          if (part.voice && plan.cue) cues.push({ ...plan.cue, at: +(at + part.tap + 0.15).toFixed(3) })
        }
        at += part.hold
      } else if (part.seq) {
        const seq = byName(part.seq)
        if (!seq.length) throw new Error(`no shots named ${part.seq}`)
        if (part.by === 'at') {
          // As the clip played, from the tap that started it: each shot at the moment it was taken.
          const from = tapped ?? at
          seq.forEach(s => frames.push({ t: Math.max(at, from + s.at), shot: s.idx }))
          const said = plan.cue && voiceDur ? voiceDur(plan.cue) : null
          at = Math.max(at, from + Math.max(seq.at(-1).at, said ? said + 0.15 : 0)) + (part.hold ?? 0.4)
        } else {
          const from = at
          // Typed: a key's press each, a shot every few keys.
          let typed = 0
          for (const s of seq) {
            for (let c = typed; c < s.chars; c++) sfx.push({ at: +(from + c / KEYS_PER_SECOND).toFixed(3), key: 'click', gain: 0.16 })
            typed = s.chars
            frames.push({ t: from + s.chars / KEYS_PER_SECOND, shot: s.idx })
          }
          at = from + typed / KEYS_PER_SECOND + (part.hold ?? 0.3)
        }
        focus.push(seq[0].focus, seq.at(-1).focus)
      }
    }
    // A new state is laid down as the screen is: the card's own sound.
    if (bi > 0) sfx.push({ at: +start.toFixed(3), key: 'card-transition', gain: 0.5 })
    const seg = { kind: 'beat', beat: bi, start: +start.toFixed(3), dur: +(at - start).toFixed(3), frames, taps, crop: cropFor(union(focus), L), say: b.say }
    // A screen taller than the box is read down to its foot, slowly, as a learner scrolls it.
    const to = scrollFor(union(focus), L)
    const from = start + MOTION.pan + SCROLL.wait
    const until = at - SCROLL.rest
    if (to - seg.crop > 24 && until - from > 0.8) seg.scroll = { to, at: +from.toFixed(3), until: +until.toFixed(3) }
    segs.push(seg)
  })
  const endAt = at
  segs.push({ kind: 'end', start: +endAt.toFixed(3), dur: END_SECONDS })
  // The gate's own score (promo.js endScoreOf): the ask on the board's flap, the gate on the chime.
  sfx.push({ at: +(endAt + 0.6).toFixed(3), key: 'board-flap' }, { at: +(endAt + 1.7).toFixed(3), key: 'platform-chime' })
  const seconds = +(endAt + END_SECONDS).toFixed(3)
  return { kind: 'feature', seconds, fps: FEATURE_FPS, segs, sfx: sfx.sort((a, b) => a.at - b.at), cues, chapters: [], of: plan.beats.length }
}

// ── A frame ───────────────────────────────────────────────────
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const smooth = x => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }
const step = (x, n = 15) => Math.round(x * n) / n

/** The gate the video ends on, made once per plan and format. */
const gates = new WeakMap()
function gateOf(plan) {
  if (!gates.has(plan)) gates.set(plan, gateClip(formatOf('story', plan.fit), { lang: plan.lang, head: plan.end, handle: plan.handle }))
  return gates.get(plan)
}

/** The frame at `t`; `imgs[i]` is shot i, loaded. Returns a key the same
 *  for two frames that look the same. */
export function drawFeature(ctx, plan, tl, t, imgs) {
  const L = layoutOf(plan.fit)
  let si = tl.segs.findIndex(s => t < s.start + s.dur)
  if (si < 0) si = tl.segs.length - 1
  const sg = tl.segs[si]
  if (sg.kind === 'end') {
    const u = t - sg.start
    gateOf(plan).draw(ctx, u)
    return `end|${Math.round(u * FEATURE_FPS)}`
  }
  const u = t - sg.start
  const p = palette('sumi')
  const ink = palette('paper').line[plan.line]
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, L.fmt.w, L.fmt.h)
  // The caption: where it is in the app, and what the beat shows.
  const kc = step(ease(u / MOTION.caption))
  ctx.save()
  ctx.globalAlpha *= kc
  ctx.translate(0, (1 - kc) * 16)
  const label = `${plan.tab} · ${plan.jp} ${plan.name}`.toLocaleUpperCase()
  const lb = fit(ctx, label, { weight: 700, sizes: [L.labelZ, FS.xs], maxW: L.fr.w, maxLines: 1 })
  text(ctx, lb.lines[0], L.fr.x, L.fr.y + L.labelZ, { f: lb.f, color: lightOf(ink), tr: 0.16 })
  const say = fit(ctx, sg.say, { weight: 900, fam: 'serif', sizes: [L.sayZ, FS.heading, FS.title], maxW: L.fr.w, maxLines: 2, lh: 1.08 })
  paragraph(ctx, say, L.fr.x, L.fr.y + L.labelZ * 1.3 + SP[3], p.ink, 'left', 1.08)
  ctx.restore()
  // The screen moves to what the beat shows.
  const prev = si > 0 && tl.segs[si - 1].kind === 'beat' ? offAfter(tl.segs[si - 1]) : sg.crop
  const kp = step(ease(u / MOTION.pan), 30)
  let off = prev + (sg.crop - prev) * kp
  if (sg.scroll && t > sg.scroll.at) off = sg.crop + (sg.scroll.to - sg.crop) * smooth((t - sg.scroll.at) / (sg.scroll.until - sg.scroll.at))
  // The shot showing, and the one before it while a new state comes in.
  let fi = 0
  for (let i = 0; i < sg.frames.length; i++) if (sg.frames[i].t <= t + 1e-6) fi = i
  const cur = sg.frames[fi]
  const before = fi > 0 ? sg.frames[fi - 1] : si > 0 && tl.segs[si - 1].frames ? tl.segs[si - 1].frames.at(-1) : null
  const kf = cur.change && before ? step(ease((t - cur.t) / MOTION.fade)) : 1
  // Its frame, on the ground.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 60
  ctx.fillStyle = '#000'
  rrect(ctx, L.x, L.top, L.w, L.h, SCREEN.radius)
  ctx.fill()
  ctx.restore()
  ctx.save()
  rrect(ctx, L.x, L.top, L.w, L.h, SCREEN.radius)
  ctx.clip()
  const shotAt = (img, a) => {
    if (!img || a <= 0) return
    ctx.save()
    ctx.globalAlpha *= a
    ctx.drawImage(img, 0, off, SHOT.w, L.rows, L.x, L.top, L.w, L.h)
    ctx.restore()
  }
  if (kf < 1) shotAt(imgs[before.shot], 1)
  shotAt(imgs[cur.shot], kf)
  // A finger: shown before the tap, pressed on it, its ring after.
  let tapKey = ''
  for (const tp of sg.taps) {
    const d = t - tp.t
    if (d < -MOTION.finger || d > MOTION.ring) continue
    const cx = L.x + tp.x * L.s
    const cy = L.top + (tp.y - off) * L.s
    const show = d < 0 ? step(ease(1 + d / MOTION.finger)) : step(1 - d / MOTION.ring)
    const r = d < 0 ? 38 : 34
    ctx.fillStyle = `rgba(255,255,255,${(0.5 * show).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(23,21,26,${(0.35 * show).toFixed(3)})`
    ctx.lineWidth = 3
    ctx.stroke()
    if (d >= 0) {
      const k = step(d / MOTION.ring)
      ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - k)).toFixed(3)})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(cx, cy, 34 + 46 * k, 0, Math.PI * 2)
      ctx.stroke()
    }
    tapKey += `${show.toFixed(2)}|`
  }
  ctx.restore()
  // Its rim, in the feature's line.
  ctx.strokeStyle = ink
  ctx.lineWidth = 4
  rrect(ctx, L.x + 2, L.top + 2, L.w - 4, L.h - 4, SCREEN.radius - 2)
  ctx.stroke()
  return `${si}|${fi}|${kc}|${Math.round(off)}|${kf}|${tapKey}`
}
// A line's pigment lifted for the dark ground: a caption in it reads.
function lightOf(hex) {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * 0.45))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Where the video's still is taken: its first beat, its caption in. */
export const featureStillAt = () => 1.2

// ── Its page ──────────────────────────────────────────────────
const PAGE = {
  en: {
    app: 'Keep going on Tsuji', start: 'Start free on Tsuji', more: 'Start free on Tsuji.',
    credits: music => ['Voices: VOICEVOX Nemo.', music && 'Music: made for Tsuji.'].filter(Boolean).join(' '),
    tags: ['LearnJapanese', 'Japanese', 'JLPT', '日本語', 'JapaneseApp'],
  },
  fr: {
    app: 'Continue sur Tsuji', start: 'Commence gratuitement sur Tsuji', more: 'Commence gratuitement sur Tsuji.',
    credits: music => ['Voix : VOICEVOX Nemo.', music && 'Musique : faite pour Tsuji.'].filter(Boolean).join(' '),
    tags: ['ApprendreLeJaponais', 'Japonais', 'JLPT', '日本語', 'Tsuji'],
  },
}
/** The video's page for YouTube, and its posts for Reels and TikTok. */
export function featurePage(plan, tl, site) {
  const P = PAGE[plan.lang]
  const A = APP[plan.lang]
  const desc = (A.desc[plan.id] || '').split('\n').filter(Boolean)
  const credits = P.credits(plan.music)
  const voiced = tl.cues.length > 0
  const tags = P.tags
  const title = `${plan.title} #shorts`
  const lines = [`${plan.jp} ${plan.name}`, ...desc.map(x => `· ${x}`)].join('\n')
  const page = {
    title,
    description: [lines, `${P.start}: ${site}`, voiced || plan.music ? credits : '', [...tags, 'Shorts'].map(x => `#${x}`).join(' ')].filter(Boolean).join('\n\n'),
    tags: [...tags, plan.name, 'Tsuji', 'shorts'].join(', '),
  }
  return { ...page, feeds: feedPosts(page, { hook: plan.title, lines: [lines], app: P.more.replace(/\.$/, ''), credits: voiced || plan.music ? [credits] : [], hashtags: tags }, plan.lang) }
}

/** The command that makes the video, from frontend/. */
export function featureCommand(id, lang = 'en', fit = 'tiktok', music = true) {
  return ['VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs', `--feature ${id}`, `--lang ${lang}`, fit !== 'tiktok' ? `--fit ${fit}` : '', music ? '' : '--music none'].filter(Boolean).join(' ')
}
