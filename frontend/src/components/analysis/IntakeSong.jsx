import { useEffect, useId, useRef, useState } from 'react'
import { formatTimecode } from '../../lib/timecode'
import { fileSeconds, MAX_SECONDS, SONG_ACCEPT, songKind } from '../../lib/songAudio'
import { PlusIcon, SongIcon } from '../ui/Icons'

// ── 歌 — the song intake (plan 317, the owner's pick S1) ────────────
// What the ♪ of the phone's ways in opens as a sheet, and the desk's
// fourth platform in its column. Drawn again by plan 317b (the owner's
// pick L2): before a song, the one button that picks it and what it
// takes; once picked, the song as one row -- its mark, its name over its
// length and kind, Changer at its end -- then the lyrics, if the learner
// has them, three lines tall with what they are for as their
// placeholder (pasted, they are the lines studied and the song only
// times them), and Transcrire. The two quiet lines under it say where
// the audio goes and where the song stays (backend
// study/song_transcribe.py).
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

  const choose = () => fileRef.current?.click()
  const meta = [seconds != null ? formatTimecode(seconds) : null, songKind(file?.name)].filter(Boolean).join(' · ')

  return (
    <div className="anl-uta">
      {file ? (
        <div className="anl-uta__file">
          <span className="anl-uta__mark" aria-hidden="true"><SongIcon size={18} /></span>
          <span className="anl-uta__name">
            <b>{file.name}</b>
            {meta && <span>{meta}</span>}
          </span>
          <button type="button" className="anl-vlink anl-uta__change" onClick={choose}>{t.songChange}</button>
        </div>
      ) : (
        <button type="button" className="btn-secondary anl-uta__pick" onClick={choose}>
          <PlusIcon size={16} />
          {t.songChoose}
        </button>
      )}
      {(!file || (seconds != null && seconds > MAX_SECONDS)) && (
        <span className="anl-uta__hint">{file ? t.songCut : t.songAccepted}</span>
      )}
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
      {file && (
        <div className="anl-uta__lyrics">
          <label htmlFor={lyricsId} className="anl-uta__label">
            {t.songLyrics}
            <small>{t.songLyricsOptional}</small>
          </label>
          <textarea
            id={lyricsId}
            className="field field--page field--multi anl-uta__field"
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            placeholder={t.songLyricsHint}
            rows={3}
            maxLength={8000}
            lang="ja"
          />
        </div>
      )}
      <button
        type="button"
        className="btn-primary anl-uta__go"
        onClick={() => onStart(file, { lyrics })}
        disabled={!file || busy}
      >
        {busy ? '…' : t.songTranscribe}
      </button>
      <p className="anl-uta__quiet">
        <span>{t.songPrivacy}</span>
        <span>{t.songStays}</span>
      </p>
    </div>
  )
}
