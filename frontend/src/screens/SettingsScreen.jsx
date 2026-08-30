import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { supabase } from '../lib/supabase'
import { apiJson } from '../lib/api'
import { playClick, playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { MuteButton, ThemeToggle, LangSwitcher, SoundMixer } from '../components/ui/NavControls'
import { useProfileSummary, refreshSummary } from '../stores/profileSummary'
import PlacementTest from '../components/onboarding/PlacementTest'
import { PACES } from '../components/onboarding/paces'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function SettingsScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()


  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.settings} autoHide />

      <main id="main-content" className="container settings-container">
        {/* Settings.dc.html splits the environment into three named
            sections and lays them out two-up: 表示 and 言語 stacked in a
            320px column, 音 beside them taking the rest. It was one
            undifferentiated 環境設定 card in a 640px column, so the
            mixer -- eight rows, the densest control in the app -- was
            squeezed into half the width it wants while the two
            one-line settings each had a row to themselves. */}
        <div className="settings-env">
          <div className="settings-env__side">
            <section className="settings-sec">
              <SectionHeader jp="表示" title={t.theme} />
              <div className="card settings-card settings-card--pad">
                <ThemeToggle />
              </div>
            </section>

            <section className="settings-sec">
              <SectionHeader jp="言語" title={t.language} />
              <div className="card settings-card settings-card--pad">
                <LangSwitcher />
              </div>
            </section>
          </div>

          <section className="settings-sec">
            <SectionHeader jp="音" title={t.sound} />
            <div className="card settings-card">
              <div className="settings-row">
                <span className="settings-row__label">{t.sound}</span>
                <MuteButton />
              </div>
              <div className="settings-row settings-row--stack">
                <SoundMixer />
              </div>
            </div>
          </section>
        </div>

        <SectionHeader jp="学習" title={t.settingsLearning} />
        <LearningCard t={t} session={session} />

        <SectionHeader jp="会員" title={t.account} />
        <div className="card settings-card">
          <div className="settings-row settings-row--danger">
            <span className="settings-row__label">{t.signOutDesc}</span>
            <button type="button" className="btn-primary settings-signout" onClick={() => supabase.auth.signOut()}>
              {t.signOut}
            </button>
          </div>
        </div>
      </main>
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
// The controls deliberately speak this PAGE's language, not the
// onboarding's: the same label-left / compact-select-right rows the
// Son/Thème/Langue card above uses (`.lang-select`, the exact classes
// LangSwitcher wears three rows up), and the retake row mirrors the
// Sign-out row below it. A first version imported the office's
// segmented buttons and accent frame here and read as a different
// app grafted into Settings.
function LearningCard({ t, session }) {
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
    <div className="card settings-card">
      <div className="settings-row">
        <span className="settings-row__label">{t.settingsJlptLevel}</span>
        <select
          className="lang-select"
          value={currentLevel}
          disabled={saving}
          aria-label={t.settingsJlptLevel}
          onChange={e => { playClick(); save({ jlptLevel: e.target.value }) }}
        >
          {currentLevel === '' && <option value="" disabled>—</option>}
          {LEVELS.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      <div className="settings-row">
        <span className="settings-row__label">{t.settingsPace}</span>
        <select
          className="lang-select"
          value={String(currentPace)}
          disabled={saving}
          aria-label={t.settingsPace}
          onChange={e => { playClick(); save({ dailyNewTarget: Number(e.target.value) }) }}
        >
          {currentPace === '' && <option value="" disabled>—</option>}
          {/* A pace set outside the three offered tiers (the column is
              a free integer) still shows honestly instead of blank. */}
          {currentPace !== '' && !knownPace && (
            <option value={String(currentPace)} disabled>{currentPace}</option>
          )}
          {PACES.map(pace => (
            <option key={pace.id} value={String(pace.perDay)}>{`${pace.jp} · ${pace.perDay}`}</option>
          ))}
        </select>
      </div>

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
    </div>
  )
}
