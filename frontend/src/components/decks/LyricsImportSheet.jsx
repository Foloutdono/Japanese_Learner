import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '../chrome/Sheet'
import { Seg } from '../chrome/Console'
import { deckTypeOf } from './deckTypes'
import { ChevronIcon, SongIcon } from '../ui/Icons'
import { Dots, Loading } from '../ui/Loading'
import { apiJson, apiUpload } from '../../lib/api'
import { track } from '../../lib/track'
import { composing } from '../../lib/keyGuards'
import { parseVideoId } from '../../lib/youtube'
import { videoErrorMessage } from '../analysis/videoErrors'
import { songWords, songLines, songDeckName, lyricRows } from '../analysis/songDeck'
import { addWords, addLines } from '../analysis/songDeckApi'

// ── 歌 — a song's lyrics into a deck (plan 264) ───────────────────
// The owner (2026-10-20): the analyser's song sheet, from the shelf.
// A subtitle or lyrics file (.srt, .vtt, .ass, .lrc, .txt), lyrics
// pasted, or a YouTube link whose Japanese track the server fetches, is
// broken down into a lyrics deck: the song's words as app cards and its
// lines with their readings, as SongDeckSheet makes one.
//
// Nothing new reads the file. The sheet opens a video session, the
// analyser's own (POST /api/video/session: the parsing, the link's
// fetch and its daily allowance, the breakdown of every line), so the
// song is also on the analyser's shelf, to be read along with. A paste
// goes up as a .txt, a line a line.
//
// One step is new, and it is the reason this is not the song sheet
// again: a music video's track holds more than the song -- a spoken
// intro, the channel asking to subscribe, the credits, [音楽]. The
// session's lines are sorted (POST …/lyrics, study/lyrics_sort.py: the
// model, rationed, behind the patterns), and the learner is shown the
// two piles, the song's ticked and the rest not, to change any line
// before the deck is made. A line keeps its place when it is ticked:
// the piles are the sort's verdict, the tick is the learner's.
//
// Three steps on one sheet: the source, the wait (reading, then
// sorting), the piles with the deck's name. Then the door to the deck.
// It opens from 教材's create form, the lyrics type picked
// (screens/DecksScreen.jsx), with the name typed there if one was.

const POLL_MS = 1200
const RETRIES = 8
const RETRY_CAP_MS = 10000

// A failure that says nothing about the session (as the analyser's
// poll reads it, useAnalyzerSession.js): asked again, later each time.
function transient(e) {
  if (e?.status == null) return e?.name !== 'AbortError'
  if (e.status === 401 || e.status === 408 || e.status === 429) return true
  return e.status >= 500 && e.body?.status !== 'failed'
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const KIND_LABEL = {
  spoken: t => t.lyricsKindSpoken,
  credit: t => t.lyricsKindCredit,
  sound: t => t.lyricsKindSound,
}

function stem(filename) {
  return (filename ?? '').replace(/\.[a-z0-9]{2,4}$/i, '').trim()
}

export function LyricsImportSheet({ session, t, name: named = '', onClose, onMade }) {
  const [source, setSource] = useState('file')
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [linkFetch, setLinkFetch] = useState(null)
  // source | reading | sorting | review | made
  const [step, setStep] = useState('source')
  const [error, setError] = useState(null)
  const [sentences, setSentences] = useState([])
  const [kinds, setKinds] = useState([])
  const [sort, setSort] = useState({ sorted: true, reason: null })
  // The learner's ticks over the sort's verdict, by the line's text.
  const [ticks, setTicks] = useState({})
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState(null)
  const fileRef = useRef(null)
  // One session and one deck per press (plan 211): a ref, so two
  // presses in one frame cannot both pass; the state draws the button.
  const pressed = useRef(false)
  // The sheet closed mid-way stops its poll from writing.
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  // Whether this server fetches a link's subtitles (a paid proxy decides,
  // routes/video.py's capabilities): the link is offered either way, and
  // says so when it cannot be honoured rather than failing after a wait.
  useEffect(() => {
    apiJson('/api/video/capabilities', session)
      .then(c => { if (alive.current) setLinkFetch(Boolean(c?.linkFetch)) })
      .catch(() => { if (alive.current) setLinkFetch(false) })
  }, [session])

  const rows = useMemo(() => lyricRows(sentences, kinds), [sentences, kinds])
  const kept = useCallback(row => ticks[row.text] ?? row.kind === 'sung', [ticks])
  const sung = rows.filter(r => r.kind === 'sung')
  const rest = rows.filter(r => r.kind !== 'sung')
  const keptTexts = useMemo(() => new Set(rows.filter(kept).map(r => r.text)), [rows, kept])
  const keptSentences = useMemo(
    () => sentences.filter(s => keptTexts.has((s?.text ?? '').trim())),
    [sentences, keptTexts],
  )
  const words = useMemo(() => songWords(keptSentences), [keptSentences])
  const lines = useMemo(() => songLines(keptSentences), [keptSentences])

  const videoId = parseVideoId(url)
  const ready = {
    file: Boolean(file),
    link: Boolean(videoId) && linkFetch === true,
    paste: Boolean(pasted.trim()),
  }[source]

  async function open() {
    if (source === 'link') {
      return apiJson('/api/video/session', session, {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      })
    }
    const form = new FormData()
    form.append('file', source === 'file'
      ? file
      : new File([pasted], 'lyrics.txt', { type: 'text/plain' }))
    return apiUpload('/api/video/session', session, form)
  }

  async function poll(id) {
    for (let misses = 0; ;) {
      try {
        const data = await apiJson(`/api/video/session/${id}`, session)
        if (data.status !== 'generating' && Array.isArray(data.sentences)) return data
        misses = 0
        await wait(POLL_MS)
      } catch (e) {
        if (!transient(e) || misses >= RETRIES) throw e
        misses += 1
        await wait(Math.min(POLL_MS * 2 ** (misses - 1), RETRY_CAP_MS))
      }
      if (!alive.current) return null
    }
  }

  async function start(e) {
    e.preventDefault()
    if (!ready || step !== 'source' || pressed.current) return
    pressed.current = true
    setError(null)
    setStep('reading')
    try {
      const { sessionId } = await open()
      const data = await poll(sessionId)
      if (!data || !alive.current) return
      setStep('sorting')
      const sorted = await apiJson(`/api/video/session/${sessionId}/lyrics`, session, { method: 'POST' })
      if (!alive.current) return
      setSentences(data.sentences)
      setKinds(sorted.kinds ?? [])
      setSort({ sorted: Boolean(sorted.sorted), reason: sorted.reason ?? null })
      setTicks({})
      // The name typed in the create form; else the file's, or the
      // song's first sung line, never a [音楽].
      const sungOnly = data.sentences.filter((_, i) => (sorted.kinds?.[i] ?? 'sung') === 'sung')
      setName(named || songDeckName(source === 'file' ? stem(file?.name) : '', sungOnly))
      setStep('review')
    } catch (err) {
      if (!alive.current) return
      // Worded from the refusal's code, in the learner's language
      // (analysis/videoErrors.js), as the analyser words the same ones.
      setError(videoErrorMessage(err, t))
      setStep('source')
    } finally {
      pressed.current = false
    }
  }

  async function create(e) {
    e.preventDefault()
    if (busy || !name.trim() || (!words.length && !lines.length) || pressed.current) return
    pressed.current = true
    setBusy(true)
    setError(null)
    let deck = null
    try {
      deck = await apiJson('/api/decks', session, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type: 'lyrics' }),
      })
      await addWords(session, deck.id, words)
      if (await addLines(session, deck.id, lines)) setError(t.songDeckLimit)
      // Counts only: the song's name is the learner's own words.
      track('song_deck', { words: words.length, lines: lines.length })
      setMade(deck)
      setStep('made')
      onMade?.(deck)
    } catch (err) {
      // A deck already made stays reachable when what goes in it fails.
      if (deck) { setMade(deck); setStep('made'); onMade?.(deck) }
      setError(err?.code === 'limit_reached' ? t.songDeckLimit : t.songDeckFailed)
    } finally {
      pressed.current = false
      setBusy(false)
    }
  }

  const deckType = deckTypeOf('lyrics', t)
  const count = words.length + lines.length

  function row(r) {
    const on = kept(r)
    return (
      <label key={r.text} className={`lyr-line${on ? ' lyr-line--on' : ''}`}>
        <input
          type="checkbox"
          className="lyr-line__check"
          checked={on}
          onChange={() => setTicks(prev => ({ ...prev, [r.text]: !on }))}
        />
        <span className="lyr-line__text" lang="ja">{r.text}</span>
        {r.times > 1 && <span className="lyr-line__times">×{r.times}</span>}
        {KIND_LABEL[r.kind] && <span className="lyr-line__kind">{KIND_LABEL[r.kind](t)}</span>}
      </label>
    )
  }

  let body
  if (step === 'made' && made) {
    body = (
      <div className="surface picker anl-song__made">
        <Link to={`/learn/decks/${made.id}`} className="picker-row anl-song__deck" onClick={onClose}>
          <span className="wmap-roundel picker-row__roundel" style={{ '--line-color': deckType.color }} lang="ja" aria-hidden="true">
            {deckType.glyph}
          </span>
          <span className="picker-row__name">{made.name}</span>
          <span className="picker-row__count">{t.cardsUnit(count)}</span>
          <ChevronIcon direction="right" size={16} />
        </Link>
        {error && <p className="anl-song__error" role="alert">{error}</p>}
      </div>
    )
  } else if (step === 'reading' || step === 'sorting') {
    body = (
      <div className="lyr-wait" role="status">
        <Loading inline copy={step === 'reading' ? t.lyricsReading : t.lyricsSorting} />
      </div>
    )
  } else if (step === 'review') {
    body = (
      <form className="anl-song" onSubmit={create} noValidate>
        {!sort.sorted && (
          <p className="lyr-note" role="status">
            {sort.reason === 'over_limit' ? t.lyricsSortSpent : t.lyricsSortOff}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="lyr-note" role="status">{t.lyricsNoLines}</p>
        ) : (
          <>
            <fieldset className="lyr-pile">
              <legend className="anl-song__label">{t.lyricsSung} · {sung.length}</legend>
              {sung.map(row)}
            </fieldset>
            {rest.length > 0 && (
              <fieldset className="lyr-pile">
                <legend className="anl-song__label">{t.lyricsNotSung} · {rest.length}</legend>
                {rest.map(row)}
              </fieldset>
            )}
          </>
        )}
        <label className="anl-song__name">
          <span className="anl-song__label">{t.songDeckName}</span>
          <input
            className="field"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && composing(e)) e.preventDefault() }}
            maxLength={120}
          />
        </label>
        {error && <p className="anl-song__error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy || !name.trim() || count === 0}>
          {busy ? <>{t.songDeckMaking}<Dots /></> : t.songDeckCreate(count)}
        </button>
      </form>
    )
  } else {
    body = (
      <form className="anl-song" onSubmit={start} noValidate>
        <Seg
          full
          label={t.lyricsSource}
          value={source}
          onChange={setSource}
          options={[
            { key: 'file', label: t.lyricsFromFile },
            { key: 'link', label: t.lyricsFromLink },
            { key: 'paste', label: t.lyricsFromPaste },
          ]}
        />
        {source === 'file' && (
          <div className="lyr-source">
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              {file ? file.name : t.chooseSubtitles}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".srt,.vtt,.ass,.ssa,.lrc,.txt,text/vtt,text/plain,text/*,application/octet-stream"
              className="anl-drop__input"
              tabIndex={-1}
              aria-hidden="true"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="lyr-note">{t.subtitleAccepted}</p>
          </div>
        )}
        {source === 'link' && (
          <div className="lyr-source">
            <input
              className="field"
              type="url"
              inputMode="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label={t.lyricsFromLink}
              disabled={linkFetch === false}
            />
            {linkFetch === false && <p className="lyr-note">{t.lyricsLinkOff}</p>}
            {linkFetch && url.trim() && !videoId && <p className="lyr-note">{t.videoNotYoutube}</p>}
          </div>
        )}
        {source === 'paste' && (
          <textarea
            className="textarea"
            lang="ja"
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            placeholder={t.lyricsPastePlaceholder}
            aria-label={t.lyricsFromPaste}
            maxLength={100000}
            rows={6}
          />
        )}
        {error && <p className="anl-song__error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={!ready}>{t.lyricsStart}</button>
      </form>
    )
  }

  return (
    // The head (option A of three drawn, the owner's pick of 2026-10-20):
    // the song's icon in the analyser's roundel and the title in words,
    // where every other sheet prints a kanji and a caption.
    <Sheet
      open
      onClose={onClose}
      jp={(
        <span className="wmap-roundel lyr-sheet__badge" aria-hidden="true">
          <SongIcon size={20} />
        </span>
      )}
      cap={t.lyricsImportTitle}
      label={t.lyricsImportTitle}
      className="lyr-sheet"
      dismiss
    >
      {body}
    </Sheet>
  )
}
