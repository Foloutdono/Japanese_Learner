import { describe, it, expect } from 'vitest'
import {
  buildBookmarklet,
  transcriptXmlToVtt,
  encodeGrabPayload,
  decodeGrabHash,
} from './captionGrab'

// ── The measured facts this module rides on (2026-09-01) ──
// From the app's origin, every caption route is walled off: the
// server is IP-blocked (Render), the browser is CORS-blocked at
// InnerTube and token-blocked at timedtext, and the public mirrors
// return 200-with-empty-body. From the WATCH PAGE's own origin,
// though, an InnerTube call with the ANDROID client and the page's
// own key returns caption tracks whose URLs still yield real bodies
// (2,478 bytes of Japanese cues in the probe). So the fetch runs
// where it works — a bookmarklet on youtube.com — and hands the raw
// transcript XML back to the app through the URL hash. This file
// pins the three halves the app owns: the bookmarklet source, the
// hash codec, and the XML→VTT conversion.

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript>` +
  `<text start="36.796" dur="3.411">ないしらせは 良いしらせ</text>` +
  `<text start="40.207" dur="2.5">it&amp;#39;s a &amp;quot;test&amp;quot; &amp;amp; more</text>` +
  `<text start="43.5" dur="1.2">   </text>` +
  `<text start="45" dur="2">最後の行</text>` +
  `</transcript>`

describe('transcriptXmlToVtt', () => {
  it('converts cues to WebVTT with millisecond timecodes', () => {
    const vtt = transcriptXmlToVtt(SAMPLE_XML)
    expect(vtt.startsWith('WEBVTT')).toBe(true)
    expect(vtt).toContain('00:00:36.796 --> 00:00:40.207')
    expect(vtt).toContain('ないしらせは 良いしらせ')
    expect(vtt).toContain('00:00:45.000 --> 00:00:47.000')
    expect(vtt).toContain('最後の行')
  })

  it('unescapes the transcript XML’s double-encoded entities', () => {
    const vtt = transcriptXmlToVtt(SAMPLE_XML)
    // The endpoint escapes twice: &amp;#39; must come out as an
    // apostrophe, not as &#39;.
    expect(vtt).toContain(`it's a "test" & more`)
    expect(vtt).not.toContain('&amp;')
    expect(vtt).not.toContain('&#39;')
  })

  it('drops whitespace-only cues and keeps the count honest', () => {
    const vtt = transcriptXmlToVtt(SAMPLE_XML)
    expect(vtt.match(/-->/g).length).toBe(3)
  })

  it('throws on a document with no cues at all', () => {
    expect(() => transcriptXmlToVtt('<transcript></transcript>')).toThrow()
    expect(() => transcriptXmlToVtt('')).toThrow()
  })
})

describe('the grab hash codec', () => {
  it('round-trips videoId and XML through encode/decode', async () => {
    const payload = await encodeGrabPayload('UQecj-5Tiqw', SAMPLE_XML)
    const grab = await decodeGrabHash(`#grab=${payload}`)
    expect(grab).not.toBeNull()
    expect(grab.videoId).toBe('UQecj-5Tiqw')
    expect(grab.xml).toBe(SAMPLE_XML)
  })

  it('compresses when the platform can (the hash rides a URL)', async () => {
    // Node ≥18 and every current browser have CompressionStream; the
    // payload marks its mode so a raw fallback still decodes.
    const payload = await encodeGrabPayload('UQecj-5Tiqw', SAMPLE_XML)
    if (typeof CompressionStream !== 'undefined') {
      expect(payload.split('.')[1]).toBe('z')
    }
  })

  it('returns null for hashes that are not a grab at all', async () => {
    expect(await decodeGrabHash('')).toBeNull()
    expect(await decodeGrabHash('#foo=bar')).toBeNull()
    expect(await decodeGrabHash('#grab=')).toBeNull()
    expect(await decodeGrabHash('#grab=v1.z')).toBeNull()
    // A mangled body must not throw out of the decoder — the screen
    // treats null as "not for me".
    expect(await decodeGrabHash('#grab=v1.z.UQecj-5Tiqw.%%%%')).toBeNull()
    // An id that is not a YouTube id is refused outright.
    expect(await decodeGrabHash('#grab=v1.r.<script>.aGk')).toBeNull()
  })
})

describe('buildBookmarklet', () => {
  it('is a javascript: URL carrying the app origin and the measured client', () => {
    const bm = buildBookmarklet('https://example.app')
    expect(bm.startsWith('javascript:')).toBe(true)
    const src = decodeURIComponent(bm.slice('javascript:'.length))
    expect(src).toContain('https://example.app/analyzer#grab=')
    // The one InnerTube client measured to still return caption
    // tracks with fetchable bodies from the page (see header note).
    expect(src).toContain('ANDROID')
    expect(src).toContain('youtubei/v1/player')
    // It prefers a manual ja track and refuses non-Japanese ones.
    expect(src).toContain("languageCode==='ja'")
  })
})
