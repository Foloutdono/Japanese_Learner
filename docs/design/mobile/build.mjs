import { writeFileSync } from 'node:fs'
import { artboard, hud, tabbar, header, back, track, due, rally, pace, jourLine, pass, credits, status, I } from './parts.mjs'
import { SCREENS2 } from './screens2.mjs'
import { SCREENS3, STATES_BODY } from './screens3.mjs'

// ── sample data, shared by every screen ──
const LANES = [
  { color: 'var(--line-kanji)',   where: 'Kanji N4',      mode: 'Kanji → meaning', due: 9 },
  { color: 'var(--line-vocab)',   where: 'Vocabulary N5', mode: 'Word → meaning',  due: 8 },
  { color: 'var(--line-grammar)', where: 'Grammar N4',    mode: 'Rule → meaning',  due: 5 },
  { color: 'var(--line-decks)',   where: '<span lang="ja">旅行</span>', mode: 'My deck', due: 2 },
]
const lane = (l, on = true) => `<button type="button" class="lane${on ? '' : ' lane--off'}" style="--lane-color: ${l.color}">
  <span class="lane__tick">${on ? I.check : ''}</span>
  <span class="lane__where">${l.where}</span>
  <span class="lane__mode">${l.mode}</span>
  <span class="lane__due">${l.due}</span>
</button>`
const departBtn = (label = 'Depart', extra = '') => `<button type="button" class="btn-depart${extra}"><span class="btn-depart__jp">${label}</span><span class="btn-depart__go">▶</span></button>`

export const gateCard = ({ total = 24, balance = 30, lanes = LANES } = {}) => {
  const short = total > balance
  const out = balance === 0
  return `<div class="gate-card">
  <div class="gate-card__head">
    <span class="gate-card__title">Fare gate</span>
    <span class="gate-card__figure"><span class="gate-card__count">${total}</span><span class="gate-card__unit">due</span></span>
  </div>
  <div class="gate-card__lanes">${lanes.map(l => lane(l)).join('')}</div>
  <div class="gate-card__fare">
    <span>Fare</span><b>${Math.min(total, balance)}</b><span>credits</span>
    <span class="gate-card__fare-sep"></span>
    <span>Balance</span><b class="fare-gold">${balance}</b>
  </div>
  ${out ? `<div class="gate-card__short">${I.warn}<span>No credits left — <b>+30</b> at 00:00</span></div>` : short ? `<div class="gate-card__short">${I.warn}<span><b>${balance}</b> of ${total} run today — ${total - balance} wait for tomorrow's refill</span></div>` : ''}
  ${departBtn('Depart', out ? ' btn-depart--off' : '')}
  ${out ? departBtn('Go unlimited') : ''}
</div>`
}
const gateClear = () => `<div class="gate-card" style="gap: var(--sp-3);">
  <div class="gate-card__head"><span class="gate-card__title">Fare gate</span></div>
  <span class="gate-card__clear">All clear</span>
  <span class="gate-card__when">Next review in 3 hours.</span>
</div>`
const strip = () => `<div class="pass pass--strip">${rally()}${pace()}</div>`

// ── 1 · Today's run — the home tab, the fare gate ──
export const TODAY_BODY = (opts = {}) => `
${hud(opts.hud)}
<main class="phone__content">
  ${header({ code: 'HN', title: "Today's run", sub: 'Sat 5 Sep', color: 'var(--accent2)' })}
  ${gateCard(opts.gate)}
  ${strip()}
</main>
${tabbar('today', 24)}`

// ── 2 · In a run — the study stage, chrome hidden, rating bar docked ──
export const RUN_BODY = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-kanji);">
  <div class="stage__head">
    ${back('Gate')}
    <span class="stage__where"><h1 class="stage__where-jp">Kanji N4</h1><span class="stage__where-latin">Kanji → meaning</span></span>
    <span class="today-remaining">18</span>
    ${credits(24)}
  </div>
  <div class="deck-progress">
    <span class="deck-progress__segment" style="width: 30%; background: var(--state-new);"></span>
    <span class="deck-progress__segment" style="width: 45%; background: var(--state-learning);"></span>
    <span class="deck-progress__segment" style="width: 25%; background: var(--state-mastered);"></span>
  </div>
  <div class="study-assist">
    <button type="button" class="study-assist__toggle study-assist__toggle--on">${I.plus}Hide choices</button>
    <button type="button" class="study-assist__toggle">${I.plus}Show a sentence</button>
  </div>
  <div class="prompt-card">
    <span class="stage-mark stage-mark--learning">In progress</span>
    <div class="prompt-card__body"><span class="char-display" lang="ja">駅</span></div>
    <div class="prompt-card__foot"><span>N4 · Kanji</span><span>Kanji → meaning</span></div>
  </div>
  <div class="mcq-list">
    <button type="button" class="mcq-row mcq-row--correct"><span class="mcq-row__accent"></span><span class="mcq-row__index">01</span><span class="mcq-row__text">station</span></button>
    <button type="button" class="mcq-row mcq-row--filler"><span class="mcq-row__accent"></span><span class="mcq-row__index">02</span><span class="mcq-row__text">bridge</span></button>
    <button type="button" class="mcq-row mcq-row--filler"><span class="mcq-row__accent"></span><span class="mcq-row__index">03</span><span class="mcq-row__text">town</span></button>
    <button type="button" class="mcq-row mcq-row--filler"><span class="mcq-row__accent"></span><span class="mcq-row__index">04</span><span class="mcq-row__text">morning</span></button>
  </div>
  <div class="rating-bar"><div class="rating-bar__buttons">
    <button type="button" class="rating-bar__btn rating-bar__btn--q1"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">Wrong</span></button>
    <button type="button" class="rating-bar__btn rating-bar__btn--q2"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">Almost</span></button>
    <button type="button" class="rating-bar__btn rating-bar__btn--q3"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">Difficult</span></button>
    <button type="button" class="rating-bar__btn rating-bar__btn--q4 rating-bar__btn--pressed"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">Correct</span></button>
  </div></div>
</main>`

// ── 3 · Run complete ──
const COMPLETE_BODY = `
${hud({ cr: 6 })}
<main class="phone__content">
  ${header({ code: 'HN', title: "Today's run", sub: 'Sat 5 Sep', color: 'var(--accent2)' })}
  <div class="today-clear">
    <span class="today-clear__mark">${I.check.replace('class="svg"', 'class="svg" style="width:26px;height:26px;stroke-width:2.6;"')}</span>
    <p class="today-clear__title">Run complete</p>
    <p class="today-clear__body">24 reviews cleared. Nothing else is due.</p>
    <p class="today-clear__next">Next review in 3 hours.</p>
    <div class="fare-slip">
      <div class="fare-slip__cell"><span class="fare-slip__v">24</span><span class="cap">reviews</span></div>
      <div class="fare-slip__cell"><span class="fare-slip__v">+96<span class="fare-slip__u">xp</span></span><span class="cap">fare</span></div>
      <div class="fare-slip__cell"><span class="fare-slip__v fare-slip__v--gold">6</span><span class="cap">credits left</span></div>
    </div>
    ${departBtn('Back to the station', ' btn-depart--ghost').replace('class="btn-depart btn-depart--ghost"', 'class="btn-depart btn-depart--ghost" style="width: 100%; margin-top: var(--sp-3);"').replace('<span class="btn-depart__go">▶</span>', '')}
  </div>
</main>
${tabbar('today', 0)}`

// ── 4 · Learn — the route map, four lines and your own decks ──
const line = ({ code, color, title, stops, travelled, n }) => `<button type="button" class="wmap-line" style="--line-color: ${color}">
  <span class="wmap-line__id">
    <span class="wmap-roundel">${code}</span>
    <span class="wmap-line__names"><span class="wmap-line__jp">${title}</span></span>
  </span>
  <span class="wmap-line__due">${due(n)}</span>
  ${track(stops, travelled)}
</button>`
const LEARN_BODY = `
${hud()}
<main class="phone__content">
  ${header({ code: 'JP', title: 'Route map', sub: 'Four lines', color: 'var(--accent2)' })}
  <div class="board">
    <div class="wmap__lines">
      ${line({ code: 'KN', color: 'var(--line-kana)',    title: 'Kana',       stops: ['あ', 'きゃ', 'ア', 'キャ'],   travelled: 4,   n: 0 })}
      ${line({ code: 'TG', color: 'var(--line-vocab)',   title: 'Vocabulary', stops: ['N5', 'N4', 'N3', 'N2', 'N1'], travelled: 1.6, n: 8 })}
      ${line({ code: 'KJ', color: 'var(--line-kanji)',   title: 'Kanji',      stops: ['N5', 'N4', 'N3', 'N2', 'N1'], travelled: 1.3, n: 9 })}
      ${line({ code: 'BP', color: 'var(--line-grammar)', title: 'Grammar',    stops: ['N5', 'N4', 'N3', 'N2', 'N1'], travelled: 1.2, n: 5 })}
    </div>
    <div class="wmap__group">
      <button type="button" class="wmap-row" style="--line-color: var(--line-decks)">
        <span class="wmap-roundel">KZ</span>
        <span class="wmap-row__names"><span class="wmap-row__jp">My decks</span><span class="wmap-row__latin">3 decks · 214 cards</span></span>
        <span class="wmap-row__note">${due(2)}</span>
        <span class="wmap-row__go">▶</span>
      </button>
    </div>
  </div>
</main>
${tabbar('learn', 24)}`

// ── 5 · A station: Kanji, the level line ──
const stop = ({ code, hint, state, done, total }) => `<button type="button" class="route-stop${state ? ` route-stop--${state}` : ''}">
  <span class="route-stop__code">${code}</span>
  <span class="route-stop__names"><span class="route-stop__jp">${hint}</span>${state === 'current' ? '<span class="route-stop__here">You are here</span>' : ''}</span>
  <span class="route-stop__fig"><b>${done}</b>/ ${total}</span>
  <span class="route-stop__go">▶</span>
</button>`
const STATION_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kanji);">
  ${header({ code: 'KJ', title: 'Kanji', sub: 'JLPT', color: 'var(--line-kanji)', aside: '<button type="button" class="cap" style="text-decoration: underline; text-underline-offset: 3px;">By frequency</button>' })}
  <div class="route">
    <span class="route__done" style="height: 64px;"></span>
    ${stop({ code: 'N5', hint: 'Beginner',     state: 'past',    done: 103, total: 103 })}
    ${stop({ code: 'N4', hint: 'Elementary',   state: 'current', done: 121, total: 181 })}
    ${stop({ code: 'N3', hint: 'Intermediate', state: '',        done: 0,   total: 367 })}
    ${stop({ code: 'N2', hint: 'Advanced',     state: '',        done: 0,   total: 415 })}
    ${stop({ code: 'N1', hint: 'Proficiency',  state: '',        done: 0,   total: 1070 })}
  </div>
</main>
${tabbar('learn', 24)}`

// ── 6 · A platform list: Kanji N4, the modes on the service ladder ──
const pips = n => `<span class="platform-card__stops">${[1, 2, 3, 4].map(i => `<span class="platform-card__pip${i <= n ? ' platform-card__pip--on' : ''}"></span>`).join('')}</span>`
const mode = ({ svc, label, stops, title, desc }) => `<button type="button" class="platform-card platform-card--${svc}">
  <span class="platform-card__lead"><span class="platform-card__service">${label}</span>${stops ? pips(stops) : ''}</span>
  <span class="platform-card__body"><span class="platform-card__title">${title}</span><span class="platform-card__desc">${desc}</span></span>
  <span class="platform-card__go">▶</span>
</button>`
const MODES_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kanji);">
  ${header({ code: 'KJ', title: 'Kanji', sub: 'N4 · Elementary', color: 'var(--line-kanji)', aside: back('Levels') })}
  <div class="platform-grid" style="gap: var(--sp-3);">
    ${mode({ svc: 'rapid',   label: 'Rapid',    stops: 3, title: 'Kanji → meaning', desc: 'The kanji is shown. Recall what it means.' })}
    ${mode({ svc: 'express', label: 'Express',  stops: 2, title: 'Meaning → kanji', desc: 'The meaning is given. Recall the kanji.' })}
    ${mode({ svc: 'ltd',     label: 'Ltd. exp.', stops: 1, title: 'Draw the kanji',  desc: 'The meaning is given. Draw it by hand.' })}
    ${mode({ svc: 'express', label: 'Express',  stops: 2, title: 'Readings',        desc: "Type its on'yomi and kun'yomi." })}
    ${mode({ svc: 'rapid',   label: 'Rapid',    stops: 3, title: 'Radical',         desc: 'Recall which radical it is built on.' })}
    ${mode({ svc: 'review',  label: 'Review',   stops: 0, title: 'Fast review',     desc: 'Flip through what you know. Nothing is graded.' })}
  </div>
</main>
${tabbar('learn', 24)}`

// ── 7 · Practice — four platforms ──
const practice = ({ n, color, title, desc }) => `<button type="button" class="platform-card platform-card--line" style="--line-color: ${color}">
  <span class="platform-card__lead"><span class="platform-card__no">${n}</span></span>
  <span class="platform-card__body"><span class="platform-card__title">${title}</span><span class="platform-card__desc">${desc}</span></span>
  <span class="platform-card__go">▶</span>
</button>`
const PRACTICE_BODY = `
${hud()}
<main class="phone__content">
  ${header({ title: 'Practice', sub: 'Four platforms', register: true })}
  <div class="platform-grid">
    ${practice({ n: 1, color: 'var(--line-reading)', title: 'Reading practice',      desc: 'Real sentences, pitched at your level.' })}
    ${practice({ n: 2, color: 'var(--line-rikai)',   title: 'Reading comprehension', desc: 'Short passages, then questions.' })}
    ${practice({ n: 3, color: 'var(--line-honyaku)', title: 'Translation',           desc: 'Put it into Japanese yourself.' })}
    ${practice({ n: 4, color: 'var(--line-exam)',    title: 'Mock exam',             desc: 'Timed papers in the JLPT format.' })}
  </div>
</main>
${tabbar('practice', 24)}`

// ── 8 · Dictionary — the analyzer's door, the console, the catalogue ──
const card = ({ kana, char, meaning, lvl, color, stage }) => `<button type="button" class="dict-entry-card" style="--level-color: ${color}">
  <span class="dict-level-badge">${lvl}</span>
  ${stage ? `<span class="stage-mark stage-mark--${stage}">${{ learning: 'In progress', mastered: 'Mastered' }[stage]}</span>` : ''}
  <span class="dict-entry-card__kana" lang="ja">${kana}</span>
  <span class="dict-entry-card__char" lang="ja">${char}</span>
  <span class="dict-entry-card__meaning">${meaning}</span>
</button>`
export const ANL_DOOR = `<button type="button" class="anl-door">
    <span class="wmap-roundel" style="--line-color: var(--line-kaiseki); color: color-mix(in srgb, var(--line-kaiseki) 60%, var(--text-primary));">KS</span>
    <span class="anl-door__names"><span class="anl-door__title">Analyzer</span></span>
    <span class="anl-door__intakes"><span class="anl-door__intake">${I.text}</span><span class="anl-door__intake">${I.camera}</span><span class="anl-door__intake">${I.video}</span></span>
  </button>`
const DICT_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-jisho);">
  ${header({ code: 'JS', title: 'Dictionary', color: 'var(--line-jisho)' })}
  ${ANL_DOOR}
  <div class="console">
    <div class="console__top">
      <div class="console__chips">
        <button type="button" class="chip chip--on" style="--tab-color: var(--line-kanji)">Kanji</button>
        <button type="button" class="chip" style="--tab-color: var(--line-vocab)">Vocab</button>
        <button type="button" class="chip" style="--tab-color: var(--line-kana)">Hiragana</button>
        <button type="button" class="chip" style="--tab-color: var(--line-rikai)">Katakana</button>
        <button type="button" class="chip" style="--tab-color: var(--line-jisho)">JMdict</button>
      </div>
    </div>
    <div class="console__index">${I.search}<span class="console__field console__field--filled">san</span><button type="button" class="console__clear">${I.cross}</button><span class="console__count">128 results</span></div>
  </div>
  <div class="dict-grid">
    ${card({ kana: 'サン・みっ(つ)', char: '三',   meaning: 'three',         lvl: 'N5', color: 'var(--success)', stage: 'mastered' })}
    ${card({ kana: 'サン・やま',     char: '山',   meaning: 'mountain',      lvl: 'N5', color: 'var(--success)', stage: 'learning' })}
    ${card({ kana: 'さんぽ',         char: '散歩', meaning: 'walk, stroll',  lvl: 'N4', color: 'var(--teal)',    stage: 'learning' })}
    ${card({ kana: 'さんか',         char: '参加', meaning: 'participation', lvl: 'N3', color: 'var(--warning)', stage: '' })}
    ${card({ kana: 'さんせい',       char: '賛成', meaning: 'approval',      lvl: 'N2', color: 'var(--rust)',    stage: '' })}
    ${card({ kana: 'さんぎょう',     char: '産業', meaning: 'industry',      lvl: 'N2', color: 'var(--rust)',    stage: '' })}
  </div>
</main>
${tabbar('dict', 24)}`

// ── 9 · Analyzer — one workbench: the intake switch, the field, the one action, the history ──
const hist = ({ jp, count, when, kept }) => `<button type="button" class="anl-hist">
  <span class="anl-hist__body"><span class="anl-hist__jp" lang="ja">${jp}</span><span class="anl-hist__meta">${kept ? '<span class="anl-kept">Kept</span>' : ''}<span>${count}</span><span>${when}</span></span></span>
  <span class="platform-card__go" style="--rail: var(--line-kaiseki); padding-right: 0;">▶</span>
</button>`
export const intakeSeg = (on) => `<div class="seg seg--full seg--kaiseki">
    <button type="button" class="seg__opt${on === 'text' ? ' seg__opt--on' : ''}">${I.text}<span class="seg__opt-latin">Text</span></button>
    <button type="button" class="seg__opt${on === 'photo' ? ' seg__opt--on' : ''}">${I.camera}<span class="seg__opt-latin">Photo</span></button>
    <button type="button" class="seg__opt${on === 'video' ? ' seg__opt--on' : ''}">${I.video}<span class="seg__opt-latin">Video</span></button>
  </div>`
const ANL_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki);">
  ${header({ code: 'KS', title: 'Analyzer', color: 'var(--line-kaiseki)', aside: back('Dictionary') })}
  ${intakeSeg('text')}
  <div class="textarea">Paste or type Japanese…</div>
  <button type="button" class="btn-primary" style="width: 100%;">Analyze</button>
  <div class="head2"><span class="head2__latin">History</span><span class="head2__count">16 passages</span></div>
  <div class="surface" style="display:flex;flex-direction:column;">
    ${hist({ jp: '駅で友達を待っています。',          count: '3 sentences', when: 'today' })}
    ${hist({ jp: '雨が降りそうです。',                count: '1 sentence',  when: 'yesterday', kept: true })}
    ${hist({ jp: 'ご確認のうえ、お手続きください。',   count: '2 sentences', when: '12 days ago' })}
  </div>
</main>
${tabbar('dict', 24)}`

// ── 10 · Profile — the pass and its inserts ──
const rideLine = () => `<div class="jour-line">
  <span class="jour-line__status"><b style="color: var(--text-on-panel);">Balance</b></span>
  <span class="jour-line__validity"><b>30</b><span class="jour-cap">/ 50 credits</span></span>
  <span class="jour-cap" style="margin-left: auto; letter-spacing: 0.08em; text-transform: none;">+30 at 00:00</span>
</div>`
function stampBook() {
  const start = new Date(2026, 7, 3), today = new Date(2026, 8, 5)
  const missed = new Set(['8-22', '9-2'])
  const cells = []
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = `${d.getMonth() + 1}-${d.getDate()}`
    const future = d > today, isToday = d.getTime() === today.getTime()
    const stamped = !future && !missed.has(key)
    const tilt = ((i * 37) % 13) - 6
    cells.push(`<span class="sbook__stamp${future ? ' sbook__stamp--future' : stamped ? '' : ' sbook__stamp--missed'}${isToday ? ' sbook__stamp--today' : ''}" style="--stamp-tilt: ${stamped ? tilt : 0}deg">${d.getDate()}</span>`)
  }
  return `<section class="sbook">
  <div class="sbook__month"><span class="sbook__month-jp" style="letter-spacing: 0;">Stamp book</span><span class="fig__l">September 2026</span></div>
  <div class="sbook__dows">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="sbook__dow">${d}</span>`).join('')}</div>
  <div class="sbook__grid">${cells.join('')}</div>
  <div class="sbook__side">
    <div class="sbook__figs">
      <div class="fig"><span class="fig__v">3<span class="fig__u">days</span></span><span class="fig__l">Current streak</span></div>
      <div class="fig"><span class="fig__v">21<span class="fig__u">days</span></span><span class="fig__l">Longest</span></div>
      <div class="fig"><span class="fig__v">32<span class="fig__u">/ 34</span></span><span class="fig__l">Stamped</span></div>
    </div>
  </div>
</section>`
}
const PROFILE_BODY = `
${hud()}
<main class="phone__content">
  ${pass({ footer: jourLine('onTime') + rideLine() })}
  ${stampBook()}
</main>
${tabbar('profile', 24)}`

const ledgerLine = ({ code, color, title, done, total }) => `<button type="button" class="pf-line" style="--line-color: ${color}">
  <span class="pf-line__id"><span class="pf-line__roundel">${code}</span><span class="pf-line__names"><span class="pf-line__jp">${title}</span></span></span>
  <span class="pf-line__fig">${done.toLocaleString('en')}<span class="pf-line__of">/ ${total.toLocaleString('en')}</span></span>
  <span class="pf-line__track"><span class="pf-line__done" style="width: ${Math.round(100 * done / total)}%"></span></span>
</button>`
const lb = ({ rank, name, xp, me = false }) => `<div class="leaderboard-row${me ? ' leaderboard-row--me' : ''}">
  <span class="leaderboard-row__rank${rank === 1 ? ' leaderboard-row__rank--gold' : rank === 2 ? ' leaderboard-row__rank--silver' : rank === 3 ? ' leaderboard-row__rank--bronze' : ''}">${rank}</span>
  <span class="leaderboard-row__name">${name}</span>
  <span class="leaderboard-row__xp">${xp.toLocaleString('en')} XP</span>
</div>`
const PROFILE2_BODY = `
${hud()}
<main class="phone__content">
  <div class="records">
    <div class="record"><span class="record__value">842</span><span class="record__label">Reviews</span></div>
    <div class="record"><span class="record__value">91<span class="record__unit">%</span></span><span class="record__label">Retention</span></div>
    <div class="record"><span class="record__value">12<span class="record__unit">in a row</span></span><span class="record__label">Best perfect run</span></div>
    <button type="button" class="record record--door" style="--line-color: var(--accent8)">
      <span class="pf-line__id"><span class="pf-line__roundel">TO</span><span class="pf-line__names"><span class="pf-line__jp">Statistics</span></span></span>
      ${I.chevR}
    </button>
  </div>
  <div class="pf-ledger">
    ${ledgerLine({ code: 'KN', color: 'var(--line-kana)',    title: 'Kana',       done: 104,  total: 104 })}
    ${ledgerLine({ code: 'TG', color: 'var(--line-vocab)',   title: 'Vocabulary', done: 1318, total: 6000 })}
    ${ledgerLine({ code: 'KJ', color: 'var(--line-kanji)',   title: 'Kanji',      done: 224,  total: 2136 })}
    ${ledgerLine({ code: 'BP', color: 'var(--line-grammar)', title: 'Grammar',    done: 96,   total: 604 })}
  </div>
  <div class="banzuke">
    <div class="bz__head">
      <span class="bz__mark"><span class="bz__jp">Ranking</span></span>
      <span class="seg"><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-jp">This week</span></button><button type="button" class="seg__opt"><span class="seg__opt-jp">All time</span></button></span>
    </div>
    ${lb({ rank: 1, name: 'Mei',    xp: 1240 })}
    ${lb({ rank: 2, name: 'Haruto', xp: 1180 })}
    ${lb({ rank: 3, name: 'Aiko',   xp: 960, me: true })}
    ${lb({ rank: 4, name: 'Sora',   xp: 720 })}
    ${lb({ rank: 5, name: 'Kenji',  xp: 610 })}
  </div>
</main>
${tabbar('profile', 24)}`

// ── 11 · The status sheet: the pass turned over, opened from the HUD ──
const STATUS_BODY = `
${TODAY_BODY({ hud: { st: 'slightlyBehind' } })}
<div class="scrim"></div>
<div class="sheet sheet--sumi jour-st--slightlyBehind">
  <span class="sheet__handle"></span>
  <div class="jour-rev__head">${status('slightlyBehind')}</div>
  <div class="jour-track">
    <span class="jour-track__span">
      <span class="jour-track__rail"></span>
      <span class="jour-track__done" style="width: 62%"></span>
      <span class="jour-track__station jour-track__station--past" style="left: 0%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N5</span></span>
      <span class="jour-track__station jour-track__station--past" style="left: 50%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N4</span></span>
      <span class="jour-track__station" style="left: 100%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N3</span></span>
      <span class="jour-track__you" style="left: 62%"><span class="jour-track__tag">You</span><i></i></span>
      <span class="jour-track__plan" style="left: 70%"><i></i><span class="jour-track__tag">Plan</span></span>
      <span class="jour-track__gap" style="left: 62%; width: 8%"><b>9d</b></span>
    </span>
  </div>
  <div class="jour-figs">
    <div class="jour-fig"><span class="jour-fig__v">7.1<span class="jour-fig__u">/ day</span></span><span class="jour-fig__l">Last 14 days</span></div>
    <div class="jour-fig"><span class="jour-fig__v">10<span class="jour-fig__u">/ day</span></span><span class="jour-fig__l">Promised</span></div>
    <div class="jour-fig"><span class="jour-fig__v jour-fig__v--st">23 Mar</span><span class="jour-fig__l">At this pace</span></div>
    <div class="jour-fig"><span class="jour-fig__v">14 Mar</span><span class="jour-fig__l">On the pass</span></div>
  </div>
  <div class="jour-rev__actions">
    <button type="button" class="jour-act"><strong>Run 15 a day</strong>keeps 14 Mar</button>
    <button type="button" class="jour-act"><strong>Reprint at 7.1 a day</strong>arrive 23 Mar</button>
  </div>
</div>`

// ── 12 · The balance sheet: the commuter pass, opened from the HUD ──
const CREDITS_BODY = `
${TODAY_BODY()}
<div class="scrim"></div>
<div class="sheet">
  <span class="sheet__handle"></span>
  <div class="sheet__head"><span class="sheet__jp">Balance</span><span class="sheet__cap" style="margin-left:auto;">1 credit = 1 review</span></div>
  <div class="balance">
    <span class="balance__fig">30<span class="balance__unit">credits</span></span>
    <span class="balance__of"><span>of 50</span><span style="font-weight:600;">24 due today</span></span>
  </div>
  <div class="balance__track"><span class="balance__fill" style="width: 60%"></span></div>
  <div class="balance__rows">
    <div class="balance__cell"><b>+30<span>daily</span></b><span class="cap">Refill at 00:00</span></div>
    <div class="balance__cell"><b>50<span>cap</span></b><span class="cap">Holds up to</span></div>
  </div>
  <div class="offer">
    <div class="offer__head">
      <span class="offer__names"><span class="offer__jp">Unlimited pass</span><span class="offer__cap">Subscription</span></span>
      <span class="pass__issuer" style="border-style: double; border-width: 3px;">∞</span>
    </div>
    <p class="offer__body">Every review, every day. <b>No balance to watch</b> — the gate opens as long as the pass is valid.</p>
    <span class="offer__price">[PRICE]<small>/ month</small></span>
    ${departBtn('Go unlimited', ' btn-depart--sheet').replace('class="btn-depart btn-depart--sheet"', 'class="btn-depart btn-depart--sheet" style="width: 100%;"')}
  </div>
</div>`

// ── 13 · Chrome — the HUD and the tab bar, every state, on one sheet ──
const hudStrip = (opts) => `<div class="spec__strip">${hud(opts)}</div>`
const CHROME_BODY = `
<div class="spec">
  <div class="spec__row">
    <div class="spec__item" style="gap: var(--sp-4);">
      <span class="spec__label">The HUD — level · station panel · commuter pass</span>
      ${hudStrip({ st: 'ahead', cr: 30 })}
      ${hudStrip({ st: 'onTime', cr: 30, gain: 4 })}
      ${hudStrip({ st: 'slightlyBehind', cr: 3 })}
      ${hudStrip({ st: 'delayed', cr: 0 })}
      ${hudStrip({ st: 'suspended', cr: 'pass' })}
    </div>
    <div class="spec__item">
      <span class="spec__label">Reading the bar</span>
      <p class="spec__note"><b>Level</b> — the roundel the top bar already has (<code>.topbar-profile-ring</code>, its XP arc long retired): a pass-ink ring with the figure inside, the fare (+4xp) rising off it in gold. Tap → the pass.</p>
      <p class="spec__note"><b>Goal status</b> — a station panel: the journey model's state in the learner's own language, with the drift in days beside it (AHEAD · 9d, ON TIME, LATE · 9d; SUSPENDED after 14 days without study). Its inks: <code>--success</code>, <code>--warning</code>, <code>--danger</code>. Tap → the pass turns over (the status sheet).</p>
      <p class="spec__note"><b>Balance</b> — the commuter pass itself at pocket size (<code>.ic-card</code>'s gradient and contactless mark), the balance printed inside: 30/50 on a free pass, the cap being the card's own, ∞ on a subscription. The figure is gold, the pass's metal, never a line pigment; the card's edge goes warning at ≤5 and danger at 0. Tap → the balance sheet.</p>
      <p class="spec__note">Sumi, two registers of ink, no line colour. The band above it is the phone's own status bar, left empty on purpose.</p>
    </div>
  </div>
  <div class="spec__row">
    <div class="spec__item" style="gap: var(--sp-4);">
      <span class="spec__label">The tab bar — five gates</span>
      <div class="spec__strip">${tabbar('today', 24)}</div>
      <div class="spec__strip">${tabbar('learn', 24)}</div>
      <div class="spec__strip">${tabbar('profile', 0)}</div>
    </div>
    <div class="spec__item">
      <span class="spec__label">Reading the bar</span>
      <p class="spec__note">The kanji is the icon, the plain word is the label — the only place Japanese stands in for an icon. Active gate: full ink and a 2px rule; the rest in <code>--text-on-panel-soft</code>. The due count rides Today as the map's own <code>.wmap-due</code> chip, set clear of the glyph.</p>
      <p class="spec__note">Learn is the route map (four lines + your decks). Practice holds reading practice · comprehension · translation · mock exam. Dictionary opens the analyzer from the card under its header. Profile is the pass and its inserts.</p>
      <p class="spec__note">During a run the bar leaves with the top bar and the rating bar docks on the same edge — one console at the bottom, the card the only bright thing.</p>
    </div>
  </div>
  <div class="spec__row">
    <div class="spec__item" style="width: 340px;"><span class="spec__label">Fare gate · due, fare covered</span>${gateCard()}</div>
    <div class="spec__item" style="width: 340px;"><span class="spec__label">Fare gate · short of credits</span>${gateCard({ total: 42, balance: 30 })}</div>
    <div class="spec__item" style="width: 340px;"><span class="spec__label">Fare gate · clear</span>${gateClear()}<p class="spec__note" style="margin-top: var(--sp-3);">Lanes are the run's picker: each row toggles, the fare counts the rows that are on. 1 credit = 1 review; a run longer than the balance stops at the balance and says so before departure.</p></div>
  </div>
</div>`

// ── write everything ──
const boards = [
  ['Main',           TODAY_BODY(),   "Today's run",              'today'],
  ['Run',            RUN_BODY,       'In a run',                 'today'],
  ['RunComplete',    COMPLETE_BODY,  'Run complete',             'today'],
  ['Learning',       LEARN_BODY,     'Learn · route map',        'learn'],
  ['Station',        STATION_BODY,   'Station · Kanji levels',   'learn'],
  ['Platforms',      MODES_BODY,     'Platforms · Kanji N4',     'learn'],
  ['Practice',       PRACTICE_BODY,  'Practice',                 'practice'],
  ['Dictionary',     DICT_BODY,      'Dictionary',               'dict'],
  ['Analyzer',       ANL_BODY,       'Analyzer',                 'dict'],
  ['Profile',        PROFILE_BODY,   'Profile · the pass',       'pass'],
  ['ProfileInserts', PROFILE2_BODY,  'Profile · inserts',        'pass'],
  ['StatusSheet',    STATUS_BODY,    'Goal status sheet',        'pass'],
  ['BalanceSheet',   CREDITS_BODY,   'Balance sheet',            'pass'],
  ...SCREENS2,
  ...SCREENS3({ TODAY_BODY, RUN_BODY, gateCard, ANL_DOOR, intakeSeg }),
]
for (const [name, body] of boards) writeFileSync(`${name}.dc.html`, artboard(body))
writeFileSync('Chrome.dc.html', artboard(CHROME_BODY, { width: 1180, height: 1320, phone: false }))
writeFileSync('States.dc.html', artboard(STATES_BODY, { width: 1180, height: 880, phone: false }))

const ORDER = {
  today:    ['Main', 'TodayOutOfCredits', 'Run', 'RunFlashcard', 'RunCloze', 'RunDraw', 'RunReadings', 'RunBrowse', 'LevelUp', 'Reissue', 'RunOutOfCredits', 'RunComplete'],
  learn:    ['Learning', 'Station', 'StationTiers', 'Platforms', 'Decks', 'DeckCreate', 'DeckDetail', 'DeckAddCard'],
  practice: ['Practice', 'Reading', 'Comprehension', 'ComprehensionResult', 'TranslationWrite', 'Translation', 'ExamPapers', 'ExamRunner', 'ConfirmSheet', 'ExamResult'],
  dict:     ['Dictionary', 'DictionaryEntry', 'DictionaryReadings', 'Analyzer', 'AnalyzerPhoto', 'AnalyzerVideo', 'AnalyzerResult', 'DeckPickerSheet'],
  pass:     ['Profile', 'ProfileInserts', 'StatusSheet', 'BalanceSheet', 'Statistics', 'Settings', 'SettingsLearn', 'SettingsDestination'],
  arrival:  ['SignIn'],
}
const PAGES = [
  { id: 'today',    name: 'Today' },
  { id: 'learn',    name: 'Learn' },
  { id: 'practice', name: 'Practice' },
  { id: 'dict',     name: 'Dictionary' },
  { id: 'pass',     name: 'Profile' },
  { id: 'arrival',  name: 'Sign in' },
  { id: 'chrome',   name: 'Chrome' },
]
const W = 390, H = 844, GX = 80
const byName = Object.fromEntries(boards.map(b => [b[0], b]))
const artboards = []
for (const [page, names] of Object.entries(ORDER)) {
  names.forEach((name, i) => {
    const b = byName[name]; if (!b) throw new Error('unknown board ' + name)
    artboards.push({ file: `${name}.dc.html`, title: b[2], x: i * (W + GX), y: 0, w: W, h: H, page })
  })
}
const placed = new Set(artboards.map(a => a.file))
for (const b of boards) if (!placed.has(`${b[0]}.dc.html`)) throw new Error('unplaced board ' + b[0])
artboards.push({ file: 'Chrome.dc.html', title: 'Chrome · HUD, tab bar, gate', x: 0, y: 0, w: 1180, h: 1320, page: 'chrome' })
artboards.push({ file: 'States.dc.html', title: 'States · loading, empty, error, wrong, six grades', x: 1260, y: 0, w: 1180, h: 880, page: 'chrome' })

const canvas = {
  pages: PAGES,
  artboards,
  annotations: [
    { id: 'backbone', page: 'today', x: -300, y: 0, w: 260, text: 'Mobile backbone\n\nTop: level · station panel · commuter pass (the HUD).\nBottom: Learn · Practice · Today · Dictionary · Profile.\n\nOne page per tab, the screens in walking order. The interface speaks English; Japanese is content only (a word, a sentence, a deck\'s name, a rank) and the tab bar\'s icons.\n\nEvery artboard has a dark / light tweak.' },
    { id: 'credits', page: 'today', x: -300, y: 420, w: 260, text: 'Balance system, as drawn\n\n1 credit = 1 review. Free: +30 a day at 00:00, holds up to 50. Subscription: the unlimited pass.\n\nThe gate prices the run (fare) against the balance before departure; a run longer than the balance stops at the balance and says so.\n\nAssumed: practice, the dictionary and the analyzer do not spend credits.' },
    { id: 'sessions', page: 'practice', x: -300, y: 0, w: 260, text: 'Sessions behave like a run: both bars leave, ‹ Practice is the way out, the field or the rating bar docks on the bottom edge. Practice does not spend credits.' },
    { id: 'dict-note', page: 'dict', x: -300, y: 0, w: 260, text: 'The dictionary follows the 2026-09-05 rework: catalogue cards carry the stage word; an entry opens as the catalogue plate at reading size, with two readings and a door to the readings sheet; the body is blocks divided by hairlines, no headings.' },
    { id: 'chrome-note', page: 'chrome', x: 0, y: -110, w: 420, text: 'Every value on this sheet is a :root token or a literal index.css already uses. Class names mirror index.css where the object exists (.pass, .board, .wmap-*, .gate-card, .btn-depart, .jour-*, .stamp-rally, .dict-*); .hud, .tabbar, .bar, .lane, .console, .chip, .route, .stage and .sheet are new to the mockup — see docs/design/mobile/README.md.' },
  ],
  launch: { view: 'canvas', page: 'today' },
}
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2))
console.log('built', boards.length + 2, 'artboards')
