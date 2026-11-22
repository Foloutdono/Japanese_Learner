import { useState } from 'react'
import { useMissions } from '../../stores/missions'
import { Sheet } from '../chrome/Sheet'
import { CalendarIcon } from '../ui/Icons'

// ── 任務 — the missions, drawn into the app (plan 328) ─────────────
// Three ways to stand in the same screens, for the owner to pick from at
// /dev/missions: A, the coupons (a door on the gate opens a sheet; a
// coupon's stub is torn to collect); B, the board (departures hung on the
// gate, paid on the last answer); C, the book (stamps in the holder, a
// chip on the gate). Every piece reads the store (stores/missions) and
// draws nothing without it, so a production build, which seeds none,
// carries none of it. Whatever is picked stays; the others go.
//
// Strings are French literals while this is a drawing; the built feature
// takes them from the locales in three languages.

const reward = (m, max) => (max ? `+${m.xp + m.credits} XP` : `+${m.credits}`)
const tally = list => list.filter(m => m.done).length
const lineOf = m => (m.line ? { '--line-color': `var(--line-${m.line})` } : undefined)

function Bar({ m }) {
  return <span className="msn-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (100 * m.have) / m.of)}%` }} /></span>
}

function Figure({ m }) {
  return <span className="msn-fig">{m.have}<small>/{m.of}</small></span>
}

// ── A — the coupon ────────────────────────────────────────────────
function Coupon({ m, max, just }) {
  const state = m.paid ? 'torn' : m.done ? 'ready' : 'open'
  return (
    <div className={`msn-cpn msn-cpn--${state}${just ? ' msn-just' : ''}`} style={lineOf(m)}>
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{m.label}</span>
        {state === 'open' && <><Bar m={m} /><Figure m={m} /></>}
        {state === 'ready' && <span className="msn-cpn__sub">Fait</span>}
        {state === 'torn' && <span className="msn-cpn__sub">Récolté</span>}
      </div>
      <div className="msn-cpn__stub">
        {state === 'torn'
          ? <span className="msn-cpn__paid" lang="ja">済</span>
          : <span className="msn-cpn__take">{reward(m, max)}</span>}
        {state === 'ready' && <span className="msn-cpn__tap">Récolter</span>}
      </div>
      {just && state === 'torn' && <span className="msn-pop">{max ? reward(m, true) : `${reward(m, false)} 回数券`}</span>}
    </div>
  )
}

function CouponDay({ d, max }) {
  return (
    <>
      <div className="msn-stack">{d.day.missions.map(m => <Coupon key={m.id} m={m} max={max} just={d.just === m.id} />)}</div>
      <p className="msn-note">{d.day.bonus.label} : {reward(d.day.bonus, max)}</p>
    </>
  )
}

function CouponWeek({ d, max }) {
  return <div className="msn-stack msn-stack--tight">{d.week.map(m => <Coupon key={m.id} m={m} max={max} />)}</div>
}

// ── B — the board ─────────────────────────────────────────────────
function Row({ m, max, just }) {
  return (
    <div className={`msn-row${m.done ? ' msn-row--done' : ''}${just ? ' msn-just' : ''}`}>
      <span className="msn-row__time">{reward(m, max)}</span>
      <span className="msn-row__dest">{m.label}</span>
      <span className="msn-row__state">{m.done ? <span lang="ja">発車済</span> : <Figure m={m} />}</span>
    </div>
  )
}

function Board({ d, max, week = false, className = '' }) {
  const rows = week ? d.week : d.day.missions
  return (
    <div className={`msn-board ${className}`} role="list">
      {rows.map(m => <Row key={m.id} m={m} max={max} just={d.just === m.id} />)}
      {!week && (
        <div className={`msn-row msn-row--bonus${d.day.bonus.done ? ' msn-row--done' : ''}`}>
          <span className="msn-row__time">{reward(d.day.bonus, max)}</span>
          <span className="msn-row__dest">{d.day.bonus.label}</span>
          <span className="msn-row__state">{tally(d.day.missions)}/3</span>
        </div>
      )}
    </div>
  )
}

// ── C — the stamps ────────────────────────────────────────────────
function Stamp({ glyph, label, on, big = false, just: fresh = false }) {
  return (
    <span className={`msn-stamp${on ? ' msn-stamp--on' : ''}${big ? ' msn-stamp--big' : ''}${fresh ? ' msn-just' : ''}`}>
      <b lang="ja">{glyph}</b>
      <small>{label}</small>
    </span>
  )
}

function StampDay({ d, max }) {
  const all = d.day.missions.every(m => m.done)
  return (
    <>
      <div className="msn-book__row">
        {d.day.missions.map(m => <Stamp key={m.id} glyph={m.glyph} label={m.label.split(' ')[0]} on={m.done} just={d.just === m.id} />)}
        <span className="msn-book__sep" aria-hidden="true" />
        <Stamp glyph="満" label="Les trois" big on={d.day.bonus.paid} just={all && d.step === 2} />
      </div>
      {all && !d.day.bonus.paid && (
        <button type="button" className="msn-collect" tabIndex={-1}>
          <span>Récolter le carnet du jour</span><b>{max ? '+50 XP' : '+30'}</b>
        </button>
      )}
    </>
  )
}

function StampWeek({ d }) {
  return (
    <div className="msn-book__week">
      {d.week.map(m => (
        <div key={m.id} className="msn-book__wk">
          <Stamp glyph={m.glyph} label={m.label} big on={m.have >= m.of} />
          <Figure m={m} />
        </div>
      ))}
    </div>
  )
}

// ── the firsts, a lattice (all three) ─────────────────────────────
function Firsts({ d }) {
  return (
    <div className="msn-lattice">
      {d.firsts.map(f => (
        <span key={f.label} className={`msn-lattice__cell${f.done ? ' on' : ''}`}>
          <b lang="ja">{f.glyph}</b>
          <small>{f.label}</small>
        </span>
      ))}
    </div>
  )
}

// ── the achievements ──────────────────────────────────────────────
function Plate({ p, max }) {
  return (
    <div className={`msn-plate${p.got ? '' : ' msn-plate--off'}${max ? ' msn-plate--max' : ''}`}>
      <span className="msn-plate__code">{p.code}</span>
      <span className="msn-plate__jp" lang="ja">{p.jp}</span>
      <span className="msn-plate__kana" lang="ja">{p.kana}</span>
      <span className="msn-plate__en">{p.label}</span>
      <span className="msn-plate__foot">{p.got ? <span lang="ja">済</span> : <>{p.have}<small>/{p.of}</small></>}</span>
    </div>
  )
}

function Ring({ p, max }) {
  return (
    <div className={`msn-ring${p.got ? '' : ' msn-ring--off'}${max ? ' msn-ring--max' : ''}`}>
      <span className="msn-ring__glyph" lang="ja">{p.jp}</span>
      <span className="msn-ring__en">{p.label}</span>
    </div>
  )
}

function Seal({ p, max }) {
  return (
    <div className={`msn-seal${p.got ? ' on' : ''}${max ? ' msn-seal--max' : ''}`}>
      <b className="msn-seal__g" lang="ja">{p.jp}</b>
      <small>{p.label}</small>
    </div>
  )
}

// ── the gate's slot (Today, phone and desk) ───────────────────────
// One small pill under the legend, on the dial's axis, wherever the print
// puts it (`style` is the gate's own `at(x, y)`): three lamps, the count and
// the day's sum. A touch opens the day, drawn the variant's way.
function Lamps({ variant, missions }) {
  if (variant === 'C') {
    return (
      <span className="msn-pill__stamps" aria-hidden="true">
        {missions.map(m => <b key={m.id} lang="ja" className={m.done ? 'on' : ''}>{m.glyph}</b>)}
      </span>
    )
  }
  return (
    <span className="msn-pill__dots" aria-hidden="true">
      {missions.map(m => <i key={m.id} className={m.done ? 'on' : ''} />)}
    </span>
  )
}

export function MissionsGate({ style }) {
  const d = useMissions()
  const [open, setOpen] = useState(false)
  if (!d) return null
  const max = d.plan === 'max'
  const done = tally(d.day.missions)
  const sum = max ? `+${d.day.missions.length * (d.day.missions[0].xp + d.day.missions[0].credits)} XP` : '+30'
  const weekSum = max ? '+81 XP' : '+36'

  return (
    <>
      <div className="tpr-at msn-at" style={style}>
        <button type="button" className={`msn-pill msn-pill--${d.variant}${d.just ? ' msn-just' : ''}`} aria-haspopup="dialog" aria-label={`Missions du jour, ${done} sur 3`} onClick={() => setOpen(true)}>
          <Lamps variant={d.variant} missions={d.day.missions} />
          <span className="msn-pill__n"><b>{done}</b>/3</span>
          <span className="msn-pill__sum">{sum}</span>
          {d.just && d.step === 2 && <span className="msn-pop msn-pop--pill">{max ? reward(d.day.missions[0], true) : `${reward(d.day.missions[0], false)} 回数券`}</span>}
        </button>
      </div>
      <Sheet open={open || Boolean(d.open)} onClose={() => setOpen(false)} title="Missions" sub={`${done} sur 3 aujourd'hui`} icon={CalendarIcon} label="Missions" className="tdy-sheet msn-sheet">
        {d.variant === 'A' && <CouponDay d={d} max={max} />}
        {d.variant === 'B' && <Board d={d} max={max} />}
        {d.variant === 'C' && <StampDay d={d} max={max} />}
        <div className="msn-sub"><b>Cette semaine</b><span>{weekSum}</span></div>
        {d.variant === 'A' && <CouponWeek d={d} max={max} />}
        {d.variant === 'B' && <Board d={d} max={max} week />}
        {d.variant === 'C' && <StampWeek d={d} />}
        <div className="msn-foot"><span>Découvertes · 3/10</span><span>Plaques · 3</span></div>
      </Sheet>
    </>
  )
}

// ── the holder's insert (Profile, phone and desk) ─────────────────
function InsertHead({ glyph, name, fig }) {
  return (
    <span className="msn-ins__head">
      <span className="pf-line__roundel" aria-hidden="true" lang="ja">{glyph}</span>
      <span className="msn-ins__names"><span className="pf-line__jp">{name}</span></span>
      <span className="msn-ins__fig">{fig}</span>
    </span>
  )
}

export function MissionsInsert() {
  const d = useMissions()
  if (!d) return null
  const max = d.plan === 'max'
  const got = d.plaques.filter(p => p.got).length
  const found = d.firsts.filter(f => f.done).length

  if (d.variant === 'A') {
    return (
      <section className="msn-ins" style={{ '--line-color': 'var(--pass-ink)' }} aria-label="Plaques">
        <InsertHead glyph="札" name="Plaques" fig={`${got}/${d.plaques.length}`} />
        <div className="msn-plates">{d.plaques.map(p => <Plate key={p.code} p={p} max={max} />)}</div>
        <InsertHead glyph="発" name="Découvertes" fig={`${found}/${d.firsts.length}`} />
        <Firsts d={d} />
      </section>
    )
  }
  if (d.variant === 'B') {
    return (
      <section className="msn-ins" style={{ '--line-color': 'var(--pass-ink)' }} aria-label="Plaques">
        <InsertHead glyph="札" name="Plaques" fig={`${got}/${d.plaques.length}`} />
        <div className="msn-rings">{d.plaques.map(p => <Ring key={p.code} p={p} max={max} />)}</div>
        <InsertHead glyph="発" name="Découvertes" fig={`${found}/${d.firsts.length}`} />
        <Firsts d={d} />
      </section>
    )
  }
  return (
    <section className="msn-ins msn-book" style={{ '--line-color': 'var(--pass-ink)' }} aria-label="Carnet d'étapes">
      <InsertHead glyph="券" name="Missions" fig={`${tally(d.day.missions)}/3`} />
      <StampDay d={d} max={max} />
      <StampWeek d={d} />
      <InsertHead glyph="発" name="Découvertes" fig={`${found}/${d.firsts.length}`} />
      <Firsts d={d} />
      <InsertHead glyph="札" name="Sceaux" fig={`${got}/${d.plaques.length}`} />
      <div className="msn-seals">{d.plaques.map(p => <Seal key={p.code} p={p} max={max} />)}</div>
    </section>
  )
}
