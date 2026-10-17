import { inflateSync } from 'fflate'

// ── One entry out of a zip, read from a Blob (plan 243) ─────────
// An .apkg or .colpkg is a zip: the SQLite collection beside, usually,
// hundreds of megabytes of media, as many files as a deck has sounds
// and pictures. Unzipping the whole archive would hold all of it in a
// phone's memory to read one entry, so this reads the end of the file
// for the central directory, then the one entry's bytes, through
// Blob.slice: a collection of any size costs what its database does.
//
// Stored (0) and deflated (8) entries, the two Anki writes; Zip64, which
// a collection with more than 65,535 media files needs. Nothing else of
// the format is read.

const EOCD = 0x06054b50
const ZIP64_LOCATOR = 0x07064b50
const ZIP64_EOCD = 0x06064b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const MAX_COMMENT = 0xffff
const FULL32 = 0xffffffff

export class ZipError extends Error {}

async function bytes(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer())
}

// A 64-bit little-endian integer, as a Number: an offset in a file
// stays far inside 2^53.
function u64(view, at) {
  return view.getUint32(at, true) + view.getUint32(at + 4, true) * 2 ** 32
}

async function directory(blob) {
  const tailStart = Math.max(0, blob.size - (22 + MAX_COMMENT))
  const tail = await bytes(blob, tailStart, blob.size)
  const view = new DataView(tail.buffer)
  let at = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD) { at = i; break }
  }
  if (at < 0) throw new ZipError('not a zip')
  let count = view.getUint16(at + 10, true)
  let size = view.getUint32(at + 12, true)
  let offset = view.getUint32(at + 16, true)
  if ((offset === FULL32 || size === FULL32 || count === 0xffff) && at >= 20
      && view.getUint32(at - 20, true) === ZIP64_LOCATOR) {
    const recordAt = u64(view, at - 20 + 8)
    const record = await bytes(blob, recordAt, recordAt + 56)
    const rv = new DataView(record.buffer)
    if (rv.getUint32(0, true) !== ZIP64_EOCD) throw new ZipError('bad zip64 record')
    count = u64(rv, 32)
    size = u64(rv, 40)
    offset = u64(rv, 48)
  }
  return { count, size, offset }
}

/** Every entry's name, method and where its bytes lie. */
export async function listEntries(blob) {
  const { count, size, offset } = await directory(blob)
  const dir = await bytes(blob, offset, offset + size)
  const view = new DataView(dir.buffer)
  const names = new TextDecoder()
  const out = []
  let at = 0
  for (let n = 0; n < count && at + 46 <= dir.length; n++) {
    if (view.getUint32(at, true) !== CENTRAL) throw new ZipError('bad central directory')
    const method = view.getUint16(at + 10, true)
    let compressed = view.getUint32(at + 20, true)
    let length = view.getUint32(at + 24, true)
    const nameLen = view.getUint16(at + 28, true)
    const extraLen = view.getUint16(at + 30, true)
    const commentLen = view.getUint16(at + 32, true)
    let local = view.getUint32(at + 42, true)
    const name = names.decode(dir.subarray(at + 46, at + 46 + nameLen))
    // Zip64's extra field carries, in this order, whichever of the three
    // the header left at its full 32 bits.
    let x = at + 46 + nameLen
    const xEnd = x + extraLen
    while (x + 4 <= xEnd) {
      const id = view.getUint16(x, true)
      const len = view.getUint16(x + 2, true)
      if (id === 0x0001) {
        let p = x + 4
        if (length === FULL32) { length = u64(view, p); p += 8 }
        if (compressed === FULL32) { compressed = u64(view, p); p += 8 }
        if (local === FULL32) { local = u64(view, p) }
      }
      x += 4 + len
    }
    out.push({ name, method, compressed, length, local })
    at = xEnd + commentLen
  }
  return out
}

/** One entry's content, inflated if it was deflated. */
export async function readEntry(blob, entry) {
  const head = await bytes(blob, entry.local, entry.local + 30)
  const view = new DataView(head.buffer)
  if (view.getUint32(0, true) !== LOCAL) throw new ZipError('bad local header')
  const start = entry.local + 30 + view.getUint16(26, true) + view.getUint16(28, true)
  const data = await bytes(blob, start, start + entry.compressed)
  if (entry.method === 0) return data
  if (entry.method === 8) return inflateSync(data, { out: new Uint8Array(entry.length) })
  throw new ZipError(`unsupported method ${entry.method}`)
}
