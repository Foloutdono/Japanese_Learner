// The third wave, English-first: the paywall moments, the last card faces,
// the rank, the paper picker, the tiers, deck authoring, the other intakes,
// the destination slip, the readings sheet, the confirms and the states.
import { hud, tabbar, header, back, I, credits } from './parts.mjs'
import { EXAM_RUNNER, ANL_RESULT, stageHead, progress, ratingBar, runRight, DECKS_CONSOLE, DECK_IDENTITY, stgHead } from './screens2.mjs'

const sheet = (inner, extra = '') => `<div class="scrim"></div><div class="sheet${extra}"><span class="sheet__handle"></span>${inner}</div>`
const goUnlimited = `<button type="button" class="btn-depart btn-depart--sheet"><span class="btn-depart__jp">Go unlimited</span><span class="btn-depart__go">▶</span></button>`
const stageWrap = (color, inner) => `<main class="stage" style="padding-top: calc(var(--safe-top) + var(--sp-3)); --line-color: ${color};">${inner}</main>`

export function SCREENS3({ TODAY_BODY, RUN_BODY, ANL_DOOR, intakeSeg }) {

// ── Today · no credits left ──
const TODAY_OUT = TODAY_BODY({ hud: { cr: 0 }, gate: { total: 24, balance: 0 } })

// ── In a run · the balance runs out mid-run ──
const RUN_OUT = `
${RUN_BODY}
${sheet(`
  <div class="sheet__head"><span class="sheet__jp">Balance</span></div>
  <div class="balance">
    <span class="balance__fig" style="color: color-mix(in srgb, var(--danger) 60%, var(--text-primary));">0<span class="balance__unit">credits</span></span>
    <span class="balance__of"><span>12 cleared</span><span style="font-weight:600;">12 wait for tomorrow</span></span>
  </div>
  <div class="balance__track"><span class="balance__fill" style="width: 0%"></span></div>
  <div class="balance__rows"><div class="balance__cell"><b>+30<span>daily</span></b><span class="cap">Refill at 00:00</span></div><div class="balance__cell"><b>∞</b><span class="cap">Unlimited pass</span></div></div>
  <button type="button" class="btn-depart btn-depart--ghost"><span class="btn-depart__jp">Back to the station</span></button>
  ${goUnlimited}
`)}`

// ── In a run · fill in (grammar) ──
const RUN_CLOZE = stageWrap('var(--line-grammar)', `
  ${stageHead({ title: 'Grammar N4', latin: 'Fill in', right: runRight(16, 22) })}
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
    <div class="prompt-card__foot"><span>N4 · Grammar</span><span>Fill in</span></div>
  </div>
  <div class="stage__foot">
    <span class="field field--filled field--focus" lang="ja">そう</span>
    <button type="button" class="btn-primary" style="width: 100%;">Submit</button>
  </div>`)

// ── In a run · fast review, ungraded ──
const RUN_BROWSE = stageWrap('var(--line-kanji)', `
  ${stageHead({ leave: 'Kanji', title: 'Kanji N4', latin: 'Fast review', right: '<span class="today-remaining">12 / 48</span>' })}
  <div class="prompt-card">
    <span class="stage-mark stage-mark--mastered">Mastered</span>
    <div class="prompt-card__body flashcard">
      <span class="char-display" lang="ja">駅</span>
      <span class="flashcard-answer">station</span>
      <span class="flashcard-reading" lang="ja">エキ · えき</span>
    </div>
    <div class="prompt-card__foot"><span>N4 · Kanji</span><span>Nothing is graded</span></div>
  </div>
  <div class="stage__foot browse-nav">
    <button type="button" class="btn-secondary">${I.chevL}Previous</button>
    <button type="button" class="btn-primary">Next${I.chevR}</button>
  </div>`)

// ── In a run · the rank is reissued, and waits to be claimed ──
const REISSUE = `
${RUN_BODY}
<div class="reissue">
  <div class="reissue__scrim"></div>
  <div class="reissue__pass">
    <span class="reissue__cap"><b>Reissued</b></span>
    <span class="reissue__name">Aiko</span>
    <span class="reissue__from">Rōnin</span>
    <span class="reissue__rank" lang="ja">侍</span>
    <span class="reissue__latin">Samurai</span>
    <span class="pass__level" style="align-items: center; margin-top: var(--sp-2);"><span class="pass__level-num" style="color: var(--text-primary);">12</span><span class="pass__level-label" style="color: var(--text-secondary);">Level</span></span>
    <button type="button" class="btn-depart" style="width: 100%; margin-top: var(--sp-3);"><span class="btn-depart__jp">Claim</span><span class="btn-depart__go">▶</span></button>
  </div>
</div>`

// ── A station · word-frequency tiers ──
const tier = (n, range, count) => `<button type="button" class="platform-card"><span class="platform-card__lead"><span class="platform-card__no">${n}</span></span><span class="platform-card__body"><span class="platform-card__title">${range}</span><span class="platform-card__desc">${count} kanji</span></span><span class="platform-card__go">▶</span></button>`
const STATION_TIERS = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kanji);">
  ${header({ code: 'KJ', title: 'Kanji', sub: 'By frequency', color: 'var(--line-kanji)', aside: '<button type="button" class="cap" style="text-decoration: underline; text-underline-offset: 3px;">JLPT instead</button>' })}
  <div style="display:flex; align-items:center; gap: var(--sp-4);"><span class="cap" style="flex:none;">Tier size</span><div class="seg seg--full"><button type="button" class="seg__opt"><span class="seg__opt-latin">100</span></button><button type="button" class="seg__opt seg__opt--on"><span class="seg__opt-latin">200</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">500</span></button><button type="button" class="seg__opt"><span class="seg__opt-latin">1000</span></button></div></div>
  <div class="platform-grid" style="gap: var(--sp-3);">
    ${tier(1, '1–200', 200)}${tier(2, '201–400', 200)}${tier(3, '401–600', 200)}${tier(4, '601–800', 200)}${tier(5, '801–1000', 200)}
  </div>
</main>
${tabbar('learn', 24)}`

// ── Decks · create ──
const typeRow = ({ glyph, color, label, desc, on = false }) => `<button type="button" class="type-row${on ? ' type-row--on' : ''}"><span class="chip__glyph" lang="ja" style="--tab-color: ${color}; width: 28px; height: 28px; font-size: 13px;">${glyph}</span><span class="type-row__names"><span class="type-row__label">${label}</span><span class="type-row__desc">${desc}</span></span></button>`
const DECK_CREATE = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-decks);">
  ${header({ code: 'KZ', title: 'My decks', color: 'var(--line-decks)', aside: `<button type="button" class="chip">${I.cross}Cancel</button>` })}
  ${DECKS_CONSOLE()}
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
<main class="phone__content" style="--line-color: var(--line-decks);">
  ${header({ code: 'KZ', title: 'My decks', color: 'var(--line-decks)', aside: back('Deck') })}
  ${DECK_IDENTITY('Vocabulary · 47 cards', false)}
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
const COMP_RESULT = stageWrap('var(--line-rikai)', `
  ${stageHead({ leave: 'Practice', title: 'Comprehension', latin: 'N4 · Result' })}
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
  </div>`)

// ── Translation · writing ──
const TRANSLATION_WRITE = stageWrap('var(--line-honyaku)', `
  ${stageHead({ leave: 'Practice', title: 'Translation', latin: 'N3 · 2 of 5', right: '<span class="today-remaining">2 / 5</span>' })}
  <div class="prompt-card">
    <div class="prompt-card__body prose" style="align-items: flex-start; justify-content: center; padding: var(--sp-6) var(--sp-5);">
      <span class="prose__label">EN</span>
      <span class="prose__en" style="font-size: var(--fs-title);">I think it will rain tomorrow.</span>
    </div>
    <div class="prompt-card__foot"><span>N3 · Translation</span><span></span></div>
  </div>
  <div class="stage__foot">
    <span class="field field--focus">Write it in Japanese…</span>
    <button type="button" class="btn-primary" style="width: 100%;">Submit</button>
  </div>`)

// ── Mock exam · the papers of a level ──
const paper = (n, title, desc, slot = '') => `<div style="display:flex;flex-direction:column;"><button type="button" class="platform-card"><span class="platform-card__lead"><span class="platform-card__no">${n}</span></span><span class="platform-card__body"><span class="platform-card__title">${title}</span><span class="platform-card__desc">${desc}</span></span><span class="platform-card__go">▶</span></button>${slot ? `<button type="button" class="paper-slot">${slot}</button>` : ''}</div>`
const EXAM_PAPERS = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-exam);">
  ${header({ code: 'MS', title: 'Mock exam', sub: 'N4', color: 'var(--line-exam)', aside: back('Levels') })}
  <div class="platform-grid" style="gap: var(--sp-3);">
    ${paper(1, 'Vocabulary', '21 questions')}
    ${paper(2, 'Grammar', '20 questions · written on first open')}
    ${paper(3, 'Reading', '18 questions · sat twice', 'Different paper')}
    ${paper(4, 'Listening', '16 questions')}
  </div>
</main>
${tabbar('practice', 24)}`

// ── Mock exam · finishing with blanks (the confirm, drawn once for all confirms) ──
const CONFIRM = `
${EXAM_RUNNER}
${sheet(`
  <div class="sheet__head"><span class="sheet__jp" style="font-size: var(--fs-lead);">Finish with 14 unanswered questions?</span></div>
  <p class="hint" style="font-size: var(--fs-sm);">Blank answers count as wrong. Your answers and the clock are saved if you keep working.</p>
  <button type="button" class="btn-primary" style="--line-color: var(--line-exam);">Keep working</button>
  <button type="button" class="btn-secondary">Go to first blank</button>
  <button type="button" class="btn-secondary" style="color: color-mix(in srgb, var(--danger) 60%, var(--text-primary));">Finish anyway</button>
`)}`

// ── Analyzer · photo ──
const ANL_PHOTO = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki);">
  ${header({ code: 'KS', title: 'Analyzer', color: 'var(--line-kaiseki)', aside: back('Dictionary') })}
  ${intakeSeg('photo')}
  <div class="intake-pair"><button type="button" class="intake-btn">${I.camera}Shoot</button><button type="button" class="intake-btn">${I.image}Choose</button></div>
  <div class="photo-frame"><i></i><i></i><i></i><i></i><span lang="ja">駅で友達を待っています。</span></div>
  <span class="field field--filled" lang="ja">駅で友達を待っています。</span>
  <span class="hint">Check the text before analyzing — OCR is not always right.</span>
  <button type="button" class="btn-primary" style="width: 100%;">Analyze</button>
</main>
${tabbar('dict', 24)}`

// ── Analyzer · video ──
const ANL_VIDEO = `
${hud()}
<main class="phone__content" style="--line-color: var(--line-kaiseki);">
  ${header({ code: 'KS', title: 'Analyzer', color: 'var(--line-kaiseki)', aside: back('Dictionary') })}
  ${intakeSeg('video')}
  <span class="field">https://youtu.be/…</span>
  <div class="form" style="gap: var(--sp-3);">
    <span class="form__label">Subtitles</span>
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

// ── The readings sheet: every reading, with the words that use it ──
const rword = (jp, hit, gloss) => `<div class="dict-word dict-word--static"><span class="dict-word__jp" lang="ja">${jp.replace(hit, `<span class="dict-word__hit">${hit}</span>`)}</span><span class="dict-word__gloss">${gloss}</span></div>`
const DICT_READINGS = `
<div style="height: var(--safe-top); flex: none; background: var(--surface);"></div>
<article class="dict-entry">
  <header class="dict-plate">
    <div class="dict-plate__row">
      <div class="dict-plate__marks"><span class="dict-readings__glyph" lang="ja">三</span><span class="dict-readings__title">All readings</span></div>
      <div class="dict-plate__actions"><button type="button" class="dict-plate__btn">${I.cross}</button></div>
    </div>
    <div class="dict-plate__stripe"></div>
  </header>
  <div class="dict-entry__body">
    <section class="dict-block dict-register">
      <div class="dict-register__head"><span class="dict-kind" lang="ja">音</span><span class="dict-readings__title">on'yomi</span></div>
      <div class="dict-reading"><span class="dict-reading__yomi" lang="ja">サン</span><div class="dict-words">${rword('三人', '三', 'three people')}${rword('三角', '三', 'triangle')}</div></div>
      <ul class="dict-register__rest"><li class="dict-register__chip" lang="ja">ゾウ</li></ul>
    </section>
    <section class="dict-block dict-register">
      <div class="dict-register__head"><span class="dict-kind" lang="ja">訓</span><span class="dict-readings__title">kun'yomi</span></div>
      <div class="dict-reading"><span class="dict-reading__yomi" lang="ja">み</span><div class="dict-words">${rword('三つ', '三', 'three (things)')}</div></div>
      <div class="dict-reading"><span class="dict-reading__yomi" lang="ja">みっ</span><div class="dict-words">${rword('三日', '三', 'the third day')}</div></div>
      <ul class="dict-register__rest"><li class="dict-register__chip" lang="ja">み・つ</li><li class="dict-register__chip" lang="ja">みっ・つ</li></ul>
    </section>
    <div class="dict-block"><button type="button" class="btn-secondary" style="width: 100%;">Close</button></div>
  </div>
</article>`

// ── Settings · destination ──
const SETTINGS_DEST = `
${hud()}
<main class="phone__content">
  ${stgHead('Destination', 'Settings')}
  <div class="slip">
    <div class="slip__label"><b>Destination</b><span class="cap">On the pass</span></div>
    <div class="onb-dests">
      <button type="button" class="onb-dest"><span class="onb-dest__code">N4</span><span class="onb-dest__load">Elementary</span></button>
      <button type="button" class="onb-dest onb-dest--on"><span class="onb-dest__code">N3</span><span class="onb-dest__load">Intermed.</span></button>
      <button type="button" class="onb-dest"><span class="onb-dest__code">N2</span><span class="onb-dest__load">Advanced</span></button>
      <button type="button" class="onb-dest"><span class="onb-dest__code">N1</span><span class="onb-dest__load">Proficient</span></button>
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Service</b><span class="cap">New items a day</span></div>
    <div class="svc-grid">
      <button type="button" class="svc"><span class="svc__jp">Local</span><span class="svc__pace">5 / day</span></button>
      <button type="button" class="svc svc--on"><span class="svc__jp">Rapid</span><span class="svc__pace">10 / day <span class="svc__star">★</span></span></button>
      <button type="button" class="svc"><span class="svc__jp">Express</span><span class="svc__pace">20 / day</span></button>
    </div>
  </div>
  <div class="slip">
    <div class="slip__label"><b>Daily ride</b><span class="cap">Optional</span></div>
    <div class="hour-grid">
      <button type="button" class="svc svc--on"><span class="svc__jp">Morning</span><span class="svc__pace">07:30</span></button>
      <button type="button" class="svc"><span class="svc__jp">Noon</span><span class="svc__pace">12:30</span></button>
      <button type="button" class="svc"><span class="svc__jp">Evening</span><span class="svc__pace">21:00</span></button>
      <button type="button" class="svc"><span class="svc__jp">Flexible</span><span class="svc__pace">any time</span></button>
    </div>
  </div>
  <div class="jour-line" style="color: var(--text-primary);"><span class="jour-line__validity"><span class="jour-cap" style="color: var(--text-secondary);">Valid until</span><b>14 Mar 2027</b></span><span class="jour-cap" style="margin-left:auto; color: var(--text-secondary); text-transform:none; letter-spacing: 0.06em;">moves to 23 Mar at today's pace</span></div>
  <div class="form__row">
    <button type="button" class="btn-secondary" style="flex: 1;">Hand it back</button>
    <button type="button" class="btn-depart btn-depart--sheet" style="flex: 1;"><span class="btn-depart__jp">Reprint</span></button>
  </div>
</main>
${tabbar('profile', 24)}`

return [
  ['TodayOutOfCredits',   TODAY_OUT,         'Today · no credits left',           'today'],
  ['RunCloze',            RUN_CLOZE,         'In a run · fill in',                'today'],
  ['RunBrowse',           RUN_BROWSE,        'In a run · fast review',            'today'],
  ['Reissue',             REISSUE,           'In a run · the rank reissued',      'today'],
  ['RunOutOfCredits',     RUN_OUT,           'In a run · out of credits',         'today'],
  ['StationTiers',        STATION_TIERS,     'Station · Kanji by frequency',      'learn'],
  ['DeckCreate',          DECK_CREATE,       'My decks · create',                 'learn'],
  ['DeckAddCard',         DECK_ADD,          'My decks · a new card',             'learn'],
  ['ComprehensionResult', COMP_RESULT,       'Reading comprehension · result',    'practice'],
  ['TranslationWrite',    TRANSLATION_WRITE, 'Translation · writing',             'practice'],
  ['ExamPapers',          EXAM_PAPERS,       'Mock exam · the papers',            'practice'],
  ['ConfirmSheet',        CONFIRM,           'Mock exam · finish with blanks',    'practice'],
  ['AnalyzerPhoto',       ANL_PHOTO,         'Analyzer · photo',                  'dict'],
  ['AnalyzerVideo',       ANL_VIDEO,         'Analyzer · video',                  'dict'],
  ['DeckPickerSheet',     DECK_PICKER,       'Analyzer · add to deck',            'dict'],
  ['DictionaryReadings',  DICT_READINGS,     'Dictionary · all readings',         'dict'],
  ['SettingsDestination', SETTINGS_DEST,     'Settings · destination',            'pass'],
]
}

// ── States, on the chrome page ──
const col = (label, inner, w = 340) => `<div class="spec__item" style="width: ${w}px;"><span class="spec__label">${label}</span>${inner}</div>`
export const STATES_BODY = `
<div class="spec">
  <div class="spec__row">
    ${col('Loading', `<div class="surface loading"><i></i><i></i><i></i></div>`)}
    ${col('Empty', `<div class="empty"><span class="empty__icon">${I.books}</span><span class="empty__msg">No decks yet.</span><span class="empty__hint">Create your first deck above.</span></div>`)}
    ${col('Error', `<div class="empty" style="border-color: color-mix(in srgb, var(--danger) 45%, transparent);"><span class="empty__icon" style="color: color-mix(in srgb, var(--danger) 60%, var(--text-primary));">${I.warn}</span><span class="empty__msg">That did not work</span><span class="empty__hint">Check your connection — your progress is safe.</span><button type="button" class="btn-secondary">Try again</button></div>`)}
  </div>
  <div class="spec__row">
    ${col('No results', `<div class="empty"><span class="empty__msg">No results for « sanx »</span><span class="empty__hint">Try another reading, or clear the filters.</span><button type="button" class="btn-secondary">Clear filters</button></div>`)}
    ${col('A wrong answer', `<div class="mcq-list" style="--line-color: var(--line-kanji);"><button type="button" class="mcq-row mcq-row--correct"><span class="mcq-row__accent"></span><span class="mcq-row__index">01</span><span class="mcq-row__text">station</span></button><button type="button" class="mcq-row mcq-row--wrong"><span class="mcq-row__accent"></span><span class="mcq-row__index">02</span><span class="mcq-row__text">bridge</span></button><button type="button" class="mcq-row mcq-row--filler"><span class="mcq-row__accent"></span><span class="mcq-row__index">03</span><span class="mcq-row__text">town</span></button></div><p class="spec__note" style="margin-top: var(--sp-3);">The pick goes danger, the right row success, the rest fall back — then the bar takes the rating.</p>`)}
    ${col('The closed gate', `<button type="button" class="btn-depart btn-depart--off" style="width: 100%;"><span class="btn-depart__jp">Depart</span><span class="btn-depart__go">▶</span></button><p class="spec__note" style="margin-top: var(--sp-3);">Disabled is opacity 0.45 and nothing else — the one disabled treatment.</p>`)}
  </div>
  <div class="spec__row">
    ${col('Six grades — the bar wraps two by three', `<div class="rating-bar" style="margin-inline: 0; padding: var(--sp-3); border-radius: var(--r-panel);"><div class="rating-bar__buttons rating-bar__buttons--6">${[['q0', 'Blackout'], ['q1', 'Wrong'], ['q2', 'Almost'], ['q3', 'Difficult'], ['q4', 'Correct'], ['q5', 'Perfect']].map(([q, l]) => `<button type="button" class="rating-bar__btn rating-bar__btn--${q}"><span class="rating-bar__btn-ring"></span><span class="rating-bar__btn-label">${l}</span></button>`).join('')}</div></div>`, 390)}
    ${col('Reading the sheet', `<p class="spec__note">Loading is three gold dots, no spinner. An empty state names what is missing and the one thing to do about it. An error owns up and offers the retry; nothing else moves. A wrong pick is the only time danger appears on a card. The closed gate keeps its shape.</p>`, 520)}
  </div>
</div>`
