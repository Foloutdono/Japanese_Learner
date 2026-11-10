import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { formatTimecode } from '../../lib/timecode'

// ── 歌詞 — the Passage read as lyrics, the picture folded away (plan 316) ──
// The owner's picks of the canvas "Tsuji analyser — the video hidden,
// the lines as lyrics": with the picture folded away (the phone's pull
// under it, V2; the desk's fold on its bar) the room it leaves holds the
// whole Passage, line under line, as a song's lyrics are shown. Each
// line stands over its translation (C); the one in focus is drawn as
// the subtitle it is -- its readings, its rules, its grammar, its words
// lit as they are said -- and the others in the panel's quieter ink,
// each a press that plays the video from it. On the desk (D2) the lyrics
// take the route map's column too, each line's time before it.
//
// The line in focus is held a third of the way down the list as the
// video moves on, the lines just sung over it and more of what is to
// come under it -- inside the list's own box and nowhere else: a
// scrollIntoView walks every scrollable ancestor up to the page
// (PassageLine's lesson). The first lines and the last sit where the
// box's ends leave them.
//
// The line in focus is `children`: the screen draws it, holding what it
// needs (the clock, the word pressed, the point lit). The other lines
// are the pointer's way to a line, out of the Tab order: ↑/↓ walk the
// lines from the keyboard, as they walk the route map's stops.
// `translationOf(sentence, index)` is a line's translation, '' while it
// has none; `showTranslations` false prints none (the phone's Affichage
// sheet); `times` prints each line's time before it (the desk).
// Any other prop lands on the list (the display's data-* switches).
const HOLD = 1 / 3

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function Lyrics({
  sentences, focusIndex, translationOf, showTranslations = true, times = false,
  onPlay, t, lang, className = '', children, ...rest
}) {
  const listRef = useRef(null)
  // Each line's translation, '' for none: they come a block of lines at
  // a time (useLineTranslations), and the lines over the one in focus
  // grow when theirs land.
  const trs = sentences.map((s, i) => (showTranslations ? translationOf(s, i) : ''))
  const trKey = trs.join('\u0000')

  const place = useCallback(behavior => {
    const box = listRef.current
    const now = box?.querySelector('.anl-lyrics__now')
    if (!now) return
    const delta = (now.getBoundingClientRect().top - box.getBoundingClientRect().top) - box.clientHeight * HOLD
    if (Math.abs(delta) < 1) return
    box.scrollTo({ top: box.scrollTop + delta, behavior })
  }, [])

  // Opened where the line is, never gliding there from the top.
  useLayoutEffect(() => { place('auto') }, [place])
  // A new line glides in, or jumps where motion is reduced; so does the
  // line pushed down by the translations landing over it.
  useEffect(() => {
    place(reducedMotion() ? 'auto' : 'smooth')
  }, [focusIndex, trKey, place])
  // A new height for the box (a phone turned, a sheet's room given
  // back) holds the line where it was held.
  useEffect(() => {
    const box = listRef.current
    if (!box || typeof ResizeObserver === 'undefined') return undefined
    let height = box.clientHeight
    const observer = new ResizeObserver(() => {
      if (box.clientHeight === height) return
      height = box.clientHeight
      place('auto')
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [place])

  return (
    <div
      ref={listRef}
      className={`anl-lyrics${times ? ' anl-lyrics--timed' : ''}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t.lyricsLines(sentences.length)}
      {...rest}
    >
      {sentences.map((s, i) => {
        const time = times && s.cue_start != null && (
          <span className="anl-lyrics__time" aria-hidden="true">{formatTimecode(s.cue_start)}</span>
        )
        if (i === focusIndex) {
          return (
            <div key={i} className="anl-lyrics__now" aria-current="true">
              {time}
              <div className="anl-lyrics__body">{children}</div>
            </div>
          )
        }
        const tr = trs[i]
        return (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            className="anl-lyrics__line"
            onClick={() => onPlay(i)}
            aria-label={[s.text, tr, t.playFromLine].filter(Boolean).join(' — ')}
          >
            {time}
            <span className="anl-lyrics__body">
              <span className="anl-lyrics__jp" lang={s.foreign ? undefined : 'ja'}>{s.text}</span>
              {tr && <span className="anl-lyrics__tr" lang={lang}>{tr}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
