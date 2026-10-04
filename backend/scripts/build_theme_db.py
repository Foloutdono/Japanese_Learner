"""
Build script for the thematic vocab decks ("fruits", "vegetables", "body
parts", ...) — the theme counterpart to frequency_data.py's tiers.

Output is `datas/vocab/theme_words.json`, read at import by
content/theme_data.py. The input is content/theme_lists.py, the hand-
written lists: every theme's words, already placed in its four levels
and in order inside each level, with an English and a French gloss.

Run offline: `python -m scripts.build_theme_db [--dump THEME] [--check]`.
Safe to re-run — rewrites the JSON from scratch each time.


WHY THE LISTS ARE WRITTEN BY HAND
---------------------------------
The previous build matched English keywords against JMdict's first gloss
and cut each theme into four bands by JMdict's newspaper-frequency tags.
That kept the archaic padding out, but the levels it made were not a
difficulty scale: newspaper frequency measures how often the Mainichi
prints a word, not how early a learner needs it. 梅, 桑 and 杏 came out
as the basic fruits and バナナ as an advanced one, 象 as an expert
animal, 風 as an expert weather word — and 犬, 梨 or キリン were not in
their themes at all, because their first gloss did not happen to equal a
keyword.

So membership and level are now a judgement, written down in
content/theme_lists.py: basic is the word everybody knows (apple), medium
the everyday word a step further (pear), advanced the word one meets but
seldom uses (pomegranate), expert the word only a specialist or an
enthusiast reaches for (kumquat). The level is the word's place on that
scale inside its theme, not its JLPT level and not its frequency.

What stays automatic is the part that has to be exact: RESOLUTION. Every
listed word is looked up as a card the app already has, so a theme stays
a grouping and never a second copy — the same word studied under
"Fruits · 基本", "N5" or "Top 200" is one SRS card:

  1. the deck (vocab_deck.json), exactly as it stores the word — its
     kanji (or "" for a word it teaches in kana) and its kana, where a
     kana field of several readings ("まいげつ/まいつき") matches any;
  2. else the JMdict pool, exactly by (kanji, kana).

A word found in neither is an error, not a skip. And a word found in the
pool while the deck teaches the same reading under another spelling
(林檎 in the pool, りんご in the deck) is an error too: it would be a
second card for the word the learner already studies. `--check` prints
every such problem with the forms the deck and the pool do hold, and
writes nothing.
"""
import argparse
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BASE_DIR)

from content.theme_lists import THEMES  # noqa: E402

_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_JMDICT_DB = os.path.join(_VOCAB_DIR, "vocab_jmdict.sqlite3")
_DECK_JSON = os.path.join(_VOCAB_DIR, "vocab_deck.json")
_OUT_JSON = os.path.join(_VOCAB_DIR, "theme_words.json")

LEVELS = ("basic", "medium", "advanced", "expert")
DECK_LEVELS = ("N5", "N4", "N3", "N2", "N1")


def parse_line(line: str) -> tuple[str, str, str, str]:
    """`漢字 かな | english | français` or `かな | english | français`
    -> (kanji, kana, en, fr)."""
    parts = [p.strip() for p in line.split("|")]
    if len(parts) != 3 or not all(parts):
        raise ValueError(f"expected 'word | en | fr', got {line!r}")
    word, en, fr = parts
    forms = word.split()
    if len(forms) == 1:
        return "", forms[0], en, fr
    if len(forms) == 2:
        return forms[0], forms[1], en, fr
    raise ValueError(f"expected 'kanji kana' or 'kana', got {word!r}")


def parsed_themes() -> dict[str, dict[str, list[tuple[str, str, str, str]]]]:
    out = {}
    for theme, levels in THEMES.items():
        if tuple(levels) != LEVELS:
            raise ValueError(f"{theme}: levels must be {LEVELS}, got {tuple(levels)}")
        out[theme] = {
            level: [parse_line(l) for l in text.strip().splitlines() if l.strip()]
            for level, text in levels.items()
        }
    return out


class Resolver:
    def __init__(self):
        with open(_DECK_JSON, encoding="utf-8") as f:
            deck = json.load(f)
        # (kanji, one reading) -> the deck's stored (kanji, kana); first
        # level wins, as frequency_data's resolution does.
        self.deck: dict[tuple[str, str], tuple[str, str]] = {}
        self.deck_by_reading: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
        self.deck_meaning: dict[tuple[str, str, str], str] = {}
        for level in DECK_LEVELS:
            for w in deck.get(level, []):
                kanji, kana = w.get("kanji", ""), w.get("kana", "")
                for reading in kana.split("/"):
                    self.deck.setdefault((kanji, reading), (kanji, kana))
                    self.deck_by_reading[reading].append((level, kanji, kana))
                    self.deck_meaning[(level, kanji, kana)] = w.get("meaning", "")
        self.conn = sqlite3.connect(f"file:{_JMDICT_DB}?mode=ro", uri=True)

    def pool_rows(self, column: str, value: str) -> list[tuple[str, str, str]]:
        return self.conn.execute(
            f"SELECT kanji, kana, meaning FROM entries WHERE {column} = ? ORDER BY freq_rank LIMIT 6",
            (value,),
        ).fetchall()

    @staticmethod
    def same_sense(en: str, meaning: str) -> bool:
        words = lambda text: {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 3}
        return bool(words(en) & words(meaning))

    def resolve(self, kanji: str, kana: str, en: str) -> tuple[str | None, str, str, list[str]]:
        """(domain, kanji, kana, problems). domain None = unresolved."""
        hit = self.deck.get((kanji, kana))
        if hit:
            return "vocab", hit[0], hit[1], []
        row = self.conn.execute(
            "SELECT kanji, kana FROM entries WHERE kanji = ? AND kana = ?", (kanji, kana),
        ).fetchone()
        problems = []
        twins = [d for d in self.deck_by_reading.get(kana, ())]
        if row:
            # A homophone (国歌 beside the deck's 国家) is no twin: only the
            # deck's kana spelling of the reading, or a spelling whose gloss
            # shares a word with this one (御飯 "cooked rice" for ご飯), is
            # the same word under another form.
            same = [(lv, k, r) for lv, k, r in twins
                    if not k or self.same_sense(en, self.deck_meaning[(lv, k, r)])]
            if same:
                problems.append("pool form, but the deck teaches this word as: "
                                + "; ".join(f"{lv} {k or '-'} {r}" for lv, k, r in same))
            return "vocab_jmdict", row[0], row[1], problems
        problems.append("not found")
        if twins:
            problems.append("deck: " + "; ".join(f"{lv} {k or '-'} {r}" for lv, k, r in twins))
        for column, value in (("kana", kana), ("kanji", kanji)):
            if value:
                rows = self.pool_rows(column, value)
                if rows:
                    problems.append(f"pool by {column}: "
                                    + "; ".join(f"{k or '-'} {r} ({m[:30]})" for k, r, m in rows))
        return None, kanji, kana, problems


def build(check: bool = False) -> tuple[dict[str, list[dict]], list[str]]:
    resolver = Resolver()
    themes, errors = {}, []
    for theme, levels in sorted(parsed_themes().items()):
        rows, surfaces, glosses = [], set(), set()
        for level in LEVELS:
            for kanji, kana, en, fr in levels[level]:
                where = f"{theme}/{level} {kanji or '-'} {kana}"
                domain, s_kanji, s_kana, problems = resolver.resolve(kanji, kana, en)
                surface = s_kanji or s_kana
                head = en.split(",")[0].strip().lower()
                if surface in surfaces:
                    problems.append("repeats a word of this theme")
                if head in glosses:
                    problems.append(f"repeats the gloss {head!r} in this theme")
                surfaces.add(surface)
                glosses.add(head)
                if problems:
                    errors.append(f"{where}: " + " | ".join(problems))
                if domain is None:
                    continue
                rows.append({
                    "rank": len(rows) + 1,
                    "level": level,
                    "domain": domain,
                    "kanji": s_kanji,
                    "kana": s_kana,
                    "meaning": en,
                    "meaning_fr": fr,
                })
        themes[theme] = rows
    return themes, errors


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", metavar="THEME",
                    help="print every word of one theme (or 'all') and write nothing")
    ap.add_argument("--check", action="store_true",
                    help="report every word that does not resolve cleanly and write nothing")
    args = ap.parse_args()

    themes, errors = build()

    if args.check or errors:
        for e in errors:
            print(e)
        if errors:
            raise SystemExit(f"\n{len(errors)} problem(s); nothing written")
        print("every word resolves")
        return

    if args.dump:
        wanted = sorted(themes) if args.dump == "all" else [args.dump]
        for theme in wanted:
            rows = themes.get(theme)
            if rows is None:
                raise SystemExit(f"unknown theme: {theme}")
            print(f"\n=== {theme} ({len(rows)})")
            for r in rows:
                print(f"  {r['rank']:3d} {r['level']:9s} {r['domain'][:5]:5s} "
                      f"{(r['kanji'] or r['kana']):12s} {r['kana']:16s} "
                      f"{r['meaning']} / {r['meaning_fr']}")
        return

    with open(_OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(themes, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")

    per_level: dict[str, int] = defaultdict(int)
    print(f"{'theme':20s}{'total':>6}   " + "".join(f"{l[:3]:>6}" for l in LEVELS) + "   deck")
    for theme in sorted(themes):
        rows = themes[theme]
        counts = {l: sum(1 for r in rows if r["level"] == l) for l in LEVELS}
        for l, n in counts.items():
            per_level[l] += n
        deck = sum(1 for r in rows if r["domain"] == "vocab")
        print(f"{theme:20s}{len(rows):6d}   " + "".join(f"{counts[l]:6d}" for l in LEVELS)
              + f"   {100 * deck // max(len(rows), 1):3d}%")
    total = sum(len(r) for r in themes.values())
    print(f"\n{len(themes)} themes, {total} words -> {_OUT_JSON} "
          f"({os.path.getsize(_OUT_JSON) // 1024} KB)")
    print("per level: " + ", ".join(f"{l} {per_level[l]}" for l in LEVELS))


if __name__ == "__main__":
    main()
