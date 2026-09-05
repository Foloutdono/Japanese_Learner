// The third wave: what the verification pass found missing — the paywall
// moments, the last card faces, the rank, the paper picker, the tiers, deck
// authoring, the other intakes, the destination slip, three office steps,
// the confirms and the states.
import { hud, tabbar, plate, clock, I, credits, status, rally, pace } from './parts.mjs'
import { EXAM_RUNNER, ANL_RESULT, stageHead, progress, ratingBar, runRight, onbHeader } from './screens2.mjs'

const sheet = (inner, extra = '') => `<div class="scrim"></div><div class="sheet${extra}"><span class="sheet__handle"></span>${inner}</div>`
const unlimitedBtn = `<button type="button" class="btn-depart btn-depart--sheet"><span class="btn-depart__jp" lang="ja">定期券を買う</span><span class="btn-depart__latin">Go unlimited</span><span class="btn-depart__go">▶</span></button>`

export function SCREENS3({ TODAY_BODY, RUN_BODY, gateCard }) {

// ── Today · no credits left ──
const TODAY_OUT = TODAY_BODY({ hud: { cr: 0 }, gate: { total: 24, balance: 0 } })

// ── In a run · the balance runs out mid-run ──
const RUN_OUT = `
${RUN_BODY}
${sheet(`
  <div class="sheet__head"><span class="sheet__jp" lang="ja">残高</span><span class="sheet__cap">Balance</span></div>
  <div class="balance">
    <span class="balance__fig" style="color: color-mix(in srgb, var(--danger) 60%, var(--text-primary));">0<span class="balance__unit">credits</span></span>
    <span class="balance__of"><span>12 cleared</span><span style="font-weight:600;">12 wait for tomorrow</span></span>
  </div>
  <div class="balance__track"><span class="balance__fill" style="width: 0%"></span></div>
  <div class="balance__rows"><div class="balance__cell"><b>+30<span lang="ja">毎日</span></b><span class="cap">Refill at 00:00</span></div><div class="balance__cell"><b>∞</b><span class="cap">With a 定期券</span></div></div>
  <button type="button" class="btn-depart btn-depart--ghost"><span class="btn-depart__jp" lang="ja">駅に戻る</span><span class="btn-depart__latin">Back to the station</span></button>
  ${unlimitedBtn}
`)}`

// ── In a run · fill in (grammar) ──
const RUN_CLOZE = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-grammar);">
  ${stageHead({ jp: '文法 N4', latin: 'Fill in', right: runRight(16, 22) })}
  ${progress}
  <div class="study-assist">
    <button type="button" class="study-assist__toggle">${I.plus}Show choices</button>
    <button type="button" class="study-assist__toggle study-assist__toggle--on">${I.plus}Hide furigana</button>
  </div>
  <div class="prompt-card">
    <span class="stage-mark stage-mark--new">New</span>
    <div class="prompt-card__body" style="gap: var(--sp-5);">
      <span class="cloze" lang="ja">雨が降り<span class="cloze__blank">そう</span>です。</span>
      <span class="hint">It looks like rain.</span>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N4 文法</span><span>Fill in</span></div>
  </div>
  <div class="stage__foot">
    <span class="field field--filled field--focus" lang="ja">そう</span>
    <button type="button" class="btn-primary" style="width: 100%;">Submit</button>
  </div>
</main>`

// ── In a run · fast review, ungraded ──
const RUN_BROWSE = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-kanji);">
  ${stageHead({ leave: '漢字', jp: '漢字 N4', latin: 'Fast review', right: '<span class="today-remaining">12 / 48</span>' })}
  <div class="prompt-card">
    <span class="stage-mark stage-mark--mastered">Mastered</span>
    <div class="prompt-card__body flashcard">
      <span class="char-display" lang="ja">駅</span>
      <span class="flashcard-answer">station</span>
      <span class="flashcard-reading" lang="ja">エキ · えき</span>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N4 漢字</span><span>Nothing is graded</span></div>
  </div>
  <div class="stage__foot browse-nav">
    <button type="button" class="btn-secondary">${I.chevL}Previous</button>
    <button type="button" class="btn-primary">Next${I.chevR}</button>
  </div>
</main>`

// ── In a run · the rank is reissued, and waits to be claimed ──
const REISSUE = `
${RUN_BODY}
<div class="reissue">
  <div class="reissue__scrim"></div>
  <div class="reissue__pass">
    <span class="reissue__cap"><b lang="ja">再発行</b><span class="cap">Reissued</span></span>
    <span class="reissue__name">Aiko</span>
    <span class="reissue__from" lang="ja">浪人</span>
    <span class="reissue__rank" lang="ja">侍</span>
    <span class="reissue__latin">Samurai</span>
    <span class="pass__level" style="align-items: center; margin-top: var(--sp-2);"><span class="pass__level-num" style="color: var(--text-primary);">12</span><span class="pass__level-label" style="color: var(--text-secondary);">Level</span></span>
    <button type="button" class="btn-depart" style="width: 100%; margin-top: var(--sp-3);"><span class="btn-depart__jp" lang="ja">受け取る</span><span class="btn-depart__latin">Claim</span><span class="btn-depart__go">▶</span></button>
  </div>
</div>`

// ── A station · word-frequency tiers ──
const tier = (n, range, count) => `<button type="button" class="platform-card"><span class="platform-card__lead"><span class="platform-card__no">${n}</span><span class="platform-card__unit" lang="ja">番線</span></span><span class="platform-card__body"><span class="platform-card__title">${range}</span><span class="platform-card__desc">${count} kanji</span></span><span class="platform-card__go">▶</span></button>`
const STATION_TIERS = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kanji); gap: var(--sp-4);">
  ${plate({ code: 'KJ', kana: 'かんじ', name: '漢字', latin: 'Kanji', color: 'var(--line-kanji)', noriba: 11 })}
  <div style="display:flex; align-items:center; gap: var(--sp-4);"><span class="cap" style="flex:none;">Tier size</span><div class="seg seg--full"><button type="button" class="seg__opt"><span class="seg__opt-latin">100</span></button><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-latin">200</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">500</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">1000</span></button></div></div>
  <div class="platform-grid" style="gap: var(--sp-3);">
    ${tier(1, '1–200', 200)}${tier(2, '201–400', 200)}${tier(3, '401–600', 200)}${tier(4, '601–800', 200)}${tier(5, '801–1000', 200)}
  </div>
  <div style="display:flex;justify-content:space-between;gap:var(--sp-4);padding: 0 var(--sp-1);">
    <span class="cap"><span lang="ja" style="letter-spacing:var(--tr-term);text-transform:none;">出典</span> · Word frequency</span>
    <button type="button" class="cap" style="text-decoration: underline; text-underline-offset: 3px;">JLPT instead</button>
  </div>
</main>
${tabbar('learn', 24)}`

// ── Decks · create ──
const typeRow = ({ glyph, color, label, desc, on = false }) => `<button type="button" class="type-row${on ? ' type-row--on' : ''}"><span class="chip__glyph" lang="ja" style="--tab-color: ${color}; width: 28px; height: 28px; font-size: 13px;">${glyph}</span><span class="type-row__names"><span class="type-row__label">${label}</span><span class="type-row__desc">${desc}</span></span></button>`
const DECK_CREATE = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks); gap: var(--sp-4);">
  ${plate({ code: 'KZ', kana: 'きょうざい', name: '教材', latin: 'My decks', color: 'var(--line-decks)' })}
  <div class="console">
    <div class="console__top">
      <div class="console__chips"><button type="button" class="chip chip--on" style="--tab-color: var(--line-decks)">All</button><button type="button" class="chip" style="--tab-color: var(--line-vocab)"><span class="chip__glyph" lang="ja">単</span>Vocab</button></div>
      <button type="button" class="chip">${I.cross}Cancel</button>
    </div>
  </div>
  <div class="form">
    <span class="field field--filled field--focus" style="font-family: var(--font-display);">Restaurant words</span>
    <div class="type-list">
      ${typeRow({ glyph: '札', color: 'var(--text-secondary)', label: 'Standard',   desc: 'A front and a back, written by you.' })}
      ${typeRow({ glyph: '単', color: 'var(--line-vocab)',     label: 'Vocabulary', desc: 'Vocabulary only — from JLPT levels', on: true })}
      ${typeRow({ glyph: '漢', color: 'var(--line-kanji)',     label: 'Kanji',      desc: 'Kanji only — with stroke order' })}
      ${typeRow({ glyph: '文', color: 'var(--line-grammar)',   label: 'Grammar',    desc: 'Grammar points only — from JLPT levels' })}
    </div>
    <button type="button" class="btn-primary" style="background: color-mix(in srgb, var(--deck-action) 70%, var(--bg-panel));">Create deck</button>
  </div>
</main>
${tabbar('learn', 24)}`

// ── Decks · a new card ──
const DECK_ADD = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks); gap: var(--sp-4);">
  ${plate({ code: 'KZ', kana: 'きょうざい', name: '教材', latin: 'My decks', color: 'var(--line-decks)' })}
  <div class="deck-identity">
    <span class="wmap-roundel" style="--line-color: var(--line-vocab); color: color-mix(in srgb, var(--line-vocab) 60%, var(--text-primary));" lang="ja">単</span>
    <span class="deck-identity__names"><span class="deck-identity__name" lang="ja">旅行</span><span class="deck-identity__meta">Vocabulary · 47 cards</span></span>
  </div>
  <div class="form">
    <span class="form__label">New card</span>
    <div class="form__row"><span class="field field--filled" lang="ja" style="flex: 1;">駅</span><span class="field field--filled" lang="ja" style="flex: 1; font-weight: 500;">えき</span></div>
    <span class="field field--filled field--focus" style="font-family: var(--font-display); font-weight: 500;">station</span>
    <span class="field">Note</span>
    <div class="form__row"><button type="button" class="btn-secondary" style="flex: 1;">Cancel</button><button type="button" class="btn-primary" style="flex: 1; background: color-mix(in srgb, var(--deck-action) 70%, var(--bg-panel));">Save card</button></div>
  </div>
  <span class="hint">A kanji deck's form adds the readings and a radical, picked from a sheet by stroke count.</span>
</main>
${tabbar('learn', 24)}`

// ── Reading comprehension · the result ──
const q = (n, ok, note = '') => `<div class="qrow"><span class="exam-review-row__mark ${ok ? 'exam-review-row__mark--ok' : 'exam-review-row__mark--x'}">${ok ? I.check : I.cross}</span><span class="qrow__q">Q${n}</span>${note ? `<span class="qrow__note">${note}</span>` : ''}</div>`
const COMP_RESULT = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-rikai);">
  ${stageHead({ leave: '実践', jp: '理解 N4', latin: 'Reading comprehension' })}
  <div class="result-lattice">
    <div class="record"><span class="record__value">4<span class="record__unit">/ 6</span></span><span class="record__label">Score</span></div>
    <div class="record"><span class="record__value">67<span class="record__unit">%</span></span><span class="record__label">Accuracy</span></div>
  </div>
  <div class="surface" style="display:flex;flex-direction:column;">
    ${q(1, true)}${q(2, true)}${q(3, false, 'You · B — correct · D')}${q(4, true)}${q(5, false, 'You · A — correct · C')}${q(6, true)}
  </div>
  <button type="button" class="btn-secondary">Original text</button>
  <div style="flex: 1;"></div>
  <div class="stage__foot" style="flex-direction: row; gap: var(--sp-3);">
    <button type="button" class="btn-secondary" style="flex: 1;">Change level</button>
    <button type="button" class="btn-primary" style="flex: 1;">Try again</button>
  </div>
</main>`

// ── Translation · writing ──
const TRANSLATION_WRITE = `
<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: var(--line-honyaku);">
  ${stageHead({ leave: '実践', jp: '翻訳 N3', latin: 'Translation', right: '<span class="today-remaining">2 / 5</span>' })}
  <div class="prompt-card">
    <div class="prompt-card__body prose" style="align-items: flex-start; justify-content: center; padding: var(--sp-6) var(--sp-5);">
      <span class="prose__label">EN</span>
      <span class="prose__en" style="font-size: var(--fs-title);">I think it will rain tomorrow.</span>
    </div>
    <div class="prompt-card__foot"><span lang="ja">N3 翻訳</span><span></span></div>
  </div>
  <div class="stage__foot">
    <span class="field field--focus">Write it in Japanese…</span>
    <button type="button" class="btn-primary" style="width: 100%;">Submit</button>
  </div>
</main>`

// ── Mock exam · the papers of a level ──
const paper = (n, title, jp, desc, slot = '') => `<div style="display:flex;flex-direction:column;"><button type="button" class="platform-card"><span class="platform-card__lead"><span class="platform-card__no">${n}</span><span class="platform-card__unit" lang="ja">番線</span></span><span class="platform-card__body"><span class="platform-card__title">${title}<span class="platform-card__title-jp" lang="ja">${jp}</span></span><span class="platform-card__desc">${desc}</span></span><span class="platform-card__go">▶</span></button>${slot ? `<button type="button" class="paper-slot">${slot}</button>` : ''}</div>`
const EXAM_PAPERS = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-exam); gap: var(--sp-4);">
  ${plate({ code: 'MS', kana: 'もし', name: '模試', latin: 'Mock exam', color: 'var(--line-exam)', noriba: 4 })}
  <div style="display:flex;align-items:center;gap:var(--sp-3);">
    <button type="button" class="stage__leave" style="padding-right: var(--sp-2);">${I.chevL}</button>
    <span class="cap"><span lang="ja" style="text-transform:none;letter-spacing:var(--tr-term);">N4 基礎</span> · Elementary</span>
  </div>
  <div class="platform-grid" style="gap: var(--sp-3);">
    ${paper(1, 'Vocabulary', '語彙', '21 questions')}
    ${paper(2, 'Grammar', '文法', '20 questions · Written on first open')}
    ${paper(3, 'Reading', '読解', '18 questions · sat twice', 'Different paper')}
    ${paper(4, 'Listening', '聴解', '16 questions')}
  </div>
</main>
${tabbar('practice', 24)}`

// ── Mock exam · finishing with blanks (the confirm, drawn once for all confirms) ──
const CONFIRM = `
${EXAM_RUNNER}
${sheet(`
  <div class="sheet__head"><span class="sheet__jp" style="font-size: var(--fs-lead); letter-spacing: 0;">Finish with 14 unanswered questions?</span></div>
  <p class="hint" style="font-size: var(--fs-sm);">Blank answers count as wrong. Your answers and the clock are saved if you keep working.</p>
  <button type="button" class="btn-primary" style="--line-color: var(--line-exam);">Keep working</button>
  <button type="button" class="btn-secondary">Go to first blank</button>
  <button type="button" class="btn-secondary" style="color: color-mix(in srgb, var(--danger) 60%, var(--text-primary));">Finish anyway</button>
`)}`

// ── Analyzer · photo ──
const intakeSeg = (on) => `<div class="seg seg--full seg--kaiseki">
    <button type="button" class="seg__opt${on === 'text' ? ' seg__opt--on' : ''}">${I.text}<span class="seg__opt-latin">Text</span></button>
    <button type="button" class="seg__opt${on === 'photo' ? ' seg__opt--on' : ''}">${I.camera}<span class="seg__opt-latin">Photo</span></button>
    <button type="button" class="seg__opt${on === 'video' ? ' seg__opt--on' : ''}">${I.video}<span class="seg__opt-latin">Video</span></button>
  </div>`
const ANL_PHOTO = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki); gap: var(--sp-4);">
  ${plate({ code: 'KS', kana: 'かいせき', name: '解析', latin: 'Analyzer', color: 'var(--line-kaiseki)', noriba: 3 })}
  ${intakeSeg('photo')}
  <div class="intake-pair"><button type="button" class="intake-btn">${I.camera}Shoot</button><button type="button" class="intake-btn"><svg class="svg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M21 16l-5-5-8 8"></path></svg>Choose</button></div>
  <div class="photo-frame"><i></i><i></i><i></i><i></i><span lang="ja">駅で友達を待っています。</span></div>
  <span class="field field--filled" lang="ja">駅で友達を待っています。</span>
  <span class="hint">Check the text before analyzing — OCR is not always right.</span>
  <button type="button" class="btn-primary" style="width: 100%;">Analyze</button>
</main>
${tabbar('dict', 24)}`

// ── Analyzer · video ──
const ANL_VIDEO = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki); gap: var(--sp-4);">
  ${plate({ code: 'KS', kana: 'かいせき', name: '解析', latin: 'Analyzer', color: 'var(--line-kaiseki)', noriba: 3 })}
  ${intakeSeg('video')}
  <span class="field">https://youtu.be/…</span>
  <div class="form" style="gap: var(--sp-3);">
    <span class="form__label"><span lang="ja" style="letter-spacing: var(--tr-term); text-transform: none;">字幕</span> · Subtitles</span>
    <span class="hint">Paste the link and let the bookmark fetch the subtitles — or choose a .srt, .vtt or .ass file, up to 1 MB.</span>
    <button type="button" class="btn-secondary" style="align-self: flex-start;">Choose a file</button>
  </div>
  <div class="form" style="gap: var(--sp-3);">
    <span class="form__label">Section</span>
    <div class="form__row"><span class="field" style="flex:1;">From · 00:00</span><span class="field" style="flex:1;">To · whole video</span></div>
    <span class="hint">Analysis is capped at 5 minutes and the first 40 sentences.</span>
  </div>
  <button type="button" class="btn-primary" style="width: 100%;">Analyze</button>
</main>
${tabbar('dict', 24)}`

// ── Analyzer · add to deck ──
const pick = (glyph, color, name, n) => `<button type="button" class="picker-row"><span class="wmap-roundel" style="--line-color: ${color}; color: color-mix(in srgb, ${color} 60%, var(--text-primary));" lang="ja">${glyph}</span><span class="picker-row__name" lang="ja">${name}</span><span class="picker-row__count">${n} cards</span></button>`
const DECK_PICKER = `
${ANL_RESULT}
${sheet(`
  <div class="sheet__head"><span class="sheet__jp" lang="ja">待つ</span><span class="sheet__cap">Add to deck</span></div>
  <div class="surface" style="display:flex;flex-direction:column;">
    ${pick('単', 'var(--line-vocab)', '旅行', 47)}
    ${pick('単', 'var(--line-vocab)', 'レストラン', 12)}
    ${pick('札', 'var(--text-secondary)', 'ドラマの言葉', 88)}
    <button type="button" class="picker-row">${I.plus}<span class="picker-row__name" style="font-family: var(--font-display); font-size: var(--fs-sm);">New deck</span></button>
  </div>
`)}`

// ── Settings · 行先 ──
const SETTINGS_DEST = `
${hud()}
<main class="phone__content" style="gap: var(--sp-5);">
  <div style="display:flex; align-items:flex-end; justify-content:space-between; gap: var(--sp-4);">
    <div class="stg-head"><h1 class="stg-head__jp" lang="ja">行先</h1><span class="stg-head__latin">Destination</span></div>
    <button type="button" class="stage__leave">${I.chevL}<span lang="ja">設定</span></button>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Destination</b><span class="cap">On the pass</span></div>
    <div class="onb-dests">
      <button type="button" class="onb-dest"><span class="onb-dest__code">N4</span><span class="onb-dest__jp" lang="ja">基礎</span></button>
      <button type="button" class="onb-dest onb-dest--on"><span class="onb-dest__code">N3</span><span class="onb-dest__jp" lang="ja">日常</span></button>
      <button type="button" class="onb-dest"><span class="onb-dest__code">N2</span><span class="onb-dest__jp" lang="ja">実務</span></button>
      <button type="button" class="onb-dest"><span class="onb-dest__code">N1</span><span class="onb-dest__jp" lang="ja">終着</span></button>
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Service</b><span class="cap">New items a day</span></div>
    <div class="svc-grid">
      <button type="button" class="svc"><span class="svc__jp" lang="ja">各駅停車</span><span class="svc__pace">5 / day</span></button>
      <button type="button" class="svc svc--on"><span class="svc__jp" lang="ja">快速</span><span class="svc__pace">10 / day <span class="svc__star">★</span></span></button>
      <button type="button" class="svc"><span class="svc__jp" lang="ja">特急</span><span class="svc__pace">20 / day</span></button>
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Daily ride</b><span class="cap">Optional</span></div>
    <div class="hour-grid">
      <button type="button" class="svc svc--on"><span class="svc__jp" lang="ja">朝</span><span class="svc__pace">07:30</span></button>
      <button type="button" class="svc"><span class="svc__jp" lang="ja">昼</span><span class="svc__pace">12:30</span></button>
      <button type="button" class="svc"><span class="svc__jp" lang="ja">夜</span><span class="svc__pace">21:00</span></button>
      <button type="button" class="svc"><span class="svc__jp" lang="ja">自由</span><span class="svc__pace">Flexible</span></button>
    </div>
  </div>
  <div class="jour-line" style="color: var(--text-primary);"><span class="jour-line__validity"><span lang="ja" style="color: var(--text-secondary);">有効期限</span><b>14 Mar 2027</b></span><span class="jour-cap" style="margin-left:auto; color: var(--text-secondary); text-transform:none; letter-spacing: 0.06em;">moves to 23 Mar at today's pace</span></div>
  <div class="form__row">
    <button type="button" class="btn-secondary" style="flex: 1;">Hand it back</button>
    <button type="button" class="btn-depart btn-depart--sheet" style="flex: 1;"><span class="btn-depart__jp" lang="ja">再発行</span><span class="btn-depart__latin">Reprint</span></button>
  </div>
</main>
${tabbar('profile', 24)}`

// ── The ticket office · the first ride ──
const OFFICE_RIDE = `
<main class="onb" style="gap: var(--sp-4);">
  ${onbHeader(1)}
  <span class="onb-announce" lang="ja">ご乗車ありがとうございます</span>
  <h2 class="onb-h2">Before any questions — ride once.</h2>
  <p class="onb-body">This is the whole app in one object: a card, a flip, and an honest answer. Fifteen seconds.</p>
  <div class="prompt-card" style="flex: 1 1 auto; min-height: 160px; --line-color: var(--line-vocab);">
    <span class="stage-mark stage-mark--new">New</span>
    <div class="prompt-card__body flashcard">
      <span class="char-display char-display--word" lang="ja">猫</span>
      <span class="flashcard-reading" lang="ja">ねこ</span>
      <span class="flashcard-answer">cat</span>
    </div>
  </div>
  <div class="rating-bar" style="margin-inline: 0; padding: 0; background: transparent;"><div class="rating-bar__buttons" style="background: var(--bg-panel);">
    ${[['q1', 'Wrong'], ['q2', 'Almost'], ['q3', 'Difficult'], ['q4', 'Correct']].map(([q, l]) => `<button type="button" class="rating-bar__btn rating-bar__btn--${q}"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">${l}</span></button>`).join('')}
  </div></div>
  <button type="button" class="onb-link">I know how SRS works — skip the demo</button>
</main>`

// ── The ticket office · the placement test ──
const OFFICE_TEST = `
<main class="onb" style="gap: var(--sp-4);">
  ${onbHeader(2)}
  <div style="display:flex; align-items:baseline; justify-content:space-between; gap: var(--sp-3);"><h2 class="onb-h2">The placement test</h2><span class="today-remaining">3 / 12</span></div>
  <div class="deck-progress"><span class="deck-progress__segment" style="width: 25%; background: var(--pass-ink);"></span></div>
  <span class="cap"><span lang="ja" style="text-transform:none;letter-spacing:var(--tr-term);">語彙</span> · How is this word read?</span>
  <div class="prompt-card" style="flex: none; min-height: 0;">
    <div class="prompt-card__body" style="padding: var(--sp-5);"><span class="char-display char-display--word" lang="ja">駅</span></div>
  </div>
  <div class="mcq-list" style="--line-color: var(--pass-ink);">
    ${[['1', 'えき'], ['2', 'えぎ'], ['3', 'うま'], ['4', 'やく']].map(([l, t], i) => `<button type="button" class="mcq-row${i === 0 ? ' mcq-row--selected' : ''}"><span class="mcq-row__accent"></span><span class="mcq-row__index">${l}</span><span class="mcq-row__text mcq-row__text--jp" lang="ja">${t}</span></button>`).join('')}
  </div>
  <button type="button" class="onb-link">Stop here — place me on what I've answered</button>
</main>`

// ── The ticket office · the promise ──
const OFFICE_PROMISE = `
<main class="onb" style="gap: var(--sp-4);">
  ${onbHeader(4)}
  <h2 class="onb-h2">The map that will tell you the truth.</h2>
  <p class="onb-body">Your line is printed on the back of your pass. Two cars ride it: your train, and a dashed one showing where 10 a day says you should be. Turn the pass over, any day, and the map answers.</p>
  <div class="jour-rev jour-st--onTime" style="gap: var(--sp-3); padding: var(--sp-5);">
    <div class="jour-rev__head"><span class="jour-rev__title"><span class="jour-cap">Your line · N5 → N3 · example</span></span></div>
    <div class="jour-track" style="height: 132px;">
      <span class="jour-track__span">
        <span class="jour-track__rail"></span>
        <span class="jour-track__done" style="width: 12%"></span>
        <span class="jour-track__station jour-track__station--past" style="left: 0%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N5</span></span>
        <span class="jour-track__station" style="left: 50%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N4</span></span>
        <span class="jour-track__station" style="left: 100%"><i></i><span class="jour-track__station-name jour-track__station-name--latin">N3</span></span>
        <span class="jour-track__you" style="left: 12%"><span class="jour-track__tag">You</span><i></i></span>
        <span class="jour-track__plan" style="left: 18%"><i></i><span class="jour-track__tag">Plan</span></span>
        <span class="jour-track__gap" style="left: 12%; width: 6%; top: 110px;"><b>6d</b></span>
      </span>
    </div>
    <p class="jour-rev__foot">Drift, and the map says so — <b>in days, not guilt</b> — with the two honest fixes one tap away: run a faster service, or reprint the date in ink. It never moves on its own.</p>
  </div>
  <p class="onb-body">Four lines serve this station once you're through:</p>
  <div class="onb-roundels"><span class="wmap-roundel" style="--line-color: var(--line-kana); color: var(--line-kana);">KN</span><span class="wmap-roundel" style="--line-color: var(--line-vocab); color: var(--line-vocab);">TG</span><span class="wmap-roundel" style="--line-color: var(--line-kanji); color: var(--line-kanji);">KJ</span><span class="wmap-roundel" style="--line-color: var(--line-grammar); color: var(--line-grammar);">BP</span></div>
  <button type="button" class="onb-action">Continue</button>
</main>`

// ── The ticket office · the application form ──
const OFFICE_PASS = `
<main class="onb" style="gap: var(--sp-4);">
  ${onbHeader(5)}
  <span class="onb-announce" lang="ja">まもなく発車します</span>
  <h2 class="onb-h2">Sign, and the office prints.</h2>
  <div class="onb-form">
    <span class="onb-form__seal" lang="ja">印</span>
    <div class="onb-form__head"><span class="onb-form__jp" lang="ja">定期券申込書</span><span class="onb-form__latin">Pass application</span></div>
    <div class="onb-form__row"><span class="onb-form__label"><b lang="ja">氏名</b><span>Name</span></span><span class="onb-form__value">Aiko</span></div>
    <div class="onb-form__row"><span class="onb-form__label"><b lang="ja">発車時刻</b><span>Daily ride</span></span>
      <div class="hour-grid"><button type="button" class="hour hour--on"><b lang="ja">朝</b>07:30</button><button type="button" class="hour"><b lang="ja">昼</b>12:30</button><button type="button" class="hour"><b lang="ja">夜</b>21:00</button><button type="button" class="hour"><b lang="ja">自由</b>Flexible</button></div>
    </div>
    <div class="onb-form__row"><span class="onb-form__label"><b lang="ja">申込日</b><span>Date</span></span><span class="onb-form__value" style="font-family: var(--font-display); font-size: var(--fs-body); font-variant-numeric: tabular-nums;">5 Sep 2026</span></div>
  </div>
  <p class="onb-body">A daily hour is optional — but a promise with a time of day is twice as likely to survive its first rainy week.</p>
  <button type="button" class="onb-action">Print the pass <span lang="ja" style="margin-left: var(--sp-2); font-family: var(--font-jp);">発行</span></button>
</main>`

return [
  ['TodayOutOfCredits',   TODAY_OUT,         'Today · no credits left',           'today'],
  ['RunCloze',            RUN_CLOZE,         'In a run · fill in',                'today'],
  ['RunBrowse',           RUN_BROWSE,        'In a run · fast review',            'today'],
  ['Reissue',             REISSUE,           'In a run · the rank reissued',      'today'],
  ['RunOutOfCredits',     RUN_OUT,           'In a run · out of credits',         'today'],
  ['StationTiers',        STATION_TIERS,     'Station · 漢字 by frequency',       'learn'],
  ['DeckCreate',          DECK_CREATE,       'My decks · create',                 'learn'],
  ['DeckAddCard',         DECK_ADD,          'My decks · a new card',             'learn'],
  ['ComprehensionResult', COMP_RESULT,       'Reading comprehension · result',    'practice'],
  ['TranslationWrite',    TRANSLATION_WRITE, 'Translation · writing',             'practice'],
  ['ExamPapers',          EXAM_PAPERS,       'Mock exam · the papers',            'practice'],
  ['ConfirmSheet',        CONFIRM,           'Mock exam · finish with blanks',    'practice'],
  ['AnalyzerPhoto',       ANL_PHOTO,         'Analyzer · photo',                  'dict'],
  ['AnalyzerVideo',       ANL_VIDEO,         'Analyzer · video',                  'dict'],
  ['DeckPickerSheet',     DECK_PICKER,       'Analyzer · add to deck',            'dict'],
  ['SettingsDestination', SETTINGS_DEST,     'Settings · destination',            'pass'],
  ['OfficeRide',          OFFICE_RIDE,       'Ticket office · first ride',        'arrival'],
  ['OfficeTest',          OFFICE_TEST,       'Ticket office · placement test',    'arrival'],
  ['OfficePromise',       OFFICE_PROMISE,    'Ticket office · the promise',       'arrival'],
  ['OfficePass',          OFFICE_PASS,       'Ticket office · the application',   'arrival'],
]
}

// ── States, on the chrome page: loading, empty, error, no results, a wrong answer, the closed gate, six grades ──
const col = (label, inner, w = 340) => `<div class="spec__item" style="width: ${w}px;"><span class="spec__label">${label}</span>${inner}</div>`
export const STATES_BODY = `
<div class="spec">
  <div class="spec__row">
    ${col('Loading', `<div class="surface loading"><i></i><i></i><i></i></div>`)}
    ${col('Empty', `<div class="empty"><span class="empty__icon"><svg class="svg" viewBox="0 0 24 24"><path d="M4 5h6v14H4zM10 5h6v14h-6zM16 7l4-1v13l-4 1z"></path></svg></span><span class="empty__msg">No decks yet.</span><span class="empty__hint">Create your first deck above.</span></div>`)}
    ${col('Error', `<div class="empty" style="border-color: color-mix(in srgb, var(--danger) 45%, transparent);"><span class="empty__icon" style="color: color-mix(in srgb, var(--danger) 60%, var(--text-primary));">${I.warn}</span><span class="empty__msg">That did not work</span><span class="empty__hint">Check your connection — your progress is safe.</span><button type="button" class="btn-secondary">Try again</button></div>`)}
  </div>
  <div class="spec__row">
    ${col('No results', `<div class="empty"><span class="empty__msg">No results for « sanx »</span><span class="empty__hint">Try another reading, or clear the filters.</span><button type="button" class="btn-secondary">Clear filters</button></div>`)}
    ${col('A wrong answer', `<div class="mcq-list" style="--line-color: var(--line-kanji);"><button type="button" class="mcq-row mcq-row--correct"><span class="mcq-row__accent"></span><span class="mcq-row__index">01</span><span class="mcq-row__text">station</span></button><button type="button" class="mcq-row mcq-row--wrong"><span class="mcq-row__accent"></span><span class="mcq-row__index">02</span><span class="mcq-row__text">bridge</span></button><button type="button" class="mcq-row mcq-row--filler"><span class="mcq-row__accent"></span><span class="mcq-row__index">03</span><span class="mcq-row__text">town</span></button></div><p class="spec__note" style="margin-top: var(--sp-3);">The pick goes danger, the right row success, the rest fall back — then the bar takes the rating.</p>`)}
    ${col('The closed gate', `<button type="button" class="btn-depart btn-depart--off" style="width: 100%;"><span class="btn-depart__jp" lang="ja">出発する</span><span class="btn-depart__latin">Depart</span><span class="btn-depart__go">▶</span></button><p class="spec__note" style="margin-top: var(--sp-3);">Disabled is opacity 0.45 and nothing else — the one disabled treatment.</p>`)}
  </div>
  <div class="spec__row">
    ${col('Six grades — the bar wraps two by three', `<div class="rating-bar" style="margin-inline: 0; padding: var(--sp-3); border-radius: var(--r-panel);"><div class="rating-bar__buttons rating-bar__buttons--6">${[['q0', 'Blackout'], ['q1', 'Wrong'], ['q2', 'Almost'], ['q3', 'Difficult'], ['q4', 'Correct'], ['q5', 'Perfect']].map(([q, l]) => `<button type="button" class="rating-bar__btn rating-bar__btn--${q}"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">${l}</span></button>`).join('')}</div></div>`, 390)}
    ${col('Reading the sheet', `<p class="spec__note">Loading is three gold dots, no spinner. An empty state names what is missing and the one thing to do about it. An error owns up and offers the retry; nothing else moves. A wrong pick is the only time danger appears on a card. The closed gate keeps its shape.</p>`, 520)}
  </div>
</div>`
