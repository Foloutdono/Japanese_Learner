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
//
// v2 (2026-09-27, the words lit as they are said): the grab brings
// BOTH Japanese tracks in YouTube's srv3 format, the hand-written one
// and the recognised one. srv3 is the format that keeps the
// recogniser's time on every word (<s t="…">); the lines studied are
// still the hand-written ones where they exist, and the recognised
// track goes up beside them only as the clock their words are read
// out on (backend/study/word_timing.py).
//
// v3 (plan 242, "if the subtitles translated are available take
// them"): beside the two, the video's own hand-written French and
// English tracks, where its makers wrote them. They are never the lines
// studied: they go up as the lines' translation, which the server reads
// off them by time (backend/study/line_translate.from_track) and asks
// the model only for what they leave. A v2 bookmark still works; its
// lines are translated by the model alone.
//
// p1 (plan 265, "not only YouTube"): off youtube.com the same bookmark
// reads the page's own player. A site that plays its video in an HTML5
// <video> with its subtitles as text tracks (a <track> file, or cues a
// player script added) has them in the page, on the learner's screen,
// from the learner's own IP: the bookmark takes the Japanese track,
// writes it as WebVTT, and comes back through the same hash, with the
// page's media address where it is a plain https file the analyser's
// own player can play (never a blob: of a streaming player, which
// nothing outside the page can). A page that only embeds a YouTube
// video is sent to that video's own page, where the v3 grab works. A
// DRM service's subtitles are drawn by its player, not served as text
// tracks: those still come in as a file (plan 265's TTML).

const GRAB_VERSION = 'v3'
const PAGE_VERSION = 'p1'
// A page's host, which names the session's file: a hostname and
// nothing else, so nothing but a name reaches the hash's decoder.
const PAGE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i
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

// A cue's text as one VTT line: no line breaks, nothing a VTT reader
// would take for markup of its own.
function vttSafe(s) {
  return s.replace(/\s*\n\s*/g, ' ').replace(/</g, '‹').replace(/-->/g, '→')
}
function vttText(s) {
  return vttSafe(s).trim()
}

function attr(attrs, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)
  return m ? m[1] : null
}

// srv3: <p t="ms" d="ms">…</p>, and in a recognised track each word an
// <s> whose t is its offset from the paragraph's. Each word after the
// first is written as a VTT karaoke stamp before it, which the backend
// reads as that word's time (study/captions.py). A recognised track's
// paragraphs overlap on screen (two lines roll together), so a cue is
// cut where the next one starts: the lines' times are when they are
// SAID, which is what the player follows.
function srv3Cues(xml) {
  const paras = []
  const re = /<p\b([^>]*?)(?:\/>|>([\s\S]*?)<\/p>)/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const t = parseFloat(attr(m[1], 't'))
    const d = parseFloat(attr(m[1], 'd') ?? '0')
    if (!Number.isFinite(t) || m[2] == null) continue
    const inner = m[2]
    let text = ''
    if (/<s\b/.test(inner)) {
      const segRe = /<s\b([^>]*)>([\s\S]*?)<\/s>/g
      let g
      while ((g = segRe.exec(inner)) !== null) {
        const word = vttSafe(decodeEntities(g[2].replace(/<[^>]*>/g, '')))
        if (!word.trim()) continue
        const offset = parseFloat(attr(g[1], 't') ?? '0')
        if (text && offset > 0) text += `<${vttTime((t + offset) / 1000)}>`
        text += text ? word : word.trimStart()
      }
    } else {
      text = vttText(decodeEntities(inner.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]*>/g, '')))
    }
    text = text.trim()
    if (text) paras.push({ start: t / 1000, end: (t + (d || 2000)) / 1000, text })
  }
  return paras.map((p, i) => {
    const next = paras[i + 1]
    const end = next && next.start < p.end && next.start > p.start ? next.start : p.end
    return `${vttTime(p.start)} --> ${vttTime(end)}\n${p.text}`
  })
}

// The legacy format: <text start="s" dur="s">…</text>, a line a node.
function legacyCues(xml) {
  const cues = []
  const re = /<text start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const text = vttText(decodeEntities(m[3]))
    if (!text) continue
    const start = parseFloat(m[1])
    const dur = m[2] != null ? parseFloat(m[2]) : 2
    cues.push(`${vttTime(start)} --> ${vttTime(start + dur)}\n${text}`)
  }
  return cues
}

// Regex, not DOMParser, on purpose: the transcript formats are flat,
// machine-written lists of nodes, and this must run in the node test
// lane where DOMParser does not exist. Either format, told apart by
// its nodes.
export function transcriptXmlToVtt(xml) {
  const source = xml ?? ''
  const cues = /<p\b[^>]*\bt="/.test(source) ? srv3Cues(source) : legacyCues(source)
  if (cues.length === 0) {
    throw new Error('No cues in transcript XML')
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

// ── The hash codec ────────────────────────────────────────
// Payload shape: grab=v3.<z|r>.<videoId>.<base64url>  — z is gzip,
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

// The languages a video's own translation is taken in: those the app
// is read in (backend/study/line_translate.TRACK_LANGS).
export const TRANSLATION_LANGS = ['fr', 'en']

// The payload is the tracks as JSON: {m: the hand-written track's XML
// or null, a: the recognised one's or null, t: {lang: the video's own
// translation's XML}, only the languages it has}.
export async function encodeGrabPayload(videoId, { manual = null, asr = null, translations = {} }) {
  let bytes = new TextEncoder().encode(JSON.stringify({ m: manual, a: asr, t: translations }))
  let mode = 'r'
  if (typeof CompressionStream !== 'undefined') {
    bytes = await pipeBytes(bytes, CompressionStream, 'gzip')
    mode = 'z'
  }
  return `${GRAB_VERSION}.${mode}.${videoId}.${toBase64Url(bytes)}`
}

// {videoId, manual, asr, translations} -- either Japanese track may be
// null, never both; translations {lang: XML}, empty where the video has
// none or the bookmark is older than v3 -- or null for "not a grab hash
// / not one we can read": the screen treats null as none of its
// business. Never throws. A v1 hash (a bookmark made before v2)
// carried the one track, as XML.
export async function decodeGrabHash(hash) {
  try {
    const match = /[#&]grab=([^&]+)/.exec(hash ?? '')
    if (!match) return null
    if (match[1].startsWith(`${PAGE_VERSION}.`)) return await decodePageGrab(match[1])
    const [version, mode, videoId, data] = match[1].split('.')
    if (!['v1', 'v2', GRAB_VERSION].includes(version) || !data || !VIDEO_ID.test(videoId ?? '')) return null
    if (mode !== 'z' && mode !== 'r') return null
    let bytes = fromBase64Url(data)
    if (mode === 'z') {
      bytes = await pipeBytes(bytes, DecompressionStream, 'gzip')
    }
    const body = new TextDecoder().decode(bytes)
    if (version === 'v1') return { videoId, manual: body, asr: null, translations: {} }
    const { m, a, t } = JSON.parse(body)
    const manual = typeof m === 'string' && m ? m : null
    const asr = typeof a === 'string' && a ? a : null
    const translations = Object.fromEntries(TRANSLATION_LANGS
      .filter(lang => typeof t?.[lang] === 'string' && t[lang])
      .map(lang => [lang, t[lang]]))
    return manual || asr ? { videoId, manual, asr, translations } : null
  } catch {
    return null
  }
}

// A page's grab (p1): `p1.<z|r>.<host>.<base64url>`, the host's own
// dots inside it, so the payload is the last part and the host is all
// between the mode and it. The payload: {v: the Japanese track as
// WebVTT, s: the page's media address or '', n: the page's title}.
// {page, vtt, mediaUrl, title}, or null.
async function decodePageGrab(raw) {
  const parts = raw.split('.')
  const mode = parts[1]
  const data = parts[parts.length - 1]
  const page = parts.slice(2, -1).join('.')
  if ((mode !== 'z' && mode !== 'r') || !data || !PAGE_HOST.test(page) || page.length > 253) return null
  let bytes = fromBase64Url(data)
  if (mode === 'z') bytes = await pipeBytes(bytes, DecompressionStream, 'gzip')
  const { v, s, n } = JSON.parse(new TextDecoder().decode(bytes))
  if (typeof v !== 'string' || !v.includes('-->')) return null
  const mediaUrl = typeof s === 'string' && /^https?:\/\//.test(s) && s.length <= 2000 ? s : null
  const title = typeof n === 'string' ? n.slice(0, 200) : ''
  return { page, vtt: v, mediaUrl, title }
}

// What the page grab sends, as the bookmark does (the tests' half).
export async function encodePagePayload(host, { vtt, mediaUrl = '', title = '' }) {
  let bytes = new TextEncoder().encode(JSON.stringify({ v: vtt, s: mediaUrl, n: title }))
  let mode = 'r'
  if (typeof CompressionStream !== 'undefined') {
    bytes = await pipeBytes(bytes, CompressionStream, 'gzip')
    mode = 'z'
  }
  return `${PAGE_VERSION}.${mode}.${host}.${toBase64Url(bytes)}`
}

// ── The bookmarklet ───────────────────────────────────────
// Self-contained, runs on youtube.com. Everything it does, the
// learner's own player does on the same page: one InnerTube player
// call, one caption fetch. It never sees credentials (the caption
// fetch omits them) and it leaves the page for the app's analyzer
// with the result in the hash.
//
// What it says when it cannot (plan 215) is in the learner's language,
// baked in when the bookmark is copied: on youtube.com it has no app
// to ask, and a bookmark copied in French should not answer in English.
// `t` is the locale table the copy button holds; only the grabAlert*
// lines are taken from it, as a JSON literal the source reads.
const GRAB_ALERTS = {
  noMedia: 'grabAlertNoMedia',
  embedYoutube: 'grabAlertEmbedYoutube',
  noVideo: 'grabAlertNoVideo',
  notReady: 'grabAlertNotReady',
  noSubtitles: 'grabAlertNoSubtitles',
  noJapanese: 'grabAlertNoJapanese',
  empty: 'grabAlertEmpty',
  failed: 'grabAlertFailed',
}

export function buildBookmarklet(appOrigin, t) {
  const said = Object.fromEntries(Object.entries(GRAB_ALERTS).map(([k, key]) => [k, t[key]]))
  const src =
    `(async()=>{var S=${JSON.stringify(said)};try{` +
    `var B=async function(bytes,tag){var mode='r';` +
    `if(window.CompressionStream){bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());mode='z'}` +
    `var bin='';for(var i=0;i<bytes.length;i+=32768){bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768))}` +
    `location.href='${appOrigin}/analyzer#grab='+tag(mode)+'.'+btoa(bin).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')};` +
    `if(!/(^|\\.)youtube\\.com$/.test(location.hostname)){` +
    // Off YouTube: the page's own player (p1, see the head).
    `var yt=[].slice.call(document.querySelectorAll('iframe')).map(function(f){return(f.src.match(/youtube(?:-nocookie)?\\.com\\/embed\\/([\\w-]{11})/)||[])[1]}).filter(Boolean)[0];` +
    `var ms=[].slice.call(document.querySelectorAll('video,audio'));` +
    `if(!ms.length){if(yt&&confirm(S.embedYoutube)){location.href='https://www.youtube.com/watch?v='+yt}else if(!yt){alert(S.noMedia)}return}` +
    `var J=function(l,n){return/^(ja|jpn?)([-_]|$)/i.test(l||'')||/日本語|japan|japon/i.test(n||'')};` +
    `var K=/[\\u3040-\\u30ff\\u4e00-\\u9fff]/;` +
    `var T=function(x){var z=Math.max(0,Math.round(x*1000)),p=function(n,w){return String(n).padStart(w,'0')};return p(Math.floor(z/3600000),2)+':'+p(Math.floor(z/60000)%60,2)+':'+p(Math.floor(z/1000)%60,2)+'.'+p(z%1000,3)};` +
    `var langs=[],got=null;` +
    `for(var m of ms){` +
    `for(var el of [].slice.call(m.querySelectorAll('track'))){var k=el.kind||'subtitles';if(k!=='subtitles'&&k!=='captions')continue;langs.push(el.srclang||el.label||'?');` +
    `if(got||!(J(el.srclang,el.label)||!(el.srclang||el.label))||!el.src)continue;` +
    `try{var x=await fetch(el.src).then(function(r){return r.text()});if(x.indexOf('-->')>=0&&K.test(x))got=x}catch(e){}}` +
    `for(var tt of [].slice.call(m.textTracks||[])){if(tt.kind!=='subtitles'&&tt.kind!=='captions')continue;langs.push(tt.language||tt.label||'?');` +
    `if(got||!(J(tt.language,tt.label)||!(tt.language||tt.label)))continue;` +
    `var was=tt.mode;if(was==='disabled'){tt.mode='hidden';await new Promise(function(r){setTimeout(r,1500)})}` +
    `var cs=[].slice.call(tt.cues||[]).map(function(c){return T(c.startTime)+' --> '+T(c.endTime)+'\\n'+String(c.text||'').replace(/\\s*\\n\\s*/g,' ').replace(/-->/g,'→').trim()}).filter(function(c){return!/\\n$/.test(c)});` +
    `tt.mode=was;var v='WEBVTT\\n\\n'+cs.join('\\n\\n')+'\\n';if(cs.length&&K.test(v))got=v}}` +
    `if(!got){if(yt&&confirm(S.embedYoutube)){location.href='https://www.youtube.com/watch?v='+yt;return}` +
    `alert(langs.length?S.noJapanese+langs.filter(function(l,i){return langs.indexOf(l)===i}).join(', '):S.noSubtitles);return}` +
    `var src=ms.map(function(m){return m.currentSrc||''}).filter(function(u){return/^https?:\\/\\//.test(u)})[0]||'';` +
    `await B(new TextEncoder().encode(JSON.stringify({v:got,s:src,n:document.title.slice(0,200)})),function(mode){return'${PAGE_VERSION}.'+mode+'.'+location.hostname});return}` +
    `var vid=new URLSearchParams(location.search).get('v')||(location.pathname.match(/\\/(?:shorts|embed|live)\\/([\\w-]{11})/)||[])[1];` +
    `if(!vid){alert(S.noVideo);return}` +
    `var key=window.ytcfg&&ytcfg.data_&&ytcfg.data_.INNERTUBE_API_KEY;` +
    `if(!key){alert(S.notReady);return}` +
    `var pr=await fetch('/youtubei/v1/player?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:{client:{clientName:'ANDROID',clientVersion:'20.10.38'}},videoId:vid})}).then(function(r){return r.json()});` +
    `var ts=pr&&pr.captions&&pr.captions.playerCaptionsTracklistRenderer&&pr.captions.playerCaptionsTracklistRenderer.captionTracks||[];` +
    `if(!ts.length){alert(S.noSubtitles);return}` +
    `var man=ts.find(function(t){return t.languageCode==='ja'&&t.kind!=='asr'});` +
    `var asr=ts.find(function(t){return t.languageCode==='ja'&&t.kind==='asr'});` +
    `if(!man&&!asr){alert(S.noJapanese+ts.map(function(t){return t.languageCode}).join(', '));return}` +
    // Both in srv3, the format that keeps a time on every recognised word.
    `var get=async function(t){if(!t)return null;var x=await fetch(t.baseUrl.replace(/&fmt=[^&]*/,'')+'&fmt=srv3',{credentials:'omit'}).then(function(r){return r.text()});return x&&x.indexOf('<p')>=0?x:null};` +
    `var m=await get(man),a=await get(asr);` +
    `if(!m&&!a){alert(S.empty);return}` +
    // The video's own translation, hand-written, in each language the
    // app is read in; best effort, a track that will not come is left out.
    `var tr={};for(var L of ${JSON.stringify(TRANSLATION_LANGS)}){try{var x=await get(ts.find(function(t){return t.kind!=='asr'&&(t.languageCode===L||t.languageCode.indexOf(L+'-')===0)}));if(x)tr[L]=x}catch(e){}}` +
    `await B(new TextEncoder().encode(JSON.stringify({m:m,a:a,t:tr})),function(mode){return'${GRAB_VERSION}.'+mode+'.'+vid})` +
    `}catch(e){alert(S.failed+e)}})()`
  return `javascript:${encodeURIComponent(src)}`
}
