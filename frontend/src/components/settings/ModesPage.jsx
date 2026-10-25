import { useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { cachedJson, invalidateCachedJson, MINE_TTL_MS } from '../../lib/cachedJson'
import { playClick, playUi } from '../../lib/audio'
import { modeLabel, modeDesc } from '../../domain/studyModes'
import { useLearnerModes, setMainMode, setExtraModes, MODE_LINES } from '../../stores/learnerModes'
import { Loading } from '../ui/Loading'
import { Emphasized } from '../ui/Emphasized'
import { Sheet } from '../chrome/Sheet'
import { Chip, Chips } from '../chrome/Console'
import { SettingsPage, Slip } from './SettingsPage'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

// A line's own name, the one its gate carries.
const LINE_TITLE = { kana: t => t.kanaTitle, vocab: t => t.brdLine.vocab, kanji: t => t.brdLine.kanji }

// ── 主 — the mode each line is ridden in (plan 273) ──────────────
// One slip a line (kana, words, kanji): its main mode as a radio of
// cards, each its name over what it asks, and under it the line's other
// modes as chips, lit when Today deals them too -- the same choice the
// line's services make on Today. Grammar is not here: its ladder climbs
// through its exercises on its own.
//
// A new main mode confirms on a sheet first, as a level does, and the
// learner chooses what it starts from: the cards mastered in the old
// one marked known in the new one, the sheet saying how many (GET
// /api/profile/modes/preview, the same arithmetic the write runs), or
// nothing carried, every card new. Nothing is deleted either way.
export function ModesPage({ session }) {
  const { t, lang } = useLang()
  const { data, failed: loadFailed } = useLearnerModes()
  const desk = useDesk()
  const onWalk = useRadioWalk(desk, { check: false })
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(null) // { line, mode, preview } while the sheet is open

  // Only the last mode pressed opens its sheet (LevelPage's rule).
  const asked = useRef(0)
  async function askMain(line, mode) {
    if (saving || mode === data?.main?.[line]) return
    playClick()
    setFailed(false)
    const ask = ++asked.current
    try {
      const preview = await cachedJson(`/api/profile/modes/preview?line=${line}&mode=${mode}`, session, { ttlMs: MINE_TTL_MS })
      if (ask === asked.current) setPending({ line, mode, preview })
    } catch {
      if (ask === asked.current) setFailed(true)
    }
  }

  function run(write) {
    setSaving(true)
    setFailed(false)
    write()
      .catch(() => setFailed(true))
      .finally(() => setSaving(false))
  }

  function confirmMain(carry) {
    const { line, mode } = pending
    setPending(null)
    // What a switch would mark is measured from the mode left behind.
    invalidateCachedJson('/api/profile/modes/preview')
    playUi('click')
    run(() => setMainMode(line, mode, session, carry))
  }

  function toggleExtra(line, mode) {
    if (saving) return
    playClick()
    const now = data.extra[line] ?? []
    const next = now.includes(mode) ? now.filter(m => m !== mode) : [...now, mode]
    run(() => setExtraModes(line, next, session))
  }

  if (!data) {
    return (
      <SettingsPage title={t.settingsModes}>
        {loadFailed ? <p className="hint" role="alert">{t.onbPassError}</p> : <Loading />}
      </SettingsPage>
    )
  }

  return (
    <SettingsPage title={t.settingsModes}>
      {MODE_LINES.map(line => {
        const title = LINE_TITLE[line](t)
        const main = data.main[line]
        const choices = data.choices.main[line] ?? []
        const extras = (data.choices.extra[line] ?? []).filter(m => m !== main)
        const added = data.extra[line] ?? []
        return (
          <Slip key={line} label={title}>
            <div className="paces mmodes" role="radiogroup" aria-label={title} onKeyDown={onWalk} data-line={line}>
              {choices.map((mode, i) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={main === mode}
                  aria-label={`${modeLabel(t, mode)}, ${modeDesc(t, mode)}`}
                  tabIndex={radioTab(desk, i, choices.indexOf(main))}
                  disabled={saving}
                  className={`pace mmode${main === mode ? ' pace--on' : ''}`}
                  data-mode={mode}
                  onClick={() => askMain(line, mode)}
                >
                  <span className="pace__name">{modeLabel(t, mode)}</span>
                  <span className="pace__desc mmode__desc">{modeDesc(t, mode)}</span>
                </button>
              ))}
            </div>
            {extras.length > 0 && (
              <Chips label={`${title} · ${t.settingsModesAlso}`} className="mmodes__also">
                <span className="mmodes__also-name">{t.settingsModesAlso}</span>
                {extras.map(mode => (
                  <Chip key={mode} on={added.includes(mode)} disabled={saving} data-mode={mode} onClick={() => toggleExtra(line, mode)}>
                    {modeLabel(t, mode)}
                  </Chip>
                ))}
              </Chips>
            )}
          </Slip>
        )
      })}
      <p className="slip__hint">{t.settingsModesHint}</p>
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}

      {pending && (
        <ModeSheet
          from={modeLabel(t, pending.preview.from ?? data.main[pending.line])}
          to={modeLabel(t, pending.mode)}
          preview={pending.preview}
          t={t}
          lang={lang}
          onConfirm={confirmMain}
          onClose={() => setPending(null)}
        />
      )}
    </SettingsPage>
  )
}

// ── The confirm sheet: the level's (LevelPage's LevelSheet), for a mode ──
// Two ways in when the old mode has something to carry: keep it (the
// gold action, and the figures say what it marks) or start from zero.
// With nothing to carry the two are one, and the sheet offers one.
function ModeSheet({ from, to, preview, t, lang, onConfirm, onClose }) {
  const weeks = preview.spreadWeeks ?? 6
  const marked = preview.markedKnown ?? 0
  const title = t.modeSwitchTitle(to)
  return (
    <Sheet open onClose={onClose} jp={title} label={title} className="lvl-sheet" initialFocus='[data-action="mode-cancel"]'>
      <p className="lvl-sheet__body">
        <Emphasized text={marked > 0 ? t.modeSwitchBody(from, to, weeks) : t.modeSwitchBodyNone(to)} strongClassName="lvl-sheet__strong" />
      </p>
      {marked > 0 && (
        <div className="lvl-sheet__figs">
          <div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v">{marked.toLocaleString(lang)}</b><span className="lvl-sheet__fig-l">{t.levelMarkedKnown}</span></div>
          <div className="lvl-sheet__fig"><b className="lvl-sheet__fig-v">{t.levelWeeks(weeks)}</b><span className="lvl-sheet__fig-l">{t.levelSpreadOver}</span></div>
        </div>
      )}
      <button type="button" className="btn-depart btn-depart--sheet" data-action="mode-confirm" onClick={() => onConfirm(true)}>
        <span className="btn-depart__jp">{marked > 0 ? t.modeSwitchKeep : t.modeSwitchGo(to)}</span>
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
      {marked > 0 && (
        <button type="button" className="btn-secondary" data-action="mode-fresh" onClick={() => onConfirm(false)}>{t.modeSwitchFresh}</button>
      )}
      <button type="button" className="btn-secondary" data-action="mode-cancel" onClick={onClose}>{t.cancel}</button>
    </Sheet>
  )
}
