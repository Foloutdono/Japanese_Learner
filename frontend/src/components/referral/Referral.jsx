import { useState } from 'react'
import { useReferral } from '../../stores/referral'
import { Sheet } from '../chrome/Sheet'
import { SearchIcon, ChevronIcon } from '../ui/Icons'
import { SplitRow } from '../selection/SplitRow'
import { InsertHead } from '../missions/Missions'

// ── 縁 — the referral, drawn into the app (plan 332) ───────────────
// Two ways to stand in the same screens, for the owner to pick from at
// /dev/referral: A, an insert in the holder (the filleuls as a book of
// tickets, like the missions') and a sheet over Today that asks once;
// B, a notice on the gate's foot and one door in the holder, everything
// behind it in one sheet. Every piece reads the store (stores/referral)
// and draws nothing without it, so a production build, which plants none,
// carries none of it. Whatever is picked stays; the other goes.
//
// French literals while this is a drawing; the built feature takes its
// texts from the locales, in three languages.

const reward = r => (r.credits > 0 ? `+${r.credits}` : `+${r.xp} XP`)
const initial = name => name.slice(0, 1).toUpperCase()

function Dots({ on, of }) {
  return (
    <span className="ref-dots" aria-hidden="true">
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  )
}

// ── choosing a parrain: the one thing the learner must be sure of ──
// Their pseudo, searched as the duels' are; before they accept, all anyone
// sees of the other is the pseudo. A link's pseudo is a suggestion: the
// learner confirms. Once, and for good.
export function ChooseBody({ d, onClose }) {
  const preset = d.me.preset
  const [query, setQuery] = useState(preset ?? '')
  const [found, setFound] = useState(preset ? { username: preset, state: 'ok' } : null)
  const search = e => {
    e.preventDefault()
    const name = query.trim()
    if (!name) return setFound(null)
    setFound({ username: name, state: name.toLowerCase() === 'hana' ? 'full' : 'ok' })
  }
  return (
    <>
      <form className="pvp-find ref-find" onSubmit={search} role="search" aria-label="Pseudo de ton parrain">
        <label className="pvp-find__cap" htmlFor="ref-find">Pseudo de ton parrain</label>
        <div className="field field--search pvp-find__well">
          <SearchIcon className="svg" />
          <input id="ref-find" value={query} onChange={e => { setQuery(e.target.value); setFound(null) }}
            autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={20} />
          <button type="submit" className="btn-secondary pvp-find__go">Chercher</button>
        </div>
        {found && (
          <div className="pvp-person">
            <span className="pf-line__roundel" aria-hidden="true">{initial(found.username)}</span>
            <span className="pvp-person__names">
              <span className="pvp-person__name">{found.username}</span>
              {preset && found.username === preset && <span className="pvp-person__sub">Nommée par le lien que tu as suivi</span>}
            </span>
          </div>
        )}
        {found?.state === 'full' && <p className="pvp-sheet__help pvp-error" role="alert">{found.username} a déjà trois filleuls.</p>}
      </form>
      <p className="pvp-sheet__help">
        Un seul parrain, et pour toujours. {d.me.daysLeft > 0 && `Il te reste ${d.me.daysLeft} jours pour le choisir.`}
      </p>
      <div className="pvp-sheet__foot ref-acts">
        <button type="button" className="btn-primary" disabled={found?.state !== 'ok'} onClick={onClose}>
          {found?.state === 'ok' ? `Choisir ${found.username}` : 'Choisir mon parrain'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>Plus tard</button>
      </div>
    </>
  )
}

export function ChooseSheet({ open, onClose }) {
  const d = useReferral()
  if (!d) return null
  return (
    <Sheet open={open} onClose={onClose} title="Choisis ton parrain" sub="Quelqu'un t'a invité ?" icon={<span lang="ja">縁</span>} label="Choisis ton parrain" className="tdy-sheet ref-sheet">
      <ChooseBody d={d} onClose={onClose} />
    </Sheet>
  )
}

// ── the rows, in the missions' book ───────────────────────────────
function SponsorRow({ me, d }) {
  const s = me.sponsor
  const done = s.state === 'converted'
  return (
    <div className={`msn-cpn msn-cpn--${done ? 'torn' : 'open'}`}>
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{s.username}</span>
        <span className="ref-sub">Ton parrain · {done ? 'tu es à bord' : `jour ${s.windowDay} sur ${s.window}`}</span>
        {!done && <span className="ref-prog"><Dots on={s.studyDays} of={s.studyOf} /><span className="msn-fig">{s.studyDays}<small>/{s.studyOf} jours</small></span></span>}
      </div>
      <div className="msn-cpn__stub">
        {done ? <span className="msn-cpn__paid" lang="ja">済</span> : <span className="msn-cpn__take">+{d.rewards.filleul}</span>}
      </div>
    </div>
  )
}

function FilleulRow({ f, d }) {
  const ready = f.owed > 0
  const pending = f.state === 'pending'
  return (
    <div className={`msn-cpn msn-cpn--${ready ? 'ready' : 'open'}`}>
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{f.username}</span>
        {pending ? (
          <span className="ref-prog"><Dots on={f.studyDays} of={f.studyOf} /><span className="ref-sub">jour {f.windowDay} sur {f.window}</span></span>
        ) : (
          <span className="ref-prog"><Dots on={f.weekDays} of={f.weekOf} /><span className="ref-sub">semaine {f.weeksPaid} sur {f.weeks}</span></span>
        )}
      </div>
      <div className="msn-cpn__stub">
        <span className="msn-cpn__take">{reward(pending ? d.rewards.conversion : d.rewards.week)}</span>
        {ready && <span className="msn-cpn__tap">Récolter</span>}
      </div>
    </div>
  )
}

function EmptyRow({ d, all = 0 }) {
  return (
    <div className="msn-cpn msn-cpn--open ref-empty">
      <div className="msn-cpn__body">
        <span className="msn-cpn__label">{all > 1 ? `${all === 3 ? 'Trois' : all} places libres` : 'Place libre'}</span>
        <span className="ref-sub">Invite quelqu'un avec ton lien</span>
      </div>
      <div className="msn-cpn__stub"><span className="msn-cpn__take">{reward(d.rewards.conversion)}</span></div>
    </div>
  )
}

function FilleulBook({ d }) {
  const list = d.sponsoring.filleuls
  const empty = Math.max(0, d.sponsoring.slots - list.length)
  return (
    <div className="msn-book" role="list">
      {list.map(f => <FilleulRow key={f.username} f={f} d={d} />)}
      {/* A learner with nobody yet is shown one row for the three places, not three. */}
      {list.length === 0 ? <EmptyRow d={d} all={empty} /> : Array.from({ length: empty }, (_, i) => <EmptyRow key={i} d={d} />)}
    </div>
  )
}

function InviteLink({ d }) {
  return (
    <div className="ref-link">
      <span className="ref-link__url">{d.link}</span>
      <button type="button" className="btn-secondary ref-link__go">Copier</button>
    </div>
  )
}

// What the holder says about the referral, whichever side the learner is on.
function Body({ d, onChoose }) {
  const hasSponsor = Boolean(d.me.sponsor)
  const canChoose = !hasSponsor && d.me.daysLeft > 0
  return (
    <>
      {hasSponsor && <div className="msn-book"><SponsorRow me={d.me} d={d} /></div>}
      {canChoose && (
        <button type="button" className="msn-foot ref-choose" onClick={onChoose}>
          <span className="pf-line__roundel" aria-hidden="true" lang="ja">縁</span>
          <span className="msn-foot__what">Choisir mon parrain · {d.me.daysLeft} j</span>
          <ChevronIcon direction="right" size={15} />
        </button>
      )}
      {(d.sponsoring.filleuls.length > 0 || !hasSponsor) && <FilleulBook d={d} />}
      <InviteLink d={d} />
    </>
  )
}

// ── A: the holder's insert ────────────────────────────────────────
export function ReferralInsert() {
  const d = useReferral()
  const [choosing, setChoosing] = useState(false)
  if (!d || d.variant !== 'A') return null
  const filled = d.sponsoring.filleuls.length
  return (
    <>
      <section className="msn-ins" style={{ '--line-color': 'var(--pass-ink)' }} aria-label="Parrainage">
        <InsertHead glyph="縁" name="Parrainage" fig={`${filled}/${d.sponsoring.slots}`} />
        <Body d={d} onChoose={() => setChoosing(true)} />
      </section>
      <ChooseSheet open={choosing} onClose={() => setChoosing(false)} />
    </>
  )
}

// ── B: one door in the holder, one sheet behind it ────────────────
export function ReferralDoor() {
  const d = useReferral()
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  if (!d || d.variant !== 'B') return null
  const owed = d.sponsoring.owed ?? 0
  const filled = d.sponsoring.filleuls.length
  return (
    <>
      <div className="records records--one">
        <SplitRow className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }} onClick={() => setOpen(true)}>
          <span className="pf-line__id">
            <span className="pf-line__roundel" aria-hidden="true" lang="ja">縁</span>
            <span className="pf-line__names">
              <span className="pf-line__jp">Parrainage</span>
              {owed > 0 && <span className="pvp-door__waiting">{reward({ credits: owed, xp: owed })} à récolter</span>}
            </span>
          </span>
          <span className="record__value record__value--door">{filled}/{d.sponsoring.slots}</span>
          <ChevronIcon direction="right" size={15} className="record__chev" />
        </SplitRow>
      </div>
      <Sheet open={open || d.open === 'manage'} onClose={() => setOpen(false)} title="Parrainage" icon={<span lang="ja">縁</span>} label="Parrainage" className="tdy-sheet ref-sheet">
        <Body d={d} onChoose={() => { setOpen(false); setChoosing(true) }} />
      </Sheet>
      <ChooseSheet open={choosing} onClose={() => setChoosing(false)} />
    </>
  )
}

// ── B: the gate's notice, three days, never a sheet over the gate ──
export function ReferralNotice() {
  const d = useReferral()
  const [open, setOpen] = useState(false)
  if (!d || d.variant !== 'B') return null
  const paid = d.me.welcome
  if (!paid && !(d.me.daysLeft > 0 && !d.me.sponsor)) return null
  return (
    <>
      <button type="button" className={`tdy-door ref-notice${paid ? ' ref-notice--paid' : ''}`} onClick={() => setOpen(true)}>
        <span className="pf-line__roundel" aria-hidden="true" lang="ja">縁</span>
        <span className="tdy-door__what"><b>{paid ? 'Tu es à bord' : 'Choisis ton parrain'}</b>{paid && ` · +${d.rewards.filleul} 回数券`}</span>
        {!paid && <span className="tdy-door__go">{d.me.daysLeft} j<ChevronIcon direction="right" size={16} /></span>}
      </button>
      <ChooseSheet open={open || d.open === 'choose'} onClose={() => setOpen(false)} />
    </>
  )
}

// ── A: what the conversion pays, said once over Today ─────────────
export function WelcomeSheet({ open, onClose }) {
  const d = useReferral()
  if (!d) return null
  return (
    <Sheet open={open} onClose={onClose} label="Bienvenue à bord" className="tdy-sheet ref-welcome">
      <span className="sheet__cap">Parrainage</span>
      <div className="ref-welcome__art" aria-hidden="true">
        <span className="ref-welcome__ticket"><span className="ref-welcome__sum">+{d.rewards.filleul}</span><span className="ref-welcome__unit" lang="ja">回数券</span></span>
      </div>
      <h2 className="sheet__jp ref-welcome__title">Bienvenue à bord</h2>
      <p className="ref-welcome__lead">Trois jours d'étude : ton compte est confirmé et tes {d.rewards.filleul} crédits sont à toi. {d.me.sponsor?.username} est prévenue.</p>
      <div className="pvp-sheet__foot"><button type="button" className="btn-primary" onClick={onClose}>Merci</button></div>
    </Sheet>
  )
}
