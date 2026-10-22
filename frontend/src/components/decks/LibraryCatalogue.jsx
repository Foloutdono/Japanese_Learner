import { useLang } from '../../LangContext'
import { Console, ConsoleBand, ConsoleTop, Chips, Chip, ConsoleIndex } from '../chrome/Console'
import Empty from '../ui/Empty'
import { Loading } from '../ui/Loading'
import { LibraryCard } from './LibraryCard'
import { BooksIcon } from '../ui/Icons'
import { LibraryHome } from './LibraryHome'
import { useLibrary, SORTS } from './useLibrary'

// ── The library's catalogue ──────────────────────────────────────
// What the library screen is made of, apart from where it stands: the
// console (the ordering, the structures, the search) and the paged
// shelf it narrows. The phone's library (screens/LibraryScreen) and its
// desk split read it, and so does the desk's Bibliothèque (plan 269,
// screens/DecksScreen), where it is the page beside the learner's own
// shelf. The console's anatomy and why its narrowing is the
// server's are written beside its state (./useLibrary).

/** The library's console: the ordering, the structures, the search. */
export function LibraryConsole({ lib }) {
  const { t } = useLang()
  const countLabel = lib.total === 1 ? t.decksCountOne : t.decksCount.replace('{n}', lib.total)
  return (
    <Console>
      <ConsoleBand
        label={t.librarySort}
        value={lib.sort}
        onChange={lib.chooseSort}
        options={SORTS.map(key => ({
          key,
          label: key === 'new' ? t.librarySortNew : t.librarySortFollowed,
        }))}
      />
      {/* The row goes with the chips rather than standing empty: a
          console whose first row holds nothing is a hairline drawn
          for its own sake. */}
      {lib.typeChips.length > 1 && (
        <ConsoleTop>
          <Chips label={t.libraryTypes}>
            <Chip on={lib.structure === 'all'} color="var(--line-decks)"
              onClick={() => lib.chooseStructure('all')}>
              {t.decksAllTypes}
            </Chip>
            {lib.typeChips.map(dt => (
              <Chip key={dt.value} on={lib.structure === dt.value} glyph={dt.glyph} color={dt.color}
                onClick={() => lib.chooseStructure(dt.value)}>
                {dt.label}
              </Chip>
            ))}
          </Chips>
        </ConsoleTop>
      )}
      {/* The count slot holds a figure, not a wait: while the first
          page is in flight it says nothing rather than running a
          second loader beside the placeholder. */}
      <ConsoleIndex
        inputRef={lib.searchRef}
        value={lib.query}
        onChange={lib.onSearch}
        onClear={lib.clearQuery}
        placeholder={t.decksSearchPlaceholder}
        clearLabel={t.close}
        count={lib.settled && !lib.failed ? countLabel : undefined}
      />
    </Console>
  )
}

/**
 * What the shelf answers: the wait, the failure, the two empties, and
 * the decks themselves as `cards` draws them, with More under them.
 */
export function LibraryResults({ lib, cards }) {
  const { t } = useLang()
  return (
    <>
      {lib.loading && lib.page === 0 && <Loading />}
      {lib.settled && lib.failed && (
        <Empty icon={<BooksIcon size={40} />} message={t.libraryFailed} hint={t.libraryFailedHint} />
      )}
      {/* An empty library and a search that found nothing are two
          different answers, and telling a learner nobody has published
          anything when what happened is that their word matched no deck
          sends them off the screen for good. */}
      {lib.settled && !lib.failed && lib.decks.length === 0 && (
        lib.narrowed ? (
          <Empty
            icon={<BooksIcon size={40} />}
            message={t.decksNoMatch}
            hint={t.decksNoMatchHint}
            action={{ label: t.decksClearFilters, onClick: lib.clearFilters }}
          />
        ) : (
          <Empty icon={<BooksIcon size={40} />} message={t.libraryEmpty} hint={t.libraryEmptyHint} />
        )
      )}
      {lib.settled && lib.decks.length > 0 && cards(lib.decks)}
      {lib.hasMore && (
        <button type="button" className="lib-shelf__more" disabled={lib.loading} onClick={lib.nextPage}>
          {t.libraryMore}
        </button>
      )}
    </>
  )
}

// ── 机 — the library as the page beside your shelf (plan 269) ──
// The desk's Bibliothèque is one screen (the owner's pick L1 of the
// canvas "Tsuji — the desk's chrome and its four new places"): the
// learner's own decks down the side column (screens/DecksScreen) and
// this beside them. The console heads it, so the search is where the
// eye starts; under it, while nothing narrows the shelf, À la une and
// Tes publications (LibraryHome, without its Abonnements: the decks
// you follow are on your shelf, beside); then the shelf itself, its
// decks two to a row, each a link to its page in the library.
export function LibraryCatalogue({ session }) {
  const { t } = useLang()
  const lib = useLibrary(session)
  return (
    <section className="lib-catalogue" aria-label={t.library}>
      <LibraryConsole lib={lib} />
      {!lib.narrowed && <LibraryHome session={session} beside />}
      <LibraryResults
        lib={lib}
        cards={decks => (
          <div className="platform-grid lib-catalogue__grid">
            {decks.map(deck => (
              <LibraryCard key={deck.id} deck={deck} t={t} to={`/learn/decks/library/${deck.id}`} />
            ))}
          </div>
        )}
      />
    </section>
  )
}
