// ── 辻 — the landing page, rendered to static HTML (plan 167) ──
// One function per section, each returning markup; `renderPage` puts
// them together with the head, the inlined stylesheet and the data the
// client script (public/landing/landing.js) reads. The page is whole
// without that script: every word, figure and card is in the HTML, and
// the script only turns the demos and the footage on.
import { readFileSync } from 'node:fs'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'
import { DARK, LIGHT, SCALE, FONTS, block } from './tokens.mjs'
import {
  SITE_ORIGIN, PAGES, DEFAULT_LANG, APP_ENTRY, BOARD_ENTRY, STORES, CONTACT,
  PRESENTATION, CLIPS, RHYTHMS, DEFAULT_RHYTHM, sessionKey,
} from './config.mjs'
import { LEVELS, EXAM_N5, arrivals, spanOf, kanjiStrokes } from './content.mjs'
import { STRINGS, CARDS, TOKENS, EXAM_OPTIONS } from './strings.mjs'

// ── Text ──

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c])

/** The typography both languages share (the curly apostrophe) and the
 *  one French adds: a no-break space before : ; ? ! and inside « ». */
export function typo(lang, s) {
  let out = String(s).replace(/(\p{L})'(\p{L})/gu, '$1’$2')
  if (lang === 'fr') out = out.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ')
  return out
}

// ── Pieces ──

const pigment = line => `var(--line-${line === 'today' ? 'jisho' : line})`

function mark(size, cls = '') {
  return `<svg class="mark ${cls}" width="${size}" height="${size}" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">`
    + `<path class="mark__road" d="${MARK_ROAD}"/><path d="${MARK_INK}" fill="currentColor"/></svg>`
}

const PLAY = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 4.5v15l13-7.5z"/></svg>'

const APPLE = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>'

const PLAY_STORE = '<svg width="22" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.6 2.2 13.4 12 3.6 21.8c-.4-.2-.6-.6-.6-1.1V3.3c0-.5.2-.9.6-1.1z" fill="#00d2ff"/><path d="m16.8 8.6-3.4 3.4-9.8-9.8c.3-.2.8-.2 1.2 0z" fill="#00f076"/><path d="m16.8 15.4-12 6.4c-.4.2-.9.2-1.2 0l9.8-9.8z" fill="#ff3a44"/><path d="m20.3 10.5c.9.5.9 1.8 0 2.4l-3.5 2.5-3.4-3.4 3.4-3.4z" fill="#ffd400"/></svg>'

/** A store badge: a link once the listing exists, "coming soon" and no
 *  link before it (config.mjs's STORES). */
function badge(t, store) {
  const url = STORES[store]
  const icon = store === 'appStore' ? APPLE : PLAY_STORE
  const [top, name] = t.badges[store]
  const small = url ? top : t.badges.soon[store]
  const inner = `${icon}<span><span class="badge__s">${esc(typo(t.lang, small))}</span><span class="badge__b">${esc(typo(t.lang, name))}</span></span>`
  return url
    ? `<a class="badge" href="${esc(url)}" rel="noopener" data-store="${store}">${inner}</a>`
    : `<span class="badge badge--soon" role="img" aria-label="${esc(typo(t.lang, `${small} ${name}`))}">${inner}</span>`
}

const badges = t => `<div class="badges">${badge(t, 'appStore')}${badge(t, 'googlePlay')}</div>`

function gate(t, cls = '') {
  return `<a class="gate ${cls}" href="${BOARD_ENTRY}" data-board aria-label="${esc(typo(t.lang, t.boardAria))}">`
    + '<span class="gate__reader" aria-hidden="true"><i class="gate__rip"></i><i class="gate__rip"></i><span class="wave"><i></i><i></i><i></i></span></span>'
    + `<span class="gate__word">${esc(t.board)}</span></a>`
}

const ring = (glyph, line, cls = '') =>
  `<span class="ring ${cls}" style="--c:${pigment(line)}" lang="ja">${esc(glyph)}</span>`

function head2(t, h2, body, id, extra = '') {
  return `<div class="head2" data-stagger><div><h2 class="h2" id="${id}-h">${esc(typo(t.lang, h2))}</h2></div>`
    + `<div class="head2__end"><p class="body">${esc(typo(t.lang, body))}</p>${extra}</div></div>`
}

// ── The stops ──
// The page is the gold line the hero's road starts: every section is a
// stop on it. Its sign stands where a hairline stood -- the stop's
// number in a ring, its name, the rail laid across as the section
// arrives with a train running it once, and the next stop, a door on.
// The sign of the section being read is lit (landing.js). The way in
// at the page's foot is the terminus, 終.
const STOPS = ['presentation', 'lines', 'line', 'method', 'features', 'jlpt', 'tools', 'fare', 'faq', 'way']
const stopName = (t, key) => (key === 'way' ? t.terminus : t[key].kicker)
// The sound switch's two faces: the speaker with its waves, and struck.
const SPEAKER = '<svg class="top__sound-on" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  + '<svg class="top__sound-off" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

const ONWARD = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function stop(t, key) {
  const k = STOPS.indexOf(key)
  const next = STOPS[k + 1]
  const mark = key === 'presentation' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 4.5v15l13-7.5z"/></svg>'
    : key === 'way' ? '<span lang="ja">終</span>' : String(k).padStart(2, '0')
  const to = next ? stopName(t, next) : ''
  return `<div class="wrap"><div class="stop${next ? '' : ' stop--end'}" data-reveal data-stop="${t.ids[key]}">`
    + `<span class="stop__ring fig" aria-hidden="true">${mark}</span>`
    + `<span class="stop__name">${esc(typo(t.lang, stopName(t, key)))}</span>`
    + '<span class="stop__rail" aria-hidden="true"><i></i><b></b></span>'
    + (next ? `<a class="stop__next" href="#${t.ids[next]}" aria-label="${esc(typo(t.lang, t.nextTo(to)))}"><span class="stop__word">${esc(t.next)}</span><span class="stop__to">${esc(typo(t.lang, to))}</span>${ONWARD}</a>` : '')
    + '</div></div>'
}

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const isoDuration = s => `PT${Math.floor(s / 60) ? `${Math.floor(s / 60)}M` : ''}${s % 60 ? `${s % 60}S` : ''}`

// ── The crossroads (the hero's map, from 1100px) ──
// The hub at (276, 300) in a 660 × 600 box, seven lines out of it at a
// radius of 200, the gold road coming in from the left edge: the road
// the gate row draws from Embarquer runs on into it.
const ROADS = [
  { line: 'kana', glyph: 'あ', x: 276, y: 100, at: 'top' },
  { line: 'vocab', glyph: '語', x: 417, y: 159, at: 'right' },
  { line: 'kanji', glyph: '漢', x: 476, y: 300, at: 'right' },
  { line: 'grammar', glyph: '文', x: 417, y: 441, at: 'right' },
  { line: 'reading', glyph: '読', x: 276, y: 500, at: 'bottom' },
  { line: 'honyaku', glyph: '訳', x: 135, y: 441, at: 'left' },
  { line: 'kakitori', glyph: '書', x: 135, y: 159, at: 'left' },
]

function crossroads(t) {
  // Each road is drawn out of the hub (pathLength 1, its dash offset run
  // down by the stylesheet), then its station lands, then a light runs
  // along it now and again: a train leaving the crossroads.
  const lines = ROADS.map((r, k) => `<line class="map__line" pathLength="1" x1="276" y1="300" x2="${r.x}" y2="${r.y}" style="--c:${pigment(r.line)};--k:${k}"/>`).join('')
  const trains = ROADS.map((r, k) => `<line class="map__train" pathLength="100" x1="276" y1="300" x2="${r.x}" y2="${r.y}" style="--c:${pigment(r.line)};--k:${k}"/>`).join('')
  const stations = ROADS.map(r => {
    const name = esc(typo(t.lang, t.hero.stations[r.line]))
    const label = {
      top: `<text class="map__name" x="${r.x}" y="${r.y - 40}" text-anchor="middle">${name}</text>`,
      bottom: `<text class="map__name" x="${r.x}" y="${r.y + 54}" text-anchor="middle">${name}</text>`,
      right: `<text class="map__name" x="${r.x + 40}" y="${r.y + 5}">${name}</text>`,
      left: `<text class="map__name" x="${r.x - 40}" y="${r.y + 5}" text-anchor="end">${name}</text>`,
    }[r.at]
    return `<g class="map__stn" style="--c:${pigment(r.line)};--k:${ROADS.indexOf(r)}"><circle class="map__ring" cx="${r.x}" cy="${r.y}" r="26"/>`
      + `<text class="map__glyph" x="${r.x}" y="${r.y + 7}" text-anchor="middle" lang="ja">${r.glyph}</text>${label}</g>`
  }).join('')
  return '<svg class="map__art" viewBox="0 0 660 600" aria-hidden="true" focusable="false">'
    + '<line class="map__road" pathLength="1" x1="0" y1="300" x2="276" y2="300"/>'
    + '<line class="map__train map__train--road" pathLength="100" x1="0" y1="300" x2="276" y2="300"/>'
    + `<g class="map__lines">${lines}${trains}</g>`
    + '<g class="map__hubs"><circle class="map__hub" cx="276" cy="300" r="66"/>'
    + `<svg x="234" y="258" width="84" height="84" viewBox="0 0 1000 1000"><path class="mark__road" d="${MARK_ROAD}"/><path class="map__ink" d="${MARK_INK}"/></svg></g>`
    + `${stations}</svg>`
}

// ── Sections ──

function header(t, other) {
  const nav = t.nav.map(([key, label]) => `<a href="#${t.ids[key]}" data-spy="${t.ids[key]}">${esc(typo(t.lang, label))}</a>`).join('')
  const langs = ['fr', 'en'].map(code => code === t.lang
    ? `<a aria-current="page" lang="${code}">${code.toUpperCase()}</a>`
    : `<a href="${PAGES[code].path}" hreflang="${code}" lang="${code}">${code.toUpperCase()}</a>`).join('')
  return `<header class="top" data-top><span class="top__rail" aria-hidden="true"></span><div class="wrap top__in">`
    + `<a class="brand" href="${PAGES[t.lang].path}" aria-label="${esc(t.home)}">${mark(32)}<span class="brand__name">Tsuji</span></a>`
    + `<nav class="nav" aria-label="${esc(t.navLabel)}">${nav}</nav>`
    // The demos' sounds: drawn by the script alone, which alone plays them.
    + `<div class="top__end"><button type="button" class="top__sound" data-sound aria-pressed="true" aria-label="${esc(t.sound)}" title="${esc(t.sound)}" hidden>${SPEAKER}</button>`
    + `<nav class="seg langs" aria-label="${esc(t.langLabel)}">${langs}</nav>`
    + `<a class="top__other" href="${PAGES[other].path}" hreflang="${other}" lang="${other}">${other.toUpperCase()}</a>`
    + `<a class="ghost top__signin" href="${APP_ENTRY}" data-board>${esc(t.signIn)}</a>`
    // The way in, kept in reach once the hero's gate has scrolled away.
    + `<a class="top__board" href="${BOARD_ENTRY}" data-board data-top-board tabindex="-1" aria-hidden="true">${esc(t.board)}</a></div>`
    + '</div></header>'
}

function hero(t, live) {
  const h = t.hero
  const [front, back] = [h.rolls.slice(0, 5), h.rolls.slice(5)]
  const LINES = ['kana', 'vocab', 'kanji', 'grammar', 'kana', 'reading', 'honyaku', 'kakitori', 'kaiseki', 'exam']
  const roll = (cards, offset, cls) => `<div class="roll ${cls}">${cards.map(([g, name], k) =>
    `<div class="demo" style="--c:${pigment(LINES[k + offset])}"><span class="demo__g${g === '駅' ? ' serif' : ''}" lang="ja">${esc(g)}</span><span class="demo__t">${esc(typo(t.lang, name))}</span></div>`).join('')}</div>`
  return `<section class="hero" id="top"><div class="wrap hero__in">`
    + `${mark(56, 'hero__mark')}`
    + `<p class="cap hero__kicker">${esc(typo(t.lang, h.kicker))}</p>`
    + `<h1 class="h1">${esc(typo(t.lang, h.h1))}</h1>`
    + `<p class="lead hero__lead">${esc(typo(t.lang, h.lead))}</p>`
    + `<div class="rolls" aria-hidden="true">${roll(front, 0, '')}${roll(back, 5, 'roll--back')}</div>`
    + `<p class="hero__tagline">${esc(typo(t.lang, h.tagline))}</p>`
    + `<div class="hero__gate">${gate(t)}<span class="road" aria-hidden="true"></span><div class="map">${crossroads(t)}</div></div>`
    + badges(t)
    + `<a class="watch" href="#${t.ids.presentation}" data-watch${live ? '' : ' hidden'}><span class="watch__play" aria-hidden="true">${PLAY}</span>${esc(typo(t.lang, h.watch))} · ${clock(PRESENTATION.seconds)}</a>`
    + `<p class="hero__note">${esc(typo(t.lang, h.note(STORES.appStore || STORES.googlePlay)))}</p>`
    + `<a class="hero__cue" href="#${t.ids.lines}"><span>${esc(h.cue)}</span><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v13M6 12l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`
    + '</div></section>'
}

function figures(t) {
  // A figure that is a number counts up to itself as it comes into view.
  const count = value => {
    const n = Number(String(value).replace(/[^\d]/g, ''))
    return /^[\d\s,.\u202f\u00a0]+$/.test(value) && n > 9 ? ` data-count="${n}"` : ''
  }
  const cells = t.figures.map(([value, label], k) =>
    `<div class="figure${k > 2 ? ' figure--wide' : ''}"><span class="fig figure__n"${count(value)}>${esc(value)}</span><span class="capxs">${esc(typo(t.lang, label))}</span></div>`).join('')
  return `<section class="figures" aria-label="${esc(t.figuresLabel)}"><div class="wrap"><div class="lattice figures__grid" data-reveal>${cells}</div></div></section>`
}

function presentation(t, media, live) {
  const p = t.presentation
  const art = ROADS.map(r => {
    const x = 620 + (r.x - 276) * 0.85
    const y = 320 + (r.y - 300) * 0.85
    return `<line x1="620" y1="320" x2="${x}" y2="${y}" style="stroke:${pigment(r.line)}"/><circle cx="${x}" cy="${y}" r="20" style="stroke:${pigment(r.line)}"/>`
  }).join('')
  const chapters = p.chapters.map((name, k) =>
    `<li><button type="button" data-seek="${PRESENTATION.chapters[k]}"><i></i>${esc(typo(t.lang, name))}</button></li>`).join('')
  return `<section class="sec" id="${t.ids.presentation}" aria-labelledby="${t.ids.presentation}-h" data-presentation${live ? '' : ' hidden'}>${stop(t, 'presentation')}<div class="wrap">`
    + head2(t, p.h2, p.body, t.ids.presentation)
    + `<div class="player" data-reveal data-src="${esc(media)}/${PRESENTATION.file}" data-lang="${t.lang}">`
    + `<svg class="player__art" viewBox="0 0 1240 698" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><line x1="300" y1="320" x2="620" y2="320" class="player__road"/>${art}</svg>`
    + `<button type="button" class="play" data-play aria-label="${esc(typo(t.lang, `${p.play}, ${clock(PRESENTATION.seconds)}`))}">${PLAY}</button>`
    + `<div class="player__bar"><ol class="chapters" aria-label="${esc(p.chaptersLabel)}">${chapters}</ol>`
    + `<span class="player__meta"><span class="cc" title="${esc(p.captions)}">CC · FR · EN</span><span class="fig">${clock(PRESENTATION.seconds)}</span></span></div>`
    + '</div></div></section>'
}

function lines(t) {
  const L = t.lines
  const P = L.plates
  const chips = list => list.map(c => `<span class="chip">${esc(typo(t.lang, c))}</span>`).join('')
  const stops = `<span class="stops" role="img" aria-label="${esc(typo(t.lang, P.vocab.stops))}" style="--c:${pigment('vocab')}">${LEVELS.map((_, k) => `${k ? '<b></b>' : ''}<i${k ? '' : ' class="on"'}></i>`).join('')}</span>`
  const plate = (line, glyph, p, spec, foot) => `<article class="plate" style="--c:${pigment(line)}">`
    + `<div class="plate__head">${ring(glyph, line, 'plate__ring')}<div><p class="plate__reading" lang="ja">${p.reading}</p><h3 class="h3">${esc(typo(t.lang, p.h3))}</h3></div></div>`
    + `<p class="body plate__body">${esc(typo(t.lang, p.body))}</p>`
    + `<div class="plate__foot">${foot}</div>`
    + `<div class="specimen plate__spec">${spec}</div></article>`
  const stage = (key, word) => `<span class="stage st-${key}">${esc(word)}</span>`
  const k = t.method.stages
  return `<section class="sec" id="${t.ids.lines}" aria-labelledby="${t.ids.lines}-h">${stop(t, 'lines')}<div class="wrap">`
    + head2(t, L.h2, L.body, t.ids.lines)
    + '<div class="plates" data-stagger>'
    + plate('kana', 'あ', P.kana, `${stage('learning', k.learning)}<span class="spec__glyph" lang="ja">あ</span><span class="spec__gloss">${esc(P.kana.gloss)}</span>`, chips(P.kana.chips))
    + plate('vocab', '語', P.vocab, `${stage('new', k.new)}<span class="spec__reading" lang="ja">でんしゃ</span><span class="spec__word" lang="ja">電車</span><span class="spec__gloss">${esc(P.vocab.gloss)}</span>`, stops)
    + plate('kanji', '漢', P.kanji, `${stage('mastered', k.mastered)}<span class="spec__word spec__word--kanji serif" lang="ja">駅</span><span class="spec__reading spec__reading--flat" lang="ja">${esc(typo(t.lang, P.kanji.strokes))}</span><span class="spec__gloss">${esc(P.kanji.gloss)}</span>`, chips(P.kanji.chips))
    + plate('grammar', '文', P.grammar, `<span class="spec__pattern" lang="ja">〜ている</span><span class="spec__sentence" lang="ja">雨が降っている。</span><span class="spec__trans">${esc(typo(t.lang, P.grammar.gloss))}</span>`, chips(P.grammar.chips))
    + '</div></div></section>'
}

function line(t, facts) {
  const L = t.line
  const rhythms = RHYTHMS.map(m => `<button type="button" data-per="${m}" aria-pressed="${m === DEFAULT_RHYTHM}"${m === DEFAULT_RHYTHM ? ' class="on"' : ''}>${esc(L.rhythm(m))}</button>`).join('')
  const etas = Object.fromEntries(RHYTHMS.map(m => [m, arrivals(facts, m).map(a => typo(t.lang, L.span(spanOf(a.days))))]))
  const rows = LEVELS.map((level, k) => {
    const data = RHYTHMS.map(m => ` data-per-${m}="${esc(etas[m][k])}"`).join('')
    const l = facts.levels[level]
    return `<li class="lrow"><span class="lrow__stop${k === LEVELS.length - 1 ? ' lrow__stop--end' : ''}"></span><span class="fig lrow__code">${level}</span>`
      + `<span class="lrow__counts"><span class="lrow__long">${esc(L.counts(l))}</span><span class="lrow__short">${esc(L.countsShort(l))}</span></span>`
      + `<span class="fig lrow__eta" data-eta${data}>${esc(etas[DEFAULT_RHYTHM][k])}</span></li>`
  }).join('')
  return `<section class="sec sec--band" id="${t.ids.line}" aria-labelledby="${t.ids.line}-h">${stop(t, 'line')}<div class="wrap split">`
    + `<div class="split__copy" data-stagger><h2 class="h2" id="${t.ids.line}-h">${esc(typo(t.lang, L.h2))}</h2>`
    + `<p class="body">${esc(typo(t.lang, L.body))}</p>`
    + `<div class="seg" role="group" aria-label="${esc(L.rhythmsLabel)}" data-rhythms data-nudge>${rhythms}</div>`
    + `<p class="body body--small">${esc(typo(t.lang, L.note))}</p></div>`
    + `<div class="plate plate--line" style="--c:var(--accent2)" data-reveal><div class="line__head"><h3 class="h3">${esc(L.plate)}</h3><span class="capxs" data-at>${esc(L.at(DEFAULT_RHYTHM))}</span></div>`
    + `<ol class="lrows"><li class="lrow"><span class="lrow__stop lrow__stop--here"></span><span class="lrow__code lrow__kana" lang="ja">かな</span>`
    + `<span class="lrow__counts lrow__counts--here">${esc(L.kana)} · <b>${esc(typo(t.lang, L.here))}</b></span><span class="capxs">${esc(L.start)}</span></li>${rows}</ol></div>`
    + '</div></section>'
}

function method(t) {
  const M = t.method
  const card = CARDS[0]
  const shares = [['kana', 19], ['vocab', 43], ['kanji', 24], ['grammar', 14]]
  const rotations = [-6, 4, -3, 0, 7, -5, 2]
  const stamps = [...M.stamps].map((d, k) => k === 3
    ? `<span class="stamp stamp--miss" lang="ja">${d}</span>`
    : `<span class="stamp" style="--turn:${rotations[k]}deg" lang="ja">${d}</span>`).join('')
  const ratings = M.ratings.map((word, k) =>
    `<button type="button" class="q${k + 1}" data-rate="${k}" disabled><span class="rbar__dot"></span><span class="rbar__w">${esc(word)}</span><span class="rbar__t">${esc(M.due(card.due[k]))}</span></button>`).join('')
  return `<section class="sec" id="${t.ids.method}" aria-labelledby="${t.ids.method}-h">${stop(t, 'method')}<div class="wrap split">`
    + `<div class="split__copy" data-stagger><h2 class="h2" id="${t.ids.method}-h">${esc(typo(t.lang, M.h2))}</h2>`
    + `<p class="body">${esc(typo(t.lang, M.body))}</p>`
    + `<div class="card day"><div class="day__top"><span class="day__count"><span class="fig">${M.day.count}</span> ${esc(typo(t.lang, M.day.unit))}</span>`
    + `<span class="seg seg--still" role="img" aria-label="${esc(M.day.lengthLabel)} : 50">${M.day.lengths.map(v => `<span${v === '50' ? ' class="on"' : ''}>${esc(v)}</span>`).join('')}</span></div>`
    + `<div class="day__bars" role="img" aria-label="${esc(M.day.sharesLabel)}">${shares.map(([l, w]) => `<span class="bar" style="--c:${pigment(l)};flex-grow:${w}"></span>`).join('')}</div></div>`
    + `<div class="stamps"><div class="stamps__row" data-reveal role="img" aria-label="${esc(typo(t.lang, M.stampsLabel))}">${stamps}</div><span class="body body--small">${esc(typo(t.lang, M.stampsNote))}</span></div>`
    + `<p class="body body--small">${esc(typo(t.lang, M.reminder))}</p></div>`
    + `<div class="stagebox" data-trial data-reveal role="group" aria-label="${esc(typo(t.lang, M.trial))}">`
    + `<div class="stagebox__top"><span class="capxs" data-trial-pos>${esc(M.trialPos(1, CARDS.length))}</span><span class="capxs" data-trial-kind>${esc(M.kinds[card.kind])}</span></div>`
    // Both faces are in the page and the card turns between them: the
    // back is hidden from a screen reader until it faces the learner.
    + `<div class="flip" data-card tabindex="-1"><div class="flip__inner">`
    + `<button type="button" class="qcard qcard--front" data-flip data-nudge aria-label="${esc(M.flipAria)}">`
    + `<span class="qcard__stage st-${card.stage}" data-face="stage">${esc(M.stages[card.stage])}</span>`
    + `<span class="qcard__glyph${card.serif ? ' serif' : ''}" lang="ja" data-face="glyph">${esc(card.glyph)}</span>`
    + `<span class="qcard__hint">${esc(M.flip)}</span><span class="qcard__band"><i data-face="band" style="width:${card.progress * 100}%"></i></span></button>`
    + '<div class="qcard qcard--back" aria-hidden="true">'
    + `<span class="qcard__stage st-${card.stage}" data-face="stage">${esc(M.stages[card.stage])}</span>`
    + `<span class="qcard__reading" lang="ja" data-face="reading">${esc(card.reading)}</span>`
    + `<span class="qcard__glyph${card.serif ? ' serif' : ''}" lang="ja" data-face="glyph">${esc(card.glyph)}</span>`
    + `<span class="qcard__meaning" data-face="meaning">${esc(typo(t.lang, M.cards[0].meaning))}</span>`
    + `<span class="qcard__example" lang="ja" data-face="example">${esc(card.example)}</span>`
    + `<span class="qcard__trans" data-face="translation">${esc(typo(t.lang, M.cards[0].translation))}</span>`
    + `<span class="qcard__band"><i data-face="band" style="width:${card.progress * 100}%"></i></span></div>`
    + '</div></div>'
    + `<div class="rbar" role="group" aria-label="${esc(typo(t.lang, M.rateLabel))}">${ratings}</div>`
    + `<div class="lvl"><span class="fig">${esc(M.level)}</span><span class="lvl__track"><i data-xp-bar></i></span><span class="fig lvl__xp" data-xp>${esc(M.xp(0))}</span><span class="lvl__gain fig" aria-hidden="true" data-xp-gain>${esc(M.xp(1))}</span></div>`
    + `<p class="sr" aria-live="polite" data-trial-live></p>`
    + '</div></div></section>'
}

// 駅's fourteen strokes, for the kanji screen's stroke order.
const STATION_STROKES = kanjiStrokes('099c5')

// A kana card's clip, where the app plays it from: the set's revision is
// read off the app's own playback.js, so a remade set (a new KANA_REV)
// reaches the page at its next build rather than a year of cache later.
const KANA_REV = readFileSync(new URL('../src/lib/audio/playback.js', import.meta.url), 'utf8')
  .match(/export const KANA_REV = '([^']+)'/)[1]
const kanaClip = sound => `/sounds/kanas/${sound}.mp3?v=${KANA_REV}`

// ── The feature screens, drawn (plan 167) ──
// Until a clip is filmed its slot shows the app's own screen for that
// feature, drawn from the same pieces as the rest of the page: the bar
// with the line's roundel, the card or the sentence, and the floor --
// the rating bar, Check, Explain, or the day's gate. A clip, once it is
// in the bucket, plays over it (landing.js).
function mockScreen(t, clip, on) {
  const M = t.mock
  const f = t.features.items[clip.id]
  const ty = x => esc(typo(t.lang, x))
  const bar = count => `<div class="mock__bar">${ring(clip.glyph, clip.line, 'mock__ring')}<span class="mock__title">${ty(f.name)}</span>`
    + `${count ? `<span class="mock__count fig">${count}</span>` : ''}</div>`
  const rate = (due, pressed = -1) => `<div class="mock__rate">${t.method.ratings.map((w, k) =>
    `<span class="q${k + 1}${k === pressed ? ' is-pressed' : ''}"><i class="rbar__dot"></i><b>${esc(w)}</b>${due ? `<small>${esc(t.method.due(due[k]))}</small>` : ''}</span>`).join('')}</div>`
  const button = label => `<span class="mock__btn">${esc(label)}</span>`
  const card = (inner, stage, progress) => `<div class="mk-card"><span class="qcard__stage st-${stage}">${esc(t.method.stages[stage])}</span>${inner}`
    + `<span class="qcard__band"><i style="width:${progress * 100}%"></i></span></div>`
  const screens = {
    aujourdhui: () => {
      const lanes = [['kana', 8], ['vocab', 18], ['kanji', 10], ['grammar', 6]]
      return [bar(''),
        `<div class="mk-today"><span class="mk-today__n fig">${t.method.day.count}</span><span class="mk-today__u">${ty(t.method.day.unit)}</span>`
        + `<span class="mk-bars">${lanes.map(([l, n]) => `<span class="bar" style="--c:${pigment(l)};flex-grow:${n}"></span>`).join('')}</span>`
        + `<span class="capxs mk-today__cap">${ty(M.lanes)}</span><ul class="mk-lanes">${lanes.map(([l, n]) =>
          `<li style="--c:${pigment(l)}"><i></i><span>${ty(t.hero.stations[l])}</span><b class="fig">${n}</b></li>`).join('')}</ul></div>`,
        `<span class="mock__gate"><span class="gate__reader"><span class="wave"><i></i><i></i><i></i></span></span><b>${esc(M.depart)}</b></span>`]
    },
    kana: () => [bar('8 / 20'),
      card(`<span class="mk-card__glyph" lang="ja">あ</span><span class="qcard__hint">${ty(t.method.flip)}</span>`, 'learning', CARDS[2].progress),
      rate(CARDS[2].due)],
    vocabulaire: () => [bar('3 / 18'),
      card(`<span class="qcard__reading" lang="ja">でんしゃ</span><span class="mk-card__word" lang="ja">電車</span><span class="qcard__meaning">${ty(t.method.cards[1].meaning)}</span>`
        + `<span class="mk-card__ex" lang="ja">電車で行きます。</span>`, 'learning', CARDS[1].progress),
      rate(CARDS[1].due, 3)],
    kanji: () => [bar('5 / 10'),
      `<div class="mk-kanji"><span class="mk-strokes" aria-hidden="true"><svg viewBox="0 0 109 109">${STATION_STROKES.map((d, k) =>
        `<path pathLength="1" d="${d}" style="--s:${k}"/>`).join('')}</svg></span>`
      + `<span class="capxs">${ty(M.traced)}</span><span class="mk-kanji__meta"><span class="chip chip--small" lang="ja">エキ</span>`
      + `<span class="chip chip--small">${ty(M.strokes(STATION_STROKES.length))}</span><span class="chip chip--small">${ty(t.lines.plates.kanji.gloss)}</span></span></div>`,
      rate(null)],
    grammaire: () => [bar('2 / 6'),
      `<div class="mk-gram"><span class="mk-gram__pattern" lang="ja">〜ている</span><span class="mk-gram__rule">${ty(t.method.cards[3].meaning)}</span>`
      + `<span class="capxs">${ty(M.fill)}</span><span class="mk-gram__q" lang="ja">雨が降って<i class="mk-gram__blank">いる</i>。</span>`
      + `<span class="mk-gram__opts" lang="ja"><b class="is-right">いる</b><b>ある</b><b>おく</b></span></div>`,
      button(M.check)],
    pratique: () => [bar('4 / 10'),
      `<div class="mk-read"><span class="mk-read__jp" lang="ja">駅で友達を待っています。</span><span class="capxs">${ty(M.field)}</span>`
      + `<span class="mk-field"><span class="mk-field__typed">${esc(M.typed)}</span></span></div>`,
      button(M.check)],
    analyseur: () => [bar(''),
      `<div class="mk-anl"><span class="mk-video" aria-hidden="true"><i></i></span><span class="mk-sub" lang="ja">${TOKENS.map(w => `<b class="${w.gram ? 'is-gram' : ''}">${w.surface}</b>`).join('')}。</span>`
      + `<ol class="mk-points">${t.tools.points.map(([pt, g], k) => `<li><span class="num">${k + 1}</span><b lang="ja">${pt}</b><span>${ty(g)}</span></li>`).join('')}</ol></div>`,
      button(M.explain)],
    examen: () => [bar(t.jlpt.timer),
      `<div class="mk-exam"><span class="mk-exam__q" lang="ja">この <u>駅</u> は とても 大きいです。</span>`
      + `<span class="mk-exam__opts" lang="ja">${EXAM_OPTIONS.map((o, k) => `<b class="${k === 0 ? 'is-right' : ''}"><i>${k + 1}</i>${o}</b>`).join('')}</span></div>`,
      `<span class="mk-progress"><span class="capxs">${ty(M.question(1, EXAM_N5.questions))}</span><span class="mk-progress__bar"><i></i></span></span>`],
  }
  const [head, body, foot] = screens[clip.id]()
  return `<div class="mock" data-mock="${clip.id}" style="--c:${pigment(clip.line)}"${on ? '' : ' hidden'}>${head}<div class="mock__body">${body}</div><div class="mock__foot">${foot}</div></div>`
}

function features(t, media) {
  const F = t.features
  const first = CLIPS[0]
  const tabs = CLIPS.map((clip, k) => {
    const f = F.items[clip.id]
    return `<button type="button" role="tab" id="tab-${clip.id}" aria-controls="feature-panel" aria-selected="${k === 0}" tabindex="${k === 0 ? 0 : -1}" class="ftab" data-feature="${clip.id}" style="--c:${pigment(clip.line)}">`
      + `${ring(clip.glyph, clip.line, 'ftab__ring')}<span class="ftab__text"><span class="ftab__name">${esc(typo(t.lang, f.name))}</span><span class="ftab__line">${esc(typo(t.lang, f.line))}</span></span></button>`
  }).join('')
  const devices = ['phone', 'desk'].map((d, k) => `<button type="button" data-device="${d}" aria-pressed="${k === 0}"${k === 0 ? ' class="on"' : ''}>${esc(F.devices[d])}</button>`).join('')
  const f0 = F.items[first.id]
  return `<section class="sec sec--band" id="${t.ids.features}" aria-labelledby="${t.ids.features}-h">${stop(t, 'features')}<div class="wrap">`
    + head2(t, F.h2, F.body, t.ids.features, `<div class="seg devices" role="group" aria-label="${esc(F.devicesLabel)}" data-devices>${devices}</div>`)
    + `<div class="features" data-media="${esc(media)}" data-reveal>`
    + `<div class="ftabs" role="tablist" aria-label="${esc(F.tabsLabel)}" aria-orientation="vertical">${tabs}</div>`
    + `<div class="fpanel" role="tabpanel" id="feature-panel" aria-labelledby="tab-${first.id}" tabindex="0">`
    + `<div class="frame" data-frame="phone"><div class="frame__screen clip" style="--c:${pigment(first.line)}" data-clip>`
    + CLIPS.map((clip, k) => mockScreen(t, clip, k === 0)).join('')
    + '</div><span class="frame__base"></span></div>'
    + `<p class="body fpanel__what" data-clip-what>${esc(typo(t.lang, f0.what))}</p></div>`
    + '</div></div></section>'
}

function jlpt(t) {
  const J = t.jlpt
  const opts = EXAM_OPTIONS.map((o, k) => `<button type="button" class="opt" data-opt="${k}"><span class="opt__k">${k + 1}</span><span lang="ja">${o}</span></button>`).join('')
  return `<section class="sec" id="${t.ids.jlpt}" aria-labelledby="${t.ids.jlpt}-h">${stop(t, 'jlpt')}<div class="wrap split">`
    + `<div class="split__copy" data-stagger><h2 class="h2" id="${t.ids.jlpt}-h">${esc(typo(t.lang, J.h2))}</h2>`
    + `<p class="body">${esc(typo(t.lang, J.body))}</p><p class="body body--small">${esc(typo(t.lang, J.note))}</p></div>`
    + '<div class="card exam" data-exam data-reveal>'
    + `<div class="exam__top"><span class="exam__head">${ring('模', 'exam', 'exam__ring')}${esc(typo(t.lang, J.head))}</span><span class="fig exam__timer">${J.timer}</span></div>`
    + '<p class="exam__q" lang="ja">この <u>駅</u> は とても 大きいです。</p>'
    + `<div class="exam__opts" role="group" aria-label="${esc(J.optionsLabel)}" data-nudge>${opts}</div>`
    + `<p class="body exam__verdict" aria-live="polite" data-verdict>${esc(typo(t.lang, J.ask))}</p>`
    + '</div></div></section>'
}

function tools(t) {
  const T = t.tools
  const compounds = T.compounds.map(([a, b, reading, gloss]) => {
    const word = a === '駅' ? `<span class="hit">駅</span>${b}` : `${a}<span class="hit">駅</span>`
    return `<li class="word"><span class="word__w" lang="ja">${word}</span><span class="word__r" lang="ja">${reading}</span><span class="word__g">${esc(typo(t.lang, gloss))}</span></li>`
  }).join('')
  const sel = TOKENS.length - 1
  const tok = (w, k) =>
    `<button type="button" class="tok ${w.gram ? 'tok--gram' : 'tok--word'}${k === sel ? ' tok--on' : ''}" data-tok="${k}"${k === 0 ? ' data-nudge' : ''} aria-pressed="${k === sel}"><span class="tok__r">${w.reading}</span><span class="tok__w">${w.surface}</span></button>`
  // The full stop rides with the last word, so a narrow card never
  // wraps it onto a line of its own.
  const tokens = TOKENS.slice(0, -1).map(tok).join('')
    + `<span class="toks__last">${tok(TOKENS[sel], sel)}<span class="tok__w tok__stop">。</span></span>`
  const info = T.tokens[sel]
  const points = T.points.map(([p, g], k) => `<li><span class="num">${k + 1}</span><span class="points__p" lang="ja">${p}</span><span class="points__g">${esc(typo(t.lang, g))}</span></li>`).join('')
  return `<section class="sec sec--band" id="${t.ids.tools}" aria-labelledby="${t.ids.tools}-h">${stop(t, 'tools')}<div class="wrap">`
    + head2(t, T.h2, T.body, t.ids.tools)
    + '<div class="tools" data-stagger>'
    + `<article class="plate dict" style="--c:var(--accent2)"><div class="dict__top"><div class="dict__word"><span class="spec__reading" lang="ja">えき</span><span class="dict__glyph serif" lang="ja">駅</span></div>`
    + `<div class="dict__tags"><span class="chip chip--small">N5</span><span class="stage st-learning">${esc(T.stage)}</span></div></div>`
    + `<p class="dict__sense">${esc(typo(t.lang, T.sense))}</p><ul class="words">${compounds}</ul></article>`
    + '<article class="card analyser" data-analyser>'
    + `<div class="analyser__top">${T.intakes.map((x, k) => `<span class="chip${k ? '' : ' chip--on'}">${esc(x)}</span>`).join('')}<span class="capxs analyser__tap">${esc(typo(t.lang, T.tap))}</span></div>`
    + `<div class="toks" lang="ja">${tokens}</div>`
    + `<p class="body analyser__trans">${esc(typo(t.lang, T.translation))}</p>`
    + `<div class="specimen tokinfo" aria-live="polite"><div class="tokinfo__word"><span class="tokinfo__r" lang="ja" data-ti="dictReading">${TOKENS[sel].dictReading}</span><span class="tokinfo__d" lang="ja" data-ti="dict">${TOKENS[sel].dict}</span><span class="tokinfo__m" data-ti="meaning">${esc(typo(t.lang, info.meaning))}</span></div>`
    + `<div class="tokinfo__note"><span class="capxs" data-ti="kind">${esc(typo(t.lang, info.kind))}</span><span class="body body--small" data-ti="note">${esc(typo(t.lang, info.note))}</span></div></div>`
    + `<ol class="points" aria-label="${esc(typo(t.lang, T.pointsLabel))}">${points}</ol>`
    + '</article></div></div></section>'
}

function fare(t) {
  const F = t.fare
  const promises = F.promises.map(([h, p]) => `<div><h3 class="h3">${esc(typo(t.lang, h))}</h3><p class="body">${esc(typo(t.lang, p))}</p></div>`).join('')
  return `<section class="sec" id="${t.ids.fare}" aria-labelledby="${t.ids.fare}-h">${stop(t, 'fare')}<div class="wrap fare" data-stagger>`
    + `<article class="card fare__card"><h2 class="h2" id="${t.ids.fare}-h">${esc(typo(t.lang, F.h2))}</h2><p class="body">${esc(typo(t.lang, F.body))}</p></article>`
    + `<div class="lattice promises">${promises}</div>`
    + '</div></section>'
}

function faq(t) {
  const F = t.faq
  const items = F.items.map(([q, a], k) => `<details class="faq"${k ? '' : ' open'}><summary>${esc(typo(t.lang, q))}</summary><p>${esc(typo(t.lang, a))}</p></details>`).join('')
  return `<section class="sec sec--band" id="${t.ids.faq}" aria-labelledby="${t.ids.faq}-h">${stop(t, 'faq')}<div class="wrap faqs">`
    + `<div><h2 class="h2" id="${t.ids.faq}-h">${esc(typo(t.lang, F.h2))}</h2></div>`
    + `<div class="faqs__list" data-stagger>${items}</div></div></section>`
}

function pass(t, facts) {
  const P = t.pass
  const n5 = arrivals(facts, DEFAULT_RHYTHM)[0].days
  const dots = [['kana', 'あ'], ['vocab', '語'], ['kanji', '漢'], ['grammar', '文']]
    .map(([l, g]) => `<span class="dot" style="--c:${pigment(l)}" lang="ja">${g}</span>`).join('')
  return `<section class="sec way" id="${t.ids.way}" aria-labelledby="way-h">${stop(t, 'way')}<div class="wrap split split--way">`
    + `<div class="split__copy" data-stagger><h2 class="h2 way__h" id="way-h">${esc(typo(t.lang, P.h2))}</h2><p class="body">${esc(typo(t.lang, P.body))}</p>`
    + `<div class="way__field"><label class="capxs" for="pass-name">${esc(P.nameLabel)}</label><input id="pass-name" class="field" type="text" name="given-name" autocomplete="given-name" maxlength="24" placeholder="${esc(P.name)}" data-pass-input></div>`
    + `<div class="way__gate">${gate(t)}</div>${badges(t)}</div>`
    + `<div class="way__pass" data-reveal data-tilt><div class="pass" role="img" aria-label="${esc(P.aria)}">`
    + '<span class="pass__edge" aria-hidden="true"></span>'
    + `<div class="pass__top"><span class="pass__brand">${mark(22)}<span class="pass__lbl pass__lbl--on">Tsuji</span><span class="pass__kind" lang="ja">定期券</span></span><span class="pwave" aria-hidden="true"><i></i><i></i><i></i></span></div>`
    + `<div class="pass__who"><span class="pass__name serif" data-pass-name>${esc(P.name)}</span><span class="pass__route"><span lang="ja">かな</span><span class="pass__arrow">→</span><span class="fig">N5</span></span></div>`
    + `<div class="pass__fields"><div><span class="pass__lbl">${esc(P.route)}</span><span class="pass__val" data-pass-per>${esc(P.per(DEFAULT_RHYTHM))}</span></div>`
    + `<div><span class="pass__lbl">${esc(P.lines)}</span><span class="pass__dots" role="img" aria-label="${esc(P.linesAria)}">${dots}</span></div>`
    + `<div><span class="pass__lbl">${esc(P.arrival)}</span><span class="pass__val pass__val--gold" data-pass-arrival data-days="${Math.ceil(n5)}">${esc(typo(t.lang, t.line.span(spanOf(n5))))}</span></div></div>`
    + `<div class="pass__bal"><span class="fig">${esc(P.level)}</span><span class="pass__track"><i></i></span></div>`
    + '</div></div></div></section>'
}

function footer(t, other) {
  const F = t.footer
  const links = [
    `<a href="/privacy">${esc(F.privacy)}</a>`,
    CONTACT ? `<a href="mailto:${esc(CONTACT)}">${esc(F.contact)}</a>` : '',
    `<a href="${PAGES[other].path}" hreflang="${other}" lang="${other}">${esc(F.other)}</a>`,
  ].join('')
  return `<footer class="foot"><div class="wrap foot__in"><span class="foot__brand">${mark(28)}<span class="brand__name">Tsuji</span></span>`
    + `<div class="foot__end"><nav class="foot__links" aria-label="Tsuji">${links}</nav><p class="foot__credits">${esc(typo(t.lang, F.credits)).replace('KanjiVG', '<a href="https://kanjivg.tagaini.net" rel="noopener">KanjiVG</a>')}</p></div></div></footer>`
}

// ── The data the client script reads ──

function clientData(t, facts, media) {
  const M = t.method
  const ty = s => typo(t.lang, s)
  return {
    lang: t.lang,
    media,
    rhythm: DEFAULT_RHYTHM,
    at: Object.fromEntries(RHYTHMS.map(m => [m, ty(t.line.at(m))])),
    per: Object.fromEntries(RHYTHMS.map(m => [m, ty(t.pass.per(m))])),
    n5Days: Object.fromEntries(RHYTHMS.map(m => [m, Math.ceil(arrivals(facts, m)[0].days)])),
    passName: t.pass.name,
    cards: CARDS.map((c, k) => ({
      glyph: c.glyph, serif: !!c.serif, reading: c.reading, example: c.example, clip: c.sound ? kanaClip(c.sound) : null,
      meaning: ty(M.cards[k].meaning), translation: ty(M.cards[k].translation),
      kind: M.kinds[c.kind], stage: c.stage, stageWord: M.stages[c.stage], progress: c.progress,
      due: c.due.map(M.due),
    })),
    trial: { pos: CARDS.map((_, k) => M.trialPos(k + 1, CARDS.length)), flip: M.flip, flipAria: M.flipAria, xp: [0, 1, 2, 3, 4, 5].map(M.xp) },
    tokens: TOKENS.map((w, k) => ({ ...w, ...Object.fromEntries(Object.entries(t.tools.tokens[k]).map(([key, v]) => [key, ty(v)])) })),
    exam: { right: ty(t.jlpt.right), wrong: ty(t.jlpt.wrong) },
    features: CLIPS.map(c => ({ id: c.id, glyph: c.glyph, line: pigment(c.line), name: ty(t.features.items[c.id].name), what: ty(t.features.items[c.id].what), play: ty(t.features.play(t.features.items[c.id].name)) })),
  }
}

// ── Search engines ──

const url = path => `${SITE_ORIGIN}${path}`

function jsonLd(t, facts, media, live) {
  const page = PAGES[t.lang]
  const org = { '@type': 'Organization', '@id': url('/#organization'), name: 'Tsuji', url: url(page.path), logo: url('/pwa-512x512.png') }
  const site = { '@type': 'WebSite', '@id': url(`${page.path}#website`), name: 'Tsuji', url: url(page.path), inLanguage: t.lang, publisher: { '@id': org['@id'] } }
  const stores = [STORES.appStore, STORES.googlePlay].filter(Boolean)
  const app = {
    '@type': 'SoftwareApplication',
    name: 'Tsuji',
    url: url(page.path),
    description: t.description,
    applicationCategory: t.appCategory,
    operatingSystem: stores.length ? 'Web, iOS, Android' : 'Web',
    inLanguage: ['fr', 'en'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher: { '@id': org['@id'] },
    ...(stores.length ? { sameAs: stores } : {}),
  }
  const faqPage = {
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: typo(t.lang, q), acceptedAnswer: { '@type': 'Answer', text: typo(t.lang, a) } })),
  }
  const graph = [org, site, app, faqPage]
  // Only once the file is in the bucket and its date written in
  // config.mjs: a VideoObject for a missing file is a broken promise.
  if (live && PRESENTATION.uploadDate) {
    const base = `${media}/${PRESENTATION.file}`
    const starts = PRESENTATION.chapters
    graph.push({
      '@type': 'VideoObject',
      name: t.presentation.videoName,
      description: t.presentation.videoDescription,
      thumbnailUrl: `${base}.jpg`,
      contentUrl: `${base}.mp4`,
      uploadDate: PRESENTATION.uploadDate,
      duration: isoDuration(PRESENTATION.seconds),
      inLanguage: t.lang,
      hasPart: t.presentation.chapters.map((name, k) => ({
        '@type': 'Clip', name, startOffset: starts[k], endOffset: starts[k + 1] ?? PRESENTATION.seconds,
        url: `${url(page.path)}?t=${starts[k]}#${t.ids.presentation}`,
      })),
    })
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

const safeJson = s => s.replace(/</g, '\\u003c')

// ── The stylesheet ──

export function styles() {
  const css = readFileSync(new URL('./landing.css', import.meta.url), 'utf8')
  const tokens = `:root{${block({ ...DARK, ...SCALE, ...FONTS })}}`
    + `:root[data-theme=light]{${block(LIGHT)}}`
    + `@media (prefers-color-scheme:light){:root:not([data-theme]){${block(LIGHT)}}}`
  return (tokens + css)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .trim()
}

// ── The page ──

// Resolves the theme before first paint, as index.html does for the app
// (the same 'jp-theme' key, so a learner's choice follows them here).
const THEME = "(function(){document.documentElement.classList.add('js');try{var s=localStorage.getItem('jp-theme');var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='light'?'#f6f1e4':'#17151a')}catch(e){}})()"

// ── The door to the app (plan 167) ──
// `/` is this page, so everything that used to open the app there is
// sent on to APP_ENTRY before the page paints: a learner already signed
// in (supabase-js's session in localStorage), and a sign-in's return --
// Google's and every e-mail link come back to `/` (src/lib/oauth.js's
// redirectTarget, the project's Site URL), carrying ?code, #access_token
// or an error the app reads on arrival (src/lib/authRedirect.js), so the
// query and the fragment go along. A signed-in visitor who wants the
// page itself opens `/?landing`, which holds for the rest of the tab.
const FORWARD_QUERY = ['code', 'token_hash', 'error', 'error_code', 'error_description']
const FORWARD_HASH = ['access_token', 'error', 'error_code', 'error_description']
const STAY = 'tsuji-landing'

export function forwardScript() {
  const any = (list, from) => `${JSON.stringify(list)}.some(function(k){return ${from}.has(k)})`
  return '(function(){try{var l=location,q=new URLSearchParams(l.search),h=new URLSearchParams(l.hash.slice(1));'
    + `if(q.has('landing'))sessionStorage.setItem('${STAY}','1');`
    + `if(${any(FORWARD_QUERY, 'q')}||${any(FORWARD_HASH, 'h')}`
    + `||(localStorage.getItem('${sessionKey()}')&&!sessionStorage.getItem('${STAY}')))`
    + `l.replace('${APP_ENTRY}'+l.search+l.hash)}catch(e){}})()`
}

export function renderPage(lang, facts, media) {
  const t = STRINGS[lang](facts)
  const other = lang === 'fr' ? 'en' : 'fr'
  const page = PAGES[lang]
  const live = Boolean(PRESENTATION.uploadDate)
  const alternates = Object.values(PAGES).map(p => `<link rel="alternate" hreflang="${p.lang}" href="${url(p.path)}">`).join('')
    + `<link rel="alternate" hreflang="x-default" href="${url(PAGES[DEFAULT_LANG].path)}">`
  const fonts = ['400', '700'].map(w => `<link rel="preload" href="/landing/fonts/space-grotesk-latin-${w}-normal.woff2" as="font" type="font/woff2" crossorigin>`).join('')
  const faces = ['400', '500', '700'].map(w => `@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:${w};font-display:swap;src:url(/landing/fonts/space-grotesk-latin-${w}-normal.woff2) format('woff2')}`).join('')
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(typo(lang, t.title))}</title>
<meta name="description" content="${esc(typo(lang, t.description))}">
<link rel="canonical" href="${url(page.path)}">
${alternates}
<meta name="theme-color" content="#17151a">
<meta name="color-scheme" content="dark light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tsuji">
<meta property="og:title" content="${esc(typo(lang, t.ogTitle))}">
<meta property="og:description" content="${esc(typo(lang, t.description))}">
<meta property="og:url" content="${url(page.path)}">
<meta property="og:locale" content="${page.ogLocale}">
<meta property="og:locale:alternate" content="${PAGES[other].ogLocale}">
<meta property="og:image" content="${url(page.ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(typo(lang, t.ogAlt))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/pwa-64x64.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">
${fonts}
<script>${forwardScript()}</script>
<script>${THEME}</script>
<style>${faces}${styles()}</style>
<script type="application/ld+json">${safeJson(jsonLd(t, facts, media, live))}</script>
<script type="module" src="/landing/landing.js"></script>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
${header(t, other)}
<main id="main">
${hero(t, live)}
${figures(t)}
${presentation(t, media, live)}
${lines(t)}
${line(t, facts)}
${method(t)}
${features(t, media)}
${jlpt(t)}
${tools(t)}
${fare(t)}
${faq(t)}
${pass(t, facts)}
</main>
${footer(t, other)}
<script type="application/json" id="landing-data">${safeJson(JSON.stringify(clientData(t, facts, media)))}</script>
</body>
</html>
`
}
