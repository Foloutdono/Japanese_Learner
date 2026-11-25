import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { referralSuggestion } from '../../lib/arrival'
import { playClick } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { useProfileSummary } from '../../stores/profileSummary'
import {
  answerRequest, chooseSponsor, claimReferral, releaseFilleul, toldReferral, useReferral,
} from '../../stores/referral'
import { Sheet } from '../chrome/Sheet'
import { SplitRow } from '../selection/SplitRow'
import { ChevronIcon, SearchIcon } from '../ui/Icons'

// ── 縁 — the referral, in the gate and the holder (plan 332) ──────
// The owner's pick B of the drawings: on Today a slip at the gate's foot,
// only while the referral has something to say to this learner (GET
// /api/profile's `referralNotice`: the days to name a parrain, the way to
// the reward, a request waiting, the reward paid); in the holder one door
// under the duels', and behind it one sheet with everything. A parrain is
// named in a sheet of its own, in two steps, because it is for good.
//
// The filleuls are the missions' book of tickets (Missions.jsx's idiom):
// a row each, its stub the reward, lit in the metal and a button once
// there is something to collect. Every username comes from the server;
// before a parrain accepts, the username is all either sees of the other.

const SHEET_ICON = <span lang="ja">縁</span>

function reward(n, unit) {
  return unit === 'xp' ? `+${n} XP` : `+${n}`
}

function giftOf(gift) {
  return gift.credits > 0 ? `+${gift.credits}` : `+${gift.xp} XP`
}

const initial = name => (name ?? '?').slice(0, 1).toUpperCase()

function Dots({ on, of }) {
  return (
    <span className="ref-dots" aria-hidden="true">
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  )
}

function errorOf(t, e) {
  const code = e?.code === 'pvp_not_found' ? 'referral_not_found' : e?.code
  return t.refErrors[code] ?? t.refErrors.other
}

// ── naming a parrain: found, then confirmed, for good ─────────────
// GET /api/pvp/search: the duels' own search, as the owner asked.
const searchHandle = (name, session) => apiJson(`/api/pvp/search?username=${encodeURIComponent(name)}`, session)

function ChooseBody({ d, session, onClose, find = searchHandle }) {
  const { t } = useLang()
  const [suggested] = useState(() => referralSuggestion())
  const [query, setQuery] = useState(suggested ?? '')
  const [found, setFound] = useState(null)
  const [error, setError] = useState(null)
  const [sure, setSure] = useState(false)
  const busy = useRef(false)

  const search = async name => {
    if (!name || busy.current) return
    busy.current = true
    setError(null)
    try {
      const r = await find(name, session)
      if (r?.username?.toLowerCase() === d.handle?.toLowerCase()) setError(t.refErrors.referral_self)
      else setFound(r?.username ? { username: r.username } : null)
    } catch (e) {
      setFound(null)
      setError(errorOf(t, e))
    } finally {
      busy.current = false
    }
  }
  // A link's username is a suggestion: looked up once, then confirmed.
  useEffect(() => {
    if (!suggested) return
    let live = true
    find(suggested, session)
      .then(r => { if (live && r?.username && r.username.toLowerCase() !== d.handle?.toLowerCase()) setFound({ username: r.username }) })
      .catch(() => {})   // a suggestion nobody holds is simply not shown
    return () => { live = false }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    if (busy.current) return
    busy.current = true
    try {
      await chooseSponsor(session, found.username)
      countUse('referral', 'choose')
      onClose()
    } catch (e) {
      setSure(false)
      setError(errorOf(t, e))
    } finally {
      busy.current = false
    }
  }

  if (sure && found) {
    return (
      <div className="ref-sure">
        <span className="ref-sure__seal" aria-hidden="true">{initial(found.username)}</span>
        <b className="ref-sure__name">{found.username}</b>
        <p className="pvp-sheet__help ref-sure__say">{t.refSure(found.username)}</p>
        <div className="pvp-sheet__foot ref-acts">
          <button type="button" className="btn-primary" data-action="referral-confirm" onClick={confirm}>{t.refConfirm}</button>
          <button type="button" className="btn-secondary" onClick={() => setSure(false)}>{t.refBack}</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <form className="pvp-find" role="search" aria-label={t.refFindCap}
        onSubmit={e => { e.preventDefault(); search(query.trim()) }}>
        <label className="pvp-find__cap" htmlFor="ref-find">{t.refFindCap}</label>
        <div className="field field--search pvp-find__well">
          <SearchIcon className="svg" />
          <input id="ref-find" value={query} onChange={e => { setQuery(e.target.value); setFound(null); setError(null) }}
            autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={20} />
          <button type="submit" className="btn-secondary pvp-find__go">{t.refFind}</button>
        </div>
        {found && (
          <div className="pvp-person ref-person">
            <span className="pf-line__roundel" aria-hidden="true">{initial(found.username)}</span>
            <span className="pvp-person__names">
              <span className="pvp-person__name">{found.username}</span>
              {suggested && found.username.toLowerCase() === suggested.toLowerCase() && <span className="pvp-person__sub">{t.refSuggested}</span>}
            </span>
          </div>
        )}
        {error && <p className="pvp-sheet__help pvp-error" role="alert">{error}</p>}
      </form>
      <p className="ref-gift">
        <span className="ref-gift__sum">+{d.rewards.filleul}</span>
        <span className="ref-gift__say">{t.refGift(d.unit === 'xp')}</span>
      </p>
      <div className="pvp-sheet__foot ref-acts">
        <button type="button" className="btn-primary" disabled={!found} onClick={() => setSure(true)}>
          {found ? t.refChoose(found.username) : t.refChooseEmpty}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>{t.refLater}</button>
      </div>
    </>
  )
}

export function ChooseSheet({ open, onClose, session = null, find }) {
  const { t } = useLang()
  const d = useReferral()
  if (!d?.me) return null
  return (
    <Sheet open={open} onClose={onClose} title={t.refChooseTitle} sub={t.refChooseSub} icon={SHEET_ICON}
      label={t.refChooseTitle} className="tdy-sheet ref-sheet">
      <ChooseBody d={d} session={session} onClose={onClose} find={find} />
    </Sheet>
  )
}

// ── the rows of the book ──────────────────────────────────────────
function SponsorTicket({ d, t }) {
  const s = d.me.sponsor
  const paid = s.state === 'converted'
  const sub = s.state === 'asked' ? t.refAsked
    : s.state === 'refused' ? t.refRefused
      : paid ? t.refAboard
        : t.refWindowDay(s.windowDay, s.window)
  const counting = s.state === 'asked' || s.state === 'accepted'
  return (
    <div className={`msn-cpn msn-cpn--${paid ? 'torn' : 'open'}${s.state === 'refused' ? ' msn-cpn--quiet' : ''}`} role="listitem">
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{s.username}</span>
        <span className="ref-sub">{sub}</span>
        {counting && (
          <span className="ref-prog"><Dots on={s.studyDays} of={s.studyOf} /><span className="ref-sub">{t.refStudyDays(s.studyDays, s.studyOf)}</span></span>
        )}
      </div>
      <div className="msn-cpn__stub">
        {paid
          ? <span className="msn-cpn__paid" lang="ja" role="img" aria-label={t.refAboard}>済</span>
          : <span className="msn-cpn__take">{reward(d.rewards.filleul, d.unit)}</span>}
      </div>
    </div>
  )
}

function FilleulTicket({ f, d, t, collect, release }) {
  const [asking, setAsking] = useState(false)
  const ready = f.owed > 0
  const pending = f.state === 'pending'
  const done = f.state === 'done'
  const take = ready ? reward(f.owed, d.unit) : giftOf(pending ? d.rewards.conversion : d.rewards.week)
  const body = (
    <>
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{f.username}</span>
        {pending ? (
          <span className="ref-prog"><Dots on={f.studyDays} of={f.studyOf} /><span className="ref-sub">{t.refWindowDay(f.windowDay, f.window)}</span></span>
        ) : done ? (
          <span className="ref-sub">{t.refWeeksDone(f.weeks)}</span>
        ) : (
          <span className="ref-prog"><Dots on={f.weekDays} of={f.weekOf} /><span className="ref-sub">{t.refWeek(Math.min(f.weeks, f.weeksPaid + 1), f.weeks)}</span></span>
        )}
        {!ready && f.canRelease && (asking ? (
          <span className="ref-release">
            <span className="ref-sub">{t.refReleaseSure}</span>
            <button type="button" className="ref-release__go" onClick={() => release(f.username)}>{t.refRelease}</button>
            <button type="button" className="ref-release__go ref-release__go--no" onClick={() => setAsking(false)}>{t.refBack}</button>
          </span>
        ) : (
          <button type="button" className="ref-release__go" onClick={() => setAsking(true)}>{t.refRelease}</button>
        ))}
      </div>
      <div className="msn-cpn__stub">
        {done && !ready
          ? <span className="msn-cpn__paid" lang="ja" role="img" aria-label={t.refWeeksDone(f.weeks)}>済</span>
          : <span className="msn-cpn__take">{take}</span>}
        {ready && <span className="msn-cpn__tap">{t.msnCollect}</span>}
      </div>
    </>
  )
  return (
    <div className={`msn-cpn msn-cpn--${ready ? 'ready' : done ? 'torn' : 'open'}`} role="listitem">
      {ready
        ? <button type="button" className="msn-cpn__btn" data-action="referral-collect" aria-label={`${f.username}, ${t.msnCollect}`} onClick={() => collect(f.username)}>{body}</button>
        : body}
    </div>
  )
}

function FreeTicket({ d, t, n }) {
  return (
    <div className="msn-cpn msn-cpn--open ref-free" role="listitem">
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{t.refFree(n)}</span>
        <span className="ref-sub">{t.refFreeSub}</span>
      </div>
      <div className="msn-cpn__stub"><span className="msn-cpn__take">{giftOf(d.rewards.conversion)}</span></div>
    </div>
  )
}

// ── the invitation: what it pays, and the link ────────────────────
function Invite({ d, t }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const shown = d.link.replace(/^https?:\/\//, '')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.link)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2400)
    } catch { /* no clipboard: the link stays on the screen to select */ }
  }
  const share = async () => {
    playClick()
    countUse('referral', 'share')
    if (navigator.share) {
      try { await navigator.share({ text: t.refShareText, url: d.link }); return } catch { /* closed, or refused: copy */ }
    }
    copy()
  }
  return (
    <section className="ref-invite" aria-label={t.refInviteTitle}>
      <span className="pvp-find__cap">{t.refInviteTitle}</span>
      <div className="ref-fare">
        <span className="ref-fare__cell"><b className="ref-fare__sum">+{d.rewards.filleul}</b><small className="ref-fare__say">{t.refFareThem}</small></span>
        <span className="ref-fare__cell"><b className="ref-fare__sum">{giftOf(d.rewards.conversion)}</b><small className="ref-fare__say">{t.refFareMe}</small></span>
        <span className="ref-fare__cell"><b className="ref-fare__sum">{giftOf(d.rewards.week)}</b><small className="ref-fare__say">{t.refFareWeek(d.rewards.weeks)}</small></span>
      </div>
      <div className="ref-link">
        <span className="ref-link__url">{shown}</span>
        <button type="button" className="btn-secondary ref-link__go" onClick={copy}>{t.refCopy}</button>
      </div>
      <button type="button" className="btn-primary" data-action="referral-share" onClick={share}>{t.refShare}</button>
      {copied && <p className="ref-note" role="status">{t.refCopied}</p>}
    </section>
  )
}

// ── everything, behind the holder's door ──────────────────────────
function ReferralBody({ d, session, onChoose }) {
  const { t } = useLang()
  const [error, setError] = useState(null)
  const busy = useRef(false)
  const act = fn => async (...a) => {
    if (busy.current) return
    busy.current = true
    setError(null)
    playClick()
    try {
      await fn(...a)
    } catch (e) {
      setError(errorOf(t, e))
    } finally {
      busy.current = false
    }
  }
  const collect = act(name => claimReferral(session, name))
  const release = act(name => releaseFilleul(session, name))
  const answer = act((name, yes) => answerRequest(session, name, yes))
  const { filleuls, requests, slots } = d.sponsoring
  const free = Math.max(0, slots - filleuls.length)
  return (
    <>
      {d.me.canChoose && (
        <button type="button" className="msn-foot ref-choose" onClick={onChoose}>
          <span className="pf-line__roundel" aria-hidden="true" lang="ja">縁</span>
          <span className="msn-foot__what">{t.refChooseRow}</span>
          <span className="ref-choose__days">{t.refDaysShort(d.me.daysLeft)}</span>
          <ChevronIcon direction="right" size={15} />
        </button>
      )}
      {d.me.sponsor && d.me.sponsor.state !== 'released' && (
        <>
          <div className="msn-sub"><b>{t.refYourSponsor}</b></div>
          <div className="msn-book" role="list"><SponsorTicket d={d} t={t} /></div>
        </>
      )}
      {requests.length > 0 && (
        <>
          <div className="msn-sub"><b>{t.refRequests}</b></div>
          <div className="pvp-list" role="list">
            {requests.map(q => (
              <div key={q.username} className="pvp-person ref-ask" role="listitem">
                <span className="pf-line__roundel" aria-hidden="true">{initial(q.username)}</span>
                <span className="pvp-person__names">
                  <span className="pvp-person__name">{q.username}</span>
                  <span className="pvp-person__sub">{t.refRequest}</span>
                </span>
                <span className="ref-ask__acts">
                  <button type="button" className="btn-primary ref-ask__btn" disabled={free === 0} onClick={() => answer(q.username, true)}>{t.refAccept}</button>
                  <button type="button" className="btn-secondary ref-ask__btn" onClick={() => answer(q.username, false)}>{t.refRefuse}</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {filleuls.length > 0 && (
        <>
          <div className="msn-sub"><b>{t.refFilleuls(filleuls.length, slots)}</b></div>
          <div className="msn-book" role="list">
            {filleuls.map(f => <FilleulTicket key={f.username} f={f} d={d} t={t} collect={collect} release={release} />)}
            {free > 0 && <FreeTicket d={d} t={t} n={free} />}
          </div>
        </>
      )}
      {error && <p className="msn-note" role="alert">{error}</p>}
      {free > 0 && <Invite d={d} t={t} />}
    </>
  )
}

export function ReferralSheet({ open, onClose, session = null, onChoose }) {
  const { t } = useLang()
  const d = useReferral()
  if (!d?.me) return null
  return (
    <Sheet open={open} onClose={onClose} title={t.refTitle} icon={SHEET_ICON} label={t.refTitle} className="tdy-sheet ref-sheet">
      <ReferralBody d={d} session={session} onChoose={onChoose} />
    </Sheet>
  )
}

// What the holder's door and the gate's slip open: the one sheet, or the
// parrain's own, which the first hands over to.
function useSheets(session) {
  const [which, setWhich] = useState(null)
  const sheets = (
    <>
      <ReferralSheet open={which === 'all'} onClose={() => setWhich(null)} session={session} onChoose={() => setWhich('choose')} />
      <ChooseSheet open={which === 'choose'} onClose={() => setWhich(null)} session={session} />
      <WelcomeSheet open={which === 'welcome'} onClose={() => setWhich(null)} session={session} />
    </>
  )
  return [setWhich, sheets]
}

// ── the holder's door, under the duels' ───────────────────────────
export function ReferralDoor({ session = null }) {
  const { t } = useLang()
  const d = useReferral()
  const [show, sheets] = useSheets(session)
  if (!d?.sponsoring) return null
  const { filleuls, requests, slots, owed } = d.sponsoring
  const open = () => { playClick(); countUse('referral', 'open'); show('all') }
  return (
    <>
      <div className="records records--one">
        <SplitRow className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }} onClick={open} aria-haspopup="dialog">
          <span className="pf-line__id">
            <span className="pf-line__roundel" aria-hidden="true" lang="ja">縁</span>
            <span className="pf-line__names">
              <span className="pf-line__jp">{t.refTitle}</span>
              {requests.length > 0
                ? <span className="pvp-door__waiting">{t.refNoticeRequests(requests.length)}</span>
                : owed > 0 && <span className="pvp-door__waiting">{t.refDoorOwed(reward(owed, d.unit))}</span>}
            </span>
          </span>
          <span className="record__value record__value--door">{filleuls.length}/{slots}</span>
          <ChevronIcon direction="right" size={15} className="record__chev" />
        </SplitRow>
      </div>
      {sheets}
    </>
  )
}

// ── the gate's slip: only while there is something to say ─────────
export function ReferralNotice({ session = null }) {
  const summary = useProfileSummary()
  if (!summary?.referralNotice) return null
  return <Slip session={session} />
}

function Slip({ session }) {
  const { t } = useLang()
  const d = useReferral()
  const [show, sheets] = useSheets(session)
  if (!d?.me) return sheets
  const s = d.me.sponsor
  const asked = d.sponsoring.requests.length
  let kind = null
  if (d.me.welcome) kind = 'welcome'
  else if (asked > 0) kind = 'asked'
  else if (d.me.canChoose) kind = 'choose'
  else if (s && (s.state === 'asked' || s.state === 'accepted')) kind = 'way'
  if (!kind) return sheets
  const go = () => {
    playClick()
    countUse('referral', 'notice')
    show(kind === 'welcome' ? 'welcome' : kind === 'choose' ? 'choose' : 'all')
  }
  return (
    <>
      <button type="button" className={`tdy-door ref-slip${kind === 'welcome' ? ' ref-slip--paid' : ''}`} data-action="referral-notice" aria-haspopup="dialog" onClick={go}>
        <span className="ref-slip__seal" aria-hidden="true" lang="ja">縁</span>
        <span className="tdy-door__what">
          {kind === 'welcome' && <><b>{t.refNoticeWelcome}</b> · {reward(d.rewards.filleul, d.unit)}</>}
          {kind === 'asked' && <><b>{t.refTitle}</b> · {t.refNoticeRequests(asked)}</>}
          {kind === 'choose' && <b>{t.refNoticeChoose}</b>}
          {kind === 'way' && <><b>{s.username}</b> · {s.state === 'asked' ? t.refNoticeAsked : t.refStudyDays(s.studyDays, s.studyOf)}</>}
        </span>
        {kind === 'way' && s.state === 'accepted' && <Dots on={s.studyDays} of={s.studyOf} />}
        <span className="tdy-door__go">
          {kind === 'choose' && t.refDaysShort(d.me.daysLeft)}
          {kind === 'way' && <span className="ref-slip__sum">{reward(d.rewards.filleul, d.unit)}</span>}
          <ChevronIcon direction="right" size={16} />
        </span>
      </button>
      {sheets}
    </>
  )
}

// ── the reward paid, said once ────────────────────────────────────
export function WelcomeSheet({ open, onClose, session = null }) {
  const { t } = useLang()
  const d = useReferral()
  if (!d?.me) return null
  const close = () => {
    toldReferral(session).catch(() => {})
    onClose()
  }
  const xp = d.unit === 'xp'
  return (
    <Sheet open={open} onClose={close} label={t.refNoticeWelcome} className="tdy-sheet ref-welcome">
      <span className="sheet__cap">{t.refTitle}</span>
      <div className="ref-welcome__art" aria-hidden="true">
        <span className="ref-welcome__ticket">
          <span className="ref-welcome__sum">+{d.rewards.filleul}</span>
          <span className="ref-welcome__unit" lang={xp ? undefined : 'ja'}>{xp ? 'XP' : '回数券'}</span>
        </span>
      </div>
      <h2 className="sheet__jp ref-welcome__title">{t.refNoticeWelcome}</h2>
      <p className="ref-welcome__lead">{t.refWelcomeLead(d.rewards.filleul, xp, d.me.sponsor?.username ?? '')}</p>
      <div className="pvp-sheet__foot"><button type="button" className="btn-primary" onClick={close}>{t.refThanks}</button></div>
    </Sheet>
  )
}
