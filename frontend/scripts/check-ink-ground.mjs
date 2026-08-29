// Guard 5: the ink/ground structural rule.
//
// Guard 4 measures contrast, but it can only measure what it has been shown:
// its site sweep renders a curated fixture, so it covers a sample of the app,
// not the sheet. This guard covers the whole sheet, and answers a different,
// narrower question that needs no colour maths at all:
//
//   is this rule using an ink that belongs to a DIFFERENT ground than the one
//   it is sitting on?
//
// That is the defect class that produced every real failure found so far. The
// sheet has two ink families and they are not interchangeable:
//
//   --text-primary / --text-secondary   flip with the theme. They are paper
//                                       inks, dark on light in light theme.
//   --text-on-panel / --text-on-panel-soft   never flip. Sumi is dark in BOTH
//                                       themes, so its inks are constant.
//
// Put an ambient ink on sumi and dark theme hides it completely -- the ink is
// pale there and reads 7:1 -- while light theme flips it dark-on-dark. The
// Today strip shipped that way at 2.80:1, and .deckdetail-btn--muted and
// .comp-option-btn__letter at 3.04:1, all of them invisible to a reviewer
// working in dark theme. The reverse (a panel ink on paper) is worse still,
// at 1.77-2.17:1.
//
// WHY THIS IS TRACTABLE STATICALLY, when "what is behind this element" in
// general is not: BEM naming already encodes containment. `.X--m` is the SAME
// box as `.X`, so if `.X` paints sumi, `.X--m` is on sumi -- that is not an
// inference, it is the same element. `.X__e` is a descendant of `.X` by the
// convention this sheet follows throughout. So a block whose own rule paints a
// ground hands that ground to its modifiers and elements, and any of them
// naming the other family's ink is a defect that needs no DOM to see.
//
// The ground is taken ONLY from a rule whose selector is exactly the block
// (`.X`, optionally with pseudo-classes). Deliberately not from `.X__e` or
// `.X--m`: `.phrase-word-card__surface-wrap--clickable:hover` paints sumi, and
// letting that mark the whole `phrase-word-card` block as sumi would flag
// `.phrase-word-card__reading`, which sits on paper and measures 5.29:1.
//
// A rule that paints its own opaque background is exempt -- it establishes its
// own ground and the block's no longer applies (`.leaderboard-row__rank` is a
// sumi disc inside a paper row, correctly inked --text-on-panel-soft).
//
// Indirection through a custom property is invisible here on purpose. Where
// one element has two grounds, the fix is to name the pair once on the block
// and let children read it (`--ns-ink` / `--ns-ink-soft` on `.next-service`),
// and those children resolve to neither family by name. That is the intended
// escape hatch, not a hole.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = join(HERE, '..')
const CSS_PATH = join(FRONTEND_DIR, 'src', 'index.css')
const ALLOW_PATH = join(FRONTEND_DIR, 'src', 'design-ink-ground.json')

const AMBIENT_INKS = ['--text-primary', '--text-secondary']
const PANEL_INKS = ['--text-on-panel', '--text-on-panel-soft']
// --bg-panel is the only sumi token; everything else in the sheet's ground
// vocabulary is paper. --paper is theme-independent white, so it is paper.
const SUMI_GROUNDS = ['--bg-panel']
const PAPER_GROUNDS = ['--bg-main', '--bg-card-hover', '--bg-card', '--surface', '--paper']

// Same comment-stripping discipline as the other guards: this sheet quotes
// real declarations inside comments constantly, and a scan that does not strip
// first reports violations that do not exist. Newlines are preserved so the
// reported line numbers stay true.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

function parseRules(text) {
  const rules = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text))) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    if (!selector || selector.startsWith('@')) continue
    rules.push({
      selector,
      decls: m[2],
      line: text.slice(0, m.index).split('\n').length,
    })
  }
  return rules
}

function decl(decls, prop) {
  const re = new RegExp('(?:^|;)[ \\t\\r\\n]*' + prop + '[ \\t\\r\\n]*:([^;]*)', 'i')
  const m = decls.match(re)
  return m ? m[1].trim().replace(/\s+/g, ' ') : ''
}

// The element a compound selector actually styles is its LAST compound.
function lastCompound(sel) {
  return sel.trim().split(/[\s>+~]+/).filter(Boolean).pop() ?? ''
}

// `.deckdetail-btn--muted:hover` -> { block: 'deckdetail-btn', exact: false }
// `.deckdetail-btn:hover`        -> { block: 'deckdetail-btn', exact: true }
function classify(compound) {
  const m = compound.match(/^\.([a-z][a-z0-9-]*(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?)/i)
  if (!m) return null
  const name = m[1]
  const block = name.split('__')[0].split('--')[0]
  // "exact" means the selector targets the block itself, not an element or a
  // modifier of it -- and carries no second class that could change its ground.
  const rest = compound.slice(m[0].length)
  const exact = name === block && !/^\./.test(rest) && !rest.includes('.')
  return { block, name, exact }
}

/* Four answers, not two.
 *
 * `fill` is the third ground and it is not this guard's business. DESIGN.md:
 * a filled pigment takes --text-on-panel or --text-on-fill depending on the
 * fill's own lightness, which is a measurement, and measuring is Guard 4's
 * job. Flagging those here would be reporting the app's own documented rule
 * as a violation -- .exam-sheet__chip--answered fills with --accent and inks
 * --text-on-panel exactly as prescribed.
 *
 * `none` means the rule paints transparent, which does not establish a ground
 * so much as defer to whatever is behind it. Unknowable from source, so the
 * check is skipped rather than guessed (.next-service--clear is this case).
 */
function groundOf(value) {
  if (!value) return null
  if (/^(transparent|none)$/i.test(value.trim())) return 'none'
  for (const g of SUMI_GROUNDS) if (value.includes(`var(${g})`)) return 'sumi'
  for (const g of PAPER_GROUNDS) if (value.includes(`var(${g})`)) return 'paper'
  // A pigment, a gradient, a raw colour, an overlay -- anything that paints
  // but is not one of the two named grounds.
  return 'fill'
}

function inkFamilyOf(value) {
  if (!value) return null
  for (const i of PANEL_INKS) if (value.includes(`var(${i})`)) return 'panel'
  for (const i of AMBIENT_INKS) if (value.includes(`var(${i})`)) return 'ambient'
  return null
}

function backgroundOf(decls) {
  return decl(decls, 'background') || decl(decls, 'background-color')
}

function main() {
  const write = process.argv.includes('--write')
  const raw = readFileSync(CSS_PATH, 'utf8')
  const text = stripComments(raw)
  const rules = parseRules(text)
  const rel = relative(FRONTEND_DIR, CSS_PATH).split('\\').join('/')

  /* Pass 1, two maps, because the nearest painted ground is the one that
   * counts. `nameGround` is keyed by the full element name
   * (`exam-sheet__chip--answered`), so a background declared on ANY rule for
   * that element -- its base rule, a modifier, a :hover -- reaches the rule
   * that only sets a colour. Without this the guard flags every hover rule
   * that restates the ink of a fill declared one line above it.
   * `blockGround` is the fallback, and is taken only from rules targeting the
   * block itself. */
  const nameGround = new Map()
  const blockGround = new Map()
  for (const rule of rules) {
    const ground = groundOf(backgroundOf(rule.decls))
    if (!ground) continue
    for (const sel of rule.selector.split(',')) {
      const compound = lastCompound(sel)
      /* Resting state only. A :hover overlay is a tint ON the ground, not a
       * different ground, and counting it made .comp-option-btn look painted
       * two ways -- which dropped it as "mixed" and let its __letter rule
       * (a real 3.04:1 defect) through. */
      if (compound.includes(':')) continue
      const info = classify(compound)
      if (!info) continue
      const priorName = nameGround.get(info.name)
      nameGround.set(info.name, priorName && priorName !== ground ? 'mixed' : ground)
      if (!info.exact) continue
      // A block painted both ways by different rules cannot be judged; drop it
      // rather than guess, and say so in the summary.
      const prior = blockGround.get(info.block)
      blockGround.set(info.block, prior && prior !== ground ? 'mixed' : ground)
    }
  }

  // Pass 2: every rule that sets an ink, judged against its block's ground.
  const allow = new Set(JSON.parse(readFileSync(ALLOW_PATH, 'utf8')).allow ?? [])
  const violations = []
  const found = new Set()
  let checked = 0

  for (const rule of rules) {
    const color = decl(rule.decls, 'color')
    const family = inkFamilyOf(color)
    if (!family) continue
    const ownGround = groundOf(backgroundOf(rule.decls))

    for (const sel of rule.selector.split(',')) {
      const info = classify(lastCompound(sel))
      if (!info) continue
      // Nearest painted ground wins: this rule's own, then this element's
      // (from any rule naming it), then the block's.
      const ground = ownGround ?? nameGround.get(info.name) ?? blockGround.get(info.block)
      if (!ground || ground === 'mixed' || ground === 'fill' || ground === 'none') continue
      checked++
      const wants = ground === 'sumi' ? 'panel' : 'ambient'
      if (family === wants) continue
      const key = `${info.name}|${family}-on-${ground}`
      found.add(key)
      if (allow.has(key)) continue
      violations.push(
        `${rel}:${rule.line}  ${sel.trim()}\n` +
        `      uses a ${family} ink (${color}) but .${info.block} paints ${ground}.\n` +
        `      ${ground === 'sumi'
          ? 'Sumi is dark in BOTH themes; an ambient ink flips dark in light theme. Use --text-on-panel(-soft).'
          : 'Paper is light in light theme; a panel ink is a pale sumi ink. Use --text-primary/--text-secondary.'}`
      )
    }
  }

  if (write) {
    writeFileSync(
      ALLOW_PATH,
      JSON.stringify(
        {
          _: JSON.parse(readFileSync(ALLOW_PATH, 'utf8'))._,
          allow: [...found].sort(),
        },
        null, 2
      ) + '\n'
    )
    console.log(`design-ink-ground.json allow[] written: ${found.size} entries.`)
    process.exit(0)
  }

  const stale = [...allow].filter((k) => !found.has(k))
  for (const k of stale) {
    violations.push(
      `(allow)  "${k}" is allowlisted but no longer occurs.\n` +
      `      Remove it from design-ink-ground.json.`
    )
  }

  if (violations.length) {
    console.error(`Guard 5 (ink/ground) found ${violations.length} violation(s):\n`)
    for (const v of violations) console.error(`  ${v}\n`)
    console.error(
      `An ink belongs to a ground. If a rule genuinely needs both grounds,\n` +
      `name the pair once on the block as custom properties and have the\n` +
      `children read those -- see --ns-ink/--ns-ink-soft on .next-service.`
    )
    process.exit(1)
  }

  const sumi = [...blockGround.values()].filter((g) => g === 'sumi').length
  const paper = [...blockGround.values()].filter((g) => g === 'paper').length
  const mixed = [...blockGround.values()].filter((g) => g === 'mixed').length
  console.log('Guard 5 (ink/ground): no violations.')
  console.log(`  ${blockGround.size} blocks have a known ground (${sumi} sumi, ${paper} paper, ${mixed} mixed and therefore unjudged).`)
  console.log(`  ${checked} ink declarations checked against one; ${allow.size} allowlisted.`)
  process.exit(0)
}

main()
