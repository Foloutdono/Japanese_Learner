// Shared furniture: the chrome (HUD + tab bar), the plate, icons, the
// pass, the stamp rally, the wall-map track. Every artboard composes
// these so the same object is drawn the same way on every screen.
import { CSS } from './css.mjs'

const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Noto+Serif+JP:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap'

// ── icons: stroke SVGs on a 24 grid, one style ──
const path = (d, extra = '') => `<svg class="svg" viewBox="0 0 24 24"${extra}>${d}</svg>`
export const I = {
  chevL: path('<polyline points="15 6 9 12 15 18"></polyline>'),
  chevR: path('<polyline points="9 6 15 12 9 18"></polyline>'),
  chevD: path('<polyline points="6 9 12 15 18 9"></polyline>'),
  gear: path('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>'),
  search: path('<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line>'),
  plus: path('<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'),
  check: path('<polyline points="4 12 10 18 20 6"></polyline>'),
  cross: path('<line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line>'),
  warn: path('<path d="M12 3 2 20h20L12 3z"></path><line x1="12" y1="10" x2="12" y2="14"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'),
  camera: path('<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>'),
  video: path('<rect x="3" y="6" width="13" height="12" rx="2"></rect><polygon points="16 10 21 7 21 17 16 14"></polygon>'),
  text: path('<line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="16" y2="12"></line><line x1="4" y1="18" x2="12" y2="18"></line>'),
  speaker: path('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.5 8.5a5 5 0 0 1 0 7"></path>'),
  bolt: path('<polygon points="13 2 4 14 11 14 10 22 20 9 13 9"></polygon>'),
}

// ── the HUD: level · goal status · balance ──
export const STATUS = {
  ahead:          { jp: '順調',        cap: 'Running ahead' },
  onTime:         { jp: '定刻',        cap: 'On schedule' },
  slightlyBehind: { jp: 'やや遅れ',    cap: 'Running behind' },
  delayed:        { jp: '遅延',        cap: 'Delayed' },
  suspended:      { jp: '運転見合わせ', cap: 'Suspended' },
}

// The balance is the commuter pass itself, at pocket size: the IC card's
// gradient and contactless mark, the figure printed inside — 30/50 on a
// free pass (the cap is the card's own), ∞ on a subscription.
const WAVE = '<span class="hud__pass-wave"><span></span><span></span><span></span></span>'
export function credits(kind = 30, cap = 50) {
  if (kind === 'pass') return `<button type="button" class="hud__pass">${WAVE}<span class="hud__pass-fig hud__pass-fig--inf">∞</span></button>`
  const n = Number(kind)
  const mod = n === 0 ? ' hud__pass--out' : n <= 5 ? ' hud__pass--low' : ''
  return `<button type="button" class="hud__pass${mod}">${WAVE}<span class="hud__pass-fig">${n}<span class="hud__pass-of">/${cap}</span></span></button>`
}

// The station panel: the journey model's state in the learner's own
// language only, with the drift in days beside it (AHEAD · 9d, ON TIME,
// LATE · 9d). The Japanese words stay on the pass, where they are printed.
export const PANEL = {
  ahead:          { word: 'Ahead',     delta: '9d' },
  onTime:         { word: 'On time',   delta: '' },
  slightlyBehind: { word: 'Late',      delta: '9d' },
  delayed:        { word: 'Late',      delta: '32d' },
  suspended:      { word: 'Suspended', delta: '' },
}
export function status(id = 'onTime') {
  const p = PANEL[id]
  return `<button type="button" class="hud__status hud__status--${id}"><span class="hud__status-word">${p.word}</span>${p.delta ? `<span class="hud__status-delta">· ${p.delta}</span>` : ''}</button>`
}

export function hud({ level = 12, st = 'onTime', cr = 30, gain = null } = {}) {
  return `<div class="hud"><div class="hud__inner">
  <button type="button" class="hud__level${gain ? ' hud__level--gain' : ''}">${level}${gain ? `<span class="hud-fare">+${gain}<span class="hud-fare__unit">xp</span></span>` : ''}</button>
  ${status(st)}
  ${credits(cr)}
</div></div>`
}

// ── the tab bar: five gates ──
const TABS = [
  { id: 'learn',    jp: '学習',   cap: 'Learn' },
  { id: 'practice', jp: '実践',   cap: 'Practice' },
  { id: 'today',    jp: '本日',   cap: 'Today' },
  { id: 'dict',     jp: '辞書',   cap: 'Dictionary' },
  { id: 'profile',  jp: '定期券', cap: 'Profile' },
]
export function tabbar(active = 'today', due = 24) {
  return `<nav class="tabbar">${TABS.map(t => `
  <button type="button" class="tab${t.id === active ? ' tab--on' : ''}">
    <span class="tab__jp" lang="ja">${t.jp}</span>
    <span class="tab__cap">${t.cap}</span>${t.id === 'today' && due ? `<span class="tab__due">${due}</span>` : ''}
  </button>`).join('')}
</nav>`
}

// ── the plate (駅名標, the --sm form) ──
export const clock = (hh = '08', mm = '14') => `<span class="board-clock">${hh}<span class="board-clock__colon">:</span>${mm}</span>`

export function plate({ code, kana, name, latin, color, noriba = null, register = false, extra = '' }) {
  return `<div class="plate${register ? ' plate--register' : ''}" style="--line-color: ${color}">
  <div class="plate__head">
    <div class="plate__names">
      ${code ? `<span class="plate__roundel">${code}</span>` : ''}
      <span class="plate__stack">
        <span class="plate__kana" lang="ja">${kana}</span>
        <h1 class="plate__name" lang="ja">${name}</h1>
        <span class="plate__romaji">${latin}</span>
      </span>
    </div>
    <div class="plate__aside">
      ${noriba != null ? `<span class="plate__noriba"><span class="plate__noriba-jp"><span lang="ja">のりば</span><span class="plate__count">${noriba}</span></span><span class="cap">Platforms</span></span>` : extra}
      ${clock()}
    </div>
  </div>
  <div class="plate__stripe"></div>
</div>`
}

// ── the wall-map track: n legs, stops one leg apart, the train on the same scale ──
export function track(stops, travelled) {
  const n = stops.length
  const x = i => 5 + (i / n) * 90
  const pos = Math.min(95, x(travelled))
  return `<span class="wmap-track">
  <span class="wmap-track__rail"></span>
  <span class="wmap-track__done" style="width: ${pos.toFixed(1)}%"></span>
  ${stops.map((s, i) => `<span class="wmap-track__stop${travelled >= i + 1 ? ' wmap-track__stop--past' : ''}" style="left: ${x(i).toFixed(1)}%"></span><span class="wmap-track__label" style="left: ${x(i).toFixed(1)}%"${/^N\d/.test(s) ? '' : ' lang="ja"'}>${s}</span>`).join('')}
  <span class="wmap-track__stop wmap-track__stop--end${travelled >= n ? ' wmap-track__stop--past' : ''}" style="left: ${x(n).toFixed(1)}%"></span>
  <span class="wmap-track__label wmap-track__label--end" style="left: ${x(n).toFixed(1)}%" lang="ja">完</span>
  <span class="wmap-track__train" style="left: ${pos.toFixed(1)}%"></span>
</span>`
}

export const due = n => n ? `<span class="wmap-due">${n}<span class="wmap-due__unit" lang="ja">件</span></span>` : ''

// ── スタンプラリー: the last seven days, today pressed ──
const RALLY = [
  { d: '日', on: true,  tilt: -2 }, { d: '月', on: true, tilt: 4 }, { d: '火', on: true, tilt: -5 },
  { d: '水', on: false, tilt: 0 },  { d: '木', on: true, tilt: 3 }, { d: '金', on: true, tilt: -3 },
  { d: '土', on: true,  tilt: 2, today: true },
]
export function rally(streak = 3) {
  return `<div class="stamp-rally">
  <span class="stamp-rally__row">${RALLY.map(s => `<span lang="ja" class="stamp-rally__stamp${s.on ? '' : ' stamp-rally__stamp--missed'}${s.today ? ' stamp-rally__stamp--today' : ''}" style="--stamp-tilt: ${s.tilt}deg">${s.d}</span>`).join('')}</span>
  <span class="stamp-rally__label"><span class="stamp-rally__count">${streak}<span class="stamp-rally__unit" lang="ja">日</span></span><span class="stamp-rally__caption">Streak</span></span>
</div>`
}
export function pace(n = 4, target = 10) {
  return `<span class="hall-pace">
  <span class="hall-pace__name"><span class="hall-pace__jp" lang="ja">新規</span><span class="hall-pace__latin">New items</span></span>
  <span class="hall-pace__bar"><span class="hall-pace__fill" style="width: ${Math.round(100 * n / target)}%"></span></span>
  <span class="hall-pace__count">${n}<span class="hall-pace__sep"> / </span>${target}</span>
</span>`
}

// ── the journey line the pass prints under its balance ──
export function jourLine(st = 'onTime', valid = '14 Mar 2027') {
  const s = STATUS[st]
  return `<div class="jour-line jour-st--${st}">
  <span class="jour-line__status"><b lang="ja">${s.jp}</b><span class="jour-cap">${s.cap}</span></span>
  <span class="jour-line__validity"><span lang="ja">有効期限</span><b>${valid}</b></span>
  <button type="button" class="jour-line__turn">Turn over <span lang="ja">裏面</span> ↻</button>
</div>`
}

// ── 定期券, full size ──
export function pass({ name = 'Aiko', level = 12, into = 420, span = 1000, rankJp = '侍', rank = 'Samurai', footer = '' } = {}) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - into / span)
  return `<div class="pass">
  <div class="pass__head">
    <span class="pass__brand">
      <span class="pass__wave"><span></span><span></span><span></span></span>
      <span class="pass__brand-names"><span class="pass__brand-jp" lang="ja">定期券</span><span class="pass__brand-sub">Commuter pass</span></span>
    </span>
    <span class="pass__head-right">
      <button type="button" class="pass__gear">${I.gear}</button>
      <span class="pass__issuer">JP</span>
    </span>
  </div>
  <div class="pass__body">
    <div class="pass__holder">
      <div class="pass__avatar-wrap">
        <svg class="pass__ring" viewBox="0 0 64 64"><circle class="pass__ring-track" cx="32" cy="32" r="${r}"></circle><circle class="pass__ring-fill" cx="32" cy="32" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle></svg>
        <div class="pass__avatar">${name.charAt(0)}</div>
      </div>
      <div class="pass__name">${name}</div>
    </div>
    <div class="pass__ranks"><span class="pass__rank-jp" lang="ja">${rankJp}</span><span class="pass__rank-latin">${rank}</span></div>
  </div>
  <div class="pass__balance">
    <div class="pass__balance-meter">
      <span class="pass__xp">${into.toLocaleString('en')} / ${span.toLocaleString('en')} XP</span>
      <div class="pass__track"><div class="pass__fill" style="width: ${Math.round(100 * into / span)}%"></div></div>
    </div>
    <span class="pass__level"><span class="pass__level-num">${level}</span><span class="pass__level-label">Level</span></span>
  </div>
  ${footer ? `<div class="pass__footer"><div class="pass__footer-rule"></div>${footer}</div>` : ''}
</div>`
}

// ── one screen, wrapped: the phone frame, the theme tweak, the fonts ──
export function artboard(body, { width = 390, height = 844, phone = true, extraClass = '' } = {}) {
  const cls = extraClass ? ` ${extraClass}` : ""
  const root = phone
    ? `<div class="jp phone {{theme}}${cls}">${body}</div>`
    : `<div class="jp {{theme}}${cls}" style="width: ${width}px; min-height: ${height}px;">${body}</div>`
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${FONTS}">
  <style>
    body { margin: 0; background: #17151a; }
    a { color: #c99a3e; } a:hover { color: #ece5d8; }
${CSS}
  </style>
</helmet>
${root}
</x-dc>
<script data-dc-script data-props='{"theme":{"editor":"enum","options":["dark","light"],"default":"dark","section":"Theme"},"$preview":{"width":${width},"height":${height}}}'>
class Component extends DCLogic {
  renderVals() {
    return { theme: this.props.theme ?? 'dark' };
  }
}
</script>
</body>
</html>
`
}
