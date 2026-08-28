// ── のりば — the three platforms at 解析 ───────────────────
// THE registry for the analyser's source key space. One list, read by
// the rail that draws the signs and by the screen that mounts the
// panels.
//
// It exists because that key space was enumerated in four places
// (SourceRail's own array, three `source === '...'` branches, and a
// `source !== 'video'` special case), and this codebase has already
// paid for that mistake once. config/stations.js records it:
//
//   "It was one of four places the mode key space was enumerated, and
//    the quietest: an unmapped key made serviceFor() return null, and
//    ModeSelector then fell back to a 番線 platform number -- so a mode
//    card silently rendered as if it were a source picker, with no
//    error anywhere."
//
// The same fix applies here, including its second half: a test asserts
// every key in this registry has a panel to mount
// (sources.browser.test.jsx), so a fourth source cannot get a sign on
// the rail and nothing behind it.
//
//   key      the discriminator the screen holds in state
//   no       番線 -- the platform number on the sign
//   jp/kana  the name and its reading, the two upper registers of a 駅名標
//   label    locale key for the plain-language name (the lowest register)
//   hint     locale key for the tooltip / tablist description
//   lead     locale key for the one line the intake panel opens with
//   busy     locale key for the line shown while THIS platform is working
//   history  whether 運行履歴 applies. True for all three platforms since
//            plan 040 added GET /api/video/sessions; it was false for
//            動画 only because a session was reachable by id and by
//            nothing else. Kept as a field rather than dropped now that
//            every entry is `true`: it is the seam a fourth source would
//            use, and removing it would mean the screen hard-codes the
//            panel's presence instead of reading it from the registry.
export const SOURCES = [
  { key: 'text',  no: 1, jp: '文字', kana: 'もじ',     label: 'sourceText',  hint: 'sourceTextHint',  lead: 'intakeTextLead',  busy: 'analyzingText',  history: true },
  { key: 'photo', no: 2, jp: '写真', kana: 'しゃしん', label: 'sourcePhoto', hint: 'sourcePhotoHint', lead: 'intakePhotoLead', busy: 'analyzingPhoto', history: true },
  { key: 'video', no: 3, jp: '動画', kana: 'どうが',   label: 'sourceVideo', hint: 'sourceVideoHint', lead: 'intakeVideoLead', busy: 'analyzingVideo', history: true },
]

/** The platform the learner is standing on. Never undefined for a key
 *  that came from SOURCES, which is the only place keys come from. */
export function sourceFor(key) {
  return SOURCES.find(s => s.key === key)
}

export const DEFAULT_SOURCE = SOURCES[0].key
