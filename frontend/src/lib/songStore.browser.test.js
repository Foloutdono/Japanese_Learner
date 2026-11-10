import { describe, it, expect, beforeEach } from 'vitest'
import { keepSong, songFile } from './songStore'

// ── 歌 — the songs this device keeps (plan 315) ──────────────────────
// A song's passage plays from the learner's own file, kept here by its
// session's id: the five most recent, and nothing thrown when the
// browser keeps nothing.

const song = (name, text = name) => new File([text], name, { type: 'audio/mpeg' })

beforeEach(async () => {
  await new Promise(resolve => {
    const request = indexedDB.deleteDatabase('tsuji-songs')
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

describe('songStore', () => {
  it('gives back the file kept for a session, as it was', async () => {
    await keepSong(41, song('ma-chanson.mp3', 'des octets'))
    const file = await songFile(41)
    expect(file).not.toBeNull()
    expect(file.name).toBe('ma-chanson.mp3')
    expect(file.type).toBe('audio/mpeg')
    expect(await file.text()).toBe('des octets')
  })

  it('has nothing for a session it never kept', async () => {
    expect(await songFile(42)).toBeNull()
    expect(await songFile(null)).toBeNull()
  })

  it('keeps the five most recent and lets the oldest go', async () => {
    for (let id = 1; id <= 7; id += 1) {
      await keepSong(id, song(`song-${id}.mp3`))
      // Kept at distinct instants, so "most recent" has one answer.
      await new Promise(r => setTimeout(r, 3))
    }
    expect(await songFile(1)).toBeNull()
    expect(await songFile(2)).toBeNull()
    for (let id = 3; id <= 7; id += 1) expect((await songFile(id))?.name).toBe(`song-${id}.mp3`)
  })

  it('takes a second pick of the same session’s song in place of the first', async () => {
    await keepSong(9, song('old.mp3'))
    await keepSong(9, song('new.mp3'))
    expect((await songFile(9)).name).toBe('new.mp3')
  })

  it('keeps nothing, and says nothing, for a session with no id or no file', async () => {
    await expect(keepSong(null, song('a.mp3'))).resolves.toBeUndefined()
    await expect(keepSong(3, null)).resolves.toBeUndefined()
    expect(await songFile(3)).toBeNull()
  })
})
