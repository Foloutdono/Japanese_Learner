// ── 辻 — the 30-second practice ad's page ───────────────────────
// The ad as one HTML document: every scene laid out at once, hidden,
// and timeline.js shows each at its moment from the time it is given
// (window.seek(t)), so a frame is a pure function of t and the render
// can capture any of them in any order. The tokens, the fonts and the
// mark are the app's own, read from where the landing page reads them.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MARK_INK, MARK_ROAD } from '../../src/components/ui/markPaths.js'
import { DARK, SCALE, FONTS, block } from '../../landing/tokens.mjs'
import { SITE_ORIGIN, PAGES } from '../../landing/config.mjs'
import { readFacts } from '../../landing/content.mjs'

const here = path => new URL(path, import.meta.url)
const fileUrl = path => pathToFileURL(fileURLToPath(here(path))).href
const read = path => readFileSync(here(path), 'utf8')

// The ad's address: the English page, as the platform's button opens it.
export const AD_URL = `${new URL(SITE_ORIGIN).host}${PAGES.en.path}`

// The six practice platforms, in the gate's order (src/config/tabs.js):
// the ring's glyph, the station's name and its line's pigment.
export const STOPS = [
  { id: 'reading', glyph: '読', name: '読書', cap: 'Reading', line: 'reading' },
  { id: 'rikai', glyph: '理', name: '理解', cap: 'Comprehension', line: 'rikai' },
  { id: 'honyaku', glyph: '訳', name: '翻訳', cap: 'Translation', line: 'honyaku' },
  { id: 'kakitori', glyph: '書', name: '書取', cap: 'Dictation', line: 'kakitori' },
  { id: 'sakubun', glyph: '作', name: '作文', cap: 'Composition', line: 'sakubun' },
  { id: 'exam', glyph: '模', name: '模試', cap: 'Mock exam', line: 'exam' },
]

const words = text => text.split(' ').map(w => `<span class="w">${w}</span>`).join(' ')
const mark = cls => `<svg class="mark ${cls}" viewBox="0 0 1000 1000"><path class="road" d="${MARK_ROAD}"/><path class="ink" d="${MARK_INK}"/></svg>`
const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>'
// The pass's contactless mark, as the gate button's reader prints it.
const WAVES = '<svg viewBox="0 0 24 24"><path d="M8.5 7.5a6.5 6.5 0 0 1 0 9"/><path d="M12 5a10 10 0 0 1 0 14"/><path d="M15.5 2.5a13.5 13.5 0 0 1 0 19"/></svg>'

function plate(i) {
  const s = STOPS[i]
  return `<div class="plate"><div class="plate__name" lang="ja">${s.name}</div><div class="plate__cap">${s.cap}</div><div class="plate__no"><b>${i + 1}</b> / 6</div></div>`
}

function feat(i, head, card, value, extra = '') {
  const s = STOPS[i]
  return `<section class="feat" id="f-${s.id}" style="--c:var(--line-${s.line})">${plate(i)}<h2 class="head">${head}</h2><div class="card">${card}</div>${extra}<p class="value">${value}</p></section>`
}

const FLASHCARDS = [
  ['猫', 'cat'], ['水', 'water'], ['本', 'book'], ['電車', 'train'], ['先生', 'teacher'],
  ['学校', 'school'], ['食べる', 'to eat'], ['友だち', 'friend'], ['飲む', 'to drink'], ['駅', 'station'],
]

// Every figure the ad prints is counted from the content the app
// serves, as the landing page's are, so the ad cannot outlive a deck.
const facts = readFacts()
const num = n => n.toLocaleString('en-GB')
const exam = facts.exam
const examScore = { knowledge: 98, listening: 44 }   // the N5 paper's two scored sections, 120 + 60

const scenes = `
<section id="s-hook1">
  <h1 class="hook-line" id="hk1">${words('Months of flashcards…')}</h1>
  <div class="day" id="hk-day">DAY <b>1</b></div>
  <div class="deck" id="hk-deck">${FLASHCARDS.map(([w, g]) => `<div class="fc"><div class="fc__w" lang="ja">${w}</div><div class="fc__g">${g}</div><div class="fc__stage"></div></div>`).reverse().join('')}</div>
</section>

<section id="s-hook2">
  <h1 class="hook-line" id="hk2"><span class="w">…and</span> <span class="w">you</span> <span class="w">still</span> <span class="w">can't</span> <span class="w">read</span> <span class="w hl">this?</span></h1>
  <div class="hook-sent" id="hk-sent" lang="ja"><span class="tok">駅<span class="q">?</span></span>で<span class="tok">コーヒー</span>を<span class="tok">飲<span class="q">?</span></span>みます。</div>
  <svg class="squiggle" id="hk-sq" viewBox="0 0 356 10" preserveAspectRatio="none"><path d="M0 5 Q 6 0 12 5 T 24 5 T 36 5 T 48 5 T 60 5 T 72 5 T 84 5 T 96 5 T 108 5 T 120 5 T 132 5 T 144 5 T 156 5 T 168 5 T 180 5 T 192 5 T 204 5 T 216 5 T 228 5 T 240 5 T 252 5 T 264 5 T 276 5 T 288 5 T 300 5 T 312 5 T 324 5 T 336 5 T 348 5 T 356 5" fill="none" stroke="var(--rating-wrong)" stroke-width="2.5" stroke-linecap="round"/></svg>
</section>

<section id="s-miss">
  <svg class="rays" id="rays" viewBox="0 0 432 768">${STOPS.map((s, i) => {
    const a = (-90 + (i - 2.5) * 60) * Math.PI / 180
    return `<line x1="216" y1="310" x2="${216 + Math.cos(a) * 520}" y2="${310 + Math.sin(a) * 520}" stroke="var(--line-${s.line})" stroke-width="5" stroke-linecap="round"/>`
  }).join('')}</svg>
  <div class="miss" id="miss1">You're missing</div>
  <div class="miss" id="miss2">practice.</div>
</section>

<section id="s-brand">
  ${mark('brand-mark')}
  <div class="brand-name">Tsuji</div>
  <h2 id="brand-head"><span class="w n">6</span> <span class="w">ways</span> <span class="w">to</span> <span class="w">practise</span> <span class="w">Japanese</span></h2>
</section>

<div id="rail">
  <div class="rail-line"></div><div class="rail-done"></div>
  ${STOPS.map(s => `<div class="ring" style="--c:var(--line-${s.line})" lang="ja">${s.glyph}</div>`).join('')}
  <div class="train"></div>
</div>

${feat(0,
  `<span class="w"><em>Read</em></span> <span class="w">real</span> <span class="w">sentences</span>`,
  `<div class="card__top"><span class="tag">N5</span><span class="hint">Type the reading</span></div>
   <div class="sent" lang="ja"><ruby>駅<rt>えき</rt></ruby>でコーヒーを<ruby>飲<rt>の</rt></ruby>みます。</div>
   <div class="well"><span class="ph">ex. konnichiwa</span><span class="typed"></span><i class="caret"></i><span class="check">Check</span><span class="verdict">✓</span></div>
   <div class="bd">
     <div class="bd-row"><b lang="ja">駅</b><span class="rd" lang="ja">えき</span><span class="gl">station</span></div>
     <div class="bd-row"><b lang="ja">コーヒー</b><span class="gl">coffee</span></div>
     <div class="bd-row"><b lang="ja">飲む</b><span class="rd" lang="ja">のむ</span><span class="gl">to drink</span></div>
   </div>`,
  `Pitched at <b>your JLPT level</b>, then every word broken down.`)}

${feat(1,
  `<span class="w"><em>Understand</em></span> <span class="w">short</span> <span class="w">texts</span>`,
  `<div class="card__top"><span class="tag">N5</span><span class="hint">Read, then answer</span></div>
   <div class="passage" lang="ja">ケンさんは毎朝、<mark>駅で</mark>コーヒーを飲みます。それから、電車で会社に行きます。</div>
   <div class="ask">Where does Ken drink his coffee?</div>
   <div class="opts"><div class="opt"><i>1</i>At home</div><div class="opt"><i>2</i>At the station</div><div class="opt"><i>3</i>At the office</div><div class="opt"><i>4</i>On the train</div></div>`,
  `Passages, then questions: <b>the exam's reading half</b>, rehearsed.`)}

${feat(2,
  `<span class="w"><em>Translate</em></span> <span class="w">into</span> <span class="w">Japanese</span>`,
  `<div class="card__top"><span class="tag">N5</span><span class="hint">Into Japanese</span></div>
   <div class="prompt">“I meet a friend in front of the station.”</div>
   <div class="well jp"><span class="typed" lang="ja"></span><i class="caret"></i><span class="verdict">✓</span></div>
   <div class="tutor"><div class="tutor__top"><span class="tutor__who">Tutor</span><span class="tutor__ok">✓</span> Correct and natural</div><p><span lang="ja">に</span> marks the person you meet: <span lang="ja">友だちに会う</span>.</p></div>`,
  `The hard direction, on purpose, <b>with a tutor's read</b> on yours.`)}

${feat(3,
  `<span class="w"><em>Write</em></span> <span class="w">what</span> <span class="w">you</span> <span class="w">hear</span>`,
  `<div class="card__top"><span class="tag">N5</span><span class="hint">Listen · 1 of 2</span></div>
   <div class="player"><div class="play"><i class="pulse"></i>${PLAY}</div><div class="wave">${'<i></i>'.repeat(26)}</div></div>
   <div class="well"><span class="typed"></span><i class="caret"></i><span class="check">Check</span><span class="verdict">✓</span></div>
   <div class="answer"><b lang="ja">学校は九時からです。</b><span>School starts at nine.</span></div>`,
  `Everyday spoken lines. <b>Two listens</b>, no more.`)}

${feat(4,
  `<span class="w"><em>Compose</em></span> <span class="w">your</span> <span class="w">own</span> <span class="w">sentences</span>`,
  `<div class="card__top"><span class="tag">N5</span><span class="hint">Use this point</span></div>
   <div class="point"><b lang="ja">〜たい</b><div><strong>want to (do)</strong><span>verb stem + たい</span></div></div>
   <div class="well jp"><span class="typed" lang="ja"></span><i class="caret"></i></div>
   <div class="found">✓ <span lang="ja">〜たい</span> found</div>
   <div class="tutor"><div class="tutor__top"><span class="tutor__who">Tutor</span> Natural. Now say when:</div><p><span lang="ja">来年、日本に行きたいです。</span></p></div>`,
  `You get a grammar point, you write. <b>A tutor reads it back.</b>`)}

${feat(5,
  `<span class="w"><em>Sit</em></span> <span class="w">mock</span> <span class="w">JLPT</span> <span class="w">exams</span>`,
  `<div class="flip"><div class="face face--q">
     <div class="paper-top"><span>JLPT N5 · <span lang="ja">模試</span></span><span class="timer" data-minutes="${exam.minutes}">${exam.minutes}:00</span></div>
     <div class="mondai">Part 1 · Kanji reading</div>
     <div class="qjp" lang="ja">「<u>駅</u>」の よみかたは どれですか。</div>
     <div class="olist"><div class="opt"><i>1</i>えき</div><div class="opt"><i>2</i>いき</div><div class="opt"><i>3</i>えぎ</div><div class="opt"><i>4</i>えい</div></div>
   </div><div class="face face--s">
     <div class="paper-top"><span>JLPT N5 · Result</span><span class="timer">Pass mark ${exam.pass}</span></div>
     <div class="score" data-knowledge="${examScore.knowledge}" data-listening="${examScore.listening}" data-max="${exam.max}"><b>0</b><span>/ ${exam.max}</span></div>
     <div class="sec"><div class="sec__row"><span>Language knowledge & reading</span><span class="n1">0 / 120</span></div><div class="bar"><i></i></div></div>
     <div class="sec"><div class="sec__row"><span>Listening</span><span class="n2">0 / 60</span></div><div class="bar"><i></i></div></div>
     <div class="sheet-lbl"><span>${exam.questions} questions</span><span>${exam.minutes} minutes</span></div><div class="sheet">${'<i></i>'.repeat(exam.questions)}</div>
     <div class="stamp"><span lang="ja">合格</span><small>PASS</small></div>
   </div></div>`,
  `<b>N5 to N1</b>: timed, and scored out of ${exam.max}.`,
  `<div class="note">Unofficial scoring</div>`)}

<section id="s-board">
  <h2 id="board-head"><span class="w">Plus</span> <span class="w">the</span> <span class="w">whole</span> <span class="w">course,</span> <span class="w"><em>N5 → N1</em></span></h2>
  <div class="board">
    <div class="brow"><div class="ring" style="--c:var(--line-vocab)" lang="ja">語</div><div class="flaps" data-to="${num(facts.words)}"></div><div class="lbl">Words</div></div>
    <div class="brow"><div class="ring" style="--c:var(--line-kanji)" lang="ja">漢</div><div class="flaps" data-to="${num(facts.kanji)}"></div><div class="lbl">Kanji</div></div>
    <div class="brow"><div class="ring" style="--c:var(--line-grammar)" lang="ja">文</div><div class="flaps" data-to="${num(facts.grammar)}"></div><div class="lbl">Grammar<br>points</div></div>
  </div>
  <p id="board-sub">Spaced repetition brings each card back <b>right before you forget it</b>.</p>
</section>

<section id="s-cta">
  ${mark('cta-mark')}
  <div class="brand-name">Tsuji</div>
  <h2 id="cta-head"><span class="w">Start</span> <span class="w">practising</span> <span class="w"><em>today</em></span></h2>
  <div class="gate"><i class="gate__halo"></i><div class="reader"><i class="ripple"></i><i class="ripple"></i>${WAVES}</div><span class="gate__word">Start free</span><span class="gate__arrow">→</span></div>
  <div class="url">${AD_URL}</div>
  <div class="terms">Free during early access · no account needed</div>
  <div class="down"><svg viewBox="0 0 30 46"><path d="M15 3v36M4 28l11 12 11-12"/></svg></div>
</section>`

export function adPage() {
  const fonts = ['noto-sans-jp/500', 'noto-sans-jp/700', 'noto-serif-jp/900']
    .map(f => `<link rel="stylesheet" href="${fileUrl(`../../node_modules/@fontsource/${f}.css`)}">`).join('')
  const grotesk = ['500', '700'].map(w => `@font-face{font-family:'Space Grotesk';font-weight:${w};src:url(${fileUrl(`../../public/landing/fonts/space-grotesk-latin-${w}-normal.woff2`)}) format('woff2')}`).join('')
  const strip = STOPS.map(s => `<i style="background:var(--line-${s.line})"></i>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tsuji ad</title>${fonts}
<style>${grotesk}:root{${block(DARK)};${block(SCALE)};${block(FONTS)}}${read('./ad.css')}</style></head>
<body><div id="stage"><div id="bg"><div id="glow"></div><div id="speed"></div><div id="vignette"></div></div>
<div id="cam">${scenes}</div><div class="strip" id="strip">${strip}</div><div id="flash"></div></div>
<script>${read('./timeline.js')}</script></body></html>`
}
