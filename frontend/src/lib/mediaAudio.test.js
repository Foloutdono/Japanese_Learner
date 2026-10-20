import { describe, it, expect, afterEach } from 'vitest'
import { mixDown, cropWindow, toPcm16, encodeMp3, recordingFor, SAMPLE_RATE } from './mediaAudio'

// The browser half of plan 265: a recording's sound, kept, cut and
// encoded before anything leaves the device. The decode is the
// browser's own (an OfflineAudioContext); here it is stood in for by a
// context that hands back the channels it is given.
function fakeContext(channels) {
  return class {
    constructor(count, length, rate) { this.sampleRate = rate }
    async decodeAudioData() {
      return { numberOfChannels: channels.length, getChannelData: c => channels[c] }
    }
  }
}

const file = (size = 1000) => ({ size, name: 'episode.m4a', arrayBuffer: async () => new ArrayBuffer(8) })

afterEach(() => {
  delete globalThis.OfflineAudioContext
})

describe('the sound, kept', () => {
  it('mixes the channels to their mean', () => {
    expect(Array.from(mixDown([new Float32Array([1, 0.5]), new Float32Array([0, -0.5])]))).toEqual([0.5, 0])
    const mono = new Float32Array([0.25])
    expect(mixDown([mono])).toBe(mono)
  })

  it('cuts the window and says where it starts', () => {
    const samples = new Float32Array(10 * SAMPLE_RATE)
    const { samples: cut, offset } = cropWindow(samples, SAMPLE_RATE, 2, 5)
    expect(cut.length).toBe(3 * SAMPLE_RATE)
    expect(offset).toBe(2)
    expect(cropWindow(samples, SAMPLE_RATE, null, null).samples.length).toBe(samples.length)
    expect(() => cropWindow(samples, SAMPLE_RATE, 5, 2)).toThrow()
  })

  it('writes 16-bit PCM, clipped', () => {
    expect(Array.from(toPcm16(new Float32Array([0, 1, -1, 2])))).toEqual([0, 32767, -32768, 32767])
  })

  it('encodes an MP3 the server can measure', async () => {
    const ticks = []
    const blob = await encodeMp3(new Float32Array(3 * SAMPLE_RATE), { onProgress: p => ticks.push(p) })
    expect(blob.type).toBe('audio/mpeg')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // An MPEG frame's sync word: eleven bits set.
    expect(bytes[0]).toBe(0xff)
    expect(bytes[1] & 0xe0).toBe(0xe0)
    // 32 kbps is 4 KB a second.
    expect(bytes.length).toBeGreaterThan(10000)
    expect(bytes.length).toBeLessThan(14000)
    expect(ticks.at(-1)).toEqual({ stage: 'encode', ratio: 1 })
  })
})

describe('a recording, ready to send', () => {
  it('is the window of the file’s sound, encoded, with where it starts', async () => {
    globalThis.OfflineAudioContext = fakeContext([new Float32Array(10 * SAMPLE_RATE), new Float32Array(10 * SAMPLE_RATE)])
    const stages = []
    const recording = await recordingFor(file(), { start: 4, end: 7, onProgress: p => stages.push(p.stage) })
    expect(recording.offset).toBe(4)
    expect(recording.seconds).toBe(3)
    expect(recording.blob.size).toBeGreaterThan(0)
    expect(stages.slice(0, 2)).toEqual(['read', 'decode'])
    expect(stages).toContain('encode')
  })

  it('is refused before any encoding past what a session or the day takes', async () => {
    globalThis.OfflineAudioContext = fakeContext([new Float32Array(200 * SAMPLE_RATE)])
    await expect(recordingFor(file(), { maxSeconds: 60 })).rejects.toMatchObject({ code: 'media_too_long' })
    await expect(recordingFor(file(), { minutesLeft: 2 })).rejects.toMatchObject({ code: 'transcribe_allowance_mine' })
    // Cut to a window that fits, it goes.
    await expect(recordingFor(file(), { start: 0, end: 100, minutesLeft: 2 })).resolves.toMatchObject({ seconds: 100 })
  })

  it('says a file the browser cannot read is unreadable, and one too large is too large', async () => {
    globalThis.OfflineAudioContext = class { async decodeAudioData() { throw new Error('EncodingError') } }
    await expect(recordingFor(file())).rejects.toMatchObject({ code: 'media_unreadable' })
    await expect(recordingFor(file(2 * 1024 * 1024 * 1024))).rejects.toMatchObject({ code: 'media_too_large' })
  })
})
