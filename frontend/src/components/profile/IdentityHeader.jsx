import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { identityFor } from '../../config/identity'
import { PassWave } from './PassWave'

// ── The back of the card ──────────────────────────────────
// StationHeader's counterpart for the routes that are you rather than
// somewhere you go. Where the 駅名標 announces a station — reading,
// name, line, arrival time — this announces a card: whose it is, and
// which face of it you are looking at.
//
// The profile screen needs none of this; there the pass itself is the
// masthead, at full size. This is for /settings, which is the reverse
// of that card — the side with the terms printed on it — and it is
// written off identityFor rather than hardcoded so it cannot drift
// from what the top bar says one line above it.
//
// It ends on the pass's own ink, the same way the plate ends on its
// line colour: the two mastheads rhyme without pretending to be the
// same object.
export function IdentityHeader() {
  const { pathname } = useLocation()
  const { t } = useLang()

  const identity = identityFor(pathname, t)
  if (!identity) return null

  return (
    <div className="id-header">
      <div className="id-header__brand">
        <PassWave className="pass__wave id-header__wave" />
        <span className="id-header__issuer">{t.passLabel}</span>
      </div>

      <span className="id-header__name" lang="ja">{identity.glyph}</span>
      <span className="id-header__latin">{identity.title}</span>

      <div className="id-header__stripe" aria-hidden="true" />
    </div>
  )
}
