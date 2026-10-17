import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { buildPayload } from '../../lib/anki/collection'
import { SOURCES } from '../../lib/transfer/bounds'
import { refreshToday } from '../../stores/today'
import { refreshSummary } from '../../stores/profileSummary'
import { LockMark } from '../boarding/icons'
import { Seg } from '../chrome/Console'
import { ArrowIcon, PageIcon } from '../ui/Icons'
import { Emphasized } from '../ui/Emphasized'
import { Loading } from '../ui/Loading'
import { SettingsPage } from './SettingsPage'

// ── 乗換 — another app's progress, brought across (plans 243, 243b) ──
// The owner's pick B of the canvas: one transfer ticket. Its head says
// where from (Anki, WaniKani or Renshuu, the app's segmented pill) and
// where to (辻); under the perforation, the slot:
//
//   choose    Anki: the .apkg or .colpkg, read on the device (lib/anki,
//             loaded only once a file is chosen). WaniKani, Renshuu:
//             the learner's key, with which the device reads the app's
//             own API (lib/transfer); the key goes nowhere else
//   printed   the cards the course found, per line, the decks to take
//             them from, and on the stub what the import does: the
//             overdue spread, those studied here kept, those past the
//             level held, the check at each card's first answer
//   punched   written, 済 pressed on the ticket
//
// The server (routes/transfer.py) is asked twice, for the preview and
// the import, with only the matched notes' short Japanese fields and
// schedules. While imported cards still wait for that first answer,
// the way back: they are taken back and the level's own assumptions
// seeded again.

const KEYED = { wanikani: () => import('../../lib/transfer/wanikani.js'), renshuu: () => import('../../lib/transfer/renshuu.js') }
const LINES = ['vocab', 'kanji', 'kana']

export function TransferPage({ session }) {
  const { t } = useLang()
  const fileRef = useRef(null)
  const asked = useRef(0)
  const [source, setSource] = useState('anki')
  const [phase, setPhase] = useState('choose') // choose | reading | checking | printed | importing | punched
  const [key, setKey] = useState('')
  const [pages, setPages] = useState(0)
  const [fileName, setFileName] = useState(null)
  const [collection, setCollection] = useState(null)
  const [chosen, setChosen] = useState([])
  const [payload, setPayload] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)
  const [waiting, setWaiting] = useState(0)
  const [arming, setArming] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [undone, setUndone] = useState(null)

  useEffect(() => {
    let live = true
    apiJson('/api/transfer', session)
      .then(data => { if (live) setWaiting(data.waiting) })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  function restart() {
    asked.current++
    setPhase('choose')
    setCollection(null)
    setPayload(null)
    setPreview(null)
    setResult(null)
    setFileName(null)
    setMissing(false)
    setError(null)
  }

  function pick(next) {
    playClick()
    restart()
    setKey('')
    setSource(next)
  }

  // The preview of the decks chosen, the latest asked for winning: a
  // deck toggled twice quickly never prints the first answer second.
  async function check(opened, decks) {
    const built = buildPayload(opened, decks)
    if (built.over) { setError('tooMany'); setPhase(p => (p === 'checking' ? 'choose' : p)); return }
    const turn = ++asked.current
    setError(null)
    try {
      const body = await apiJson('/api/transfer/preview', session, {
        method: 'POST', body: JSON.stringify({ source, notes: built.body.notes }),
      })
      if (turn !== asked.current) return
      setPayload(built)
      setPreview(body)
      setPhase('printed')
    } catch (e) {
      if (turn !== asked.current) return
      setError(e?.status === 413 ? 'tooMany' : 'server')
      setPhase(p => (p === 'checking' ? 'choose' : p))
    }
  }

  // A read the learner left (another source picked, Recommencer) ends
  // unheard: the turn it was started on is no longer the page's.
  async function read(open) {
    const turn = ++asked.current
    setPhase('reading')
    setError(null)
    setPages(0)
    try {
      const opened = await open()
      if (turn !== asked.current) return false
      const decks = opened.decks.map(d => d.id)
      setCollection(opened)
      setChosen(decks)
      setPhase('checking')
      await check(opened, decks)
      return true
    } catch (e) {
      if (turn !== asked.current) return false
      setError(e?.code ?? (source === 'anki' ? 'unreadable' : 'unreachable'))
      setPhase('choose')
      return false
    }
  }

  async function readFile(file) {
    if (!file) return
    setFileName(file.name)
    await read(async () => {
      const reader = await import('../../lib/anki/index.js')
      return reader.readAnkiFile(file, { wasmUrl })
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  async function readKey(e) {
    e.preventDefault()
    if (!key.trim() || phase === 'reading') return
    playClick()
    const ok = await read(async () => {
      const mod = await KEYED[source]()
      const readApp = source === 'wanikani' ? mod.readWaniKani : mod.readRenshuu
      return readApp(key, { onProgress: setPages })
    })
    // Read once, the key is let go: nothing on the page holds it.
    if (ok) setKey('')
  }

  function toggle(id) {
    const on = chosen.includes(id)
    if (on && chosen.length === 1) return
    playClick()
    const next = on ? chosen.filter(x => x !== id) : [...chosen, id]
    setChosen(next)
    check(collection, next)
  }

  async function punch() {
    if (phase !== 'printed' || !payload) return
    playClick()
    setPhase('importing')
    setError(null)
    try {
      const body = await apiJson('/api/transfer/import', session, {
        method: 'POST', body: JSON.stringify({ source, notes: payload.body.notes }),
      })
      setResult(body)
      setWaiting(body.waiting)
      setPhase('punched')
      refreshToday()
      refreshSummary()
    } catch (e) {
      setError(e?.status === 413 ? 'tooMany' : 'server')
      setPhase('printed')
    }
  }

  async function undo() {
    setUndoing(true)
    setError(null)
    try {
      const body = await apiJson('/api/transfer', session, { method: 'DELETE' })
      // The punched ticket no longer holds: back to a blank one.
      if (phase === 'punched') restart()
      setWaiting(body.waiting)
      setUndone(body.removed)
      refreshToday()
      refreshSummary()
    } catch {
      setError('server')
    } finally {
      setUndoing(false)
      setArming(false)
    }
  }

  const printed = (phase === 'printed' || phase === 'importing') && preview
  const punched = phase === 'punched' && result
  const routed = printed || punched
  const levels = preview ? Object.keys(preview.byLevel).filter(l => preview.byLevel[l] > 0) : []
  // The note types the words were read from, by the names the file
  // gives them: what to look at when fewer cards come back than hoped.
  const readFrom = source === 'anki' && preview && payload
    ? preview.types
      .filter(tm => tm.field != null)
      .map(tm => {
        const type = collection.types[payload.mids[tm.type]]
        return type?.name ? `${type.name} › ${type.fields[tm.field] ?? tm.field + 1}` : null
      })
      .filter(Boolean)
    : []
  const named = source === 'anki' && collection && collection.decks.length > 1
  const keyed = source !== 'anki'

  return (
    <SettingsPage title={t.settingsTransfer}>
      <section className="tr-ticket" aria-label={t.trTicketLabel} data-phase={phase}>
        <div className="tr-ticket__head">
          <span className="tr-cap">{t.trCap}</span>
          <span className="tr-ticket__jp" lang="ja">乗換券</span>
        </div>

        {routed ? (
          <div className="tr-ticket__route">
            <div className="tr-stop">
              <span className="tr-cap">{t.trFrom}</span>
              <b className="tr-stop__name">{t.trSource[source]}</b>
              {fileName && <span className="tr-stop__sub">{fileName}</span>}
            </div>
            <ArrowIcon direction="right" size={24} className="tr-arrow" />
            <div className="tr-stop tr-stop--to">
              <span className="tr-cap">{t.trTo}</span>
              <b className="tr-stop__name tr-stop__name--jp" lang="ja">辻</b>
              {levels.length > 0 && <span className="tr-stop__sub">{levels.join(' · ')}</span>}
            </div>
          </div>
        ) : (
          <div className="tr-ticket__from">
            <span className="tr-cap" aria-hidden="true">{t.trFrom}</span>
            <Seg
              full
              label={t.trFrom}
              value={source}
              onChange={pick}
              options={SOURCES.map(s => ({ key: s, label: t.trSource[s] }))}
            />
          </div>
        )}

        <div className="tr-perf" aria-hidden="true" />

        {(phase === 'choose' || phase === 'reading' || phase === 'checking') && (
          <div className="tr-slot tr-slot--center">
            {phase !== 'choose' ? (
              <Loading tight copy={phase === 'reading' && pages > 0 ? t.trPages(pages) : null} />
            ) : keyed ? (
              <form className="tr-key" onSubmit={readKey}>
                <label className="tr-key" htmlFor="tr-key">
                  <span className="tr-slot__hint">{t.trKeyLabel[source]}</span>
                  <input
                    id="tr-key"
                    className="field field--panel"
                    type="text"
                    value={key}
                    placeholder={t.trKeyPlaceholder[source]}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={e => setKey(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn-primary" data-action="transfer-read" disabled={!key.trim()}>
                  {t.trReadKey[source]}
                </button>
              </form>
            ) : (
              <>
                <PageIcon size={36} className="tr-slot__icon" />
                <span className="tr-slot__hint"><Emphasized text={t.trFileHint} /></span>
                <button
                  type="button"
                  className="btn-primary"
                  data-action="transfer-choose"
                  onClick={() => { playClick(); fileRef.current?.click() }}
                >
                  {t.trChooseFile}
                </button>
              </>
            )}
          </div>
        )}

        {printed && (
          <>
            <div className="tr-slot">
              <div className="tr-figure">
                <span className="tr-figure__n" data-figure="cards">{preview.cards.toLocaleString()}</span>
                <span className="tr-figure__unit">{t.trFound(preview.cards)}</span>
              </div>
              {preview.cards > 0 && (
                <div className="tr-lines">
                  {LINES.filter(l => preview.bySource[l]).map(l => (
                    <span key={l} className="tr-line" data-line={l}>
                      {t.trLine[l]} <b>{preview.bySource[l].toLocaleString()}</b>
                    </span>
                  ))}
                </div>
              )}
              {named && (
                <div className="tr-decks" role="group" aria-label={t.trDecks}>
                  {collection.decks.map(deck => {
                    const on = chosen.includes(deck.id)
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        className={`tr-deck${on ? ' tr-deck--on' : ''}`}
                        data-deck={deck.id}
                        disabled={phase === 'importing'}
                        onClick={() => toggle(deck.id)}
                      >
                        {on && '✓ '}{deck.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="tr-perf" aria-hidden="true" />
            <div className="tr-stub">
              {preview.write > 0 ? (
                <>
                  <span className="tr-stub__note">
                    {[
                      preview.dueNow > 0 && t.trDue(preview.dueNow, preview.spreadWeeks),
                      preview.kept > 0 && t.trKept(preview.kept),
                      preview.above > 0 && t.trAbove(preview.above),
                      t.trCheck,
                    ].filter(Boolean).join(' ')}
                  </span>
                  <button type="button" className="btn-primary" data-action="transfer-punch" disabled={phase === 'importing'} onClick={punch}>
                    {phase === 'importing' ? '…' : t.trPunch}
                  </button>
                </>
              ) : (
                <span className="tr-stub__note" role="status">{preview.cards ? t.trAllKept : t.trNone}</span>
              )}
            </div>
          </>
        )}

        {punched && (
          <>
            <div className="tr-slot" role="status">
              <div className="tr-punched">
                <div className="tr-figure">
                  <span className="tr-figure__n" data-figure="written">{result.written.toLocaleString()}</span>
                  <span className="tr-figure__unit">{t.trImported(result.written)}</span>
                </div>
                <span className="tr-stamp" role="img" aria-label={t.trPunched} lang="ja">済</span>
              </div>
              <span className="tr-slot__hint">{t.trImportedHint}</span>
            </div>
          </>
        )}
      </section>

      <input
        ref={fileRef}
        type="file"
        accept=".apkg,.colpkg,application/zip,application/octet-stream"
        className="tr-file"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => readFile(e.target.files?.[0])}
      />

      {error && <p className="tr-note" role="alert">{t.trErr[error] ?? t.trErr.server}</p>}

      {phase === 'choose' && (
        <details className="tr-how" key={source}>
          <summary>{t.trHowQ[source]}</summary>
          <ol>
            {t.trHow[source].map((step, i) => (
              <li key={step}>
                <span className="tr-how__no">{i + 1}</span>
                <span><Emphasized text={step} /></span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {printed && preview.unmatched > 0 && (
        <div className="tr-confirm">
          <button type="button" className="slip__more tr-quiet" aria-expanded={missing} onClick={() => setMissing(m => !m)}>
            {t.trMissing(preview.unmatched)}
          </button>
          {missing && (
            <p className="tr-note">
              {preview.sample.length > 0 && t.trMissingSample(preview.sample.join('、'))}
              {readFrom.length > 0 && <> {t.trReadFrom(readFrom.join(', '))}</>}
            </p>
          )}
        </div>
      )}
      {printed && (
        <button type="button" className="slip__more tr-quiet" data-action="transfer-restart" onClick={() => { playClick(); restart() }}>
          {t.trRestart}
        </button>
      )}

      {punched && (
        <Link to="/today" className="btn-primary tr-go" data-action="transfer-today">{t.trGoToday}</Link>
      )}

      {waiting > 0 && !printed && (
        <div className="tr-confirm">
          {!punched && <p className="tr-note">{t.trWaiting(waiting)}</p>}
          {!arming ? (
            <button type="button" className="slip__more tr-quiet" data-action="transfer-undo" onClick={() => { playClick(); setArming(true) }}>
              {t.trUndo}
            </button>
          ) : (
            <>
              <p className="tr-note" role="alert">{t.trUndoConfirmQ}</p>
              <div className="form__row">
                <button type="button" className="btn-primary btn-primary--danger" data-action="transfer-undo-confirm" disabled={undoing} onClick={undo}>
                  {undoing ? '…' : t.trUndoYes}
                </button>
                <button type="button" className="btn-secondary" disabled={undoing} onClick={() => setArming(false)}>
                  {t.cancel}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {undone != null && waiting === 0 && <p className="tr-note" role="status">{t.trUndone(undone)}</p>}

      <p className="tr-foot">
        <LockMark />
        <span>{keyed ? t.trPrivacyKey(t.trSource[source]) : t.trPrivacyFile}</span>
      </p>
    </SettingsPage>
  )
}
