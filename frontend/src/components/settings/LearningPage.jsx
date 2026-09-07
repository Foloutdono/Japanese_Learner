import { useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick, playUi } from '../../lib/audio'
import { useProfileSummaryState, refreshSummary } from '../../stores/profileSummary'
import { refreshJourney } from '../../stores/journey'
import { useRatingScale, setRatingScale } from '../../stores/ratingScale'
import { RATING_SCALES, ratingButtons } from '../../domain/ratingScales'
import { Loading } from '../ui/Loading'
import { Emphasized } from '../ui/Emphasized'
import { Sheet } from '../chrome/Sheet'
import PlacementTest from '../onboarding/PlacementTest'
import { PACES } from '../onboarding/paces'
import { SettingsPage, Slip } from './SettingsPage'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// 二段 / 四段 / 六段 — the three bars, shortest first, so the row reads
// as one range from the fewest judgements to the most.
const RATING_SCALE_IDS = ['binary', 'simple', 'full']

// ── Learning (canvas SettingsLearn, plan 074) ─────────────────
// The level as the line's five stops with "You are here", the pace as
// the three services, the rating bar as three grades, and the
// placement test to retake. Level and pace write through PATCH
// /api/profile/learning (which never touches onboarded_at — changing
// your level later is not re-onboarding), then refreshSummary() so the
// HUD and every station's mark learn the new value at once.
//
// A level change confirms on a sheet first (the level rule): moving up
// marks the stops behind known and the sheet says how many, moving
// down sets the stops above aside and the sheet says nothing is
// deleted. The figures come from GET /api/profile/learning/preview —
// the same arithmetic the write will run.
export function LearningPage({ session }) {
  const { t } = useLang()
  const { summary, failed: summaryFailed } = useProfileSummaryState()
  const [pending, setPending] = useState(null) // { level, preview } while the sheet is open
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const current = summary?.jlptLevel ?? null
  const pace = summary?.dailyNewTarget ?? null

  function save(patch) {
    setSaving(true)
    setFailed(false)
    return apiJson('/api/profile/learning', session, { method: 'PATCH', body: JSON.stringify(patch) })
      .then(() => Promise.all([refreshSummary(), refreshJourney()]))
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  async function askLevel(level) {
    if (level === current || saving) return
    playClick()
    setFailed(false)
    try {
      const preview = await apiJson(`/api/profile/learning/preview?jlptLevel=${level}`, session)
      setPending({ level, preview })
    } catch {
      setFailed(true)
    }
  }

  function confirmLevel() {
    const { level } = pending
    setPending(null)
    playUi('click')
    save({ jlptLevel: level })
  }

  // The wait, drawn (plan 067): three dots until the summary answers.
  // A refused fetch still shows the controls — they work without the
  // summary, and a save refreshes it.
  if (!summary && !summaryFailed) {
    return <SettingsPage title={t.settingsLearning}><Loading /></SettingsPage>
  }

  return (
    <SettingsPage title={t.settingsLearning}>
      <Slip label={t.settingsJlptLevel} cap={t.levelCurrentMark}>
        <div className="lvlstrip" role="radiogroup" aria-label={t.settingsJlptLevel}>
          {LEVELS.map(level => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={current === level}
              disabled={saving}
              className={`lvlstrip__stop${current === level ? ' lvlstrip__stop--on' : ''}`}
              onClick={() => askLevel(level)}
            >
              <span className="lvlstrip__dot" aria-hidden="true" />
              <span className="lvlstrip__code">{level}</span>
              {current === level && <span className="lvlstrip__jp">{t.levelName[level]}</span>}
            </button>
          ))}
        </div>
        <p className="lvl-note"><Emphasized text={t.settingsLevelNote} strongClassName="lvl-note__strong" /></p>
      </Slip>

      <Slip label={t.settingsPace} cap={t.settingsPaceCap}>
        <div className="svc-grid" role="radiogroup" aria-label={t.settingsPace}>
          {PACES.map(p => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pace === p.perDay}
              disabled={saving}
              className={`svc${pace === p.perDay ? ' svc--on' : ''}`}
              title={p.recommended ? t.onbPaceRecommended : undefined}
              onClick={() => { if (pace !== p.perDay) { playClick(); save({ dailyNewTarget: p.perDay }) } }}
            >
              <span className="svc__jp">{t.paceName[p.id]}</span>
              <span className="svc__pace">
                {p.perDay} {t.settingsPerDay}
                {p.recommended && <> <span className="svc__star" aria-hidden="true">★</span></>}
              </span>
            </button>
          ))}
        </div>
        {/* A pace set outside the three services (the column is a free
            integer) still shows honestly instead of nowhere. */}
        {pace != null && !PACES.some(p => p.perDay === pace) && (
          <span className="slip__hint">{t.settingsPaceCustom(pace)}</span>
        )}
      </Slip>

      <RatingSlip t={t} session={session} />

      <Slip>
        <span className="slip__hint">{t.settingsRedoHint}</span>
        {!testing && (
          <button
            type="button"
            className="btn-secondary slip__act"
            onClick={() => { playClick(); setTestResult(null); setTesting(true) }}
          >
            {t.onbTestRetake}
          </button>
        )}
        {testing && !testResult && (
          <PlacementTest session={session} onResult={setTestResult} onCancel={() => setTesting(false)} />
        )}
        {testing && testResult && (
          <>
            <p className="hint">{t.onbTestResult(testResult.recommendedLevel, testResult.correct, testResult.total)}</p>
            <div className="form__row">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => { setTesting(false); askLevel(testResult.recommendedLevel) }}
              >
                {t.settingsRedoApply(testResult.recommendedLevel)}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setTesting(false)}>
                {t.cancel}
              </button>
            </div>
          </>
        )}
      </Slip>

      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}

      {pending && (
        <LevelSheet
          from={current}
          to={pending.level}
          preview={pending.preview}
          t={t}
          onConfirm={confirmLevel}
          onClose={() => setPending(null)}
        />
      )}
    </SettingsPage>
  )
}

// ── The confirm sheet (canvas SettingsLevelUp / SettingsLevelDown) ──
function LevelSheet({ from, to, preview, t, onConfirm, onClose }) {
  const up = preview.direction !== 'down'
  const title = up ? t.levelUpTitle(to) : t.levelDownTitle(to)
  return (
    <Sheet open onClose={onClose} jp={title} label={title} className="lvl-sheet">
      <p className="lvl-sheet__body">
        <Emphasized text={up ? t.levelUpBody(to, preview.spreadWeeks ?? 6) : t.levelDownBody(to)} strongClassName="lvl-sheet__strong" />
      </p>
      <div className="lvl-sheet__figs">
        {up ? (
          <>
            <div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v">{(preview.markedKnown ?? 0).toLocaleString()}</b><span className="lvl-sheet__fig-l">{t.levelMarkedKnown}</span></div>
            <div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v">{t.levelWeeks(preview.spreadWeeks ?? 6)}</b><span className="lvl-sheet__fig-l">{t.levelSpreadOver}</span></div>
          </>
        ) : (
          <>
            <div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v">{(preview.setAside ?? 0).toLocaleString()}</b><span className="lvl-sheet__fig-l">{t.levelSetAside}</span></div>
            <div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v">0</b><span className="lvl-sheet__fig-l">{t.levelDeleted}</span></div>
          </>
        )}
      </div>
      <button type="button" className="btn-depart btn-depart--sheet" data-action="level-confirm" onClick={onConfirm}>
        <span className="btn-depart__jp">{up ? t.levelUpGo(to) : t.levelDownGo(to)}</span>
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
      <button type="button" className="btn-secondary" onClick={onClose}>
        {t.levelStay(from ?? to)}
      </button>
    </Sheet>
  )
}

// ── Which rating bar to grade with ────────────────────────────
// Two, four or six buttons. Every bar sends the same 0..5 quality
// (see domain/ratingScales.js), so this is a choice about the
// control, not about the scheduling — which is exactly what the hint
// under it says. The words on each card are BUILT from the scale
// rather than written out in the locale files: they are the bar's own
// words in the bar's own order, so they cannot drift from what the
// study screens draw.
function RatingSlip({ t, session }) {
  const current = useRatingScale()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  function choose(id) {
    if (id === current) return
    playClick()
    setSaving(true)
    setFailed(false)
    setRatingScale(id, session)
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  // Worst-first, the way the bar draws them (ratingButtons is
  // best-first for the keyboard's sake — see RatingBar.jsx).
  const words = id => ratingButtons(id, t).map(b => b.label).reverse().join(' · ')

  return (
    <Slip label={t.settingsRatingScale}>
      <div className="grades" role="radiogroup" aria-label={t.settingsRatingScale}>
        {RATING_SCALE_IDS.map(id => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={current === id}
            disabled={saving}
            className={`svc${current === id ? ' svc--on' : ''}`}
            onClick={() => choose(id)}
          >
            <span className="svc__pace">{t.settingsRatingScaleOption[id] ?? RATING_SCALES[id].qualities.length}</span>
            <span className="svc__words">{words(id)}</span>
          </button>
        ))}
      </div>
      <span className="slip__hint">{t.settingsRatingScaleHint}</span>
      {failed && <span className="hint" role="alert">{t.onbPassError}</span>}
    </Slip>
  )
}
