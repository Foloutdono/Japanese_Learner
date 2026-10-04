import { useState } from 'react'
import { useLang } from '../../LangContext'
import { openBalance } from '../../stores/credits'
import { refreshSummary } from '../../stores/profileSummary'
import { showStatus } from '../chrome/hudStatus'
import { playClick } from '../../lib/audio'
import { PassCard } from './PassCard'
import { PassBack } from './PassBack'
import { usePassData } from './usePassData'

// ── 定期券 — the card where the learner holds it (plan 173) ─────────
// Two screens print the whole card, both sides: the profile, which
// opens on its face, and Settings, which opens on its back -- 設定 is
// the card's own preferences (DESIGN.md), and the back is where the
// contract is printed. A touch on the face turns it; a touch on the
// back, off its doors, turns it back.
//
// The back's doors are the old passes' (plan 139's fields, plan 143's
// footer, plan 074's status): the level and the destination, the
// service, the hour and the lines open their Settings pages -- on the
// desk's Settings, as links replacing the page beside the column, the
// open one marked -- the balance opens the balance sheet, the journey
// the status sheet, and the signature renames the holder in place.

function useTurn(initial) {
  const [side, setSide] = useState(initial)
  const turn = () => { playClick(); setSide(s => (s === 'face' ? 'back' : 'face')) }
  return [side, turn]
}

/** The profile's card: face up, its back a touch away. */
export function ProfileCard({ profile, session, onUsernameChange }) {
  const { t } = useLang()
  const { tier, face, back } = usePassData(profile)
  const [side, turn] = useTurn('face')
  const rename = username => { onUsernameChange(username); refreshSummary() }
  return (
    <section className="pcard-slot pcard-slot--profile" aria-label={t.passLabel} data-guide="profile.pass">
      <PassCard
        {...face}
        side={side}
        onTurn={turn}
        label={t.passLabel}
        back={(
          <PassBack
            tier={tier}
            data={back}
            onTurn={turn}
            doors={{ settings: null, onBalance: openBalance, onStatus: showStatus, sign: { session, onChange: rename } }}
          />
        )}
      />
    </section>
  )
}

/**
 * Settings' card: its back up, printed with the contract. `current` is
 * the page open beside the column on the desk (null on a phone).
 */
export function SettingsCard({ current = null, session = null }) {
  const { t } = useLang()
  const { tier, face, back } = usePassData()
  const [side, turn] = useTurn('back')
  return (
    <section className="pcard-slot pcard-slot--settings" aria-label={t.passLabel}>
      <PassCard
        {...face}
        side={side}
        onTurn={turn}
        label={t.passLabel}
        back={(
          <PassBack
            tier={tier}
            data={back}
            onTurn={turn}
            doors={{
              settings: current,
              onBalance: openBalance,
              onStatus: showStatus,
              sign: session ? { session, onChange: () => refreshSummary() } : null,
            }}
          />
        )}
      />
    </section>
  )
}
