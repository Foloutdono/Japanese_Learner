#!/usr/bin/env node
/**
 * Guard 6 -- the artboards.
 *
 * The five guards that already exist all watch the app. Nothing watched the
 * mockups, so the mockups drifted: by the time this was written the Stats board
 * still drew a streak the app had abandoned, the Controls board still showed a
 * primary button at a deepening two rounds stale, and ten state-coloured
 * figures across the set sat under the contrast floor the app itself had
 * already cleared. The complaint that prompted this was "we drift more and more
 * from the mockups" -- and the drift ran in BOTH directions.
 *
 * This measures each .dc.html against `_KIT.md` section 3 and the contrast
 * floor. It is deliberately narrow: it reports only what is true or false by
 * measurement, never a matter of taste. Judgement calls belong in a review, not
 * in a script that fails a build.
 *
 *   1. CONTRAST -- every inline `color:` against its ground, at 4.5:1, or 3:1
 *                  where the text is large (>=24px, or >=18.66px at weight >=700).
 *   2. SCALE    -- font-size / gap / border-radius literals off the kit's scales.
 *   3. LITERAL  -- a raw hex in the body where a token of that exact value is
 *                  already defined in the same file.
 *
 * Ratcheted like the others: `artboard-baseline.json` records what was already
 * wrong, so this fails only on NEW drift.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/* The artboards are NOT in this repo -- they live in the canvas artifact that
   DESIGN.md links, and on disk only in whatever scratchpad currently holds
   them. So unlike guards 1-5 this one cannot run in CI, and a missing
   directory is the normal case rather than an error: it skips, loudly enough
   to be noticed and quietly enough not to fail a build that was never able to
   run it. Point it at the boards with $ARTBOARDS_DIR or argv[2]. */
const DIR = process.argv.find((a) => !a.startsWith('-') && a.endsWith('mockups')) || process.env.ARTBOARDS_DIR
const BASE = join(process.cwd(), 'scripts', 'artboard-baseline.json')
const WRITE = process.argv.includes('--update-baseline')

if (!DIR) {
  console.log('Guard 6 (artboards): skipped -- no artboard directory.')
  console.log('  Set ARTBOARDS_DIR, or pass the path: npm run lint:artboards -- /path/to/mockups')
  process.exit(0)
}
if (!existsSync(DIR)) {
  console.error(`Guard 6 (artboards): ${DIR} does not exist.`)
  process.exit(2)
}

/* ---- colour maths, the same as the app's contrast guard ---- */
const srgb = (c) => ((c /= 255), c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const hex = (h) => {
  h = h.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const mixc = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)))

/* ---- the kit's scales (section 3) ---- */
const TYPE = ['0.62rem', '0.72rem', '0.82rem', '0.95rem', '1.12rem', '1.25rem', '1.7rem', '2.5rem']
const SPACE = [0, 4, 6, 8, 12, 16, 22, 28, 44, 52]
const RADIUS = [0, 4, 6, 8, 10, 999]

/* Resolve a colour expression to RGB using the file's own :root tokens. */
function resolve(expr, tokens, depth = 0) {
  if (!expr || depth > 6) return null
  expr = expr.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(expr)) return hex(expr.slice(0, 7))
  let m = expr.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/)
  if (m) {
    if (tokens[m[1]] !== undefined) return resolve(tokens[m[1]], tokens, depth + 1)
    return m[2] ? resolve(m[2], tokens, depth + 1) : null
  }
  m = expr.match(/^color-mix\(\s*in\s+srgb\s*,\s*([\s\S]+?)\s+([\d.]+)%\s*,\s*([\s\S]+?)\s*\)$/)
  if (m) {
    const a = resolve(m[1], tokens, depth + 1)
    const b = resolve(m[3], tokens, depth + 1)
    if (!a || !b) return null
    return mixc(a, b, parseFloat(m[2]) / 100)
  }
  m = expr.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,]+([\d.]+))?/)
  if (m) {
    const rgb = [+m[1], +m[2], +m[3]]
    const a = m[4] === undefined ? 1 : parseFloat(m[4])
    /* An alpha ground is not its own colour: it composites over whatever is
       behind it. Ignoring that reports a tint as far more contrasty than it
       draws. `under` is the surface we assume is behind -- the page card. */
    return a >= 1 ? rgb : { rgb, alpha: a }
  }
  return null
}

/* Flatten a possibly-translucent colour over a known backdrop. */
function over(c, backdrop) {
  if (!c) return null
  if (Array.isArray(c)) return c
  if (!backdrop) return null
  return mixc(c.rgb, backdrop, c.alpha)
}

/* Inks that declare their own ground: they are only ever used on sumi or on a
   pigment fill, both of which are set by a parent class this parser cannot see.
   Judging them against the page card invents failures -- the exact mistake that
   produced ~60 false readings earlier in this wave. */
const PANEL_INKS = new Set(['--text-on-panel', '--text-on-panel-soft', '--text-on-fill'])

function tokensOf(src) {
  const t = {}
  for (const m of src.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    if (t[m[1]] === undefined) t[m[1]] = m[2].trim()
  }
  return t
}

/* px value of a font-size expression */
function px(fs) {
  if (!fs) return null
  let m = fs.match(/([\d.]+)rem/)
  if (m) return parseFloat(m[1]) * 16
  m = fs.match(/([\d.]+)px/)
  if (m) return parseFloat(m[1])
  return null
}

/* Sanity. Four separate measuring probes in this wave returned confident
   nonsense -- one read every element as exactly 1.00 because fillRect with a
   transparent colour draws nothing. Each run now proves the maths on a pair
   whose answer is known before trusting it on a pair whose answer is not. */
{
  const white = ratio([255, 255, 255], [0, 0, 0])
  if (Math.abs(white - 21) > 0.005) {
    console.error(`Guard 6: contrast maths is wrong -- white on black read ${white.toFixed(4)}, must be 21.`)
    process.exit(2)
  }
  const half = over({ rgb: [255, 255, 255], alpha: 0.5 }, [0, 0, 0])
  if (half[0] !== 128) {
    console.error(`Guard 6: alpha compositing is wrong -- 50% white on black gave ${half[0]}, expected 128.`)
    process.exit(2)
  }
}

const findings = []
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.dc.html'))
  .sort()

for (const f of files) {
  const src = readFileSync(join(DIR, f), 'utf8')
  const tok = tokensOf(src)

  /* Ground. We cannot build a DOM here, so a `color:` is judged only against a
     background set in the SAME style attribute, or -- when that attribute sets
     none -- against the page's card. This under-reports rather than inventing
     failures, which is the lesson from the four measuring-probe bugs earlier in
     this wave: a probe that reports a failure that is not there costs more than
     one that stays quiet. */
  const CARD = over(resolve(tok['--bg-card'] || '#201d24', tok), [32, 29, 36]) || [32, 29, 36]

  src.split('\n').forEach((line, i) => {
    const n = i + 1

    /* --- 1. contrast --- */
    for (const st of line.matchAll(/style\s*=\s*"([^"]*)"/g)) {
      const decl = st[1]
      const cm = decl.match(/(?:^|[;\s])color\s*:\s*([^;"]+)/)
      if (!cm) continue
      const bgm = decl.match(/background(?:-color)?\s*:\s*([^;"]+)/)

      /* A panel ink with no inline ground sits on a parent-set sumi or fill.
         We cannot see that parent, so we do not guess -- we stay quiet. */
      if (!bgm && PANEL_INKS.has(cm[1].trim().replace(/^var\(\s*|\s*\)$/g, ''))) continue

      const fg = over(resolve(cm[1], tok), CARD)
      const bg = over(bgm ? resolve(bgm[1], tok) : CARD, CARD)
      if (!fg || !bg) continue

      /* fg === bg is not a design; it is this parser having the wrong ground
         (the element's real ground comes from a class, not the inline style).
         Nobody draws invisible text on purpose, so treat it as unknown. */
      if (fg[0] === bg[0] && fg[1] === bg[1] && fg[2] === bg[2]) continue
      const size = px((decl.match(/font-size\s*:\s*([^;"]+)/) || [])[1]) ?? 15.2
      const wm = decl.match(/font-weight\s*:\s*(\d+)/)
      const weight = wm ? +wm[1] : 400
      /* An element whose colour only ever reaches an <svg> via currentColor is
         drawing a GLYPH, not setting type. WCAG puts non-text content at 3:1,
         not 4.5:1 -- judging an icon as body text over-reports, and a guard
         that cries wolf gets switched off. */
      const rest = line.slice(st.index + st[0].length)
      const icon = /^[^>]*>\s*<svg\b/.test(rest)

      const large = size >= 24 || (size >= 18.66 && weight >= 700)
      const floor = icon ? 3 : large ? 3 : 4.5
      const r = ratio(fg, bg)
      if (r < floor) {
        findings.push({
          file: f,
          line: n,
          kind: 'contrast',
          detail: `${r.toFixed(2)}:1 < ${floor} (${icon ? 'icon' : `${size.toFixed(1)}px/${weight}`})`,
        })
      }
    }

    /* --- 2. scale --- */
    for (const m of line.matchAll(/font-size\s*:\s*([\d.]+rem)/g)) {
      if (!TYPE.includes(m[1])) findings.push({ file: f, line: n, kind: 'scale', detail: `font-size ${m[1]}` })
    }
    for (const m of line.matchAll(/(?:^|[;\s"])gap\s*:\s*(\d+)px/g)) {
      if (!SPACE.includes(+m[1])) findings.push({ file: f, line: n, kind: 'scale', detail: `gap ${m[1]}px` })
    }
    for (const m of line.matchAll(/border-radius\s*:\s*(\d+)px/g)) {
      if (!RADIUS.includes(+m[1])) findings.push({ file: f, line: n, kind: 'scale', detail: `border-radius ${m[1]}px` })
    }

    /* --- 3. a raw hex that duplicates an existing token --- */
    if (!/^\s*--/.test(line)) {
      for (const m of line.matchAll(/:\s*(#[0-9a-fA-F]{6})\b/g)) {
        const v = m[1].toLowerCase()
        const named = Object.entries(tok).find(([, tv]) => tv.trim().toLowerCase() === v)
        if (named) findings.push({ file: f, line: n, kind: 'literal', detail: `${v} is ${named[0]}` })
      }
    }
  })
}

/* ---- ratchet ---- */
const key = (x) => `${x.file}|${x.kind}|${x.detail}`
const counts = {}
for (const x of findings) counts[key(x)] = (counts[key(x)] || 0) + 1

if (WRITE) {
  writeFileSync(BASE, JSON.stringify(counts, null, 1) + '\n')
  console.log(
    `Guard 6 (artboards): baseline written -- ${Object.keys(counts).length} kinds, ` +
      `${findings.length} occurrences across ${files.length} boards.`
  )
  process.exit(0)
}

const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : {}
const fresh = []
for (const [k, c] of Object.entries(counts)) {
  const was = base[k] || 0
  if (c > was) fresh.push(`${k}  (${was} -> ${c})`)
}

const byKind = {}
for (const x of findings) byKind[x.kind] = (byKind[x.kind] || 0) + 1

if (fresh.length) {
  console.error('Guard 6 (artboards): NEW drift.\n')
  for (const l of fresh) console.error('  ' + l)
  console.error(`\n${fresh.length} new. Fix them, or re-baseline with --update-baseline if deliberate.`)
  process.exit(1)
}
console.log('Guard 6 (artboards): no new drift.')
console.log(
  `  ${files.length} boards, ${findings.length} occurrences on the baseline ` +
    `(${Object.entries(byKind)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}).`
)
