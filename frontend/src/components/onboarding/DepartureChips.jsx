import { DEPARTURES, DEPART_JP, DEPART_TIMES } from './departures'

// ── 発車時刻 — the hour, as a row of chips ───────────────────────
// The optional habit hour: three services and 自由. Pressing the hour
// already chosen releases it back to 自由, so the row never becomes a
// choice you cannot undo.
//
// One component, two counters: the office asks it on the application
// form (OnboardingFlow's PassStep) and the settings counter changes
// it afterwards (GoalCounter) — the same chips, not a second set that
// drifts from these within two features.

export function DepartureChips({ t, value, onChange, disabled = false }) {
  return (
    <span className="onb-form__chips" role="group" aria-label={t.onbFormDepart}>
      {DEPARTURES.map(id => (
        <button
          key={id}
          type="button"
          className="onb-form__chip"
          disabled={disabled}
          aria-pressed={value === id}
          onClick={() => onChange(value === id ? null : id)}
        >
          <span lang="ja">{DEPART_JP[id]}</span>
          {DEPART_TIMES[id]}
        </button>
      ))}
      <button
        type="button"
        className="onb-form__chip"
        disabled={disabled}
        aria-pressed={value == null}
        onClick={() => onChange(null)}
      >
        <span lang="ja">自由</span>
        {t.onbDepartFlex}
      </button>
    </span>
  )
}
