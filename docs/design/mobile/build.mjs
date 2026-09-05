import { writeFileSync } from 'node:fs'
import { artboard, hud, tabbar, plate, clock, track, due, rally, pace, jourLine, pass, credits, status, I, STATUS } from './parts.mjs'

// ── sample data, shared by every screen ──
const LANES = [
  { color: 'var(--line-kanji)',   where: '漢字 N4', mode: 'Kanji → meaning', due: 9 },
  { color: 'var(--line-vocab)',   where: '単語 N5', mode: 'Word → meaning',  due: 8 },
  { color: 'var(--line-grammar)', where: '文法 N4', mode: 'Rule → meaning',  due: 5 },
  { color: 'var(--line-decks)',   where: '旅行',    mode: 'Study · my deck', due: 2 },
]
const lane = (l, on = true) => `<button type="button" class="lane${on ? '' : ' lane--off'}" style="--lane-color: ${l.color}">
  <span class="lane__tick">${on ? I.check : ''}</span>
  <span class="lane__where" lang="ja">${l.where}</span>
  <span class="lane__mode">${l.mode}</span>
  <span class="lane__due">${l.due}</span>
</button>`

const gateCard = ({ total = 24, balance = 30, lanes = LANES } = {}) => {
  const short = total > balance
  return `<div class="gate-card">
  <div class="gate-card__head">
    <span class="gate-card__name"><span class="gate-card__jp" lang="ja">改札</span><span class="gate-card__latin">Fare gate</span></span>
    <span class="gate-card__figure"><span class="gate-card__count">${total}</span><span class="gate-card__unit" lang="ja">件</span></span>
  </div>
  <div class="gate-card__lanes">${lanes.map(l => lane(l)).join('')}</div>
  <div class="gate-card__fare">
    <span lang="ja">運賃</span><b>${Math.min(total, balance)}</b><span>credits</span>
    <span class="gate-card__fare-sep"></span>
    <span lang="ja">残高</span><b class="fare-gold">${balance}</b>
  </div>
  ${short ? `<div class="gate-card__short">${I.warn}<span><b>${balance}</b> of ${total} run today — ${total - balance} wait for tomorrow's refill</span></div>` : ''}
  <button type="button" class="btn-depart"><span class="btn-depart__jp" lang="ja">出発する</span><span class="btn-depart__latin">Depart</span><span class="btn-depart__go">▶</span></button>
</div>`
}
const gateClear = () => `<div class="gate-card" style="gap: var(--sp-3);">
  <div class="gate-card__head">
    <span class="gate-card__name"><span class="gate-card__jp" lang="ja">改札</span><span class="gate-card__latin">Fare gate</span></span>
  </div>
  <span class="gate-card__clear">All clear</span>
  <span class="gate-card__when">Next review in 3 hours.</span>
</div>`

const strip = () => `<div class="pass pass--strip">${rally()}${pace()}</div>`

const dateAside = `<span style="display:flex;flex-direction:column;align-items:flex-end;"><span lang="ja" style="font-family:var(--font-jp);font-weight:700;font-size:var(--fs-sm);">土曜日</span><span class="cap">5 Sep</span></span>`

// ── 1 · Today's run — the home tab, the fare gate ──
const TODAY_BODY = (opts = {}) => `
${hud(opts.hud)}
<main class="phone__content">
  ${plate({ code: 'HN', kana: 'ほんじつ', name: '本日', latin: "Today's run", color: 'var(--accent2)', extra: dateAside })}
  ${gateCard(opts.gate)}
  ${strip()}
</main>
${tabbar('today', 24)}`

// ── 2 · In a run — the study stage, chrome hidden, rating bar docked ──
const RUN_BODY = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-kanji);">
  <div class="stage__head">
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">改札</span></button>
    <span class="stage__where"><span class="stage__where-jp" lang="ja">漢字 N4</span><span class="stage__where-latin">Kanji → meaning</span></span>
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
    <div class="prompt-card__foot"><span lang="ja">N4 漢字</span><span>Kanji → meaning</span></div>
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
  ${plate({ code: 'HN', kana: 'ほんじつ', name: '本日', latin: "Today's run", color: 'var(--accent2)', extra: dateAside })}
  <div class="today-clear">
    <div class="today-clear__mark" lang="ja">完了</div>
    <p class="today-clear__title">Run complete</p>
    <p class="today-clear__body">24 reviews cleared. Nothing else is due.</p>
    <p class="today-clear__next">Next review in 3 hours.</p>
    <div class="fare-slip">
      <div class="fare-slip__cell"><span class="fare-slip__v">24</span><span class="cap">reviews</span></div>
      <div class="fare-slip__cell"><span class="fare-slip__v">+96<span class="fare-slip__u">xp</span></span><span class="cap">fare</span></div>
      <div class="fare-slip__cell"><span class="fare-slip__v fare-slip__v--gold">6</span><span class="cap">credits left</span></div>
    </div>
    <button type="button" class="btn-depart btn-depart--ghost" style="width: 100%; margin-top: var(--sp-3);"><span class="btn-depart__jp" lang="ja">駅に戻る</span><span class="btn-depart__latin">Back to the station</span></button>
  </div>
</main>
${tabbar('today', 0)}`

// ── 4 · Learning — the route map, four lines and your own decks ──
const line = ({ code, color, jp, latin, stops, travelled, n, on = false }) => `<button type="button" class="wmap-line${on ? ' wmap-line--on' : ''}" style="--line-color: ${color}">
  <span class="wmap-line__id">
    <span class="wmap-roundel">${code}</span>
    <span class="wmap-line__names"><span class="wmap-line__jp" lang="ja">${jp}<span class="wmap-line__sen" lang="ja">線</span></span><span class="wmap-line__latin">${latin}</span></span>
  </span>
  <span class="wmap-line__due">${due(n)}</span>
  ${track(stops, travelled)}
</button>`
const LEARN_BODY = `
${hud()}
<main class="phone__content">
  <div class="board">
    <div class="board__masthead">
      <span class="board__station">
        <span class="board__roundel">JP</span>
        <span class="board__station-names"><span class="board__kana" lang="ja">にほんご</span><h1 class="board__name" lang="ja">日本語</h1><span class="board__romaji">Nihongo</span></span>
      </span>
      <span class="board__now">
        <span class="board__label"><span lang="ja">路線図</span><span class="board__label-sub">Route map</span></span>
        ${clock()}
      </span>
    </div>
    <div class="board__stripe"></div>
    <div class="wmap__lines">
      ${line({ code: 'KN', color: 'var(--line-kana)',    jp: 'あ',   latin: 'Kana',            stops: ['あ', 'きゃ', 'ア', 'キャ'],   travelled: 4,   n: 0 })}
      ${line({ code: 'TG', color: 'var(--line-vocab)',   jp: '単語', latin: 'Vocabulary JLPT', stops: ['N5', 'N4', 'N3', 'N2', 'N1'], travelled: 1.6, n: 8 })}
      ${line({ code: 'KJ', color: 'var(--line-kanji)',   jp: '漢字', latin: 'Kanji',           stops: ['N5', 'N4', 'N3', 'N2', 'N1'], travelled: 1.3, n: 9 })}
      ${line({ code: 'BP', color: 'var(--line-grammar)', jp: '文法', latin: 'Grammar',         stops: ['N5', 'N4', 'N3', 'N2', 'N1'], travelled: 1.2, n: 5 })}
    </div>
    <div class="wmap__group">
      <div class="wmap__caption"><span class="wmap__caption-jp" lang="ja">教材</span><span class="wmap__caption-latin">Your own decks</span></div>
      <button type="button" class="wmap-row" style="--line-color: var(--line-decks)">
        <span class="wmap-roundel">KZ</span>
        <span class="wmap-row__names"><span class="wmap-row__jp" lang="ja">教材<span class="wmap-line__sen" lang="ja">行</span></span><span class="wmap-row__latin">My decks</span></span>
        <span class="wmap-row__note">3 decks · 214 cards ${due(2)}</span>
        <span class="wmap-row__go">▶</span>
      </button>
    </div>
  </div>
</main>
${tabbar('learn', 24)}`

// ── 5 · A station: 漢字, the level line ──
const stop = ({ code, jp, hint, state, done, total }) => `<button type="button" class="route-stop${state ? ` route-stop--${state}` : ''}">
  <span class="route-stop__code">${code}</span>
  <span class="route-stop__names"><span class="route-stop__jp" lang="ja">${jp}</span><span class="route-stop__hint">${state === 'current' ? '<span class="route-stop__here">You are here</span> · ' : ''}${hint}</span></span>
  <span class="route-stop__fig"><b>${done}</b>/ ${total}</span>
  <span class="route-stop__go">▶</span>
</button>`
const STATION_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kanji);">
  ${plate({ code: 'KJ', kana: 'かんじ', name: '漢字', latin: 'Kanji', color: 'var(--line-kanji)', noriba: 5 })}
  <div class="route">
    <span class="route__done" style="height: 64px;"></span>
    ${stop({ code: 'N5', jp: '入門', hint: 'Beginner level',     state: 'past',    done: 103, total: 103 })}
    ${stop({ code: 'N4', jp: '基礎', hint: 'Elementary level',   state: 'current', done: 121, total: 181 })}
    ${stop({ code: 'N3', jp: '日常', hint: 'Intermediate level', state: '',        done: 0,   total: 367 })}
    ${stop({ code: 'N2', jp: '実務', hint: 'Advanced level',     state: '',        done: 0,   total: 415 })}
    ${stop({ code: 'N1', jp: '終着', hint: 'Proficiency level',  state: '',        done: 0,   total: 1070 })}
  </div>
  <div style="display:flex;justify-content:space-between;gap:var(--sp-4);padding: 0 var(--sp-1);">
    <span class="cap"><span lang="ja" style="letter-spacing:var(--tr-term);text-transform:none;">出典</span> · JLPT</span>
    <button type="button" class="cap" style="text-decoration: underline; text-underline-offset: 3px;">Word frequency instead</button>
  </div>
</main>
${tabbar('learn', 24)}`

// ── 6 · A platform list: 漢字 N4, the modes on the 種別 ladder ──
const pips = n => `<span class="platform-card__stops">${[1, 2, 3, 4].map(i => `<span class="platform-card__pip${i <= n ? ' platform-card__pip--on' : ''}"></span>`).join('')}</span>`
const mode = ({ svc, jp, stops, title, desc }) => `<button type="button" class="platform-card platform-card--${svc}">
  <span class="platform-card__lead"><span class="platform-card__service" lang="ja">${jp}</span>${stops ? pips(stops) : ''}</span>
  <span class="platform-card__body"><span class="platform-card__title">${title}</span><span class="platform-card__desc">${desc}</span></span>
  <span class="platform-card__go">▶</span>
</button>`
const MODES_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kanji); gap: var(--sp-5);">
  ${plate({ code: 'KJ', kana: 'かんじ', name: '漢字', latin: 'Kanji', color: 'var(--line-kanji)', noriba: 6 })}
  <div style="display:flex;align-items:center;gap:var(--sp-3);">
    <button type="button" class="stage__leave">${I.chevL}<span>N4</span><span lang="ja">基礎</span></button>
    <span class="cap">Elementary · 121 of 181 met</span>
  </div>
  <div class="platform-grid">
    ${mode({ svc: 'rapid',   jp: '快速', stops: 3, title: 'Kanji → meaning', desc: 'The kanji is shown. Recall what it means.' })}
    ${mode({ svc: 'express', jp: '急行', stops: 2, title: 'Meaning → kanji', desc: 'The meaning is given. Recall the kanji.' })}
    ${mode({ svc: 'ltd',     jp: '特急', stops: 1, title: 'Draw the kanji',  desc: 'The meaning is given. Draw the kanji by hand.' })}
    ${mode({ svc: 'express', jp: '急行', stops: 2, title: 'Readings',        desc: "The kanji is shown. Type its on'yomi and kun'yomi." })}
    ${mode({ svc: 'rapid',   jp: '快速', stops: 3, title: 'Radical',         desc: 'The kanji is shown. Recall which radical it is built on.' })}
    ${mode({ svc: 'review',  jp: '復習', stops: 0, title: 'Fast review',     desc: 'Flip through what you have already studied. Nothing is graded.' })}
  </div>
</main>
${tabbar('learn', 24)}`

// ── 7 · Practice — 実践, four platforms ──
const practice = ({ n, color, jp, title, desc }) => `<button type="button" class="platform-card platform-card--line" style="--line-color: ${color}">
  <span class="platform-card__lead"><span class="platform-card__no">${n}</span><span class="platform-card__unit" lang="ja">番線</span></span>
  <span class="platform-card__body"><span class="platform-card__title">${title}<span class="platform-card__title-jp" lang="ja">${jp}</span></span><span class="platform-card__desc">${desc}</span></span>
  <span class="platform-card__go">▶</span>
</button>`
const PRACTICE_BODY = `
${hud()}
<main class="phone__content">
  ${plate({ code: '', kana: 'じっせん', name: '実践', latin: 'Practice', color: 'var(--accent2)', noriba: 4, register: true })}
  <div class="platform-grid">
    ${practice({ n: 1, color: 'var(--line-reading)', jp: '読書', title: 'Reading practice',      desc: 'Real sentences, pitched at your level.<br>Read first, check after.' })}
    ${practice({ n: 2, color: 'var(--line-rikai)',   jp: '理解', title: 'Reading comprehension', desc: 'Short passages, then questions.<br>The reading half of the exam, rehearsed.' })}
    ${practice({ n: 3, color: 'var(--line-honyaku)', jp: '翻訳', title: 'Translation',           desc: 'Put it into Japanese yourself.<br>A reference answer, and a read on yours.' })}
    ${practice({ n: 4, color: 'var(--line-exam)',    jp: '模試', title: 'Mock exam',             desc: 'Full-length practice exams, timed and scored.<br>Built to the official JLPT format.' })}
  </div>
</main>
${tabbar('practice', 24)}`

// ── 8 · Dictionary — the console, with the analyzer as its one action ──
const entry = ({ reading, word, gloss, lvl, seal }) => `<button type="button" class="dict-entry">
  <span class="dict-entry__stack">
    <span class="dict-entry__reading" lang="ja">${reading}</span>
    <span class="dict-entry__head"><span class="dict-entry__word" lang="ja">${word}</span><span class="dict-entry__gloss">${gloss}</span></span>
  </span>
  <span class="lvl">${lvl}</span>
  ${seal ? `<span class="seal seal--${seal}" lang="ja">${{ new: '新', learning: '習', mastered: '極' }[seal]}</span>` : '<span style="width:26px;flex:none;"></span>'}
</button>`
const DICT_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-jisho); gap: var(--sp-5);">
  ${plate({ code: 'JS', kana: 'じしょ', name: '辞書', latin: 'Dictionary', color: 'var(--line-jisho)' })}
  <button type="button" class="anl-door">
    <span class="wmap-roundel" style="--line-color: var(--line-kaiseki); color: color-mix(in srgb, var(--line-kaiseki) 60%, var(--text-primary));">KS</span>
    <span class="anl-door__names"><span class="anl-door__title">Analyzer<span lang="ja">解析</span></span></span>
    <span class="anl-door__intakes"><span class="anl-door__intake">${I.text}</span><span class="anl-door__intake">${I.camera}</span><span class="anl-door__intake">${I.video}</span></span>
  </button>
  <div class="console">
    <div class="console__top">
      <div class="console__chips">
        <button type="button" class="chip chip--on" style="--tab-color: var(--line-kanji)"><span class="chip__glyph" lang="ja">漢</span>Kanji</button>
        <button type="button" class="chip" style="--tab-color: var(--line-vocab)"><span class="chip__glyph" lang="ja">語</span>Vocab</button>
        <button type="button" class="chip" style="--tab-color: var(--line-kana)"><span class="chip__glyph" lang="ja">あ</span>Kana</button>
        <button type="button" class="chip" style="--tab-color: var(--line-jisho)"><span class="chip__glyph" lang="ja">辞</span>JMdict</button>
      </div>
    </div>
    <div class="console__index">${I.search}<span class="console__field console__field--filled">san</span><button type="button" style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:color-mix(in srgb, var(--text-primary) 8%, transparent);color:var(--text-secondary);align-items:center;justify-content:center;padding:0;">${I.cross.replace('class="svg"', 'class="svg" style="width:12px;height:12px;"')}</button><span class="console__count">128 results</span></div>
  </div>
  <div class="dict-list">
    ${entry({ reading: 'サン・みっ(つ)', word: '三',   gloss: 'three',               lvl: 'N5', seal: 'mastered' })}
    ${entry({ reading: 'サン・やま',     word: '山',   gloss: 'mountain',            lvl: 'N5', seal: 'learning' })}
    ${entry({ reading: 'さんぽ',         word: '散歩', gloss: 'walk, stroll',        lvl: 'N4', seal: 'learning' })}
    ${entry({ reading: 'さんか',         word: '参加', gloss: 'participation',       lvl: 'N3', seal: 'new' })}
    ${entry({ reading: 'さんせい',       word: '賛成', gloss: 'approval, agreement', lvl: 'N2', seal: 'new' })}
    ${entry({ reading: 'さんぎょう',     word: '産業', gloss: 'industry',            lvl: 'N2', seal: '' })}
  </div>
</main>
${tabbar('dict', 24)}`

// ── 9 · Analyzer — the concourse: three platforms and the history (Latin-first by ruling) ──
const anl = ({ n, icon, title, jp, desc, count, last }) => `<button type="button" class="anl-card">
  <span class="anl-card__lead"><span class="platform-card__no" style="--rail: var(--line-kaiseki); width: 34px; height: 34px; font-size: 0.9rem;">${n}</span></span>
  <span class="anl-card__body"><span class="anl-card__title">${title}<span lang="ja">${jp}</span></span><span class="anl-card__desc">${desc}</span></span>
  <span class="anl-card__aside"><span class="anl-fig"><b>${count}</b><span>Passages</span></span><span class="anl-fig"><b>${last}</b><span>Last used</span></span></span>
</button>`
const hist = ({ jp, count, when, kept }) => `<button type="button" class="anl-hist">
  <span class="anl-hist__body"><span class="anl-hist__jp" lang="ja">${jp}</span><span class="anl-hist__meta">${kept ? '<span class="anl-kept" lang="ja">保存</span>' : ''}<span>${count}</span><span>${when}</span></span></span>
  <span class="platform-card__go" style="--rail: var(--line-kaiseki); padding-right: 0;">▶</span>
</button>`
const ANL_BODY = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki); gap: var(--sp-5);">
  ${plate({ code: 'KS', kana: 'かいせき', name: '解析', latin: 'Analyzer', color: 'var(--line-kaiseki)', noriba: 3 })}
  <div class="seg seg--full seg--kaiseki">
    <button type="button" class="seg__opt seg__opt--on">${I.text}<span class="seg__opt-latin">Text</span></button>
    <button type="button" class="seg__opt">${I.camera}<span class="seg__opt-latin">Photo</span></button>
    <button type="button" class="seg__opt">${I.video}<span class="seg__opt-latin">Video</span></button>
  </div>
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
  <span class="jour-line__status"><b lang="ja" style="color: var(--text-on-panel);">残高</b><span class="jour-cap">Balance</span></span>
  <span class="jour-line__validity"><b>30</b><span class="jour-cap">/ 50 credits</span></span>
  <span class="jour-cap" style="margin-left: auto; letter-spacing: 0.08em; text-transform: none;">+30 at 00:00</span>
</div>`
function stampBook() {
  const start = new Date(2026, 7, 3) // Mon 3 Aug → Sun 6 Sep, five weeks
  const today = new Date(2026, 8, 5)
  const missed = new Set(['8-22', '9-2']) // a 21-day run to 21 Aug (its start before the sheet), ten days, then the current three
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
  <div class="sbook__dows">${['月', '火', '水', '木', '金', '土', '日'].map(d => `<span class="sbook__dow" lang="ja">${d}</span>`).join('')}</div>
  <div class="sbook__grid">${cells.join('')}</div>
  <div class="sbook__side">
    <div class="sbook__month"><span class="sbook__month-jp" lang="ja">九月</span><span class="fig__l">2026</span></div>
    <div class="sbook__figs">
      <div class="fig"><span class="fig__v">3<span class="fig__u" lang="ja">日</span></span><span class="fig__l">Current streak</span></div>
      <div class="fig"><span class="fig__v">21<span class="fig__u" lang="ja">日</span></span><span class="fig__l">Longest streak</span></div>
      <div class="fig"><span class="fig__v">32<span class="fig__u">/ 34</span></span><span class="fig__l">Days stamped</span></div>
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

const ledgerLine = ({ code, color, jp, done, total }) => `<button type="button" class="pf-line" style="--line-color: ${color}">
  <span class="pf-line__id"><span class="pf-line__roundel">${code}</span><span class="pf-line__names"><span class="pf-line__jp" lang="ja">${jp}<span class="pf-line__sen" lang="ja">線</span></span></span></span>
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
      <span class="pf-line__id"><span class="pf-line__roundel">TO</span><span class="pf-line__names"><span class="pf-line__jp" lang="ja">統計</span><span class="pf-cap">Statistics</span></span></span>
      ${I.chevR}
    </button>
  </div>
  <div class="pf-ledger">
    ${ledgerLine({ code: 'KN', color: 'var(--line-kana)',    jp: 'かな', done: 104,  total: 104 })}
    ${ledgerLine({ code: 'TG', color: 'var(--line-vocab)',   jp: '単語', done: 1318, total: 6000 })}
    ${ledgerLine({ code: 'KJ', color: 'var(--line-kanji)',   jp: '漢字', done: 224,  total: 2136 })}
    ${ledgerLine({ code: 'BP', color: 'var(--line-grammar)', jp: '文法', done: 96,   total: 604 })}
  </div>
  <div class="banzuke">
    <div class="bz__head">
      <span class="bz__mark"><span class="bz__jp" lang="ja">番付</span><span class="pf-cap">Ranking</span></span>
      <span class="seg"><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-jp" lang="ja">今週</span></button><button type="button" class="seg__opt"><span class="seg__opt-jp" lang="ja">通算</span></button></span>
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
      <span class="jour-track__done" style="width: 41%"></span>
      <span class="jour-track__station jour-track__station--past" style="left: 0%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N5</span></span>
      <span class="jour-track__station" style="left: 50%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N4</span></span>
      <span class="jour-track__station" style="left: 100%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N3</span></span>
      <span class="jour-track__you" style="left: 41%"><span class="jour-track__tag">You</span><i></i></span>
      <span class="jour-track__plan" style="left: 49%"><i></i><span class="jour-track__tag">Plan</span></span>
      <span class="jour-track__gap" style="left: 41%; width: 8%"><b>9d</b></span>
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
  <div class="sheet__head"><span class="sheet__jp" lang="ja">残高</span><span class="sheet__cap">Balance</span><span class="sheet__cap" style="margin-left:auto;"><span lang="ja" style="text-transform:none;letter-spacing:var(--tr-term);">回数券</span> · 1 credit = 1 review</span></div>
  <div class="balance">
    <span class="balance__fig">30<span class="balance__unit">credits</span></span>
    <span class="balance__of"><span>of 50</span><span style="font-weight:600;">24 due today</span></span>
  </div>
  <div class="balance__track"><span class="balance__fill" style="width: 60%"></span></div>
  <div class="balance__rows">
    <div class="balance__cell"><b>+30<span lang="ja">毎日</span></b><span class="cap">Refill at 00:00</span></div>
    <div class="balance__cell"><b>50<span lang="ja">上限</span></b><span class="cap">Holds up to</span></div>
  </div>
  <div class="offer">
    <div class="offer__head">
      <span class="offer__names"><span class="offer__jp" lang="ja">定期券</span><span class="offer__cap">Unlimited</span></span>
      <span class="pass__issuer" style="border-style: double; border-width: 3px;">∞</span>
    </div>
    <p class="offer__body">Every review, every day. <b>No balance to watch</b> — the gate opens as long as the pass is valid.</p>
    <span class="offer__price">[PRICE]<small>/ month</small></span>
    <div class="offer__head" style="display:block;">
      <button type="button" class="btn-depart btn-depart--sheet" style="width: 100%;"><span class="btn-depart__jp" lang="ja">定期券を買う</span><span class="btn-depart__latin">Go unlimited</span><span class="btn-depart__go">▶</span></button>
    </div>
  </div>
</div>`

// ── 13 · Chrome — the HUD and the tab bar, every state, on one sheet ──
const hudStrip = (opts) => `<div class="spec__strip">${hud(opts)}</div>`
const CHROME_BODY = `
<div class="spec">
  <div class="spec__row">
    <div class="spec__item" style="gap: var(--sp-4);">
      <span class="spec__label">運行案内 · the HUD — level · station panel · commuter pass</span>
      ${hudStrip({ st: 'ahead', cr: 30 })}
      ${hudStrip({ st: 'onTime', cr: 30, gain: 4 })}
      ${hudStrip({ st: 'slightlyBehind', cr: 3 })}
      ${hudStrip({ st: 'delayed', cr: 0 })}
      ${hudStrip({ st: 'suspended', cr: 'pass' })}
    </div>
    <div class="spec__item">
      <span class="spec__label">Reading the bar</span>
      <p class="spec__note"><b>Level</b> — the roundel the top bar already has (<code>.topbar-profile-ring</code>, its XP arc long retired): a pass-ink ring with the figure inside, the fare (+4xp) rising off it in gold. Tap → the pass.</p>
      <p class="spec__note"><b>Goal status</b> — a station panel: the journey model's state in the learner's own language only, with the drift in days beside it (AHEAD · 9d, ON TIME, LATE · 9d; SUSPENDED after 14 days without study). Its inks: <code>--success</code>, <code>--warning</code>, <code>--danger</code>. The Japanese words stay printed on the pass. Tap → the pass turns over (the status sheet).</p>
      <p class="spec__note"><b>Balance</b> — the commuter pass itself at pocket size (<code>.ic-card</code>'s gradient and contactless mark), the balance printed inside: 30/50 on a free pass, the cap being the card's own, ∞ on a subscription. The figure is gold, the pass's metal, never a line pigment; the card's edge goes warning at ≤5 and danger at 0. Tap → the balance sheet.</p>
      <p class="spec__note">Sumi, two registers of ink, no line colour — the station name moved to each screen's own plate.</p>
    </div>
  </div>
  <div class="spec__row">
    <div class="spec__item" style="gap: var(--sp-4);">
      <span class="spec__label">改札口 · the tab bar — five gates</span>
      <div class="spec__strip">${tabbar('today', 24)}</div>
      <div class="spec__strip">${tabbar('learn', 24)}</div>
      <div class="spec__strip">${tabbar('profile', 0)}</div>
    </div>
    <div class="spec__item">
      <span class="spec__label">Reading the bar</span>
      <p class="spec__note">Kanji as the mark, the plain word as its caption — the pairing rule at chip size. Active gate: full ink and a 2px rule; the rest in <code>--text-on-panel-soft</code>. The due count rides 本日 as the map's own <code>.wmap-due</code> chip.</p>
      <p class="spec__note">学習 is the route map (four lines + your decks). 実践 holds 読書 · 理解 · 翻訳 · 模試. 辞書 opens the analyzer from the card under its plate. 定期券 is the pass and its inserts.</p>
      <p class="spec__note">During a run the bar leaves with the top bar and the rating bar docks on the same edge — one console at the bottom, the card the only bright thing.</p>
    </div>
  </div>
  <div class="spec__row">
    <div class="spec__item" style="width: 340px;"><span class="spec__label">改札 · due, fare covered</span>${gateCard()}</div>
    <div class="spec__item" style="width: 340px;"><span class="spec__label">改札 · short of credits</span>${gateCard({ total: 42, balance: 30 })}</div>
    <div class="spec__item" style="width: 340px;"><span class="spec__label">改札 · clear</span>${gateClear()}<p class="spec__note" style="margin-top: var(--sp-3);">Lanes are the run's picker: each row toggles, the fare counts the rows that are on. 1 credit = 1 review; a run longer than the balance stops at the balance and says so before departure.</p></div>
  </div>
</div>`

// ── write everything ──
const boards = [
  ['Main',           TODAY_BODY(),   { title: "Today's run" }],
  ['Run',            RUN_BODY,       { title: 'In a run' }],
  ['RunComplete',    COMPLETE_BODY,  { title: 'Run complete' }],
  ['Learning',       LEARN_BODY,     { title: 'Learning · route map' }],
  ['Station',        STATION_BODY,   { title: 'Station · 漢字 levels' }],
  ['Platforms',      MODES_BODY,     { title: 'Platforms · 漢字 N4 modes' }],
  ['Practice',       PRACTICE_BODY,  { title: 'Practice' }],
  ['Dictionary',     DICT_BODY,      { title: 'Dictionary' }],
  ['Analyzer',       ANL_BODY,       { title: 'Analyzer' }],
  ['Profile',        PROFILE_BODY,   { title: 'Profile · the pass' }],
  ['ProfileInserts', PROFILE2_BODY,  { title: 'Profile · inserts' }],
  ['StatusSheet',    STATUS_BODY,    { title: 'Goal status sheet' }],
  ['BalanceSheet',   CREDITS_BODY,   { title: 'Balance sheet' }],
]
for (const [name, body] of boards) writeFileSync(`${name}.dc.html`, artboard(body))
writeFileSync('Chrome.dc.html', artboard(CHROME_BODY, { width: 1180, height: 1320, phone: false }))

const W = 390, H = 844, GX = 80, GY = 140
const row1 = boards.slice(0, 7), row2 = boards.slice(7)
const place = (list, y) => list.map(([name, , o], i) => ({ file: `${name}.dc.html`, title: o.title, x: i * (W + GX), y, w: W, h: H, page: 'screens' }))
const canvas = {
  pages: [{ id: 'screens', name: 'Screens' }, { id: 'chrome', name: 'Chrome' }],
  artboards: [
    ...place(row1, 0),
    ...place(row2, H + GY),
    { file: 'Chrome.dc.html', title: 'Chrome · HUD, tab bar, gate', x: 0, y: 0, w: 1180, h: 1320, page: 'chrome' },
  ],
  annotations: [
    { id: 'backbone', page: 'screens', x: -300, y: 0, w: 260, text: 'Mobile backbone\n\nTop: level · goal status · credits (the HUD).\nBottom: 学習 Learn · 実践 Practice · 本日 Today · 辞書 Dictionary · 定期券 Profile.\n\nRow 1: the Today tab and a run, then the Learn tab down to a platform list, then Practice.\nRow 2: Dictionary and the analyzer behind it, the Profile in two scrolls, and the two sheets the HUD opens.\n\nEvery artboard has a dark / light tweak.' },
    { id: 'credits', page: 'screens', x: -300, y: H + GY, w: 260, text: 'Balance system, as drawn\n\n1 credit = 1 review. Free: +30 a day at 00:00, holds up to 50. Subscription: 定期券, unlimited.\n\nThe gate prices the run (運賃) against the balance (残高) before departure; a run longer than the balance stops at the balance and says so.\n\nAssumed: practice, the dictionary and the analyzer do not spend credits.' },
    { id: 'chrome-note', page: 'chrome', x: 0, y: -110, w: 420, text: 'Every value on this sheet is a :root token or a literal index.css already uses (the 12px credits pill, the 0.1em map captions). Class names mirror index.css where the object exists (.pass, .board, .wmap-*, .gate-card, .btn-depart, .jour-*, .stamp-rally); .hud, .tabbar, .plate, .lane, .console, .chip, .route, .stage and .sheet are new to the mockup — see docs/design/mobile/README.md.' },
  ],
  launch: { view: 'canvas', page: 'screens' },
}
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2))
console.log('built', boards.length + 1, 'artboards')
