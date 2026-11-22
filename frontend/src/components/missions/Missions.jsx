import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { claimMission, onMissionsOpen, takeMissionsOpen, useMissions, useMissionsBook } from '../../stores/missions'
import { countUse } from '../../lib/screenTrail'
import { playClick } from '../../lib/audio'
import { GLYPHS, PLATES, PLATFORM_LINE, daySum, doneCount, rewardText } from '../../domain/missions'
import { Sheet } from '../chrome/Sheet'
import { CalendarIcon, ChevronIcon } from '../ui/Icons'

// ── 任務 — the missions, in the gate and the holder (plan 328) ────
// The owner's pick of the drawings (A, everywhere): a small pill under
// the legend on Today (MissionsGate) opens a sheet of coupons, one a
// mission, its stub torn to collect the reward; the holder carries the
// plates the achievements hang as, and the discoveries' lattice
// (MissionsInsert). Every piece reads the stores (stores/missions) and
// draws nothing without an answer, so a gate that has not heard from the
// server shows its legend as it always did.
//
// A mission's goal and reward come from the server; the words are the
// locales' (`msnLabel`, keyed by the catalogue's id). A coupon whose
// mission is done is a button: the tap collects, the answer redraws the
// pill and the sheet, and the balance and the level are asked again.

const lineOf = m => {
  const line = PLATFORM_LINE[m.platform]
  return line ? { '--line-color': `var(--line-${line})` } : undefined
}

function Bar({ m }) {
  return <span className="msn-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (100 * m.have) / m.of)}%` }} /></span>
}

function Figure({ m }) {
  return <span className="msn-fig">{m.have}<small>/{m.of}</small></span>
}

// ── the coupon: a body, a perforation, a stub to tear ─────────────
function Coupon({ m, scope, t, collect, popped }) {
  const state = m.paid ? 'torn' : m.done ? 'ready' : 'open'
  const label = t.msnLabel[m.kind](m)
  const body = (
    <>
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{label}</span>
        {state === 'open' && <><Bar m={m} /><Figure m={m} /></>}
        {state !== 'open' && <span className="msn-cpn__sub">{state === 'torn' ? t.msnCollected : t.msnDone}</span>}
      </div>
      <div className="msn-cpn__stub">
        {state === 'torn'
          ? <span className="msn-cpn__paid" lang="ja">済</span>
          : <span className="msn-cpn__take">{rewardText(m)}</span>}
        {state === 'ready' && <span className="msn-cpn__tap">{t.msnCollect}</span>}
      </div>
    </>
  )
  return (
    <div className={`msn-cpn msn-cpn--${state}${popped === m.kind ? ' msn-just' : ''}`} style={lineOf(m)}>
      {state === 'ready' ? (
        <button type="button" className="msn-cpn__btn" data-action="mission-collect" aria-label={`${label}, ${t.msnCollect}`} onClick={() => collect(scope, m.kind)}>{body}</button>
      ) : body}
      {popped === m.kind && <span className="msn-pop" aria-hidden="true">{rewardText(m)}</span>}
    </div>
  )
}

// ── what collecting does, for the sheet and the insert ────────────
function useCollect(session) {
  const [popped, setPopped] = useState(null)
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const collect = async (scope, kind) => {
    if (busy.current) return
    busy.current = true
    setFailed(false)
    playClick()
    try {
      const paid = await claimMission(session, scope, kind)
      if (paid) {
        setPopped(kind)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setPopped(null), 2400)
      }
    } catch {
      setFailed(true)
    } finally {
      busy.current = false
    }
  }
  return { collect, popped, failed }
}

// ── the gate's pill, and the sheet it opens ───────────────────────
export function MissionsGate({ style, session = null }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const d = useMissions()
  const [open, setOpen] = useState(() => takeMissionsOpen())
  const { collect, popped, failed } = useCollect(session)
  useEffect(() => onMissionsOpen(() => { takeMissionsOpen(); setOpen(true) }), [])
  if (!d?.day) return null      // an answer that is not the missions' is no answer
  const done = doneCount(d.day)
  const unlit = d.day.missions.map(m => m.done)
  const show = () => { playClick(); countUse('missions', 'open'); setOpen(true) }
  return (
    <>
      <div className="tpr-at msn-at" style={style}>
        <button type="button" className="msn-pill" data-action="missions-open" aria-haspopup="dialog" aria-label={t.msnPillLabel(done)} onClick={show}>
          <span className="msn-pill__dots" aria-hidden="true">
            {unlit.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}
          </span>
          <span className="msn-pill__n"><b>{done}</b>/3</span>
          <span className="msn-pill__sum">{daySum(d.day)}</span>
          {d.waiting > 0 && <span className="msn-pill__flag" aria-hidden="true" />}
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.msnTitle} sub={t.msnSubDay(done)} icon={CalendarIcon} label={t.msnTitle} className="tdy-sheet msn-sheet">
        <div className="msn-stack">
          {d.day.missions.map(m => <Coupon key={m.kind} m={m} scope="day" t={t} collect={collect} popped={popped} />)}
          {d.day.bonus && <Coupon m={d.day.bonus} scope="bonus" t={t} collect={collect} popped={popped} />}
        </div>
        <div className="msn-sub"><b>{t.msnWeek}</b></div>
        <div className="msn-stack msn-stack--tight">
          {d.week.missions.map(m => <Coupon key={m.kind} m={m} scope="week" t={t} collect={collect} popped={popped} />)}
        </div>
        {failed && <p className="msn-note" role="status">{t.msnClaimError}</p>}
        <button type="button" className="msn-foot" onClick={() => { setOpen(false); navigate('/profile') }}>
          <span>{t.msnPlates} · {t.msnFirsts}</span>
          <ChevronIcon direction="right" size={15} />
        </button>
      </Sheet>
    </>
  )
}

// ── the holder's insert: the plates and the discoveries ───────────
function InsertHead({ glyph, name, fig }) {
  return (
    <span className="msn-ins__head">
      <span className="pf-line__roundel" aria-hidden="true" lang="ja">{glyph}</span>
      <span className="msn-ins__names"><span className="pf-line__jp">{name}</span></span>
      <span className="msn-ins__fig">{fig}</span>
    </span>
  )
}

function Plate({ a, t, max, collect, popped }) {
  const p = PLATES[a.key]
  const ready = a.reached && !a.paid
  const inner = (
    <>
      <span className="msn-plate__code">{p.code}</span>
      <span className="msn-plate__jp" lang="ja">{p.jp}</span>
      <span className="msn-plate__kana" lang="ja">{p.kana}</span>
      <span className="msn-plate__en">{t.msnMark[a.key]}</span>
      <span className="msn-plate__foot">
        {ready ? <>{rewardText(a)}<small> · {t.msnCollect}</small></> : a.reached ? <span lang="ja">済</span> : <>{a.have}<small>/{a.of}</small></>}
      </span>
    </>
  )
  const cls = `msn-plate${a.reached ? '' : ' msn-plate--off'}${max ? ' msn-plate--max' : ''}${popped === a.key ? ' msn-just' : ''}`
  return ready
    ? <button type="button" className={`${cls} msn-plate--ready`} data-action="mission-collect" onClick={() => collect('mark', a.key)}>{inner}</button>
    : <div className={cls}>{inner}</div>
}

function Cell({ d, t, collect }) {
  const ready = d.reached && !d.paid
  const inner = (
    <>
      <b lang="ja">{GLYPHS[d.key]}</b>
      <small>{ready ? rewardText(d) : t.msnMark[d.key]}</small>
    </>
  )
  const cls = `msn-lattice__cell${d.reached ? ' on' : ''}${ready ? ' msn-lattice__cell--ready' : ''}`
  return ready
    ? <button type="button" className={cls} data-action="mission-collect" aria-label={`${t.msnMark[d.key]}, ${t.msnCollect}`} onClick={() => collect('mark', d.key)}>{inner}</button>
    : <span className={cls}>{inner}</span>
}

export function MissionsInsert({ session = null }) {
  const { t } = useLang()
  const book = useMissionsBook()
  const { collect, popped } = useCollect(session)
  if (!book?.achievements) return null
  const max = book.unit === 'xp'
  const got = book.achievements.filter(a => a.reached).length
  const found = book.discoveries.filter(d => d.reached).length
  return (
    <section className="msn-ins" style={{ '--line-color': 'var(--pass-ink)' }} aria-label={t.msnPlates}>
      <InsertHead glyph="札" name={t.msnPlates} fig={t.msnFound(got, book.achievements.length)} />
      <div className="msn-plates">
        {book.achievements.map(a => <Plate key={a.key} a={a} t={t} max={max} collect={collect} popped={popped} />)}
      </div>
      <InsertHead glyph="発" name={t.msnFirsts} fig={t.msnFound(found, book.discoveries.length)} />
      <div className="msn-lattice">
        {book.discoveries.map(d => <Cell key={d.key} d={d} t={t} collect={collect} />)}
      </div>
    </section>
  )
}
