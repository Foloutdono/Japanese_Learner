import { useLang } from '../../LangContext'
import { Wave, CornerMark } from './icons'
import { StruckMark } from './StruckMark'

// ── 3C · the pass turns over (plan 172) ─────────────────────────────
// From Settings, where nothing hurt: the learner's Pro pass lifts,
// turns on its long axis -- its edge showing, the card being an object
// with a thickness -- and lands as Max, a burst of white light behind
// it and the light pooling under it on the floor; then it floats,
// tilting, so the metal catches the light twice. An 8s loop, at rest
// on the Max side.
//
// The two materials are the owner's picks of the canvas's rounds: Pro
// 墨, printed on soft-touch charcoal, and Max 梨地, satin platinum
// with its letters engraved and MAX in gold foil. Each carries the
// holder, the level under the name, the struck 辻 filled to the XP
// (StruckMark) and, at its foot, what practice costs on it.
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315]
// The plates of metal between the two faces: what shows as the edge.
const CORE = [-1.2, -0.4, 0.4, 1.2]

export function PassTurn({ name, level, xp }) {
  const { t } = useLang()
  return (
    <div className="ofr-turn" aria-hidden="true">
      <span className="ofr-turn__glow" />
      <span className="ofr-turn__halo" />
      <span className="ofr-turn__reflect" />
      {SPARKS.map(a => <i key={a} className="ofr-turn__spark" style={{ '--ofr-a': `${a}deg` }} />)}
      <div className="ofr-turn__hold">
        <div className="ofr-turn__flip">
          {CORE.map(z => <span key={z} className="ofr-turn__core" style={{ '--ofr-z': z }} />)}
          <Face plan="pro" name={name} level={level} xp={xp} fare={t.ofrCardFarePro} label={t.ofrCardPro} brand={t.ofrCardBrand} />
          <Face plan="max" name={name} level={level} xp={xp} fare={t.ofrCardFareMax} label={t.ofrCardMax} brand={t.ofrCardBrand} />
        </div>
      </div>
    </div>
  )
}

function Face({ plan, name, level, xp, fare, label, brand }) {
  const max = plan === 'max'
  return (
    <div className={`ofr-turn__face ofr-turn__face--${plan}`}>
      <span className="ofr-turn__grain" />
      <StruckMark xp={xp} etched={max} className="ofr-turn__seal" />
      <div className="ofr-turn__row">
        <span className="ofr-turn__brand"><Wave />{brand}</span>
        <CornerMark />
      </div>
      <span className="ofr-turn__who">
        <span className="ofr-turn__name">{name}</span>
        <span className="ofr-turn__lvl">{level}</span>
      </span>
      <div className="ofr-turn__row ofr-turn__row--foot">
        <span className="ofr-turn__meta">{fare}</span>
        <span className="ofr-turn__class">{label}</span>
      </div>
      {max && <span className="ofr-turn__sheen" />}
    </div>
  )
}
