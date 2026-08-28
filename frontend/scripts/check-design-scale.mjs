// Guard 3: a source-level scale ratchet.
//
// index.css is extremely comment-dense -- comments quote real declarations,
// cite pixel values, and discuss token names constantly (~192 literals live
// in comments alone). A scan that doesn't strip comments first pollutes the
// allowlist with phantom entries and reports violations that do not exist.
// See plan 044, "LESSON FROM PLANS 042 AND 043" and "THE FIVE THINGS THAT
// WILL SINK THIS". Comments are stripped before ANY regex runs below, with
// their newlines preserved so reported line numbers stay accurate.
//
// The duplicate-@keyframes check is at-rule-aware on purpose: two
// definitions of the same name are only a bug if they share the same
// at-rule context (both top-level, or both nested in the identical chain
// of @media/@supports blocks). `card-stamp-strike` and
// `card-stamp-strike-center` are each defined once at top level and once
// inside `@media (prefers-reduced-motion: reduce)` -- a deliberate
// reduced-motion override, not a collision. A flat text scan would flag
// every reduced-motion animation override in the file.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const FRONTEND_DIR = join(SCRIPT_DIR, '..')
const SRC_DIR = join(FRONTEND_DIR, 'src')
const SCALE_PATH = join(SRC_DIR, 'design-scale.json')
const PROPERTIES = ['font-size', 'border-radius', 'gap', 'padding']
const LITERAL_EXEMPT = new Set(['inherit', 'initial', 'unset', '0'])

function findCssFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findCssFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.css')) out.push(full)
  }
  return out
}

// Blank out comment bodies (keeping their newlines) so every regex below
// only ever sees real declarations, never prose that happens to quote one.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
}

function makeLineFinder(text) {
  const newlineIndexes = []
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) newlineIndexes.push(i)
  return offset => {
    // Number of newlines strictly before `offset`, 1-indexed line number.
    let lo = 0, hi = newlineIndexes.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (newlineIndexes[mid] < offset) lo = mid + 1
      else hi = mid
    }
    return lo + 1
  }
}

function normalizeValue(v) {
  return v.replace(/!important\s*$/i, '').trim().replace(/\s+/g, ' ')
}

// Every `property: value` declaration for the four scale-ratcheted
// properties, with the file:line it came from. Regex requires the property
// name be preceded by start-of-text, `;`, `{` or whitespace and followed
// immediately by `:` -- so `padding-inline:` never matches a search for
// `padding:`, and `row-gap:` / `column-gap:` never match `gap:` (the
// preceding character is `-`, not one of the allowed boundaries).
function findDeclarations(text, property) {
  const re = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;{}]+?)\\s*(?=[;}])`, 'g')
  const lineAt = makeLineFinder(text)
  const out = []
  let m
  while ((m = re.exec(text))) {
    out.push({ value: normalizeValue(m[1]), line: lineAt(m.index) })
  }
  return out
}

// Every `@keyframes <name> {` with the at-rule context it's nested in
// (the joined preludes of every enclosing @media/@supports/etc, or '' for
// top level). A single linear scan tracking brace depth; `buf` accumulates
// the text since the last `{` / `}` / `;`, which at the moment a `{` is
// hit is exactly the rule's prelude (selector list, or at-rule prelude).
function findKeyframes(text) {
  const lineAt = makeLineFinder(text)
  const stack = []
  let buf = ''
  const out = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      const prelude = buf.trim()
      const kf = /^@keyframes\s+([A-Za-z0-9_-]+)$/.exec(prelude)
      if (kf) {
        const context = stack.filter(f => f.isAtRule).map(f => f.prelude).join(' > ')
        out.push({ name: kf[1], line: lineAt(i), context })
      }
      stack.push({ isAtRule: prelude.startsWith('@'), prelude })
      buf = ''
    } else if (ch === '}') {
      stack.pop()
      buf = ''
    } else if (ch === ';') {
      buf = ''
    } else {
      buf += ch
    }
  }
  return out
}

// Custom properties declared anywhere (`--name: ...`), and custom
// properties referenced via var() with NO fallback (`var(--name)`, not
// `var(--name, fallback)`). The source-level twin of Guard 2's runtime
// assertion -- catches the `var(--text)` bug class in under a second,
// without booting chromium.
function findDeclaredCustomProps(text) {
  const re = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g
  const names = new Set()
  let m
  while ((m = re.exec(text))) names.add(m[1])
  return names
}

function findUndeclaredVarRefs(text) {
  const re = /var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g
  const lineAt = makeLineFinder(text)
  const out = []
  let m
  while ((m = re.exec(text))) {
    if (m[2] === ')') out.push({ name: m[1], line: lineAt(m.index) })
  }
  return out
}

function tokenValueSet(scale, property) {
  return new Set(scale.tokens[property] ?? [])
}

function main() {
  const scale = JSON.parse(readFileSync(SCALE_PATH, 'utf8'))
  const write = process.argv.includes('--write')
  const files = findCssFiles(SRC_DIR)

  const violations = []
  const newAllow = { 'font-size': new Set(), 'border-radius': new Set(), gap: new Set(), padding: new Set() }

  // 1. Scale literals.
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const text = stripComments(raw)
    const rel = relative(FRONTEND_DIR, file).split('\\').join('/')
    for (const property of PROPERTIES) {
      const tokens = tokenValueSet(scale, property)
      const allow = new Set(scale.allow[property] ?? [])
      for (const { value, line } of findDeclarations(text, property)) {
        if (tokens.has(value)) continue
        if (LITERAL_EXEMPT.has(value)) continue
        if (allow.has(value)) continue
        if (write) {
          newAllow[property].add(value)
          continue
        }
        violations.push(`${rel}:${line}  ${property}: ${value}`)
      }
    }
  }

  if (write) {
    for (const property of PROPERTIES) {
      const merged = new Set([...(scale.allow[property] ?? []), ...newAllow[property]])
      scale.allow[property] = [...merged].sort()
    }
    writeFileSync(SCALE_PATH, JSON.stringify(scale, null, 2) + '\n')
    const total = PROPERTIES.reduce((a, p) => a + scale.allow[p].length, 0)
    console.log(`design-scale.json allow[] written: ${total} entries across ${PROPERTIES.length} properties`)
    process.exit(0)
  }

  // 2. Duplicate @keyframes names, at-rule-aware.
  const byName = new Map()
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const text = stripComments(raw)
    const rel = relative(FRONTEND_DIR, file).split('\\').join('/')
    for (const kf of findKeyframes(text)) {
      const list = byName.get(kf.name) ?? []
      list.push({ ...kf, file: rel })
      byName.set(kf.name, list)
    }
  }
  const exempt = new Set(scale.duplicateKeyframes ?? [])
  for (const [name, defs] of byName) {
    const byContext = new Map()
    for (const d of defs) {
      const list = byContext.get(d.context) ?? []
      list.push(d)
      byContext.set(d.context, list)
    }
    for (const [context, list] of byContext) {
      if (list.length < 2) continue
      if (exempt.has(name)) continue
      const locs = list.map(d => `${d.file}:${d.line}`).join(', ')
      violations.push(`${locs}  @keyframes ${name} declared ${list.length} times in the same at-rule context (${context || 'top level'})`)
    }
  }

  // 3. var() referencing a custom property declared nowhere.
  const declaredAnywhere = new Set()
  const refs = []
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const text = stripComments(raw)
    const rel = relative(FRONTEND_DIR, file).split('\\').join('/')
    for (const name of findDeclaredCustomProps(text)) declaredAnywhere.add(name)
    for (const r of findUndeclaredVarRefs(text)) refs.push({ ...r, file: rel })
  }
  const knownUndefined = new Set(scale.knownUndefined ?? [])
  for (const r of refs) {
    if (declaredAnywhere.has(r.name)) continue
    if (knownUndefined.has(r.name)) continue
    violations.push(`${r.file}:${r.line}  var(${r.name}) references a custom property declared nowhere`)
  }

  if (violations.length) {
    console.error(`Guard 3 (design scale) found ${violations.length} violation(s):\n`)
    for (const v of violations) console.error(`  ${v}`)
    console.error(`\nEach is either a new off-scale literal (add the token instead), a new duplicate @keyframes name, or a var() with no fallback naming an undefined custom property.`)
    console.error(`If a literal genuinely can't use the scale yet, add it to design-scale.json's allow[] with a note why, or re-run 'node scripts/check-design-scale.mjs --write'.`)
    process.exit(1)
  }

  const totalAllow = PROPERTIES.reduce((a, p) => a + (scale.allow[p]?.length ?? 0), 0)
  console.log(`Guard 3 (design scale): no new violations. ${totalAllow} literals still on the allowlist across ${PROPERTIES.length} properties.`)
  process.exit(0)
}

main()
