import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { cachedJson, invalidateCachedJson, MINE_TTL_MS } from '../../lib/cachedJson'
import { playClick, playUi } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { refreshToday } from '../../stores/today'
import { useLearningSave } from '../settings/learningSave'
import { LevelSheet } from '../settings/LevelPage'
import { ChevronIcon } from '../ui/Icons'

// ── 乗り越し — the level that does not fit (plan 221, the owner's D) ──
// A level chosen at the boarding is the learner's word, and the stops
// behind it are marked known on it. The answers say whether the word
// was right (GET /api/profile/level-fit, study/level_fit.py): a stop
// behind the level whose checks mostly fail is where the learner
// stands, and a level whose new words are known the first time they
// are asked is behind them already. Either is said here, one quiet row
// over the gate's own, and its figures; a tap opens the confirm sheet
// Settings' level page opens, so the move is the same move with the
// same figures (a move down gives the cards it never asked back as new).
//
// Stay is an answer: the row keeps out of the way on this device until
// the answers point somewhere else (a different stop, or a different
// level to start from). Nothing moves the level but the learner.
const STAYED_KEY = 'jp-level-fit-stay'

function stayedOn() {
  try { return localStorage.getItem(STAYED_KEY) } catch { return null }
}

function rememberStay(key) {
  try { localStorage.setItem(STAYED_KEY, key) } catch { /* private mode */ }
}

export default function LevelFitLine({ session }) {
  const { t, lang } = useLang()
  const [fit, setFit] = useState(null)
  const [stayed, setStayed] = useState(stayedOn)
  const [preview, setPreview] = useState(null)
  const { save, saving } = useLearningSave(session)

  useEffect(() => {
    if (!session) return undefined
    let live = true
    cachedJson('/api/profile/level-fit', session, { ttlMs: MINE_TTL_MS })
      .then(body => { if (live) setFit(body) })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  const key = fit?.suggest ? `${fit.level}>${fit.to}` : null
  if (!key || key === stayed) return null

  const down = fit.suggest === 'down'
  const check = down ? fit.checks?.find(c => c.level === fit.to) : null
  const what = down
    ? t.fitDown(fit.to, check?.passed ?? 0, check?.answered ?? 0)
    : t.fitUp(fit.level, fit.words?.known ?? 0, fit.words?.met ?? 0)

  function open() {
    if (saving) return
    playClick()
    countUse('level_fit', 'open')
    cachedJson(`/api/profile/learning/preview?jlptLevel=${fit.to}`, session, { ttlMs: MINE_TTL_MS })
      .then(setPreview)
      .catch(() => {})
  }

  function stay() {
    setPreview(null)
    countUse('level_fit', 'stay')
    rememberStay(key)
    setStayed(key)
  }

  async function move() {
    setPreview(null)
    playUi('click')
    countUse('level_fit', 'move')
    await save({ jlptLevel: fit.to })
    // What the move changed: the day's cards, the next preview, and the
    // fit itself, read again from the level just taken.
    invalidateCachedJson('/api/profile/learning/preview')
    invalidateCachedJson('/api/profile/level-fit')
    refreshToday()
    setFit(null)
  }

  return (
    <>
      <button
        type="button"
        className={`tdy-door tdy-fit tdy-fit--${fit.suggest}`}
        onClick={open}
        aria-haspopup="dialog"
        disabled={saving}
        data-action="level-fit"
      >
        <span className="tdy-fit__ring" aria-hidden="true" />
        <span className="tdy-door__what">{what}</span>
        <span className="tdy-door__go">
          {down ? t.fitDownGo(fit.to) : t.fitUpGo(fit.to)}
          <ChevronIcon direction="right" size={16} />
        </span>
      </button>
      {preview && (
        <LevelSheet
          from={fit.level}
          to={fit.to}
          preview={preview}
          t={t}
          lang={lang}
          onConfirm={move}
          onClose={() => setPreview(null)}
          onStay={stay}
        />
      )}
    </>
  )
}
