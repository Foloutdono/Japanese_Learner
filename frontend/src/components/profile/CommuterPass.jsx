import { levelTitle } from '../../domain/levelTitle'
import { DEFAULT_LOADOUT } from '../../stores/cosmetics'
import { GearIcon } from '../ui/Icons'

// ── 定期券 — the commuter pass ─────────────────────────────
// Nobody walks onto a Japanese platform without a pass, and the home
// concourse has drawn yours as an IC card since the board was built.
// This is the same object at full size: the contactless mark, the
// holder, the rank printed on it, and the level as a balance.
//
// It replaces a generic avatar-and-progress-bar card — the one piece
// of furniture on the profile that could have come from any app — with
// the thing the rest of this app has been implying you carry.
//
// The two ranks under the name mean different things and both are
// kept: the level title tracks how much you have shown up (everybody
// has one), while 段位 tracks how much Japanese you actually hold. A
// 称号 chosen in the storehouse outranks the automatic level title,
// because choosing it was the point.
// `headingTag`: the pass label is the profile screen's own <h1>, but
// the home hall mounts this same card under the wall map's masthead —
// two h1s on one screen is exactly what DESIGN.md's "one <h1> per
// screen" forbids, so the hall renders the label as a plain span.
// `footer`: the hall pins the stamp rally and the 新規 gauge to the
// bottom of the card; the profile keeps its own separate blocks.
// `onSettings`: 設定 belongs to the card (config/identity.js), so on the
// profile the card carries the door to it — a hairline gear beside the
// issuer's mark. The hall leaves it out: its pass is itself a button,
// and a button inside a button is not a thing.
export function CommuterPass({ profile, t, children, footer = null, headingTag: Heading = 'h1', onSettings = null }) {
  const [, jpTitle, title] = levelTitle(profile.level)

  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const equipped = profile.cosmetics?.loadout?.title
  const worn = equipped && equipped !== DEFAULT_LOADOUT.title
  const rank = profile.cosmetics?.rank

  return (
    <div className="pass">
      {/* 案一 of the pass round: composed the way a real IC card is
          printed — brand and issuer in the top corners, holder in the
          middle, the balance along the bottom with the class printed
          large beside it. */}
      <div className="pass__head">
        <span className="pass__brand">
          {/* The contactless mark every IC card in Japan is printed
              with — three arcs thickening outward. */}
          <span className="pass__wave" aria-hidden="true"><span /><span /><span /></span>
          <span className="pass__brand-names">
            <span className="pass__brand-jp" lang="ja">定期券</span>
            {/* This screen's own <h1> — no station plate here (see
                ProfileScreen's comment), but TopBar already treats this
                route as "your pass" rather than a place (see its own
                identity-route comment), so the pass label is exactly
                this screen's name. */}
            <Heading className="pass__brand-sub">{t.passLabel}</Heading>
          </span>
        </span>

        <span className="pass__head-right">
          {onSettings && (
            <button
              type="button"
              className="pass__gear"
              onClick={onSettings}
              aria-label={t.settings}
              title={t.settings}
            >
              <GearIcon size={14} />
            </button>
          )}
          {/* The issuing station's mark — every card says who issued it. */}
          <span className="pass__issuer" aria-hidden="true">JP</span>
        </span>
      </div>

      <div className="pass__body">
        {children}

        <div className="pass__ranks">
          {/* The title and the 段位 stamp share one line, centred on
              each other — the stamp belongs to the rank it seconds,
              not to a row of its own. */}
          <span className="pass__rank-row">
            <span className="pass__rank-jp" lang="ja">
              {worn ? profile.cosmetics.titleJp : jpTitle}
            </span>
            {rank && (
              <span className={`pass__dan${rank.isDan ? ' pass__dan--dan' : ''}`} title={t.masteryRank}>
                <span lang="ja">{rank.label}</span>
              </span>
            )}
          </span>
          <span className="pass__rank-latin">
            {worn ? (t.cosmeticName?.[equipped] ?? '') : title}
          </span>
        </div>
      </div>

      <div className="pass__balance">
        <div className="pass__balance-meter">
          <span className="pass__xp">{into.toLocaleString()} / {span.toLocaleString()} XP</span>
          <div className="pass__track" aria-hidden="true">
            <div className="pass__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {/* The class, printed large where a balance sits — beside the
            bar that climbs toward the next one, which is what makes
            the old "next level" caption redundant. */}
        <span className="pass__level">
          <span className="pass__level-num">{profile.level}</span>
          <span className="pass__level-label">{t.level}</span>
        </span>
      </div>

      {footer && (
        <div className="pass__footer">
          <div className="pass__footer-rule" aria-hidden="true" />
          {footer}
        </div>
      )}
    </div>
  )
}
