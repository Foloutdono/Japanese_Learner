// ── 字幕取り — the subtitle grab ──────────────────────────
// Getting YouTube captions is walled off from everywhere EXCEPT the
// watch page itself, and that is a measured statement, not a guess
// (2026-09-01, all from this repo's own probes):
//
//   - server-side (Render):        IP-blocked (docs/adr/0003)
//   - browser, from our origin:    InnerTube sends no CORS headers;
//                                  timedtext answers 200 with an
//                                  EMPTY body (proof-of-origin token)
//   - public mirrors (9 probed):   down, erroring, or 200-empty
//   - the watch page's own origin: an InnerTube `player` call with
//                                  the ANDROID client and the page's
//                                  own INNERTUBE_API_KEY returns
//                                  caption tracks whose URLs still
//                                  yield real bodies — 2,478 bytes of
//                                  Japanese cues in the probe
//
// So the fetch runs where it works: a bookmarklet the app mints, the
// learner keeps as a bookmark, and taps ON the video page. It grabs
// the Japanese track (manual over auto-generated), gzips it when the
// browser can, and hands it back through the URL hash — the only
// channel that crosses origins with no server, no key, no cookie,
// and no CORS in the way. The learner is fetching their own screen
// from their own IP, which is the same standing the retired paste
// ingest had (adr/0003, first amendment).
//
// The app's half: decode the hash, convert the transcript XML to
// WebVTT, and feed the EXISTING file ingest — nothing downstream of
// Cue knows this happened, which is what adr/0003 promised a new
// source would cost.

const GRAB_VERSION = 'v1'
// YouTube video ids: 11 URL-safe base64 chars today; bounded loosely
// so a format drift fails soft, but injection through the hash fails
// hard.
const VIDEO_ID = /^[\w-]{6,20}$/

// ── XML → WebVTT ──────────────────────────────────────────
// The endpoint double-escapes (an apostrophe arrives as &amp;#39;),
// so the entity pass runs twice; both passes are idempotent on clean
// text.
function decodeEntitiesOnce(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
function decodeEntities(s) {
  return decodeEntitiesOnce(decodeEntitiesOnce(s))
}

function vttTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const pad = (n, w) => String(n).padStart(w, '0')
  return `${pad(Math.floor(ms / 3600000), 2)}:${pad(Math.floor(ms / 60000) % 60, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}.${pad(ms % 1000, 3)}`
}

// Regex, not DOMParser, on purpose: the transcript format is a flat,
// machine-written list of <text> nodes, and this must run in the
// node test lane where DOMParser does not exist.
export function transcriptXmlToVtt(xml) {
  const cues = []
  const re = /<text start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g
  let m
  while ((m = re.exec(xml ?? '')) !== null) {
    const text = decodeEntities(m[3]).trim()
    if (!text) continue
    const start = parseFloat(m[1])
    const dur = m[2] != null ? parseFloat(m[2]) : 2
    cues.push(`${vttTime(start)} --> ${vttTime(start + dur)}\n${text}`)
  }
  if (cues.length === 0) {
    throw new Error('No cues in transcript XML')
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

// ── The hash codec ────────────────────────────────────────
// Payload shape: grab=v1.<z|r>.<videoId>.<base64url>  — z is gzip,
// r is raw UTF-8; the bookmarklet compresses when the browser has
// CompressionStream (every current one does) and falls back rather
// than failing.

function toBase64Url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 32768) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 32768))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function pipeBytes(bytes, TransformCtor, kind) {
  const stream = new Blob([bytes]).stream().pipeThrough(new TransformCtor(kind))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeGrabPayload(videoId, xml) {
  let bytes = new TextEncoder().encode(xml)
  let mode = 'r'
  if (typeof CompressionStream !== 'undefined') {
    bytes = await pipeBytes(bytes, CompressionStream, 'gzip')
    mode = 'z'
  }
  return `${GRAB_VERSION}.${mode}.${videoId}.${toBase64Url(bytes)}`
}

// Null for "not a grab hash / not one we can read" — the screen
// treats null as none of its business. Never throws.
export async function decodeGrabHash(hash) {
  try {
    const match = /[#&]grab=([^&]+)/.exec(hash ?? '')
    if (!match) return null
    const [version, mode, videoId, data] = match[1].split('.')
    if (version !== GRAB_VERSION || !data || !VIDEO_ID.test(videoId ?? '')) return null
    if (mode !== 'z' && mode !== 'r') return null
    let bytes = fromBase64Url(data)
    if (mode === 'z') {
      bytes = await pipeBytes(bytes, DecompressionStream, 'gzip')
    }
    return { videoId, xml: new TextDecoder().decode(bytes) }
  } catch {
    return null
  }
}

// ── The bookmarklet ───────────────────────────────────────
// Self-contained, runs on youtube.com. Everything it does, the
// learner's own player does on the same page: one InnerTube player
// call, one caption fetch. It never sees credentials (the caption
// fetch omits them) and it leaves the page for the app's analyzer
// with the result in the hash.
export function buildBookmarklet(appOrigin) {
  const src =
    `(async()=>{try{` +
    `if(!/(^|\\.)youtube\\.com$/.test(location.hostname)){alert('Open the YouTube video first / Ouvrez d\\'abord la vid\\u00e9o YouTube');return}` +
    `var vid=new URLSearchParams(location.search).get('v')||(location.pathname.match(/\\/(?:shorts|embed|live)\\/([\\w-]{11})/)||[])[1];` +
    `if(!vid){alert('No video id in this page');return}` +
    `var key=window.ytcfg&&ytcfg.data_&&ytcfg.data_.INNERTUBE_API_KEY;` +
    `if(!key){alert('Page not ready - reload and retry');return}` +
    `var pr=await fetch('/youtubei/v1/player?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:{client:{clientName:'ANDROID',clientVersion:'20.10.38'}},videoId:vid})}).then(function(r){return r.json()});` +
    `var ts=pr&&pr.captions&&pr.captions.playerCaptionsTracklistRenderer&&pr.captions.playerCaptionsTracklistRenderer.captionTracks||[];` +
    `if(!ts.length){alert('This video has no subtitles / Pas de sous-titres');return}` +
    `var ja=ts.find(function(t){return t.languageCode==='ja'&&t.kind!=='asr'})||ts.find(function(t){return t.languageCode==='ja'});` +
    `if(!ja){alert('No Japanese subtitles. Available: '+ts.map(function(t){return t.languageCode}).join(', '));return}` +
    `var xml=await fetch(ja.baseUrl.replace('&fmt=srv3',''),{credentials:'omit'}).then(function(r){return r.text()});` +
    `if(!xml||xml.indexOf('<text')<0){alert('Subtitle fetch came back empty - try again');return}` +
    `var bytes=new TextEncoder().encode(xml);var mode='r';` +
    `if(window.CompressionStream){bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());mode='z'}` +
    `var bin='';for(var i=0;i<bytes.length;i+=32768){bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768))}` +
    `var b64=btoa(bin).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');` +
    `location.href='${appOrigin}/analyzer#grab=v1.'+mode+'.'+vid+'.'+b64` +
    `}catch(e){alert('Subtitle grab failed: '+e)}})()`
  return `javascript:${encodeURIComponent(src)}`
}
