import { useState } from 'react'
import OnboardingFlow from './OnboardingFlow'
import { TicketGate } from '../components/station/TicketGate'
import { HOME_STATION } from '../config/stations'
import { playClick } from '../lib/audio'

// ── /dev/onboarding — the ticket office on repeat ─────────────
// Development-only workbench, the RewardsPreview of the onboarding:
// the REAL flow (real placement paper, real volumes, real demos, the
// real TicketGate finale) with two dev affordances — dryRun, so the
// final POST never writes onboarded_at, and a replay control that
// remounts the flow fresh (key bump), arrival cutscene included.
//
// Registered next to /dev/rewards in App.jsx, outside the auth gate
// and dropped from production bundles the same way (the route only
// exists behind import.meta.env.DEV, so this file is tree-shaken).
// The synthetic bearer token works because a dev backend runs with
// DEV_USER_ID and never verifies it; the placement and volumes calls
// are therefore live, which is the point — a preview of fake data
// would not exercise the thing being polished.
export default function OnboardingPreview() {
  const [run, setRun] = useState(1)
  const [phase, setPhase] = useState('flow') // flow | gate | done
  const session = { access_token: 'dev-preview' }

  function replay() {
    playClick()
    setPhase('flow')
    setRun(n => n + 1)
  }

  return (
    <>
      {phase !== 'done' && (
        <OnboardingFlow
          key={run}
          session={session}
          dryRun
          initialProfile={{ username: 'Preview' }}
          onComplete={() => setPhase('gate')}
        />
      )}

      {/* The finale, exactly as App stages it — over the flow's last
          frame rather than a mounted router, which is fine: the wipe
          covers everything either way. */}
      {phase === 'gate' && (
        <TicketGate
          section={{ icon: '日本語', title: HOME_STATION.latin }}
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
