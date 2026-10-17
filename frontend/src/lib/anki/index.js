import { decompress } from 'fzstd'
import { listEntries, readEntry } from './zip'
import { AnkiError, readCollection } from './collection'

export { AnkiError, buildPayload, MAX_NOTES } from './collection'

// ── Reading an .apkg or .colpkg on the device (plan 243) ────────
// Settings › Correspondance imports this module on demand, when a file is chosen:
// it carries SQLite (sql.js, a WebAssembly build) and the two
// decompressors, none of which anything else in the app needs.
//
// The collection is the newest the archive holds: collection.anki21b,
// zstd-compressed, beside a collection.anki2 that only says "update
// Anki" when an export targets Anki 2.1.50 and later; collection.anki21
// or collection.anki2 when it was exported for older versions.
const COLLECTIONS = ['collection.anki21b', 'collection.anki21', 'collection.anki2']

/** The collection of an Anki file (a File or Blob), read: see
 *  readCollection. `wasmUrl` is where sql.js finds its WebAssembly in a
 *  browser; under node it finds its own. Throws an AnkiError whose code
 *  the page prints. */
export async function readAnkiFile(file, { wasmUrl } = {}) {
  let entries
  try {
    entries = await listEntries(file)
  } catch {
    throw new AnkiError('notAnki')
  }
  const entry = COLLECTIONS.map(name => entries.find(e => e.name === name)).find(Boolean)
  if (!entry) throw new AnkiError('notAnki')

  let db
  try {
    let bytes = await readEntry(file, entry)
    if (entry.name.endsWith('b')) bytes = decompress(bytes)
    const { default: initSqlJs } = await import('sql.js')
    const SQL = await initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined)
    db = new SQL.Database(bytes)
  } catch {
    throw new AnkiError('unreadable')
  }
  try {
    const collection = readCollection(db)
    // Cards, and not one Anki has taught: the deck was exported without
    // its scheduling, the one checkbox the page asks for.
    if (collection.cards > 0 && collection.graduated === 0) throw new AnkiError('noSchedule')
    if (!collection.decks.length) throw new AnkiError('nothing')
    return collection
  } catch (e) {
    throw e instanceof AnkiError ? e : new AnkiError('unreadable')
  } finally {
    db.close()
  }
}
