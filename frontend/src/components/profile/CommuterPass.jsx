import { levelTitle } from '../../domain/levelTitle'

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
// The class printed under the holder is the level title — how much you
// have shown up, and everybody has one. It used to share its line with
// a 段位 stamp and could be overridden by a chosen 称号; both went with
// the mastery rank and the cosmetics, and the pass prints one class.
// `headingTag`: the pass label is the profile screen's own <h1>; a
// caller mounting the card under another heading renders it as a
// plain span (one <h1> per screen).
// `footer`: the profile prints the balance line there (plan 074); a
// caller with nothing to print leaves it null.
//
// The brand is the wave and the word in the learner's language — the
// canvas's rule (plan 068): Japanese is content, and a pass's label is
// chrome. The gear that used to sit beside the issuer went with the
// records' door to Settings (ProfileBlocks.jsx).
export function CommuterPass({ profile, t, children, footer = null, headingTag: Heading = 'h1' }) {
  const [, jpTitle, title] = levelTitle(profile.level)

  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

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
          {/* This screen's own <h1>: the pass label is exactly this
              screen's name. */}
          <Heading className="pass__brand-sub">{t.passLabel}</Heading>
        </span>

        <span className="pass__head-right">
          {/* The issuing station's mark — every card says who issued it. */}
          <span className="pass__issuer" aria-hidden="true">JP</span>
        </span>
      </div>

      <div className="pass__body">
        {children}

        {/* The class, in the two registers every name in the app is
            set in: the title, and its plain-language caption. */}
        <div className="pass__ranks">
          <span className="pass__rank-jp" lang="ja">{jpTitle}</span>
          <span className="pass__rank-latin">{title}</span>
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
