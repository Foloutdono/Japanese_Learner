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
//
// Plan 047 added two more surfaces the four `font-size`/`border-radius`/
// `gap`/`padding` scans above cannot see:
//
//   - `custom-property-length` -- a CSS custom property whose *value* is a
//     bare px/rem/em length, e.g. `--card-pad-y: 40px;`. This is classified
//     by VALUE, not by name: any `--whatever: <length>` counts, because
//     names drift (`--card-pad-y`, `--char-size`, `--ember-drift`, ...) but
//     a length is a length regardless of what it's called. `var(...)`,
//     `calc(...)`, `clamp(...)` and colours never match -- only a bare
//     number+unit does.
//   - `js-inline-length` -- the same kind of length, but written from
//     `.jsx`/`.js` as a custom-property value: a template literal
//     (`` `${size}px` ``) or a string literal (`'80px'`) assigned to a
//     `'--name'` object key, however deep inside a ternary or nested call
//     it sits (e.g. `'--stop-gap': last ? (finished ? '0px' : gapFor(...))
//     : gapFor(...)`). Deliberately OUT OF REACH: a numeric prop like
//     `size={100}` that only becomes a px string somewhere else the prop is
//     consumed. Tracing that needs real dataflow analysis across component
//     boundaries and isn't worth it -- every one of those props eventually
//     flows through a site of exactly the shape this scan already catches,
//     so catching it there is enough.
//
// Both surfaces reuse the same "strip comments, then regex" discipline as
// the CSS scan above (a JS-aware stripper for `.jsx`/`.js`, since `//` line
// comments and string/template contents need different handling than CSS's
// `/* */`-only comments).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const FRONTEND_DIR = join(SCRIPT_DIR, '..')
const SRC_DIR = join(FRONTEND_DIR, 'src')
const SCALE_PATH = join(SRC_DIR, 'design-scale.json')
const PROPERTIES = ['font-size', 'border-radius', 'gap', 'padding']
const CUSTOM_PROPERTY_LENGTH = 'custom-property-length'
const JS_INLINE_LENGTH = 'js-inline-length'
// All classes whose allowlist and occurrence count live in design-scale.json.
const ALL_CLASSES = [...PROPERTIES, CUSTOM_PROPERTY_LENGTH, JS_INLINE_LENGTH]
const LITERAL_EXEMPT = new Set(['inherit', 'initial', 'unset', '0'])
// A bare px/rem/em length with no other characters -- not var()/calc()/
// clamp(), not a colour, not a multi-value shorthand.
const BARE_LENGTH_RE = /^-?\d*\.?\d+(px|rem|em)$/

function findFilesByExt(dir, exts) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findFilesByExt(full, exts))
    else if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

function findCssFiles(dir) {
  return findFilesByExt(dir, ['.css'])
}

function findJsFiles(dir) {
  return findFilesByExt(dir, ['.jsx', '.js'])
}

// Blank out comment bodies (keeping their newlines) so every regex below
// only ever sees real declarations, never prose that happens to quote one.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
}

// The JS-aware twin of stripComments: blanks `//` line comments and
// `/* */` block comments, but -- unlike the CSS version -- has to walk the
// text char-by-char, because `//` and `/*` are only comments *outside* of a
// string or template literal (a URL in a string, or `//` inside a template,
// must not be treated as a comment start). String and template contents are
// copied through untouched (including a template's `${...}` interpolation)
// so findJsInlineLengths still sees them; only the comment bodies go blank,
// with newlines preserved so line numbers stay accurate.
function stripJsComments(text) {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '/' && next === '/') {
      let j = i
      while (j < n && text[j] !== '\n') { out += ' '; j++ }
      i = j
      continue
    }
    if (ch === '/' && next === '*') {
      let j = i
      while (j < n && !(text[j] === '*' && text[j + 1] === '/')) {
        out += text[j] === '\n' ? '\n' : ' '
        j++
      }
      if (j < n) { out += '  '; j += 2 }
      i = j
      continue
    }
    if (ch === '`' || ch === '\'' || ch === '"') {
      const quote = ch
      out += ch
      i++
      while (i < n) {
        const c = text[i]
        if (c === '\\') { out += c + (text[i + 1] ?? ''); i += 2; continue }
        out += c
        i++
        if (c === quote) break
      }
      continue
    }
    out += ch
    i++
  }
  return out
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

// Every custom-property declaration (`--anything: <value>;`) whose value is
// a bare px/rem/em length -- classified by VALUE, never by name, per plan
// 047: `--card-pad-y: 40px` is a padding, `--char-size: 72px` is a type
// size, but the guard doesn't know or care which; it only asks "is this a
// length". `var(...)`, `calc(...)`, `clamp(...)` and colours all fail
// BARE_LENGTH_RE and are correctly ignored. Same boundary rule as
// findDeclarations (preceded by start/`;`/`{`/whitespace) so this never
// matches inside a longer identifier.
function findCustomPropertyLengths(text) {
  const re = /(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g
  const lineAt = makeLineFinder(text)
  const out = []
  let m
  while ((m = re.exec(text))) {
    const value = normalizeValue(m[2])
    if (BARE_LENGTH_RE.test(value)) out.push({ name: m[1], value, line: lineAt(m.index) })
  }
  return out
}

// From `start` (immediately after a `'--name':` key in a JS object
// literal), consume the value expression up to the `,` or `}` that ends it
// -- tracking `(`/`[`/`{` nesting so a ternary or function call inside the
// value doesn't end the scan early, and skipping over string/template
// contents opaquely so a `,` or `}` *inside* a quoted string is never
// mistaken for the end of the value. Returns the raw source text of the
// whole expression, e.g. for
//   '--stop-gap': last ? (finished ? '0px' : gapFor(x)) : gapFor(y),
// returns `last ? (finished ? '0px' : gapFor(x)) : gapFor(y)`.
function scanJsValueExpr(text, start) {
  let i = start
  const n = text.length
  const stack = []
  while (i < n) {
    const c = text[i]
    if (c === '`' || c === '\'' || c === '"') {
      const quote = c
      i++
      while (i < n) {
        if (text[i] === '\\') { i += 2; continue }
        if (text[i] === quote) { i++; break }
        i++
      }
      continue
    }
    if (c === '(' || c === '[' || c === '{') { stack.push(c); i++; continue }
    if (c === ')' || c === ']') { if (stack.length) stack.pop(); i++; continue }
    if (c === '}') {
      if (stack.length === 0) break
      stack.pop()
      i++
      continue
    }
    if (c === ',' && stack.length === 0) break
    i++
  }
  return text.slice(start, i)
}

// True if a quoted/template literal (with its quote marks still attached,
// exactly as findJsInlineLengths matches it) is a bare px/rem/em length:
// a plain string like `'80px'`, or a template whose only static text is the
// unit suffix, e.g. `` `${size}px` `` -- but not `` `${x}px solid` `` or a
// template with no interpolation and non-length content.
function isJsLengthLiteral(raw) {
  if (raw[0] === '`') {
    const body = raw.slice(1, -1)
    if (/\$\{/.test(body)) {
      const staticText = body.replace(/\$\{[^}]*\}/g, '').trim()
      return /^(px|rem|em)$/.test(staticText)
    }
    return BARE_LENGTH_RE.test(body.trim())
  }
  return BARE_LENGTH_RE.test(raw.slice(1, -1).trim())
}

// Every px/rem/em length literal written into a CSS custom property from
// JS: `style={{'--char-size': \`${size}px\`}}` (template literal) and
// `style={{'--front-size': '80px'}}` (string literal), including one
// nested arbitrarily deep in a ternary or call, e.g. CardPrompt.jsx's
// `'--front-size': (isF2B ? c.front : c.back)?.length === 1 ? '80px' :
// '32px'` -- both '80px' and '32px' are reported, each at that line.
// Finds every `'--name':` key, extracts its full value expression with
// scanJsValueExpr, then finds every string/template literal inside that
// expression and keeps the ones that are pure lengths. Deliberately does
// NOT trace a numeric prop like `size={100}` back to where it becomes a
// string -- see the file header.
function findJsInlineLengths(text) {
  const lineAt = makeLineFinder(text)
  const out = []
  const keyRe = /(['"])(--[A-Za-z0-9_-]+)\1\s*:\s*/g
  const literalRe = /`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g
  let km
  while ((km = keyRe.exec(text))) {
    const rhsStart = keyRe.lastIndex
    const rhs = scanJsValueExpr(text, rhsStart)
    literalRe.lastIndex = 0
    let lm
    while ((lm = literalRe.exec(rhs))) {
      if (isJsLengthLiteral(lm[0])) {
        out.push({ name: km[2], value: lm[0], line: lineAt(rhsStart + lm.index) })
      }
    }
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
  const jsFiles = findJsFiles(SRC_DIR)

  const violations = []
  const newAllow = Object.fromEntries(ALL_CLASSES.map(c => [c, new Set()]))
  // Total occurrences of off-scale (non-token, non-exempt) declarations
  // found for each class in THIS run, regardless of whether each one is
  // already allowlisted. This is the leading indicator step 1b adds: the
  // distinct-value allowlist only shrinks when the LAST use of a value
  // disappears, but this count drops every time ANY off-scale declaration
  // is replaced with a token, even if the same literal survives elsewhere.
  const occurrences = Object.fromEntries(ALL_CLASSES.map(c => [c, 0]))

  // 1. Scale literals for the four CSS properties, plus custom-property
  // lengths (`--anything: 40px`) -- both scans read each CSS file once.
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
        occurrences[property]++
        if (allow.has(value)) continue
        if (write) {
          newAllow[property].add(value)
          continue
        }
        violations.push(`${rel}:${line}  ${property}: ${value}`)
      }
    }

    const cplAllow = new Set(scale.allow[CUSTOM_PROPERTY_LENGTH] ?? [])
    for (const { name, value, line } of findCustomPropertyLengths(text)) {
      occurrences[CUSTOM_PROPERTY_LENGTH]++
      if (cplAllow.has(value)) continue
      if (write) {
        newAllow[CUSTOM_PROPERTY_LENGTH].add(value)
        continue
      }
      violations.push(`${rel}:${line}  ${name}: ${value}  (custom-property-length)`)
    }
  }

  // 1b. Pixel/rem/em lengths written into custom properties from JS.
  for (const file of jsFiles) {
    const raw = readFileSync(file, 'utf8')
    const text = stripJsComments(raw)
    const rel = relative(FRONTEND_DIR, file).split('\\').join('/')
    const jilAllow = new Set(scale.allow[JS_INLINE_LENGTH] ?? [])
    for (const { name, value, line } of findJsInlineLengths(text)) {
      occurrences[JS_INLINE_LENGTH]++
      if (jilAllow.has(value)) continue
      if (write) {
        newAllow[JS_INLINE_LENGTH].add(value)
        continue
      }
      violations.push(`${rel}:${line}  ${name}: ${value}  (js-inline-length)`)
    }
  }

  if (write) {
    for (const cls of ALL_CLASSES) {
      const merged = new Set([...(scale.allow[cls] ?? []), ...newAllow[cls]])
      scale.allow[cls] = [...merged].sort()
    }
    scale.counts = Object.fromEntries(ALL_CLASSES.map(c => [c, occurrences[c]]))
    writeFileSync(SCALE_PATH, JSON.stringify(scale, null, 2) + '\n')
    const total = PROPERTIES.reduce((a, p) => a + scale.allow[p].length, 0)
    const totalOccurrences = ALL_CLASSES.reduce((a, c) => a + occurrences[c], 0)
    console.log(`design-scale.json allow[] written: ${total} entries across ${PROPERTIES.length} properties, plus ${scale.allow[CUSTOM_PROPERTY_LENGTH].length} custom-property-length and ${scale.allow[JS_INLINE_LENGTH].length} js-inline-length. ${totalOccurrences} occurrences recorded across all ${ALL_CLASSES.length} classes.`)
    process.exit(0)
  }

  // 1c. An occurrence total is only allowed to fall. A duplicated literal
  // (e.g. a second `border-radius: 5px` added somewhere) leaves the
  // distinct-value allowlist unchanged -- the value was already allowed --
  // but raises this count, and that is exactly what should fail the guard;
  // see step 1b in plan 047.
  const storedCounts = scale.counts ?? {}
  for (const cls of ALL_CLASSES) {
    const stored = storedCounts[cls] ?? 0
    if (occurrences[cls] > stored) {
      violations.push(`(counts)  ${cls}: occurrence count rose from ${stored} to ${occurrences[cls]} -- an already-allowlisted literal now appears more often somewhere. Falling is fine and needs no allowlist change; rising means re-run --write only after confirming the rise is intentional.`)
    }
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
    console.error(`\nEach is either a new off-scale literal (add the token instead), a new duplicate @keyframes name, a var() with no fallback naming an undefined custom property, or an occurrence count that rose.`)
    console.error(`If a literal genuinely can't use the scale yet, add it to design-scale.json's allow[] with a note why, or re-run 'node scripts/check-design-scale.mjs --write'.`)
    process.exit(1)
  }

  const totalAllow = PROPERTIES.reduce((a, p) => a + (scale.allow[p]?.length ?? 0), 0)
  const totalOldOccurrences = PROPERTIES.reduce((a, p) => a + occurrences[p], 0)
  const cplAllowCount = scale.allow[CUSTOM_PROPERTY_LENGTH]?.length ?? 0
  const jilAllowCount = scale.allow[JS_INLINE_LENGTH]?.length ?? 0
  console.log(`Guard 3 (design scale): no new violations.`)
  console.log(`  ${totalAllow} literals still on the allowlist across ${PROPERTIES.length} properties (${totalOldOccurrences} occurrences).`)
  console.log(`  custom-property-length: ${cplAllowCount} literals on the allowlist (${occurrences[CUSTOM_PROPERTY_LENGTH]} occurrences).`)
  console.log(`  js-inline-length: ${jilAllowCount} literals on the allowlist (${occurrences[JS_INLINE_LENGTH]} occurrences).`)
  process.exit(0)
}

main()
