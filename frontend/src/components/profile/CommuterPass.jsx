import { levelTitle } from '../../domain/levelTitle'
import { DEFAULT_LOADOUT } from '../../stores/cosmetics'

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
export function CommuterPass({ profile, t, children }) {
  const [, jpTitle, title] = levelTitle(profile.level)

  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const equipped = profile.cosmetics?.loadout?.title
  const worn = equipped && equipped !== DEFAULT_LOADOUT.title
  const rank = profile.cosmetics?.rank

  return (
    <div className="pass">
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
            <h1 className="pass__brand-sub">{t.passLabel}</h1>
          </span>
        </span>

        <span className="pass__level">
          <span className="pass__level-num">{profile.level}</span>
          <span className="pass__level-label">{t.level}</span>
        </span>
      </div>

      <div className="pass__body">
        {children}

        <div className="pass__ranks">
          <span className="pass__rank-jp" lang="ja">
            {worn ? profile.cosmetics.titleJp : jpTitle}
          </span>
          <span className="pass__rank-latin">
            {worn ? (t.cosmeticName?.[equipped] ?? '') : title}
          </span>
          {rank && (
            <span className={`pass__dan${rank.isDan ? ' pass__dan--dan' : ''}`} title={t.masteryRank}>
              <span lang="ja">{rank.label}</span>
            </span>
          )}
        </div>
      </div>

      <div className="pass__balance">
        <div className="pass__balance-row">
          <span className="pass__xp">{into.toLocaleString()} / {span.toLocaleString()} XP</span>
          <span className="pass__next">{t.nextLevel}</span>
        </div>
        <div className="pass__track" aria-hidden="true">
          <div className="pass__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
