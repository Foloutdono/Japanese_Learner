import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummaryState } from '../../stores/profileSummary'
import { backAction, bindBackButton, exitApp, isNative, syncNudge } from '../../lib/platform'

// ── The shell's two habits (plan 076) ─────────────────────────
// Renders nothing. Inside the router because both need it: Android's
// back button closes an open sheet, else steps back through the
// history, else -- at a gate's root -- leaves the app; and the daily
// nudge follows the profile's own answer (plan 075's reminderTime and
// notifications), rescheduled whenever it changes and cancelled when
// the learner turns it off. Both effects return at once on the web.
export function NativeBridge() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useLang()
  const { summary } = useProfileSummaryState()
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])

  useEffect(() => {
    if (!isNative()) return
    let unbind = () => {}
    let gone = false
    bindBackButton(({ canGoBack }) => {
      const action = backAction({
        hasDialog: document.querySelector('[role="dialog"]') !== null,
        pathname: pathRef.current,
        canGoBack,
      })
      if (action === 'close') {
        // hooks/useDialog listens for Escape on the window: one path
        // closes every sheet, whoever mounted it.
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      } else if (action === 'back') {
        navigate(-1)
      } else {
        exitApp()
      }
    }).then(fn => { if (gone) fn(); else unbind = fn })
    return () => { gone = true; unbind() }
  }, [navigate])

  const enabled = summary?.notifications === true
  const time = summary?.reminderTime ?? null
  useEffect(() => {
    if (!isNative() || !summary) return
    syncNudge({ enabled, time, title: t.brdNotifTitle(time ?? ''), body: t.brdNotifText })
    // The summary object is not a dependency: only the two answers are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, time, t])

  return null
}
