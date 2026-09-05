// The second wave: every remaining feature, drawn for a phone.
import { hud, tabbar, plate, clock, I, credits, status, rally, pace } from './parts.mjs'

const stageHead = ({ leave = '改札', jp, latin, right = '' }) => `<div class="stage__head">
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">${leave}</span></button>
    <span class="stage__where"><span class="stage__where-jp" lang="ja">${jp}</span><span class="stage__where-latin">${latin}</span></span>
    ${right}
  </div>`
const progress = `<div class="deck-progress">
    <span class="deck-progress__segment" style="width: 30%; background: var(--state-new);"></span>
    <span class="deck-progress__segment" style="width: 45%; background: var(--state-learning);"></span>
    <span class="deck-progress__segment" style="width: 25%; background: var(--state-mastered);"></span>
  </div>`
const ratingBar = (pressed = null, extra = '') => `<div class="rating-bar${extra}"><div class="rating-bar__buttons">
    ${[['q1', 'Wrong'], ['q2', 'Almost'], ['q3', 'Difficult'], ['q4', 'Correct']].map(([q, l]) => `<button type="button" class="rating-bar__btn rating-bar__btn--${q}${pressed === q ? ' rating-bar__btn--pressed' : ''}"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">${l}</span></button>`).join('')}
  </div></div>`
const runRight = (left = 18, cr = 24) => `<span class="today-remaining">${left}</span>${credits(cr)}`

// ── Run · flashcard (vocab, revealed) ──
const RUN_FLASH = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-vocab);">
  ${stageHead({ jp: '単語 N5', latin: 'Word → meaning', right: runRight(17, 23) })}
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
    <div class="prompt-card__foot"><span lang="ja">N5 単語</span><span>Word → meaning</span></div>
  </div>
  ${ratingBar()}
</main>`

// ── Run · draw (the drawing quiz, stacked) ──
const RUN_DRAW = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-kanji);">
  ${stageHead({ jp: '漢字 N4', latin: 'Draw the kanji', right: runRight() })}
  ${progress}
  <div class="prompt-card">
    <span class="stage-mark stage-mark--learning">In progress</span>
    <div class="prompt-card__body" style="gap: var(--sp-4); padding: var(--sp-6) var(--sp-5) var(--sp-5);">
      <div class="draw-prompt"><span class="draw-prompt__meaning">station</span><span class="draw-prompt__hint" lang="ja">エキ</span></div>
      <div class="canvas-wrap"><svg viewBox="0 0 300 300"><path d="M78 96c14-4 28-6 44-6M84 120h40M82 150h44M84 176c10 10 26 20 40 22M180 88c-6 26-18 52-30 66M170 120h80M198 128c0 40-2 86-6 110M210 156c8 10 22 30 30 44" fill="none" stroke="#f3ecdf" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>
      <div class="canvas-label"><span class="cap">Your drawing</span><button type="button" class="canvas-clear-btn">${I.cross}Erase</button></div>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N4 漢字</span><span>Draw the kanji</span></div>
  </div>
  <div class="stage__foot"><button type="button" class="btn-primary" style="width: 100%;">Reveal answer</button></div>
</main>`

// ── Run · readings ──
const RUN_READINGS = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-kanji);">
  ${stageHead({ jp: '漢字 N4', latin: 'Readings', right: runRight() })}
  ${progress}
  <div class="prompt-card">
    <span class="stage-mark stage-mark--learning">In progress</span>
    <div class="prompt-card__body" style="gap: var(--sp-5); padding: var(--sp-6) var(--sp-5) var(--sp-5);">
      <span class="char-display" style="font-size: var(--fs-specimen-word);" lang="ja">駅</span>
      <div class="readings-input">
        <div class="readings-input__row">
          <span class="readings-input__label"><b lang="ja">音読み</b><span>On · Chinese-derived</span></span>
          <span class="field field--filled field--focus" lang="ja">エキ</span>
        </div>
        <div class="readings-input__row">
          <span class="readings-input__label"><b lang="ja">訓読み</b><span>Kun · native Japanese</span></span>
          <span class="field">kana or romaji</span>
          <button type="button" class="readings-input__add">${I.plus}add a reading</button>
        </div>
      </div>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N4 漢字</span><span>Readings</span></div>
  </div>
  <div class="stage__foot"><button type="button" class="btn-primary" style="width: 100%;">Submit</button></div>
</main>`

// ── Run · the level turns over, the card is signed ──
const LEVEL_UP = `
<div class="levelup"><div class="levelup__board">
  <span class="levelup__mark"><span class="levelup__jp" lang="ja">進級</span><span class="levelup__latin">Level up</span></span>
  <span class="levelup__flaps"><span class="split-flap"><span class="flap">1</span><span class="flap">3</span></span><span class="levelup__unit">Level</span></span>
</div></div>
<main class="stage" style="padding-top: var(--sp-3); --line-color: var(--line-kanji);">
  ${stageHead({ jp: '漢字 N4', latin: 'Kanji → meaning', right: runRight(12, 18) })}
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
    <span class="card-stamp__rakkan" lang="ja" style="--stamp-ink: var(--state-mastered); border-style: double; border-width: 0.09em;">極</span>
    <div class="prompt-card__foot"><span lang="ja">N4 漢字</span><span>Kanji → meaning</span></div>
  </div>
  ${ratingBar('q4', ' rating-bar--fading')}
</main>`

// ── Reading practice · the timed sentence ──
const READING = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-reading);">
  ${stageHead({ leave: '実践', jp: '読書 N4', latin: 'Reading practice', right: '<span class="today-remaining">3 / 7</span>' })}
  <div class="timer"><div class="timer__bar"><span class="timer__fill" style="width: 62%"></span></div><span class="timer__label">12.3s</span></div>
  <div class="prompt-card">
    <div class="prompt-card__body"><span class="sentence" lang="ja">雨が降りそうです。</span></div>
    <div class="prompt-card__foot"><span lang="ja">N4 読書</span><span></span></div>
  </div>
  <div class="stage__foot">
    <span class="field">e.g. konnichiwa</span>
    <button type="button" class="btn-primary" style="width: 100%;">Submit</button>
  </div>
</main>`

// ── Reading comprehension · a question ──
const COMPREHENSION = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-rikai);">
  ${stageHead({ leave: '実践', jp: '理解 N4', latin: 'Reading comprehension', right: '<span class="today-remaining">3 / 6</span>' })}
  <div class="deck-progress"><span class="deck-progress__segment" style="width: 50%; background: var(--line-rikai);"></span></div>
  <div class="prompt-card" style="flex: none; min-height: 0;">
    <div class="prompt-card__body" style="align-items: flex-start; gap: var(--sp-3); padding: var(--sp-5);">
      <span class="type-badge">Detail</span>
      <span class="sentence sentence--left" style="font-size: 1.25rem;" lang="ja">男の人はどうして駅に行きましたか。</span>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N4 理解</span><span>Question 3</span></div>
  </div>
  <div class="mcq-list">
    ${[['A', '友達に会うため'], ['B', '切符を買うため'], ['C', '忘れ物を取りに行くため'], ['D', '電車の時間を調べるため']].map(([l, t], i) => `<button type="button" class="mcq-row${i === 1 ? ' mcq-row--selected' : ''}"><span class="mcq-row__accent"></span><span class="mcq-row__index">${l}</span><span class="mcq-row__text mcq-row__text--jp" lang="ja">${t}</span></button>`).join('')}
  </div>
  <div class="stage__foot" style="flex-direction: row; gap: var(--sp-3);">
    <button type="button" class="btn-secondary" style="flex: 1;">Re-read the text</button>
    <button type="button" class="btn-primary" style="flex: 1;">Next</button>
  </div>
</main>`

// ── Translation · the feedback ──
const TRANSLATION = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-honyaku);">
  ${stageHead({ leave: '実践', jp: '翻訳 N3', latin: 'Translation', right: '<span class="today-remaining">2 / 5</span>' })}
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
      <span class="prose__ai">Natural and correct. 降ります is the polite form; the reference uses the plain form — both fit the sentence.</span>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N3 翻訳</span><span>Grammar · 〜と思う</span></div>
  </div>
  ${ratingBar()}
</main>`

// ── Exam · the runner ──
const EXAM_RUNNER = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-exam);">
  <div class="exam-meta">
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">模試</span></button>
    <span class="exam-meta__section"><span class="exam-meta__jp" lang="ja">N4 語彙</span><span class="cap">Vocabulary</span></span>
    <span class="exam-timer">24:18</span>
  </div>
  <div class="deck-progress"><span class="deck-progress__segment" style="width: 29%; background: var(--line-exam);"></span></div>
  <button type="button" class="exam-mondai"><span><b lang="ja">もんだい3</b> · Show instructions</span>${I.chevD}</button>
  <div class="prompt-card" style="flex: none; min-height: 0;">
    <div class="prompt-card__body" style="align-items: flex-start; gap: var(--sp-3); padding: var(--sp-5);">
      <span class="cap">Q7</span>
      <span class="sentence sentence--left" style="font-size: 1.25rem;" lang="ja">毎朝、駅まで<span class="exam-underline">＿＿＿</span>歩きます。</span>
    </div>
  </div>
  <div class="mcq-list">
    ${[['1', 'ゆっくり'], ['2', 'はやく'], ['3', 'とても'], ['4', 'すこし']].map(([l, t], i) => `<button type="button" class="mcq-row${i === 0 ? ' mcq-row--selected' : ''}"><span class="mcq-row__accent"></span><span class="mcq-row__index">${l}</span><span class="mcq-row__text mcq-row__text--jp" lang="ja">${t}</span></button>`).join('')}
  </div>
  <div class="exam-nav">
    <button type="button" class="btn-secondary">${I.chevL}Previous</button>
    <button type="button" class="exam-flag exam-flag--on"><svg class="svg" viewBox="0 0 24 24"><path d="M5 21V4h12l-2 4 2 4H5"></path></svg></button>
    <button type="button" class="btn-primary">Next${I.chevR}</button>
  </div>
  <div style="flex: 1;"></div>
  <div class="exam-sheetbar">
    <span class="exam-sheetbar__label"><b>7 / 21</b><span>Answer sheet</span></span>
    <span class="exam-sheetbar__chips">${Array.from({ length: 21 }, (_, i) => `<i class="exam-sheetbar__chip${i < 6 ? ' exam-sheetbar__chip--done' : i === 6 ? ' exam-sheetbar__chip--flag' : ''}"></i>`).join('')}</span>
    <button type="button" class="exam-finish">Finish</button>
  </div>
</main>`

// ── Exam · the result ──
const c = 2 * Math.PI * 46
const EXAM_RESULT = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-exam);">
  ${plate({ code: 'MS', kana: 'もし', name: '模試', latin: 'Mock exam', color: 'var(--line-exam)', extra: '<span class="cap">N4 · Vocabulary</span>' })}
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
  <div class="section-header"><span class="section-header__mark"><span class="section-header__jp" lang="ja">見直し</span><span class="section-header__title">Review your answers</span></span><button type="button" class="chip chip--on" style="--tab-color: var(--line-exam); margin-left: auto;">Missed only</button><span class="section-header__rule"></span></div>
  <div class="surface" style="display:flex;flex-direction:column;">
    <div class="exam-group"><b lang="ja">もんだい1</b><span>6 / 6</span></div>
    <div class="exam-group" style="border-top: 1px solid var(--surface-line);"><b lang="ja">もんだい2</b><span>5 / 7</span></div>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q9</span><span class="exam-review-row__jp" lang="ja">この本はとても＿＿＿です。</span>${I.chevR}</button>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q12</span><span class="exam-review-row__blank">Left blank</span>${I.chevR}</button>
    <div class="exam-group" style="border-top: 1px solid var(--surface-line);"><b lang="ja">もんだい3</b><span>4 / 6</span></div>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q16</span><span class="exam-review-row__jp" lang="ja">週末は家で＿＿＿します。</span>${I.chevR}</button>
    <button type="button" class="exam-review-row"><span class="exam-review-row__mark exam-review-row__mark--x">${I.cross}</span><span class="exam-review-row__q">Q19</span><span class="exam-review-row__jp" lang="ja">駅の＿＿＿に銀行があります。</span>${I.chevR}</button>
  </div>
  <div style="display:flex; gap: var(--sp-3);"><button type="button" class="btn-secondary" style="flex:1;">Back to exams</button><button type="button" class="btn-primary" style="flex:1;">New paper</button></div>
</main>
${tabbar('practice', 24)}`

// ── Decks · the shelf ──
const deck = ({ glyph, color, name, type, n, due }) => `<button type="button" class="platform-card" style="--rail: ${color}; --line-color: ${color};">
  <span class="platform-card__lead" style="width: 58px; padding-left: 12px;"><span class="wmap-roundel" style="color: color-mix(in srgb, ${color} 60%, var(--text-primary));" lang="ja">${glyph}</span></span>
  <span class="platform-card__body"><span class="platform-card__title">${name}</span><span class="platform-card__desc">${type}${due ? ` · <span style="color: var(--warning); font-weight: 700;">${due} due</span>` : ''}</span></span>
  <span class="platform-card__aside" style="min-width: 70px;"><span class="deck-card__count"><b>${n}</b><span>cards</span></span></span>
  <span class="platform-card__go">▶</span>
</button>`
const DECKS = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks);">
  ${plate({ code: 'KZ', kana: 'きょうざい', name: '教材', latin: 'My decks', color: 'var(--line-decks)' })}
  <div class="console">
    <div class="console__top">
      <div class="console__chips">
        <button type="button" class="chip chip--on" style="--tab-color: var(--line-decks)">All</button>
        <button type="button" class="chip" style="--tab-color: var(--line-vocab)"><span class="chip__glyph" lang="ja">単</span>Vocab</button>
        <button type="button" class="chip" style="--tab-color: var(--line-kanji)"><span class="chip__glyph" lang="ja">漢</span>Kanji</button>
      </div>
      <button type="button" class="console__action">${I.plus}Create deck</button>
    </div>
    <div class="console__index">${I.search}<span class="console__field">Find a deck...</span><span class="console__count">3 decks</span></div>
  </div>
  <div class="platform-grid">
    ${deck({ glyph: '単', color: 'var(--line-vocab)',   name: '旅行', type: 'Vocabulary', n: 47,  due: 2 })}
    ${deck({ glyph: '漢', color: 'var(--line-kanji)',   name: '部首', type: 'Kanji',      n: 120, due: 0 })}
    ${deck({ glyph: '文', color: 'var(--line-grammar)', name: '敬語', type: 'Grammar',    n: 47,  due: 0 })}
  </div>
</main>
${tabbar('learn', 24)}`

// ── Decks · one deck ──
const cardRow = ({ jp, kana, back }) => `<button type="button" class="card-row"><span class="card-row__front"><span class="card-row__jp" lang="ja">${jp}</span><span class="card-row__kana" lang="ja">${kana}</span></span><span class="card-row__back">${back}</span>${I.chevR}</button>`
const DECK_DETAIL = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks);">
  ${plate({ code: 'KZ', kana: 'きょうざい', name: '教材', latin: 'My decks', color: 'var(--line-decks)' })}
  <div class="deck-identity">
    <span class="wmap-roundel" style="--line-color: var(--line-vocab); color: color-mix(in srgb, var(--line-vocab) 60%, var(--text-primary));" lang="ja">単</span>
    <span class="deck-identity__names"><span class="deck-identity__name">旅行</span><span class="deck-identity__meta">Vocabulary · 47 cards · <span style="color: var(--warning); font-weight: 700;">2 due</span></span></span>
    <button type="button" class="btn-primary" style="background: color-mix(in srgb, var(--deck-action) 70%, var(--bg-panel));">▶ Study</button>
  </div>
  <div class="chip-row">
    <button type="button" class="chip">${I.plus}Add card</button>
    <button type="button" class="chip">${I.search}Browse</button>
    <button type="button" class="chip">${I.check}Select</button>
    <button type="button" class="chip"><svg class="svg" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg>More</button>
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
  ${plate({ code: 'TO', kana: 'とうけい', name: '統計', latin: 'Statistics', color: 'var(--accent8)' })}
  <div class="headline">
    <div class="plaque"><span class="plaque__v">3<span class="plaque__u" lang="ja">日</span></span><span class="plaque__l">Streak</span></div>
    <div class="plaque"><span class="plaque__v">24</span><span class="plaque__l">Due today</span></div>
    <div class="plaque"><span class="plaque__v">38<span class="plaque__u">%</span></span><span class="plaque__l">Mastered</span><span class="plaque__note">of 8,241 cards</span></div>
    <div class="plaque"><span class="plaque__v">91<span class="plaque__u">%</span></span><span class="plaque__l">Accuracy</span><span class="plaque__note">across 12,904 reviews</span></div>
    <div class="plaque"><span class="plaque__v">1,204</span><span class="plaque__l">In progress</span></div>
    <div class="plaque"><span class="plaque__v">3,905</span><span class="plaque__l">New</span><span class="plaque__note">never seen</span></div>
  </div>
  <div class="section-header"><span class="section-header__mark"><span class="section-header__jp" lang="ja">暦</span><span class="section-header__title">Practice calendar</span></span><span class="section-header__count">14 weeks</span><span class="section-header__rule"></span></div>
  <div class="cal">
    <div class="cal__months"><span style="grid-column: 1 / span 4;">Jun</span><span style="grid-column: 5 / span 4;">Jul</span><span style="grid-column: 9 / span 5;">Aug</span><span>Sep</span></div>
    <div class="cal__grid">${calendar()}</div>
    <div class="cal__foot"><span>Best day <b style="color: var(--text-primary);">88</b></span><span class="cal__scale">less <span class="cal__cell"></span><span class="cal__cell cal__cell--1"></span><span class="cal__cell cal__cell--2"></span><span class="cal__cell cal__cell--3"></span><span class="cal__cell cal__cell--4"></span> more</span></div>
  </div>
  <div class="section-header"><span class="section-header__mark"><span class="section-header__jp" lang="ja">予定</span><span class="section-header__title">Upcoming reviews</span></span><span class="section-header__rule"></span></div>
  <div class="forecast">
    <div class="forecast__bars">${[[24, 'Sat'], [61, 'Sun'], [38, 'Mon'], [52, 'Tue'], [70, 'Wed'], [44, 'Thu'], [29, 'Fri']].map(([v]) => `<span class="forecast__col"><span class="forecast__v">${v}</span><span class="forecast__bar" style="height: ${Math.round(v / 70 * 72)}px;"></span></span>`).join('')}</div>
    <div class="forecast__days"><span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
    <div class="forecast__legend"><span>Per day</span><span>Running total <b>318</b></span></div>
  </div>
</main>
${tabbar('profile', 24)}`

// ── Settings · the list ──
const stgRow = ({ jp, latin, value }) => `<button type="button" class="stg-row"><span class="stg-row__names"><span class="stg-row__jp" lang="ja">${jp}</span><span class="stg-row__latin">${latin}</span></span><span class="stg-row__value">${value}</span>${I.chevR}</button>`
const SETTINGS = `
${hud()}
<main class="phone__content">
  <div style="display:flex; align-items:flex-end; justify-content:space-between; gap: var(--sp-4);">
    <div class="stg-head"><span class="stg-head__jp" lang="ja">設定</span><span class="stg-head__latin">Settings</span></div>
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">定期券</span></button>
  </div>
  <div class="stg-list">
    ${stgRow({ jp: '環境', latin: 'Display · language', value: 'Dark · English' })}
    ${stgRow({ jp: '音',   latin: 'Sound',              value: 'Full station' })}
    ${stgRow({ jp: '学習', latin: 'Learning',           value: 'N4 · 10 / day' })}
    ${stgRow({ jp: '行先', latin: 'Destination',        value: 'N3 · 14 Mar 2027' })}
    ${stgRow({ jp: 'データ', latin: 'Data',             value: '' })}
    ${stgRow({ jp: '会員', latin: 'Account',            value: 'aiko@…' })}
  </div>
  <button type="button" class="btn-secondary" style="align-self: stretch;">Sign out</button>
</main>
${tabbar('profile', 24)}`

// ── Settings · 学習 ──
const SETTINGS_LEARN = `
${hud()}
<main class="phone__content">
  <div style="display:flex; align-items:flex-end; justify-content:space-between; gap: var(--sp-4);">
    <div class="stg-head"><span class="stg-head__jp" lang="ja">学習</span><span class="stg-head__latin">Learning</span></div>
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">設定</span></button>
  </div>
  <div class="slip">
    <div class="slip__label"><b>JLPT level</b><span class="cap">You are here</span></div>
    <div class="lvlstrip">
      ${[['N5', '入門'], ['N4', '基礎'], ['N3', '日常'], ['N2', '実務'], ['N1', '終着']].map(([c, j]) => `<button type="button" class="lvlstrip__stop${c === 'N4' ? ' lvlstrip__stop--on' : ''}"><span class="lvlstrip__dot"></span><span class="lvlstrip__code">${c}</span><span class="lvlstrip__jp" lang="ja">${j}</span></button>`).join('')}
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Daily pace</b><span class="cap">New items a day</span></div>
    <div class="svc-grid">
      <button type="button" class="svc"><span class="svc__jp" lang="ja">各駅停車</span><span class="svc__pace">5 / day</span></button>
      <button type="button" class="svc svc--on"><span class="svc__jp" lang="ja">快速</span><span class="svc__pace">10 / day <span class="svc__star">★</span></span></button>
      <button type="button" class="svc"><span class="svc__jp" lang="ja">特急</span><span class="svc__pace">20 / day</span></button>
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

// ── The ticket office · boarding station ──
const onbHeader = (step) => `<div class="onb-header">
    <span class="onb-header__stack"><span class="onb-header__kana" lang="ja">みどりのまどぐち</span><h1 class="onb-header__name" lang="ja">みどりの窓口</h1><span class="onb-header__latin">Ticket office</span></span>
    ${clock()}
  </div>
  <div class="onb-line">${[['試', 1], ['乗', 2], ['行', 3], ['案', 4], ['定', 5]].map(([g, n], i) => `${i ? '<span class="onb-line__rail"></span>' : ''}<span class="onb-line__stamp${n < step ? ' onb-line__stamp--done' : n === step ? ' onb-line__stamp--now' : ''}" lang="ja">${g}</span>`).join('')}</div>`
const lvl = ({ code, jp, load, sample }) => `<button type="button" class="onb-lvl"><span class="onb-lvl__code">${code}</span><span class="onb-lvl__body"><span class="onb-lvl__sign"><span lang="ja">${jp}</span><span class="onb-lvl__load">${load} items at this stop</span></span><span class="onb-lvl__sample" lang="ja">${sample}</span></span><span class="platform-card__go" style="--rail: var(--pass-ink); padding-right: 0;">▶</span></button>`
const ONB_LEVEL = `
<main class="onb">
  ${onbHeader(2)}
  <h2 class="onb-h2">Board at the last station whose sign you can read.</h2>
  <div style="display:flex; flex-direction:column; gap: var(--sp-3);">
    ${lvl({ code: 'N5', jp: '入門', load: '1,204', sample: 'これはペンです。' })}
    ${lvl({ code: 'N4', jp: '基礎', load: '1,610', sample: '雨が降りそうです。' })}
    ${lvl({ code: 'N3', jp: '日常', load: '3,102', sample: '彼は来ないかもしれないと思っていた。' })}
    ${lvl({ code: 'N2', jp: '実務', load: '4,140', sample: 'ご確認のうえ、お手続きください。' })}
    ${lvl({ code: 'N1', jp: '終着', load: '6,870', sample: '彼の発言は物議を醸した。' })}
  </div>
  <div style="display:flex; flex-direction:column; gap: var(--sp-2);">
    <button type="button" class="onb-alt"><span>I've never studied Japanese</span><span lang="ja">はじめて</span></button>
    <button type="button" class="onb-alt"><span>Test me · 12 questions, two minutes</span><span lang="ja">診断</span></button>
  </div>
</main>`

// ── The ticket office · destination and the departure board ──
const svcRow = ({ jp, en, pattern, pace, min, arrive, on = false, star = false }) => `<button type="button" class="onb-row${on ? ' onb-row--on' : ''}">
  <span class="onb-row__svc"><span class="onb-row__jp" lang="ja">${jp}</span><span class="onb-row__en">${en}</span></span>
  <span class="onb-row__pattern">${pattern.map((p, i) => `${i ? '<b></b>' : ''}<i class="${p ? 'on' : ''}"></i>`).join('')}</span>
  <span class="onb-row__figs"><span class="onb-row__pace">${pace} /day${star ? ' <span class="onb-row__star">★</span>' : ''}</span><span class="onb-row__arrive">${arrive} · ≈ ${min} min</span></span>
</button>`
const ONB_GOAL = `
<main class="onb" style="gap: var(--sp-4);">
  ${onbHeader(3)}
  <h2 class="onb-h2">Where is this line taking you?</h2>
  <div class="onb-dests">
    <button type="button" class="onb-dest"><span class="onb-dest__code">N4</span><span class="onb-dest__jp" lang="ja">基礎</span><span class="onb-dest__load">1,610 items</span></button>
    <button type="button" class="onb-dest onb-dest--on"><span class="onb-dest__code">N3</span><span class="onb-dest__jp" lang="ja">日常</span><span class="onb-dest__load">4,712 items</span></button>
    <button type="button" class="onb-dest"><span class="onb-dest__code">N2</span><span class="onb-dest__jp" lang="ja">実務</span><span class="onb-dest__load">8,852 items</span></button>
    <button type="button" class="onb-dest"><span class="onb-dest__code">N1</span><span class="onb-dest__jp" lang="ja">終着</span><span class="onb-dest__load">15,722 items</span></button>
  </div>
  <div class="seg seg--full"><button type="button" class="seg__opt"><span class="seg__opt-latin">By date</span></button><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-latin">By pace</span></button></div>
  <div class="onb-board">
    <div class="onb-board__head"><b lang="ja">発車</b><span>Departures · N3 日常</span></div>
    ${svcRow({ jp: '各駅停車', en: 'Local',         pattern: [1,1,1,1,1,1], pace: 5,  min: 12, arrive: 'Mar 2029' })}
    ${svcRow({ jp: '快速',     en: 'Rapid',         pattern: [1,0,1,0,1,1], pace: 10, min: 20, arrive: 'Dec 2027', on: true, star: true })}
    ${svcRow({ jp: '新快速',   en: 'Special rapid', pattern: [1,0,0,1,0,1], pace: 15, min: 30, arrive: 'Jul 2027' })}
    ${svcRow({ jp: '特急',     en: 'Ltd. express',  pattern: [1,0,0,0,0,1], pace: 20, min: 35, arrive: 'Apr 2027' })}
    ${svcRow({ jp: '臨時',     en: 'Extra',         pattern: [1,0,0,0,1,1], pace: 25, min: 45, arrive: 'Feb 2027' })}
  </div>
  <p class="onb-honest"><b>10 a day, every day</b> — about 20 minutes — <b>4,712 items</b>, arriving <b>日常</b> around <b>Dec 2027</b>. Miss days and this date moves — and the app will say so.</p>
  <button type="button" class="onb-action">Continue</button>
</main>`

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

// ── The dictionary entry ──
const DICT_ENTRY = `
<div style="height: var(--safe-top); flex: none; background: var(--bg-panel);"></div>
<main class="dd">
  <div class="dd-plate">
    <span class="dd-tategaki" lang="ja">漢字</span>
    <div class="dd-plate__body">
      <div class="dd-plate__row"><span class="lvl" style="--lvl-color: var(--text-on-panel-soft); color: var(--text-on-panel-soft);">N5</span><span class="seal seal--mastered" lang="ja">極</span><span class="dd-plate__actions"><button type="button">${I.speaker}</button><button type="button">${I.cross}</button></span></div>
      <span class="dd-head" lang="ja">三</span>
      <div class="dd-readings"><span class="dd-reading"><b lang="ja">音</b><span lang="ja">サン</span></span><span class="dd-reading"><b lang="ja">訓</b><span lang="ja">み · みっ(つ)</span></span></div>
    </div>
  </div>
  <div class="dd-section"><span class="dd-section__cap">Meaning</span><span class="dd-meaning">three</span></div>
  <div class="dd-section"><span class="dd-section__cap">Examples</span>
    <div class="dd-example"><span class="dd-example__jp" lang="ja"><mark>三</mark>人で駅に行きました。</span><span class="dd-example__en">The three of us went to the station.</span></div>
    <div class="dd-example"><span class="dd-example__jp" lang="ja">毎朝<mark>三</mark>十分歩きます。</span><span class="dd-example__en">I walk thirty minutes every morning.</span></div>
  </div>
  <div class="dd-section"><span class="dd-section__cap">Stroke order · card stats</span>
    <div class="dd-stroke">
      <div class="dd-stroke__frame"><svg viewBox="0 0 84 84"><path d="M18 22h48M22 42h40M14 64h56" fill="none" stroke="#1c1811" stroke-width="7" stroke-linecap="round"></path></svg></div>
      <div class="dd-tiles"><div class="dd-tile"><b>3</b><span>strokes</span></div><div class="dd-tile"><b lang="ja">一</b><span>Radical</span></div></div>
    </div>
    <div class="dd-tiles" style="grid-template-columns: repeat(4, minmax(0, 1fr));"><div class="dd-tile"><b>92%</b><span>Accuracy</span></div><div class="dd-tile"><b>14</b><span>Reviews</span></div><div class="dd-tile"><b>14 d</b><span>Interval</span></div><div class="dd-tile"><b>12 Sep</b><span>Next</span></div></div>
  </div>
</main>`

// ── The analyzer's stage ──
const tok = (surf, furi, cls) => `<button type="button" class="tok tok--${cls}"><span class="tok__furi" lang="ja">${furi}</span><span lang="ja">${surf}</span></button>`
const ANL_RESULT = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki); gap: var(--sp-4);">
  <div class="stage__head" style="min-height: 0;">
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">解析</span></button>
    <span class="stage__where"><span class="stage__where-jp" lang="ja">駅で友達を…</span><span class="stage__where-latin">3 sentences · N3</span></span>
    <span class="anl-kept" lang="ja" style="height: 22px; padding: 0 8px; font-size: 11px;">保存</span>
  </div>
  <div class="anl-stepper">
    <button type="button" class="anl-stepper__btn">${I.chevL}</button>
    <span class="anl-stops"><i class="on"></i><i class="on"></i><i></i></span>
    <span class="anl-stepper__count">2 / 3 · <i>i+1</i></span>
    <button type="button" class="anl-stepper__btn">${I.chevR}</button>
  </div>
  <div class="tok-line">
    ${tok('駅', 'えき', 'mastered')}${tok('で', '', 'particle')}${tok('友達', 'ともだち', 'learning')}${tok('を', '', 'particle')}${tok('待って', 'まって', 'unknown')}${tok('います', '', 'new')}${tok('。', '', 'particle')}
  </div>
  <div class="anl-legend"><span><i style="background: var(--state-mastered);"></i>mastered</span><span><i style="background: var(--state-learning);"></i>in progress</span><span><i style="background: var(--state-new);"></i>new</span><span><i style="background: var(--state-due);"></i>unknown</span></div>
  <div class="token-card" style="--line-color: var(--line-kaiseki);">
    <div class="token-card__head"><span class="token-card__surface" lang="ja">待つ</span><span class="token-card__reading" lang="ja">まつ</span><span class="type-badge token-card__pos">Verb · て-form</span></div>
    <span class="token-card__gloss">to wait, to wait for</span>
    <div class="token-card__foot"><span class="token-card__kanji"><span lang="ja">待</span></span><button type="button" class="btn-primary" style="min-height: 38px; padding-inline: var(--sp-4); font-size: var(--fs-sm);">${I.plus} Add to deck</button></div>
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
  ['OfficeBoarding',  ONB_LEVEL,      'Ticket office · boarding',    'arrival'],
  ['OfficeGoal',      ONB_GOAL,       'Ticket office · destination', 'arrival'],
]
