import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import { Loading } from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { SectionHeader } from '../components/ui/SectionHeader'
import { Daruma, RiseToken } from '../components/rewards/Daruma'
import { DarumaRitual } from '../components/rewards/DarumaRitual'
import { XpToast } from '../components/rewards/XpToast'
import { applyXpGain } from '../stores/profileSummary'
import { playClick, startAmbiance, stopAmbiance } from '../lib/audio'
import { FlameIcon, ChevronIcon, WarningIcon, CheckIcon, CrossIcon } from '../components/ui/Icons'

// ── 達磨堂 — the Daruma Hall ───────────────────────────────
// Every goal in the app is a daruma, and every daruma is the same
// object doing three jobs at once: the progress bar (pigment level),
// the reward (a finished doll on the shelf), and the commitment
// (which eyes are painted). That collapse is the whole design — there
// is no separate track, badge, or checkbox anywhere on this screen,
// because the doll already says all three things.
//
// Three tiers, in descending rotation speed and ascending stakes:
//   今日 daily — three, redrawn nightly, auto-vowed on first progress
//   今週 weekly — two, redrawn Monday, they pay the 起 tokens
//   大願 vows — never rotate, three slots, you paint the first eye
//               yourself and abandoning one refunds nothing
//
// The backend sends no display copy at all (see routes/daruma.py) —
// only ids — so everything readable here comes out of the locale
// files via `t.darumaGoalTitle[id]`.

// The client's UTC offset in minutes east, which the backend uses for
// exactly one thing: whether a review counts as dawn or as night from
// where the reviewer is sitting. See srs.get_daruma_facts.
const TZ = -new Date().getTimezoneOffset()

const goalTitle = (t, id) => t.darumaGoalTitle?.[id] ?? id
const goalDesc  = (t, id) => t.darumaGoalDesc?.[id] ?? ''

export default function DarumaScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [hall, setHall]       = useState(null)
  const [error, setError]     = useState(false)
  const [busy, setBusy]       = useState(null)
  const [ritual, setRitual]   = useState(null)
  const [toast, setToast]     = useState(null)
  const [browsing, setBrowsing] = useState(false)

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
  }, [])

  const load = useCallback(() => {
    apiFetch(`/api/daruma?tz_offset=${TZ}`, session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => { setHall(data); setError(false) })
      .catch(() => setError(true))
  }, [session])

  useEffect(() => { load() }, [load])

  // Every mutating call returns the whole hall, so there's one write
  // path and no partial-state reconciliation: post, replace, done.
  const post = useCallback((path, body, onData) => {
    setBusy(body?.goal_id ?? path)
    return apiFetch(`/api/daruma/${path}?tz_offset=${TZ}`, session, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => { setHall(data); onData?.(data) })
      .catch(() => setError(true))
      .finally(() => setBusy(null))
  }, [session])

  const claim = (goal) => {
    playClick()
    post('claim', { goal_id: goal.id }, data => {
      const reward = data.reward
      if (!reward) return
      // Keep the level ring/bar in the header in step immediately;
      // the backend already banked the XP, so its own leveledUp is
      // the authority and this call's return value is discarded.
      applyXpGain({ amount: reward.xpEarned })
      setRitual({ id: `${goal.id}-${Date.now()}`, ...reward })
    })
  }

  // The 満願 ceremony owns the moment; if the reward also crossed a
  // level threshold, the kabuki curtain call queues up behind it
  // rather than fighting it for the same screen.
  const closeRitual = () => {
    if (ritual?.leveledUp) {
      setToast({ id: Date.now(), amount: ritual.xpEarned, leveledUp: true, newLevel: ritual.newLevel })
    }
    setRitual(null)
  }

  if (!hall && !error) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.darumaTitle} autoHide />
        <Loading />
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.darumaTitle} autoHide />

      <div className="container daruma-container">
        <StationHeader />
        {error && (
          <div className="profile-stale-notice" role="status">
            <WarningIcon size={16} className="profile-stale-notice__glyph" />
            {t.darumaOffline}
          </div>
        )}

        {hall && (
          <>
            <HallHeader hall={hall} t={t} busy={busy} onRise={() => { playClick(); post('rise') }} />

            <SectionHeader jp="今日" title={t.darumaToday} />
            <DarumaRow dolls={hall.daily} t={t} busy={busy} onClaim={claim} emptyLabel={t.darumaNoneToday} />

            <SectionHeader jp="今週" title={t.darumaThisWeek} />
            <DarumaRow dolls={hall.weekly} t={t} busy={busy} onClaim={claim} emptyLabel={t.darumaNoneToday} />

            <SectionHeader jp="大願" title={t.darumaVows} count={`${hall.vowsTaken}/${hall.vowSlots}`} />
            <Vows
              hall={hall}
              t={t}
              busy={busy}
              browsing={browsing}
              onBrowse={() => { playClick(); setBrowsing(b => !b) }}
              onClaim={claim}
              onTake={id => { playClick(); post('vow', { goal_id: id }) }}
              onRelease={id => { playClick(); post('release', { goal_id: id }) }}
            />

            <SectionHeader jp="棚" title={t.darumaShelf} />
            <Shelf shelf={hall.shelf} t={t} />
          </>
        )}
      </div>

      {/* Keyed so a second 満願 in the same session remounts and
          replays its animations instead of reusing a settled one. */}
      <DarumaRitual key={ritual?.id} ritual={ritual} onDone={closeRitual} />
      <XpToast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}

// ── Hall header ───────────────────────────────────────────
// The motto is the feature's thesis statement, so it gets the space:
// 七転び八起き, "fall seven times, rise eight" — which is literally
// what the 起 token below it buys. Three pillars underneath (streak,
// tokens, shelf count) in the same hairline-divided row Stats uses,
// and the mend button appears only on the days it would do something.
function HallHeader({ hall, t, busy, onRise }) {
  const canRise = hall.mendableDay && hall.tokens > 0

  return (
    <div className="daruma-hall">
      <div className="daruma-hall__motto">
        <span className="daruma-hall__motto-jp" lang="ja">七転び八起き</span>
        <span className="daruma-hall__motto-en">{t.darumaMotto}</span>
      </div>

      {/* Each pillar leads with a real mark at the same weight as its
          number. The previous version hung 17px icons off a 1.35rem
          figure, which made both the flame and the token read as
          specks rather than as things. */}
      <div className="daruma-hall__pillars">
        <div className="daruma-hall__pillar">
          <span className="daruma-hall__pillar-value">
            <span className="daruma-hall__pillar-mark"><FlameIcon size={28} /></span>
            {hall.streak}
          </span>
          <span className="daruma-hall__pillar-label">{t.streak}</span>
        </div>
        <div className="daruma-hall__pillar">
          <span className="daruma-hall__pillar-value">
            <span className="daruma-hall__pillar-mark"><RiseToken size={28} /></span>
            {hall.tokens}
          </span>
          <span className="daruma-hall__pillar-label">{t.darumaTokens}</span>
        </div>
        <div className="daruma-hall__pillar">
          <span className="daruma-hall__pillar-value">
            <span className="daruma-hall__pillar-mark">
              <Daruma color="aka" eyes={2} progress={1} size={26} />
            </span>
            {hall.shelf.length}
          </span>
          <span className="daruma-hall__pillar-label">{t.darumaOnShelf}</span>
        </div>
      </div>

      {hall.mendableDay && (
        <div className="daruma-hall__mend">
          <span className="daruma-hall__mend-text">
            {t.darumaMendPrompt(hall.mendableDay)}
          </span>
          <button
            type="button"
            className="daruma-hall__mend-btn"
            onClick={onRise}
            disabled={!canRise || busy === 'rise'}
            title={canRise ? undefined : t.darumaNoTokens}
          >
            <span className="daruma-hall__mend-glyph" lang="ja" aria-hidden="true">起</span>
            {canRise ? t.darumaMendBtn : t.darumaNoTokens}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Rows of dolls ─────────────────────────────────────────
function DarumaRow({ dolls, t, busy, onClaim, emptyLabel }) {
  if (!dolls?.length) return <EmptyState message={emptyLabel} />
  return (
    <div className="daruma-row">
      {dolls.map(d => <DarumaCard key={d.id} doll={d} t={t} busy={busy} onClaim={onClaim} />)}
    </div>
  )
}

// One doll and its wish. The card itself is the claim button whenever
// there's something to claim, and inert markup otherwise — rather
// than a permanently-clickable card with a disabled button inside it,
// which invites the click that does nothing.
function DarumaCard({ doll, t, busy, onClaim, children }) {
  const claimable = doll.complete && !doll.claimed
  const pct = Math.round((doll.current / doll.target) * 100)
  const Tag = claimable ? 'button' : 'div'

  return (
    <Tag
      {...(claimable ? { type: 'button', onClick: () => onClaim(doll), disabled: busy === doll.id } : {})}
      className={[
        'daruma-card',
        `daruma-card--${doll.rarity}`,
        claimable ? ' daruma-card--ready' : '',
        doll.claimed ? ' daruma-card--claimed' : '',
      ].join(' ')}
    >
      <div className="daruma-card__doll">
        <Daruma
          color={doll.color}
          rarity={doll.rarity}
          glyph={doll.glyph}
          eyes={doll.claimed ? 2 : (doll.vowed ? 1 : 0)}
          progress={doll.current / doll.target}
          dim={!doll.vowed && !doll.claimed}
          size={92}
        />
      </div>

      <div className="daruma-card__body">
        <span className="daruma-card__title">{goalTitle(t, doll.id)}</span>
        <span className="daruma-card__desc">{goalDesc(t, doll.id)}</span>

        <span className="daruma-card__meter">
          <span className="daruma-card__count">{doll.current} / {doll.target}</span>
          <span className="daruma-card__pct">{pct}%</span>
        </span>

        <span className="daruma-card__rewards">
          <span className="daruma-card__reward">+{doll.rewardXp} XP</span>
          {doll.rewardTokens > 0 && (
            <span className="daruma-card__reward daruma-card__reward--token">
              <RiseToken size={13} /> +{doll.rewardTokens}
            </span>
          )}
        </span>

        {children}
      </div>

      {claimable && (
        <span className="daruma-card__ribbon">
          <span className="daruma-card__ribbon-glyph" lang="ja" aria-hidden="true">願</span>
          {t.darumaClaim}
        </span>
      )}
      {doll.claimed && (
        <span className="daruma-card__done" title={t.darumaClaimed}>
          <CheckIcon size={13} />
        </span>
      )}
    </Tag>
  )
}

// ── 大願 ──────────────────────────────────────────────────
// Slots first, catalogue behind a toggle. Showing every vow you can't
// currently hold, all the time, turns a loadout into a backlog — but
// hiding them entirely removes the roadmap, so the catalogue is one
// click away and marks what's already yours.
function Vows({ hall, t, busy, browsing, onBrowse, onClaim, onTake, onRelease }) {
  const taken = hall.vows.filter(v => v.vowed && !v.claimed)
  const free  = hall.vowSlots - taken.length
  const available = hall.vows.filter(v => !v.vowed && !v.claimed)
  const fulfilled = useMemo(() => new Set(hall.vows.filter(v => v.claimed).map(v => v.id)), [hall.vows])

  return (
    <div className="daruma-vows">
      <div className="daruma-row">
        {taken.map(v => (
          <DarumaCard key={v.id} doll={v} t={t} busy={busy} onClaim={onClaim}>
            <button
              type="button"
              className="daruma-card__release"
              onClick={e => { e.stopPropagation(); onRelease(v.id) }}
              disabled={busy === v.id}
            >
              <CrossIcon size={11} /> {t.darumaRelease}
            </button>
          </DarumaCard>
        ))}
        {Array.from({ length: Math.max(0, free) }, (_, i) => (
          <button key={`slot-${i}`} type="button" className="daruma-slot" onClick={onBrowse}>
            <span className="daruma-slot__ring" aria-hidden="true">
              <span className="daruma-slot__glyph" lang="ja">願</span>
            </span>
            <span className="daruma-slot__label">{t.darumaEmptySlot}</span>
          </button>
        ))}
      </div>

      <button type="button" className="daruma-catalogue-toggle" onClick={onBrowse}>
        <ChevronIcon direction={browsing ? 'up' : 'down'} size={14} />
        {browsing ? t.darumaHideCatalogue : t.darumaShowCatalogue}
      </button>

      {browsing && (
        <div className="daruma-catalogue">
          {available.map(v => (
            <div key={v.id} className={`daruma-cat-row daruma-cat-row--${v.rarity}`}>
              <Daruma color={v.color} glyph={v.glyph} rarity={v.rarity} eyes={0} progress={0} dim size={44} />
              <div className="daruma-cat-row__text">
                <span className="daruma-cat-row__title">{goalTitle(t, v.id)}</span>
                <span className="daruma-cat-row__desc">{goalDesc(t, v.id)}</span>
              </div>
              <span className="daruma-cat-row__reward">
                +{v.rewardXp} XP
                {v.rewardTokens > 0 && <> · <RiseToken size={12} /> +{v.rewardTokens}</>}
              </span>
              <button
                type="button"
                className="daruma-cat-row__take"
                onClick={() => onTake(v.id)}
                disabled={free <= 0 || busy === v.id}
                title={free <= 0 ? t.darumaNoSlots : undefined}
              >
                {t.darumaTakeVow}
              </button>
            </div>
          ))}
          {fulfilled.size > 0 && (
            <div className="daruma-cat-done">
              {t.darumaVowsFulfilled(fulfilled.size)}
            </div>
          )}
          {available.length === 0 && <div className="daruma-cat-done">{t.darumaAllVowsTaken}</div>}
        </div>
      )}
    </div>
  )
}

// ── 達磨棚 — the shelf ────────────────────────────────────
// Every doll ever finished, newest first, on a literal shelf: a row
// of dolls sitting on a hairline plank, wrapping as many rows as it
// takes. A tally by colour sits above it, because the colours aren't
// decoration — a shelf that's mostly 青 (study) versus mostly 金
// (fortune) is a real statement about how you've been learning.
const SHELF_ORDER = ['aka', 'kin', 'shiro', 'ao', 'murasaki', 'midori', 'kuro', 'momo']

function Shelf({ shelf, t }) {
  const tally = useMemo(() => {
    const counts = {}
    shelf.forEach(d => { counts[d.color] = (counts[d.color] ?? 0) + 1 })
    return SHELF_ORDER.filter(c => counts[c]).map(c => [c, counts[c]])
  }, [shelf])

  if (!shelf.length) {
    return (
      <EmptyState
        icon={<Daruma color="aka" eyes={0} progress={0} size={56} dim />}
        message={t.darumaShelfEmpty}
      />
    )
  }

  return (
    <div className="daruma-shelf">
      <div className="daruma-shelf__tally">
        {tally.map(([color, n]) => (
          <span key={color} className="daruma-shelf__tally-item" title={t.darumaColor?.[color]}>
            <Daruma color={color} eyes={2} progress={1} size={20} />
            <span className="daruma-shelf__tally-count">{n}</span>
          </span>
        ))}
      </div>

      <div className="daruma-shelf__plank">
        {shelf.map((d, i) => (
          <span
            key={`${d.id}-${d.period}-${i}`}
            className={`daruma-shelf__doll daruma-shelf__doll--${d.rarity}`}
            title={`${goalTitle(t, d.id)} · ${new Date(d.claimedAt).toLocaleDateString()}`}
          >
            <Daruma color={d.color} rarity={d.rarity} glyph={d.glyph} eyes={2} progress={1} size={52} />
          </span>
        ))}
      </div>
    </div>
  )
}
