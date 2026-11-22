import { useSearchParams, Link } from 'react-router-dom'

// ── /dev/missions — the missions, drawn three ways (plan 328) ──────
// Development only, no backend, no session, nothing stored: the owner
// picks, then the pick is built as drawn (CLAUDE.md, "A redesign is drawn
// before it is built"). Strings are French literals here on purpose; the
// built feature carries every text in fr, en and es (locales).
//
//   ?v=A   le carnet de coupons   -- a sheet from Today, tickets to collect
//   ?v=B   le tableau des départs -- a board on the gate, paid on the spot
//   ?v=C   le carnet d'étapes     -- an insert of the holder, a stamp book
//   &plan=max   the same, as a Max learner reads it (XP, not credits)
//   &bare=1     no bar (for the screenshots)
//
// Each option answers the four questions at once, one frame each:
//   ① where they live  ② the day's sheet  ③ the reward  ④ the achievements
// Mix freely: « A's sheet, C's achievements » is a valid pick.
// The gate behind ① is a ghost: the entry point is drawn on the real
// GateCard (over its print) once the place is chosen.

const OPTIONS = ['A', 'B', 'C']
const NAMES = { A: 'Le carnet de coupons', B: 'Le tableau des départs', C: "Le carnet d'étapes" }

const DAY = [
  { id: 'due', label: 'Finir tes révisions', have: 31, of: 52, credits: 8, xp: 5 },
  { id: 'new', label: 'Apprendre 11 nouvelles cartes', have: 11, of: 11, credits: 8, xp: 5, done: true },
  { id: 'practice', label: 'Un exercice de compréhension', have: 0, of: 1, credits: 8, xp: 5, line: 'rikai' },
]
const BONUS = { label: 'Les trois faites', credits: 6, xp: 5 }
const WEEK = [
  { id: 'days5', label: 'Étudier 5 jours sur 7', have: 3, of: 5, credits: 12, xp: 15 },
  { id: 'volume', label: 'Réviser 212 cartes', have: 140, of: 212, credits: 12, xp: 15 },
  { id: 'duels5', label: 'Jouer 5 duels', have: 2, of: 5, credits: 12, xp: 15, line: 'duel' },
]
const FIRSTS = [
  ['辻', 'Première dictée', true], ['写', 'Première photo', true], ['話', 'Première conversation', false],
  ['試', 'Premier examen blanc', false], ['札', 'Premier deck publié', false], ['友', 'Premier ami', true],
  ['闘', 'Premier duel', false], ['旅', "Date d'arrivée", false], ['移', 'Un import', false], ['映', 'Vidéo ou chanson', false],
]
// A plaque is a station: its code on the origin line (TJ), its name, its reading.
const PLAQUES = [
  { code: 'TJ 01', jp: '仮名', kana: 'かな', en: 'Kana complets', credits: 5, xp: 60, got: true },
  { code: 'TJ 02', jp: '百語', kana: 'ひゃくご', en: '100 mots', credits: 3, xp: 40, got: true },
  { code: 'TJ 03', jp: '七日', kana: 'なのか', en: '7 jours', credits: 3, xp: 30, got: true },
  { code: 'TJ 04', jp: '五百語', kana: 'ごひゃくご', en: '500 mots', credits: 6, xp: 100, have: 312, of: 500 },
  { code: 'TJ 05', jp: '三十日', kana: 'さんじゅうにち', en: '30 jours', credits: 6, xp: 100, have: 18, of: 30 },
  { code: 'TJ 06', jp: '文法', kana: 'ぶんぽう', en: 'Grammaire N5', credits: 5, xp: 100, have: 24, of: 41 },
]

function reward(m, max) {
  return max ? `+${m.xp + m.credits} XP` : `+${m.credits}`
}

// ── shared pieces ──────────────────────────────────────────────────
function Frame({ n, title, children }) {
  return (
    <section className="msn-frame">
      <h2 className="msn-frame__cap"><b>{n}</b> {title}</h2>
      <div className="msn-frame__body">{children}</div>
    </section>
  )
}

function Ghost({ children, ring = true }) {
  return (
    <div className="msn-ghost" aria-hidden={!children}>
      {ring && (
        <div className="msn-ghost__dial"><b>84</b><span>cartes</span></div>
      )}
      <span className="msn-ghost__go">Partir</span>
      {children}
    </div>
  )
}

function Bar({ m }) {
  return <span className="msn-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (100 * m.have) / m.of)}%` }} /></span>
}

function Figure({ m }) {
  return <span className="msn-fig">{m.have}<small>/{m.of}</small></span>
}

// ═══ A — le carnet de coupons ═══════════════════════════════════════
function CouponA({ m, max, torn = false, bonus = false }) {
  const done = m.done || bonus
  return (
    <div className={`msn-cpn${done ? ' msn-cpn--done' : ''}${torn ? ' msn-cpn--torn' : ''}`} style={m.line ? { '--line-color': `var(--line-${m.line === 'duel' ? 'exam' : m.line})` } : undefined}>
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{m.label}</span>
        {!done && <><Bar m={m} /><Figure m={m} /></>}
        {done && !torn && <span className="msn-cpn__ready">Fait</span>}
        {torn && <span className="msn-cpn__ready">Récolté</span>}
      </div>
      <div className="msn-cpn__stub">
        {torn ? <span className="msn-cpn__paid" lang="ja">済</span> : <span className="msn-cpn__take">{reward(m, max)}</span>}
        <span className="msn-cpn__tap">{done && !torn ? 'Récolter' : ''}</span>
      </div>
    </div>
  )
}

function WhereA() {
  return (
    <Ghost>
      <button type="button" className="msn-line" tabIndex={-1}>
        <span className="msn-line__dots" aria-hidden="true"><i className="on" /><i /><i /></span>
        <span>Missions du jour</span><b>1/3</b>
        <span className="msn-line__chev" aria-hidden="true">›</span>
      </button>
    </Ghost>
  )
}

function CardA({ max }) {
  return (
    <div className="msn-pane">
      <span className="msn-pane__handle" aria-hidden="true" />
      <div className="msn-pane__head"><h3>Aujourd'hui</h3><span className="msn-pane__sum">{max ? '+39 XP' : '+30'}</span></div>
      <div className="msn-stack">{DAY.map(m => <CouponA key={m.id} m={m} max={max} />)}</div>
      <p className="msn-note">Les trois faites : {max ? '+11 XP' : '+6'}</p>
      <div className="msn-pane__head msn-pane__head--sub"><h3>Cette semaine</h3><span className="msn-pane__sum">3 sur 3 · 22 h</span></div>
      <div className="msn-stack msn-stack--tight">{WEEK.map(m => <CouponA key={m.id} m={m} max={max} />)}</div>
      <div className="msn-pane__foot"><span>Découvertes · 3/10</span><span>Plaques · 3</span></div>
    </div>
  )
}

function RewardA({ max }) {
  const m = DAY[1]
  return (
    <div className="msn-pair msn-pair--col">
      <div><span className="msn-tag">Faite : le talon s'allume</span><CouponA m={m} max={max} /></div>
      <div><span className="msn-tag">Un geste : le talon se détache</span><CouponA m={m} max={max} torn /><span className="msn-pop">{max ? '+13 XP' : '+8 回数券'}</span></div>
    </div>
  )
}

function Plate({ p, max }) {
  return (
    <div className={`msn-plate${p.got ? '' : ' msn-plate--off'}${max ? ' msn-plate--max' : ''}`}>
      <span className="msn-plate__code">{p.code}</span>
      <span className="msn-plate__jp" lang="ja">{p.jp}</span>
      <span className="msn-plate__kana" lang="ja">{p.kana}</span>
      <span className="msn-plate__en">{p.en}</span>
      <span className="msn-plate__foot">{p.got ? '済' : <>{p.have}<small>/{p.of}</small></>}</span>
    </div>
  )
}

function PlaquesA({ max }) {
  return <div className="msn-plates">{PLAQUES.map(p => <Plate key={p.code} p={p} max={max} />)}</div>
}

// ═══ B — le tableau des départs ═════════════════════════════════════
function Row({ m, max, flip = false }) {
  const done = m.done || flip
  return (
    <div className={`msn-row${done ? ' msn-row--done' : ''}${flip ? ' msn-row--flip' : ''}`}>
      <span className="msn-row__time">{reward(m, max)}</span>
      <span className="msn-row__dest">{m.label}</span>
      <span className="msn-row__state">{done ? <span lang="ja">発車済</span> : <Figure m={m} />}</span>
    </div>
  )
}

function WhereB({ max }) {
  return (
    <Ghost>
      <div className="msn-board">
        {DAY.map(m => <Row key={m.id} m={m} max={max} />)}
      </div>
    </Ghost>
  )
}

function CardB({ max }) {
  return (
    <div className="msn-pane msn-pane--flat">
      <div className="msn-pane__head"><h3>Départs du jour</h3><span className="msn-pane__sum">{max ? '+39 XP' : '+30'}</span></div>
      <div className="msn-board msn-board--lg">
        {DAY.map(m => <Row key={m.id} m={m} max={max} />)}
        <div className="msn-row msn-row--bonus">
          <span className="msn-row__time">{reward(BONUS, max)}</span>
          <span className="msn-row__dest">Les trois faites</span>
          <span className="msn-row__state">1/3</span>
        </div>
      </div>
      <div className="msn-pane__head msn-pane__head--sub"><h3>Express de la semaine</h3></div>
      <div className="msn-board msn-board--lg">{WEEK.map(m => <Row key={m.id} m={m} max={max} />)}</div>
      <div className="msn-pane__foot"><span>Découvertes · 3/10</span><span>Plaques · 3</span></div>
    </div>
  )
}

function RewardB({ max }) {
  const m = DAY[2]
  return (
    <div className="msn-pair msn-pair--col">
      <div><span className="msn-tag">Avant la dernière réponse</span><div className="msn-board msn-board--lg"><Row m={m} max={max} /></div></div>
      <div><span className="msn-tag">Aussitôt après, sans geste</span><div className="msn-board msn-board--lg"><Row m={m} max={max} flip /></div><span className="msn-pop">{max ? '+13 XP' : '+8 回数券'}</span></div>
    </div>
  )
}

function Ring({ p, max }) {
  return (
    <div className={`msn-ring${p.got ? '' : ' msn-ring--off'}${max ? ' msn-ring--max' : ''}`}>
      <span className="msn-ring__glyph" lang="ja">{p.jp}</span>
      <span className="msn-ring__en">{p.en}</span>
    </div>
  )
}

function PlaquesB({ max }) {
  return <div className="msn-rings">{PLAQUES.map(p => <Ring key={p.code} p={p} max={max} />)}</div>
}

// ═══ C — le carnet d'étapes (un insert du porte-carte) ═══════════════
const WD = ['月', '火', '水', '木', '金', '土', '日']

function Stamp({ on, label, big = false, jp }) {
  return (
    <span className={`msn-stamp${on ? ' msn-stamp--on' : ''}${big ? ' msn-stamp--big' : ''}`} lang="ja">
      <b>{jp}</b>
      <small>{label}</small>
    </span>
  )
}

function WhereC() {
  return (
    <Ghost ring>
      <div className="msn-chip"><span lang="ja">券</span> Missions <b>1/3</b></div>
      <div className="msn-holder">
        <span className="msn-holder__tab on">Carte</span>
        <span className="msn-holder__tab">Tampons</span>
        <span className="msn-holder__tab hot">Missions</span>
        <span className="msn-holder__tab">Lignes</span>
      </div>
    </Ghost>
  )
}

function CardC({ max }) {
  return (
    <div className="msn-book">
      <div className="msn-book__row">
        <Stamp jp="復" label="Révisions" on={false} />
        <Stamp jp="新" label="Nouvelles" on />
        <Stamp jp="練" label="Exercice" on={false} />
        <span className="msn-book__sep" aria-hidden="true" />
        <Stamp jp="満" label="Les trois" big on={false} />
      </div>
      <p className="msn-book__line">Aujourd'hui <b>1/3</b> · {max ? '+39 XP' : '+30'}</p>
      <div className="msn-book__week">
        {WEEK.map((m, i) => (
          <div key={m.id} className="msn-book__wk">
            <Stamp jp={WD[i]} label={m.label} big on={m.have >= m.of} />
            <Figure m={m} />
          </div>
        ))}
      </div>
      <div className="msn-lattice">
        {FIRSTS.map(([g, label, on]) => (
          <span key={label} className={`msn-lattice__cell${on ? ' on' : ''}`} title={label}>
            <b lang="ja">{g}</b>
            <small>{label}</small>
          </span>
        ))}
      </div>
    </div>
  )
}

function RewardC({ max }) {
  return (
    <div className="msn-pair msn-pair--col">
      <div className="msn-book__row">
        <Stamp jp="復" label="Révisions" on />
        <Stamp jp="新" label="Nouvelles" on />
        <Stamp jp="練" label="Exercice" on />
        <span className="msn-book__sep" aria-hidden="true" />
        <Stamp jp="満" label="Les trois" big on />
      </div>
      <button type="button" className="msn-collect" tabIndex={-1}>
        <span>Récolter le carnet du jour</span><b>{max ? '+50 XP' : '+30'}</b>
      </button>
      <span className="msn-tag">Les tampons se posent d'eux-mêmes ; un geste par jour récolte le carnet</span>
    </div>
  )
}

function PlaquesC({ max }) {
  return (
    <div className="msn-seals">
      {PLAQUES.map(p => (
        <div key={p.code} className={`msn-seal${p.got ? ' on' : ''}${max ? ' msn-seal--max' : ''}`}>
          <b className="msn-seal__g" lang="ja">{p.jp}</b>
          <small>{p.en}</small>
        </div>
      ))}
    </div>
  )
}

// ── the page ───────────────────────────────────────────────────────
const VIEWS = {
  A: { where: WhereA, card: CardA, reward: RewardA, plaques: PlaquesA },
  B: { where: WhereB, card: CardB, reward: RewardB, plaques: PlaquesB },
  C: { where: WhereC, card: CardC, reward: RewardC, plaques: PlaquesC },
}
const QUESTIONS = [
  ['where', '①', 'Où elles vivent'],
  ['card', '②', 'La fiche du jour'],
  ['reward', '③', 'La récompense'],
  ['plaques', '④', 'Les succès'],
]

export default function MissionsPreview() {
  const [params] = useSearchParams()
  const v = OPTIONS.includes(params.get('v')) ? params.get('v') : 'A'
  const max = params.get('plan') === 'max'
  const bare = params.get('bare') === '1'
  const view = VIEWS[v]
  const to = (o, plan = max) => `/dev/missions?v=${o}${plan ? '&plan=max' : ''}`

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Options">
          {OPTIONS.map(o => (
            <Link key={o} className="clrdev-bar__item" to={to(o)} aria-current={o === v ? 'page' : undefined}>{o}</Link>
          ))}
          <Link className="clrdev-bar__item" to={to(v, !max)}>{max ? 'Free' : 'Max'}</Link>
        </nav>
      )}
      <main id="main-content" className="msn-dev">
        <header className="msn-dev__head">
          <h1>{v} — {NAMES[v]}</h1>
          <p>{max ? 'Vu par un Max : de l\'XP à la place des crédits, ses plaques en platine.' : 'Vu par un Free : des crédits (回数券) et de l\'XP.'}</p>
        </header>
        <div className="msn-dev__frames">
          {QUESTIONS.map(([key, n, title]) => {
            const Piece = view[key]
            return <Frame key={key} n={n} title={title}><Piece max={max} /></Frame>
          })}
        </div>
      </main>
    </>
  )
}
