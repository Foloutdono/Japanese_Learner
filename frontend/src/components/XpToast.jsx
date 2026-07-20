import { useEffect } from 'react'
import { playXpGain, playLevelUp } from './sound'

// ── XP toast ──────────────────────────────────────────────
// `toast` is `{ amount, id, leveledUp, newLevel, quality }` — `id`
// rather than keying off `amount` so two back-to-back reviews worth
// the same XP still re-trigger the animation, and `leveledUp`/
// `newLevel` (from srs.review()'s response — see KanjiScreen/
// VocabScreen/KanaScreen's postReview) switch it into the bigger
// celebration variant instead of the routine pop. `onDone` clears the
// parent's state once the toast has had its moment; the component
// itself doesn't track its own visibility.
//
// The visual language is kabuki (歌舞伎), not confetti: every reward
// is a miniature mie (見得) — the freeze-pose an actor snaps into at
// a scene's peak — counted in by an accelerating run of wooden
// clapper strikes (tsuke-uchi ツケ打ち, <TsukeBeats/> below) and
// punctuated by a burst of kumadori (隈取り), the bold brush-stroke
// make-up lines that radiate from the eyes on a bravado role
// (<KumadoriBurst/>). The level-up variant adds the jōshiki-maku
// (定式幕) — kabuki's own striped curtain — yanked open to reveal the
// hanko-stamp banner already mid-pose. All of the choreography lives
// in index.css; it's deliberately fixed/timed rather than
// randomised — a mie is precise, not chaotic.
const NORMAL_DURATION = 1650
const LEVEL_UP_DURATION = 2800

// Same per-quality accent the rating bar itself uses (see
// .rating-bar__btn--q* in index.css) — q3 "hésitant" and up get a
// kumadori burst in the matching colour; q0-q2 (failed) ratings get
// none, just the plain snap.
const KUMADORI_COLOR_VAR = { 3: '--accent2', 4: '--accent6', 5: '--success' }

// Fixed fan angles per streak count. Hand-placed rather than
// randomised: a mie is deliberate, so one line lands slightly
// off-centre, two split evenly either side of straight up, and three
// add a dead-centre line for the best rating.
const KUMADORI_ANGLES = {
  1: [-8],
  2: [-24, 16],
  3: [-32, 0, 28],
}

// The count-in: three fixed impact marks flashing in on shrinking
// gaps — the accelerating wooden-clapper beats a kabuki stagehand
// strikes into a board before an actor's mie. Purely CSS-timed (see
// .tsuke-beat/-1/-2/-3 in index.css); `big` swaps in the enlarged
// level-up sizing.
function TsukeBeats({ big }) {
  return (
    <span className={`tsuke-beats${big ? ' tsuke-beats--big' : ''}`} aria-hidden="true">
      <span className="tsuke-beat tsuke-beat--1" />
      <span className="tsuke-beat tsuke-beat--2" />
      <span className="tsuke-beat tsuke-beat--3" />
    </span>
  )
}

// The payoff: a fan of tapered, brush-stroke streaks (kumadori)
// whipping outward from centre at fixed angles, timed to land with
// the snap. `count` selects the angle set above — no matching count
// (a q0-q2 rating) renders nothing at all.
function KumadoriBurst({ count, colorVar, big }) {
  const angles = KUMADORI_ANGLES[count]
  if (!angles) return null
  return (
    <span
      className={`kumadori-burst${big ? ' kumadori-burst--big' : ''}`}
      aria-hidden="true"
      style={{ color: `var(${colorVar})` }}
    >
      {angles.map((deg, i) => (
        <span key={i} className="kumadori-streak" style={{ '--streak-angle': `${deg}deg` }} />
      ))}
    </span>
  )
}

export function XpToast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    if (toast.leveledUp) playLevelUp()
    else playXpGain()

    const timer = setTimeout(() => onDone?.(), toast.leveledUp ? LEVEL_UP_DURATION : NORMAL_DURATION)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  if (!toast) return null

  if (toast.leveledUp) {
    return (
      // `key` forces a fresh DOM node per toast so the CSS animations
      // (which only ever play on mount) actually re-trigger for a
      // second level-up in the same session.
      <div key={toast.id} className="level-up-overlay" aria-live="polite">
        <div className="kabuki-curtain kabuki-curtain--left" aria-hidden="true" />
        <div className="kabuki-curtain kabuki-curtain--right" aria-hidden="true" />
        <TsukeBeats big />
        <div className="level-up-banner">
          <KumadoriBurst count={3} colorVar="--accent2" big />
          <div className="level-up-banner__glyph" aria-hidden="true">昇</div>
          <div className="level-up-banner__label">Niveau supérieur</div>
          <div className="level-up-banner__level">Niveau {toast.newLevel}</div>
          <div className="level-up-banner__xp">+{toast.amount} XP</div>
        </div>
      </div>
    )
  }

  // One kumadori streak per quality point above q2 (1/2/3 for
  // q3/q4/q5), plus the stronger glow-pulse on the pill itself from
  // q4 up — the better the rating, the harder the toast celebrates.
  const kumadoriColorVar = KUMADORI_COLOR_VAR[toast.quality]
  const kumadoriCount = kumadoriColorVar ? toast.quality - 2 : 0
  const boosted = toast.quality >= 4

  return (
    <div
      key={toast.id}
      className={`xp-toast${boosted ? ' xp-toast--boosted' : ''}`}
      aria-live="polite"
      style={kumadoriColorVar ? { '--kumadori-color': `var(${kumadoriColorVar})` } : undefined}
    >
      <TsukeBeats />
      {kumadoriCount > 0 && <KumadoriBurst count={kumadoriCount} colorVar={kumadoriColorVar} />}
      <span className="xp-toast__glyph" aria-hidden="true">気</span>
      +{toast.amount} XP
    </div>
  )
}