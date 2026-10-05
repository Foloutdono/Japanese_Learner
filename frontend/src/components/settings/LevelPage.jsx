import { useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick, playUi } from '../../lib/audio'
import { useProfileSummaryState } from '../../stores/profileSummary'
import { useTodaySummary, refreshToday } from '../../stores/today'
import { Loading } from '../ui/Loading'
import { Emphasized } from '../ui/Emphasized'
import { Sheet } from '../chrome/Sheet'
import PlacementTest from '../onboarding/PlacementTest'
import { SettingsPage, Slip } from './SettingsPage'
import { useLearningSave } from './learningSave'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// ── The level (the pass's boarding station, plan 139) ───────────
// The level as the line's five stops, the one you stand at filled, and
// the placement test to retake — the other way to set it. It was the
// head of Settings' Learning page (canvas SettingsLearn, plan 074) until
// that page was split along the pass's fields: the pace went to the
// Service field, the lines to their own, the rating bar and the first
// ride to the rows under the pass.
//
// A level change confirms on a sheet first (the level rule): moving up
// marks the stops behind known and the sheet says how many, moving
// down sets the stops above aside and the sheet says nothing is
// deleted. The figures come from GET /api/profile/learning/preview —
// the same arithmetic the write will run.
export function LevelPage({ session }) {
  const { t } = useLang()
  const { summary, failed: summaryFailed } = useProfileSummaryState()
  const { save, saving, failed, setFailed } = useLearningSave(session)
  const [pending, setPending] = useState(null) // { level, preview } while the sheet is open
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const current = summary?.jlptLevel ?? null
  // One tab stop on the desk (plan 123). The arrows move the focus
  // alone: a level asks before it moves -- Space chooses.
  const desk = useDesk()
  const onWalk = useRadioWalk(desk, { check: false })

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
    return <SettingsPage title={t.settingsJlptLevel}><Loading /></SettingsPage>
  }

  return (
    <SettingsPage title={t.settingsJlptLevel}>
      {/* No label: the page is the level, and the stop you stand at
          prints its own name. On the desk every stop prints its name
          (plan 145), as the destination's line does: a page the pane's
          width has the room, and a stop is chosen by what it is. The
          ones you do not stand at are dropped again while the pane
          holds one column (index.css, the 机 section). */}
      <Slip>
        <div className="lvlstrip" role="radiogroup" aria-label={t.settingsJlptLevel} onKeyDown={onWalk}>
          {LEVELS.map((level, i) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={current === level}
              tabIndex={radioTab(desk, i, LEVELS.indexOf(current))}
              disabled={saving}
              className={`lvlstrip__stop${current === level ? ' lvlstrip__stop--on' : ''}`}
              onClick={() => askLevel(level)}
            >
              <span className="lvlstrip__dot" aria-hidden="true" />
              <span className="lvlstrip__code">{level}</span>
              {(desk || current === level) && (
                <span className={`lvlstrip__jp${current === level ? '' : ' lvlstrip__jp--away'}`}>{t.levelName[level]}</span>
              )}
            </button>
          ))}
        </div>
      </Slip>

      {/* The level's consequences are said on the confirm sheet, at the
          moment they apply, and nowhere else — a page of settings is
          controls, not a manual. */}
      {/* Across a desk page while it is a button (plan 145); the test,
          once running, takes the card as it does on the phone. */}
      <Slip label={t.settingsRedo} across={!testing}>
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

      <BasicsSlip session={session} />

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
    <Sheet open onClose={onClose} jp={title} label={title} className="lvl-sheet" initialFocus=".btn-secondary">
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

// ── 基礎 — skipping the basics (plan 186f) ──────────────────────
// For an N5 learner who knows the basics already: every course card not
// yet met is marked known, as a level change marks the stops behind it,
// and Today goes on to the rest of N5. Drawn only while the course is
// being ridden (/api/today's `basics`, null above N5). It asks once
// before it writes, on the slip itself -- nothing is deleted, but
// nothing gives the course back either.
function BasicsSlip({ session }) {
  const { t } = useLang()
  const basics = useTodaySummary().data?.basics
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [marked, setMarked] = useState(null)
  const [failed, setFailed] = useState(false)

  if (marked != null) {
    return <Slip label={t.basicsSkipLabel}><p className="hint" role="status">{t.basicsSkipped(marked)}</p></Slip>
  }
  if (!basics || basics.done) return null

  async function skip() {
    playUi('click')
    setBusy(true)
    setFailed(false)
    try {
      const res = await apiJson('/api/today/basics/skip', session, { method: 'POST' })
      setMarked(res.markedKnown ?? 0)
      refreshToday()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  return (
    <Slip label={t.basicsSkipLabel} cap={t.basicsUnit(basics.unit, basics.of)} across={!asking}>
      {!asking ? (
        <button type="button" className="btn-secondary slip__act" onClick={() => { playClick(); setAsking(true) }}>
          {t.basicsSkip}
        </button>
      ) : (
        <div className="form__row">
          <button type="button" className="btn-primary" data-action="basics-skip" disabled={busy} onClick={skip}>
            {t.basicsSkipAct}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAsking(false)}>
            {t.cancel}
          </button>
        </div>
      )}
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </Slip>
  )
}
