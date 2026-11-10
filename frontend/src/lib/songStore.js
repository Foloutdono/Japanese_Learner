// ── 歌 — the songs this device keeps (plan 315) ──────────────────────
// A song's audio is heard once on the server and forgotten there
// (backend study/song_transcribe.py), so the passage it made plays from
// the learner's own file, and this is where the device keeps it: by the
// session's id, the KEEP most recently added. A song reopened here plays
// at once; one reopened on another device, or after the browser cleared
// its storage, asks for its file again (the analyser's refile).
//
// Best effort throughout: a browser that keeps nothing (a private
// window, a storage cap) costs the learner a second pick, never an
// error.

const DB = 'tsuji-songs'
const STORE = 'songs'
const KEEP = 5

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function settle(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Keep `file` as the song of session `sessionId`, letting go of the
 *  oldest past KEEP. */
export async function keepSong(sessionId, file) {
  if (sessionId == null || !file) return
  try {
    const db = await open()
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
      await settle(store.put({ file, at: Date.now() }, String(sessionId)))
      const keys = await settle(store.getAllKeys())
      const rows = await settle(store.getAll())
      const old = keys
        .map((key, i) => ({ key, at: rows[i]?.at ?? 0 }))
        .sort((a, b) => b.at - a.at)
        .slice(KEEP)
      await Promise.all(old.map(({ key }) => settle(store.delete(key))))
    } finally {
      db.close()
    }
  } catch {
    // Kept nowhere: the song asks for its file when it is reopened.
  }
}

/** The file kept for session `sessionId`, or null. */
export async function songFile(sessionId) {
  if (sessionId == null) return null
  try {
    const db = await open()
    try {
      const row = await settle(db.transaction(STORE).objectStore(STORE).get(String(sessionId)))
      return row?.file ?? null
    } finally {
      db.close()
    }
  } catch {
    return null
  }
}
