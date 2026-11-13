import { useEffect, useState } from 'react'
import { cachedJson, MINE_TTL_MS } from '../../lib/cachedJson'
import { ChevronIcon, VideoIcon } from '../ui/Icons'
import { Dots } from '../ui/Loading'
import { VideoStill } from './VideoStill'

// ── 図書館 — the public library of analysed videos (plan 322) ──
// Every YouTube video a learner's link has been analysed from, once, for
// everybody (backend routes/video_library.py): open one and it is read
// at once, its breakdown ready, with no fetch and none of the link
// allowance. These videos are no longer on the shelf above and do not
// count toward its thirty.
//
// The owner's pick B of three drawn directions, "just the pictures"
// (canvas "Tsuji video library — simpler"): a title with one picker
// beside it (all kinds, the learner's own, then the kinds the library
// holds), then a grid of the videos' stills, each with its first line
// and nothing else -- no counts, no order, no dates. Two columns on a
// phone, four in the desk's column, from one rule. The kinds are sorted
// by a model once, when a video joins; one it has not sorted yet is
// under "All kinds" alone.

const PAGE = 24

function pathFor(filter, offset) {
  const q = [`limit=${PAGE}`, `offset=${offset}`]
  if (filter === 'mine') q.push('mine=true')
  else if (filter !== 'all') q.push(`category=${encodeURIComponent(filter)}`)
  return `/api/video/library?${q.join('&')}`
}

// The answer as the page reads it. A body that is not the library's
// (no list of videos) is a failure, never a crash.
function readAnswer(body) {
  if (!Array.isArray(body?.videos)) throw new Error('not a library')
  return { videos: body.videos, total: body.total ?? body.videos.length, counts: body.counts ?? null }
}

export function VideoLibrary({ t, session, onOpen }) {
  const [filter, setFilter] = useState('all')
  const [attempt, setAttempt] = useState(0)
  // The last answer, and the request it answers (`key`): while the
  // request now asked is not the one answered, the page is loading, and
  // the last answer's videos stay meanwhile, so it does not blink to
  // nothing at every pick.
  const [state, setState] = useState({ key: null, failed: false, videos: [], total: 0, counts: null })
  const [more, setMore] = useState(false)
  const userId = session?.user?.id
  const key = `${userId} ${attempt} ${pathFor(filter, 0)}`

  useEffect(() => {
    let live = true
    cachedJson(pathFor(filter, 0), session, { ttlMs: MINE_TTL_MS })
      .then(body => { const a = readAnswer(body); if (live) setState({ key, failed: false, ...a }) })
      .catch(() => { if (live) setState(s => ({ ...s, key, failed: true })) })
    return () => { live = false }
    // The answer is the learner's and the path's: nothing else asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function showMore() {
    if (more) return
    setMore(true)
    try {
      const next = readAnswer(await cachedJson(pathFor(filter, state.videos.length), session, { ttlMs: MINE_TTL_MS }))
      setState(s => ({
        ...s,
        videos: [...s.videos, ...next.videos.filter(v => !s.videos.some(x => x.videoId === v.videoId))],
        total: next.total,
        counts: next.counts,
      }))
    } catch {
      setState(s => ({ ...s, failed: true }))
    } finally {
      setMore(false)
    }
  }

  // The picker offers what the library holds: every kind with a video
  // in it, and the learner's own once they have one. The pick stands
  // while its kind empties, so the list never jumps under the learner.
  const counts = state.counts
  const options = [
    { key: 'all', label: t.vlibAllKinds },
    ...(counts?.mine > 0 || filter === 'mine' ? [{ key: 'mine', label: t.vlibMine }] : []),
    ...Object.keys(t.vlibKinds)
      .filter(k => counts?.[k] > 0 || filter === k)
      .map(k => ({ key: k, label: t.vlibKinds[k] })),
  ]
  const loading = state.key !== key
  const failed = state.failed && !loading
  const empty = !loading && !failed && state.videos.length === 0
  const canMore = state.videos.length < state.total
  const anything = (counts?.all ?? 0) > 0

  return (
    <section className="anl-lib" aria-label={t.vlibTitle} aria-busy={loading}>
      <header className="anl-lib__head">
        <h2 className="anl-lib__title">{t.vlibTitle}</h2>
        {anything && (
          <label className="anl-lib__kind">
            <span className="sr-only">{t.vlibKind}</span>
            <select className="anl-lib__select" value={filter} onChange={e => setFilter(e.target.value)}>
              {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <ChevronIcon direction="down" size={14} className="anl-lib__chev" />
          </label>
        )}
      </header>
      {failed && (
        <p className="hint" role="alert">
          {t.vlibError}{' '}
          <button type="button" className="btn-secondary" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>
        </p>
      )}
      {loading && state.videos.length === 0 && <p className="hint" role="status"><Dots /></p>}
      {empty && <p className="anl-shelf__empty">{filter === 'mine' ? t.vlibEmptyMine : t.vlibEmpty}</p>}
      {state.videos.length > 0 && (
        <ul className="anl-lib__grid">
          {state.videos.map(v => (
            <li key={v.videoId}>
              <button type="button" className="anl-lib__item" onClick={() => onOpen(v)}>
                <span className="anl-lib__still">
                  <VideoStill videoId={v.videoId} className="anl-lib__img" fallback={<VideoIcon size={22} />} />
                </span>
                <span className="anl-lib__line" lang="ja">{v.firstLine}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canMore && !failed && (
        <button type="button" className="btn-secondary anl-lib__more" onClick={showMore} disabled={more}>
          {more ? <Dots /> : t.vlibMore}
        </button>
      )}
    </section>
  )
}
