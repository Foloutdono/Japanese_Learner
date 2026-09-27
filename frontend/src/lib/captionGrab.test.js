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

  // srv3, the format the v2 grab asks for: a recognised track times
  // every word, written as a VTT karaoke stamp before it.
  const SRV3_ASR = '<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>' +
    '<w t="0" id="1"/>' +
    '<p t="1280" d="4799" w="1"><s ac="0">今日</s><s t="400" ac="0">は</s><s t="720" ac="0">いい</s></p>' +
    '<p t="3690" d="2389" w="1" a="1">\n</p>' +
    '<p t="3700" d="3000" w="1"><s ac="0">天気</s><s t="500" ac="0">です</s></p>' +
    '</body></timedtext>'

  it('stamps every recognised word of an srv3 track with its time', () => {
    const vtt = transcriptXmlToVtt(SRV3_ASR)
    expect(vtt).toContain('今日<00:00:01.680>は<00:00:02.000>いい')
    expect(vtt).toContain('天気<00:00:04.200>です')
    // The empty line-append paragraph is no cue.
    expect(vtt.match(/-->/g).length).toBe(2)
  })

  it('cuts a rolling paragraph where the next one starts', () => {
    const vtt = transcriptXmlToVtt(SRV3_ASR)
    expect(vtt).toContain('00:00:01.280 --> 00:00:03.700')
  })

  it('reads a hand-written srv3 track as plain lines', () => {
    const vtt = transcriptXmlToVtt('<timedtext format="3"><body><p t="1000" d="2000">雨が&amp;#39;<br/>降る</p></body></timedtext>')
    expect(vtt).toContain("00:00:01.000 --> 00:00:03.000\n雨が' 降る")
  })

  it('throws on a document with no cues at all', () => {
    expect(() => transcriptXmlToVtt('<transcript></transcript>')).toThrow()
    expect(() => transcriptXmlToVtt('')).toThrow()
  })
})

describe('the grab hash codec', () => {
  it('round-trips videoId and both tracks through encode/decode', async () => {
    const payload = await encodeGrabPayload('UQecj-5Tiqw', { manual: SAMPLE_XML, asr: '<p t="0">x</p>' })
    expect(payload.startsWith('v2.')).toBe(true)
    const grab = await decodeGrabHash(`#grab=${payload}`)
    expect(grab).not.toBeNull()
    expect(grab.videoId).toBe('UQecj-5Tiqw')
    expect(grab.manual).toBe(SAMPLE_XML)
    expect(grab.asr).toBe('<p t="0">x</p>')
  })

  it('carries a track missing on either side as null, and refuses none at all', async () => {
    const onlyAsr = await decodeGrabHash(`#grab=${await encodeGrabPayload('UQecj-5Tiqw', { asr: SAMPLE_XML })}`)
    expect(onlyAsr.manual).toBeNull()
    expect(onlyAsr.asr).toBe(SAMPLE_XML)
    expect(await decodeGrabHash(`#grab=${await encodeGrabPayload('UQecj-5Tiqw', {})}`)).toBeNull()
  })

  it('still reads a v1 hash, a bookmark made before both tracks came', async () => {
    let bin = ''
    new TextEncoder().encode(SAMPLE_XML).forEach(b => { bin += String.fromCharCode(b) })
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const grab = await decodeGrabHash(`#grab=v1.r.UQecj-5Tiqw.${b64}`)
    expect(grab.manual).toBe(SAMPLE_XML)
    expect(grab.asr).toBeNull()
  })

  it('compresses when the platform can (the hash rides a URL)', async () => {
    // Node ≥18 and every current browser have CompressionStream; the
    // payload marks its mode so a raw fallback still decodes.
    const payload = await encodeGrabPayload('UQecj-5Tiqw', { manual: SAMPLE_XML })
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
    // It takes both Japanese tracks, the hand-written and the
    // recognised, in the format that times each recognised word.
    expect(src).toContain("languageCode==='ja'&&t.kind!=='asr'")
    expect(src).toContain("languageCode==='ja'&&t.kind==='asr'")
    expect(src).toContain("'&fmt=srv3'")
    expect(src).toContain('#grab=v2.')
  })
})
