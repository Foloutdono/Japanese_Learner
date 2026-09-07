import { useState } from 'react'
import BoardingFlow from './BoardingFlow'
import { TicketGate } from '../components/station/TicketGate'
import { HOME_STATION } from '../config/stations'
import { playClick } from '../lib/audio'

// ── /dev/onboarding — the boarding on repeat ──────────────────
// Development-only workbench, the RewardsPreview of the boarding: the
// REAL flow (the real volumes, the real screens, the real TicketGate
// finale) with two dev affordances — dryRun, so neither the name nor
// the contract is ever written, and a replay control that remounts the
// flow fresh (key bump), arrival cutscene included.
//
// Registered next to /dev/rewards in App.jsx, outside the auth gate
// and dropped from production bundles the same way (the route only
// exists behind import.meta.env.DEV, so this file is tree-shaken).
// The synthetic bearer token works because a dev backend runs with
// DEV_USER_ID and never verifies it; the volumes call is therefore
// live, which is the point — a preview of fake data would not
// exercise the thing being polished.
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
        <BoardingFlow
          key={run}
          session={session}
          dryRun
          initialProfile={{ username: 'Preview', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 }}
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
