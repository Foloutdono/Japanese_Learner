// ── The three feeds a 9:16 video is posted to (plan 251) ─────────────
// YouTube Shorts takes a title, a description and tags: the page each
// video already writes. Instagram's Reels and TikTok take one caption,
// where a link is not a link (the app is "in bio") and five hashtags at
// most are kept: Instagram's rule since December 2025, and TikTok's
// reach falls past about as many. Each caption opens on the video's hook,
// what the feed shows before its "more", then asks for what that feed
// rewards: a save on Instagram, a comment on TikTok.

export const FEEDS = ['shorts', 'reels', 'tiktok']
export const FEED_NAMES = { shorts: 'YouTube Shorts', reels: 'Instagram Reels', tiktok: 'TikTok' }
export const HASHTAGS = 5
// Instagram's limit, and TikTok's when a caption is posted by its API.
export const CAPTION_MAX = 2200

const SAY = {
  en: {
    bio: 'Link in bio.',
    reels: '📌 Save it for your next study session.',
    tiktok: '👇 Tell me in the comments how it went.',
  },
  fr: {
    bio: 'Lien en bio.',
    reels: '📌 Enregistre-la pour ta prochaine séance.',
    tiktok: '👇 Dis-moi en commentaire comment ça s’est passé.',
  },
}

/** A video's posts for the three feeds: YouTube's `page` as it is, and a
 *  caption for each of the other two from `parts`: its `hook`, its
 *  `lines`, the app said without its link (`app`), an `ask` of its own
 *  for the comments (`reels`, one for Instagram's too, in place of its
 *  save), its `credits` and its `hashtags` in the order they
 *  matter (#shorts is YouTube's alone). */
export function feedPosts(page, parts, lang = 'en') {
  const S = SAY[lang] || SAY.en
  const seen = new Set()
  const tags = []
  for (const raw of parts.hashtags || []) {
    const tag = String(raw).replace(/^#/, '')
    const key = tag.toLowerCase()
    if (!tag || key === 'shorts' || seen.has(key)) continue
    seen.add(key)
    tags.push(`#${tag}`)
  }
  const caption = call => [
    parts.hook,
    ...(parts.lines || []),
    call,
    `${parts.app} ${S.bio}`,
    ...(parts.credits || []),
    tags.slice(0, HASHTAGS).join(' '),
  ].filter(Boolean).join('\n\n')
  return {
    shorts: { title: page.title, description: page.description, tags: page.tags },
    reels: { caption: caption(parts.reels || S.reels) },
    tiktok: { caption: caption(parts.ask ? `👇 ${parts.ask}` : S.tiktok) },
  }
}

/** The text a render writes beside a video: YouTube's page alone for a
 *  16:9 video, the three posts for a 9:16 one. */
export function pageFile(page) {
  const youtube = p => `TITLE\n${p.title}\n\nDESCRIPTION\n${p.description}\n\nTAGS\n${p.tags}\n`
  if (!page.feeds) return youtube(page)
  const rule = '─'.repeat(40)
  return FEEDS.map(f => {
    const post = page.feeds[f]
    return `${FEED_NAMES[f].toUpperCase()}\n\n${post.caption != null ? `CAPTION\n${post.caption}\n` : youtube(post)}`
  }).join(`\n${rule}\n\n`)
}
