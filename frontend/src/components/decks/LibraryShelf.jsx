import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../../lib/api'
import { playUi } from '../../lib/audio'
import { SectionHeader } from '../ui/SectionHeader'
import { LibraryCard } from './LibraryCard'

// ── The library, below your own decks ─────────────────────────
// A short shelf of what other learners have published, sitting under
// 教材's own grid on /learn/decks — which is where the whole feature
// was asked for.
//
// It prints NOTHING while the library is empty. A screen that already
// has an empty state for "you have no decks" does not need a second
// block underneath explaining that nobody else has any either; the
// section appears the day there is something on it.
//
// No Japanese pair on the heading, unlike every other section in the
// app: owner's call, and SectionHeader's own fallback form. See
// DESIGN.md.

const PREVIEW = 3

export function LibraryShelf({ session, t }) {
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let live = true
    apiJson(`/api/decks/library?limit=${PREVIEW}`, session)
      .then(data => {
        if (!live) return
        setDecks(data?.results ?? [])
        setTotal(data?.total ?? 0)
      })
      // Silent: the library is an extra on this screen, and a shelf of
      // your own decks that still works is a better answer than an
      // error about someone else's.
      .catch(() => {})
    return () => { live = false }
  }, [session])

  if (decks.length === 0) return null

  const open = deck => navigate(`/learn/decks/library/${deck.id}`)

  return (
    <section className="lib-shelf">
      <SectionHeader title={t.library} count={total > PREVIEW ? total : undefined} />
      <div className="platform-grid">
        {decks.map(deck => (
          <LibraryCard key={deck.id} deck={deck} t={t} onOpen={open} />
        ))}
      </div>
      {/* Always, not only when the preview is short. The library screen
          is the only place the ordering lives, and gating this on
          `total > PREVIEW` left the whole route unreachable whenever
          three decks or fewer were published — which is every day of
          the feature's first months. */}
      <button
        type="button"
        className="lib-shelf__more"
        onClick={() => { playUi('click-mode-selection'); navigate('/learn/decks/library') }}
      >
        {t.librarySeeAll}
      </button>
    </section>
  )
}
