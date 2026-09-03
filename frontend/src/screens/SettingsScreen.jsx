import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { supabase } from '../lib/supabase'
import { apiFetch, apiJson } from '../lib/api'
import { playClick, playUi, playToggle, setVolume, useVolumes, DEFAULT_VOLUMES } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { MuteButton, ThemeToggle, LangSwitcher, SoundMixer } from '../components/ui/NavControls'
import { useProfileSummary, refreshSummary } from '../stores/profileSummary'
import { useRatingScale, setRatingScale } from '../stores/ratingScale'
import { RATING_SCALES, ratingButtons } from '../domain/ratingScales'
import PlacementTest from '../components/onboarding/PlacementTest'
import { PACES } from '../components/onboarding/paces'
import { GoalCounter } from '../components/journey/GoalCounter'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// 段 is the counter for a grade or rank — 四段 is a four-grade scale,
// which is what the default rating bar is. Shortest first, so the row
// reads as one range from the fewest judgements to the most; 四段 is
// the middle of it because it is the default, not because it is a
// compromise.
const RATING_SCALE_CHIPS = [
  { id: 'binary', jp: '二段' },
  { id: 'simple', jp: '四段' },
  { id: 'full',   jp: '六段' },
]

// The station-theatre channels — what 静かな通勤 silences and 全部
// restores. The study channels (kana, voice, effects, UI) are never
// touched by a preset: presets exist for the commute-with-headphones
// case, not as a second mute button.
const THEATRE = ['ambiance', 'jingle', 'announcement']

// ── 窓口 — settings as the service counter ──────────────────
// One rail of sections, one slip at a time — built to the settings
// round's 案三 artboard: the slip carries its own paired heading
// inside the card, rows set the label left and the control right, and
// the rail marks the open counter with the pass's ink (this screen
// belongs to the holder; see config/identity.js). Sections keep
// stable ids so a pane can be linked and a reload lands where you
// were (#son, #data…).
//
// 行先 joined the rail after the pass's own back was found pointing
// at a counter that did not exist: "no destination on this pass — set
// one at the office" led here, and here had nothing about a goal on
// it. It is deliberately its own counter rather than three more rows
// under 学習 — a destination, a date and an hour are one contract,
// and the pass back deep-links to them (/settings#goal).
//
// Deliberately NOT here: the 通知 reminders pane the artboard
// sketched as 構想. It needs browser notifications and a preferences
// endpoint that do not exist, and a settings screen above all must be
// exactly what it says — no dead controls.
const SECTION_IDS = ['env', 'son', 'learning', 'goal', 'data', 'account']

function initialSection() {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
  return SECTION_IDS.includes(hash) ? hash : SECTION_IDS[0]
}

export default function SettingsScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [section, setSection] = useState(initialSection)
  const railRef = useRef(null)

  // `rail` is the short word a chip can carry (the artboard writes
  // Affichage, not Affichage & langue, on the rail); the slip's own
  // head prints the full title.
  const SECTIONS = [
    { id: 'env',      jp: '環境',   rail: t.settingsEnvShort, title: t.settingsEnvironment },
    { id: 'son',      jp: '音',     rail: t.sound,            title: t.sound },
    { id: 'learning', jp: '学習',   rail: t.settingsLearning, title: t.settingsLearning },
    { id: 'goal',     jp: '行先',   rail: t.settingsGoal,     title: t.settingsGoal },
    { id: 'data',     jp: 'データ', rail: t.settingsData,     title: t.settingsData },
    { id: 'account',  jp: '会員',   rail: t.account,          title: t.account },
  ]

  function select(id) {
    setSection(id)
    // Replace, not push: the back button should leave settings, not
    // unwind every counter visited on the way.
    window.history.replaceState(null, '', `#${id}`)
  }

  // Roving arrows on the rail, per the tabs pattern: Left/Up and
  // Right/Down move the selection, and focus follows it.
  function onRailKeyDown(e) {
    const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
      : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = SECTION_IDS[
      (SECTION_IDS.indexOf(section) + delta + SECTION_IDS.length) % SECTION_IDS.length
    ]
    select(next)
    railRef.current?.querySelector(`[data-id="${next}"]`)?.focus()
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.settings} autoHide />

      <main id="main-content" className="container settings-container">
        <div className="stg-counter">
          <nav
            ref={railRef}
            className="stg-rail"
            role="tablist"
            aria-label={t.settings}
            onKeyDown={onRailKeyDown}
          >
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                role="tab"
                data-id={s.id}
                id={`stg-tab-${s.id}`}
                aria-selected={section === s.id}
                aria-controls={`stg-pane-${s.id}`}
                tabIndex={section === s.id ? 0 : -1}
                className="stg-rail__item"
                onClick={() => { playClick(); select(s.id) }}
              >
                <span className="stg-rail__jp" lang="ja">{s.jp}</span>
                <span className="stg-rail__latin">{s.rail}</span>
              </button>
            ))}
          </nav>

          <div className="stg-panes">
            <Slip id="env" section={section} jp="環境" title={t.settingsEnvironment}>
              <div className="settings-row stg-row--wrap">
                <span className="settings-row__label">{t.theme}</span>
                <ThemeToggle />
              </div>
              <div className="settings-row">
                <span className="settings-row__label">{t.language}</span>
                <LangSwitcher />
              </div>
            </Slip>

            <Slip id="son" section={section} jp="音" title={t.sound} aside={<MuteButton />}>
              <SoundPresets t={t} />
              <div className="settings-row settings-row--stack">
                <SoundMixer />
              </div>
            </Slip>

            <Slip id="learning" section={section} jp="学習" title={t.settingsLearning}>
              <LearningRows t={t} session={session} />
            </Slip>

            <Slip id="goal" section={section} jp="行先" title={t.settingsGoal}>
              <GoalCounter session={session} />
            </Slip>

            <Slip id="data" section={section} jp="データ" title={t.settingsData}>
              <DataRows t={t} session={session} />
            </Slip>

            <Slip id="account" section={section} jp="会員" title={t.account}>
              {session?.user?.email && (
                <div className="settings-row">
                  <span className="settings-row__label">
                    {t.settingsIssuedTo}
                    <span className="stg-hint">{session.user.email}</span>
                  </span>
                </div>
              )}
              <div className="settings-row settings-row--danger">
                <span className="settings-row__label">{t.signOutDesc}</span>
                {/* Filled danger per the standing ruling on this exact
                    button (see .settings-signout) — the artboard's
                    pass-ink fill loses to a measured 2.11:1 outline
                    already tried and rejected here. */}
                <button type="button" className="btn-primary settings-signout" onClick={() => supabase.auth.signOut()}>
                  {t.signOut}
                </button>
              </div>
            </Slip>
          </div>
        </div>
      </main>
    </div>
  )
}

// A slip: the card with its own paired heading inside, exactly as the
// artboard draws it — not a SectionHeader floating above a bare card.
// Hidden (not unmounted) when another counter is open, so a half-taken
// placement test survives a glance at the mixer. `aside` is the head's
// right-hand slot (the sound slip parks the mute control there).
function Slip({ id, section, jp, title, aside = null, children }) {
  return (
    <section
      id={`stg-pane-${id}`}
      role="tabpanel"
      aria-labelledby={`stg-tab-${id}`}
      hidden={section !== id}
      className="stg-slip card settings-card"
    >
      <div className="stg-slip__head">
        <span className="stg-slip__jp" lang="ja">{jp}</span>
        <h2 className="stg-slip__latin">{title}</h2>
        {aside && <span className="stg-slip__aside">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

// ── 音 — the two presets over the mixer ─────────────────────
// A bare row of two, no label — each button says what it does in its
// own caption, the artboard's grammar. One tap for the commute:
// 静かな通勤 zeroes the station theatre and 全部 brings it back. The
// states are read from the live volumes, so dragging a theatre slider
// yourself is reflected here instead of contradicted.
function SoundPresets({ t }) {
  const volumes = useVolumes()
  const quiet = THEATRE.every(k => volumes[k] === 0)
  const full = THEATRE.every(k => volumes[k] === DEFAULT_VOLUMES[k])

  function applyPreset(values) {
    THEATRE.forEach(k => setVolume(k, values[k]))
    playToggle()
  }

  return (
    <div className="settings-row stg-presets">
      <button
        type="button"
        className={`stg-preset${quiet ? ' stg-preset--on' : ''}`}
        aria-pressed={quiet}
        onClick={() => applyPreset({ ambiance: 0, jingle: 0, announcement: 0 })}
      >
        <span className="stg-preset__jp" lang="ja">静かな通勤</span>
        {t.soundQuietPreset}
      </button>
      <button
        type="button"
        className={`stg-preset${full ? ' stg-preset--on' : ''}`}
        aria-pressed={full}
        onClick={() => applyPreset(DEFAULT_VOLUMES)}
      >
        <span className="stg-preset__jp" lang="ja">全部</span>
        {t.soundFullPreset}
      </button>
    </div>
  )
}

// ── 学習 — the onboarding choices, revisitable ─────────────────
// Level and pace write through PATCH /api/profile/learning (which
// never touches onboarded_at — changing your level later is not
// re-onboarding), then refreshSummary() so the TopBar HUD and every
// LevelSelector's 現在地 mark learn the new value immediately. The
// placement test is the exact component the onboarding flow runs;
// here its result is an offer ("switch to N3?"), never an automatic
// write.
//
// The 窓口 round replaced both <select>s with the controls that show
// their whole range at once: the level as the wall map's own five-stop
// strip, the pace as the onboarding's 種別 ladder.
function LearningRows({ t, session }) {
  const summary = useProfileSummary()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  function save(patch) {
    setSaving(true)
    setFailed(false)
    apiJson('/api/profile/learning', session, { method: 'PATCH', body: JSON.stringify(patch) })
      .then(() => refreshSummary())
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  const currentLevel = summary?.jlptLevel ?? ''
  const currentPace = summary?.dailyNewTarget ?? ''
  const knownPace = PACES.some(p => p.perDay === currentPace)

  return (
    <>
      <div className="settings-row stg-row--wrap">
        <span className="settings-row__label">{t.settingsJlptLevel}</span>
        <div className="stg-lvlstrip" role="radiogroup" aria-label={t.settingsJlptLevel}>
          <span className="stg-lvlstrip__rail" aria-hidden="true" />
          {LEVELS.map((level, i) => (
            <span key={level} className="stg-lvlstrip__slot" style={{ '--stop-x': `${(i / (LEVELS.length - 1)) * 100}%` }}>
              <button
                type="button"
                role="radio"
                aria-checked={currentLevel === level}
                disabled={saving}
                className="stg-lvlstrip__stop"
                onClick={() => { if (currentLevel !== level) { playClick(); save({ jlptLevel: level }) } }}
              >
                <span className="stg-lvlstrip__cap">{level}</span>
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="settings-row stg-row--wrap">
        <span className="settings-row__label">{t.settingsPace}</span>
        <span className="stg-paces" role="radiogroup" aria-label={t.settingsPace}>
          {/* A pace set outside the three offered tiers (the column is
              a free integer) still shows honestly instead of nowhere. */}
          {currentPace !== '' && !knownPace && (
            <span className="stg-pace stg-pace--on" aria-hidden="true">
              <span className="stg-pace__n">{currentPace} {t.settingsPerDay}</span>
            </span>
          )}
          {PACES.map(pace => (
            <button
              key={pace.id}
              type="button"
              role="radio"
              aria-checked={currentPace === pace.perDay}
              disabled={saving}
              className={`stg-pace${currentPace === pace.perDay ? ' stg-pace--on' : ''}`}
              title={pace.recommended ? t.onbPaceRecommended : undefined}
              onClick={() => { if (currentPace !== pace.perDay) { playClick(); save({ dailyNewTarget: pace.perDay }) } }}
            >
              <span className="stg-pace__jp" lang="ja">{pace.jp}</span>
              {/* The ★ rides the figure, not the Japanese name — the
                  phone hides the kanji register and the recommended
                  mark must survive that. */}
              <span className="stg-pace__n">{pace.perDay} {t.settingsPerDay}{pace.recommended ? ' ★' : ''}</span>
            </button>
          ))}
        </span>
      </div>

      <RatingScaleRow t={t} session={session} />

      {failed && <div className="settings-row"><span className="onb-error" role="alert">{t.onbPassError}</span></div>}

      {!testing && (
        <div className="settings-row">
          <span className="settings-row__label">{t.settingsRedoDesc}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { playClick(); setTestResult(null); setTesting(true) }}
          >
            {t.onbTestRetake}
          </button>
        </div>
      )}

      {testing && <div className="settings-row settings-row--stack">
        {!testResult && (
          <PlacementTest
            session={session}
            onResult={setTestResult}
            onCancel={() => setTesting(false)}
          />
        )}

        {testResult && (
          <div className="settings-redo-result">
            <p className="onb-step__body">
              {t.onbTestResult(testResult.recommendedLevel, testResult.correct, testResult.total)}
            </p>
            <div className="settings-redo-actions">
              <button
                type="button"
                className="onb-action"
                disabled={saving}
                onClick={() => {
                  playUi('click')
                  save({ jlptLevel: testResult.recommendedLevel })
                  setTesting(false)
                }}
              >
                {t.settingsRedoApply(testResult.recommendedLevel)}
              </button>
              <button type="button" className="onb-link" onClick={() => setTesting(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>}
    </>
  )
}

// ── Which rating bar to grade with ────────────────────────────
// Four buttons or six. Both bars send the same 0..5 quality (see
// domain/ratingScales.js), so this is a choice about the control, not
// about the scheduling — which is exactly what the caption under it
// says, because a settings screen must say what a button does.
//
// The list of words is BUILT from the chosen scale rather than written
// out in the locale files: it is the bar's own words in the bar's own
// order, so it cannot drift from what the study screens draw.
function RatingScaleRow({ t, session }) {
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
  const words = ratingButtons(current, t).map(b => b.label).reverse().join(' · ')

  return (
    <>
      <div className="settings-row stg-row--wrap">
        <span className="settings-row__label">{t.settingsRatingScale}</span>
        <span className="stg-scales" role="radiogroup" aria-label={t.settingsRatingScale}>
          {RATING_SCALE_CHIPS.map(chip => (
            <button
              key={chip.id}
              type="button"
              role="radio"
              aria-checked={current === chip.id}
              disabled={saving}
              className={`stg-scale${current === chip.id ? ' stg-scale--on' : ''}`}
              onClick={() => choose(chip.id)}
            >
              <span className="stg-scale__jp" lang="ja">{chip.jp}</span>
              <span className="stg-scale__n">
                {t.settingsRatingScaleOption[chip.id] ?? RATING_SCALES[chip.id].qualities.length}
              </span>
            </button>
          ))}
        </span>
      </div>
      <div className="settings-row settings-row--stack">
        <span className="stg-scale__words">{words}</span>
        <span className="stg-scale__hint">{t.settingsRatingScaleHint}</span>
      </div>
      {failed && (
        <div className="settings-row">
          <span className="onb-error" role="alert">{t.onbPassError}</span>
        </div>
      )}
    </>
  )
}

// ── データ — the learner's data, theirs to take or erase ─────
// Export streams GET /api/profile/export (one CSV row per card and
// mode, the scheduler's own granularity). Reset fronts the
// DELETE /api/stats/reset the backend has carried since the stats
// screen was built, with no UI anywhere until this counter — behind a
// two-step confirm, with the consequences spelled out beside it,
// because a settings screen must say exactly what a button does.
function DataRows({ t, session }) {
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const [arming, setArming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetState, setResetState] = useState(null) // 'done' | 'failed' | null

  async function exportCsv() {
    setExporting(true)
    setExportFailed(false)
    try {
      const r = await apiFetch('/api/profile/export', session)
      if (!r.ok) throw new Error(String(r.status))
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nihongo-progress.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportFailed(true)
    } finally {
      setExporting(false)
    }
  }

  function reset() {
    setResetting(true)
    setResetState(null)
    apiJson('/api/stats/reset', session, { method: 'DELETE' })
      .then(() => { setResetState('done'); refreshSummary() })
      .catch(() => setResetState('failed'))
      .finally(() => { setResetting(false); setArming(false) })
  }

  return (
    <>
      <div className="settings-row">
        <span className="settings-row__label">
          {t.settingsExport}
          <span className="stg-hint">{t.settingsExportHint}</span>
        </span>
        <button type="button" className="btn-secondary" disabled={exporting} onClick={() => { playClick(); exportCsv() }}>
          {exporting ? '…' : t.settingsExportBtn}
        </button>
      </div>
      {exportFailed && <div className="settings-row"><span className="onb-error" role="alert">{t.onbPassError}</span></div>}

      <div className="settings-row settings-row--danger stg-row--wrap">
        <span className="settings-row__label">
          {t.settingsReset}
          <span className="stg-hint">{t.settingsResetHint}</span>
        </span>
        {!arming && (
          <button type="button" className="stg-danger-btn" onClick={() => { playClick(); setArming(true) }}>
            {t.settingsResetBtn}
          </button>
        )}
        {arming && (
          <span className="stg-confirm">
            <span className="stg-confirm__q" role="alert">{t.settingsResetConfirmQ}</span>
            <button type="button" className="stg-danger-btn" disabled={resetting} onClick={reset}>
              {resetting ? '…' : t.settingsResetYes}
            </button>
            <button type="button" className="btn-secondary" disabled={resetting} onClick={() => setArming(false)}>
              {t.cancel}
            </button>
          </span>
        )}
      </div>
      {resetState === 'done' && (
        <div className="settings-row"><span className="stg-done" role="status">{t.settingsResetDone}</span></div>
      )}
      {resetState === 'failed' && (
        <div className="settings-row"><span className="onb-error" role="alert">{t.onbPassError}</span></div>
      )}
    </>
  )
}
