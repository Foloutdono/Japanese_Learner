"""
Parses a Yomitan-format dictionary dump (tag_bank_1.json + however many
term_bank_N.json files you have — built for 53, but works with however
many are present) into a few small-ish JSON assets, split by category,
same spirit as build_kanji_index.py.

Background on the source format, since it's a lot messier than
KANJIDIC2: each term_bank_N.json is a flat JSON array of rows

    [term, reading, definition_tags, rules, score, glossary, sequence, term_tags]

  - term / reading: surface form and kana reading for THIS row. A single
    JMdict headword group (one `sequence`) is usually split across
    several rows — one per reading/kanji-form combo, sometimes further
    split per numbered sense (definition_tags like "1 n", "2 adv").
  - definition_tags: space-separated tags. Some are real Yomitan tags
    (defined in tag_bank_1.json — "n", "exp", "uk", ...); a leading bare
    digit is a sense number, not a tag. The special value "forms" marks
    a row that's a rendered kanji/reading forms table, not a gloss.
  - rules: deconjugation rules, e.g. "v5" "adj-i". Usually empty.
  - glossary: a list. Each item is either a plain string (rare, in this
    dump) or a "structured-content" tree — nested dicts/lists roughly
    mirroring HTML (ul/li/table/tr/td/span/a) with a `data.content` tag
    marking what kind of thing it is: "glossary", "infoGlossary",
    "examples", "notes", "references", "antonyms", "sourceLanguages",
    "formsTable". This script walks that tree and flattens each kind
    into plain text (see extract_categories below) rather than keeping
    the HTML-ish structure, since nothing downstream needs to *render*
    it — only read it.
  - sequence: the JMdict entry ID. Shared across every row belonging to
    the same headword group; this is what rows get grouped by below.
  - term_tags: space-separated tags on the term itself (frequency tags
    like "ichi1", "news1", ...).

Output files (out_dir):

  vocab_meta.json
      Dictionary-level info from index.json (title, revision,
      attribution, ...) plus a few stats about this run: how many
      term_bank files were read and how many sequences/rows came out of
      them. Not keyed by entry.

  vocab_tags.json
      { "n": {"category": "...", "sorting_order": 0, "notes": "noun",
               "score": 0}, ... }
      Flat translation of tag_bank_1.json, keyed by tag name.

  vocab_entries_N.json (chunked, N = 1, 2, 3, ...)
      Same shape as a single vocab_entries.json ({sequence: [sense,
      ...]}), just split into chunks of --chunk-size sequences each
      (default 4000) so the full 53-file run doesn't produce one ~180MB
      blob that's awkward to load or diff. With only a handful of
      term_bank files (like the 4 this was tested against) you'll likely
      get a single chunk — that's expected, not an error.

Usage:
    python build_vocab_index.py /path/to/dict/dir ./out
    (expects tag_bank_1.json, term_bank_*.json, and optionally index.json
    all inside /path/to/dict/dir)
"""
import sys
import os
import re
import json
import glob
from collections import defaultdict


def flatten_text(node) -> str:
    """Concatenate every string leaf under `node` in document order.
    Original strings already carry whatever spacing/punctuation they
    need (e.g. "see: "), so plain concatenation reproduces the intended
    reading."""
    if isinstance(node, str):
        return node
    if isinstance(node, dict):
        return flatten_text(node.get("content"))
    if isinstance(node, list):
        return "".join(flatten_text(item) for item in node)
    return ""


_LIST_CATEGORIES = {"glossary", "infoGlossary", "references", "notes", "antonyms", "sourceLanguages"}
_CATEGORY_KEY = {
    "glossary": "glossary",
    "infoGlossary": "info_glossary",
    "references": "references",
    "notes": "notes",
    "antonyms": "antonyms",
    "sourceLanguages": "source_languages",
}


def extract_categories(glossary_field: list) -> dict:
    """Walk one row's glossary field and bucket every piece of text by
    its structured-content category. See module docstring for the list
    of categories this dump actually uses."""
    out = defaultdict(list)

    def walk(node):
        if isinstance(node, str):
            # Bare string glossary item (allowed by the format, rare here).
            out["glossary"].append(node)
            return
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return

        data = node.get("data")
        cat = data.get("content") if isinstance(data, dict) else None

        if cat == "examples":
            lis = node.get("content")
            lis = lis if isinstance(lis, list) else [lis]
            texts = [flatten_text(li) for li in lis]
            for i in range(0, len(texts) - (len(texts) % 2), 2):
                out["examples"].append({"jp": texts[i], "en": texts[i + 1]})
            return

        if cat == "formsTable":
            rows = node.get("content") or []
            table = []
            for row in rows:
                cells = row.get("content") or []
                cells = cells if isinstance(cells, list) else [cells]
                table.append([flatten_text(cell) for cell in cells])
            out["forms_table"].append(table)
            return

        if cat in _LIST_CATEGORIES:
            items = node.get("content")
            items = items if isinstance(items, list) else [items]
            key = _CATEGORY_KEY[cat]
            for item in items:
                text = flatten_text(item)
                if text:
                    out[key].append(text)
            return

        # Unrecognized/unwrapped node (e.g. the outer {"type":
        # "structured-content", "content": [...]}) — recurse into its
        # content only. Recursing into every value would also walk
        # metadata like "type": "structured-content" or "tag": "ul",
        # which are plain strings and would otherwise get misread as
        # glossary text.
        walk(node.get("content"))

    for block in glossary_field:
        walk(block)

    return dict(out)


def parse_tag_bank(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    tags = {}
    for name, category, sorting_order, notes, score in rows:
        tags[name] = {
            "category": category,
            "sorting_order": sorting_order,
            "notes": notes,
            "score": score,
        }
    return tags


def parse_term_banks(paths):
    entries = defaultdict(list)
    row_count = 0
    for path in paths:
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)
        for row in rows:
            term, reading, definition_tags, rules, score, glossary, sequence, term_tags = row
            row_count += 1
            sense = {
                "term": term,
                "reading": reading,
                "tags": definition_tags.split() if definition_tags else [],
                "rules": rules.split() if rules else [],
                "score": score,
                "term_tags": term_tags.split() if term_tags else [],
            }
            sense.update(extract_categories(glossary))
            entries[str(sequence)].append(sense)
    return entries, row_count


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python build_vocab_index.py /path/to/dict/dir [out_dir] [chunk_size]")
        sys.exit(1)

    dict_dir = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    chunk_size = int(sys.argv[3]) if len(sys.argv) > 3 else 4000
    os.makedirs(out_dir, exist_ok=True)

    tag_bank_path = os.path.join(dict_dir, "tag_bank_1.json")
    term_bank_paths = sorted(
        glob.glob(os.path.join(dict_dir, "term_bank_*.json")),
        key=lambda p: int(re.search(r"term_bank_(\d+)\.json", p).group(1)),
    )
    if not term_bank_paths:
        print(f"No term_bank_*.json files found in {dict_dir}")
        sys.exit(1)

    tags = parse_tag_bank(tag_bank_path)
    entries, row_count = parse_term_banks(term_bank_paths)

    index_path = os.path.join(dict_dir, "index.json")
    meta = {}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            meta = json.load(f)
    meta["_build_stats"] = {
        "term_bank_files_read": [os.path.basename(p) for p in term_bank_paths],
        "rows_parsed": row_count,
        "sequences": len(entries),
        "tags": len(tags),
        "chunk_size": chunk_size,
    }

    with open(os.path.join(out_dir, "vocab_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    with open(os.path.join(out_dir, "vocab_tags.json"), "w", encoding="utf-8") as f:
        json.dump(tags, f, ensure_ascii=False, indent=2)

    seq_keys = list(entries.keys())
    num_chunks = max(1, (len(seq_keys) + chunk_size - 1) // chunk_size)
    for i in range(num_chunks):
        chunk_keys = seq_keys[i * chunk_size:(i + 1) * chunk_size]
        chunk = {k: entries[k] for k in chunk_keys}
        with open(os.path.join(out_dir, f"vocab_entries_{i + 1}.json"), "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, indent=2)

    print(f"{len(term_bank_paths)} term_bank file(s) read, {row_count} rows -> {len(entries)} sequences.")
    print(f"{len(tags)} tags loaded from tag_bank_1.json.")
    print(f"Wrote {num_chunks} vocab_entries_N.json chunk(s) of up to {chunk_size} sequences each.")
