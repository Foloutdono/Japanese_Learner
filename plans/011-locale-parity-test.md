# Plan 011: Add a locale-parity test, and retire the eight dead French-only keys

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a3c6597..HEAD -- frontend/src/locales frontend/vite.config.js`
> On any mismatch with the "Current state" excerpts, treat it as a STOP
> condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none — deliberately. This test runs in the **existing node
  environment** and needs no DOM, so it does not wait on
  plans/008-browser-test-environment.md.
- **Category**: tests
- **Planned at**: commit `a3c6597`, 2026-08-25

## Why this matters

Plan 002 fixed two locale defects that reached users: an English speaker saw
the French word "Exemples" in the dictionary panel, and a key was missing from
the English table entirely. Its own summary concluded that a locale-parity
test *"would have caught both of these gaps automatically and would be cheap to
write in the existing node test environment, since it only needs to import the
two modules"* — and recommended it as its own plan. This is that plan.

The class of bug is invisible until a user in the minority language hits the
exact screen: React renders `undefined` as nothing, so a missing key is a
silent blank, not an error. Nothing in lint, build, or the current test suite
detects it.

Two things stand between the repo and that test:

1. **Eight keys currently break parity** — present in French, absent in
   English. All eight are confirmed dead (no consumer, static or dynamic), so
   the honest fix is to delete them rather than translate strings nobody
   renders or add an allowlist that hides the check's first real finding.
2. The test needs to cover **value types**, not just key names — 37 keys in
   each table are functions (interpolated strings), and a function in one
   locale against a plain string in the other would crash at the call site
   rather than render blank.

## Current state

### Measured parity, as of commit `a3c6597`

```
fr keys: 719   en keys: 711
MISSING IN EN (8): switchLang, readingHiragana, readingHiraganaDesc,
                   readingKatakana, readingKatakanaDesc, readingMixed,
                   readingMixedDesc, readingComprehensionFetchError
MISSING IN FR (0): (none)
function-valued:   fr=37  en=37
TYPE MISMATCH (0): (none)
```

So: key sets differ by exactly those 8; value types are already consistent.

### Why those eight are safe to delete — and how that was established

A static `grep` for `t.someKey` is **not sufficient** in this codebase,
because it accesses `t[...]` dynamically in four places. Each was enumerated
and none can generate any of the eight names:

| Dynamic site | Key shape it can produce |
|---|---|
| `src/domain/studyModes.js:207,211` — `t[MODES[key]?.labelKey]` / `descKey` | `mode_*` only (`localeKey()` at `:56` prefixes `mode_`) |
| `src/components/selection/ThemeSelector.jsx:72` — `t[_translationKey(th.key)]` | `theme*` PascalCase only (`_translationKey()` at `:49`) |
| `src/components/ui/NavControls.jsx:237` — `t[CATEGORY_LABEL_KEYS[cat]]` | `volume*` only (fixed map at `:152`) |
| `src/components/stats/Rhythm.jsx:122` — `t[b.labelKey]` | `interval*` only (fixed list, `src/domain/statsModel.js:384-391`) |

Combined with zero static `t.<key>` hits for all eight, they are unreachable.

⚠️ **`switchLang` is a trap.** There is also a `switchLang` *function* exported
from `LangContext.jsx`'s context value, used in `NavControls.jsx`. That is a
different thing from the locale **key** `switchLang`. Delete only the key from
the locale tables; do not touch the context function or its usages.

### The locale files

`frontend/src/locales/fr/index.js` and `frontend/src/locales/en/index.js`.
Each composes several section objects (e.g. `const home = {...}`, `const
dictionary = {...}`) into one default export. Keys are grouped under `//`
section comments. Read both before editing to find which section each of the
eight keys lives in.

### The existing test lane

`frontend/vite.config.js` currently:

```js
  test: {
    environment: 'node',
    globals: false,
  },
```

`globals: false` means test functions must be **imported explicitly**. The one
existing test file, `frontend/src/lib/api.test.js`, does this — read it and
match its style (import list, `describe`/`it` shape, assertion style).

**Note on plan 008**: if plans/008-browser-test-environment.md has landed
first, this config will instead have a two-project (`node` / `browser`)
setup, and this test belongs in the **node** project — it needs no DOM. Its
filename must therefore *not* match the browser lane's `*.browser.test.*`
pattern. Check which config shape is live before writing the file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Test | `cd frontend && npm test` | all pass |
| Lint | `cd frontend && npm run lint` | exit 0, 0 errors, 18 warnings |
| Build | `cd frontend && npm run build` | exit 0 |
| Parity probe | see Step 1 | the census above |

## Scope

**In scope** (the only files you should create or modify):
- `frontend/src/locales/fr/index.js` (delete 8 dead keys)
- `frontend/src/locales/en/index.js` (only if a section comment needs updating)
- `frontend/src/locales/locales.test.js` (create)
- `plans/README.md` (status row, and correct the "rejected findings" entry — see Step 5)

**Out of scope** (do NOT touch, even though they look related):
- **Any other locale key.** Only the eight named above. If the test finds
  additional mismatches, that is a STOP condition — report them, do not fix a
  broader set inside this diff.
- `LangContext.jsx`'s `switchLang` **function**. Different thing; see the trap
  note above.
- The `t.X ?? 'literal'` fallback sites across the codebase. Plan 002 audited
  them: only two ever fired and both were fixed. Removing the dead ones is a
  cosmetic cleanup, not this plan.
- Adding a third locale, or any i18n library change.
- The browser test lane, if plan 008 has landed. This test is node-lane.

## Git workflow

- Branch: `advisor/011-locale-parity-test`
- Conventional commits, scoped. Use `test(i18n): ...` and `chore(i18n): ...`.
- **Two commits**: delete the dead keys first, then add the test. In that order
  the test is green the moment it lands, and a reviewer can see the deletion
  justified on its own.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reproduce the census

From `frontend/`, run a throwaway probe (delete it afterwards — do not commit
it):

```bash
cd frontend && cat > parity.tmp.mjs <<'EOF'
const fr=(await import('./src/locales/fr/index.js')).default;
const en=(await import('./src/locales/en/index.js')).default;
const F=new Set(Object.keys(fr)), E=new Set(Object.keys(en));
console.log('fr',F.size,'en',E.size);
console.log('missing in en:', [...F].filter(k=>!E.has(k)).join(', ')||'(none)');
console.log('missing in fr:', [...E].filter(k=>!F.has(k)).join(', ')||'(none)');
console.log('type mismatch:', [...F].filter(k=>E.has(k)&&typeof fr[k]!==typeof en[k]).join(', ')||'(none)');
EOF
node parity.tmp.mjs; rm -f parity.tmp.mjs
```

**Verify**: output matches the census in "Current state" — 8 missing in en, 0
missing in fr, 0 type mismatches. If it differs, the locales have drifted;
see STOP conditions.

### Step 2: Re-confirm the eight are still dead

For each of the eight, confirm zero static consumers:

```bash
cd frontend && for k in switchLang readingHiragana readingHiraganaDesc \
  readingKatakana readingKatakanaDesc readingMixed readingMixedDesc \
  readingComprehensionFetchError; do
  printf "%-32s %s\n" "$k" "$(grep -rn "t\.$k\b" src --include=*.jsx --include=*.js | grep -v locales/ | wc -l)"
done
```

**Verify**: all zero.

Then confirm no *new* dynamic `t[...]` site has appeared that could reach them:

```bash
cd frontend && grep -rn "t\[" src --include=*.jsx --include=*.js | grep -v locales/
```

**Verify**: the only hits are the four sites listed in "Current state"
(`studyModes.js`, `ThemeSelector.jsx`, `NavControls.jsx`, `Rhythm.jsx`), all
producing `mode_*` / `theme*` / `volume*` / `interval*` keys. **If a fifth
dynamic site exists, stop** — deadness has to be re-established before
deleting anything.

### Step 3: Delete the eight dead keys from the French table

Remove exactly those eight entries from `frontend/src/locales/fr/index.js`.
Leave every other line, and every section comment, byte-for-byte unchanged.

If deleting a key empties a section object or orphans a section comment that
now describes nothing, tidy that comment — but say so in your summary.

**Verify**: re-run Step 1's probe → `missing in en: (none)` and
`missing in fr: (none)`.

**Verify**: `cd frontend && npm run build` → exit 0
**Verify**: `cd frontend && npm run lint` → exit 0, 0 errors

### Step 4: Write the parity test

Create `frontend/src/locales/locales.test.js` (node lane — note the filename
must not match plan 008's `*.browser.test.*` pattern if that config is live).

Cover exactly three things:

1. **Every French key exists in English.** On failure, the assertion message
   must list the missing key names — a bare "expected 719 to equal 711" is
   useless to whoever hits it.
2. **Every English key exists in French.** Same, in reverse.
3. **Matching value types.** For every shared key, `typeof fr[k] ===
   typeof en[k]`. This catches an interpolation function on one side against a
   plain string on the other, which crashes at the call site rather than
   rendering blank.

Match `api.test.js`'s style: explicit imports from `vitest` (`globals: false`),
plain `describe`/`it`.

Write the failure messages so the test **teaches the fix**, e.g. listing the
offending keys and naming which file to add them to. Include a short comment at
the top of the file explaining why this exists — reference the two real
defects plan 002 fixed, so a future reader understands it is not speculative.

**Verify**: `cd frontend && npm test` → all previous tests still pass, plus 3
new passing tests.

**Verify the test actually fails when it should** — this matters more than it
passing. Temporarily delete one key from `en/index.js`, run `npm test`, and
confirm the test fails **and names that key in its output**. Then restore the
key and confirm green again. Record this in your summary; a parity test that
cannot fail is worse than none.

### Step 5: Correct the record in `plans/README.md`

The "Findings considered and rejected" section currently describes these keys
as dead-but-left-in-place, on the strength of a static grep. Update that entry
to say they were **deleted in plan 011**, and that deadness was re-established
accounting for the four dynamic `t[...]` access sites — because the original
static-only reasoning was insufficient and a future reader should not repeat it.

Also flip the plan 011 status row to DONE.

**Verify**: `grep -c "dynamic" plans/README.md` → at least `1`

### Step 6: Run the full gate

**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run lint` → exit 0, 0 errors, 18 warnings
**Verify**: `cd frontend && npm run build` → exit 0
**Verify**: `git status` → no `parity.tmp.mjs` or other scratch file left behind

## Test plan

- **New**: `frontend/src/locales/locales.test.js` — 3 tests (fr⊆en, en⊆fr,
  type parity).
- **Unchanged**: `frontend/src/lib/api.test.js` — 5 tests, must still pass.
- The **deliberate-failure check in Step 4** is the real verification. Assert
  the test catches a removed key *and names it*, then restore.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `frontend/src/locales/locales.test.js` exists
- [ ] `cd frontend && npm test` exits 0, with 3 more passing tests than the pre-plan baseline
- [ ] `cd frontend && grep -c "switchLang" src/locales/fr/index.js` → `0`
- [ ] `cd frontend && grep -c "readingHiragana" src/locales/fr/index.js` → `0`
- [ ] `cd frontend && grep -c "readingComprehensionFetchError" src/locales/fr/index.js` → `0`
- [ ] `cd frontend && grep -c "switchLang" src/LangContext.jsx` → unchanged from before (the context function is untouched)
- [ ] Step 1's probe reports `(none)` missing in both directions and `(none)` type mismatches
- [ ] The deliberate-failure check from Step 4 is recorded in your summary, including the exact failure output naming the removed key
- [ ] No scratch/probe file committed (`git status` clean)
- [ ] `cd frontend && npm run lint` exits 0, `npm run build` exits 0
- [ ] `plans/README.md` status row for 011 updated **and** the rejected-findings entry corrected per Step 5

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's census does not match "Current state" — the locale tables have
  drifted since this plan was written, and which keys are dead must be
  re-established before deleting anything.
- Step 2 finds a **fifth** dynamic `t[...]` access site, or any of the eight
  keys now has a consumer. Either invalidates the deletion; report and stop.
- Any of the eight keys turns out to be referenced from outside `src/`
  (a Storybook story, a script, a test fixture). Widen the grep to the repo
  root before concluding, and report what you find.
- After deleting the eight, parity is still not clean — that means there were
  mismatches the census missed (likely nested-object keys, if the tables' shape
  differs from the flat structure assumed here). Report the actual structure.
- The test cannot be made to fail in Step 4's deliberate-failure check. That
  means it is not actually comparing what it claims to; do not land it.

## Maintenance notes

- **This test is the durable fix for a whole class of bug**, not just the two
  instances plan 002 found. Any new key added to one locale and forgotten in
  the other now fails `npm test` immediately, in the fast node lane, with the
  key named.
- A reviewer should scrutinize: the failure *messages*. A parity test whose
  output is `expected 719 to equal 711` gets muted or deleted the first time it
  fires. One that says `missing in en: foo, bar` gets fixed.
- **Static grep is not sufficient to prove a locale key is unused in this
  codebase.** Four sites build key names at runtime. That fact is now recorded
  in `plans/README.md` per Step 5 — keep it current if a fifth appears.
- Deliberately deferred: extending parity checking to the *content* tables
  served by `lib/translationCache.js` (the kanji/vocab content maps, which come
  from the backend rather than these files). Different source, different
  failure mode, worth its own look.
- If a third locale is ever added, this test generalizes by comparing every
  table against a designated reference locale rather than pairwise — worth
  restructuring at that point, not before.
