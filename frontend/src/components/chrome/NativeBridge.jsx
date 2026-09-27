import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummaryState } from '../../stores/profileSummary'
import { useTodaySummary, refreshToday } from '../../stores/today'
import { setAheadPlan } from '../../stores/ahead'
import { kanaSetLabel } from '../../domain/kanaSets'
import { apiJson } from '../../lib/api'
import { track } from '../../lib/track'
import { aheadInstants, aheadQuery, planNudges, widgetPayload, WIDGET_HOUR } from '../../lib/ahead'
import {
  backAction, bindBackButton, bindOpenings, bindResume, exitApp, isNative, nativePlatform,
  nudgeAt, syncNudges, updateWidget,
} from '../../lib/platform'

// A plan waits this long after what it reads last moved, so a run's
// burst of refreshes plans once.
const PLAN_DELAY_MS = 800
// With nothing changed that the plan reads, it is made again at most
// this often (a return to the front, the Today store's own TTL).
const REPLAN_MS = 10 * 60_000

// ── The shell's habits (plan 076) ─────────────────────────────
// Renders nothing but the planner, and that on a shell only. Inside the
// router because all of it needs the router: Android's back button
// closes an open sheet, else steps back through the history, else --
// at a gate's root -- leaves the app; and the day ahead (plan 156).
export function NativeBridge() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
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

  if (!isNative() || !summary) return null
  return <AheadPlanner enabled={summary.notifications === true} time={summary.reminderTime ?? null} />
}

// ── 発車案内 — the day ahead (plan 156) ──────────────────────
// The daily nudge used to be one repeating notification with the same
// words every day, sent whether anything was due or not. It is planned
// now from what the gate will hold: a dated notification for each of
// the next seven days at the learner's hour, none on a day with nothing
// due, none today once they have ridden (lib/ahead.js). The widget is
// handed its figures from the same answer. Both are planned again
// whenever something they read moves -- the profile's two answers, the
// language, a run landing (the Today store refreshes) -- and when the
// app comes back to the front. A tap on either opens the gate.
function AheadPlanner({ enabled, time }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const { data: today, at } = useTodaySummary()
  const last = useRef({ key: null, at: 0 })

  useEffect(() => {
    let unbind = () => {}
    let gone = false
    bindOpenings(({ to, via }) => {
      track('nudge_opened', { via })
      navigate(to)
    }).then(fn => { if (gone) fn(); else unbind = fn })
    return () => { gone = true; unbind() }
  }, [navigate])

  useEffect(() => {
    let unbind = () => {}
    let gone = false
    bindResume(() => { refreshToday() }).then(fn => { if (gone) fn(); else unbind = fn })
    return () => { gone = true; unbind() }
  }, [])

  const total = today?.total ?? null
  useEffect(() => {
    if (total == null) return
    const key = `${enabled}|${time}|${lang}|${total}`
    if (key === last.current.key && Date.now() - last.current.at < REPLAN_MS) return
    let cancelled = false
    const handle = setTimeout(async () => {
      const now = new Date()
      const hour = nudgeAt(time)
      const ahead = await apiJson(aheadQuery(aheadInstants(hour ?? WIDGET_HOUR, now), now, lang), null)
        .catch(() => null)
      if (cancelled) return
      last.current = { key, at: Date.now() }
      await updateWidget(widgetPayload({ today, ahead, t, now }))
      // No answer: whatever was scheduled before stays scheduled -- a
      // stale reminder is better than a silent phone.
      if (!ahead) {
        setAheadPlan({ failed: true })
        return
      }
      const planned = hour
        ? planNudges({ ahead, time, t, kanaSetLabel, now, platform: nativePlatform() })
        : []
      await syncNudges(enabled ? planned : [])
      if (!cancelled) setAheadPlan({ nudges: planned, failed: false })
    }, PLAN_DELAY_MS)
    return () => { cancelled = true; clearTimeout(handle) }
    // `today` and `t` are read at plan time; `at` and `total` say when
    // they have moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, time, lang, total, at])

  return null
}
