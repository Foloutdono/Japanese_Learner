import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useJourneyStatus } from '../../stores/journey'
import { linesOrAll } from '../../domain/boarding'
import { PassHead } from '../profile/CommuterPass'
import { ChevronIcon } from '../ui/Icons'
import { SettingsDoor } from './SettingsDoor'
import { dateFormat, hourLabel, paceLabel, stopParts } from './contract'

// ── 定期券 — the pass, printed with its contract (plan 139) ──────
// DESIGN.md has always said it: 設定 is the card's own preferences.
// Settings opens on the pass, printed with the contract it was issued
// under — the level it boards at, the destination, the service, the
// daily ride, the lines — and each printed field is the door to the
// page that changes it. The validity is printed in the pass's gold and
// opens nothing: it is what the others add up to.
//
// Two pages used to share this (Learning and Destination), and the
// daily pace was on both, as two sets of three cards over one number.
// It is one field now.
export function SettingsPass({ current = null }) {
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  const { data: journey } = useJourneyStatus()
  const desk = current != null

  const level = summary?.jlptLevel ?? null
  const goal = journey?.goalLevel ?? null
  const pace = journey?.plannedPerDay ?? summary?.dailyNewTarget ?? null
  const from = stopParts(t, level)
  const to = stopParts(t, goal)
  const valid = goal && journey?.goalTargetDate ? dateFormat(lang).format(new Date(journey.goalTargetDate)) : null

  const FIELDS = [
    { page: 'service', label: t.destService, value: paceLabel(t, pace) },
    { page: 'hour', label: t.passFieldHour, value: journey ? hourLabel(t, journey.dailyDeparture ?? null) : '' },
    { page: 'lines', label: t.passFieldLines, value: summary ? linesOrAll(summary.lines).map(l => t.brdLine[l]).join(' · ') : '' },
  ]

  return (
    <section className="pass stg-pass" aria-label={t.passLabel}>
      <PassHead t={t} headingTag="span" />

      <div className="stg-pass__route">
        <SettingsDoor
          page="level"
          current={current}
          className="stg-pass__stop"
          onClassName="stg-pass__stop--on"
          aria-label={`${t.settingsJlptLevel}, ${from.code} ${from.name}`}
        >
          <span className="stg-pass__code">{from.code}</span>
          <span className="stg-pass__name">{from.name}</span>
        </SettingsDoor>
        <span className="stg-pass__rail" aria-hidden="true" />
        <SettingsDoor
          page="destination"
          current={current}
          className="stg-pass__stop"
          onClassName="stg-pass__stop--on"
          aria-label={`${t.settingsGoal}, ${to.code === '—' ? '' : `${to.code} `}${to.name}`}
        >
          <span className="stg-pass__code">{to.code}</span>
          <span className="stg-pass__name">{to.name}</span>
        </SettingsDoor>
      </div>

      <div className="stg-pass__fields">
        {FIELDS.map(f => (
          <SettingsDoor key={f.page} page={f.page} current={current} className="stg-pass__field" onClassName="stg-pass__field--on">
            <span className="stg-pass__key">{f.label}</span>
            <span className="stg-pass__value">{f.value}</span>
            {!desk && <ChevronIcon direction="right" size={16} className="stg-pass__chev" />}
          </SettingsDoor>
        ))}
        {valid && (
          <div className="stg-pass__field stg-pass__field--valid">
            <span className="stg-pass__key">{t.destValidUntil}</span>
            <span className="stg-pass__value">{valid}</span>
          </div>
        )}
      </div>
    </section>
  )
}
