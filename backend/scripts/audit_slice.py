"""
Pick the slice of the content the twice-weekly audit is to check, and dump it.

    python -m scripts.audit_slice                     # what today's run audits
    python -m scripts.audit_slice --dump              # ... and the entries, as JSON
    python -m scripts.audit_slice --on 2026-10-06     # what that run audits
    python -m scripts.audit_slice --slice grammar-N5-2 --dump
    python -m scripts.audit_slice --schedule 12       # the next twelve runs
    python -m scripts.audit_slice --list              # every slice in the rotation

Read-only, and like scripts/check_grammar.py it needs no database, no .env
and no network: it reads the tracked content files and the JMdict database
that ships beside them. The heavy content modules are parsed with `ast`
rather than imported, so this runs in a fresh clone with nothing installed
(content/listening_clips.py imports pykakasi; this does not).

── The rotation ──────────────────────────────────────────────
Runs are Tuesday and Friday (ANCHOR is the first). The nth run audits

    AREAS[n % 5]

so grammar, vocab, sentences, placement and tours advance in parallel — a
whole area is never starved behind another's backlog — and within an area
the cursor is n // 5, walking that area's slices in order and wrapping
when it reaches the end. (Placement joined on 2026-09-21, plan 109: the
three candidate lists an outside ranking and the community JLPT lists
raise against the deck. Runs before that date rotated over three areas.
Tours joined on 2026-10-05, plan 187g: the twist and the scene written
for each grammar point's tour, which no gate reads for whether a native
speaker would say them. Runs before that date rotated over four.)
Nothing is stored: the slice is a pure function of the date, so a
run can be reproduced (--on) and the next months inspected (--schedule)
without a ledger to keep in sync.

The one area that cannot be walked exhaustively is vocab: 8,405 deck
entries at 40 a run is years. Its slices are therefore ordered
RISK-FIRST — by the weighted suspicions each entry raises (`flags` and
WEIGHTS below) — so the entries most likely to be wrong are audited
first and the tail is the part that already agrees with JMdict.

A flag is a reason to LOOK, never a finding: "gloss_absent" fires on
駅 "station" (JMdict says "railway station") as readily as on the real
bugs it also finds. docs/content-audit/PLAYBOOK.md is the method.
"""
import argparse
import ast
import datetime as dt
import functools
import json
import os
import re
import sqlite3
import sys

from translations import fr_gloss

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CONTENT = os.path.join(_BASE_DIR, "content")
_VOCAB = os.path.join(_BASE_DIR, "datas", "vocab")

LEVELS = ("N5", "N4", "N3", "N2", "N1")
AREAS = ("grammar", "vocab", "sentences", "placement", "tours")

# The first run — the Routine's own first firing. Tuesdays and Fridays
# after it are the others, and the two must agree: a run on any other
# weekday resolves to the run BEFORE it and so audits that slice twice.
ANCHOR = dt.date(2026, 9, 18)
RUN_WEEKDAYS = (1, 4)  # Monday is 0

# How much one run is asked to research. A rich grammar point (steps,
# compare, five examples) is a page to check; a plain one is a gloss and
# two sentences, so more of them fit in the same run.
CHUNK_GRAMMAR_RICH = 20
CHUNK_GRAMMAR = 30
CHUNK_VOCAB = 40
CHUNK_READING = 25
CHUNK_PLACEMENT = 40
# A tour block is a twist and a scene: a dialogue to read aloud in the
# head, three answers each to try to make right. Fewer to a run.
CHUNK_TOURS = 15
RICH_LEVELS = ("N5", "N4")


# ── the calendar ──────────────────────────────────────────────

def run_index(on: dt.date) -> int:
    """How many scheduled runs have happened by `on`, counting from 0.

    A date between two run days belongs to the run before it, so asking
    on a Wednesday describes Tuesday's run rather than inventing one.
    """
    if on < ANCHOR:
        return 0
    days = (on - ANCHOR).days
    return sum(1 for d in range(days + 1)
               if (ANCHOR + dt.timedelta(days=d)).weekday() in RUN_WEEKDAYS) - 1


def run_date(index: int) -> dt.date:
    """The date of run `index` — the inverse of run_index()."""
    seen, day = -1, ANCHOR
    while True:
        if day.weekday() in RUN_WEEKDAYS:
            seen += 1
            if seen == index:
                return day
        day += dt.timedelta(days=1)


# ── reading the content ───────────────────────────────────────

@functools.lru_cache(maxsize=None)
def _literal(module: str, name: str):
    """A top-level list literal out of a content module, without importing it."""
    path = os.path.join(_CONTENT, module)
    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=path)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id == name:
                return tuple(ast.literal_eval(node.value))
    raise KeyError(f"{module} has no top-level {name}")


def _json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def grammar_points(level: str) -> list[dict]:
    return _json(os.path.join(_CONTENT, "grammar", f"{level}.json"))


def _norm_gloss(text: str) -> str:
    """An English gloss reduced to what two sources have to agree on:
    lowercase, no parenthetical, no leading article or `to`."""
    text = re.sub(r"\(.*?\)", "", text.lower().strip())
    text = re.sub(r"^(to|a|an|the)\s+", "", text).strip()
    return re.sub(r"\s+", " ", text)


# What each signal is worth when ranking. Zero means "context, printed
# for the auditor but never a reason to look".
WEIGHTS = {
    "gloss_absent": 3,
    "gloss_late": 2,
    "fr_untranslated": 2,
    "no_jmdict_senses": 2,
    "fr_missing": 1,
    "fr_senses_differ": 1,
    "multi_reading": 1,
    "broad_gloss": 1,
    "kana_only": 0,
}


@functools.lru_cache(maxsize=None)
def vocab_entries() -> tuple[dict, ...]:
    """The deck, risk-first: every entry with its `flags`, commonest
    suspicions first. Deterministic — ties break on level then deck order.

    The flags, and what each one is asking the auditor to look at:

      gloss_absent       no gloss of ours appears in any JMdict sense
      gloss_late         our gloss is only JMdict's third sense or later:
                         we may be teaching the rare meaning first
      no_jmdict_senses   nothing in curated_senses under "kanji::kana", so
                         this entry has no cross-reference at all
      fr_untranslated    the French gloss is the English string
      fr_missing         no French gloss
      fr_senses_differ   the two languages list a different number of senses
      multi_reading      the kana field packs several readings with "/"
      broad_gloss        four or more senses crammed into one line
      kana_only          no kanji field, so the deck key is "::reading"

    WEIGHTS is why they are weighted rather than counted. A kana-only
    entry is keyed "::かかる", which curated_senses cannot hold, so
    `no_jmdict_senses` fires on every one of them — a fact about the
    build, not a suspicion about the word. Counting flags floated all 338
    of those to the top of the rotation ahead of the real gloss
    disagreements; weighting puts them where they belong.
    """
    deck = _json(os.path.join(_VOCAB, "vocab_deck.json"))
    french = _json(os.path.join(_VOCAB, "vocab_fr.json"))
    conn = sqlite3.connect(f"file:{os.path.join(_VOCAB, 'vocab_jmdict.sqlite3')}?mode=ro", uri=True)

    out = []
    for level in LEVELS:
        for order, row in enumerate(deck.get(level, [])):
            kanji, kana, meaning = row["kanji"], row["kana"], row["meaning"]
            flags = []
            senses = conn.execute(
                "SELECT blob FROM curated_senses WHERE key = ?", (f"{kanji}::{kana}",)
            ).fetchone()
            jmdict = []
            if senses is None:
                flags.append("no_jmdict_senses")
            else:
                jmdict = [s.get("glossary", []) for s in json.loads(senses[0])]
                ours = [_norm_gloss(m) for m in meaning.split(",")]
                hits = [i for i, sense in enumerate(jmdict)
                        for mine in ours if mine in [_norm_gloss(g) for g in sense]]
                if not hits:
                    flags.append("gloss_absent")
                elif min(hits) >= 2:
                    flags.append("gloss_late")

            if "/" in kana:
                flags.append("multi_reading")
            if not kanji:
                flags.append("kana_only")
            # The French the app serves, not the written form's: a form
            # the deck teaches under several readings carries one gloss
            # per card ("盛る::もる"), and the bare "盛る" is さかる's.
            fr = fr_gloss(row, french)
            if fr is None:
                flags.append("fr_missing")
            elif fr == meaning:
                flags.append("fr_untranslated")
            elif fr and fr.count(",") != meaning.count(","):
                flags.append("fr_senses_differ")
            if meaning.count(",") >= 3:
                flags.append("broad_gloss")

            # An entry with no kanji cannot be keyed in curated_senses at
            # all, so its missing cross-reference says nothing about the word.
            risk = sum(0 if (flag == "no_jmdict_senses" and "kana_only" in flags)
                       else WEIGHTS[flag] for flag in flags)
            out.append({
                "level": level, "kanji": kanji, "kana": kana,
                "meaning": meaning, "fr": fr, "risk": risk, "flags": flags,
                "jmdict_senses": [list(sense) for sense in jmdict[:4]],
            })
    conn.close()
    out.sort(key=lambda e: (-e["risk"], LEVELS.index(e["level"])))
    return tuple(out)


@functools.lru_cache(maxsize=None)
def theme_words() -> dict[str, list[dict]]:
    return _json(os.path.join(_VOCAB, "theme_words.json"))


# ── the slices ────────────────────────────────────────────────

def _chunk_ids(prefix: str, total: int, size: int) -> list[tuple[str, int, int]]:
    """[(id, start, stop), ...] — the ids are 1-based and stable as long as
    the bank's length is; a bank that grows adds a chunk at the end and
    shifts the boundaries inside it by a few entries."""
    return [(f"{prefix}-{n + 1}", n * size, min((n + 1) * size, total))
            for n in range((total + size - 1) // size or 1)]


def _grammar_slices() -> list[dict]:
    out = []
    for level in LEVELS:
        points = grammar_points(level)
        size = CHUNK_GRAMMAR_RICH if level in RICH_LEVELS else CHUNK_GRAMMAR
        for sid, start, stop in _chunk_ids(f"grammar-{level}", len(points), size):
            out.append({
                "id": sid, "area": "grammar",
                "title": f"{level} grammar, points {start + 1}–{stop}",
                "source": f"backend/content/grammar/{level}.json",
                "level": level, "start": start, "stop": stop,
            })
    return out


def _vocab_slices() -> list[dict]:
    """Three deck chunks, then a theme, and round again — so a theme's
    banding is looked at regularly without the deck's own backlog stalling."""
    deck = _json(os.path.join(_VOCAB, "vocab_deck.json"))
    total = sum(len(rows) for rows in deck.values())
    chunks = [
        {"id": sid, "area": "vocab", "kind": "deck",
         "title": f"vocab deck, risk-ranked entries {start + 1}–{stop}",
         "source": "backend/datas/vocab/vocab_deck.json + vocab_fr.json",
         "start": start, "stop": stop}
        for sid, start, stop in _chunk_ids("vocab", total, CHUNK_VOCAB)
    ]
    themes = [
        {"id": f"theme-{name}", "area": "vocab", "kind": "theme",
         "title": f"theme “{name}”, membership and banding",
         "source": "backend/datas/vocab/theme_words.json", "theme": name}
        for name in sorted(theme_words())
    ]
    out, c, t = [], 0, 0
    while c < len(chunks) or t < len(themes):
        for _ in range(3):
            if c < len(chunks):
                out.append(chunks[c]); c += 1
        if t < len(themes):
            out.append(themes[t]); t += 1
    return out


def _sentence_slices() -> list[dict]:
    """A reading chunk, then a dictation level, alternating: the two banks
    are written to different rules and neither should wait on the other."""
    reading = []
    for level in LEVELS:
        bank = _literal("reading_sentences.py", level)
        for sid, start, stop in _chunk_ids(f"reading-{level}", len(bank), CHUNK_READING):
            reading.append({
                "id": sid, "area": "sentences", "kind": "reading",
                "title": f"{level} reading sentences {start + 1}–{stop}",
                "source": "backend/content/reading_sentences.py",
                "level": level, "start": start, "stop": stop,
            })
    listening = [
        {"id": f"dictation-{level}", "area": "sentences", "kind": "listening",
         "title": f"{level} dictation lines",
         "source": "backend/content/listening_clips.py", "level": level}
        for level in LEVELS
    ]
    out, r, l = [], 0, 0
    while r < len(reading) or l < len(listening):
        if r < len(reading):
            out.append(reading[r]); r += 1
        if l < len(listening):
            out.append(listening[l]); l += 1
    return out


# The three candidate lists of plan 109 (docs/vocab-deck-review.md),
# read from the file scripts/placement_report.py writes with
# --write-lists so this stays tokenizer-free. Each candidate is a claim
# about the deck an outside list makes -- a card placed above the level
# the community JLPT lists give the word, a list word with no card, a
# frequent word with no card -- and the audit's job is the same as for
# a gloss: try to disprove it, and file only what survives. A finding
# here proposes a card or a level move; the audit never makes either.
_PLACEMENT_KINDS = (
    ("placed_above", "placed above the JLPT lists", "backend/datas/vocab/vocab_deck.json"),
    ("listed_not_here", "in the JLPT lists, not in the deck", "backend/datas/vocab/sources/jlpt_tanos.json"),
    ("frequent_not_here", "frequent in the subtitle ranking, not in the deck",
     "backend/datas/vocab/sources/opensubtitles_ja_50k.txt"),
)


def placement_lists() -> dict[str, list[dict]]:
    return _json(os.path.join(_VOCAB, "placement_lists.json"))


def _placement_slices() -> list[dict]:
    """The three lists chunked, interleaved one chunk each, so no list
    waits on another's backlog."""
    lists = placement_lists()
    per_kind = []
    for kind, label, source in _PLACEMENT_KINDS:
        chunks = [
            {"id": sid, "area": "placement", "kind": kind,
             "title": f"{label}, candidates {start + 1}–{stop}",
             "source": source, "start": start, "stop": stop}
            for sid, start, stop in _chunk_ids(f"placement-{kind.replace('_', '-')}", len(lists[kind]), CHUNK_PLACEMENT)
        ]
        per_kind.append(chunks)
    out, i = [], 0
    while any(i < len(c) for c in per_kind):
        for chunks in per_kind:
            if i < len(chunks):
                out.append(chunks[i])
        i += 1
    return out


def toured_points(level: str) -> list[dict]:
    """The level's points that carry a written tour (plan 187), each as
    the audit reads it: the point, its gloss and its rivals, the block."""
    return [
        {"pattern": p["pattern"], "meaning": p.get("meaning"), "structure": p.get("structure"),
         "compare": [c.get("pattern") for c in p.get("compare", [])], "tour": p["tour"]}
        for p in grammar_points(level) if p.get("tour")
    ]


def _tour_slices() -> list[dict]:
    out = []
    for level in LEVELS:
        points = toured_points(level)
        if not points:
            continue
        for sid, start, stop in _chunk_ids(f"tours-{level}", len(points), CHUNK_TOURS):
            out.append({
                "id": sid, "area": "tours",
                "title": f"{level} tours, the twist and the scene, points {start + 1}–{stop}",
                "source": f"backend/content/grammar/{level}.json (each point's `tour`)",
                "level": level, "start": start, "stop": stop,
            })
    return out


def slices(area: str) -> list[dict]:
    return {"grammar": _grammar_slices,
            "vocab": _vocab_slices,
            "sentences": _sentence_slices,
            "placement": _placement_slices,
            "tours": _tour_slices}[area]()


def slice_for(index: int) -> dict:
    """The slice run `index` audits."""
    area = AREAS[index % len(AREAS)]
    pool = slices(area)
    chosen = dict(pool[(index // len(AREAS)) % len(pool)])
    chosen["run"] = index
    chosen["date"] = run_date(index).isoformat()
    return chosen


def find_slice(slice_id: str) -> dict:
    for area in AREAS:
        for candidate in slices(area):
            if candidate["id"] == slice_id:
                return dict(candidate)
    raise KeyError(slice_id)


# ── what a slice contains ─────────────────────────────────────

CHECKS = {
    "grammar": [
        "Is the `meaning` what the pattern actually means, in both languages?",
        "Does `structure` name what it really attaches to (and every form it takes)?",
        "Is each `compare` rival genuinely the confusable one, and is the line true of both sides?",
        "Is every example a sentence a native speaker would write today — register, politeness, naturalness?",
        "Does each example actually use the point it illustrates, in the sense the lesson taught?",
        "Is the JLPT level defensible against the usual published lists?",
        "Does a `careful` step warn about a real trap rather than a made-up one?",
    ],
    "vocab": [
        "Is the reading right for this spelling, and is it the reading a learner will meet?",
        "Is the English gloss the word's common sense, not a rare or archaic one?",
        "Is the French gloss French — the right sense, not a word-for-word copy of the English?",
        "Is the entry current: not 死語, not a form modern writing spells differently (kanji vs kana)?",
        "Does the level fit the word's real frequency?",
        "For a theme: does every word belong to the theme, and does the band match how common it is?",
    ],
    "placement": [
        "Placed above: is the word really one a learner meets at the lists' level, or is the deck's level the defensible one?",
        "Listed, not here: is it a word (not a pattern, a variant spelling of a card, or a name), and which level would teach it?",
        "Frequent, not here: is the rank the word's own, or a stem, a filler or a homophone the tokenizer credited to it?",
        "Does the deck already hold the word under another spelling or reading (kanji vs kana, 御 vs お)?",
        "Would a card for it be one the app's own sentences ever use, or a word with nothing to teach it in?",
        "For a level move: is the card's level the word's, not its kanji's (the review's decision 3)?",
    ],
    "tours": [
        "The twist: is the reading marked right really right, and is each wrong one really wrong -- no second right answer?",
        "Is the twist a real surprise about the point (a second use, the rival the lesson warns about), or a trick?",
        "The scene: is every line what someone would actually say at that place -- register, politeness, the reply a native speaker gives?",
        "Does the learner's right line use the point as the lesson teaches it, and is each wrong line wrong for the reason the `why` gives?",
        "Is a wrong line in fact acceptable Japanese for the task (then it is a second right answer, a finding)?",
        "Do the English and the French say what the Japanese says, at the same register, and does the `note` hold for the point and its rivals?",
        "Is anything above the level in kanji, grammar or vocabulary?",
    ],
    "sentences": [
        "Is the Japanese natural — what someone would actually say or write, not translationese?",
        "Does the English say what the Japanese says, at the same register?",
        "For a reading line: does it really demonstrate the `grammar` point it claims?",
        "For a dictation line: do `kana` and `romaji` transcribe `jp` exactly, and is it holdable in one listen?",
        "Is anything in it outdated — a price, a piece of technology, an honorific nobody uses?",
        "Is the level right: nothing above-level in kanji, grammar or length?",
    ],
}


def entries_of(chosen: dict) -> list[dict]:
    area = chosen["area"]
    if area == "grammar":
        return grammar_points(chosen["level"])[chosen["start"]:chosen["stop"]]
    if area == "vocab":
        if chosen["kind"] == "theme":
            return theme_words()[chosen["theme"]]
        return list(vocab_entries()[chosen["start"]:chosen["stop"]])
    if area == "placement":
        return list(placement_lists()[chosen["kind"]][chosen["start"]:chosen["stop"]])
    if area == "tours":
        return toured_points(chosen["level"])[chosen["start"]:chosen["stop"]]
    if chosen["kind"] == "listening":
        return list(_literal("listening_clips.py", chosen["level"]))
    bank = _literal("reading_sentences.py", chosen["level"])
    return list(bank[chosen["start"]:chosen["stop"]])


def payload(chosen: dict) -> dict:
    entries = entries_of(chosen)
    return {**chosen, "checks": CHECKS[chosen["area"]],
            "count": len(entries), "entries": entries}


# ── cli ───────────────────────────────────────────────────────

def _header(chosen: dict) -> str:
    run = f"run {chosen['run']} ({chosen['date']})  " if "run" in chosen else ""
    return f"{run}{chosen['id']}  [{chosen['area']}]  {chosen['title']}\n  {chosen['source']}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--on", metavar="YYYY-MM-DD", help="the run covering this date (default: today)")
    parser.add_argument("--slice", metavar="ID", help="a named slice instead of the scheduled one")
    parser.add_argument("--dump", action="store_true", help="print the slice's entries as JSON")
    parser.add_argument("--schedule", type=int, metavar="N", help="the next N runs and what each audits")
    parser.add_argument("--list", action="store_true", help="every slice in the rotation")
    args = parser.parse_args(argv)

    if args.list:
        for area in AREAS:
            pool = slices(area)
            print(f"\n{area}: {len(pool)} slices")
            for candidate in pool:
                print(f"  {candidate['id']:<24} {candidate['title']}")
        return 0

    if args.schedule:
        start = run_index(dt.date.today())
        for index in range(start, start + args.schedule):
            chosen = slice_for(index)
            print(f"{chosen['date']}  {chosen['id']:<24} {chosen['title']}")
        return 0

    if args.slice:
        try:
            chosen = find_slice(args.slice)
        except KeyError:
            print(f"no slice {args.slice!r} — try --list", file=sys.stderr)
            return 1
    else:
        on = dt.date.fromisoformat(args.on) if args.on else dt.date.today()
        chosen = slice_for(run_index(on))

    if args.dump:
        print(json.dumps(payload(chosen), ensure_ascii=False, indent=2))
    else:
        print(_header(chosen))
        print(f"  {len(entries_of(chosen))} entries")
    return 0


def _run(argv=None) -> int:
    """main(), but a closed pipe (`| head`) is not a traceback."""
    try:
        return main(argv)
    except BrokenPipeError:
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        return 0


if __name__ == "__main__":
    sys.exit(_run())
