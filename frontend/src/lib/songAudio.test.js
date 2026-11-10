import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { encodeWav, isSongFile, mixDown, MAX_SECONDS, RATE, SONG_ACCEPT, songKind, songName } from './songAudio'

// ── 歌 — the song as the server hears it (plan 315) ──────────────────
// The browser writes a song as a 16-bit PCM WAV, one channel at 16 kHz,
// cut at MAX_SECONDS; the server reads exactly that and refuses the
// rest (backend study/song_transcribe.wav_seconds). These pin the
// client's half, and the two figures both halves hold.

const backend = readFileSync(new URL('../../../backend/study/song_transcribe.py', import.meta.url), 'utf8')
const figure = name => {
  const line = backend.match(new RegExp(`^${name} = (.+)$`, 'm'))?.[1]
  // 7 * 60, 16_000: the Python's own arithmetic, read as numbers.
  return line.split('*').map(n => Number(n.replace(/_/g, '').trim())).reduce((a, b) => a * b, 1)
}

describe('the figures both halves hold', () => {
  it('cuts a song where the server stops listening', () => {
    expect(MAX_SECONDS).toBe(figure('MAX_SECONDS'))
  })
  it('writes the rate the server reads', () => {
    expect(RATE).toBe(figure('RATE'))
  })
})

describe('encodeWav', () => {
  it('writes the header of a mono 16-bit PCM WAV', async () => {
    const wav = encodeWav(new Float32Array(10), RATE)
    expect(wav.type).toBe('audio/wav')
    const view = new DataView(await wav.arrayBuffer())
    const text = (at, n) => String.fromCharCode(...new Uint8Array(view.buffer, at, n))
    expect(view.byteLength).toBe(44 + 20)
    expect(text(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 20)
    expect(text(8, 4)).toBe('WAVE')
    expect(text(12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint16(20, true)).toBe(1)        // PCM
    expect(view.getUint16(22, true)).toBe(1)        // one channel
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(28, true)).toBe(32000)    // bytes a second
    expect(view.getUint16(32, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(20)
  })

  it('writes each sample at full scale, clipping what overshoots', async () => {
    const view = new DataView(await encodeWav(new Float32Array([0, 1, -1, 1.5, -1.5, 0.5])).arrayBuffer())
    const sample = i => view.getInt16(44 + i * 2, true)
    expect([0, 1, 2, 3, 4].map(sample)).toEqual([0, 32767, -32768, 32767, -32768])
    expect(sample(5)).toBe(Math.trunc(0.5 * 32767))
  })

  it('takes a second of song as 32 kB, so seven minutes fit the server’s bound', () => {
    expect(encodeWav(new Float32Array(RATE)).size).toBe(44 + 32000)
  })
})

describe('mixDown', () => {
  const buffer = channels => ({
    numberOfChannels: channels.length,
    length: channels[0].length,
    getChannelData: c => Float32Array.from(channels[c]),
  })

  it('averages the channels into one', () => {
    expect([...mixDown(buffer([[1, 0.5, 0], [0, -0.5, -1]]))]).toEqual([0.5, 0, -0.5])
  })

  it('keeps one channel as it is', () => {
    expect([...mixDown(buffer([[0.25, -0.25]]))]).toEqual([0.25, -0.25])
  })

  it('stops at the frames asked for: the cut', () => {
    expect([...mixDown(buffer([[1, 1, 1, 1]]), 2)]).toEqual([1, 1])
  })
})

describe('songName and songKind (plan 315b)', () => {
  it('names a song after its file, without the extension', () => {
    expect(songName('ma-chanson.mp3')).toBe('ma-chanson')
    expect(songName('夜に駆ける.m4a')).toBe('夜に駆ける')
    expect(songName('v1.2 live.flac')).toBe('v1.2 live')
    expect(songName('song')).toBe('song')
    expect(songName(undefined)).toBe('')
  })

  it('says a file’s kind from its extension, in capitals', () => {
    expect(songKind('ma-chanson.mp3')).toBe('MP3')
    expect(songKind('voice.m4a')).toBe('M4A')
    expect(songKind('song')).toBe('')
    expect(songKind(null)).toBe('')
  })
})

describe('isSongFile', () => {
  const file = (name, type) => ({ name, type })

  it('takes a file of an audio type', () => {
    expect(isSongFile(file('a.mp3', 'audio/mpeg'))).toBe(true)
    expect(isSongFile(file('voice memo', 'audio/x-m4a'))).toBe(true)
  })

  it('takes an audio file’s name where the system gave no type', () => {
    expect(isSongFile(file('chanson.FLAC', ''))).toBe(true)
    expect(isSongFile(file('chanson.opus', ''))).toBe(true)
  })

  it('leaves a picture, a video and a subtitle file to their own platforms', () => {
    expect(isSongFile(file('a.png', 'image/png'))).toBe(false)
    expect(isSongFile(file('a.webm', 'video/webm'))).toBe(false)
    expect(isSongFile(file('a.srt', ''))).toBe(false)
    expect(isSongFile(null)).toBe(false)
  })

  it('takes every audio extension the picker offers', () => {
    for (const ext of SONG_ACCEPT.split(',').filter(a => a.startsWith('.') && a !== '.webm')) {
      expect(isSongFile(file(`song${ext}`, '')), ext).toBe(true)
    }
  })
})
