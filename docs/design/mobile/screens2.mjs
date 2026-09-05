// The second wave, English-first: the other card faces, the level board,
// the practice sessions, the exam, decks, stats, settings, sign-in, the
// reworked dictionary entry, the analyzer's stage.
import { hud, tabbar, header, back, I, credits } from './parts.mjs'

export const stageHead = ({ leave = 'Gate', title, latin, right = '' }) => `<div class="stage__head">
    ${back(leave)}
    <span class="stage__where"><h1 class="stage__where-jp">${title}</h1><span class="stage__where-latin">${latin}</span></span>
    ${right}
  </div>`
export const progress = `<div class="deck-progress">
    <span class="deck-progress__segment" style="width: 30%; background: var(--state-new);"></span>
    <span class="deck-progress__segment" style="width: 45%; background: var(--state-learning);"></span>
    <span class="deck-progress__segment" style="width: 25%; background: var(--state-mastered);"></span>
  </div>`
export const ratingBar = (pressed = null, extra = '') => `<div class="rating-bar${extra}"><div class="rating-bar__buttons">
    ${[['q1', 'Wrong'], ['q2', 'Almost'], ['q3', 'Difficult'], ['q4', 'Correct']].map(([q, l]) => `<button type="button" class="rating-bar__btn rating-bar__btn--${q}${pressed === q ? ' rating-bar__btn--pressed' : ''}"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">${l}</span></button>`).join('')}
  </div></div>`
export const runRight = (left = 18, cr = 24) => `<span class="today-remaining">${left}</span>${credits(cr)}`
const stageWrap = (color, inner) => `<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: ${color};">${inner}</main>`

// ── Run · flashcard (vocab, revealed) ──
const RUN_FLASH = stageWrap('var(--line-vocab)', `
  ${stageHead({ title: 'Vocabulary N5', latin: 'Word → meaning', right: runRight(17, 23) })}
  ${progress}
  <div class="study-assist">
    <button type="button" class="study-assist__toggle">${I.plus}Show choices</button>
    <button type="button" class="study-assist__toggle">${I.plus}Show a sentence</button>
  </div>
  <div class="prompt-card">
    <span class="stage-mark stage-mark--new">New</span>
    <span class="reveal-actions"><button type="button">${I.speaker}</button><button type="button">${I.search}</button></span>
    <div class="prompt-card__body flashcard">
      <span class="char-display char-display--word" lang="ja">食べる</span>
      <span class="flashcard-reading" lang="ja">たべる</span>
      <span class="flashcard-answer">to eat</span>
    </div>
    <div class="prompt-card__foot"><span>N5 · Vocabulary</span><span>Word → meaning</span></div>
  </div>
  ${ratingBar()}`)

// ── Run · draw (the drawing quiz, stacked) ──
const RUN_DRAW = stageWrap('var(--line-kanji)', `
  ${stageHead({ title: 'Kanji N4', latin: 'Draw the kanji', right: runRight() })}
  ${progress}
  <div class="prompt-card">
    <span class="stage-mark stage-mark--learning">In progress</span>
    <div class="prompt-card__body" style="gap: var(--sp-4); padding: var(--sp-6) var(--sp-5) var(--sp-5);">
      <div class="draw-prompt"><span class="draw-prompt__meaning">station</span><span class="draw-prompt__hint" lang="ja">エキ</span></div>
      <div class="canvas-wrap"><svg viewBox="0 0 300 300"><path d="M78 96c14-4 28-6 44-6M84 120h40M82 150h44M84 176c10 10 26 20 40 22M180 88c-6 26-18 52-30 66M170 120h80M198 128c0 40-2 86-6 110M210 156c8 10 22 30 30 44" fill="none" stroke="#f3ecdf" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>
      <div class="canvas-label"><span class="cap">Your drawing</span><button type="button" class="canvas-clear-btn">${I.cross}Erase</button></div>
    </div>
    <div class="prompt-card__foot"><span>N4 · Kanji</span><span>Draw the kanji</span></div>
  </div>
  <div class="stage__foot"><button type="button" class="btn-primary" style="width: 100%;">Reveal answer</button></div>`)

// ── Run · readings ──
const RUN_READINGS = stageWrap('var(--line-kanji)', `
  ${stageHead({ title: 'Kanji N4', latin: 'Readings', right: runRight() })}
  ${progress}
  <div class="prompt-card">
    <span class="stage-mark stage-mark--learning">In progress</span>
    <div class="prompt-card__body" style="gap: var(--sp-5); padding: var(--sp-6) var(--sp-5) var(--sp-5);">
      <span class="char-display" style="font-size: var(--fs-specimen-word);" lang="ja">駅</span>
      <div class="readings-input">
        <div class="readings-input__row">
          <span class="readings-input__label"><b><span lang="ja">音</span> on'yomi</b><span>Chinese-derived</span></span>
          <span class="field field--filled field--focus" lang="ja">エキ</span>
        </div>
        <div class="readings-input__row">
          <span class="readings-input__label"><b><span lang="ja">訓</span> kun'yomi</b><span>Native Japanese</span></span>
          <span class="field">kana or romaji</span>
          <button type="button" class="readings-input__add">${I.plus}add a reading</button>
        </div>
      </div>
    </div>
    <div class="prompt-card__foot"><span>N4 · Kanji</span><span>Readings</span></div>
  </div>
  <div class="stage__foot"><button type="button" class="btn-primary" style="width: 100%;">Submit</button></div>`)

// ── Run · the level turns over, the card is signed ──
const LEVEL_UP = `
<div class="levelup"><div class="levelup__board">
  <span class="levelup__mark"><span class="levelup__jp">Level up</span><span class="levelup__latin">The fare paid in</span></span>
  <span class="levelup__flaps"><span class="split-flap"><span class="flap">1</span><span class="flap">2</span></span><span class="levelup__unit">Level</span></span>
</div></div>
<main class="stage" style="padding-top: var(--sp-3); --line-color: var(--line-kanji);">
  ${stageHead({ title: 'Kanji N4', latin: 'Kanji → meaning', right: runRight(12, 18) })}
  ${progress}
  <div class="study-assist">
    <button type="button" class="study-assist__toggle">${I.plus}Show choices</button>
    <button type="button" class="study-assist__toggle">${I.plus}Show a sentence</button>
  </div>
  <div class="prompt-card">
    <span class="stage-mark stage-mark--mastered">Mastered</span>
    <span class="card-stamp__ripple" style="--stamp-ink: var(--state-mastered);"></span>
    <div class="prompt-card__body flashcard">
      <span class="char-display" lang="ja">駅</span>
      <span class="flashcard-answer">station</span>
    </div>
    <span class="card-stamp__rakkan" lang="ja" style="--stamp-ink: var(--state-mastered); border-style: double;">極</span>
    <div class="prompt-card__foot"><span>N4 · Kanji</span><span>Kanji → meaning</span></div>
  </div>
  ${ratingBar('q4', ' rating-bar--fading')}
</main>`

// ── Reading practice · the timed sentence ──
const READING = stageWrap('var(--line-reading)', `
  ${stageHead({ leave: 'Practice', title: 'Reading practice', latin: 'N4 · JLPT', right: '<span class="today-remaining">3 / 7</span>' })}
  <div class="timer"><div class="timer__bar"><span class="timer__fill" style="width: 62%"></span></div><span class="timer__label">12.3s</span></div>
  <div class="prompt-card">
    <div class="prompt-card__body"><span class="sentence" lang="ja">雨が降りそうです。</span></div>
    <div class="prompt-card__foot"><span>N4 · Reading</span><span></span></div>
  </div>
  <div class="stage__foot">
    <span class="field">Write what you saw, in romaji</span>
    <button type="button" class="btn-primary" style="width: 100%;">Submit</button>
  </div>`)

// ── Reading comprehension · a question ──
const COMPREHENSION = stageWrap('var(--line-rikai)', `
  ${stageHead({ leave: 'Practice', title: 'Comprehension', latin: 'N4 · Question 3 of 6', right: '<span class="today-remaining">3 / 6</span>' })}
  <div class="deck-progress"><span class="deck-progress__segment" style="width: 50%; background: var(--line-rikai);"></span></div>
  <div class="prompt-card" style="flex: none; min-height: 0;">
    <div class="prompt-card__body" style="align-items: flex-start; gap: var(--sp-3); padding: var(--sp-5);">
      <span class="type-badge">Detail</span>
      <span class="sentence sentence--left" style="font-size: var(--fs-title);" lang="ja">男の人はどうして駅に行きましたか。</span>
    </div>
  </div>
  <div class="mcq-list">
    ${[['A', '友達に会うため'], ['B', '切符を買うため'], ['C', '忘れ物を取りに行くため'], ['D', '電車の時間を調べるため']].map(([l, t], i) => `<button type="button" class="mcq-row${i === 1 ? ' mcq-row--selected' : ''}"><span class="mcq-row__accent"></span><span class="mcq-row__index">${l}</span><span class="mcq-row__text mcq-row__text--jp" lang="ja">${t}</span></button>`).join('')}
  </div>
  <div class="stage__foot" style="flex-direction: row; gap: var(--sp-3);">
    <button type="button" class="btn-secondary" style="flex: 1;">Re-read the text</button>
    <button type="button" class="btn-primary" style="flex: 1;">Next</button>
  </div>`)

// ── Translation · the feedback ──
const TRANSLATION = stageWrap('var(--line-honyaku)', `
  ${stageHead({ leave: 'Practice', title: 'Translation', latin: 'N3 · 2 of 5', right: '<span class="today-remaining">2 / 5</span>' })}
  <div class="prompt-card">
    <div class="prompt-card__body prose" style="align-items: stretch; justify-content: flex-start; padding: var(--sp-5);">
      <span class="prose__label">EN</span>
      <span class="prose__en">I think it will rain tomorrow.</span>
      <span class="prose__rule"></span>
      <span class="prose__label">Your answer</span>
      <span class="prose__jp" lang="ja">明日は雨が降ると思います。</span>
      <span class="prose__label">Reference</span>
      <span class="prose__jp" lang="ja">明日は雨が降ると思う。</span>
      <span class="prose__romaji">ashita wa ame ga furu to omou</span>
      <span class="prose__rule"></span>
      <span class="prose__label">AI analysis</span>
      <span class="prose__ai">Natural and correct. <span lang="ja">降ります</span> is the polite form; the reference uses the plain form — both fit the sentence.</span>
    </div>
    <div class="prompt-card__foot"><span>N3 · Translation</span><span>Grammar · <span lang="ja">〜と思う</span></span></div>
  </div>
  ${ratingBar()}`)

// ── Exam · the runner ──
export const EXAM_RUNNER = stageWrap('var(--line-exam)', `
  <div class="exam-meta">
    ${back('Exam')}
    <span class="exam-meta__section"><span class="exam-meta__jp">N4 · Vocabulary</span></span>
    <span class="exam-timer">24:18</span>
  </div>
  <div class="deck-progress"><span class="deck-progress__segment" style="width: 29%; background: var(--line-exam);"></span></div>
  <button type="button" class="exam-mondai"><span><b>Part 3</b> · Show instructions</span>${I.chevD}</button>
  <div class="prompt-card" style="flex: none; min-height: 0;">
    <div class="prompt-card__body" style="align-items: flex-start; gap: var(--sp-3); padding: var(--sp-5);">
      <span class="cap">Q7</span>
      <span class="sentence sentence--left" style="font-size: var(--fs-title);" lang="ja">毎朝、駅まで<span class="exam-underline">＿＿＿</span>歩きます。</span>
    </div>
  </div>
  <div class="mcq-list">
    ${[['1', 'ゆっくり'], ['2', 'はやく'], ['3', 'とても'], ['4', 'すこし']].map(([l, t], i) => `<button type="button" class="mcq-row${i === 0 ? ' mcq-row--selected' : ''}"><span class="mcq-row__accent"></span><span class="mcq-row__index">${l}</span><span class="mcq-row__text mcq-row__text--jp" lang="ja">${t}</span></button>`).join('')}
  </div>
  <div class="exam-nav">
    <button type="button" class="btn-secondary">${I.chevL}Previous</button>
    <button type="button" class="exam-flag exam-flag--on">${I.flag}</button>
    <button type="button" class="btn-primary">Next${I.chevR}</button>
  </div>
  <div style="flex: 1;"></div>
  <div class="exam-sheetbar">
    <span class="exam-sheetbar__label"><b>7 / 21</b><span>Answer sheet</span></span>
    <span class="exam-sheetbar__chips">${Array.from({ length: 21 }, (_, i) => `<i class="exam-sheetbar__chip${i < 6 ? ' exam-sheetbar__chip--done' : i === 6 ? ' exam-sheetbar__chip--flag' : ''}"></i>`).join('')}</span>
    <button type="button" class="exam-finish">Finish</button>
  </div>`)

// ── Exam · the result ──
const c = 2 * Math.PI * 46
const EXAM_RESULT = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-exam);">
  ${header({ code: 'MS', title: 'Mock exam', sub: 'N4 · Vocabulary', color: 'var(--line-exam)' })}
  <div class="exam-result-head">
    <div class="exam-score-ring">
      <svg viewBox="0 0 108 108"><circle class="exam-score-ring__track" cx="54" cy="54" r="46"></circle><circle class="exam-score-ring__fill" cx="54" cy="54" r="46" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - 0.81)).toFixed(1)}"></circle><line class="exam-score-ring__tick" x1="54" y1="4" x2="54" y2="14" transform="rotate(216 54 54)"></line></svg>
      <span class="exam-score-ring__pct">81%</span>
    </div>
    <div class="exam-result-figs">
      <b>17 / 21</b><span>correct</span>
      <span>Practice target 60% · 12m 04s</span>
      <span>Unofficial practice score, not a JLPT scaled score.</span>
    </div>
  </div>
  <div class="section-header"><span class="section-header__mark"><span class="section-header__jp">Review your answers</span></span><button type="button" class="chip chip--on" style="--tab-color: var(--line-exam); margin-left: auto;">Missed only</button><span class="section-header__rule"></span></div>
  <div class="surface" style="display:flex;flex-direction:column;">
    <div class="exam-group"><b>Part 1</b><span>6 / 6</span></div>
    <div class="exam-group" style="border-top: 1px solid var(--surface-line);"><b>Part 2</b><span>5 / 7</span></div>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q9</span><span class="exam-review-row__jp" lang="ja">この本はとても＿＿＿です。</span>${I.chevR}</button>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q12</span><span class="exam-review-row__blank">Left blank</span>${I.chevR}</button>
    <div class="exam-group" style="border-top: 1px solid var(--surface-line);"><b>Part 3</b><span>6 / 8</span></div>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q16</span><span class="exam-review-row__jp" lang="ja">週末は家で＿＿＿します。</span>${I.chevR}</button>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q19</span><span class="exam-review-row__jp" lang="ja">駅の＿＿＿に銀行があります。</span>${I.chevR}</button>
  </div>
  <div style="display:flex; gap: var(--sp-3);"><button type="button" class="btn-secondary" style="flex:1;">Back to exams</button><button type="button" class="btn-primary" style="flex:1;">New paper</button></div>
</main>
${tabbar('practice', 24)}`

// ── Decks · the shelf ──
const deck = ({ glyph, color, name, type, n, due }) => `<button type="button" class="platform-card" style="--rail: ${color}; --line-color: ${color};">
  <span class="platform-card__lead" style="width: 58px; padding-left: 12px;"><span class="wmap-roundel" style="color: color-mix(in srgb, ${color} 60%, var(--text-primary));" lang="ja">${glyph}</span></span>
  <span class="platform-card__body"><span class="platform-card__title" lang="ja">${name}</span><span class="platform-card__desc">${type}${due ? ` · <span style="color: var(--warning); font-weight: 700;">${due} due</span>` : ''}</span></span>
  <span class="platform-card__aside" style="min-width: 70px;"><span class="deck-card__count"><b>${n}</b><span>cards</span></span></span>
  <span class="platform-card__go">▶</span>
</button>`
export const DECK_ACTION = `<button type="button" class="console__action">${I.plus}Create deck</button>`
export const DECKS_CONSOLE = (action = '') => `<div class="console">
    <div class="console__top">
      <div class="console__chips">
        <button type="button" class="chip chip--on" style="--tab-color: var(--line-decks)">All</button>
        <button type="button" class="chip" style="--tab-color: var(--line-vocab)">Vocab</button>
        <button type="button" class="chip" style="--tab-color: var(--line-kanji)">Kanji</button>
        <button type="button" class="chip" style="--tab-color: var(--line-grammar)">Grammar</button>
      </div>
      ${action}
    </div>
    <div class="console__index">${I.search}<span class="console__field">Find a deck…</span><span class="console__count">3 decks</span></div>
  </div>`
const DECKS = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks);">
  ${header({ code: 'KZ', title: 'My decks', color: 'var(--line-decks)', aside: DECK_ACTION })}
  ${DECKS_CONSOLE()}
  <div class="platform-grid" style="gap: var(--sp-3);">
    ${deck({ glyph: '単', color: 'var(--line-vocab)',   name: '旅行', type: 'Vocabulary', n: 47,  due: 2 })}
    ${deck({ glyph: '漢', color: 'var(--line-kanji)',   name: '部首', type: 'Kanji',      n: 120, due: 0 })}
    ${deck({ glyph: '文', color: 'var(--line-grammar)', name: '敬語', type: 'Grammar',    n: 47,  due: 0 })}
  </div>
</main>
${tabbar('learn', 24)}`

// ── Decks · one deck ──
const cardRow = ({ jp, kana, back }) => `<button type="button" class="card-row"><span class="card-row__front"><span class="card-row__jp" lang="ja">${jp}</span><span class="card-row__kana" lang="ja">${kana}</span></span><span class="card-row__back">${back}</span>${I.chevR}</button>`
export const DECK_IDENTITY = (meta = 'Vocabulary · 47 cards · <span style="color: var(--warning); font-weight: 700;">2 due</span>', action = true) => `<div class="deck-identity">
    <span class="wmap-roundel" style="--line-color: var(--line-vocab); color: color-mix(in srgb, var(--line-vocab) 60%, var(--text-primary));" lang="ja">単</span>
    <span class="deck-identity__names"><span class="deck-identity__name" lang="ja">旅行</span><span class="deck-identity__meta">${meta}</span></span>
    ${action ? `<button type="button" class="btn-primary" style="background: color-mix(in srgb, var(--deck-action) 70%, var(--bg-panel));">▶ Study</button>` : ''}
  </div>`
const DECK_DETAIL = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks);">
  ${header({ code: 'KZ', title: 'My decks', color: 'var(--line-decks)', aside: back('Decks') })}
  ${DECK_IDENTITY()}
  <div class="chip-row">
    <button type="button" class="chip">${I.plus}Add card</button>
    <button type="button" class="chip">${I.check}Select</button>
    <button type="button" class="chip">${I.more}More</button>
  </div>
  <div class="card-list">
    ${cardRow({ jp: '駅', kana: 'えき', back: 'station' })}
    ${cardRow({ jp: '切符', kana: 'きっぷ', back: 'ticket' })}
    ${cardRow({ jp: '乗り換え', kana: 'のりかえ', back: 'transfer, change of trains' })}
    ${cardRow({ jp: '改札', kana: 'かいさつ', back: 'ticket gate' })}
    ${cardRow({ jp: '荷物', kana: 'にもつ', back: 'luggage' })}
    ${cardRow({ jp: '予約', kana: 'よやく', back: 'reservation' })}
    ${cardRow({ jp: '出発', kana: 'しゅっぱつ', back: 'departure' })}
  </div>
</main>
${tabbar('learn', 24)}`

// ── Statistics ──
function calendar() {
  const cells = []
  let seed = 7
  for (let i = 0; i < 98; i++) { seed = (seed * 9301 + 49297) % 233280; const r = seed / 233280; const lvl = i > 94 ? 0 : r < 0.18 ? 0 : r < 0.42 ? 1 : r < 0.7 ? 2 : r < 0.9 ? 3 : 4; cells.push(`<span class="cal__cell${lvl ? ` cal__cell--${lvl}` : ''}"></span>`) }
  return cells.join('')
}
const STATS = `
${hud()}
<main class="phone__content" style="--line-color: var(--accent8);">
  ${header({ code: 'TO', title: 'Statistics', color: 'var(--accent8)', aside: back('Profile') })}
  <div class="headline">
    <div class="plaque"><span class="plaque__v">3<span class="plaque__u">days</span></span><span class="plaque__l">Streak</span></div>
    <div class="plaque"><span class="plaque__v">24</span><span class="plaque__l">Due today</span></div>
    <div class="plaque"><span class="plaque__v">20<span class="plaque__u">%</span></span><span class="plaque__l">Mastered</span><span class="plaque__note">1,742 of 8,844 cards</span></div>
    <div class="plaque"><span class="plaque__v">91<span class="plaque__u">%</span></span><span class="plaque__l">Accuracy</span><span class="plaque__note">across 842 reviews</span></div>
    <div class="plaque"><span class="plaque__v">1,204</span><span class="plaque__l">In progress</span></div>
    <div class="plaque"><span class="plaque__v">5,898</span><span class="plaque__l">New</span><span class="plaque__note">never seen</span></div>
  </div>
  <div class="section-header"><span class="section-header__mark"><span class="section-header__jp">Practice calendar</span></span><span class="section-header__count">14 weeks</span><span class="section-header__rule"></span></div>
  <div class="cal">
    <div class="cal__months"><span style="grid-column: 1 / span 4;">Jun</span><span style="grid-column: 5 / span 4;">Jul</span><span style="grid-column: 9 / span 5;">Aug</span><span>Sep</span></div>
    <div class="cal__grid">${calendar()}</div>
    <div class="cal__foot"><span>Best day <b style="color: var(--text-primary);">88</b></span><span class="cal__scale">less <span class="cal__cell"></span><span class="cal__cell cal__cell--1"></span><span class="cal__cell cal__cell--2"></span><span class="cal__cell cal__cell--3"></span><span class="cal__cell cal__cell--4"></span> more</span></div>
  </div>
  <div class="section-header"><span class="section-header__mark"><span class="section-header__jp">Upcoming reviews</span></span><span class="section-header__rule"></span></div>
  <div class="forecast">
    <div class="forecast__bars">${[[24, 'Sat'], [61, 'Sun'], [38, 'Mon'], [52, 'Tue'], [70, 'Wed'], [44, 'Thu'], [29, 'Fri']].map(([v]) => `<span class="forecast__col"><span class="forecast__v">${v}</span><span class="forecast__bar" style="height: ${Math.round(v / 70 * 72)}px;"></span></span>`).join('')}</div>
    <div class="forecast__days"><span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
    <div class="forecast__legend"><span>Per day</span><span>Running total <b>318</b></span></div>
  </div>
</main>
${tabbar('profile', 24)}`

// ── Settings · the list ──
const stgRow = ({ title, value }) => `<button type="button" class="stg-row"><span class="stg-row__names"><span class="stg-row__jp">${title}</span></span><span class="stg-row__value">${value}</span>${I.chevR}</button>`
export const stgHead = (title, leave) => `<div style="display:flex; align-items:center; justify-content:space-between; gap: var(--sp-4);">
    <div class="stg-head"><h1 class="stg-head__jp">${title}</h1></div>
    ${back(leave)}
  </div>`
const SETTINGS = `
${hud()}
<main class="phone__content">
  ${stgHead('Settings', 'Profile')}
  <div class="stg-list">
    ${stgRow({ title: 'Display & language', value: 'Dark · English' })}
    ${stgRow({ title: 'Sound',              value: 'Full station' })}
    ${stgRow({ title: 'Learning',           value: 'N4 · 10 / day' })}
    ${stgRow({ title: 'Destination',        value: 'N3 · 14 Mar 2027' })}
    ${stgRow({ title: 'Data',               value: '' })}
    ${stgRow({ title: 'Account',            value: 'aiko@…' })}
  </div>
  <button type="button" class="btn-secondary" style="align-self: stretch;">Sign out</button>
</main>
${tabbar('profile', 24)}`

// ── Settings · learning ──
const SETTINGS_LEARN = `
${hud()}
<main class="phone__content">
  ${stgHead('Learning', 'Settings')}
  <div class="slip">
    <div class="slip__label"><b>JLPT level</b><span class="cap">You are here</span></div>
    <div class="lvlstrip">
      ${[['N5', 'Beginner'], ['N4', 'Elementary'], ['N3', 'Intermed.'], ['N2', 'Advanced'], ['N1', 'Proficient']].map(([c, j]) => `<button type="button" class="lvlstrip__stop${c === 'N4' ? ' lvlstrip__stop--on' : ''}"><span class="lvlstrip__dot"></span><span class="lvlstrip__code">${c}</span>${c === 'N4' ? `<span class="lvlstrip__jp">${j}</span>` : ''}</button>`).join('')}
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Daily pace</b><span class="cap">New items a day</span></div>
    <div class="svc-grid">
      <button type="button" class="svc"><span class="svc__jp">Local</span><span class="svc__pace">5 / day</span></button>
      <button type="button" class="svc svc--on"><span class="svc__jp">Rapid</span><span class="svc__pace">10 / day <span class="svc__star">★</span></span></button>
      <button type="button" class="svc"><span class="svc__jp">Express</span><span class="svc__pace">20 / day</span></button>
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Rating buttons</b></div>
    <div class="grades">
      <button type="button" class="svc"><span class="svc__pace">2 grades</span><span class="svc__words">Wrong · Correct</span></button>
      <button type="button" class="svc svc--on"><span class="svc__pace">4 grades</span><span class="svc__words">Wrong · Almost · Difficult · Correct</span></button>
      <button type="button" class="svc"><span class="svc__pace">6 grades</span><span class="svc__words">+ Blackout · Perfect</span></button>
    </div>
    <span class="slip__hint">They all grade the same way. A shorter bar simply leaves out the buttons you never press.</span>
  </div>
  <div class="slip">
    <span class="slip__hint">Recalibrate your level once you have progressed.</span>
    <button type="button" class="btn-secondary" style="align-self: flex-start;">Retake the test</button>
  </div>
</main>
${tabbar('profile', 24)}`

// ── Sign in ──
const AUTH = `
<main class="auth">
  <div class="auth-header"><span class="auth-header__glyph" lang="ja">日本語</span><h1 class="auth-header__title">Learn Japanese</h1></div>
  <div class="auth-card">
    <div class="seg seg--full"><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-latin">Login</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">Sign up</span></button></div>
    <span class="field">Email</span>
    <span class="field">Password</span>
    <button type="button" class="auth-submit">Login</button>
  </div>
  <p class="auth-foot">Everything can be changed later in Settings.</p>
</main>`

// ── The dictionary entry — the catalogue plate at reading size ──
const word = (jp, hit, gloss) => `<button type="button" class="dict-word"><span class="dict-word__jp" lang="ja">${jp.replace(hit, `<span class="dict-word__hit">${hit}</span>`)}</span><span class="dict-word__gloss">${gloss}</span>${I.chevR.replace('class="svg"', 'class="svg dict-word__chev"')}</button>`
const DICT_ENTRY = `
<div style="height: var(--safe-top); flex: none; background: var(--surface);"></div>
<article class="dict-entry">
  <header class="dict-plate">
    <div class="dict-plate__row">
      <div class="dict-plate__marks">${back('Dictionary')}<span class="stage-mark stage-mark--mastered">Mastered</span><span class="dict-plate__level">N5</span></div>
      <div class="dict-plate__actions"><button type="button" class="dict-plate__btn">${I.speaker}</button></div>
    </div>
    <div class="dict-plate__stack">
      <span class="dict-plate__reading" lang="ja">サン</span>
      <h1 class="dict-plate__word dict-plate__word--glyph" lang="ja">三</h1>
      <div class="dict-plate__readings">
        <span class="dict-plate__yomi"><span class="dict-kind" lang="ja">音</span><span lang="ja">サン</span></span>
        <span class="dict-plate__yomi"><span class="dict-kind" lang="ja">訓</span><span lang="ja">み・みっ(つ)</span></span>
        <button type="button" class="dict-plate__more">+3${I.chevD}</button>
      </div>
      <span class="dict-plate__caption">Three</span>
    </div>
    <div class="dict-plate__stripe"></div>
  </header>
  <div class="dict-entry__body">
    <section class="dict-block">
      <ol class="dict-senses">
        <li class="dict-sense"><span class="dict-sense__n">1</span><div class="dict-sense__body"><span class="dict-sense__gloss">three</span><div class="dict-examples"><div class="dict-ex"><span class="dict-ex__jp" lang="ja"><span class="dict-ex__hl">三</span>人で駅に行きました。</span><span class="dict-ex__tr">The three of us went to the station.</span></div></div></div></li>
        <li class="dict-sense"><span class="dict-sense__n">2</span><div class="dict-sense__body"><span class="dict-sense__gloss">the third</span><span class="dict-tag">prefix</span></div></li>
      </ol>
    </section>
    <section class="dict-block">
      <div class="dict-form">
        <div class="dict-form__sheet"><svg viewBox="0 0 84 84"><path d="M18 22h48M22 42h40M14 64h56" fill="none" stroke="#1c1811" stroke-width="7" stroke-linecap="round"></path></svg></div>
        <div class="record"><span class="record__value">3</span><span class="record__label">strokes</span></div>
        <button type="button" class="record record--door"><span class="record__value" lang="ja" style="font-family: var(--font-jp);">一</span><span class="record__label">Radical</span>${I.chevR}</button>
      </div>
    </section>
    <section class="dict-block">
      <div class="dict-words">
        ${word('三人', '三', 'three people')}
        ${word('三つ', '三', 'three (things)')}
        ${word('三日', '三', 'the third day')}
        ${word('三角', '三', 'triangle')}
      </div>
    </section>
    <section class="dict-block">
      <div class="dict-block__note">${I.bolt}Due now</div>
      <div class="records">
        <div class="record"><span class="record__value">92<span class="record__unit">%</span></span><span class="record__label">Accuracy</span></div>
        <div class="record"><span class="record__value">14</span><span class="record__label">Reviews</span></div>
        <div class="record"><span class="record__value">14<span class="record__unit">days</span></span><span class="record__label">Interval</span></div>
        <div class="record"><span class="record__value">12 Sep</span><span class="record__label">Next review</span></div>
      </div>
    </section>
  </div>
</article>`

// ── The analyzer's stage ──
const tok = (surf, furi, cls) => `<button type="button" class="tok tok--${cls}"><span class="tok__furi" lang="ja">${furi}</span><span lang="ja">${surf}</span></button>`
export const ANL_RESULT = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki);">
  <div class="stage__head" style="min-height: 0;">
    ${back('Analyzer')}
    <span class="stage__where"><h1 class="stage__where-jp" lang="ja">駅で友達を…</h1><span class="stage__where-latin">3 sentences · N3</span></span>
    <span class="anl-kept" style="height: 24px; padding: 0 8px;">Kept</span>
  </div>
  <div class="anl-stepper">
    <button type="button" class="anl-stepper__btn">${I.chevL}</button>
    <span class="anl-stops"><i class="on"></i><i class="on"></i><i></i></span>
    <span class="anl-stepper__count">2 / 3 · <i>i+1</i></span>
    <button type="button" class="anl-stepper__btn">${I.chevR}</button>
  </div>
  <div class="tok-line">
    ${tok('駅', 'えき', 'mastered')}${tok('で', '', 'particle')}${tok('友達', 'ともだち', 'learning')}${tok('を', '', 'particle')}${tok('待って', 'まって', 'unknown')}${tok('います', '', 'offdeck')}${tok('。', '', 'particle')}
  </div>
  <div class="anl-legend"><span><i style="background: var(--state-mastered);"></i>mastered</span><span><i style="background: var(--state-learning);"></i>in progress</span><span><i style="background: var(--state-new);"></i>unknown</span><span><i style="border-top: 2px dashed var(--text-secondary); height: 0;"></i>off-deck</span></div>
  <div class="token-card" style="--line-color: var(--line-kaiseki);">
    <div class="token-card__head"><span class="token-card__surface" lang="ja">待つ</span><span class="token-card__reading" lang="ja">まつ</span><span class="type-badge token-card__pos">Verb · <span lang="ja">て</span>-form</span></div>
    <span class="token-card__gloss">to wait, to wait for</span>
    <div class="token-card__foot"><span class="token-card__kanji"><span lang="ja">待</span></span><button type="button" class="btn-primary" style="min-height: 44px; padding-inline: var(--sp-4); font-size: var(--fs-sm);">${I.plus} Add to deck</button></div>
  </div>
  <div style="display:flex; align-items:center; gap: var(--sp-4);"><span class="cap" style="flex:none;">Furigana</span><div class="seg seg--full seg--kaiseki"><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-latin">All</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">Unknown</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">None</span></button></div></div>
  <button type="button" class="btn-secondary">Explain this sentence</button>
</main>
${tabbar('dict', 24)}`

export const SCREENS2 = [
  ['RunFlashcard',    RUN_FLASH,      'In a run · flashcard',        'today'],
  ['RunDraw',         RUN_DRAW,       'In a run · draw',             'today'],
  ['RunReadings',     RUN_READINGS,   'In a run · readings',         'today'],
  ['LevelUp',         LEVEL_UP,       'In a run · level up',         'today'],
  ['Reading',         READING,        'Reading practice',            'practice'],
  ['Comprehension',   COMPREHENSION,  'Reading comprehension',       'practice'],
  ['Translation',     TRANSLATION,    'Translation · feedback',      'practice'],
  ['ExamRunner',      EXAM_RUNNER,    'Mock exam · runner',          'practice'],
  ['ExamResult',      EXAM_RESULT,    'Mock exam · result',          'practice'],
  ['Decks',           DECKS,          'My decks',                    'learn'],
  ['DeckDetail',      DECK_DETAIL,    'My decks · a deck',           'learn'],
  ['Statistics',      STATS,          'Statistics',                  'pass'],
  ['Settings',        SETTINGS,       'Settings',                    'pass'],
  ['SettingsLearn',   SETTINGS_LEARN, 'Settings · learning',         'pass'],
  ['DictionaryEntry', DICT_ENTRY,     'Dictionary · an entry',       'dict'],
  ['AnalyzerResult',  ANL_RESULT,     'Analyzer · the sentence',     'dict'],
  ['SignIn',          AUTH,           'Sign in',                     'arrival'],
]
