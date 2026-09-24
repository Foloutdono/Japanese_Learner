import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { returnsTo } from '../stores/boarding'

// ── A run's way out ─────────────────────────────────────────────
// A run is boarded from its platforms (a push), and its way out — the
// head's ‹, the finish's filled button — used to push those platforms
// again. The history then read platforms, run, platforms, and Back
// re-boarded the run just left, fetching a fresh session. Leaving now
// returns: back one entry when the run was boarded from exactly this
// page in this tab (stores/boarding's returnsTo), or else — a reload, a
// shared link, a run reached from the statistics — the platforms
// REPLACE the run, so Back never lands on it either way.
export function useRunExit(platforms) {
  const navigate = useNavigate()
  return useCallback(() => {
    if (returnsTo(platforms)) navigate(-1)
    else navigate(platforms, { replace: true })
  }, [navigate, platforms])
}
