// ── Moe (萌/燃) — the streak mascot ─────────────────────────
// Every serious Japanese brand, region, and school has a yuru-chara
// (ゆるキャラ, "loose/relaxed character") — round, limbless-or-nearly,
// big-eyed, printed on everything from train tickets to rice bags.
// This is ours: a small flame, because a language-learning streak
// *is* a flame you have to keep feeding, one day at a time.
//
// The name is a pun, not a coincidence: 燃える (moeru) means "to
// burn" — this is a burning little thing — and 萌える (also moeru,
// same reading, different kanji) is where the otaku slang "moe"
// (irresistibly cute) comes from. One syllable, two meanings, both
// true of the character on screen.
//
// The silhouette borrows its weight, not its face, from daruma
// dolls (だるま) — the round, bottom-heavy tumbler toys that always
// right themselves when knocked over, sold at New Year as a promise
// to see a goal through. "七転び八起き" — fall seven times, stand up
// eight — is the exact shape of what a broken streak asks of you the
// next morning. Moe keeps that weighted, always-gets-back-up base and
// swaps daruma's traditional flat crown for an actual flame.
//
// `mood` reflects streak health, the same read a real flame gives you
// at a glance:
//   'blazing'    — streak alive and recent, tall bright flame, fists up
//   'milestone'  — a streak threshold just hit, tallest flame + sparks
//   'flickering' — streak at risk (due reviews piling up, day not
//                   logged yet), shorter flame leaning off-centre, worried
//   'ember'      — streak broken, flame reduced to a dim coal + smoke
//
// All colour comes from index.css custom properties (see the
// .mascot rules), so it follows the app's light/dark theme
// automatically — nothing here is a hardcoded hex.
const MOOD_CONFIG = {
  blazing:    { tipX: 100, tipY: 20,  armsUp: true,  eyes: 'open',    mouth: 'smile', extras: ['embers'] },
  milestone:  { tipX: 100, tipY: 6,   armsUp: true,  eyes: 'star',    mouth: 'smile', extras: ['embers', 'sparks'] },
  flickering: { tipX: 114, tipY: 58,  armsUp: false, eyes: 'worried', mouth: 'flat',  extras: ['sweat'] },
  ember:      { tipX: 100, tipY: 102, armsUp: false, eyes: 'closed',  mouth: 'frown', extras: ['smoke'] },
}

// Flame-tip silhouette: the standard two-quadratic-curve "petal"
// recipe (base-left → tip, tip → base-right, then the implicit close
// straight back along the base) rather than one hand-fit freeform
// path — simple enough to stay correct at every mood's tip height
// instead of risking a lopsided curve at the extremes.
function FlameCrest({ tipX, tipY }) {
  const baseY = 130
  const d = `M70,${baseY} Q${tipX - 25},${(tipY + baseY) / 2} ${tipX},${tipY} `
          + `Q${tipX + 25},${(tipY + baseY) / 2} 130,${baseY} Z`
  return <path className="mascot__flame" d={d} />
}

function Eyes({ variant }) {
  if (variant === 'closed') {
    return (
      <g className="mascot__eyes">
        <path className="mascot__eye-closed" d="M68,150 Q76,156 84,150" />
        <path className="mascot__eye-closed" d="M116,150 Q124,156 132,150" />
      </g>
    )
  }

  const pupil = variant === 'star'
    ? <StarPupil />
    : <circle className="mascot__eye-pupil" r="6.5" />

  return (
    <g className="mascot__eyes">
      <g transform="translate(76,150)">
        <circle className="mascot__eye-white" r="12" />
        {pupil}
        <circle className="mascot__eye-shine" cx="-2.5" cy="-2.5" r="2" />
      </g>
      <g transform="translate(124,150)">
        <circle className="mascot__eye-white" r="12" />
        {pupil}
        <circle className="mascot__eye-shine" cx="-2.5" cy="-2.5" r="2" />
      </g>
      {variant === 'worried' && (
        <>
          <path className="mascot__eyebrow" d="M64,132 Q76,126 87,133" />
          <path className="mascot__eyebrow" d="M113,133 Q124,126 136,132" />
        </>
      )}
    </g>
  )
}

// Four-point sparkle, same silhouette as .xp-toast__glint's kirakira
// twinkle — reused here as the "excited" pupil for the milestone mood
// rather than a plain round one, so the two celebration moments in
// the app (a streak milestone here, a level-up in XpToast) read as
// the same family of "something good just happened" glint.
function StarPupil() {
  return (
    <path
      className="mascot__eye-star"
      transform="scale(0.55)"
      d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z"
    />
  )
}

function Mouth({ variant }) {
  if (variant === 'smile') return <path className="mascot__mouth" d="M88,178 Q100,188 112,178" />
  if (variant === 'frown') return <path className="mascot__mouth" d="M88,184 Q100,176 112,184" />
  return <path className="mascot__mouth" d="M90,180 L110,180" />
}

// Belly patch: the 気 (ki — spirit, vital energy) glyph, the same
// character XpToast's routine-reward pill wears. That toast is one
// small hit of 気; Moe is what accumulating it every day looks like.
function BellyPatch() {
  return (
    <g className="mascot__patch">
      <rect x="81" y="189" width="38" height="38" rx="9" />
      <text x="100" y="215" textAnchor="middle" className="mascot__patch-glyph">気</text>
    </g>
  )
}

function Arms({ up }) {
  if (up) {
    return (
      <g className="mascot__arms">
        <ellipse className="mascot__arm" cx="34" cy="140" rx="13" ry="9" transform="rotate(-35 34 140)" />
        <ellipse className="mascot__arm" cx="166" cy="140" rx="13" ry="9" transform="rotate(35 166 140)" />
      </g>
    )
  }
  return (
    <g className="mascot__arms">
      <ellipse className="mascot__arm" cx="30" cy="178" rx="13" ry="9" transform="rotate(-8 30 178)" />
      <ellipse className="mascot__arm" cx="170" cy="178" rx="13" ry="9" transform="rotate(8 170 178)" />
    </g>
  )
}

// Fixed, hand-placed positions — the same "a mie is precise, never
// scattered" logic used throughout this app's other decorative marks
// (KUMADORI_ANGLES, EMBER_LAYOUT in XpToast.jsx) — not Math.random().
const EMBER_DOTS = [
  { x: 62, y: 236, r: 3.5 },
  { x: 100, y: 240, r: 3 },
  { x: 138, y: 236, r: 3.5 },
]
const SPARK_MARKS = [
  { x: 40, y: 60, size: 8, rotate: 12 },
  { x: 162, y: 78, size: 7, rotate: -18 },
  { x: 150, y: 34, size: 6, rotate: 30 },
]

function MoodExtras({ extras }) {
  return (
    <>
      {extras.includes('embers') && (
        <g className="mascot__embers">
          {EMBER_DOTS.map((e, i) => <circle key={i} className="mascot__ember" cx={e.x} cy={e.y} r={e.r} />)}
        </g>
      )}
      {extras.includes('sparks') && (
        <g className="mascot__sparks">
          {SPARK_MARKS.map((s, i) => (
            <path
              key={i}
              className="mascot__spark"
              transform={`translate(${s.x},${s.y}) rotate(${s.rotate}) scale(${s.size / 12})`}
              d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z"
            />
          ))}
        </g>
      )}
      {extras.includes('sweat') && (
        <path className="mascot__sweat" d="M144,118 Q149,128 144,134 Q139,128 144,118 Z" />
      )}
      {extras.includes('smoke') && (
        <path className="mascot__smoke" d="M100,96 Q92,84 100,74 Q108,64 100,52" />
      )}
    </>
  )
}

export function Mascot({ mood = 'blazing', size = 120, streak, className }) {
  const cfg = MOOD_CONFIG[mood] ?? MOOD_CONFIG.blazing

  return (
    <span className={`mascot-wrap${className ? ` ${className}` : ''}`} style={{ '--mascot-size': `${size}px` }}>
      <svg
        className={`mascot mascot--${mood}`}
        viewBox="0 0 200 240"
        width={size}
        height={size * 1.2}
        role="img"
        aria-label={`Mascotte flamme — humeur : ${mood}`}
      >
        <FlameCrest tipX={cfg.tipX} tipY={cfg.tipY} />
        <ellipse className="mascot__body" cx="100" cy="170" rx="68" ry="62" />
        <Arms up={cfg.armsUp} />
        <Eyes variant={cfg.eyes} />
        <circle className="mascot__cheek" cx="58" cy="172" r="11" />
        <circle className="mascot__cheek" cx="142" cy="172" r="11" />
        <Mouth variant={cfg.mouth} />
        <BellyPatch />
        <MoodExtras extras={cfg.extras} />
      </svg>
      {typeof streak === 'number' && (
        <span className="mascot__badge" aria-hidden="true">
          <span aria-hidden="true">🔥</span>{streak}
        </span>
      )}
    </span>
  )
}