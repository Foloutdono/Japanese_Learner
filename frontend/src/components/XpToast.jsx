import { useEffect, useState } from 'react'
import { playXpGain, playLevelUp } from './sound'

// ── XP toast ──────────────────────────────────────────────
// `toast` is `{ amount, id, leveledUp, newLevel, quality }` — `id`
// rather than keying off `amount` so two back-to-back reviews worth
// the same XP still re-trigger the animation, and `leveledUp`/
// `newLevel` (from srs.review()'s response — see KanjiScreen/
// VocabScreen/KanaScreen's postReview) switch it into the bigger
// celebration variant instead of the routine pop. `onDone` clears the
// parent's state once the toast has had its moment; internally the
// component tracks one extra bit itself — `phase`, 'active' | 'leaving'
// — purely to drive a real exit animation instead of vanishing
// mid-frame (see the phase notes on the state below).
//
// The visual language is kabuki (歌舞伎), not confetti: every reward
// is a miniature mie (見得) — the freeze-pose an actor snaps into at
// a scene's peak — counted in by an accelerating run of wooden
// clapper strikes (tsuke-uchi ツケ打ち, <TsukeBeats/> below), punctuated
// by a burst of kumadori (隈取り), the bold brush-stroke make-up
// lines that radiate from the eyes on a bravado role (<KumadoriBurst/>),
// and finished with a short calligraphic brush-stroke drawn in under
// the pill (.xp-toast__brush in index.css) — the literacy half of
// "art/literacy". A line of stage footlights (<StageFootlights/>)
// ignites along the very bottom of the screen with every reward, so
// the celebration reads as something the whole stage responds to
// rather than a badge popping up in one corner.
//
// The level-up variant is the one moment the app goes full stage
// production: a big tsuke count-in, the jōshiki-maku (定式幕) —
// kabuki's own striped curtain — ripped open by an unseen stagehand
// (kuroko) to reveal the banner already mid-pose, and a hanko (印)
// seal slamming into its corner with a spreading ink-bleed ring, like
// a certificate being made official. And unlike the routine toast, it
// no longer dismisses itself on a timer — it holds there, curtain
// open, seal struck, gold rays still slowly turning, until the
// reward is actually claimed. A small stamped "受" (receive) pill
// (.level-up-claim) fades in once the impact has resolved and stays
// interactive — genuinely unclickable before then, genuinely clickable
// after, via a discrete pointer-events flip inside its own CSS
// keyframe rather than a JS-managed disabled flag — and only that
// click starts the exit: the curtain swings shut (the actual meaning
// of "curtain call"), then the overlay fades. XpToast only ever calls
// onDone once the matching CSS animation genuinely finishes
// (handleToastAnimationEnd / handleOverlayAnimationEnd below) — never
// on a guessed duration — so nothing is ever removed from the DOM
// mid-animation.
const NORMAL_DURATION = 1650

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

// ── Footlight embers ───────────────────────────────────────
// Horizontal position, launch delay, sideways drift, size and
// lifetime for each spark along the footlight strip — hand-placed for
// the same reason every other set of numbers in this file is
// (KUMADORI_ANGLES above, the tsuke beat timings in index.css…): a
// mie is precise, not a particle system, so none of this is
// Math.random() — it's the same nine embers every time. The routine
// toast only lights a spread subset of them (EMBER_LAYOUT_LIGHT), so
// a level-up reads as the whole footlight strip catching, not just a
// bigger version of the same handful.
const EMBER_LAYOUT = [
  { x: 4, delay: 0, drift: -10, size: 4, dur: 2800 },
  { x: 15, delay: 260, drift: 6, size: 5, dur: 3200 },
  { x: 27, delay: 80, drift: -5, size: 4, dur: 2600 },
  { x: 38, delay: 420, drift: 9, size: 6, dur: 3400 },
  { x: 50, delay: 150, drift: -8, size: 4, dur: 2900 },
  { x: 61, delay: 340, drift: 5, size: 5, dur: 3100 },
  { x: 73, delay: 40, drift: -6, size: 4, dur: 2700 },
  { x: 85, delay: 480, drift: 8, size: 6, dur: 3500 },
  { x: 95, delay: 200, drift: -4, size: 4, dur: 3000 },
]
const EMBER_LAYOUT_LIGHT = [EMBER_LAYOUT[0], EMBER_LAYOUT[2], EMBER_LAYOUT[4], EMBER_LAYOUT[6], EMBER_LAYOUT[8]]

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

// ── Stage footlights ──────────────────────────────────────
// A kabuki stage is lit from its own floor as much as from above;
// this is that — a warm line igniting along the very bottom edge of
// the screen, with a handful of embers drifting up out of it, so a
// reward reads as something the whole stage responds to rather than
// a badge popping up in one corner. `big` widens it into the fuller
// footlight row (and the taller ember climb — see --ember-rise on
// .stage-footlights--big in index.css) for the level-up curtain call;
// `colorVar` tints it to match the same per-quality accent the
// kumadori burst and glow-pulse use, falling back to the gold trim
// (--accent2) everything else in this file already falls back to.
// Purely decorative throughout — aria-hidden, pointer-events: none.
function StageFootlights({ big, leaving, colorVar }) {
  const embers = big ? EMBER_LAYOUT : EMBER_LAYOUT_LIGHT
  return (
    <div
      className={`stage-footlights${big ? ' stage-footlights--big' : ''}${leaving ? ' stage-footlights--leaving' : ''}`}
      aria-hidden="true"
      style={colorVar ? { '--footlight-color': `var(${colorVar})` } : undefined}
    >
      <div className="stage-footlights__glow" />
      {embers.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={{
            '--ember-x': `${e.x}%`,
            '--ember-delay': `${e.delay}ms`,
            '--ember-drift': `${e.drift}px`,
            '--ember-size': `${e.size}px`,
            '--ember-dur': `${e.dur}ms`,
          }}
        />
      ))}
    </div>
  )
}

export function XpToast({ toast, onDone }) {
  // 'active' covers the whole entrance and hold — including, for a
  // level-up, the indefinite wait for the claim button, where there's
  // no timer running at all, just a person deciding when to click.
  // 'leaving' is the exit: for the routine toast that's the fall
  // defined by xp-toast-fall in index.css; for a level-up it's the
  // curtain swinging shut again, followed by the overlay's own fade.
  // Either way, onDone only fires once the matching animationend
  // actually arrives (see the two handlers below) — never on a JS
  // timer guessing how long the CSS will take.
  const [phase, setPhase] = useState('active')

  useEffect(() => {
    if (!toast) return
    setPhase('active')
    if (toast.leveledUp) playLevelUp()
    else playXpGain()

    // A level-up doesn't dismiss itself on a clock — it waits for
    // handleClaim instead.
    if (toast.leveledUp) return

    const timer = setTimeout(() => setPhase('leaving'), NORMAL_DURATION)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  if (!toast) return null

  const leaving = phase === 'leaving'
  const handleClaim = () => setPhase('leaving')

  // animationend bubbles up from every child (tsuke beats, kumadori
  // streaks, the glyph flick, the footlight embers…), so both
  // handlers below key off the specific animation name rather than
  // firing on whichever bubble reaches them first.
  const handleToastAnimationEnd = (e) => {
    if (e.animationName === 'xp-toast-fall') onDone?.()
  }
  const handleOverlayAnimationEnd = (e) => {
    if (e.animationName === 'level-up-overlay-fade-out') onDone?.()
  }

  if (toast.leveledUp) {
    return (
      // `key` forces a fresh DOM node per toast so the CSS animations
      // (which only ever play on mount) actually re-trigger for a
      // second level-up in the same session.
      <div
        key={toast.id}
        className={`level-up-overlay${leaving ? ' level-up-overlay--leaving' : ''}`}
        aria-live="polite"
        onAnimationEnd={handleOverlayAnimationEnd}
      >
        <StageFootlights big leaving={leaving} />
        <div className={`kabuki-curtain kabuki-curtain--left${leaving ? ' kabuki-curtain--leaving' : ''}`} aria-hidden="true" />
        <div className={`kabuki-curtain kabuki-curtain--right${leaving ? ' kabuki-curtain--leaving' : ''}`} aria-hidden="true" />
        <TsukeBeats big />
        <div className="level-up-banner">
          <KumadoriBurst count={3} colorVar="--accent2" big />
          <div className="hanko-stamp" aria-hidden="true">印</div>
          <div className="level-up-banner__glyph" aria-hidden="true">昇</div>
          <div className="level-up-banner__label">Niveau supérieur</div>
          <div className="level-up-banner__level">Niveau {toast.newLevel}</div>
          <div className="level-up-banner__xp">+{toast.amount} XP</div>
          <div className={`level-up-claim-wrap${leaving ? ' level-up-claim-wrap--leaving' : ''}`}>
            <button
              type="button"
              className="level-up-claim"
              onClick={handleClaim}
              disabled={leaving}
            >
              <span className="level-up-claim__glyph" aria-hidden="true">受</span>
              Réclamer
            </button>
          </div>
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
    <>
      {/* Own key, distinct from the pill's below: this is a sibling,
          not a wrapper, and both need to remount independently for a
          second toast fired back-to-back to replay its animations. */}
      <StageFootlights key={`footlights-${toast.id}`} leaving={leaving} colorVar={kumadoriColorVar} />
      <div
        key={toast.id}
        className={`xp-toast${boosted ? ' xp-toast--boosted' : ''}${leaving ? ' xp-toast--leaving' : ''}`}
        aria-live="polite"
        style={kumadoriColorVar ? { '--kumadori-color': `var(${kumadoriColorVar})` } : undefined}
        onAnimationEnd={handleToastAnimationEnd}
      >
        <TsukeBeats />
        {kumadoriCount > 0 && <KumadoriBurst count={kumadoriCount} colorVar={kumadoriColorVar} />}
        <span className="xp-toast__glyph" aria-hidden="true">気</span>
        +{toast.amount} XP
        <span className="xp-toast__brush" aria-hidden="true" />
        <span className="xp-toast__glint xp-toast__glint--1" aria-hidden="true" />
        <span className="xp-toast__glint xp-toast__glint--2" aria-hidden="true" />
      </div>
    </>
  )
}