// ── 棚 — the Instagram highlights (plan 322) ─────────────────────────
// The profile's shelf: seven highlights under the bio, one per thing the
// app does, in the order a visitor asks (what is it, what do I do each
// day, what is different, what else, the exam, the duels, is it free).
// The owner's picks of the canvas drawn for it: A for the covers, the
// station's roundel (a paper disc, a ring in the section's own pigment,
// one glyph), and 3 for what a highlight holds, a still on Today's print
// to open, the app itself filmed in the middle where a recording exists
// (feature.js, record.mjs), and the print's sun to close, its gate left
// bare for Instagram's link sticker (promo.js, `sticker`).
//
// This module is the shelf and nothing else: which frames each highlight
// holds, in which order, and its cover. The frames are the promo
// stories' (promo.js) and the feature videos' (feature.js), drawn by
// their own modules; long/render.mjs --highlight makes the files.
import { DARK, LIGHT } from '../landing/tokens.mjs'
import { FS, SP, font, formatOf, frame, mark, rrect, text } from './draw.js'
import { FEATURES } from './feature.js'
import { STORIES } from './promo.js'

/** The shelf, left to right as the profile shows it. */
export const SHELF = ['start', 'daily', 'analyzer', 'practice', 'jlpt', 'duels', 'free']

// The one ink the tokens the studio shares do not carry: the duels' gold
// (index.css's --duel-gold, held equal by carousel.test.js).
export const SHELF_INKS = { '--duel-gold': '#d9a43a' }
const PAPER = { ...DARK, ...LIGHT }

// A cover's ring names what the highlight is, by the object and never by
// the hex (DESIGN.md, "Three families"): a section wears its line, the
// start the metal every primary action wears, the free card its own
// band, the duels their stage (sumi) and its gold.
const RINGS = {
  gold: () => ({ ring: PAPER['--accent2'] }),
  line: name => ({ ring: PAPER[`--line-${name}`] }),
  pass: () => ({ ring: PAPER['--pass-band'] }),
  duel: () => ({ ring: SHELF_INKS['--duel-gold'], disc: DARK['--bg-main'], ink: DARK['--text-primary'] }),
}

// A highlight's frames, in posting order:
//   { story }                 every frame of a promo story, as stills
//   { story, keys }           those frames of it
//   { story, clip }           the story played whole, as one clip (the duels')
//   { feature, beats: [a, b] } the app filmed: that feature's beats a to b, as one clip
// A name is what the profile prints under the cover: ten characters at
// most, or Instagram cuts it.
export const HIGHLIGHTS = {
  start: { glyph: '辻', ring: ['gold'], name: { en: 'Start', fr: 'Découvrir' }, frames: [{ story: 'pitch' }] },
  daily: { glyph: '日', ring: ['line', 'kana'], name: { en: 'Daily', fr: 'Quotidien' }, frames: [{ story: 'card' }] },
  analyzer: { glyph: '解', ring: ['line', 'kaiseki'], name: { en: 'Analyzer', fr: 'Analyseur' }, frames: [{ story: 'analyser' }] },
  practice: {
    glyph: '練', ring: ['line', 'reading'], name: { en: 'Practice', fr: 'Pratique' },
    frames: [
      { story: 'practice', keys: ['gates'] },
      // One clip an exercise: what the learner does, then what the app says back.
      { feature: 'reading', beats: [3, 4] },
      { feature: 'comprehension', beats: [4, 5] },
      { feature: 'dictation', beats: [2, 4] },
      { feature: 'translation', beats: [2, 4] },
      { feature: 'composition', beats: [2, 5] },
      { feature: 'conversation', beats: [3, 4] },
      { story: 'practice', keys: ['board'] },
    ],
  },
  jlpt: {
    glyph: '試', ring: ['line', 'exam'], name: { en: 'JLPT', fr: 'JLPT' },
    frames: [
      { story: 'exam', keys: ['question', 'answer'] },
      // The paper sat, then handed in.
      { feature: 'exam', beats: [2, 3] },
      { feature: 'exam', beats: [4, 5] },
      { story: 'exam', keys: ['board'] },
    ],
  },
  duels: { glyph: '戦', ring: ['duel'], name: { en: 'Duels', fr: 'Duels' }, frames: [{ story: 'duel', clip: 'story' }] },
  free: { glyph: '券', ring: ['pass'], name: { en: 'Free?', fr: 'Gratuit ?' }, frames: [{ story: 'pass' }] },
}
/** The longest name the profile prints whole. */
export const NAME_MAX = 10

/** A highlight's cover inks: its ring, its disc and the glyph's ink. */
export function coverInks(id) {
  const [kind, arg] = HIGHLIGHTS[id].ring
  return { disc: PAPER['--bg-main'], ink: PAPER['--text-primary'], ...RINGS[kind](arg) }
}

// ── The cover ─────────────────────────────────────────────────
// Instagram cuts a circle out of the middle of the picture chosen, so the
// picture is the ring's pigment to its corners and the disc inside it:
// wherever the circle falls, the ring is whole.
export const COVER = { size: 1080, ring: 0.085, glyph: 0.44, mark: 0.46 }

/** A highlight's cover, drawn on a square of `size`. */
export function drawCover(ctx, id, size = COVER.size) {
  const h = HIGHLIGHTS[id]
  const { ring, disc, ink } = coverInks(id)
  const c = size / 2
  ctx.save()
  ctx.fillStyle = ring
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(c, c, c * (1 - 2 * COVER.ring), 0, Math.PI * 2)
  ctx.fill()
  if (h.glyph === '辻') {
    // Where the app names itself the mark is drawn, its road in the metal.
    const m = size * COVER.mark
    mark(ctx, c - m / 2, c - m / 2, m, ink, ring)
  } else {
    ctx.font = font(900, size * COVER.glyph, 'serif')
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    // The ink centred, not its line box.
    const mt = ctx.measureText(h.glyph)
    ctx.fillText(h.glyph, c, c + (mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent) / 2)
  }
  ctx.restore()
}

// ── What a highlight holds ────────────────────────────────────
// A story's frames stand at the stories' own margins (draw.js FORMATS:
// 350 at the head, 330 at the foot), which clear what Instagram lays over
// a story: its bars and the account's name over the top 250, the reply
// field over the foot. A filmed clip is laid out at the same.
export const STORY_FIT = 'tiktok'

/** The files a highlight is made of, in posting order: each
 *  { n, kind: 'still' | 'clip', file, story | feature, ... }. `frameKeys(story)`
 *  gives a promo story's frame keys (its deck's), for a story taken whole. */
export function highlightFiles(id, frameKeys) {
  const h = HIGHLIGHTS[id]
  if (!h) throw new Error(`no highlight named ${id}: ${SHELF.join(', ')}`)
  const out = []
  const num = () => String(out.length + 1).padStart(2, '0')
  for (const f of h.frames) {
    if (f.feature) {
      const [a, b] = f.beats
      const same = h.frames.filter(x => x.feature === f.feature).length > 1
      out.push({ kind: 'clip', feature: f.feature, beats: [a, b], file: `${num()}-${f.feature}${same ? `-${a}` : ''}.mp4` })
    } else if (f.clip) {
      out.push({ kind: 'clip', story: f.story, clip: f.clip, file: `${num()}-${f.story}.mp4` })
    } else {
      for (const key of f.keys || frameKeys(f.story)) out.push({ kind: 'still', story: f.story, key, file: `${num()}-${f.story}-${key}.png` })
    }
  }
  // The frame the link sticker stands on: the last, a story's gate.
  const last = out.at(-1)
  last.gate = true
  return out.map((x, i) => ({ n: i + 1, ...x }))
}

/** The beats a clip is cut from, of a feature's timeline: where it
 *  starts, how long it lasts, and its sounds and lines on its own clock.
 *  A line that began before the cut is not said in it. */
export function cutBeats(tl, [a, b]) {
  const beats = tl.segs.filter(s => s.kind === 'beat')
  if (!beats[a] || !beats[b] || b < a) throw new Error(`no beats ${a} to ${b}: the video has ${beats.length}`)
  const from = beats[a].start
  const to = beats[b].start + beats[b].dur
  const within = x => x.at >= from && x.at < to
  const shift = x => ({ ...x, at: +(x.at - from).toFixed(3) })
  return { from, seconds: +(to - from).toFixed(3), sfx: tl.sfx.filter(within).map(shift), cues: tl.cues.filter(within).map(shift) }
}

// ── A voiced clip's credit ────────────────────────────────────
// A story has no caption to carry the voice's credit, and the engine's
// licence asks for it wherever its voice is heard (CLAUDE.md, "Speech"):
// it is written on the clip, small, at the head of the safe box.
export const VOICE_CREDIT = { en: 'Voice: VOICEVOX Nemo', fr: 'Voix : VOICEVOX Nemo' }
export function drawVoiceCredit(ctx, lang = 'en') {
  const fr = frame(formatOf('story', STORY_FIT))
  const label = (VOICE_CREDIT[lang] || VOICE_CREDIT.en).replace(' :', ' :')
  const f = font(500, FS.caption, 'latin')
  ctx.save()
  ctx.font = f
  const w = ctx.measureText(label).width + 2 * SP[3]
  const h = FS.caption * 1.9
  ctx.fillStyle = PAPER['--bg-main']
  ctx.globalAlpha = 0.92
  rrect(ctx, fr.x, fr.y, w, h, h / 2)
  ctx.fill()
  ctx.globalAlpha = 1
  text(ctx, label, fr.x + SP[3], fr.y + h * 0.68, { f, color: PAPER['--text-secondary'] })
  ctx.restore()
}

// ── What goes beside the files ────────────────────────────────
const SAY = {
  en: {
    head: 'TSUJI · INSTAGRAM HIGHLIGHT',
    name: 'Name', cover: 'Cover', coverHow: 'cover.png (Edit highlight › Edit cover › choose it from your photos)',
    order: 'Post these as stories in this order, then add them to the highlight:',
    still: 'still', clip: s => `clip, ${s} s`,
    link: site => `add the link sticker (${site}) at its foot, where the gate would stand`,
    voiced: 'A clip that speaks carries its credit on the frame: Voice: VOICEVOX Nemo.',
  },
  fr: {
    head: 'TSUJI · À LA UNE INSTAGRAM',
    name: 'Nom', cover: 'Couverture', coverHow: 'cover.png (Modifier la story à la une › Modifier la couverture › la choisir dans tes photos)',
    order: 'Publie ces stories dans cet ordre, puis ajoute-les à la story à la une :',
    still: 'image', clip: s => `clip, ${s} s`,
    link: site => `ajoute le sticker de lien (${site}) en bas, à la place de la porte`,
    voiced: 'Un clip qui parle porte son crédit à l’image : Voix : VOICEVOX Nemo.',
  },
}
/** The note written beside a highlight's files: its name, its cover, the
 *  order, and where the link goes. `seconds[file]` a clip's length. */
export function highlightNote(id, files, { lang = 'en', site, seconds = {}, voiced = false } = {}) {
  const S = SAY[lang] || SAY.en
  const h = HIGHLIGHTS[id]
  const wide = Math.max(...files.map(f => f.file.length)) + 2
  const rows = files.map(f => {
    const what = f.kind === 'clip' ? S.clip(seconds[f.file] != null ? seconds[f.file].toFixed(1) : '?') : S.still
    return `${f.file.padEnd(wide)}${what}${f.gate ? `: ${S.link(site)}` : ''}`
  })
  return [S.head, '', `${S.name}: ${h.name[lang] || h.name.en}`, `${S.cover}: ${S.coverHow}`, '', S.order, '', ...rows, ...(voiced ? ['', S.voiced] : []), ''].join('\n')
}

/** The command that makes a highlight's files. */
export function highlightCommand(id, lang = 'en', hour = 'day') {
  return ['node carousel/long/render.mjs', `--highlight ${id}`, ...(lang !== 'en' ? [`--lang ${lang}`] : []), ...(hour !== 'day' ? [`--hour ${hour}`] : [])].join(' ')
}

/** Every story and feature the shelf draws on is one the studio has. */
export function shelfProblems() {
  const out = []
  for (const id of SHELF) {
    const h = HIGHLIGHTS[id]
    if (!h) { out.push(`${id}: not a highlight`); continue }
    for (const lang of ['en', 'fr']) if ([...h.name[lang]].length > NAME_MAX) out.push(`${id}: ${h.name[lang]} is over ${NAME_MAX} characters`)
    for (const f of h.frames) {
      if (f.feature && !FEATURES[f.feature]) out.push(`${id}: no feature ${f.feature}`)
      if (f.story && !STORIES.includes(f.story)) out.push(`${id}: no story ${f.story}`)
    }
    if (!h.frames.at(-1).story) out.push(`${id}: ends on no gate`)
  }
  return out
}
