import { Daruma } from '../rewards/Daruma'
import { ChevronIcon } from '../ui/Icons'

// ── 今夜 — what is within reach tonight ──────────────────────
// The profile is a record of what you have done. This is the one block
// that turns the record around and says what a session tonight would
// finish, computed from numbers already on the screen — never from a
// request of its own:
//
//   • the vowed daruma closest to its second eye (a daily goal is,
//     by definition, tonight's),
//   • the locked badge closest to punching — only one a session can
//     actually move: reviews and perfect runs, and a streak badge on
//     the night that completes it. Mastery takes weeks of intervals,
//     so 百 never appears here however close it is,
//   • the person directly above you on the 番付, and by how much.
//
// "Within reach" is taken literally: past a session's worth of reviews
// or XP the row is not offered. Each row is a doorway to the place you
// would go to do it. When nothing is within reach — nothing vowed,
// every ticket punched, first on the board — the block simply is not
// there.
const STREAK_BADGES = new Set(['week_streak', 'month_streak'])
const SESSION_BADGES = new Set(['first_steps', 'dedicated', 'perfectionist'])
const SESSION_REVIEWS = 100
const SESSION_XP = 500
const RANK_GLYPH = { 1: '一', 2: '二', 3: '三' }

function ratio(current, target) {
  return target > 0 ? current / target : 0
}

export function Tonight({ profile, board, t, navigate }) {
  const items = []

  const dolls = (profile.daruma?.today ?? [])
    .filter(d => d.vowed && !d.complete && d.target > 0 && d.current < d.target)
    .sort((a, b) => ratio(b.current, b.target) - ratio(a.current, a.target))
  if (dolls[0]) {
    const d = dolls[0]
    items.push({
      key: 'daruma',
      color: 'var(--daruma-aka)',
      mark: (
        <Daruma
          color={d.color}
          rarity={d.rarity}
          glyph={d.glyph}
          eyes={1}
          progress={ratio(d.current, d.target)}
          size={34}
        />
      ),
      line: t.tonightDaruma(d.target - d.current),
      sub: `${t.darumaGoalTitle?.[d.id] ?? d.id} · ${t.darumaTitle}`,
      figure: d.current,
      of: `/ ${d.target}`,
      to: '/daruma',
    })
  }

  const badges = (profile.badges ?? [])
    .filter(b => !b.unlocked && typeof b.target === 'number' && b.target > 0)
    .filter(b => (STREAK_BADGES.has(b.id) && b.target - b.progress <= 1)
      || (SESSION_BADGES.has(b.id) && b.target - b.progress <= SESSION_REVIEWS))
    .sort((a, b) => ratio(b.progress, b.target) - ratio(a.progress, a.target))
  if (badges[0]) {
    const b = badges[0]
    items.push({
      key: 'badge',
      color: 'var(--accent2)',
      mark: <span className="todo__glyph" lang="ja">{b.glyph}</span>,
      line: t.tonightBadge(b.target - b.progress, b.glyph),
      sub: t.badgeName?.[b.id] ?? b.id,
      figure: b.progress,
      of: `/ ${b.target}`,
      to: '/today',
    })
  }

  const me = board?.me
  const chase = me && board.entries.find(e => e.rank === me.rank - 1)
  if (chase && chase.xp > me.xp && chase.xp - me.xp <= SESSION_XP) {
    items.push({
      key: 'chase',
      color: 'var(--accent)',
      mark: <span className="todo__arrow" lang="ja">{RANK_GLYPH[chase.rank] ?? chase.rank}</span>,
      line: t.tonightChase((chase.xp - me.xp).toLocaleString(), chase.username),
      sub: `番付 · ${t.periodAll}`,
      figure: me.rank,
      of: `→ ${chase.rank}`,
      to: '/today',
    })
  }

  if (!items.length) return null

  return (
    <section className="tonight">
      <h2 className="tonight__head">
        <span className="tonight__jp" lang="ja">今夜</span>
        <span className="pf-cap">{t.tonight}</span>
      </h2>
      {items.map(it => (
        <button
          key={it.key}
          type="button"
          className="todo"
          style={{ '--todo-color': it.color }}
          onClick={() => navigate(it.to)}
        >
          <span className="todo__mark">{it.mark}</span>
          <span className="todo__what">
            <span className="todo__line">{it.line}</span>
            <span className="todo__of">{it.sub}</span>
          </span>
          <span className="todo__fig">
            {it.figure}<span className="todo__fig-of">{it.of}</span>
          </span>
          <ChevronIcon direction="right" size={15} className="todo__chev" />
        </button>
      ))}
    </section>
  )
}
