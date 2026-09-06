// The boarding — the onboarding, mobile first. The owner's sketch is the
// backbone: thirteen screens from the first contact to the pass, the kana
// check branching once. English only; Japanese is content (the kana, the
// cards, the rank, the seal). One movement per screen, CSS only, each
// resting on a state that reads on its own. The title sits under the head,
// the content takes the room in between, the action is always at the foot.
import { I, pass } from './parts.mjs'

const svg = (d) => `<svg class="svg" viewBox="0 0 24 24">${d}</svg>`
const IC = {
  book:    svg('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"></path><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"></path>'),
  spark:   svg('<path d="M12 3l2.3 5.7L20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3z"></path>'),
  case:    svg('<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V4h6v3"></path><line x1="3" y1="12" x2="21" y2="12"></line>'),
  home:    svg('<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path><path d="M10 20v-6h4v6"></path>'),
  friends: svg('<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><circle cx="17" cy="9" r="2.8"></circle><path d="M15.5 15.6a5 5 0 0 1 6 4.4"></path>'),
}

// ── the frame: back · the track · the count; title; the stage; the docked foot ──
const STEPS = 8
const head = (step) => `<div class="brd__head">
  <button type="button" class="brd__back" aria-label="Back">${I.chevL}</button>
  <div class="brd__track" role="progressbar" aria-valuemin="0" aria-valuemax="${STEPS}" aria-valuenow="${step}"><div class="brd__done" style="width: ${Math.round(100 * step / STEPS)}%;"></div><span class="brd__train" style="left: ${Math.round(100 * step / STEPS)}%;"></span></div>
  <span class="brd__count">${step}/${STEPS}</span>
</div>`
const body = (inner, variant = '') => `<div class="brd__body${variant ? ` brd__body--${variant}` : ''}">${inner}</div>`
const stage = (inner) => `<div class="brd__stage">${inner}</div>`
const q = (html) => `<h1 class="brd__q">${html}</h1>`
const depart = (label, extra = '') => `<button type="button" class="btn-depart${extra}"><span class="btn-depart__jp">${label}</span><span class="btn-depart__go">▶</span></button>`
const foot = (cta, link = '', fine = '') => `<div class="brd__foot">${cta}${fine ? `<span class="brd__fine">${fine}</span>` : ''}${link ? `<button type="button" class="brd__link">${link}</button>` : ''}</div>`
const opt = ({ on = false, icon = '', code = '', label, desc = '', tag = '' }) => `<button type="button" class="brd-opt${on ? ' brd-opt--on' : ''}" aria-pressed="${on}">
  ${icon ? `<span class="brd-opt__icon">${icon}</span>` : ''}${code ? `<span class="brd-opt__code">${code}</span>` : ''}
  <span class="brd-opt__names"><span class="brd-opt__label">${label}${tag ? `<span class="brd-tag">${tag}</span>` : ''}</span>${desc ? `<span class="brd-opt__desc">${desc}</span>` : ''}</span>
  <span class="brd-opt__check">${I.check}</span>
</button>`

// ── 1 · welcome: the sign, two lanes of rolling stock, one door ──
// Every card's text lives in one block (.brd-demo__t) so spans and line breaks flow as text.
const demo = ({ color, tag, big = '', small = '', cap = '', wave = false, draw = false, meaning, foot }) => {
  const inner = draw
    ? '<span class="brd-demo__draw"><svg viewBox="0 0 100 100"><path d="M30 28h40M50 28v44M32 72h36"></path></svg></span>'
    : wave
      ? '<span class="brd-demo__wave"><i></i><i></i><i></i><i></i><i></i><i></i></span>'
      : `<span class="brd-demo__glyph"><span class="brd-demo__t${small ? ' brd-demo__t--sm' : ''}" lang="ja">${cap ? `<span class="brd-demo__t--cap" lang="en">${cap}</span>` : ''}${big || small}</span></span>`
  return `<div class="brd-demo" style="--line-color: ${color};">
  <span class="brd-demo__tag">${tag}</span>${inner}
  <span class="brd-demo__meaning">${meaning}</span><span class="brd-demo__foot">${foot}</span>
</div>`
}
const DEMOS = [
  demo({ color: 'var(--line-kanji)',   tag: 'Kanji',      big: '駅',          meaning: 'station', foot: 'Kanji → meaning' }),
  demo({ color: 'var(--line-vocab)',   tag: 'Vocabulary', big: '食べる',      meaning: 'to eat',  foot: 'Word → meaning' }),
  demo({ color: 'var(--line-grammar)', tag: 'Grammar',    small: '雨が降り<span class="cloze">そう</span>です。', meaning: 'Fill in', foot: 'Rule → sentence' }),
  demo({ color: 'var(--line-kanji)',   tag: 'Kanji',      draw: true,        meaning: 'craft',   foot: 'Meaning → kanji' }),
  demo({ color: 'var(--line-exam)',    tag: 'Listening',  wave: true,        meaning: 'Listen',  foot: 'Sound → meaning' }),
  demo({ color: 'var(--line-reading)', tag: 'Reading',    small: '駅で友達を待っています。', meaning: 'Read it', foot: 'Sentence → meaning' }),
].join('')
const DEMOS2 = [
  demo({ color: 'var(--line-vocab)',   tag: 'Vocabulary', big: '切符',        meaning: 'ticket',   foot: 'Word → meaning' }),
  demo({ color: 'var(--line-kanji)',   tag: 'Kanji',      big: '山',          meaning: 'mountain', foot: 'Kanji → reading' }),
  demo({ color: 'var(--line-reading)', tag: 'Reading',    small: '明日は雨が降ると思う。', meaning: 'Read it', foot: 'Sentence → meaning' }),
  demo({ color: 'var(--line-grammar)', tag: 'Grammar',    small: '駅まで<span class="cloze">歩いて</span>行きます。', meaning: 'Fill in', foot: 'Rule → sentence' }),
  demo({ color: 'var(--line-kana)',    tag: 'Kana',       big: 'きっぷ',      meaning: 'ki · p · pu', foot: 'Kana → sound' }),
  demo({ color: 'var(--line-exam)',    tag: 'Mock exam',  small: '毎朝、駅まで＿＿歩きます。', cap: 'Part 3 · Q7', meaning: '24:18', foot: 'Timed paper' }),
].join('')
const WELCOME = `
<main class="brd" style="gap: var(--sp-4);">
  ${body(`
  <div class="brd-hero">
    <span class="auth-header__glyph" lang="ja">日本語</span>
    ${q('Learn Japanese', true)}
  </div>
  <div class="brd-roll"><div class="brd-roll__lane">${DEMOS}${DEMOS}</div><div class="brd-roll__lane brd-roll__lane--back">${DEMOS2}${DEMOS2}</div></div>
  <p class="brd-tagline">Take the train to proficiency.</p>`, 'top')}
  ${foot(depart('Board'), 'Have an account? Sign in')}
</main>`

// ── 2 · the name: the field, the caret; Continue at the foot, rising with the keyboard ──
const NAME = `
<main class="brd">
  ${head(1)}
  ${body(`
  ${q("What's your name?")}
  ${stage('<div class="brd-field" role="textbox" aria-label="Your name">Aiko<span class="brd-field__caret"></span></div>')}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 3 · why: six doors, one picked ──
const WHY = `
<main class="brd">
  ${head(2)}
  ${body(`
  ${q('Why are you learning Japanese, <b>Aiko</b>?')}
  ${stage(`<div class="brd__opts">
    ${opt({ icon: IC.book,    label: 'For my studies' })}
    ${opt({ icon: IC.spark,   label: 'For fun' })}
    ${opt({ icon: IC.case,    label: 'For a trip to Japan', on: true })}
    ${opt({ icon: IC.home,    label: 'To live in Japan' })}
    ${opt({ icon: IC.friends, label: 'To make friends' })}
    ${opt({ icon: I.more,     label: 'Something else' })}
  </div>`)}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 4 · the kana check: two panes; the four honest answers are the foot ──
const kanaCard = (revealed = false) => `<div class="brd-kana">
  <div class="brd-kana__pane"><span class="brd-kana__jp" lang="ja">すし</span>${revealed ? '<span class="brd-kana__read"><span class="brd-kana__romaji">su · shi</span><span class="brd-kana__en">sushi</span></span><span class="brd-kana__script">Hiragana</span>' : ''}</div>
  <div class="brd-kana__pane"><span class="brd-kana__jp" lang="ja">ホテル</span>${revealed ? '<span class="brd-kana__read" style="animation-delay: 420ms;"><span class="brd-kana__romaji">ho · te · ru</span><span class="brd-kana__en">hotel</span></span><span class="brd-kana__script">Katakana</span>' : ''}</div>
</div>`
const kopt = (label, jp = '') => `<button type="button" class="brd-kopt"><span class="brd-kopt__label">${label}</span>${jp ? `<span class="brd-kopt__jp" lang="ja">${jp}</span>` : ''}</button>`
const KANA = `
<main class="brd">
  ${head(3)}
  ${body(`
  ${q('Can you read this?')}
  ${stage(`${kanaCard()}<div class="brd-grid">${kopt('Hiragana', 'すし')}${kopt('Katakana', 'ホテル')}${kopt('Both')}${kopt('Not yet')}</div>`)}`)}
</main>`

// ── 5a · the reveal: curiosity paid, the first stop named ──
const REVEAL = `
<main class="brd">
  ${head(4)}
  ${body(`
  ${q("Soon you'll read both.")}
  ${stage(`${kanaCard(true)}<p class="brd__hint">Two scripts, 46 signs each. Your first stop.</p>`)}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 5b · the level: six stops, one line each (the goal reuses the lines) ──
const LEVELS = [
  ['—',  'Novice',       'Kana and a few words'],
  ['N5', 'Beginner',     'Simple phrases · ~100 kanji'],
  ['N4', 'Intermediate', 'Everyday talk · ~300 kanji'],
  ['N3', 'Advanced',     'Daily life with ease · ~650 kanji'],
  ['N2', 'Expert',       'News and work · ~1,000 kanji'],
  ['N1', 'Fluent',       'Almost anything · ~2,000 kanji'],
]
const LEVEL = `
<main class="brd">
  ${head(4)}
  ${body(`
  ${q("Nice! What's your level?")}
  <p class="brd__hint">The stops behind you will be marked known.</p>
  ${stage(`<div class="brd__opts">
    ${LEVELS.map(([c, l, d]) => opt({ code: c, label: l, desc: d, on: c === 'N5' })).join('')}
  </div>`)}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 6 · the goal: only the stops ahead ──
const GOAL = `
<main class="brd">
  ${head(5)}
  ${body(`
  ${q("What's your goal?")}
  <p class="brd__hint">The stops ahead of N5.</p>
  ${stage(`<div class="brd__opts">
    ${LEVELS.slice(2).map(([c, l, d]) => opt({ code: c, label: l, desc: d, on: c === 'N4', tag: c === 'N4' ? 'Next stop' : '' })).join('')}
  </div>`)}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 7 · the rhythm: four cards, one recommended ──
const minCell = (n, on = false, tag = '') => `<button type="button" class="brd-cell${on ? ' brd-cell--on' : ''}" aria-pressed="${on}">
  ${tag ? `<span class="brd-tag">${tag}</span>` : ''}
  <span class="brd-cell__n">${n}</span><span class="brd-cell__u">min a day</span>
  <span class="brd-cell__sub">~${n} new items</span>
</button>`
const RHYTHM = `
<main class="brd">
  ${head(6)}
  ${body(`
  ${q("What's your rhythm?")}
  ${stage(`<div class="brd-grid">
    ${minCell(5)}${minCell(10, true, 'Recommended')}${minCell(15)}${minCell(20)}
  </div>
  <p class="brd__hint">You can change it later.</p>`)}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 8 · the hour: a departure board, three presets, the day as a track ──
const flap = (d, turn = false) => `<span class="flap${turn ? ' flap--turn' : ''}">${d}</span>`
const hourCell = (label, time, on = false) => `<button type="button" class="brd-cell brd-cell--sm${on ? ' brd-cell--on' : ''}" aria-pressed="${on}"><span class="brd-cell__label">${label}</span><span class="brd-cell__time">${time}</span></button>`
const TIME = `
<main class="brd">
  ${head(7)}
  ${body(`
  ${q('When do you study?')}
  ${stage(`<div class="brd-board">
    <span class="brd-board__cap">Departure</span>
    <div class="brd-board__flaps" aria-label="07:30">${flap(0)}${flap(7)}<span class="brd-board__colon">:</span>${flap(3)}${flap(0, true)}</div>
  </div>
  <div class="brd-grid brd-grid--3">
    ${hourCell('Morning', '07:30', true)}${hourCell('Noon', '12:30')}${hourCell('Evening', '21:00')}
  </div>
  <div class="brd-day">
    <div class="brd-day__rail"></div><div class="brd-day__done" style="width: 13%;"></div>
    <span class="brd-day__tick brd-day__tick--first" style="left: 0;">06</span><span class="brd-day__tick" style="left: 37%;">12</span><span class="brd-day__tick" style="left: 68%;">18</span><span class="brd-day__tick brd-day__tick--last" style="left: 100%;">24</span>
    <button type="button" class="brd-day__train" role="slider" aria-label="Departure time" aria-valuemin="6" aria-valuemax="24" aria-valuenow="7.5" aria-valuetext="07:30" style="left: 13%;"></button>
  </div>`)}`)}
  ${foot(depart('Continue'))}
</main>`

// ── 9 · notifications: the value first, the system prompt after ──
const NOTIF_BODY = `
  ${head(8)}
  ${body(`
  ${q('A nudge at <b>07:30</b>?')}
  ${stage(`<div class="brd-notif">
    <span class="brd-notif__app">JP</span>
    <div class="brd-notif__body">
      <div class="brd-notif__head"><span>Japanese Learner</span><span>now</span></div>
      <span class="brd-notif__title">Your train leaves at 07:30</span>
      <span class="brd-notif__text">Your cards are waiting at the gate.</span>
    </div>
  </div>
  <p class="brd__hint">One a day, at your time. Never more.</p>`)}`)}
  ${foot(depart('Allow notifications'), 'Not now')}`
const NOTIFY = `<main class="brd">${NOTIF_BODY}</main>`
const NOTIFY_PROMPT = `<main class="brd">${NOTIF_BODY}</main>
<div class="brd-dim">
  <div class="brd-alert" role="alertdialog">
    <div class="brd-alert__body"><span class="brd-alert__title">“Japanese Learner” would like to send you notifications</span><span class="brd-alert__text">Notifications may include alerts, sounds and icon badges.</span></div>
    <div class="brd-alert__btns"><button type="button" class="brd-alert__btn">Don't allow</button><button type="button" class="brd-alert__btn">Allow</button></div>
  </div>
</div>`

// ── 10 · building the journey: one track, four plain rows ──
const step = (state, label, val = '') => `<div class="brd-step brd-step--${state}">
  <span class="brd-step__mark">${state === 'done' ? I.check : ''}</span>
  <span class="brd-step__label">${label}</span>
  ${val ? `<span class="brd-step__val">${val}</span>` : ''}
</div>`
const BUILDING = `
<main class="brd">
  ${body(stage(`
    ${q('Building your journey, <b>Aiko</b>', true)}
    <div class="brd-build__track" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="2"><div class="brd-build__done"></div><span class="brd-build__train"></span></div>
    <div class="brd-steps">
      ${step('done', 'Your goal', 'N5 → N4')}
      ${step('done', 'Your lines', 'Four lines')}
      ${step('now',  'Your daily ride', '10 min · 07:30')}
      ${step('next', 'Your projection')}
    </div>`), 'center')}
</main>`

// ── 11 · the plan: the projection, then the promise — two of its lines from the motive ──
// 326 × 150 plot; y = words, x = Sep 2026 → Mar 2027. An illustration of the
// spacing effect, said so on the card; the figures come from the rhythm.
const pts = (arr) => arr.map(([x, y]) => `${(28 + x * 46).toFixed(0)},${(140 - y / 1500 * 130).toFixed(0)}`).join(' ')
const US   = [[0, 0], [1, 240], [2, 490], [3, 740], [4, 1000], [5, 1250], [6, 1500]]
const THEM = [[0, 0], [1, 220], [2, 330], [3, 390], [4, 420], [5, 435], [6, 440]]
const CHART = `<div class="brd-chart">
  <span class="brd-chart__title">Your projection</span>
  <svg viewBox="0 0 326 150" role="img" aria-label="Words remembered over six months: daily reviews climb to about 1,500; cramming levels off early.">
    <line class="grid" x1="28" y1="140" x2="304" y2="140"></line>
    <line class="grid" x1="28" y1="97" x2="304" y2="97"></line>
    <line class="grid" x1="28" y1="53" x2="304" y2="53"></line>
    <line class="grid" x1="28" y1="10" x2="304" y2="10"></line>
    <text class="axis" x="24" y="100" text-anchor="end">500</text>
    <text class="axis" x="24" y="56" text-anchor="end">1k</text>
    <text class="axis" x="24" y="13" text-anchor="end">1.5k</text>
    <text class="axis" x="28" y="150" text-anchor="start">SEP</text>
    <text class="axis" x="304" y="150" text-anchor="end">MAR 2027</text>
    <polyline class="line line--them" points="${pts(THEM)}"></polyline>
    <polyline class="line line--us" points="${pts(US)}"></polyline>
    <circle class="dot dot--them" cx="304" cy="${(140 - 440 / 1500 * 130).toFixed(0)}" r="4"></circle>
    <circle class="dot dot--us" cx="304" cy="10" r="4"></circle>
    <text class="lbl" x="252" y="24" text-anchor="end">~1,500 words · daily reviews</text>
    <text class="lbl lbl--soft" x="298" y="118" text-anchor="end">cramming</text>
  </svg>
  <div class="brd-legend"><span><i></i>Daily reviews, 10 min</span><span><i class="them"></i>Cramming</span></div>
  <span class="brd-chart__cap">Spaced reviews against cramming — an illustration, not a measurement.</span>
</div>`
const PLAN = `
<main class="brd">
  ${body(`
  ${q('Your plan is ready, <b>Aiko</b>.')}
  ${stage(`${CHART}
  <p class="brd-lead">At <b>10 min a day</b>, by <b>March 2027</b>, for your trip:</p>
  <div class="brd-bullets">
    <div class="brd-bullet">${I.check}~1,500 words and ~300 kanji</div>
    <div class="brd-bullet">${I.check}Read signs, menus and tickets</div>
    <div class="brd-bullet">${I.check}Ask your way, order, book a room</div>
    <div class="brd-bullet">${I.check}On track for JLPT N4</div>
  </div>`)}`, 'arrival')}
  ${foot(depart('Continue'))}
</main>`

// ── 12 · the welcome offer: the pass, its four perks, two plans, one action ──
const plan = (label, price, on = false, tag = '') => `<button type="button" class="brd-plan${on ? ' brd-plan--on' : ''}" aria-pressed="${on}">
  <span class="brd-plan__names"><span class="brd-plan__label">${label}${tag ? `<span class="brd-tag">${tag}</span>` : ''}</span><span class="brd-plan__price">${price}</span></span>
  <span class="brd-opt__check">${I.check}</span>
</button>`
export const PERKS = [
  ['Unlimited credits', 'no cap, no refill'],
  ['Practice modes', 'reading, translation, exams'],
  ['The analyzer', 'text, photo, video'],
  ['100 decks · 10,000 cards', 'free: 7 · 200'],
]
const OFFER = `
<main class="brd" style="gap: var(--sp-4);">
  ${body(`
  <div class="brd-offer">
    <span class="brd-offer__cap">Welcome offer</span>
    <span class="brd-offer__pct">−X%</span>
    <span class="brd-offer__sub">on the yearly pass</span>
  </div>
  ${stage(`<div class="brd-perks">
    <div class="brd-perks__pass"><span class="brd-perks__inf">∞</span><span class="brd-perks__cap">Pass</span></div>
    <div class="brd-perks__list">
      ${PERKS.map(([p, d]) => `<span class="brd-perk">${I.check}<span>${p} <small>· ${d}</small></span></span>`).join('')}
    </div>
  </div>
  <p class="brd-tagline">Board, and be ready for your trip to Japan.</p>
  <div class="brd__opts">
    ${plan('Yearly', '<b>[PRICE]</b> / year · [PRICE] a month', true, '−X%')}
    ${plan('Monthly', '<b>[PRICE]</b> / month')}
  </div>`)}`, 'arrival')}
  ${foot(depart('Get the −X%'), 'Continue free · don\'t show again', 'Cancel anytime.')}
</main>`

// ── 13 · the pass, issued — the balance only; the journey lives behind the station panel ──
const balanceLine = () => `<div class="jour-line">
  <span class="jour-line__status"><b style="color: var(--text-on-panel);">Balance</b></span>
  <span class="jour-line__validity"><b>30</b><span class="jour-cap">/ 50 credits</span></span>
  <span class="jour-cap" style="margin-left: auto; text-transform: none;">+30 at 00:00</span>
</div>`
const PASS_READY = `
<main class="brd">
  ${body(`
  <div class="brd-offer">
    ${q('Your pass is ready, <b>Aiko</b>.', true)}
    <p class="brd__hint">Enjoy the ride.</p>
  </div>
  ${stage(`<div class="brd-issue">
    ${pass({ name: 'Aiko', level: 1, into: 0, span: 100, rankJp: '浪人', rank: 'Rōnin', heading: 'span', gear: false, footer: balanceLine() })}
    <span class="brd-issue__seal" lang="ja" aria-label="Issued">発行</span>
  </div>`)}`, 'arrival')}
  ${foot(depart('Enter the station'))}
</main>`

// ── the motion sheet: how the screens move, and the rules that hold ──
const frame = (w, x, nx = null) => `<div class="mo__frame" style="--w: ${w};"><i></i><b style="--x: ${x};"></b>${nx !== null ? `<b class="next" style="--x: ${nx};"></b>` : ''}</div>`
const item = (b, t) => `<div class="mo__item"><b>${b}</b><span>${t}</span></div>`
export const MOTION_BODY = `
<div class="mo">
  <div class="mo__row">
    <div class="mo__col mo__col--wide">
      <span class="spec__label">Between screens — the train pull</span>
      <div class="mo__frames">${frame('25%', '10px')}<span class="mo__arrow">${I.chevR}</span>${frame('25%', '-46px', '58px')}<span class="mo__arrow">${I.chevR}</span>${frame('37%', '10px')}</div>
      <p class="spec__note">The screen you leave slides out to the left as the next arrives from the right — <b>260 ms, ease-out</b>, one car passing. The track's train advances <b>300 ms</b> later, once the new screen stands still. Back runs the same move in reverse. Never a cross-fade: the line only moves one way.</p>
      <p class="spec__note">Fast rhythm, never rushed: a screen's own movement starts after the pull lands (<b>+120 ms</b>) and is over within <b>500 ms</b>, so the learner is never waiting for a decoration. Every movement runs once and rests on the state the still frame shows; with reduced motion on, only the rest state is drawn.</p>
      <p class="spec__note"><b>The frame.</b> The title sits under the head; the content takes the room between the title and the foot and is centred in it; the foot is docked to the bottom on every screen and rises with the keyboard (the keyboard inset), so Continue is never hidden. On short screens the content scrolls under the foot.</p>
    </div>
    <div class="mo__col">
      <span class="spec__label">One movement per screen</span>
      <div class="mo__list">
        ${item('Welcome', 'two lanes of cards roll past like trains, 26 s and 34 s a lap; the stroke draws itself once, the sound bars breathe')}
        ${item('Name', 'the field is already focused, the caret blinks; the keyboard pushes the foot up')}
        ${item('Why · Level · Goal', 'rows arrive one after another, 40 ms apart')}
        ${item('Kana', 'the card settles; on the reveal the readings rise under each word, left then right')}
        ${item('Rhythm · Hour', 'the picked card lifts to its wash; the board flips its last digit once')}
        ${item('Nudge', 'the notification drops in from the top and settles')}
        ${item('Building', 'the train drives the track to the stop being built; the passed stops are ticked')}
        ${item('Plan', 'the gold line draws itself over the dashed one; the promises stagger in')}
        ${item('Offer', 'the figure pops in')}
        ${item('Pass', 'the pass slides up, then the seal lands')}
      </div>
    </div>
  </div>
  <div class="mo__row">
    <div class="mo__col mo__col--wide">
      <span class="spec__label">Rules that hold on every screen</span>
      <div class="mo__list">
        ${item('Continue is always at the foot', 'docked above the keyboard inset; the body scrolls under it on short screens; the kana answers are the foot of their screen')}
        ${item('The language is the device\'s', 'read from the locale, never asked')}
        ${item('One filled action', 'gold, 52 px, full width; disabled is opacity 0.45 and nothing else. Selection is a gold ring — the check, the code, the knob, the tag — never a second fill')}
        ${item('Back is there until the plan is built', 'the answers are kept; a return never costs anything. The three arrival screens have no back: the ride is over')}
        ${item('Optimistic, never lying', 'every figure comes from the learner\'s own answers and wears a ~; the chart calls itself an illustration; the system prompt shows the system\'s own words')}
        ${item('The theme in small doses', 'the track, the board, the pass, the seal — no announcements, no jargon before the station')}
        ${item('Explicit', 'every choice shows what it is: the kana answers carry their sample, the levels their line, the plans their price')}
        ${item('Reachable', '44 px targets, a name on every icon button, aria-pressed on every choice, a slider role on the knob, a visible focus ring')}
      </div>
    </div>
    <div class="mo__col">
      <span class="spec__label">Branches, exits, the motive</span>
      <div class="mo__list">
        ${item('Kana → one script or Not yet', 'the reveal, then the goal; the level is set to Novice (Not yet) or Beginner')}
        ${item('Kana → Both', 'the level list, then the goal')}
        ${item('Level', 'the stops behind it are marked known and spread over the coming weeks, so no day is flooded; the same rule holds in Settings › Learning')}
        ${item('Goal', 'only the stops ahead; the next one is marked and preselected')}
        ${item('Plan → two lines from the motive', 'trip: read signs, menus, tickets · ask your way, order, book a room. Studies: your course material · a lecture\'s key terms. Fun: manga panels, lyrics · a drama without pausing. Live in Japan: the town hall, the bank, the doctor · your mail and contracts. Friends: chat by message · a dinner conversation. Something else: the two generic lines')}
        ${item('Nudge → Not now', 'skips the system prompt, keeps the hour; the prompt shows once, after the learner said yes')}
        ${item('Offer → continue free', 'boards on the free pass and keeps the offer from returning — the sketch\'s "don\'t show anymore"')}
        ${item('Pass → the station', 'the tutorial (not drawn) then the gate')}
        ${item('Welcome → Sign in', 'returning learners skip the boarding')}
      </div>
    </div>
  </div>
</div>`

export const SCREENS4 = [
  ['Welcome',            WELCOME,       'Boarding · welcome',                'arrival'],
  ['BoardName',          NAME,          'Boarding · your name',              'arrival'],
  ['BoardWhy',           WHY,           'Boarding · why Japanese',           'arrival'],
  ['BoardKana',          KANA,          'Boarding · can you read this',      'arrival'],
  ['BoardKanaReveal',    REVEAL,        'Boarding · the reveal',             'arrival'],
  ['BoardLevel',         LEVEL,         'Boarding · your level',             'arrival'],
  ['BoardGoal',          GOAL,          'Boarding · your goal',              'arrival'],
  ['BoardRhythm',        RHYTHM,        'Boarding · your rhythm',            'arrival'],
  ['BoardTime',          TIME,          'Boarding · when you study',         'arrival'],
  ['BoardNotify',        NOTIFY,        'Boarding · the nudge',              'arrival'],
  ['BoardNotifyPrompt',  NOTIFY_PROMPT, 'Boarding · the system prompt',      'arrival'],
  ['BoardBuilding',      BUILDING,      'Boarding · building the journey',   'arrival'],
  ['BoardPlan',          PLAN,          'Boarding · the plan',               'arrival'],
  ['BoardOffer',         OFFER,         'Boarding · the welcome offer',      'arrival'],
  ['BoardPass',          PASS_READY,    'Boarding · the pass',               'arrival'],
]
