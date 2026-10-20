import { describe, it, expect, afterEach, vi } from 'vitest'
import { episodeAudio, feedAddress } from './podcast'
import { isMediaFile, isSubtitleFile, SUBTITLE_ACCEPT, MEDIA_ACCEPT } from './subtitleFiles'

// Plan 265: an episode's audio is asked of its own address first, and
// of the server's relay when the host sends no CORS headers; a file is
// a recording or a subtitle file by its type, then its name.
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('an episode’s audio', () => {
  it('comes from its own address when the host allows it', async () => {
    const fetch = vi.fn(async () => new Response(new Blob(['ID3'], { type: 'audio/mpeg' })))
    vi.stubGlobal('fetch', fetch)
    const blob = await episodeAudio(null, 'https://cdn.example/ep.mp3')
    expect(await blob.text()).toBe('ID3')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://cdn.example/ep.mp3')
  })

  it('comes through the relay when the host refuses a page', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(new Blob(['relayed'])))
    vi.stubGlobal('fetch', fetch)
    const blob = await episodeAudio({ access_token: 'tok' }, 'https://cdn.example/ep 1.mp3')
    expect(await blob.text()).toBe('relayed')
    expect(String(fetch.mock.calls[1][0])).toContain('/api/video/podcast/audio?url=https%3A%2F%2Fcdn.example%2Fep%201.mp3')
  })

  it('carries the relay’s refusal code', async () => {
    // A 429 to a GET is asked once more after a beat (lib/api), so
    // every relay answer is the refusal.
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async () => new Response(
        JSON.stringify({ detail: { code: 'relay_allowance_mine', message: 'x' } }),
        { status: 429, headers: { 'Retry-After': '0' } },
      )))
    await expect(episodeAudio(null, 'https://cdn.example/ep.mp3')).rejects.toMatchObject({ code: 'relay_allowance_mine' })
  })
})

describe('what the intake reads', () => {
  const isYoutube = s => s.includes('youtu')
  it('offers a web address that is not a YouTube link as a feed', () => {
    expect(feedAddress(' https://feeds.example/show.xml ', isYoutube)).toBe('https://feeds.example/show.xml')
    expect(feedAddress('https://youtu.be/abc', isYoutube)).toBeNull()
    expect(feedAddress('日本語', isYoutube)).toBeNull()
    expect(feedAddress('', isYoutube)).toBeNull()
  })

  it('tells a recording from a subtitle file', () => {
    expect(isMediaFile({ name: 'clip.bin', type: 'video/mp4' })).toBe(true)
    expect(isMediaFile({ name: 'episode.M4A', type: '' })).toBe(true)
    expect(isMediaFile({ name: 'subs.srt', type: '' })).toBe(false)
    expect(isSubtitleFile({ name: 'netflix.xml', type: '' })).toBe(true)
    expect(isSubtitleFile({ name: 'yt.json', type: 'application/json' })).toBe(true)
    expect(isSubtitleFile({ name: 'a.ttml', type: '' })).toBe(true)
    expect(isSubtitleFile({ name: 'film.mp4', type: 'video/mp4' })).toBe(false)
    expect(SUBTITLE_ACCEPT).toContain('.ttml')
    expect(SUBTITLE_ACCEPT).toContain('.sbv')
    expect(MEDIA_ACCEPT).toContain('audio/*')
  })
})
