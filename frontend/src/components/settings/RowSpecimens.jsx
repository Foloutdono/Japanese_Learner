import { SOUND_CATEGORIES } from '../../lib/audio'
import { scaleFor } from '../../domain/ratingScales'

// ── What a row is set to, drawn (plan 139) ──────────────────────
// Every row of Settings' list prints its state beside its word, and
// where the state is a thing that can be seen it is drawn small: the
// theme as a swatch of the screen's grounds, the sound as the mixer's
// levels, the rating bar as its dots. Each is decoration for a screen
// reader — the row's value says the same in words beside it.

/** The theme: paper, sumi, or the device's (both, on the diagonal). The
 *  grounds are the two inks that do not flip with the theme. */
export function ThemeSwatch({ theme }) {
  return <span className={`stg-swatch stg-swatch--${theme}`} aria-hidden="true" />
}

/** The mixer's eight channels as bars, the master's share of each drawn;
 *  flat and grey when the sound is cut. */
export function SoundMeter({ volumes, muted }) {
  const channels = ['master', ...SOUND_CATEGORIES]
  return (
    <span className={`stg-meter${muted ? ' stg-meter--muted' : ''}`} aria-hidden="true">
      {channels.map(k => {
        const v = muted ? 0 : (k === 'master' ? volumes.master : volumes.master * volumes[k])
        return <span key={k} className="stg-meter__bar" style={{ height: `${Math.max(12, Math.round((v ?? 0) * 100))}%` }} />
      })}
    </span>
  )
}

/** The rating bar: a dot a button in its own ink, worst first, the best
 *  in the gold the bar fills it with. */
export function RatingDots({ scale }) {
  const qualities = scaleFor(scale).qualities
  return (
    <span className="stg-dots" aria-hidden="true">
      {qualities.slice().reverse().map(q => (
        <span key={q} className={`stg-dots__dot rating-bar__btn--q${q}${q === qualities[0] ? ' stg-dots__dot--best' : ''}`} />
      ))}
    </span>
  )
}
