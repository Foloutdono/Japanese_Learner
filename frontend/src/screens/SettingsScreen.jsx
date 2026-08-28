import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { supabase } from '../lib/supabase'
import { apiJson } from '../lib/api'
import { playUi } from '../lib/audio'
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
        <SectionHeader jp="環境設定" title={t.preferences} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.sound}</span>
            <MuteButton />
          </div>
          <div className="settings-row settings-row--stack">
            <SoundMixer />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">{t.theme}</span>
            <ThemeToggle />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">{t.language}</span>
            <LangSwitcher />
          </div>
        </div>

        <SectionHeader jp="学習" title={t.settingsLearning} />
        <LearningCard t={t} session={session} />

        <SectionHeader jp="会員" title={t.account} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.signOutDesc}</span>
            <button type="button" className="btn-ghost settings-signout" onClick={() => supabase.auth.signOut()}>
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

  const currentLevel = summary?.jlptLevel ?? null
  const currentPace = summary?.dailyNewTarget ?? null

  return (
    <div className="card settings-card">
      <div className="settings-row">
        <span className="settings-row__label">{t.settingsJlptLevel}</span>
        {/* Flat sibling buttons — never nested controls. */}
        <div className="onb-seg settings-seg" role="group" aria-label={t.settingsJlptLevel}>
          {LEVELS.map(level => (
            <button
              key={level}
              type="button"
              className={['onb-seg__btn', level === currentLevel && 'onb-seg__btn--on'].filter(Boolean).join(' ')}
              aria-pressed={level === currentLevel}
              disabled={saving}
              onClick={() => { playUi('click-mode-selection'); save({ jlptLevel: level }) }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-row__label">{t.settingsPace}</span>
        <div className="onb-seg settings-seg" role="group" aria-label={t.settingsPace}>
          {PACES.map(pace => (
            <button
              key={pace.id}
              type="button"
              className={['onb-seg__btn', pace.perDay === currentPace && 'onb-seg__btn--on'].filter(Boolean).join(' ')}
              aria-pressed={pace.perDay === currentPace}
              disabled={saving}
              onClick={() => { playUi('click-mode-selection'); save({ dailyNewTarget: pace.perDay }) }}
            >
              <span lang="ja">{pace.jp}</span> {pace.perDay}
            </button>
          ))}
        </div>
      </div>

      {failed && <div className="settings-row"><span className="onb-error" role="alert">{t.onbPassError}</span></div>}

      <div className="settings-row settings-row--stack">
        {!testing && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { playUi('click'); setTestResult(null); setTesting(true) }}
          >
            {t.settingsRedoPlacement}
          </button>
        )}

        {testing && !testResult && (
          <PlacementTest
            session={session}
            onResult={setTestResult}
            onCancel={() => setTesting(false)}
          />
        )}

        {testing && testResult && (
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
      </div>
    </div>
  )
}
