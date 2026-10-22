// ── 語彙 — the vocabulary shorts (plan 252) ──────────────────────────
// A level's deck, or a theme's words, nine at a time as a 9:16 short of
// its own (the studio's 語彙 source), in one of the two looks the owner
// picked from three drawn:
//   card  札  washi and the vocabulary line, as the reply shorts: the
//             word on a card against a ring, then read, said, meant and
//             set in a sentence; nine stops along the band for nine words.
//   quiz  挑  sumi and gold, as the Défi look: the word, four meanings
//             against a burning fuse, the right one kept with its reading
//             and its sentence; a score asked for at the end.
// Both end on the carousel's call to action for the words station.
// Since plan 257 a card whose word has a picture (content/pictures/,
// bank/pictures.json) turns over at the reveal onto it, as the owner's
// sheet draws a word: the picture across the card's top, the word and
// its reading under it, what it means; it gives its sentence room.
//
// Pure but for the canvas: render.mjs --words makes it with the voice
// and the app's sounds; the studio previews it, silent, frame for frame.
import { FS, SP, R, alpha, drawSentence, fit, font, formatOf, layoutSentence, measure, mix, palette, paragraph, paragraphH, rrect, text } from './draw.js'
import { drawCta } from './funnel.js'
import { deal, furiganaOf, gloss, seeded, shuffle } from './common.js'
import { overlaps } from './quizzes.js'
import { weldIf } from './strings.js'
import { TALL, pageParts, wordItem } from './long.js'
import { feedPosts } from './feeds.js'
import { tuned } from './tune.js'

export const STYLES = ['card', 'quiz']
// Nine words a short (the owner's, plan 252): past the minute, as the
// reply shorts are, and under the three minutes Shorts allows.
export const COUNT = 9
export const LIMIT = 179
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const OK = { paper: '#4d7639', sumi: '#74a15f' }
const FPS_KEY = 15

const SAY = {
  en: {
    words: lv => `JLPT ${lv} · words`,
    hook: n => `Can you read these ${n} words?`,
    read: 'How do you read it?',
    hint: 'Say it out loud before the voice does.',
    inSentence: 'In a sentence',
    quizHead: head => `Word quiz · ${head}`,
    ask: 'What does it mean?',
    means: 'It means',
    score: 'How many did you get?',
    comments: 'Your score in the comments',
    part: n => `part ${n}`,
    count: n => `${n} words`,
  },
  fr: {
    words: lv => `JLPT ${lv} · vocabulaire`,
    hook: n => `Sauras-tu lire ces ${n} mots ?`,
    read: 'Comment se lit-il ?',
    hint: 'Dis-le à voix haute avant la voix.',
    inSentence: 'Dans une phrase',
    quizHead: head => `Quiz de mots · ${head}`,
    ask: 'Que veut dire ce mot ?',
    means: 'Il veut dire',
    score: 'Combien en as-tu eu ?',
    comments: 'Ton score en commentaire',
    part: n => `partie ${n}`,
    count: n => `${n} mots`,
  },
}
const PAGE = {
  en: {
    title: {
      card: (n, lv) => `Can you read these ${n} JLPT ${lv} Japanese words? #shorts`,
      quiz: (n, lv) => `JLPT ${lv} word quiz: what do these ${n} Japanese words mean? #shorts`,
      themeCard: (n, th) => `${n} Japanese words: ${th} #shorts`,
      themeQuiz: (n, th) => `${th} in Japanese: a ${n}-word quiz #shorts`,
    },
    lead: {
      card: 'Read each word before its reading appears, say it, then hear it and see it in a sentence.',
      quiz: 'Pick the meaning before the fuse burns out. How many did you get?',
    },
    ask: { card: 'Which one did you know? Tell me in the comments.', quiz: 'Your score in the comments.' },
  },
  fr: {
    title: {
      card: (n, lv) => `Sauras-tu lire ces ${n} mots de japonais du JLPT ${lv} ? #shorts`,
      quiz: (n, lv) => `Quiz JLPT ${lv} : que veulent dire ces ${n} mots japonais ? #shorts`,
      themeCard: (n, th) => `${n} mots de japonais : ${th} #shorts`,
      themeQuiz: (n, th) => `${th} en japonais : un quiz de ${n} mots #shorts`,
    },
    lead: {
      card: 'Lis chaque mot avant que sa lecture apparaisse, dis-le, puis écoute-le et vois-le dans une phrase.',
      quiz: 'Choisis le sens avant la fin de la mèche. Combien en as-tu eu ?',
    },
    ask: { card: 'Lesquels connaissais-tu ? Dis-le-moi en commentaire.', quiz: 'Ton score en commentaire.' },
  },
}

// ── What a short teaches ──────────────────────────────────────────
/** The bank files a level's shorts read: its deck, the sentences of its
 *  level and the easier ones (a word's example), the themes, the figures. */
export const wordsFiles = level => [`words-${level}.json`, ...LEVELS.slice(0, LEVELS.indexOf(level) + 1).map(lv => `${lv}.json`), 'themes.json', 'pictures.json', 'index.json']

const glossed = (list, lang) => list.filter(w => gloss(w, lang)[0])
const parts = list => Math.ceil(list.length / COUNT)
/** The shorts a level can make: its deck nine words at a time, in its
 *  teaching order, then each theme's, nine at a time. */
export function wordsItems(banks, level, lang = 'en') {
  const S = SAY[lang] || SAY.en
  const out = []
  const deck = glossed(banks[`words-${level}.json`]?.words || [], lang)
  for (let p = 1; p <= parts(deck); p++) {
    const some = deck.slice((p - 1) * COUNT, p * COUNT)
    out.push({ id: `${level}:${p}`, jp: `語彙 ${p}`, sub: `${some.slice(0, 6).map(w => w.t).join('、')}…`, tag: S.count(some.length) })
  }
  for (const [key, th] of Object.entries(banks['themes.json']?.themes || {})) {
    const words = glossed(th.words, lang)
    const name = weldIf(lang, th.name?.[lang] || th.name?.en || key)
    for (let p = 1; p <= parts(words); p++) {
      out.push({ id: `theme:${key}:${p}`, jp: `${th.head?.t || key}${parts(words) > 1 ? ` ${p}` : ''}`, sub: name, tag: S.count(Math.min(COUNT, words.length - (p - 1) * COUNT)) })
    }
  }
  return out
}

/** A meaning as a choice: its first sense, without what qualifies it
 *  ("fat, thick (round things)" is "fat"). */
export const shortSense = s => String(s || '').replace(/\s*[(（][^)）]*[)）]/g, '').split(/[;,、]/)[0].trim() || String(s || '').trim()
/** A meaning as the card shows it: its first three parts at most, a
 *  parenthesis kept whole ("to wear, to put on (shirt, coat, …)"). */
export function cardSense(str) {
  const parts = []
  let depth = 0
  let at = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    if ('(（'.includes(s[i])) depth += 1
    else if (')）'.includes(s[i])) depth = Math.max(0, depth - 1)
    else if (s[i] === ',' && !depth) { parts.push(s.slice(at, i).trim()); at = i + 1 }
  }
  parts.push(s.slice(at).trim())
  return parts.filter(Boolean).slice(0, 3).join(', ')
}
const sensesOf = (w, lang) => [...((lang === 'fr' && w.fr?.length ? w.fr : w.en) || []), ...(w.en || [])]
const isVerb = w => /^to /.test(w.en?.[0] || '')
/** Three wrong meanings for `w` (plan 252): another word's first sense,
 *  as short, that shares no word with any of `w`'s senses nor with each
 *  other (quizzes.overlaps, the carousel's own rule), a verb's among
 *  verbs and a thing's among things, and near the right one's length,
 *  so neither the form nor the length answers. */
export function wrongMeanings(w, pools, lang, seed, kin = []) {
  const right = weldIf(lang, shortSense(gloss(w, lang)[0]))
  // Its senses wherever it is written: a theme's 地下鉄 is "subway", the deck's "underground train".
  const mine = [w, ...kin].flatMap(x => sensesOf(x, lang))
  const out = []
  for (const pool of pools) {
    const rand = seeded(`${seed}|${out.length}`)
    const cands = shuffle(pool.filter(x => x.t !== w.t && x.r !== w.r && x[lang]?.[0] && isVerb(x) === isVerb(w)), rand)
      .map(x => ({ x, text: weldIf(lang, shortSense(x[lang][0])) }))
      .filter(c => c.text && c.text.toLowerCase() !== right.toLowerCase())
      .sort((a, b) => Math.abs(a.text.length - right.length) - Math.abs(b.text.length - right.length))
    for (const c of cands) {
      if (out.length === 3) break
      if (mine.some(s => overlaps(s, c.text)) || sensesOf(c.x, lang).some(s => overlaps(s, right))) continue
      if (out.some(o => overlaps(o, c.text) || o.toLowerCase() === c.text.toLowerCase())) continue
      out.push(c.text)
    }
    if (out.length === 3) break
  }
  return { right, wrong: out }
}

// Every entry of a written word the banks hold, decks and themes: its
// senses are all its own. Gathered once for the banks a plan is given.
const kins = new WeakMap()
function kinOf(banks) {
  if (kins.has(banks)) return kins.get(banks)
  const kin = new Map()
  const lists = [...Object.entries(banks).filter(([name]) => /^words-N\d\.json$/.test(name)).map(([, f]) => f.words), ...Object.values(banks['themes.json']?.themes || {}).map(x => x.words)]
  for (const x of lists.flat()) {
    const key = `${x.t}::${x.r}`
    if (!kin.has(key)) kin.set(key, [])
    kin.get(key).push(x)
  }
  kins.set(banks, kin)
  return kin
}

/** A short's plan, from a list id (`N5:3`, `theme:animals:1`). */
export function wordsPlan(banks, id, { lang = 'en', style = 'card', tune = {}, fit = 'tiktok' } = {}) {
  const [a, b, c] = String(id).split(':')
  const theme = a === 'theme' ? b : null
  const part = Math.max(1, Number(theme ? c : b) || 1)
  const level = theme ? 'N5' : LEVELS.includes(a) ? a : 'N5'
  const th = theme ? banks['themes.json']?.themes?.[theme] : null
  if (theme && !th) throw new Error(`no theme ${theme}`)
  const all = glossed(theme ? th.words : banks[`words-${level}.json`]?.words || [], lang)
  const words = all.slice((part - 1) * COUNT, part * COUNT)
  if (!words.length) throw new Error(`no words for ${id}`)
  const S = SAY[lang] || SAY.en
  const themeName = th ? weldIf(lang, th.name?.[lang] || th.name?.en || theme) : null
  const st = STYLES.includes(style) ? style : 'card'
  const kin = kinOf(banks)
  const pics = banks['pictures.json']?.pictures || {}
  // A theme's words are no level's: their examples are left for the deck's shorts.
  const items = words.map(w => {
    const it = theme ? { t: w.t, r: w.r, ro: w.ro, gloss: weldIf(lang, gloss(w, lang)[0]), ex: null } : wordItem(w, banks, lang, level)
    const fu = w.fu || furiganaOf(w.t, w.r)
    const out = { ...it, fu, e: w.e || null, pic: pics[`${w.t}::${w.r}`] || null }
    if (st !== 'quiz') return out
    // The theme's other words first (a cat among a dog and a horse), then the level's deck.
    // Never the theme's own name (動物, "animal", is no wrong answer for a monkey).
    const pools = theme ? [th.words, ...Object.values(banks['themes.json'].themes).filter(x => x !== th).map(x => x.words)].map(l => l.filter(x => x.t !== th.head?.t)) : [all, banks[`words-${level}.json`].words]
    const { right, wrong } = wrongMeanings(w, pools, lang, `${id}|${w.t}`, kin.get(`${w.t}::${w.r}`) || [])
    return { ...out, ...deal(right, wrong, `${id}|${w.t}|deal`) }
  }).filter(it => st !== 'quiz' || it.choices.length === 4)
  return {
    source: 'words', id: String(id), lang, level, theme: themeName, part, style: st, tune, fit,
    head: themeName || S.words(level), title: themeName ? `${themeName} · ${S.part(part)}` : `${S.words(level)} · ${S.part(part)}`, items,
  }
}

// ── The video, timed ──────────────────────────────────────────────
const guess = text => 0.35 + [...text].length * 0.14
/** The lines a short says: each word's reading, its sentence. */
export function wordsCues(plan) {
  return wordsTimeline(plan).cues.map(c => ({ text: c.text, who: c.who }))
}
/** The video, timed: `dur(cue)` is how long a line lasts once voiced
 *  (render.mjs, after the engine said it), else a guess. */
export function wordsTimeline(plan, dur = null) {
  const T = key => tuned(plan.tune, `words.${key}`)
  const segs = []
  const cues = []
  const sfx = []
  const chapters = []
  let at = 0
  const say = (start, textOf) => {
    const c = { at: +start.toFixed(3), text: textOf, who: 'reader' }
    cues.push(c)
    return dur?.(c) ?? guess(textOf)
  }
  const fx = (t, key, gain) => sfx.push({ at: +t.toFixed(3), key, ...(gain != null ? { gain } : {}) })
  const of = plan.items.length
  fx(0.15, 'board-flap')
  plan.items.forEach((it, i) => {
    const start = at
    if (i % 3 === 0) chapters.push({ at: +start.toFixed(3), title: `${i + 1}–${Math.min(of, i + 3)} · ${plan.items.slice(i, i + 3).map(x => x.t).join(', ')}` })
    if (i) fx(start + 0.05, 'card-transition', 0.8)
    const m = {}
    if (plan.style === 'quiz') {
      // The word, its four meanings, the fuse a tick a second; the right one.
      m.show = 0.5
      const count = T('count')
      for (let c = 0; c < count; c++) fx(start + m.show + c, 'click', 0.35)
      m.reveal = m.show + count
      fx(start + m.reveal, 'correct')
    } else {
      // The word alone against the ring, a tick a second; then turned over.
      m.reveal = T('think')
      for (let c = 1; c < m.reveal; c++) fx(start + c, 'click', 0.3)
      fx(start + m.reveal, 'card-flip', 0.6)
    }
    let u = m.reveal + 0.25
    m.say = u
    u += say(start + u, it.r) + 0.3 + T('hold')
    if (it.ex) {
      m.ex = u
      u += 0.4
      u += say(start + u, it.ex.jp) + T('after')
    } else u += 0.4
    segs.push({ type: 'word', i, n: i + 1, start: +start.toFixed(3), dur: +u.toFixed(3), marks: m })
    at += u
  })
  if (plan.style === 'quiz') {
    segs.push({ type: 'score', start: +at.toFixed(3), dur: 3.4, marks: {} })
    fx(at + 0.1, 'board-flap')
    at += 3.4
  }
  chapters.push({ at: +at.toFixed(3), title: 'Tsuji' })
  segs.push({ type: 'cta', start: +at.toFixed(3), dur: 5, marks: {} })
  fx(at + 0.3, 'platform-chime')
  at += 5
  return { seconds: +at.toFixed(3), segs, cues, sfx, chapters, of }
}

/** Where its still is taken (its thumbnail, the studio's PNG): the first
 *  word asked, the hook under it. */
export const wordsStillAt = (plan, tl) => Math.min(1.2, (tl.segs[0]?.marks.reveal ?? 2) - 0.4)

// ── Its page and its command ──────────────────────────────────────
/** The video's page: its YouTube title, description and tags, and its
 *  post for each feed (plan 251). */
export function wordsPage(plan, tl, site, figures = null) {
  const P = PAGE[plan.lang] || PAGE.en
  const n = plan.items.length
  const style = plan.style
  const title = plan.theme ? P.title[style === 'quiz' ? 'themeQuiz' : 'themeCard'](n, plan.theme) : P.title[style](n, plan.level)
  const { app, credits, tags } = pageParts(tl, plan.lang, { figures, level: plan.level, kind: 'vocab' })
  const fr = plan.lang === 'fr'
  const hashtags = [fr ? 'ApprendreLeJaponais' : 'LearnJapanese', fr ? 'Japonais' : 'Japanese', ...(plan.theme ? [] : [`JLPT${plan.level}`]), '日本語', fr ? 'VocabulaireJaponais' : 'JapaneseVocabulary', 'nihongo']
  const description = [P.lead[style], `${app}\n${site}`, credits, ['Shorts', ...hashtags.slice(0, 4)].map(x => `#${x}`).join(' ')].join('\n\n')
  // A theme's words span the levels: no level is named for it.
  const tagList = [...new Set(tags.filter(t => !plan.theme || !/JLPT|N\d/.test(t)))].concat('shorts').join(', ')
  const page = { title, description, tags: tagList }
  const feed = { hook: title.replace(/\s*#shorts$/i, ''), lines: [P.lead[style]], app, ask: P.ask[style], credits: [credits], hashtags }
  return { ...page, feeds: feedPosts(page, feed, plan.lang) }
}

/** The command that makes it, from frontend/, with the voice engine running. */
export function wordsCommand(plan, flags = '') {
  const args = [`--words ${plan.id}`, `--style ${plan.style}`, `--lang ${plan.lang}`]
  if (plan.fit && plan.fit !== 'tiktok') args.push(`--fit ${plan.fit}`)
  return `VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs ${args.join(' ')}${flags}`
}

// ── Drawing ───────────────────────────────────────────────────────
// Drawn in TikTok's 9:16 video frame (TALL.safe); at Instagram's margins
// or none it is moved whole into that box, scaled and centred, as the
// other shorts are (plan 239).
const W = TALL.w
const H = TALL.h
const G = { x: TALL.safe.l, right: W - TALL.safe.r, top: TALL.safe.t, bottom: H - TALL.safe.b }
G.w = G.right - G.x
G.cx = G.x + G.w / 2
const boxOf = f => {
  const s = f === 'tiktok' ? TALL.safe : formatOf('story', f).safe
  return { x: s.l, y: s.t, w: W - s.l - s.r, h: H - s.t - s.b }
}
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const clamp = x => Math.min(1, Math.max(0, x))

/** The frame at second `t`, and a key that is the same for two frames that look the same. */
export function drawWords(ctx, plan, tl, t) {
  if (!plan.fit || plan.fit === 'tiktok') return drawFrame(ctx, plan, tl, t)
  const from = boxOf('tiktok')
  const to = boxOf(plan.fit)
  const s = Math.min(to.w / from.w, to.h / from.h)
  ctx.fillStyle = palette(plan.style === 'quiz' ? 'sumi' : 'paper').bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(to.x + (to.w - from.w * s) / 2, to.y + (to.h - from.h * s) / 2)
  ctx.scale(s, s)
  ctx.translate(-from.x, -from.y)
  const key = drawFrame(ctx, plan, tl, t)
  ctx.restore()
  return key
}

function drawFrame(ctx, plan, tl, t) {
  let n = tl.segs.findIndex(s => t < s.start + s.dur)
  if (n < 0) n = tl.segs.length - 1
  const sg = tl.segs[n]
  const u = Math.max(0, t - sg.start)
  const key = `${n}|${Math.floor(u * FPS_KEY)}`
  ctx.save()
  ctx.shadowColor = 'transparent'
  ctx.globalAlpha = 1
  if (sg.type === 'cta') {
    const p = palette(plan.style === 'quiz' ? 'sumi' : 'paper')
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = ease(u / 0.4)
    drawCta(ctx, { id: 'story', fit: 'tiktok', w: W, h: H, safe: TALL.safe }, { lang: plan.lang, feature: 'words', design: plan.style === 'quiz' ? 'defi' : 'fiche', line: 'vocab' })
  } else if (plan.style === 'quiz') drawQuiz(ctx, plan, tl, sg, u)
  else drawCard(ctx, plan, tl, sg, u)
  ctx.restore()
  return key
}

// ── Shared parts ──
function caps(ctx, str, x, y, color, { z = FS.caption, align = 'left', tr = 0.18 } = {}) {
  return text(ctx, str.toUpperCase(), x, y, { f: font(700, z, 'latin'), color, align, tr })
}
function shadowCard(ctx, x, y, w, h, fill, { r = R.card * 2, shade = 'rgba(60,45,20,0.13)', blur = 36 } = {}) {
  ctx.save()
  ctx.shadowColor = shade
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = 12
  ctx.fillStyle = fill
  rrect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
}
function tick(ctx, cx, cy, r, color, ink) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = ink
  ctx.lineWidth = r * 0.22
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(cx - r * 0.42, cy + r * 0.02); ctx.lineTo(cx - r * 0.1, cy + r * 0.34); ctx.lineTo(cx + r * 0.44, cy - r * 0.3); ctx.stroke()
  ctx.lineCap = 'butt'
}
const picture = (ctx, e, cx, cy, z) => text(ctx, e, cx, cy + z * 0.36, { f: font(400, z, 'emoji'), color: '#000', align: 'center' })
/** The word as one row, its furigana over its kanji (the room kept while it is hidden). */
function wordLayout(ctx, it, max, maxW) {
  return layoutSentence(ctx, [{ t: it.t, k: 'word', fu: it.fu }], { max, min: FS.title, maxW, maxLines: 1, rules: false, script: it.fu ? 'furigana' : 'kanji', fam: 'serif', weight: 900, under: 0.04 })
}
const drawWordAt = (ctx, L, cx, y, ink, ruby, shown) => drawSentence(ctx, L, cx, y, 'center', () => ({ ink, rule: null, ruby: shown ? ruby : 'rgba(0,0,0,0)' }))
/** Its sentence, the word underlined, and what it says: measured at the
 *  first size that fits `room`, else the most compact (the card then
 *  takes a smaller word). */
function exampleOf(ctx, ex, maxW, sizes, room = Infinity) {
  let best = null
  for (const z of [...sizes, FS.caption]) {
    const L = layoutSentence(ctx, ex.rows, { max: z, min: z, maxW, maxLines: 2, script: 'furigana', rules: false, fam: 'jp', weight: 700, gap: 0 })
    // What it says, a size down where the room is short, never cut.
    const rest = room - L.h - SP[3]
    const tr = (lines, zs, maxH = Infinity) => fit(ctx, ex.tr, { weight: 500, sizes: zs, maxW, maxLines: lines, maxH, lh: 1.2, balanced: true })
    const tb = [tr(2, [FS.body, FS.sm, FS.caption], rest), tr(3, [FS.sm, FS.caption], rest), tr(3, [FS.sm, FS.caption])].find(b => !b.cut) || tr(4, [FS.caption])
    const E = { L, tb, h: L.h + SP[3] + paragraphH(tb, 1.2) }
    if (E.h <= room) return E
    if (!best || E.h < best.h) best = E
  }
  return best
}
function drawExample(ctx, E, ex, x, y, { ink, ruby, under, tr }) {
  drawSentence(ctx, E.L, x, y, 'left', u => ({ ink, ruby, rule: u.i === ex.at ? under : null, ruleW: 6 }))
  paragraph(ctx, E.tb, x, y + E.L.h + SP[3], tr, 'left', 1.2)
}
const cache = new Map()
const cached = (key, fn) => {
  if (!cache.has(key)) {
    if (cache.size > 400) cache.clear()
    cache.set(key, fn())
  }
  return cache.get(key)
}

// ── The pictures (plan 257) ──
// Loaded once, before the first frame (the studio, render.mjs): a frame
// is drawn synchronously, and a card whose picture has not come stays
// the card it was, so a test or a slow page draws nothing broken.
const PICTURES = new Map()
const fetchPicture = src => new Promise(done => {
  const img = new Image()
  img.onload = () => done(img)
  img.onerror = () => done(null)
  img.src = src
})
/** Loads the plan's pictures from `base` (the studio's page is beside
 *  them; render.mjs serves the front end from its root, '/carousel/'). */
export async function loadPictures(plan, base = '', load = typeof Image === 'undefined' ? null : fetchPicture) {
  if (!load) return 0
  const want = [...new Set(plan.items.map(it => it.pic).filter(src => src && !PICTURES.has(src)))]
  const got = await Promise.all(want.map(src => load(base + src)))
  want.forEach((src, i) => got[i] && PICTURES.set(src, got[i]))
  return plan.items.filter(it => PICTURES.has(it.pic)).length
}
const pictureOf = it => (it.pic && PICTURES.get(it.pic)) || null
/** The picture across a box: whole where its shape is the box's, else
 *  whole over itself blurred, so none of it is cut to fit. */
function drawPicture(ctx, img, x, y, w, h) {
  const cover = Math.max(w / img.width, h / img.height)
  const whole = Math.min(w / img.width, h / img.height)
  ctx.imageSmoothingQuality = 'high'
  if (whole / cover > 0.9) {
    ctx.drawImage(img, x + (w - img.width * cover) / 2, y + (h - img.height * cover) / 2, img.width * cover, img.height * cover)
    return
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.filter = 'blur(28px)'
  const k = cover * 1.15
  ctx.drawImage(img, x + (w - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k)
  ctx.filter = 'none'
  ctx.fillStyle = alpha(palette('paper').bg, 0.35)
  ctx.fillRect(x, y, w, h)
  ctx.restore()
  ctx.drawImage(img, x + (w - img.width * whole) / 2, y + (h - img.height * whole) / 2, img.width * whole, img.height * whole)
}

// ── A · the card ──
const BAND = G.top + 96
const STOPS = BAND + 64
/** A word's card, measured once: the largest word whose card, and its
 *  sentence or the hook under it, stand above the foot. */
function cardLayout(ctx, plan, it, first) {
  return cached(`card|${plan.lang}|${it.t}|${it.r}|${it.gloss}|${first}|${!!it.e}`, () => {
    const S = SAY[plan.lang] || SAY.en
    const inner = G.w - SP[6] * 2
    const top = STOPS + 56
    let last = null
    // The meaning at its largest first; where no word's size leaves the
    // sentence its room (a long one, read in French), a size down too.
    for (const most of [FS.heading, FS.lead]) for (const k of [1.1, 0.95, 0.82, 0.7, 0.6, 0.5]) {
      const L = wordLayout(ctx, it, FS.word * k, inner)
      // Two lines a size down before three: the card leaves its sentence the room.
      const mean = (lines, sizes) => fit(ctx, cardSense(it.gloss), { weight: 700, sizes: sizes.filter(z => z <= most), maxW: inner, maxLines: lines, lh: 1.2, balanced: true })
      const mb = [mean(2, [FS.heading, FS.title, FS.lead, FS.body, FS.sm]), mean(3, [FS.lead, FS.body, FS.sm])].find(b => !b.cut) || mean(5, [FS.sm, FS.caption])
      const picH = it.e ? FS.word * k * 0.8 + SP[4] : 0
      const askH = FS.sm * 1.2
      const revH = FS.lead * 1.1 + SP[5] + paragraphH(mb, 1.2)
      const h = SP[6] + picH + L.h + SP[4] + Math.max(askH, revH) + SP[6] + 10
      const below = top + h + SP[6]
      const room = G.bottom - below
      const hook = first ? fit(ctx, S.hook(plan.items.length), { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title], maxW: G.w, maxLines: 2, lh: 1.1 }) : null
      // The hint gives way to the hook where both cannot stand under a tall card.
      const full = fit(ctx, S.hint, { weight: 500, sizes: [FS.body, FS.sm], maxW: G.w, maxLines: 2, lh: 1.2 })
      const hookH = hook ? paragraphH(hook, 1.1) + SP[5] : 0
      const hint = !hook || hookH + paragraphH(full, 1.2) <= room ? full : null
      const askNeed = hookH + (hint ? paragraphH(hint, 1.2) : 0)
      const E = it.ex ? exampleOf(ctx, it.ex, G.w - 40, [FS.lead, FS.body, FS.sm], room - FS.caption - SP[4]) : null
      const exNeed = E ? FS.caption + SP[4] + E.h : 0
      last = { L, mb, picH, h, top, below, hook, hint, E }
      if (Math.max(askNeed, exNeed) <= room) return last
    }
    return last
  })
}
/** The card's back (plan 257), measured once: the picture as large as
 *  the room allows while its word is said (`open`), and smaller once its
 *  sentence comes (`shut`), the sentence a size down before the picture
 *  goes under half the card's width. */
function backLayout(ctx, plan, it, img) {
  return cached(`back|${plan.lang}|${it.t}|${it.r}|${it.gloss}|${img.width}x${img.height}`, () => {
    const top = STOPS + 56
    const cw = G.w + SP[2] * 2
    const inner = cw - SP[5] * 2
    const kanaOnly = it.r === it.t
    let row
    for (const z of [FS.word * 0.62, FS.word * 0.52, FS.word * 0.44, FS.heading]) {
      const wf = font(900, z, 'serif')
      const kf = font(700, FS.lead, 'jp')
      const rf = font(500, FS.lead, 'latin')
      const rw = Math.max(kanaOnly ? 0 : measure(ctx, it.r, kf), measure(ctx, it.ro, rf))
      row = { z, h: z * 1.15, wf, kf, rf, ww: measure(ctx, it.t, wf), kanaOnly }
      row.w = row.ww + SP[5] * 2 + 4 + rw
      if (row.w <= inner) break
    }
    const mean = fit(ctx, cardSense(it.gloss), { weight: 700, sizes: [FS.title, FS.lead, FS.body], maxW: inner, maxLines: 2, lh: 1.2, balanced: true })
    const textH = SP[5] + row.h + SP[4] + paragraphH(mean, 1.2) + SP[5] + 10
    const natural = cw * img.height / img.width
    const open = Math.min(natural, G.bottom - top - textH)
    let E = null
    let shut = open
    if (it.ex) {
      for (const sizes of [[FS.lead], [FS.body], [FS.sm]]) {
        E = exampleOf(ctx, it.ex, G.w - 40, sizes)
        shut = Math.min(natural, G.bottom - top - textH - SP[6] - FS.caption - SP[4] - E.h)
        if (shut * img.width / img.height >= cw * 0.45) break
      }
    }
    return { top, cw, row, mean, textH, open, shut, E }
  })
}
function drawBack(ctx, it, img, B, ph, p, line) {
  const x0 = G.x - SP[2]
  const h = B.textH + ph
  shadowCard(ctx, x0, B.top, B.cw, h, mix(p.bg, '#ffffff', 0.6))
  ctx.save()
  rrect(ctx, x0, B.top, B.cw, h, R.card * 2)
  ctx.clip()
  drawPicture(ctx, img, x0, B.top, B.cw, ph)
  ctx.restore()
  ctx.fillStyle = line
  ctx.fillRect(x0, B.top + h - 10, B.cw, 10)
  // The word, a rule, its reading over its romaji (the romaji alone where the word is kana).
  let y = B.top + ph + SP[5]
  const R0 = B.row
  let x = G.cx - R0.w / 2
  text(ctx, it.t, x, y + R0.z * 0.86, { f: R0.wf, color: p.ink })
  x += R0.ww + SP[5]
  ctx.fillStyle = alpha(p.ink, 0.18)
  ctx.fillRect(x, y + R0.h * 0.12, 4, R0.h * 0.76)
  x += 4 + SP[5]
  const mid = y + R0.h / 2
  if (R0.kanaOnly) text(ctx, it.ro, x, mid + FS.lead * 0.34, { f: R0.rf, color: p.ink2 })
  else {
    text(ctx, it.r, x, mid - FS.lead * 0.2, { f: R0.kf, color: p.ink2 })
    text(ctx, it.ro, x, mid + FS.lead * 0.95, { f: R0.rf, color: p.ink2 })
  }
  y += R0.h + SP[4]
  paragraph(ctx, B.mean, G.cx, y, p.ink, 'center', 1.2)
}
const FLIP = 0.4
function drawCard(ctx, plan, tl, sg, u) {
  const p = palette('paper')
  const S = SAY[plan.lang] || SAY.en
  const line = p.line.vocab
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, W, H)
  const it = plan.items[sg.i] || plan.items[plan.items.length - 1]
  const m = sg.marks
  // A word with a picture turns over at the reveal, its front kept until it is edge-on.
  const img = sg.type === 'word' ? pictureOf(it) : null
  const asking = sg.type === 'word' && u < m.reveal + (img ? FLIP / 2 : 0)
  // The band: the line's colour, the station, what it is, the timer.
  ctx.fillStyle = line
  ctx.fillRect(0, 0, W, BAND)
  let x = G.x
  x += text(ctx, plan.theme ? '主題' : '語彙', x, BAND - 32, { f: font(900, FS.display * 0.62, 'serif'), color: p.onLine }) + SP[5]
  const label = fit(ctx, plan.head.toUpperCase(), { weight: 700, sizes: [FS.caption, FS.xs], maxW: G.right - 120 - x, maxLines: 1, balanced: false })
  text(ctx, label.lines[0], x, BAND - 42, { f: label.f, color: p.onLine, tr: 0.16 })
  const rx = G.right - 46
  const ry = BAND - 58
  if (sg.type === 'word' && u < m.reveal) {
    const left = m.reveal - u
    ctx.lineWidth = 10
    ctx.strokeStyle = alpha(p.onLine, 0.25)
    ctx.beginPath(); ctx.arc(rx, ry, 40, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = p.onLine
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(rx, ry, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(left / m.reveal)); ctx.stroke()
    ctx.lineCap = 'butt'
    text(ctx, String(Math.ceil(left)), rx, ry + FS.lead * 0.36, { f: font(700, FS.lead, 'latin'), color: p.onLine, align: 'center' })
  } else tick(ctx, rx, ry, 40, p.onLine, line)
  // The stops: a word each, this one lit, the ones met filled.
  const of = plan.items.length
  ctx.strokeStyle = alpha(line, 0.35)
  ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(G.x + 20, STOPS); ctx.lineTo(G.right - 20, STOPS); ctx.stroke()
  for (let i = 0; i < of; i++) {
    const sx = G.x + 20 + ((G.w - 40) * i) / Math.max(1, of - 1)
    const now = sg.type === 'word' && i === sg.i
    ctx.fillStyle = i <= sg.i ? line : p.bg
    ctx.strokeStyle = line
    ctx.lineWidth = 5
    ctx.beginPath(); ctx.arc(sx, STOPS, now ? 16 + 4 * ease(u / 0.3) : 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // The card: the picture (a theme's), the word, its reading, what it means.
  const Ly = cardLayout(ctx, plan, it, sg.i === 0)
  ctx.globalAlpha = sg.i === 0 ? 1 : ease(u / 0.3)
  // Turned over: squeezed edge-on, then opened on its back.
  const f = img ? clamp((u - m.reveal) / FLIP) : 1
  const sx = f >= 1 || u < m.reveal ? 1 : f < 0.5 ? 1 - ease(f * 2) : ease((f - 0.5) * 2)
  ctx.save()
  if (sx < 1) { ctx.translate(G.cx, 0); ctx.scale(Math.max(0.001, sx), 1); ctx.translate(-G.cx, 0) }
  const B = img && !asking ? backLayout(ctx, plan, it, img) : null
  // The picture gives its sentence room as the sentence comes.
  const ph = B ? B.open + (B.shut - B.open) * (B.E && m.ex != null ? ease((u - m.ex + 0.5) / 0.45) : 0) : 0
  if (B) drawBack(ctx, it, img, B, ph, p, line)
  else {
    shadowCard(ctx, G.x - SP[2], Ly.top, G.w + SP[2] * 2, Ly.h, mix(p.bg, '#ffffff', 0.6))
    ctx.fillStyle = line
    ctx.fillRect(G.x - SP[2], Ly.top + Ly.h - 10, G.w + SP[2] * 2, 10)
    let y = Ly.top + SP[6]
    if (it.e) { picture(ctx, it.e, G.cx, y + Ly.picH / 2 - SP[2], Ly.picH * 0.78); y += Ly.picH }
    drawWordAt(ctx, Ly.L, G.cx, y, p.ink, p.ink2, !asking)
    y += Ly.L.h + SP[4]
    if (asking) caps(ctx, S.read, G.cx, y + FS.sm * 0.8, p.gold, { z: FS.sm, align: 'center' })
    else {
      ctx.globalAlpha = ease((u - m.reveal) / 0.3)
      text(ctx, it.ro, G.cx, y + FS.lead * 0.8, { f: font(500, FS.lead, 'latin'), color: p.ink2, align: 'center' })
      paragraph(ctx, Ly.mb, G.cx, y + FS.lead * 1.1 + SP[5], p.ink, 'center', 1.2)
    }
  }
  ctx.restore()
  ctx.globalAlpha = 1
  const below = B ? B.top + B.textH + ph + SP[6] : Ly.below
  const E = B ? B.E : Ly.E
  // Under the card: the hook and the hint while it is asked; its sentence once said.
  if (asking) {
    let hy = Ly.below
    if (Ly.hook) { paragraph(ctx, Ly.hook, G.cx, hy, p.ink, 'center', 1.1); hy += paragraphH(Ly.hook, 1.1) + SP[5] }
    if (Ly.hint) paragraph(ctx, Ly.hint, G.cx, hy, p.ink2, 'center', 1.2)
  } else if (it.ex && E && m.ex != null && u >= m.ex) {
    ctx.globalAlpha = ease((u - m.ex) / 0.35)
    caps(ctx, S.inSentence, G.x, below + FS.caption * 0.8, p.gold)
    const ey = below + FS.caption + SP[4]
    ctx.fillStyle = line
    ctx.fillRect(G.x, ey, 8, E.h)
    drawExample(ctx, E, it.ex, G.x + 40, ey, { ink: p.ink, ruby: p.ink2, under: line, tr: p.ink2 })
    ctx.globalAlpha = 1
  }
}

// ── C · the quiz ──
const QTOP = G.top + 140
const PILL_GAP = SP[3]
/** A word's quiz, measured once: the largest word whose four meanings
 *  stand above the foot, and whose sentence does under the right one. */
function quizLayout(ctx, plan, it) {
  return cached(`quiz|${plan.lang}|${it.t}|${it.r}|${it.choices.join('|')}|${!!it.e}`, () => {
    let last = null
    for (const k of [1, 0.88, 0.76, 0.64, 0.54]) {
      const z = FS.word * k
      const picH = it.e ? z * 0.7 + SP[3] : 0
      const L = wordLayout(ctx, it, z, G.w - SP[6])
      const askTop = QTOP + picH + L.h + SP[3] + FS.lead + SP[6]
      const pillsTop = askTop + FS.sm + SP[5]
      const ph = Math.min(124, Math.max(96, (G.bottom - pillsTop - 3 * PILL_GAP) / 4))
      const room = G.bottom - (pillsTop + ph + SP[4]) - SP[5] * 2 - FS.caption - SP[4]
      const E = it.ex ? exampleOf(ctx, it.ex, G.w - SP[5] * 2, [FS.lead, FS.body, FS.sm], room) : null
      const exH = E ? SP[5] + FS.caption + SP[4] + E.h + SP[5] : 0
      last = { z, picH, L, askTop, pillsTop, ph, E, exH }
      const fits4 = pillsTop + 4 * ph + 3 * PILL_GAP <= G.bottom
      const fitsEx = !E || pillsTop + ph + SP[4] + exH <= G.bottom
      if (fits4 && fitsEx) return last
    }
    return last
  })
}
function choiceBlock(ctx, str, maxW) {
  const one = fit(ctx, str, { weight: 700, sizes: [FS.lead, FS.body, FS.sm], maxW, maxLines: 1, lh: 1.15, balanced: false })
  return one.cut ? fit(ctx, str, { weight: 700, sizes: [FS.body, FS.sm, FS.caption], maxW, maxLines: 2, lh: 1.15, balanced: true }) : one
}
function drawQuiz(ctx, plan, tl, sg, u) {
  const p = palette('sumi')
  const S = SAY[plan.lang] || SAY.en
  const ok = OK.sumi
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, W, H)
  const of = plan.items.length
  // The head: what it is, and a pip for each word, the ones met green.
  const pw = 22
  const pg = 6
  const pipsW = of * (pw + pg) - pg
  // A theme's name says what the quiz is on its own ("Parties du corps").
  const head = fit(ctx, (plan.theme || S.quizHead(`JLPT ${plan.level}`)).toUpperCase(), { weight: 700, sizes: [FS.caption, FS.xs], maxW: G.w - pipsW - SP[5], maxLines: 1, balanced: false })
  text(ctx, head.lines[0], G.x, G.top + 40, { f: head.f, color: p.gold, tr: 0.18 })
  for (let i = 0; i < of; i++) {
    // At the score every pip is the viewer's to count: gold, none marked right.
    ctx.fillStyle = sg.type !== 'word' ? p.gold : i < sg.i ? ok : i === sg.i ? p.gold : alpha(p.ink, 0.18)
    rrect(ctx, G.right - pipsW + i * (pw + pg), G.top + 16, pw, 26, 7); ctx.fill()
  }
  if (sg.type === 'score') return drawScore(ctx, plan, p, S, u)
  const it = plan.items[sg.i]
  const m = sg.marks
  const asking = u < m.reveal
  // The fuse: full until the meanings are up, burnt out at the answer.
  ctx.fillStyle = alpha(p.ink, 0.12)
  rrect(ctx, G.x, G.top + 76, G.w, 14, 7); ctx.fill()
  const left = asking ? clamp(1 - (u - m.show) / (m.reveal - m.show)) : 0
  if (left > 0) { ctx.fillStyle = p.gold; rrect(ctx, G.x, G.top + 76, G.w * left, 14, 7); ctx.fill() }
  const Ly = quizLayout(ctx, plan, it)
  ctx.globalAlpha = sg.i === 0 ? 1 : ease(u / 0.3)
  let y = QTOP
  if (it.e) { picture(ctx, it.e, G.cx, y + Ly.picH / 2 - SP[2], Ly.picH * 0.8); y += Ly.picH }
  drawWordAt(ctx, Ly.L, G.cx, y, p.ink, p.gold, !asking)
  y += Ly.L.h + SP[3]
  if (!asking) {
    ctx.globalAlpha = ease((u - m.reveal) / 0.3)
    text(ctx, it.ro, G.cx, y + FS.lead * 0.8, { f: font(500, FS.lead, 'latin'), color: p.ink2, align: 'center' })
  }
  ctx.globalAlpha = 1
  caps(ctx, asking ? S.ask : S.means, G.cx, Ly.askTop + FS.sm * 0.8, p.gold, { z: FS.sm, align: 'center' })
  // The meanings: up together; at the answer the wrong ones go and the right one rises to the first place.
  const shown = ease((u - m.show) / 0.3)
  const gone = asking ? 0 : ease((u - m.reveal) / 0.3)
  const rise = asking ? 0 : ease((u - m.reveal - 0.3) / 0.4)
  it.choices.forEach((c, k) => {
    const right = k === it.right
    let alphaK = shown
    if (!right) alphaK *= 1 - gone
    if (alphaK <= 0.01) return
    const slot = Ly.pillsTop + k * (Ly.ph + PILL_GAP)
    const py = right ? slot + (Ly.pillsTop - slot) * rise : slot
    const lit = right && !asking
    ctx.globalAlpha = alphaK
    ctx.fillStyle = lit ? alpha(ok, 0.22) : mix(p.ink, p.bg, 0.07)
    rrect(ctx, G.x, py, G.w, Ly.ph, R.card * 1.6); ctx.fill()
    ctx.strokeStyle = lit ? ok : alpha(p.ink, 0.16)
    ctx.lineWidth = lit ? 5 : 2
    rrect(ctx, G.x + 1, py + 1, G.w - 2, Ly.ph - 2, R.card * 1.6); ctx.stroke()
    const cx = G.x + SP[5] + 30
    const cy = py + Ly.ph / 2
    if (lit) tick(ctx, cx, cy, 30, ok, p.bg)
    else {
      ctx.strokeStyle = p.gold
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.stroke()
      text(ctx, 'ABCD'[k], cx, cy + FS.body * 0.34, { f: font(700, FS.body, 'latin'), color: p.gold, align: 'center' })
    }
    const b = choiceBlock(ctx, c, G.w - SP[5] * 2 - 80)
    paragraph(ctx, b, cx + 30 + SP[5], cy - paragraphH(b, 1.15) / 2, p.ink, 'left', 1.15)
  })
  ctx.globalAlpha = 1
  // Its sentence, under the right meaning, once the word is said.
  if (it.ex && Ly.E && m.ex != null && u >= m.ex) {
    ctx.globalAlpha = ease((u - m.ex) / 0.35)
    const ey = Ly.pillsTop + Ly.ph + SP[4]
    shadowCard(ctx, G.x, ey, G.w, Ly.exH, p.card, { shade: 'rgba(0,0,0,0.3)', blur: 24 })
    caps(ctx, S.inSentence, G.x + SP[5], ey + SP[5] + FS.caption * 0.8, p.gold)
    drawExample(ctx, Ly.E, it.ex, G.x + SP[5], ey + SP[5] + FS.caption + SP[4], { ink: p.ink, ruby: p.ink2, under: p.gold, tr: p.ink2 })
    ctx.globalAlpha = 1
  }
}
function drawScore(ctx, plan, p, S, u) {
  const of = plan.items.length
  const q = fit(ctx, S.score, { weight: 900, fam: 'serif', sizes: [FS.display * 0.8, FS.heading], maxW: G.w, maxLines: 2, lh: 1.08 })
  const c = fit(ctx, S.comments, { weight: 700, sizes: [FS.lead, FS.body], maxW: G.w, maxLines: 2, lh: 1.2 })
  const big = FS.glyph
  const h = paragraphH(q, 1.08) + SP[7] + big + SP[7] + paragraphH(c, 1.2)
  let y = (G.top + 120 + G.bottom) / 2 - h / 2
  ctx.globalAlpha = ease(u / 0.4)
  paragraph(ctx, q, G.cx, y, p.ink, 'center', 1.08)
  y += paragraphH(q, 1.08) + SP[7]
  const mark = '? '
  const w1 = measure(ctx, mark, font(900, big, 'latin'))
  const w2 = measure(ctx, `/ ${of}`, font(700, big * 0.6, 'latin'))
  const x0 = G.cx - (w1 + w2) / 2
  text(ctx, mark, x0, y + big * 0.8, { f: font(900, big, 'latin'), color: p.gold })
  text(ctx, `/ ${of}`, x0 + w1, y + big * 0.8, { f: font(700, big * 0.6, 'latin'), color: p.ink2 })
  y += big + SP[7]
  paragraph(ctx, c, G.cx, y, p.ink2, 'center', 1.2)
  ctx.globalAlpha = 1
}
