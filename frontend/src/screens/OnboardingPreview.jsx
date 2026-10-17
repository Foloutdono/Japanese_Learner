import { useState } from 'react'
import BoardingFlow from './BoardingFlow'
import { TicketGate } from '../components/station/TicketGate'
import { HOME_STATION } from '../config/stations'
import { playClick } from '../lib/audio'

// ── /dev/onboarding — the boarding on repeat ──────────────────
// Development-only workbench, the RewardsPreview of the boarding: the
// REAL flow (the real volumes, the real screens, the real TicketGate
// finale) with two dev affordances — dryRun, so the contract is never
// written, and a replay control that remounts the flow fresh (key bump).
//
// Registered next to /dev/rewards in App.jsx, outside the auth gate
// and dropped from production bundles the same way (the route only
// exists behind import.meta.env.DEV, so this file is tree-shaken).
// The synthetic bearer token works because a dev backend runs with
// DEV_USER_ID and never verifies it; the volumes call is therefore
// live, which is the point — a preview of fake data would not
// exercise the thing being polished. `?guest` boards on a guest pass,
// so the card's line offers to keep it (plan 246).
export default function OnboardingPreview() {
  const [run, setRun] = useState(1)
  const [phase, setPhase] = useState('flow') // flow | gate | done
  const session = { access_token: 'dev-preview' }
  const [guest] = useState(() => new URLSearchParams(window.location.search).has('guest'))

  function replay() {
    playClick()
    setPhase('flow')
    setRun(n => n + 1)
  }

  return (
    <>
      {phase !== 'done' && (
        <BoardingFlow
          key={run}
          session={session}
          dryRun
          guest={guest}
          onComplete={() => setPhase('gate')}
          // Back out of the first question leaves the boarding in the
          // app; here it replays it.
          onExit={replay}
        />
      )}

      {/* The finale, exactly as App stages it — over the flow's last
          frame rather than a mounted router, which is fine: the wipe
          covers everything either way. */}
      {phase === 'gate' && (
        <TicketGate
          section={{ icon: '辻', title: HOME_STATION.latin }}
          station={HOME_STATION}
          onNavigate={() => {}}
          onDone={() => setPhase('done')}
        />
      )}

      {phase === 'done' && (
        <div className="onb-preview-done">
          <span lang="ja">改札通過</span>
          <p>Run #{run} complete — nothing was written.</p>
        </div>
      )}

      <div className="onb-preview-bar">
        <span className="onb-preview-bar__tag">DEV</span>
        <span className="onb-preview-bar__run">run {run}</span>
        <button type="button" onClick={replay}>↺ Replay</button>
      </div>
    </>
  )
}
