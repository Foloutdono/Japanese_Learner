import { useEffect, useId, useRef, useState } from 'react'
import { formatTimecode } from '../../lib/timecode'
import { fileSeconds, MAX_SECONDS, SONG_ACCEPT } from '../../lib/songAudio'
import { PlusIcon, SongIcon } from '../ui/Icons'

// ── 歌 — the song intake (plan 315, the owner's pick S1) ────────────
// What the ♪ on the phone's entry line opens as a sheet, and the desk's
// fourth platform in its column: the song as an audio file, the lyrics
// pasted if the learner has them -- then the lines studied are theirs,
// and the song only times them -- and Transcrire. The file stays on the
// device and plays from there; the quiet line under the button says
// where its audio goes (backend study/song_transcribe.py).
//
// `onStart(file, { lyrics })` starts the session; the screen keeps the
// file for its player.
//
// `incoming` is a song dropped elsewhere on the desk's page (plan 136's
// rule: the page takes a dropped file), which the screen hands here once
// it has boarded this platform: it is picked as the button picks one.
export function IntakeSong({ t, busy, onStart, incoming = null }) {
  const fileRef = useRef(null)
  const lyricsId = useId()
  const [file, setFile] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [lyrics, setLyrics] = useState('')

  // The file picked last: a length read for one picked before it is
  // not this one's.
  const latest = useRef(null)
  function pick(next) {
    if (!next) return
    latest.current = next
    setFile(next)
    setSeconds(null)
    fileSeconds(next).then(s => { if (latest.current === next) setSeconds(s) })
  }
  const pickRef = useRef(pick)
  useEffect(() => { pickRef.current = pick })
  useEffect(() => { if (incoming) pickRef.current(incoming) }, [incoming])

  return (
    <div className="anl-uta">
      <div className="anl-uta__drop">
        {file && (
          <span className="anl-uta__picked">
            <SongIcon size={16} />
            <span className="anl-uta__file">{file.name}</span>
            {seconds != null && <span className="anl-uta__length">{formatTimecode(seconds)}</span>}
          </span>
        )}
        <button type="button" className="btn-secondary anl-uta__pick" onClick={() => fileRef.current?.click()}>
          {!file && <PlusIcon size={16} />}
          {file ? t.songChange : t.songChoose}
        </button>
        <span className="anl-uta__hint">
          {seconds != null && seconds > MAX_SECONDS ? t.songCut : t.songAccepted}
        </span>
        {/* Clipped, not display:none, as the subtitle file's input is:
            the MIME types are what a phone's picker matches on. */}
        <input
          ref={fileRef}
          type="file"
          accept={SONG_ACCEPT}
          className="anl-drop__input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      <div className="anl-uta__lyrics">
        <label htmlFor={lyricsId} className="anl-uta__label">
          {t.songLyrics}
          <small>{t.songLyricsHint}</small>
        </label>
        <textarea
          id={lyricsId}
          className="field field--page field--multi anl-uta__field"
          value={lyrics}
          onChange={e => setLyrics(e.target.value)}
          rows={4}
          maxLength={8000}
          lang="ja"
        />
      </div>
      <button
        type="button"
        className="btn-primary anl-uta__go"
        onClick={() => onStart(file, { lyrics })}
        disabled={!file || busy}
      >
        {busy ? '…' : t.songTranscribe}
      </button>
      <p className="anl-uta__quiet">{t.songPrivacy}</p>
    </div>
  )
}
