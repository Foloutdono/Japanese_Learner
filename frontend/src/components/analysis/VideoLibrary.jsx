import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { relativeDate } from '../../lib/formatDate'
import { cachedJson, MINE_TTL_MS } from '../../lib/cachedJson'
import { Chips, Chip } from '../chrome/Console'
import { VideoIcon } from '../ui/Icons'
import { Dots } from '../ui/Loading'
import { VideoStill } from './VideoStill'

// ── 図書館 — the public library of analysed videos (plan 322) ──
// Every YouTube video a learner's link has been analysed from, once, for
// everybody (backend routes/video_library.py): open one and it is read
// at once, its breakdown ready, with no fetch and none of the link
// allowance. It is anonymous: a card says how many learners have studied
// the video, never which. These videos are no longer on the shelf above
// and do not count toward its thirty; "Mine" lists the ones this learner
// opened.
//
// Built from the shelf's own parts -- the chips, the desk's cards, the
// phone's rows -- so it reads as the same object (PassageShelf): a
// filter row (all, mine, the kinds the library holds), an order, then the
// videos, a page at a time. The kinds are sorted by a model once, when a
// video joins; a video it has not sorted yet is under All alone.

const PAGE = 24
const ORDERS = ['new', 'popular']

function pathFor(filter, sort, offset) {
  const q = [`limit=${PAGE}`, `offset=${offset}`, `sort=${sort}`]
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
  const desk = useDesk()
  const { lang } = useLang()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const [attempt, setAttempt] = useState(0)
  // The last answer, and the request it answers (`key`): while the
  // request now asked is not the one answered, the page is loading, and
  // the videos and counts of the last answer stay meanwhile, so it does
  // not blink to nothing at every chip.
  const [state, setState] = useState({ key: null, failed: false, videos: [], total: 0, counts: null })
  const [more, setMore] = useState(false)
  const userId = session?.user?.id
  const key = `${userId} ${attempt} ${pathFor(filter, sort, 0)}`

  useEffect(() => {
    let live = true
    cachedJson(pathFor(filter, sort, 0), session, { ttlMs: MINE_TTL_MS })
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
      const next = readAnswer(await cachedJson(pathFor(filter, sort, state.videos.length), session, { ttlMs: MINE_TTL_MS }))
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

  const counts = state.counts
  const kinds = counts ? Object.keys(t.vlibKinds).filter(k => counts[k] > 0) : []
  const chips = [
    { key: 'all', label: t.shelfAll, n: counts?.all },
    ...(counts?.mine > 0 ? [{ key: 'mine', label: t.vlibMine, n: counts.mine }] : []),
    ...kinds.map(k => ({ key: k, label: t.vlibKinds[k], n: counts[k] })),
  ]
  // A filter whose chip has gone (a kind the library no longer holds) is All.
  const active = chips.some(c => c.key === filter) || !counts ? filter : 'all'
  const when = v => (v.addedAt ? relativeDate(v.addedAt, lang, t) : null)
  const kindName = v => (v.category ? t.vlibKinds[v.category] : null)
  const loading = state.key !== key
  const failed = state.failed && !loading
  const empty = !loading && !failed && state.videos.length === 0
  const canMore = state.videos.length < state.total

  return (
    <section className="anl-shelf anl-lib" aria-label={t.vlibTitle} aria-busy={loading}>
      <header className="anl-lib__head">
        <h2 className="anl-lib__title">{t.vlibTitle}</h2>
        <p className="hint">{t.vlibHint}</p>
      </header>
      {counts && counts.all > 0 && (
        <div className="anl-lib__filters">
          <Chips label={t.shelfFilter} className="anl-lib__kinds">
            {chips.map(c => (
              <Chip key={c.key} on={active === c.key} onClick={() => setFilter(c.key)}>
                {c.label}<span className="chip__n">{c.n}</span>
              </Chip>
            ))}
          </Chips>
          <Chips label={t.vlibOrder}>
            {ORDERS.map(o => (
              <Chip key={o} on={sort === o} onClick={() => setSort(o)}>
                {o === 'new' ? t.vlibOrderNew : t.vlibOrderPopular}
              </Chip>
            ))}
          </Chips>
        </div>
      )}
      {failed && (
        <p className="hint" role="alert">
          {t.vlibError}{' '}
          <button type="button" className="btn-secondary" onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>
        </p>
      )}
      {loading && state.videos.length === 0 && <p className="hint" role="status"><Dots /></p>}
      {empty && <p className="anl-shelf__empty">{active === 'mine' ? t.vlibEmptyMine : t.vlibEmpty}</p>}
      {state.videos.length > 0 && (desk ? (
        <div className="anl-shelf__grid">
          {state.videos.map(v => (
            <div key={v.videoId} className="anl-card anl-card--video">
              <button type="button" className="anl-card__open" onClick={() => onOpen(v)}>
                <span className="anl-card__still">
                  <VideoStill videoId={v.videoId} className="anl-card__img" fallback={<VideoIcon size={26} />} />
                  <span className="anl-card__count">{t.sessionSentenceCount(v.lineCount)}</span>
                </span>
                <span className="anl-card__body">
                  {kindName(v) && <span className="anl-card__src">{kindName(v)}</span>}
                  <span className="anl-card__jp anl-card__jp--short" lang="ja">{v.firstLine}</span>
                  <span className="anl-card__meta">
                    <span>{t.vlibLearners(v.learners)}</span>
                    {when(v) && <span>{when(v)}</span>}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="anl-shelf__rows">
          {state.videos.map(v => (
            <div key={v.videoId} className="anl-row">
              <button type="button" className="anl-row__open" onClick={() => onOpen(v)}>
                <span className="anl-row__lead anl-row__lead--still" role="img" aria-label={t.sourceVideo}>
                  <VideoStill videoId={v.videoId} className="anl-card__img" fallback={<VideoIcon size={18} />} />
                </span>
                <span className="anl-row__body">
                  <span className="anl-row__jp" lang="ja">{v.firstLine}</span>
                  <span className="anl-row__meta">
                    {kindName(v) && <span>{kindName(v)}</span>}
                    <span>{t.sessionSentenceCount(v.lineCount)}</span>
                    <span>{t.vlibLearners(v.learners)}</span>
                  </span>
                </span>
                <span className="anl-row__go" aria-hidden="true">▶</span>
              </button>
            </div>
          ))}
        </div>
      ))}
      {canMore && !failed && (
        <button type="button" className="btn-secondary anl-lib__more" onClick={showMore} disabled={more}>
          {more ? <Dots /> : t.vlibMore}
        </button>
      )}
    </section>
  )
}
