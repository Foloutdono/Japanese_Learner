"""
Thematic vocab decks ("fruits", "vegetables", "body parts", "jobs", ...) —
a third axis for picking what to study, alongside JLPT level
(kanji_data.py/vocab_data.py) and frequency tier (frequency_data.py).

Like frequency tiers, a theme is a different ORDERING/GROUPING over words
that already live in the app's own curated deck (vocab_data.py) or the
JMdict pool (vocab_jmdict_data.py) — never a second copy of either. A word
studied via "Fruits · 基本" and the same word studied via "N4" or "Top 200"
is the SAME SRS card: card ids are computed with the exact same
vocab_to_id/vocab_jmdict_to_id functions frequency_data.py already uses,
via frequency_data.resolve()/to_id() (domain is always "vocab" or
"vocab_jmdict" here — themes don't cover kanji).

FOUR LEVELS
Each theme is split into `basic` / `medium` / `advanced` / `expert`, cut by
frequency: the theme's words are sorted commonest-first and divided into
four growing bands. The bands are relative to the theme, not to the
language as a whole — no fruit word is newspaper-frequent, so absolute
cut-points would leave "Fruits · 基本" empty, whereas a learner opening it
wants りんご and バナナ. See scripts/build_theme_db.py for how the
frequency score is derived (JMdict priority tags, NOT entries.freq_rank —
that column is only a real ranking to about rank 23,000).

Membership is precomputed OFFLINE by build_theme_db.py into
datas/vocab/theme_words.json, which this module loads once at import. It
used to be a `theme_words` table inside the 76 MB vocab_jmdict.sqlite3;
the old memory argument for SQLite (a 292k-row pool that must not be held
in RAM — see vocab_jmdict_data.py) does not apply to ~1k rows, and a JSON
file is reviewable in a diff, which is the only practical guard against
the real failure mode here: data that looks plausible and is wrong.
"""
import json
import os
from collections import Counter

from content.frequency_data import resolve as _resolve, id_from_resolved as _id_from

# Ordered easiest-first. The API and the frontend's domain/themes.js both
# depend on this exact order and these exact keys.
LEVELS = ("basic", "medium", "advanced", "expert")

# One level up: this module lives in a package, and datas/ is still at the
# backend root.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_DATA_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "theme_words.json")

with open(_DATA_PATH, encoding="utf-8") as f:
    # {theme: [{rank, level, score, domain, kanji, kana, meaning}, ...]},
    # each list already in rank (frequency) order.
    _THEMES: dict[str, list[dict]] = json.load(f)


def list_themes() -> list[dict]:
    """[{key, count, levels: [{level, count}, ...]}, ...] sorted
    alphabetically by key — the theme counterpart to
    /api/frequency/{domain}/tiers's tier list.

    `levels` is always all four in LEVELS order, zero-filled, so the
    frontend can draw the ladder without special-casing a thin theme.

    Display labels are NOT here (same convention as LevelSelector's
    LEVEL_HINTS): the frontend maps `key` through the translation file,
    e.g. t.themeFruits, so themes read correctly in whatever language the
    app is displaying — see ThemeSelector.jsx.
    """
    out = []
    for theme in sorted(_THEMES):
        rows = _THEMES[theme]
        counts = Counter(row["level"] for row in rows)
        out.append({
            "key": theme,
            "count": len(rows),
            "levels": [{"level": lv, "count": counts.get(lv, 0)} for lv in LEVELS],
        })
    return out


def has_theme(theme: str) -> bool:
    """Whether `theme` exists at all — distinct from "returned no rows",
    which a caller can also reach by filtering an existing theme down to
    nothing (a band of kana-only words under vocab.word_reading). One is
    a 404, the other is an empty session."""
    return theme in _THEMES


def theme_entries(theme: str, level: str | None = None) -> list[dict]:
    """Full display rows for `theme`, in frequency order — {card_id,
    domain, kanji, kana, meaning, level, theme_level}.

    `level` filters to one band; None returns the whole theme.

    Two different things are called a level here, deliberately kept
    apart: `level` is the word's NATIVE JLPT level (None for a
    JMdict-pool row, mirroring dictionary.py's category="jmdict" branch)
    and is what the card's LevelBadge shows; `theme_level` is which of
    LEVELS the word was sorted into. Renaming either to the other would
    silently relabel every card.

    Unresolvable rows (see frequency_data.resolve's own docstring for
    when a lookup can legitimately miss) are skipped rather than raising,
    same as frequency_data.to_id callers already tolerate.
    """
    rows = _THEMES.get(theme, ())
    entries = []
    for row in rows:
        if level is not None and row["level"] != level:
            continue
        domain = row["domain"]
        key = f"{row['kanji']}::{row['kana']}"
        resolved = _resolve(domain, key)
        if resolved is None:
            continue
        native_level, _entry = resolved
        entries.append({
            "card_id":     _id_from(domain, resolved),
            "domain":      domain,
            "kanji":       row["kanji"],
            "kana":        row["kana"],
            "meaning":     row["meaning"],
            "level":       native_level,
            "theme_level": row["level"],
        })
    return entries
