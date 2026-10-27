import { Fragment, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { Sheet } from '../chrome/Sheet'
import { HourglassIcon, BoltIcon, BellIcon, BooksIcon, PencilIcon, UserIcon } from '../ui/Icons'
import { Emphasized } from '../ui/Emphasized'
import { ProviderButton } from '../account/ProviderButton'
import { authRedirectError, authRedirectMessage, isAlreadyLinked } from '../../lib/authRedirect'
import { authErrorMessage } from '../../lib/authErrors'
import { claimAccount } from '../../lib/guest'
import { composing } from '../../lib/keyGuards'
import { playUi } from '../../lib/audio'
import { DEPARTURES, DEPART_JP, DEPART_TIMES } from '../onboarding/departures'
import { serviceLabel } from '../onboarding/paces'
import {
  LINES, RECOMMENDED_RHYTHM, RHYTHMS, approx, bucketFor, clampDeparture, firstDeparture,
  itemsForRhythm, minutesToTime, timeToMinutes, toggleLine,
} from '../../domain/boarding'
import { CARD_NAME_MAX, cardNameLength } from '../../domain/passCard'
import { BoardLink, Continue } from './BoardFrame'
import { CheckMark, LockMark } from './icons'

// ── 乗車 — the card's sheets (plan 247) ──────────────────────────
// The owner's pick C of the boarding's canvas, "the card is the form":
// every printed field of the card is a door, and each opens its sheet
// over the card, as Today's services sheet does -- the handle, the
// field's name, and the choice drawn as the boarding drew it when it was
// a question of its own: the line climbing (the goal), the departure
// board (the rhythm), the flap board (the hour), the lines' checks.
// Each sheet prints what its choice does to the arrival before it is
// picked. A pick is a save and shuts the sheet (Settings' rule for a
// choice that is a save), and the card under it reprints at once; the
// name and the address are typed, so theirs carry their own gate. The
// lines are switches and the hour's drums turn without shutting, so on
// a phone those two end on a gate of their own too, « C'est bon », as
// Today's services sheet ends on its own (plan 247): a sheet a thumb
// opened is never one only a scrim or a drag can close. The desk's
// dialog has its ✕.
//
// The sheets portal out of the boarding's frame (components/chrome/Sheet),
// so they wear `.brd-sheet`, which names the boarding's own inks again
// (index.css): the boards they borrow are drawn in them.

function CardSheet({ open, onClose, title, sub = null, icon, kind, children }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} sub={sub} icon={icon} label={title} className={`brd-sheet brd-sheet--${kind}`} dismiss>
      {children}
    </Sheet>
  )
}

// A pick in a list: the wood pick every list in the app makes.
const pickSound = () => playUi('click-mode-selection')

// The switches' sheets' way out on a phone: a gate of their own. The
// desk's dialog has its ✕ and Escape (components/chrome/Sheet's
// `dismiss`), and none of the room a short window would need for it.
function SheetDone({ onClose }) {
  const { t } = useLang()
  const desk = useDesk()
  if (desk) return null
  return <Continue label={t.brdSheetDone} onClick={onClose} data-action="sheet-done" />
}

// ── Objectif — the line climbing (the goal) ──────────────────────
// The stops ahead, the hardest on top, each printing the day it is
// reached at the card's pace on the card's lines; under them where the
// learner stands (a reader's level: "You are here"), the ride from there
// to the pick in the pass's gold. `stops` are in line order, each
// { key, code, jp, name, desc, date }; `here` the same, or null for a
// beginner, whose ride starts at the kana's own stop.
export function GoalSheet({ open, onClose, stops, here = null, value, onPick, cap = null }) {
  const { t } = useLang()
  const rows = [...stops].reverse()
  if (here) rows.push({ ...here, here: true })
  const picked = rows.findIndex(row => !row.here && row.key === value)
  const last = rows.length - 1
  const ride = picked < 0 ? 0 : last - picked
  return (
    <CardSheet open={open} onClose={onClose} title={t.brdSheetGoal} sub={cap} icon={HourglassIcon} kind="goal">
      {/* Plain numbers, placed by the sheet: the rail runs a row's height
          between the stops' centres, the ride from the pick down. */}
      <div className="brd-goals" style={{ '--rows': last, '--from': Math.max(0, picked), '--ride': ride }}>
        <span className="brd-goals__rail" aria-hidden="true" />
        {ride > 0 && <span className="brd-goals__ride" aria-hidden="true" />}
        <ol className="brd-goals__list" aria-label={t.brdSheetGoal}>
          {rows.map((row, i) => {
            const state = row.here ? 'here' : i === picked ? 'on' : picked >= 0 && i > picked ? 'ride' : null
            const inner = (
              <>
                <span className={`brd-goal__dot${row.jp ? ' brd-goal__dot--jp' : ''}`} lang={row.jp ? 'ja' : undefined} aria-hidden="true">{row.code}</span>
                <span className="brd-goal__txt">
                  <span className="brd-goal__top">
                    <span className="brd-goal__name">{row.name}</span>
                    {!row.here && row.date && <span className="brd-goal__date">{row.date}</span>}
                  </span>
                  <span className="brd-goal__desc">{row.here ? t.levelCurrentMark : row.desc}</span>
                </span>
              </>
            )
            return (
              <li key={row.key}>
                {row.here
                  ? <span className="brd-goal brd-goal--here">{inner}</span>
                  : (
                    <button
                      type="button"
                      className={`brd-goal${state ? ` brd-goal--${state}` : ''}`}
                      aria-pressed={i === picked}
                      onClick={() => { pickSound(); onPick(row.key) }}
                      data-goal={row.key}
                    >
                      {inner}
                    </button>
                  )}
              </li>
            )
          })}
        </ol>
      </div>
    </CardSheet>
  )
}

// ── Rythme — four trains on the board (the rhythm) ───────────────
// The boarding's 発車標 (plan 168), moved here whole: a row a rhythm, as
// a departure board prints a train -- its service (the board's own names,
// components/onboarding/paces.js), the minutes a day with the new items
// they hold, and where it arrives and when; the one picked lit in the
// gate's gold. Under it the first stop, the kana, read by the day the
// pace picked reaches them (none for a reader of both scripts).
export function RhythmSheet({ open, onClose, value, onPick, rides = null, stop = null, first = null }) {
  const { t } = useLang()
  return (
    <CardSheet open={open} onClose={onClose} title={t.brdSheetRhythm} icon={BoltIcon} kind="rhythm">
      <DepartureBoard value={value} onChange={min => { pickSound(); onPick(min) }} rides={rides} stop={stop} first={first} />
    </CardSheet>
  )
}

function DepartureBoard({ value, onChange, rides, stop, first }) {
  const { t, lang } = useLang()
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  const goal = stop && stop !== 'novice' ? stop : null
  return (
    <>
      <div className="brd-trains" role="group" aria-label={t.brdSheetRhythm}>
        <p className="brd-trains__cols brd-trains__head" aria-hidden="true">
          <span>{t.brdTermService}</span>
          <span>{t.brdADay}</span>
          <span>{goal ? t.brdArriveAt(goal) : t.statusArrival}</span>
        </p>
        {RHYTHMS.map((min, i) => {
          const ride = rides?.[i]
          return (
            <button
              key={min}
              type="button"
              className="brd-trains__cols brd-train"
              aria-pressed={value === min}
              onClick={() => onChange(min)}
              data-rhythm={min}
            >
              <span className="brd-train__svc">
                <span className="brd-train__jp" lang="ja">{serviceLabel(min).jp}</span>
                <span className="brd-train__name">{t.brdRhythmName[min]}</span>
                {min === RECOMMENDED_RHYTHM && <span className="brd-train__tag">{t.onbPaceRecommended}</span>}
              </span>
              <span className="brd-train__min">
                <span className="brd-train__fig"><b>{min}</b>min</span>
                <span className="brd-train__new">{t.brdNewItems(itemsForRhythm(min))}</span>
              </span>
              <span className="brd-train__arr">
                {ride && (
                  <>
                    <span className="brd-train__date">{date.format(ride.date)}</span>
                    <span className="brd-train__days">{t.brdRideDays(ride.days)}</span>
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {first && <p className="brd-trains__first"><Emphasized text={t.brdFirstStop(first.date)} /></p>}
    </>
  )
}

// ── Départ — the flap board (the hour) ───────────────────────────
// The boarding's board as the control (plan 168), moved here whole: ▲
// and ▼ over the two hour drums move the hour, over the two minute drums
// the half hour, the day held from six to half past eleven
// (clampDeparture) -- those turn the board and leave the sheet open --
// and the three announced rides under it are picks, which shut it. Then
// the reminder: on a native shell the nudge's own switch (the OS asks,
// its own words); on the web, where a tab cannot promise to be open at
// seven, one event a day at the hour for the learner's own calendar.
export function HourSheet({
  open, onClose, minute, onChange, onPick, now,
  native = false, notifications = false, denied = false, onRemind = null, onAgenda = null,
}) {
  const { t } = useLang()
  const time = minutesToTime(minute)
  return (
    <CardSheet open={open} onClose={onClose} title={t.brdSheetHour} icon={BellIcon} kind="hour">
      <HourBoard minute={minute} onChange={onChange} onPick={onPick} now={now ?? new Date()} />
      {native
        ? (
          <>
            <button type="button" className="brd-remind" aria-pressed={notifications} onClick={onRemind} data-action="remind">
              <span className="brd-remind__chk" aria-hidden="true"><CheckMark /></span>
              <span className="brd-remind__txt"><Emphasized text={t.brdRemindAt(time)} /></span>
            </button>
            {/* The OS will not ask again: the switch says why it stays off. */}
            {denied && !notifications && <p className="brd-sheet__note" role="status" data-note="denied">{t.notifDenied}</p>}
          </>
        )
        : <BoardLink onClick={onAgenda} data-action="agenda">{t.brdAgendaAdd}</BoardLink>}
      <SheetDone onClose={onClose} />
    </CardSheet>
  )
}

const STEPS = [[60, 30], [-60, -30]]

function HourBoard({ minute, onChange, onPick, now }) {
  const { t } = useLang()
  const time = minutesToTime(minute)
  const bucket = bucketFor(minute)
  const { later } = firstDeparture(now, minute)
  const turn = by => {
    const next = clampDeparture(minute + by)
    return { disabled: next === minute, onClick: () => onChange(next) }
  }
  return (
    <>
      <div className="brd-board brd-clock" role="group" aria-label={t.brdDayAria}>
        {STEPS.map(([hour, half], row) => (
          <Fragment key={hour}>
            {row === 1 && <Flaps time={time} />}
            <p className="brd-clock__steps">
              <button type="button" className="brd-clock__step" aria-label={hour > 0 ? t.brdHourLater : t.brdHourEarlier} {...turn(hour)}>
                <StepChevron up={hour > 0} />
              </button>
              <button type="button" className="brd-clock__step" aria-label={half > 0 ? t.brdHalfLater : t.brdHalfEarlier} {...turn(half)}>
                <StepChevron up={half > 0} />
              </button>
            </p>
          </Fragment>
        ))}
      </div>
      <div className="brd-hours" role="group" aria-label={t.brdDeparture}>
        {DEPARTURES.map(id => (
          <button
            key={id}
            type="button"
            className="brd-hour"
            aria-pressed={bucket === id}
            // The board's own flaps, when the hour moves (BoardingFlow's
            // turnHour): never a pick over them, a flam.
            onClick={() => onPick(timeToMinutes(DEPART_TIMES[id]))}
            data-hour={id}
          >
            <span className="brd-hour__jp" lang="ja">{DEPART_JP[id]}</span>
            <span className="brd-hour__name">{t.destHour[id]}</span>
            <span className="brd-hour__time">{DEPART_TIMES[id]}</span>
          </button>
        ))}
      </div>
      <p className="brd-clock__when"><Emphasized text={t.brdTrainAt(later, time)} /></p>
    </>
  )
}

function StepChevron({ up }) {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points={up ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
    </svg>
  )
}

// ── The board settles ────────────────────────────────────────────
// A 発車標 does not arrive already showing the time: every drum is
// spinning when the board lights, and they stop one after another from
// the left, which is the sound the whole thing is remembered for. So the
// four drums spin on their own tick and stop on a stagger. The
// aria-label carries the real time throughout -- a screen reader is
// told the hour, never the spin -- and reduced motion gets the settled
// board on the first frame.
const SPIN_TICK_MS = 60
const SPIN_STOP_MS = 260
const SPIN_STAGGER_MS = 180

function useSettling(digits) {
  const still = prefersStill()
  const [face, setFace] = useState(() => (still ? digits : digits.map(() => '0')))
  // How many drums have stopped, left to right -- the stops fire in
  // order, so one counter says which are still turning and the count
  // itself is what re-renders the row.
  const [stopped, setStopped] = useState(still ? digits.length : 0)
  const turning = useRef(digits.map(() => true))

  useEffect(() => {
    if (still) return undefined
    const tick = setInterval(() => {
      // The live flags, not the render's: an array read from inside an
      // interval is the one the interval closed over on the frame it
      // was created.
      setFace(f => f.map((d, i) => (turning.current[i] ? String(Math.floor(Math.random() * 10)) : d)))
    }, SPIN_TICK_MS)
    const stops = digits.map((_, i) => setTimeout(() => {
      turning.current[i] = false
      setFace(f => f.map((d, j) => (j === i ? digits[j] : d)))
      setStopped(n => n + 1)
      if (turning.current.every(on => !on)) clearInterval(tick)
    }, SPIN_STOP_MS + i * SPIN_STAGGER_MS))
    return () => { clearInterval(tick); stops.forEach(clearTimeout) }
    // Once, when the board lights. A later change to the hour turns its
    // own drum (brd-flap--turn) rather than re-shuffling the whole board
    // under the learner's finger, which is why `digits` is not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Settled, the board IS the time: a change to the hour shows on the
  // next render rather than waiting for a tick that no longer runs.
  const settled = stopped >= digits.length
  return { face: settled ? digits : face, stopped }
}

function prefersStill() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function Flaps({ time }) {
  const [h1, h2, , m1, m2] = time.split('')
  const { face, stopped } = useSettling([h1, h2, m1, m2])
  // A drum still turning says so, so the board can be styled and read
  // mid-spin. The label is the hour throughout: a screen reader is told
  // the time, never the shuffle.
  const drum = i => `brd-flap${i >= stopped ? ' brd-flap--spin' : ''}`
  // Keyed on the time so the last tile remounts, and flips once, per change.
  return (
    <div className="brd-board__flaps" aria-label={time}>
      <span className={drum(0)}>{face[0]}</span>
      <span className={drum(1)}>{face[1]}</span>
      <span className="brd-board__colon" aria-hidden="true">:</span>
      <span className={drum(2)}>{face[2]}</span>
      <span key={time} className={`${drum(3)} brd-flap--turn`}>{face[3]}</span>
    </div>
  )
}

// ── Lignes — a check per line (the lines) ────────────────────────
// The kana on every ticket, so no answer (a strip, locked, for a learner
// short of both scripts); then the three lines, each its glyph in its
// pigment's ring, what it carries on this ride ("~700 words to N5") and
// its check. A check is a switch, not a pick, so the sheet stays open;
// the last line on refuses to go off, and says so. Under them the month
// the lines checked arrive in, which moves as one is taken off.
const GLYPH = { vocab: '語', kanji: '漢', grammar: '文' }
const ROUNDED = n => approx(n, n < 200 ? 10 : n < 2000 ? 50 : 100)

export function LinesSheet({ open, onClose, value, onChange, carries = null, stop = null, arrival = null, novice = false }) {
  const { t } = useLang()
  return (
    <CardSheet open={open} onClose={onClose} title={t.brdSheetLines} icon={BooksIcon} kind="lines">
      <LineChecks value={value} onChange={onChange} carries={carries} stop={stop} arrival={arrival} novice={novice} />
      <SheetDone onClose={onClose} />
    </CardSheet>
  )
}

function LineChecks({ value, onChange, carries, stop, arrival, novice }) {
  const { t, lang } = useLang()
  const [none, setNone] = useState(false)
  const reach = stop === 'novice' ? null : stop
  function toggle(line) {
    const next = toggleLine(value, line)
    if (next.length === 0) { setNone(true); return }
    setNone(false)
    onChange(next)
  }
  return (
    <>
      {novice && (
        <p className="brd-lines__kana">
          <span className="brd-lines__disc" lang="ja" aria-hidden="true">あ</span>
          <span className="brd-lines__kana-txt">
            <b>{t.brdKanaFirstShort}</b>
            <span className="brd-lines__lock"><LockMark />{t.brdOnEveryTicket}</span>
          </span>
        </p>
      )}
      <ul className="brd-lines" aria-label={t.brdSheetLines}>
        {LINES.map(line => {
          const on = value.includes(line)
          const n = carries?.[line] ?? 0
          return (
            <li key={line}>
              <button type="button" className="brd-line" aria-pressed={on} onClick={() => toggle(line)} data-line={line}>
                <span className="brd-line__ring" lang="ja" aria-hidden="true">{GLYPH[line]}</span>
                <span className="brd-line__txt">
                  <span className="brd-line__name">{t.brdLine[line]}</span>
                  {reach && n > 0 && <span className="brd-line__vol">{`~${ROUNDED(n).toLocaleString(lang)} ${t.brdLineCarries[line](reach)}`}</span>}
                </span>
                <span className="brd-line__chk" aria-hidden="true"><CheckMark /></span>
              </button>
            </li>
          )
        })}
      </ul>
      {none
        ? <p className="brd-arrive brd-arrive--none" role="alert">{t.brdLinesNone}</p>
        : reach
          ? arrival && <p className="brd-arrive"><Emphasized text={t.brdLinesArrive(value.length, reach, arrival)} /></p>
          : <p className="brd-arrive">{t.brdLinesHintNovice}</p>}
    </>
  )
}

// ── Nom — the name the card prints ───────────────────────────────
// A first name, any script, up to CARD_NAME_MAX characters, and nothing
// at all an answer: the plate the name step drew, its count, and the
// gate that prints it. Not the username, which stays the public handle
// (routes/profile.py card_name).
export function NameSheet({ open, onClose, value, onSave }) {
  const { t } = useLang()
  return (
    <CardSheet open={open} onClose={onClose} title={t.brdSheetName} sub={t.brdNameOptional} icon={PencilIcon} kind="name">
      <NamePlate value={value} onSave={onSave} />
    </CardSheet>
  )
}

function NamePlate({ value, onSave }) {
  const { t } = useLang()
  // The sheet's body mounts when it opens, so the draft starts on the
  // name as it stands each time.
  const [draft, setDraft] = useState(value)
  const length = cardNameLength(draft)
  const over = length > CARD_NAME_MAX
  const save = () => { if (!over) onSave(draft) }
  return (
    <>
      <label className="brd-plate brd-plate--sheet">
        <input
          className="brd-plate__field"
          value={draft}
          // In UTF-16 units, so a name of rare kanji still fits its 24
          // characters; the count below is the characters themselves.
          maxLength={CARD_NAME_MAX * 2}
          autoComplete="given-name"
          aria-label={t.brdNamePlaceholder}
          aria-invalid={over ? true : undefined}
          placeholder={t.brdNamePlaceholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !composing(e)) { playUi('click-screen-selection'); save() } }}
        />
        <span className="brd-plate__count" aria-hidden="true">{`${length} / ${CARD_NAME_MAX}`}</span>
        <span className="brd-plate__stripe" aria-hidden="true" />
      </label>
      {over
        ? <p className="brd__error" role="alert">{t.cardNameTooLong(CARD_NAME_MAX)}</p>
        : <p className="brd-sheet__note">{t.brdNameNote}</p>}
      <Continue label={t.brdNameSave} onClick={save} disabled={over} data-action="name-save" />
    </>
  )
}

// ── Compte — keeping the card (the account) ──────────────────────
// The guest pass (lib/guest.js) made an account on the row it already
// is, the same id and everything on it: Google put onto it (`link`), or
// an address and a password, typed twice (plan 270). With the project's
// "Confirm email" off the account is the learner's at once, with no
// mail to follow; were it on, the address waits on its link and the
// sheet says so (`onSent`). « Plus tard » rides on as a guest; the line
// under the card keeps saying where the card lives. On the web Google
// leaves the page, so `onLeaveForAuth` writes the answers down first; a
// refusal comes back on the URL (lib/authRedirect.js) and is said here.
// `onKept(by, email)`: 'google', or 'password' with the address.
// `sent`: the address waiting on its confirmation, if one is.
export function AccountSheet({ open, onClose, onLeaveForAuth = null, onKept, onSent, onGuest = null, sent = null }) {
  const { t } = useLang()
  return (
    <CardSheet open={open} onClose={onClose} title={t.brdSheetAccount} icon={UserIcon} kind="account">
      <KeepForm onClose={onClose} onLeaveForAuth={onLeaveForAuth} onKept={onKept} onSent={onSent} onGuest={onGuest} sent={sent} />
    </CardSheet>
  )
}

const ADDRESS = /.+@.+\..+/
// Supabase's own floor for a password (Auth › Providers › Email).
export const PASSWORD_MIN = 6

function KeepForm({ onClose, onLeaveForAuth, onKept, onSent, onGuest, sent }) {
  const { t, lang } = useLang()
  const [email, setEmail] = useState(sent ?? '')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // A plain read: a refusal on the URL is a fact about this page load.
  const refused = authRedirectError()
  const filled = ADDRESS.test(email.trim()) && password.length >= PASSWORD_MIN && again.length > 0

  async function create() {
    if (!filled || busy) return
    // Said before the round trip: a typo in a password nobody can see is
    // the one mistake the second field is there to catch.
    if (again !== password) { setError(t.brdPasswordMismatch); return }
    setBusy(true)
    setError(null)
    const address = email.trim()
    const r = await claimAccount({ email: address, password, lang })
    setBusy(false)
    // Through the table every auth refusal goes through (lib/authErrors.js),
    // never Supabase's own English.
    if (!r.ok) { setError(authErrorMessage(r, t)); return }
    if (r.needsConfirmation) { onSent(address); return }
    onKept('password', address)
  }

  const onEnter = e => { if (e.key === 'Enter' && !composing(e)) create() }

  return (
    <>
      <p className="brd-sheet__lede">{onGuest ? t.brdAccountAsk : t.brdAccountLede}</p>
      <ProviderButton link className="auth-provider brd-provider" onBeforeRedirect={onLeaveForAuth} onDone={() => onKept('google')} onError={setError} />
      {refused && !error && (
        <p className="auth-message auth-message--error" role="alert" data-oauth="refused">{authRedirectMessage(refused, t)}</p>
      )}
      {/* That Google account is already somebody's pass, so it cannot be
          added to this one -- but it can be ridden: offered as its own
          button, never taken on the learner's behalf. */}
      {isAlreadyLinked(refused) && <ProviderButton label={t.oauthSignInInstead} onDone={() => onKept('google')} onError={setError} />}
      <p className="auth-or">{t.orWithEmail}</p>
      <div className="brd-sheet__field">
        <input
          type="email"
          className="field field--page brd-fld"
          placeholder={t.email}
          aria-label={t.email}
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={onEnter}
        />
        <input
          type="password"
          className="field field--page brd-fld"
          // The floor in the field itself: a note under the fields would
          // push the sheet past a short window (the short lane).
          placeholder={t.brdPasswordNew(PASSWORD_MIN)}
          aria-label={t.brdPasswordNew(PASSWORD_MIN)}
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={onEnter}
          data-field="password"
        />
        <input
          type="password"
          className="field field--page brd-fld"
          placeholder={t.brdPasswordAgain}
          aria-label={t.brdPasswordAgain}
          autoComplete="new-password"
          value={again}
          onChange={e => setAgain(e.target.value)}
          onKeyDown={onEnter}
          data-field="password-again"
        />
        {sent && <p className="brd-sheet__note" data-note="sent">{t.brdAccountSentNote(sent)}</p>}
      </div>
      {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
      <div className="brd-sheet__ways">
        {onGuest
          ? <BoardLink onClick={onGuest} data-action="account-guest">{sent ? t.brdSheetDone : t.brdStayGuest}</BoardLink>
          : <BoardLink onClick={onClose} data-action="account-later">{t.brdLater}</BoardLink>}
        <Continue label={t.brdAccountCreate} onClick={create} disabled={!filled || busy} data-action="account-create" />
      </div>
    </>
  )
}
