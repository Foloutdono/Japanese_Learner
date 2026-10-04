import { useLang } from '../../LangContext'
import { Wave } from './icons'
import { StruckMark } from './StruckMark'

// The learner's pass at a hand's size (plan 172): the one the
// discover offer taps on the lock (Pro), and the one the Max offers
// tap on a counter. The two materials the step up is drawn in --
// Pro printed on soft-touch charcoal, Max engraved in satin platinum
// (PassTurn draws them full size) -- with the holder's name, the
// level under it and the struck 辻 filled to the XP.
export function MiniPass({ plan, name, level, xp, className = '' }) {
  const { t } = useLang()
  const max = plan === 'max'
  return (
    <div className={`ofr-pass ofr-pass--${plan} ${className}`.trim()} aria-hidden="true">
      <StruckMark xp={xp} etched={max} />
      <div className="ofr-pass__top">
        <span className="ofr-pass__kind">{max ? t.ofrCardMax : t.ofrCardPro}</span>
        <Wave />
      </div>
      <span className="ofr-pass__who">
        <span className="ofr-pass__name">{name}</span>
        <span className="ofr-pass__lvl">{level}</span>
      </span>
    </div>
  )
}
