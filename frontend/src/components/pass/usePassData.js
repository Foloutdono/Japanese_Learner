import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus } from '../../stores/journey'
import { useCredits } from '../../stores/credits'
import { useOnline } from '../../hooks/useOnline'
import { journeyModel } from '../../domain/goalMath'
import { linesOrAll } from '../../domain/boarding'
import { CAP, nextCreditClock } from '../../domain/credits'
import { cardTier, xpClimb, driftWords, sinceMonth } from '../../domain/passCard'
import { statusOf } from '../chrome/hudStatus'
import { dateFormat, hourLabel, paceLabel, stopParts } from '../settings/contract'

// ── What the card prints, from the stores the old passes read (plan 172) ──
// The profile summary (/api/profile: the holder, the climb, the level
// boarded at, the lines, the month issued), the journey (the
// destination, its date, the service and the hour, the journey's word),
// the credits (the plan, so the material, and the balance) and the
// network (offline is the journey's word when it is gone). `profile`
// stands in for the summary where a screen holds its own copy (the
// profile's, renamed in place). Every figure is the one the old pass
// printed in the same place, so the two can never disagree.
export function usePassData(profile = null) {
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  const credits = useCredits()
  const { data: journey } = useJourneyStatus()
  const online = useOnline()
  const s = profile ?? summary

  const tier = cardTier(credits)
  const climb = xpClimb(s)
  const goal = journey?.goalLevel ?? null
  const pace = journey?.plannedPerDay ?? s?.dailyNewTarget ?? null

  const unlimited = Boolean(credits?.unlimited)
  const balance = unlimited ? null : (credits?.balance ?? null)
  const cap = credits?.cap ?? CAP
  const next = balance != null && balance < cap ? nextCreditClock(credits, lang) : null
  const note = unlimited ? t.cardNoCredit
    : next ? t.balanceRefillLine(next)
      : tier === 'pro' ? t.cardPerExercise : null

  const panel = online ? statusOf(journey ? journeyModel(journey) : null) : { status: 'offline', days: null }
  const status = panel && {
    status: panel.status,
    word: panel.status === 'offline' ? t.hudOffline : t.hudStatus[panel.status],
    drift: driftWords(t, panel),
    days: panel.days,
  }

  return {
    tier,
    face: { tier, name: s?.username ?? '', level: s?.level ?? 1, share: climb.share },
    back: {
      from: stopParts(t, s?.jlptLevel ?? null),
      to: stopParts(t, goal),
      valid: goal && journey?.goalTargetDate ? dateFormat(lang).format(new Date(journey.goalTargetDate)) : null,
      service: paceLabel(t, pace),
      hour: journey ? hourLabel(t, journey.dailyDeparture ?? null) : '',
      lines: linesOrAll(s?.lines),
      level: s?.level ?? 1,
      into: climb.into,
      span: climb.span,
      share: climb.share,
      balance,
      unlimited,
      cap,
      unit: balance == null ? '' : `/ ${cap} ${t.creditsUnit}`,
      note,
      status,
      name: s?.username ?? '',
      since: sinceMonth(s?.onboardedAt, lang),
    },
    credits,
  }
}
