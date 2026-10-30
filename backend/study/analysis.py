# ── The local analysis tier ───────────────────────────────────────
# Everything a Sentence breakdown needs that a language model is NOT
# required for: segmentation, readings, furigana, deck matches, SRS
# status, grammar points, JLPT grading. All of it is composed from
# modules that already existed -- morphology.tokenize (MeCab/UniDic),
# card_lookup's resolvers, furigana.align_deck, difficulty's grammar and
# level machinery -- none of which the phrase analyzer used before this.
#
# The one thing genuinely missing here is the contextual gloss ("what
# does this word mean IN THIS SENTENCE") and the prose explanation --
# both need a model, and both stay out of this module on purpose. See
# docs/adr/0001-two-tier-sentence-analysis.md for the split this module
# is one half of.
#
# analyze_local MUST stay pure: no database, no user_id, no imports from
# core/. That purity is what lets one Sentence's analysis be computed
# once and shared across every learner who asks about it -- attach_user_state
# is the separate, per-user half.
import logging
import re
from dataclasses import replace

from content.grammar_points_data import find, grammar_to_id
from study import morphology
from study.grammar_detect import NO_GOOD_VERBS, compound_particles, no_good_points
from content.vocab_jmdict_data import vocab_jmdict_to_id
from content import jmdict_fr
import content.vocab_jmdict_data as jmdict_db
from study.card_lookup import (
    resolve_morpheme, resolve_compound, resolve_phrase, compound_reading, resolve_lemma,
    resolve_pool_morpheme, resolve_pool_compound, resolve_saying, pool_gloss,
    resolve_function_word, resolve_opening, resolve_pool_phrase, resolve_idiom,
    resolve_split_word, resolve_adverb_tail, resolve_adverb_whole, resolve_whole_word, resolve_name_fragments, resolve_polite_noun,
    resolve_te_noun, resolve_interjection, resolve_home, resolve_humble_errand, numeral_value, kana_card, resolve_pool_whole_word,
    resolve_pool_idiom, resolve_pool_saying, resolve_pool_opening, a_points_own_verb, split_unknown_compound, split_unknown_verb,
    compound_tail_readings,
    find_kanji_matches, find_segments_in_text, card_stats, serializable_entry,
    VOCAB_STATUS_MODES, KANJI_STATUS_MODES, GRAMMAR_STATUS_MODES,
)
from study.furigana import align_deck
from translations import fr_gloss
from translations.fr.vocab_fr import VOCAB_FR
from translations.es.vocab_es import VOCAB_ES
from study import difficulty
from study import grammar_detect
from study import particle_glosses
from study import card_lookup

logger = logging.getLogger(__name__)

# Content-word part-of-speech classes, per morphology.py's _POS_MAP. Used
# to decide what counts toward unknown_count / off_deck_count below --
# particles and auxiliaries are grammar scaffolding, not vocabulary a
# learner is expected to have "learned" as a card.
_CONTENT_POS = frozenset({"noun", "verb", "adjective", "adverb"})
# The public name, for study/level_mix.py -- one definition, not three.
CONTENT_POS = _CONTENT_POS


def _grammar_entries(sentence: str, morphemes=None) -> list[dict]:
    """grammar_detect's hits, resolved to a real catalogue entry and a
    card id. A hit that can't be resolved is dropped (logged, not
    raised) rather than shipped as a chip with nothing behind it --
    never hand-construct the id string, since grammar_to_id's format is
    the one place that's allowed to know it.

    `kind` rides along: "marker" for a point that IS one grammatical
    word (は, です／だ), "pattern" for one built around a word
    (〜ます／〜ません). Both are cards and both open; what differs is
    where a screen puts them, since a chip strip of は・が・を over every
    sentence is wallpaper while the same point on the row of that very
    particle is the answer to "what is this ん doing here".

    `morphemes` is the tokenization the caller already has, so a
    breakdown reads the sentence once.

    `meaning` and `structure` (plan 095) are the catalogue's own one-line
    gloss and formation, so a chip can say what the rule does without
    the learner opening its sheet -- 〜ながら is "while", and nobody
    should have to press it to learn that. The gloss travels as the
    catalogue's {en, fr} pair rather than in one language: this result
    is pure and shared across every learner who asks about the sentence
    (see the module docstring), and which language the reader is in is
    the screen's to decide (frontend grammarGloss.js). The comprehension
    result's points (routes/reading.py) were already localised on the
    server into a plain string; the same reader takes both.

    `segments` (plan 095) is where on the sentence the point is written,
    as [start, end] pieces -- one for a point written in one piece, one
    per part for から〜まで, whose `start`..`end` reaches over a clause
    it does not own. A screen that shows where a rule sits lights the
    pieces (frontend grammarSpans.js); the tokens a point covers are
    the pieces' tokens (_attach_grammar).
    """
    out = []
    for hit in grammar_detect.hits(sentence, morphemes):
        pattern, level = hit["pattern"], hit["level"]
        found = find(pattern)
        entry = found[1] if found and found[0] == level else None
        if entry is None:
            logger.debug("detect hit %r/%s has no catalogue entry; dropped", pattern, level)
            continue
        meaning = entry.get("meaning")
        out.append({
            "pattern": pattern,
            "level": level,
            "start": hit["start"],
            "end": hit["end"],
            "segments": [list(seg) for seg in hit["segments"]],
            "kind": hit["kind"],
            "raw_id": grammar_to_id(entry, level),
            # A copy, never the catalogue's own dict: this result is
            # cached and handed around, and nothing downstream may be
            # able to edit the catalogue through it.
            "meaning": dict(meaning) if isinstance(meaning, dict) else (meaning or ""),
            "structure": entry.get("structure", ""),
            # The formation line in French (plan 215) and Spanish (plan
            # 291), beside the English, as `meaning` carries them all: the
            # analysis is shared across learners and the screen reads its
            # own.
            "structure_fr": entry.get("structure_fr", ""),
            "structure_es": entry.get("structure_es", ""),
        })
    return out


def _attach_grammar(tokens: list[dict], grammar: list[dict]) -> None:
    """Give every token the points written on it, in place.

    This is what makes a grammar point reachable the way a word is: the
    rows under a sentence are the learner's map of it, and until now a
    row like 「へ」 was the one kind of row that went nowhere -- no deck
    entry, no card, nothing to press -- while the rule it is an instance
    of sat in a chip below, unconnected to the word that demonstrates
    it. A point covering a token is that token's own rule, so the row
    opens it.

    Covering means written on one of the point's `segments`, not lying
    anywhere under its span: から〜まで reaches from から to まで, and
    the 家 between them is not an instance of it. Attached by span, a
    stage card for 家 listed から〜まで as that word's rule (plan 095).
    """
    for token in tokens:
        start, end = token["start"], token["end"]
        token["grammar"] = [
            # The occurrence's own offsets ride along, so the row that
            # opens a marker can light the very particle it is in the
            # line above -- the same point twice in a sentence is two
            # lights, not one (frontend grammarSpans.js).
            {k: g[k] for k in ("pattern", "level", "raw_id", "kind", "meaning", "structure",
                               "structure_fr", "structure_es", "start", "end", "segments")}
            for g in grammar
            if any(s < end and start < e for s, e in g["segments"])
        ]


# The tokens a set phrase or a sentence-opening conjunction was folded
# into (_tokens): one word each, whatever letters the detector read in it.
_ONE_WORD_POS = frozenset({"interjection", "conjunction"})
# The conjunctions a pronoun opens (card_lookup.resolve_opening).
_PRONOUN_OPENED = ("それ",)


def _outside_set_phrases(tokens: list[dict], grammar: list[dict]) -> list[dict]:
    """The markers not written inside a set phrase (plan 266): では opening
    a sentence is "well then", not the で of a place and the は of a
    topic; だが is "but", not the copula and a subject's が. A particle's
    marker written wholly inside such a word, and shorter than it, is its
    letters' -- as the detector leaves the か of 何か to 何か -- and so is
    a part of a point in several. A pattern written in one piece there is
    the phrase's own make (いらっしゃいませ is いらっしゃる told, すみません's
    ません the polite negative) and stays, as does a point that IS the
    word (しかし)."""
    words = [(t["start"], t["end"]) for t in tokens if t.get("pos") in _ONE_WORD_POS]
    if not words:
        return grammar
    # A conjunction それ opens is no phrase made of its letters' points:
    # それでは is "well then", not the point それで and a topic's は;
    # それでも "even so", not それ and 〜でも "or something" (plan 272).
    # Every point written wholly inside it, and shorter, is its letters'.
    # (だが keeps its 〜が（逆接）: that IS its make.)
    conjunctions = [(t["start"], t["end"]) for t in tokens
                    if t.get("pos") == "conjunction" and t["surface"].startswith(_PRONOUN_OPENED)]

    def borrowed(g) -> bool:
        if any(all(s <= a and b <= e for a, b in g["segments"]) and (g["start"], g["end"]) != (s, e)
               for s, e in conjunctions):
            return True
        if g.get("kind") == "marker":
            return any(all(s <= a and b <= e for a, b in g["segments"]) and (g["start"], g["end"]) != (s, e)
                       for s, e in words)
        # A point in several parts that reads one of them in the word's
        # letters: the は of では is no half of 〜は〜が, the も of でも no
        # first も of 〜も〜も.
        return len(g["segments"]) > 1 and any(
            s <= a and b <= e and (a, b) != (s, e) for a, b in g["segments"] for s, e in words)

    return [g for g in grammar if not borrowed(g)]


def _pool_match(entry: dict) -> dict:
    """A JMdict pool word as a token's vocab_match (plan 148): the same
    shape as a deck word's, so every screen that glosses a word, opens
    its entry or adds it to a deck reads it where it already reads one,
    with `level` null -- the pool has no JLPT level, and a null level is
    what draws no badge -- and `pool` saying so outright. The entry is
    cut to the three fields a screen reads: a video session stores the
    analysis of every line it holds (routes/video.py)."""
    out = {
        "level": None,
        "raw_id": vocab_jmdict_to_id(entry),
        "entry": {"kanji": entry.get("kanji", ""), "kana": entry.get("kana", ""),
                  "meaning": pool_gloss(entry)},
        "pool": True,
    }
    # Its French and Spanish lines beside the English, where the pool's
    # layers have them (plans 215, 291) -- the same fields a deck word
    # carries (_deck_match), so tokens.js's wordGloss reads them
    # unchanged. An affix row keeps the one sense it was chosen for, in
    # English: a layer's line is the word's, not that sense's.
    for lang in () if entry.get("affix") else jmdict_fr.LANGS:
        line = jmdict_fr.pool_line(entry.get("kanji", ""), entry.get("kana", ""), lang)
        if line:
            out["entry"][f"meaning_{lang}"] = line
    return out


# The fields JMdict files a sense under, and the words that say a
# sentence is in one (plan 272): 画像を読み込めません is computing, so
# 読み込む is "to load (data)" before "to read thoroughly".
_FIELDS = {
    "comp": frozenset({"データ", "ファイル", "画像", "アプリ", "パソコン", "ＰＣ", "PC", "サーバー", "サーバ", "ダウンロード",
                       "アップロード", "通信", "ブラウザ", "ページ", "システム", "ソフト", "ソフトウェア", "インストール",
                       "ログイン", "パスワード", "メモリ", "インターネット", "ネット", "サイト", "ウェブ", "スマホ", "端末",
                       "再起動", "エラー", "プログラム", "動画", "アカウント", "クリック", "タップ", "画面", "回線",
                       "コンピューター", "コンピュータ", "メール", "アップデート", "バージョン", "キャッシュ", "QR", "ＱＲ"}),
    "baseb": frozenset({"打者", "投手", "ピッチャー", "バッター", "塁", "満塁", "イニング", "ホームラン", "ストライク",
                        "アウト", "盗塁", "打席", "安打", "三振", "キャッチャー", "野球", "外角", "内角", "併殺", "犠打"}),
    "sumo": frozenset({"土俵", "横綱", "大関", "関脇", "小結", "力士", "取組", "行司", "相撲", "番付", "押し出し",
                       "寄り切り", "上手投げ", "まわし", "幕内", "千秋楽"}),
    "med": frozenset({"患者", "病院", "診察", "症状", "手術", "処方", "医師", "看護", "治療", "投与", "診断", "病棟",
                      "外来", "副作用", "服用"}),
    "law": frozenset({"規約", "契約", "法令", "法律", "条項", "規定", "当事者", "民法", "刑法", "裁判", "判決", "原告",
                      "被告", "条例", "本規約", "甲", "乙", "第三者", "約款"}),
    "sports": frozenset({"試合", "選手", "ゴール", "シュート", "キーパー", "得点", "サッカー", "クロス", "ドリブル",
                         "パス", "前半", "後半", "ハーフ", "コーナー"}),
    "Buddh": frozenset({"仏教", "寺", "お寺", "僧", "仏", "仏様", "地獄", "極楽", "菩薩", "お経", "住職", "和尚", "念仏",
                        "修行", "輪廻", "涅槃", "成仏", "罪人", "亡者", "閻魔"}),
    "Christn": frozenset({"教会", "キリスト", "キリスト教", "聖書", "神父", "牧師", "信者", "礼拝", "イエス", "天国", "洗礼"}),
}
# Where JMdict files no sense under the field, the glosses it says
# first: 規約に定めのない事項 is a "provision", no "law; destiny".
_FIELD_GLOSSES = {"law": ("provision", "stipulation", "clause", "regulation", "rule")}


def _of_another_field(joined: tuple[str, str], morphemes) -> bool:
    """Whether the dictionary's compound verb is a field's word alone and
    its sentence is in none of that field (plan 272): 読み出す is "to
    read out (data)" and nothing else, so 本を読み出した is 読む + 〜出す,
    "began to read", where データを読み出した is the one verb."""
    from content.vocab_data import VOCAB_BY_LEVEL
    lemma, said = joined
    if any((e.get("kanji") or "") == lemma for entries in VOCAB_BY_LEVEL.values() for e in entries):
        return False
    senses = jmdict_db.get_senses(lemma, said) or []
    owned = [set(s.get("tags") or ()) & set(_FIELDS) for s in senses]
    if not senses or not all(owned):
        return False
    words = {m.surface for m in morphemes} | {m.lemma for m in morphemes}
    return not any(words & _FIELDS[f] for tags in owned for f in tags)


def _senses_by_sentence(tokens: list[dict]) -> None:
    """A pool word's line by what its sentence says (plan 272): the
    sense of the sentence's field first (読み込む in a sentence about an
    image, 立ち合い in a bout, 定め in a contract), and a word used as a
    な-adjective by that sense (デートにぴったりだ, "perfectly suited",
    no "tightly"). The first senses stay after it."""
    from study.card_lookup import _ASIDE, _POOL_GLOSS_MAX
    surfaces = [t["surface"] for t in tokens]
    for k, t in enumerate(tokens):
        vm = t.get("vocab_match") or {}
        if not vm.get("pool") or vm.get("entry", {}).get("affix"):
            continue
        entry = vm["entry"]
        others = set(surfaces[:k] + surfaces[k + 1:])
        fields = {f for f, words in _FIELDS.items() if others & words}
        found = jmdict_db.get_senses(entry.get("kanji", ""), entry.get("kana", "")) or []
        nxt = tokens[k + 1] if k + 1 < len(tokens) else None
        as_na = nxt is not None and (nxt["surface"] in ("な", "だ", "です", "でした", "だった")
                                     or nxt.get("lemma") in ("だ", "です"))
        chosen, lead = None, None
        for n, sense in enumerate(found):
            tags = set(sense.get("tags") or ())
            if n and (tags & fields or (as_na and "adj-na" in tags and "adj-na" not in set(found[0].get("tags") or ()))):
                chosen = sense
                break
        if chosen is None and found and set(found[0].get("tags") or ()) & set(_FIELDS) - fields:
            # (and a first sense of a field the sentence is in none of
            # gives way to the word's plain one: 家計は火の車だ is "dire
            # straits", no Buddhist "fiery chariot")
            chosen = next((sense for sense in found[1:] if not set(sense.get("tags") or ()) & set(_FIELDS)), None)
        if chosen is None and fields & set(_FIELD_GLOSSES):
            wanted = [g for f in fields & set(_FIELD_GLOSSES) for g in _FIELD_GLOSSES[f]]
            for sense in found:
                hit = next((g for g in wanted if g in (sense.get("glossary") or ())), None)
                if hit and hit != (sense.get("glossary") or [""])[0]:
                    chosen, lead = sense, hit
                    break
        if chosen is None:
            continue
        glosses = [_ASIDE.sub("", g).strip() for g in chosen.get("glossary") or ()]
        head = [lead] + [g for g in glosses if g != lead][:1] if lead else glosses[:2]
        line = ", ".join(head)
        for part in (entry.get("meaning") or "").split("; "):
            if part and part not in head and len(line + "; " + part) <= _POOL_GLOSS_MAX:
                line += "; " + part
        entry["meaning"] = line
        for lang in jmdict_fr.LANGS:
            said = jmdict_fr.sense("; ".join(chosen.get("glossary") or ()), lang)
            if said:
                entry[f"meaning_{lang}"] = said


def _deck_match(level: str, entry: dict, raw_id: str) -> dict:
    """A deck card as a token's vocab_match, its French gloss beside its
    English one (plan 160). The analysis is pure and shared across
    learners, so it cannot know the reader's language, and carries both,
    as a grammar point carries its {en, fr}; the screen reads its own
    (frontend tokens.js's wordGloss). The French is the card's own line
    (plan 107's per-card key, then the form's), and absent where the
    card has none, so a screen falls back to the English. The Spanish
    (plan 291) rides the same way, as `meaning_es`."""
    out = {"level": level, "raw_id": raw_id, "entry": serializable_entry(entry)}
    french = fr_gloss(entry, VOCAB_FR)
    if french:
        out["entry"]["meaning_fr"] = french
    spanish = fr_gloss(entry, VOCAB_ES)
    if spanish:
        out["entry"]["meaning_es"] = spanish
    return out


# What a name the course has no card for is (plan 266), by the kind
# UniDic files it under (morphology.Morpheme.name_kind). The analysis is
# shared across learners, so the line carries every language, as a
# grammar point's gloss does, and the screen reads its own (frontend
# tokens.js's wordGloss).
_NAME_GLOSS = {
    "family": {"en": "family name", "fr": "nom de famille",
               "es": "apellido"},
    "given": {"en": "given name", "fr": "prénom",
              "es": "nombre de pila"},
    "person": {"en": "a person's name", "fr": "nom de personne",
               "es": "nombre de persona"},
    "place": {"en": "place name", "fr": "nom de lieu",
              "es": "nombre de lugar"},
    "other": {"en": "a name", "fr": "un nom propre",
              "es": "un nombre propio"},
    "business": {"en": "a name (of an inn, a shop, a firm)", "fr": "un nom (d'auberge, de boutique, d'entreprise)",
                 "es": "un nombre (de una posada, una tienda, una empresa)"},
    "vessel": {"en": "a name (of a train, a ship)", "fr": "un nom (de train, de navire)",
               "es": "un nombre (de un tren, un barco)"},
}


def _token_dict(m: morphology.Morpheme, hit, pool=None, named: bool = False) -> dict:
    """`hit` is card_lookup.resolve_morpheme's answer for `m`, resolved
    by the caller, which has the neighbours the resolver reads; `pool`
    is resolve_pool_morpheme's, asked only where `hit` is None; `named`
    is whether an honorific follows a name (_named)."""
    vocab_match = None
    if hit:
        level, entry, raw_id = hit
        vocab_match = _deck_match(level, entry, raw_id)
    elif pool:
        vocab_match = _pool_match(pool)

    kanji_matches = [
        {"kanji": char, "level": level, "raw_id": raw_id, "entry": serializable_entry(entry)}
        for char, level, entry, raw_id in find_kanji_matches(m.surface)
    ]

    # Furigana goes over the surface AS WRITTEN, so it uses `reading`
    # (the inflected reading) -- not `lemma_reading`, which is the
    # dictionary form's reading and can differ from what's on the page.
    reading = _card_reading(m, hit[1] if hit else pool)
    furigana = align_deck(m.surface, reading)

    # (低め read as the pool's "lowish" is a noun, whatever UniDic
    # tagged it, plan 272)
    pos = "noun" if pool is not None and m.pos == "verb" and (pool.get("kanji") or "") == m.surface \
        and m.surface.endswith("め") and "ish" in (pool.get("meaning") or "") else m.pos
    token = {
        "surface": m.surface, "start": m.start, "end": m.end,
        "lemma": m.lemma, "reading": reading, "pos": pos,
        "furigana": furigana,
        "vocab_match": vocab_match,
        "kanji_matches": kanji_matches,
    }
    if vocab_match is None and m.name_kind and (named or m.name_kind in ("place", "business", "vessel") or not _hiragana(m.surface)):
        # A name has no card, and its row said nothing: 田中 and マルタン
        # read as a word the course does not teach (plan 266). Written in
        # hiragana, a name is the tokenizer's guess unless an honorific
        # says so (`named`): the ゆう of ゆうがた is 夕方 cut in two, no
        # Yū. A place it knows (とうきょう, おおさか) it reads as one.
        token["gloss"] = dict(_NAME_GLOSS[m.name_kind])
    elif vocab_match is None and m.unknown and _JAPANESE_LETTERS.search(m.surface) \
            and m.pos not in ("auxiliary", "particle"):
        # (Never an ending said short, なってんの's てん: no name, plan 272.)
        # Letters no dictionary has a word for (plan 272), read back as
        # one word -- ぷらそにか, a choir; ゆるりんず, a channel -- say so,
        # and what they most often are; a sound shaped as one (ゴゴゴ) is
        # a sound.
        # (...unless the word is one the glosses know: そんなん, plan 272)
        token["gloss"] = particle_glosses.gloss([m], 0) if particle_glosses._a_sound_word(m.surface, m.pos) \
            else (particle_glosses.gloss([m], 0) or dict(_UNKNOWN_GLOSS))
    return token


# A kana and the ones it is said as beside another: つ ち く き geminate
# (鉄製 てっせい), and an unvoiced one voices (衝動買い しょうどうがい).
_GEMINATES = frozenset("つちくき")
_VOICED_OF = dict(zip("かきくけこさしすせそたちつてとはひふへほはひふへほ",
                      "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ"))


def _sound_changed(said: str, card: str) -> bool:
    """Whether `card` is `said` with a sound change a compound makes: a
    letter doubled (てつせい てっせい) or voiced (かい がい) -- the same
    word, read as the dictionary reads it."""
    if len(said) != len(card) or said == card:
        return False
    return all(a == b or (b == "っ" and a in _GEMINATES) or _VOICED_OF.get(a) == b
               for a, b in zip(said, card))


def _latin_reading(entry: dict) -> str:
    """A JMdict row's reading of Latin letters, said as one word: ＳＮＳ's
    エス・エヌ・エス is えすえぬえす (plan 272)."""
    kana = (entry.get("kana") or "").replace(";", "/").split("/")[0].replace("・", "").strip()
    return morphology.kata_to_hira(kana)


def _card_reading(m: morphology.Morpheme, entry: dict | None) -> str:
    """The reading a token is printed with: the card's own where the card
    is the token, spelled alike, and the tokenizer read it without the
    sound change the dictionary writes (鉄製 is てっせい, plan 272); the
    token's otherwise."""
    if entry is not None and (entry.get("kanji") or "") in (card_lookup._full_width(m.surface),
                                                         card_lookup._full_width(m.surface).replace("－", "-")) \
            and entry.get("kanji") != m.surface:
        return _latin_reading(entry)       # SNS えすえぬえす, Wi-Fi わいふぁい (plan 272)
    if entry is None or m.pos not in ("noun", "suffix", "prefix") or (entry.get("kanji") or "") != m.surface:
        return m.reading
    readings = [r.strip() for r in (entry.get("kana") or "").replace(";", "/").split("/") if r.strip()]
    if len(readings) == 1 and _sound_changed(m.reading, readings[0]):
        return readings[0]
    return m.reading


# What a word no dictionary knows is, most often (plan 272).
_UNKNOWN_GLOSS = {"en": "not in the dictionary (a name?)", "fr": "absent du dictionnaire (un nom ?)",
                  "es": "no está en el diccionario (¿un nombre?)"}
_JAPANESE_LETTERS = re.compile(r"[ぁ-ヿ一-鿿]")


def _hiragana(text: str) -> bool:
    return bool(text) and all("\u3041" <= c <= "\u309f" for c in text)


def _number_dict(run: list, value: int) -> dict:
    """One token for a number written in kanji (plan 266): 三十 had no
    card and 九千三百五十 was three rows that said nothing, a number the
    learner had to add up from the kanji's own cards (三, 千, 百). Its
    gloss is the figure, written as each language writes it."""
    surface = "".join(m.surface for m in run)
    reading = "".join(m.reading for m in run)
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": surface, "reading": reading, "pos": "noun",
        "furigana": align_deck(surface, reading),
        "vocab_match": None,
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
        "number": value,
        "gloss": {"en": f"{value:,}", "fr": f"{value:,}".replace(",", " "), "es": _es_figure(value)},
    }


def _numeral_run(morphemes: list, i: int, deck_hits: list) -> int:
    """How many morphemes from `i` write one number in kanji, or 0: 九千 +
    三百 + 五十, 三 + 万 + 五千, 三十 alone. A lone numeral the deck has a
    card for (十, 千) keeps it, and a number in digits says itself. Folded
    before the deck's date compounds can take its last digit: 十 + 八日 was
    "ten" and "the eighth day", where 十八日 is the eighteenth."""
    n = 0
    while i + n < len(morphemes) and morphemes[i + n].pos == "noun" \
            and all(c in _NUMERAL_CHARS for c in morphemes[i + n].surface):
        n += 1
    if n == 0 or (n == 1 and deck_hits[i]):
        return 0
    written = "".join(m.surface for m in morphemes[i:i + n])
    if not any(c in _NUMERAL_UNITS for c in written) or numeral_value(written) is None:
        # Digits read one by one are no number: 三四五六の七八一二番 is a
        # telephone's, said digit by digit, and each keeps its card.
        return 0
    return n


_NUMERAL_CHARS = frozenset("〇一二三四五六七八九十百千万億兆0123456789０１２３４５６７８９")
_NUMERAL_UNITS = frozenset("十百千万億兆")

# What counts after a number though UniDic files it as a plain noun or
# suffix rather than a counter (助数詞): 三人's 人, 3曲目's 曲 (plan 272).
_COUNTING = frozenset("人曲名番着足羽頭首話部問点球通票件品色社校店便号位")
_FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")
_KANJI_DIGITS = ("一", "二", "三", "四", "五", "六", "七", "八", "九", "十")


def _number_of(text: str) -> int | None:
    """The number a numeral says, in kanji (三十, 4万2310) or in digits."""
    value = numeral_value(text)
    if value is None:
        digits = text.translate(_FULLWIDTH_DIGITS)
        value = int(digits) if digits.isdigit() else None
    return value


def _counted_run(morphemes: list, i: int) -> tuple[int, int]:
    """(numerals, length) where morphemes[i:] are a number and what it
    counts -- 1 + つ, ２ + 人, 3 + 曲目 -- or (0, 0). Digits said one by
    one count nothing (七八一二番, a telephone's)."""
    def numeral(k: int) -> bool:
        return morphemes[k].pos == "noun" and all(c in _NUMERAL_CHARS for c in morphemes[k].surface)

    if i > 0 and numeral(i - 1):
        return 0, 0
    n = 0
    while i + n < len(morphemes) and numeral(i + n):
        n += 1
    if n == 0 or i + n >= len(morphemes):
        return 0, 0
    written = "".join(m.surface for m in morphemes[i:i + n])
    if (n > 1 and not any(c in _NUMERAL_UNITS for c in written)) or _number_of(written) is None:
        return 0, 0
    counter = morphemes[i + n]
    if counter.pos not in ("noun", "suffix") or not (counter.counter or counter.surface in _COUNTING
                                                      or _glued_ordinal(counter)):
        return 0, 0
    return n, n + 1


def _glued_ordinal(m) -> bool:
    """曲目 as UniDic reads it in 3曲目は: one word, the noun きょくもく,
    "programme" -- where the page writes the counter 曲 and the ordinal
    目 (plan 272)."""
    # (never 品目, "items": 約200品目, plan 272)
    return len(m.surface) == 2 and m.surface[1] == "目" and m.surface[0] in _COUNTING and m.surface != "品目"


def _ordinal(value: int, lang: str) -> str:
    if lang == "fr":
        return "1er" if value == 1 else f"{value:,}".replace(",", " ") + "e"
    if lang == "es":
        # (n.º 3, "number 3": 3.º and 3.ª would give the counted noun a
        # gender, plan 291)
        return f"n.º {_es_figure(value)}"
    suffix = "th" if 10 <= value % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value:,}{suffix}"


def _counted_dict(run: list, numerals: int, printed=None) -> dict | None:
    """One token for a number and its counter where the two are one word
    on the page (plan 272), or None -- a number and its counter are two
    words otherwise, each with its card (三 + 杯, 七 + 時; plans 151 and
    266):

    - a small number written in digits, where the deck writes the word
      in kanji: １つ is 一つ, "one (thing)", ２人 二人, ３日 三日;
    - an ordinal UniDic read as another word: 3曲目's 曲目 is the counter
      曲 and the ordinal め, the third song, never きょくもく "programme"."""
    surface = "".join(m.surface for m in run)
    # (A number in digits is read as it is said, _printed_numbers.)
    reading = (printed[2] if printed else "".join(m.reading for m in run[:numerals])) \
        + "".join(m.reading for m in run[numerals:])
    value = _number_of("".join(m.surface for m in run[:numerals]))
    counted = run[numerals]
    token = {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": surface, "reading": reading, "pos": "noun",
        "furigana": None, "vocab_match": None,
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
        "number": value,
    }
    if _glued_ordinal(counted):
        if counted.reading.endswith("もく"):
            token["reading"] = (printed[2] if printed else "".join(m.reading for m in run[:numerals])) \
                + counted.reading[:-2] + "め"
        english, french, spanish = _counted_sense(counted.surface[0], counted.reading[:-2])
        if counted.surface[0] not in _ORDINAL_SENSE:
            english, french, spanish = (english or counted.surface[0], french or english or counted.surface[0],
                                        spanish or english or counted.surface[0])
        token["gloss"] = {"en": " · ".join(filter(None, (_ordinal(value, "en"), english))),
                          "fr": " · ".join(filter(None, (_ordinal(value, "fr"), french))),
                          "es": " · ".join(filter(None, (_ordinal(value, "es"), spanish)))}
    elif value is not None and 1 <= value <= 10 and not any(c in _KANJI_DIGITS for c in surface):
        written = _KANJI_DIGITS[value - 1] + "".join(m.surface for m in run[numerals:])
        hit = resolve_lemma(written, reading, written)
        if hit is None or (hit[1].get("kanji") or "") != written:
            return None
        token["vocab_match"] = _deck_match(*hit)
    else:
        return None
    token["furigana"] = _printed_furigana(run, numerals, printed, token["reading"])
    return token


def _printed_furigana(run: list, numerals: int, printed, reading: str) -> list[dict]:
    """The furigana of a number and what follows it, `reading` whole:
    the number's reading over its digits, which align_deck leaves bare
    (it aligns a reading over kanji), and the rest aligned."""
    surface = "".join(m.surface for m in run)
    if not printed:
        return align_deck(surface, reading)
    said = printed[2]
    digits = "".join(m.surface for m in run[:numerals])
    if not reading.startswith(said):
        return [{"text": surface, "reading": reading}]
    rest = "".join(m.surface for m in run[numerals:])
    return [{"text": digits, "reading": said}] + (align_deck(rest, reading[len(said):]) if rest else [])


# A counter written in kana after a number in digits (plan 272): あと5ふん
# is five minutes, which UniDic read 糞, "feces". The counter's kanji and
# its reading as a card files it.
_KANA_COUNTERS = {
    "ふん": ("分", "ふん"), "ぷん": ("分", "ふん"), "じ": ("時", "じ"),
    "じかん": ("時間", "じかん"), "にん": ("人", "にん"), "かい": ("回", "かい"),
    "ほん": ("本", "ほん"), "ぼん": ("本", "ほん"), "ぽん": ("本", "ほん"),
    "まい": ("枚", "まい"), "さい": ("歳", "さい"), "えん": ("円", "えん"),
    "ひき": ("匹", "ひき"), "びき": ("匹", "ひき"), "ぴき": ("匹", "ひき"),
    "びょう": ("秒", "びょう"), "ねん": ("年", "ねん"), "がつ": ("月", "がつ"),
}


def _printed_numbers(morphemes: list) -> tuple[list, dict[int, tuple[int, str, str]]]:
    """The numbers a sentence prints in digits, read as they are said
    (plan 272): {index of the number's first morpheme: (index after it,
    the number as printed, its reading)}, and the morphemes with the
    counter after each read as it is said there.

    UniDic reads a figure as itself, so 30 had no reading at all and
    the row said nothing, and it reads a few in full width as English:
    １０ was てん, ４０ ふぉーてぃ. A number is read here as furigana
    reads it (study/furigana.py, plan 177) -- 1,500 and 3.5 one number
    each, 30分 さんじゅっ + ぷん -- and its counter takes the card it is
    there: 30分's 分 is the N5 ふん, "minute", where UniDic filed it under
    ぶん, "portion"; 5ふん is 分, never 糞."""
    from study import furigana

    out = list(morphemes)
    numbers = {}
    for i, span in furigana._number_spans(morphemes).items():
        j, printed = span
        if j < len(out) and out[j].pos in ("noun", "suffix") and out[j].surface in _KANA_COUNTERS:
            kanji, base = _KANA_COUNTERS[out[j].surface]
            out[j] = replace(out[j], lemma=kanji, lemma_reading=base, counter=True)
        found = furigana._numeral_parts(out, i, span)
        if found is None:
            continue
        parts, after = found
        if j < len(out) and out[j].surface in _MYRIADS:
            # １００万 is one number, ひゃくまん: the digits, then the unit.
            from study.reading_context import read_number
            said = read_number(printed)
            if said:
                numbers[i] = (j + 1, printed + out[j].surface, said + _MYRIADS[out[j].surface])
            continue
        if j < len(out) and out[j].surface in ("％", "%") and parts[0]["reading"].endswith("じゅう"):
            # 10％ じゅっパーセント, the ten cut short before its p (plan 272)
            parts[0]["reading"] = parts[0]["reading"][:-1] + "っ"
        numbers[i] = (j, printed, parts[0]["reading"])
        if j == i + 1:
            out[i] = replace(out[i], reading=parts[0]["reading"])
        if after != j + 1:
            continue
        counter = out[j]
        said = "".join(p.get("reading") or p["text"] for p in parts[1:])
        if said and said != counter.reading and any(morphology._is_kanji(c) for c in counter.surface):
            counter = replace(counter, reading=said)
        if counter.surface in ("分", "分間") and said[:1] in ("ふ", "ぷ"):
            counter = replace(counter, lemma_reading="ふん" + said[2:])
        out[j] = counter
    return out, numbers


_DIGITS_HALF = str.maketrans("０１２３４５６７８９", "0123456789")


def _clock_time(morphemes: list, i: int) -> int:
    """How many morphemes from `i` print a time of day, 10:00 or 9：30
    -- an hour, a colon, two figures of minutes -- or 0 (plan 272). The
    figures beside a colon are no quantity, and were left unread."""
    if i + 2 >= len(morphemes):
        return 0
    h, colon, mm = morphemes[i:i + 3]
    if colon.surface not in (":", "：") or not (h.end == colon.start and colon.end == mm.start):
        return 0
    hour, minutes = h.surface.translate(_DIGITS_HALF), mm.surface.translate(_DIGITS_HALF)
    if not (hour.isdigit() and minutes.isdigit() and len(hour) <= 2 and len(minutes) == 2):
        return 0
    if int(hour) > 29 or int(minutes) > 59:
        return 0
    return 3


def _clock_dict(run: list) -> dict:
    """The token for a time of day (_clock_time): 10:00 read じゅうじ,
    19:30 じゅうくじさんじゅっぷん, glossed with itself."""
    from study.reading_context import numeral_furigana

    hour, minutes = (run[0].surface.translate(_DIGITS_HALF), run[2].surface.translate(_DIGITS_HALF))
    h, m = int(hour), int(minutes)
    said = "れい" if h == 0 else (numeral_furigana(str(h), "時", "じ", "suffix")[0] or str(h))
    reading = said + "じ"
    if m:
        number, counter = numeral_furigana(str(m), "分", "ふん", "suffix")
        reading += (number or str(m)) + (counter or "ふん")
    surface = "".join(t.surface for t in run)
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": surface, "reading": reading, "pos": "noun",
        "furigana": [{"text": surface, "reading": reading}],
        "vocab_match": None, "kanji_matches": [],
        "gloss": {"en": f"{h}:{minutes} (a time of day)", "fr": f"{h} h {minutes}",
                  "es": f"{h}:{minutes} (una hora del día)"},
    }


# What a sentence speaks of when 26-24 is a score (plan 272).
_SCORES = ("セット", "点", "試合", "勝", "敗", "スコア", "ゴール", "得点", "戦", "引き分け", "リード", "同点",
           "逆転", "タイ", "ゲーム", "ラウンド", "回", "イニング")
# ...and what 1/2 is a share of: 大さじ1と1/2.
_MEASURES = ("大さじ", "小さじ", "カップ", "合", "杯", "個", "本", "枚", "切れ")


def _two_figures(morphemes: list, i: int, marks: tuple) -> tuple | None:
    """(first, second) for a figure, a mark of `marks` and a figure at
    morphemes[i:i + 3], each of one or two digits, glued, with no third
    figure after (a phone number is no score), or None."""
    if i + 2 >= len(morphemes):
        return None
    a, mark, b = morphemes[i:i + 3]
    if mark.surface not in marks or not (a.end == mark.start and mark.end == b.start):
        return None
    x, y = a.surface.translate(_DIGITS_HALF), b.surface.translate(_DIGITS_HALF)
    if not (x.isdigit() and y.isdigit() and len(x) <= 2 and len(y) <= 2):
        return None
    if i + 3 < len(morphemes) and morphemes[i + 3].surface in marks + (".", "．"):
        return None
    if i > 0 and (morphemes[i - 1].surface in marks or morphemes[i - 1].surface[-1:].isdigit()):
        return None
    return int(x), int(y)


def _score_dict(morphemes: list, i: int) -> dict | None:
    """The token for a score, 26-24 read にじゅうろくたいにじゅうよん, in a
    sentence of a game (plan 272), or None."""
    from study.reading_context import read_number

    pair = _two_figures(morphemes, i, ("-", "－", "−"))
    text = "".join(m.surface for m in morphemes)
    if pair is None or not any(w in text for w in _SCORES):
        return None
    reading = read_number(str(pair[0])) + "たい" + read_number(str(pair[1]))
    surface = "".join(m.surface for m in morphemes[i:i + 3])
    return {
        "surface": surface, "start": morphemes[i].start, "end": morphemes[i + 2].end,
        "lemma": surface, "reading": reading, "pos": "noun",
        "furigana": [{"text": surface, "reading": reading}],
        "vocab_match": None, "kanji_matches": [],
        "gloss": {"en": f"{pair[0]} to {pair[1]} (a score)", "fr": f"{pair[0]} à {pair[1]} (un score)",
                  "es": f"{pair[0]} a {pair[1]} (un marcador)"},
    }


def _fraction_dict(morphemes: list, i: int) -> dict | None:
    """The token for a share, 1/2 read にぶんのいち, where a measure or a
    whole and と come before it (大さじ1と1/2, plan 272), or None -- a
    date is printed so too (12/18)."""
    from study.reading_context import read_number

    pair = _two_figures(morphemes, i, ("/", "／"))
    if pair is None or i == 0 or not pair[0] or not pair[1]:
        return None
    prev = morphemes[i - 1]
    after = morphemes[i + 3] if i + 3 < len(morphemes) else None
    if not (prev.surface in _MEASURES or (prev.surface == "と" and i >= 2 and morphemes[i - 2].surface[-1:].isdigit())
            or (after is not None and after.surface in _MEASURES and after.start == morphemes[i + 2].end)):
        return None                     # (牛乳1/2カップ: a share of the measure after it, plan 272)
    reading = read_number(str(pair[1])) + "ぶんの" + read_number(str(pair[0]))
    surface = "".join(m.surface for m in morphemes[i:i + 3])
    return {
        "surface": surface, "start": morphemes[i].start, "end": morphemes[i + 2].end,
        "lemma": surface, "reading": reading, "pos": "noun",
        "furigana": [{"text": surface, "reading": reading}],
        "vocab_match": None, "kanji_matches": [],
        "gloss": {"en": f"{pair[0]}/{pair[1]} (a fraction)", "fr": f"{pair[0]}/{pair[1]} (une fraction)",
                  "es": f"{pair[0]}/{pair[1]} (una fracción)"},
    }


# Sizes printed in Latin letters, read where the sentence speaks of a
# size (普段はMですが、ワンサイズ上のLに).
_SIZES = {
    "XS": ("えっくすえす", "size XS (extra small)", "taille XS (très petite)", "talla XS (extra pequeña)"),
    "S": ("えす", "size S (small)", "taille S (petite)", "talla S (pequeña)"),
    "M": ("えむ", "size M (medium)", "taille M (moyenne)", "talla M (mediana)"),
    "L": ("える", "size L (large)", "taille L (grande)", "talla L (grande)"),
    "LL": ("えるえる", "size LL (extra large)", "taille LL (très grande)", "talla LL (extra grande)"),
    "XL": ("えっくすえる", "size XL (extra large)", "taille XL (très grande)", "talla XL (extra grande)"),
}
_SIZE_WORDS = ("サイズ", "服", "シャツ", "着", "身長", "靴", "ズボン", "スカート", "パンツ", "ワンピース", "上着")


# Latin words a page writes that JMdict holds no row for (plan 272).
_LATIN_WORDS = {"MV": ("えむぶい", "a music video (MV)", "un clip musical (MV)", "un video musical (MV)"),
                "PV": ("ぴーぶい", "a promotional video (PV), a music video", "une vidéo promotionnelle (PV), un clip", "un video promocional (PV), un video musical"),
                "ver": ("ばー", "version (ver.)", "version (ver.)", "versión (ver.)"),
                "Ver": ("ばー", "version (Ver.)", "version (Ver.)", "versión (Ver.)")}


def _latin_sense(morphemes: list, i: int) -> tuple[str, dict] | None:
    """(reading, gloss) for Latin letters no row answers (plan 272): a
    unit after a figure (600W, 400ml), a size where a size is spoken of,
    a JLPT level (N3); or None."""
    from study.reading_context import LATIN_UNITS

    m = morphemes[i]
    prev = morphemes[i - 1] if i > 0 else None
    if m.surface in LATIN_UNITS and prev is not None and prev.surface[-1:].isdigit() and prev.end == m.start:
        said, en, fr, es = LATIN_UNITS[m.surface]
        return said, {"en": en, "fr": fr, "es": es}
    text = "".join(u.surface for u in morphemes)
    if m.surface in _SIZES and any(w in text for w in _SIZE_WORDS):
        said, en, fr, es = _SIZES[m.surface]
        return said, {"en": en, "fr": fr, "es": es}
    if m.surface in _LATIN_WORDS:
        said, en, fr, es = _LATIN_WORDS[m.surface]
        return said, {"en": en, "fr": fr, "es": es}
    level = re.fullmatch(r"[NＮ]([1-5１-５])", m.surface)
    if level:
        n = level.group(1).translate(_DIGITS_HALF)
        said = "えぬ" + ("いち", "に", "さん", "よん", "ご")[int(n) - 1]
        return said, {"en": f"the JLPT's level N{n} (N5 the first, N1 the last)",
                      "fr": f"le niveau N{n} du JLPT (N5 le premier, N1 le dernier)",
                      "es": f"el nivel N{n} del JLPT (N5 el primero, N1 el último)"}
    return None


_MYRIADS = {"万": "まん", "億": "おく", "兆": "ちょう"}
_MYRIAD_VALUE = {"万": 10 ** 4, "億": 10 ** 8, "兆": 10 ** 12}


def _es_figure(value, fraction: str = "") -> str:
    """A figure as the RAE writes it (plan 291): no mark in four digits
    (2000), a narrow space between thousands from five (10 000), a point
    before the decimals (3.5)."""
    if isinstance(value, float):
        whole, _, decimals = repr(value).partition(".")
        return _es_figure(int(whole), "" if decimals == "0" else decimals)
    digits = str(value)
    if len(digits.lstrip("-")) > 4:
        digits = f"{value:,}".replace(",", "\u202f")
    return f"{digits}.{fraction}" if fraction else digits


def _figure(printed: str) -> dict:
    """A number's gloss, its figure as each language writes it: 1,500,
    1 500 and 1500, 3.5 and 3,5, １００万 1,000,000."""
    text = printed.translate(_FULLWIDTH_DIGITS).replace("，", ",").replace("．", ".")
    unit = _MYRIAD_VALUE.get(text[-1:], 1)
    if unit > 1:
        text = text[:-1]
    whole, dot, fraction = text.replace(",", "").partition(".")
    if unit > 1:
        value = int(float(f"{whole}.{fraction or 0}") * unit)
        return {"en": f"{value:,}", "fr": f"{value:,}".replace(",", "\u202f"), "es": _es_figure(value)}
    en, fr = f"{int(whole):,}", f"{int(whole):,}".replace(",", "\u202f")
    es = _es_figure(int(whole), fraction if dot else "")
    if dot:
        en, fr = f"{en}.{fraction}", f"{fr},{fraction}"
    return {"en": en, "fr": fr, "es": es}


def _digits_dict(run: list, printed: str, reading: str) -> dict:
    """One token for a number printed in digits (plan 272), read and
    glossed as a number written in kanji is (_number_dict)."""
    whole = printed.translate(_FULLWIDTH_DIGITS).replace("，", ",").replace("．", ".")
    unit = _MYRIAD_VALUE.get(whole[-1:], 1)
    head, _, fraction = (whole[:-1] if unit > 1 else whole).replace(",", "").partition(".")
    value = float(f"{head}.{fraction}") if fraction else int(head)
    return {
        "surface": "".join(m.surface for m in run), "start": run[0].start, "end": run[-1].end,
        "lemma": printed, "reading": reading, "pos": "noun",
        "furigana": [{"text": "".join(m.surface for m in run), "reading": reading}],
        "vocab_match": None, "kanji_matches": [],
        "number": int(value * unit) if unit > 1 else value,
        "gloss": _figure(printed),
    }


# A counter of a span of time the deck has no card for, after a number
# (plan 272): ７日間 is seven days, which the pool's 日間 read にっかん,
# "daytime", glossed.
_SPAN_COUNTERS = {
    "日間": {"en": "days (how long)", "fr": "jours (durée)",
           "es": "días (duración)"},
    "分間": {"en": "minutes (how long)", "fr": "minutes (durée)",
           "es": "minutos (duración)"},
    "秒間": {"en": "seconds (how long)", "fr": "secondes (durée)",
           "es": "segundos (duración)"},
    "か月": {"en": "months", "fr": "mois",
           "es": "meses"},
    "カ月": {"en": "months", "fr": "mois",
           "es": "meses"},
    "ヵ月": {"en": "months", "fr": "mois",
           "es": "meses"},
    "箇月": {"en": "months", "fr": "mois",
           "es": "meses"},
}


# A prefix the deck has no card for in that use (plan 272): 本 in 本研究
# is "this, the present", where its card is 本, "book".
_PREFIX_GLOSSES = {
    # (plan 272: 追体験, 追加; 閉室, 閉店)
    "追": {"en": "(prefix) after, re-, in pursuit: 追体験, reliving; 追加, addition",
          "fr": "(préfixe) après, re-, à la suite : 追体験, revivre ; 追加, ajout",
          "es": "(prefijo) después, re-, en pos de: 追体験, revivir; 追加, adición"},
    "閉": {"en": "(prefix) closing, shut: 閉室, closing the room; 閉店, closing time",
          "fr": "(préfixe) fermeture : 閉室, fermeture de la salle ; 閉店, fermeture",
          "es": "(prefijo) cierre, cerrado: 閉室, cierre de la sala; 閉店, hora de cierre"},
    "本": {"en": "(prefix) this, the present: 本研究, this study", "fr": "(préfixe) ce, le présent : 本研究, cette étude",
          "es": "(prefijo) este, el presente: 本研究, este estudio"},
    "長": {"en": "(prefix) long: 長時間, a long time; 長距離, a long distance",
          "fr": "(préfixe) long : 長時間, longtemps ; 長距離, longue distance",
          "es": "(prefijo) largo: 長時間, mucho tiempo; 長距離, larga distancia"},
    "立": {"en": "(prefix) standing (as): 立候補, standing as a candidate",
          "fr": "(préfixe) se présenter (comme) : 立候補, se porter candidat",
          "es": "(prefijo) presentarse (como): 立候補, presentarse como candidato"},
}
# A suffix whose card is the word it is on its own, another sense (plan
# 272): 可能性's 性 is no "sex, gender", 補助金's 金 no "gold". The word
# before it keeps its card.
_SUFFIX_GLOSSES = {
    "性": {"en": "(suffix) -ness, -ity: the nature of (可能性, possibility)",
          "fr": "(suffixe) -ité, caractère de (可能性, possibilité)",
          "es": "(sufijo) -eza, -idad: la naturaleza de (可能性, posibilidad)"},
    "金": {"en": "(suffix) money, fund, fee (補助金, subsidy)",
          "fr": "(suffixe) argent, fonds, frais (補助金, subvention)",
          "es": "(sufijo) dinero, fondo, tarifa (補助金, subvención)"},
    "用": {"en": "(suffix) for, meant for (子供用, for children)",
          "fr": "(suffixe) pour, destiné à (子供用, pour enfants)",
          "es": "(sufijo) para, destinado a (子供用, para niños)"},
    "化": {"en": "(suffix) -ization, becoming (国際化, internationalization)",
          "fr": "(suffixe) -isation, devenir (国際化, internationalisation)",
          "es": "(sufijo) -ización, volverse (国際化, internacionalización)"},
    # (read せい after a noun, plan 272: never the card's "life, living")
    "生": {"en": "(suffix) student, pupil (転校生, transfer student)",
          "fr": "(suffixe) élève, étudiant (転校生, élève transféré)",
          "es": "(sufijo) estudiante, alumno (転校生, estudiante transferido)"},
}


# What a noun means as the second half of what it is said with, where
# its card leads with another sense (plan 272).
_AFFIX_SENSES = {
    "時": {"en": "(suffix) at the time of, when: 混雑時, at busy times",
          "fr": "(suffixe) au moment de, lors de : 混雑時, aux heures d'affluence",
          "es": "(sufijo) en el momento de, cuando: 混雑時, en horas de mucha afluencia"},
    "台": {"en": "(suffix) the … range or level: 160円台, the 160-yen range",
          "fr": "(suffixe) la tranche des … : 160円台, autour de 160 yens",
          "es": "(sufijo) la franja o el nivel de …: 160円台, la franja de los 160 yenes"},
    "切り": {"en": "(suffix) cut into …: みじん切り, finely chopped",
           "fr": "(suffixe) coupé en … : みじん切り, haché fin",
           "es": "(sufijo) cortado en …: みじん切り, picado fino"},
    "連": {"en": "(counter) in a row: 10連, ten in a row", "fr": "(compteur) d'affilée : 10連, dix d'affilée",
          "es": "(contador) seguidos: 10連, diez seguidos"},
    "膳": {"en": "(counter) pairs of chopsticks, bowls of rice", "fr": "(compteur) paires de baguettes, bols de riz",
          "es": "(contador) pares de palillos, cuencos de arroz"},
    "入り": {"en": "(suffix) holding, with … in it: 十二個入り, a pack of twelve; ミルク入り, with milk",
           "fr": "(suffixe) contenant, avec … dedans : 十二個入り, un paquet de douze ; ミルク入り, au lait",
           "es": "(sufijo) que contiene, con … dentro: 十二個入り, un paquete de doce; ミルク入り, con leche"},
    "屋": {"en": "(suffix) the shop or trade of …, or one given to it: 自転車屋, a bicycle shop; 照れ屋, a shy person",
          "fr": "(suffixe) la boutique ou le métier de …, ou qui y est enclin : 自転車屋, un marchand de vélos ; 照れ屋, un timide",
          "es": "(sufijo) la tienda o el oficio de …, o quien es dado a ello: 自転車屋, una tienda de bicicletas; 照れ屋, una persona tímida"},
    "たち": {"en": "(suffix) plural, … and the others: 作業員たち, the workers",
           "fr": "(suffixe) pluriel, … et les autres : 作業員たち, les ouvriers",
           "es": "(sufijo) plural, … y los demás: 作業員たち, los trabajadores"},
    "ごと_whole": {"en": "(suffix) … and all, whole: 皮ごと, skin and all", "fr": "(suffixe) avec, en entier : 皮ごと, avec la peau",
                 "es": "(sufijo) … y todo, entero: 皮ごと, con piel y todo"},
    "合": {"en": "(after a number) gō, a measure of rice, about 180 ml: 米2合", "fr": "(après un nombre) gō, mesure de riz, environ 180 ml : 米2合",
          "es": "(tras un número) gō, medida de arroz, unos 180 ml: 米2合"},
    "牛": {"en": "(suffix) beef, cattle: 国産牛, domestic beef", "fr": "(suffixe) bœuf : 国産牛, bœuf japonais",
          "es": "(sufijo) carne de vacuno, ganado: 国産牛, vacuno nacional"},
    "殿": {"en": "(after a name or a title, old or formal) Lord, Sir: 家老殿", "fr": "(après un nom ou un titre, ancien ou formel) seigneur, monsieur : 家老殿",
          "es": "(tras un nombre o un título, antiguo o formal) señor, don: 家老殿"},
    "超": {"en": "(after a number) over, more than: 500円超, over 500 yen",
          "fr": "(après un nombre) plus de : 500円超, plus de 500 yens",
          "es": "(tras un número) más de: 500円超, más de 500 yenes"},
    "先": {"en": "(suffix) where or to whom one …: 連絡先, contact details; 勤務先, workplace; 行き先, destination",
          "fr": "(suffixe) le lieu ou la personne où l'on … : 連絡先, coordonnées ; 勤務先, lieu de travail ; 行き先, destination",
          "es": "(sufijo) dónde o a quién uno …: 連絡先, datos de contacto; 勤務先, lugar de trabajo; 行き先, destino"},
}
_RANGED = frozenset({"円", "ドル", "ユーロ", "度", "歳", "才", "点", "パーセント", "％", "%", "分", "秒", "時間", "キロ",
                     "メートル"})


def _affix_sense(morphemes: list, i: int, numbers: dict) -> dict | None:
    """The sense of a suffix or a counter its card does not say, or None
    (plan 272): 混雑時's 時 "at the time of" (no "o'clock" after a noun),
    160円台's 台 "the range" (2台 counts machines), みじん切り's 切り "cut
    into", 10連's 連 "in a row", 何膳's 膳 "pairs of chopsticks", 十二個入り's
    入り "holding", 自転車屋's 屋, 作業員たち's たち, 胆のうごと's ごと "and
    all"; and the suffixes _SUFFIX_GLOSSES names."""
    m = morphemes[i]
    if i == 0:
        return None
    prev = morphemes[i - 1]
    counted = _after_a_number(morphemes, i, numbers) or prev.surface == "何"
    if m.surface == "合" and _glued_to(prev, m) and counted and any(u.surface in ("米", "ご飯", "お米", "炊") for u in morphemes):
        return _AFFIX_SENSES["合"]
    if m.surface in ("牛", "殿") and m.pos == "suffix" and prev.pos in ("noun", "suffix") and _glued_to(prev, m):
        return _AFFIX_SENSES[m.surface]
    if m.surface == "超" and _glued_to(prev, m) and (counted or prev.counter or prev.surface in _RANGED
                                                  or prev.surface in ("円", "人", "件", "台", "年", "倍", "万", "億")):
        return _AFFIX_SENSES["超"]
    if m.surface == "先" and m.reading == "さき" and prev.pos == "noun" and _glued_to(prev, m) and not counted \
            and numeral_value(prev.surface) is None and not prev.proper and not prev.counter \
            and not _after_a_number(morphemes, i - 1, numbers) \
            and prev.surface not in ("この", "その", "目", "指", "鼻", "口", "旅", "庭", "春", "一歩"):
        # (連絡先, 勤務先, 取引先: the place or person a deed goes to,
        # never the tip or the way ahead, plan 272)
        return _AFFIX_SENSES["先"]
    if m.surface in _SUFFIX_GLOSSES and m.pos == "suffix" and prev.pos in ("noun", "other") \
            and (m.surface != "生" or m.reading == "せい"):
        return _SUFFIX_GLOSSES[m.surface]
    if m.surface == "時" and m.reading == "じ" and prev.pos in ("noun", "other") and not counted \
            and numeral_value(prev.surface) is None and _glued_to(prev, m):
        return _AFFIX_SENSES["時"]
    if m.surface == "台" and prev.surface in _RANGED and _glued_to(prev, m):
        return _AFFIX_SENSES["台"]
    if m.surface == "切り" and m.pos == "suffix" and prev.pos == "noun":
        return _AFFIX_SENSES["切り"]
    if m.surface in ("連", "膳") and counted:
        return _AFFIX_SENSES[m.surface]
    if m.pos == "suffix" and m.surface == "入り" and prev.pos in ("noun", "suffix") and _glued_to(prev, m):
        return _AFFIX_SENSES["入り"]
    if m.pos == "suffix" and m.surface in ("屋", "たち", "達") and prev.pos in ("noun", "pronoun", "other", "suffix") \
            and _glued_to(prev, m) and resolve_pool_morpheme(morphemes, i) is None:
        # (Where the pool's row for the suffix does not answer: after a
        # suffix of its own, 作業員たち, or a compound folded, 自転車屋.)
        return _AFFIX_SENSES["屋" if m.surface == "屋" else "たち"]
    if m.pos == "suffix" and m.surface == "ごと" and prev.pos in ("noun", "suffix") and _glued_to(prev, m) \
            and not counted:
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if nxt is not None and (nxt.pos == "verb" or nxt.surface in ("を", "は", "も")):
            return _AFFIX_SENSES["ごと_whole"]           # 胆のうごと取る: and all (地域ごとの is 毎's card)
    return None


def _glued_to(a, b) -> bool:
    return a.end == b.start


def _after_a_number(morphemes: list, i: int, numbers: dict) -> bool:
    """Whether morphemes[i] follows a number, in digits or in kanji."""
    if i == 0:
        return False
    before = morphemes[i - 1]
    return any(end == i for end, _, _ in numbers.values()) or (
        before.pos == "noun" and before.surface != "何" and numeral_value(before.surface) is not None)


def _age_run(morphemes: list, i: int, numbers: dict) -> int:
    """How many morphemes from `i` write an age bracket -- a round
    number and 代, ２０代 "in one's twenties" -- or 0. 代 alone is the
    card "charge, cost" (plan 272)."""
    if i in numbers:
        end, printed, _ = numbers[i]
        value = _number_of(printed)
    else:
        end = i
        while end < len(morphemes) and morphemes[end].pos == "noun" \
                and all(c in _NUMERAL_CHARS for c in morphemes[end].surface):
            end += 1
        value = numeral_value("".join(m.surface for m in morphemes[i:end])) if end > i else None
    if value is None or not 10 <= value <= 90 or value % 10 or end >= len(morphemes):
        return 0
    if morphemes[end].surface != "代" or (end + 1 < len(morphemes) and morphemes[end + 1].surface == "目"):
        return 0
    return end + 1 - i


def _age_dict(run: list, numbers: dict, start: int) -> dict:
    head = run[:-1]
    value = _number_of(numbers[start][1]) if start in numbers else numeral_value("".join(m.surface for m in head))
    said = numbers[start][2] if start in numbers else "".join(m.reading for m in head)
    surface = "".join(m.surface for m in run)
    reading = said + "だい"
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": surface, "reading": reading, "pos": "noun",
        "furigana": _printed_furigana(run, len(head), numbers.get(start), reading),
        "vocab_match": None,
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
        "number": value,
        "gloss": {"en": f"in one's {value}s ({value}-{value + 9})" if value > 10 else "teens (10-19)",
                  "fr": f"de {value} à {value + 9} ans", "es": f"de {value} a {value + 9} años"},
    }


# 3つ目, 何年目, 2回目: a number, what it counts and 目, the ordinal
# suffix, which read alone is the N5 目, "eye" (plan 272).
_WHICH = {"en": "which (in order)", "fr": "combientième",
          "es": "qué número (en orden)"}
# What an ordinal counts, where the counter's card leads with another
# sense (度 "degree (temperature)", 代 "charge, cost"); any other counter
# is glossed with its card.
_ORDINAL_SENSE = {
    "度": ("time", "fois", "vez"), "回": ("time", "fois", "vez"), "代": ("generation", "génération", "generación"),
    "番": ("", "", ""), "年": ("year", "année", "año"), "日": ("day", "jour", "día"),
    "人": ("person", "personne", "persona"), "曲": ("song", "morceau", "canción"),
    "杯": ("cup, glass", "verre, tasse", "taza, vaso"),
    "週": ("week", "semaine", "semana"), "階": ("floor", "étage", "piso, planta"), "期": ("term", "période", "período"),
    "試合": ("match", "match", "partido"), "巻": ("volume", "tome", "tomo"), "話": ("episode", "épisode", "episodio"),
    "時間": ("period (of school)", "heure de cours", "hora de clase"),
}


def _counted_sense(counter: str, reading: str) -> tuple[str, str, str]:
    """(English, French, Spanish) for what an ordinal counts
    (_ORDINAL_SENSE), else its card's meaning, or ("", "", "")."""
    if counter in _ORDINAL_SENSE:
        return _ORDINAL_SENSE[counter]
    hit = resolve_lemma(counter, reading) if counter != "つ" else None
    if not hit:
        return "", "", ""
    english = hit[1].get("meaning") or ""
    return english, fr_gloss(hit[1], VOCAB_FR) or english, fr_gloss(hit[1], VOCAB_ES) or english


def _ordinal_run(morphemes: list, i: int, numbers: dict) -> int:
    """How many morphemes from `i` write an ordinal -- a number or 何, a
    counter, then 目 -- or 0."""
    if i in numbers:
        k = numbers[i][0]
    elif morphemes[i].surface == "何" or (morphemes[i].pos == "noun" and numeral_value(morphemes[i].surface)):
        k = i + 1
        while k < len(morphemes) and morphemes[k].pos == "noun" and numeral_value(morphemes[k].surface) \
                and morphemes[i].surface != "何":
            k += 1
    else:
        return 0
    if k + 1 >= len(morphemes):
        return 0
    counter, tail = morphemes[k], morphemes[k + 1]
    if counter.pos not in ("noun", "suffix") or not (counter.counter or counter.surface in _COUNTING
                                                      or counter.surface in ("つ", "代")):
        return 0
    if tail.surface != "目" or tail.pos not in ("suffix", "noun"):
        return 0
    if counter.surface == "品":
        return 0                            # 200品目: items, ひんもく, no 200th (plan 272)
    return k + 2 - i


def _ordinal_dict(run: list, numbers: dict, start: int) -> dict:
    """The token for an ordinal (_ordinal_run): 3つ目 "3rd", 何年目
    "which (in order) · year", read whole, みっつめ and なんねんめ."""
    counter = run[-2]
    head = run[:-2]
    if start in numbers:
        reading = numbers[start][2] + counter.reading
        value = _number_of(numbers[start][1].replace(",", "").replace("，", ""))
    else:
        reading = "".join(m.reading for m in head) + counter.reading
        value = None if head[0].surface == "何" else numeral_value("".join(m.surface for m in head))
    surface = "".join(m.surface for m in run)
    token = {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": surface, "reading": reading + "め", "pos": "noun",
        "furigana": None, "vocab_match": None,
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
    }
    english, french, spanish = _counted_sense(counter.surface, counter.lemma_reading)
    if value is None:
        en, fr, es = _WHICH["en"], _WHICH["fr"], _WHICH["es"]
    else:
        token["number"] = value
        en, fr, es = _ordinal(value, "en"), _ordinal(value, "fr"), _ordinal(value, "es")
    token["gloss"] = {"en": f"{en} · {english}" if english else en, "fr": f"{fr} · {french or english}" if english else fr,
                      "es": f"{es} · {spanish or english}" if english else es}
    token["furigana"] = _printed_furigana(run, len(head), numbers.get(start), token["reading"])
    return token


# The suffixes a person's name takes: a token UniDic calls a name before
# one of them is that name, whatever card its letters spell (ゆきさん is
# Yuki, no 雪 "snow"; まりさん no 鞠 "ball").
_HONORIFICS = frozenset({"さん", "ちゃん", "くん", "君", "様", "さま", "氏", "先生"})


def _named(morphemes: list, i: int) -> bool:
    m = morphemes[i]
    # (...or the animal it is the name of says so: いぬの ぽち, plan 272)
    # (...or the family name before it: 上原あかり; or a name UniDic reads
    # alone opening what is said of it: あおいが今日来れないって, plan 272)
    return m.name_kind in ("family", "given", "person") and (
        (i + 1 < len(morphemes) and morphemes[i + 1].surface in _HONORIFICS) or morphology.named_animal(morphemes, i)
        or (m.name_kind == "given" and i > 0 and morphemes[i - 1].proper and morphemes[i - 1].name_kind == "family"
            and morphemes[i - 1].end == m.start)
        or morphology.named_alone(morphemes, i))


def _merged_morpheme(run: list) -> morphology.Morpheme:
    """One morpheme for a run of particles read as one (ってば)."""
    return replace(run[0], surface="".join(m.surface for m in run), end=run[-1].end,
                   lemma="".join(m.surface for m in run), reading="".join(m.reading for m in run),
                   lemma_reading="".join(m.reading for m in run), kana="".join(m.kana for m in run))


def _joined_dict(run: list, pos: str) -> dict:
    """One token for a run of function words read as one word, with no
    card: ってば."""
    token = _token_dict(_merged_morpheme(run), None)
    token["pos"] = pos
    return token


def _compound_dict(run: list, level: str, entry: dict, raw_id: str) -> dict:
    """One token for a run of morphemes the deck teaches as one word
    (card_lookup.resolve_compound, plan 102). Its surface and offsets
    are the run's, so the sentence still rebuilds from the tokens and a
    grammar point written on any part of it still lands on it; its
    reading is the entry's, since the morphemes' joined would misread
    it (にちよう + ひ for にちようび); its lemma is the entry's written
    form, which is what the run spells. A noun, as everything
    resolve_compound admits is."""
    surface = "".join(m.surface for m in run)
    reading = compound_reading(entry, run)
    if _hiragana(surface) and not any(m.pos == "particle" for m in run):
        # (Written in kana, the page says how it is said: すいません is
        # read すいません, whatever its card's すみません, plan 272.)
        reading = surface
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": entry.get("kanji") or surface, "reading": reading, "pos": "noun",
        "furigana": align_deck(surface, reading),
        "vocab_match": _deck_match(level, entry, raw_id),
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
    }


def _as_its_idiom(token: dict, row: dict) -> None:
    """A saying's line from its idiom's senses (plan 272): 火の車 is "a
    desperate financial situation" before JMdict's first sense, the
    Buddhist "fiery chariot"."""
    from study.card_lookup import _ASIDE
    senses = jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
    idioms = [sense for sense in senses if {"id", "proverb"} & set(sense.get("tags") or ())]
    if not idioms or senses[0] in idioms:
        return
    glosses = [_ASIDE.sub("", g).strip() for g in idioms[0].get("glossary") or ()][:2]
    entry = token["vocab_match"]["entry"]
    entry["meaning"] = ", ".join(glosses)
    for lang in jmdict_fr.LANGS:
        said = jmdict_fr.sense("; ".join(idioms[0].get("glossary") or ()), lang)
        if said:
            entry[f"meaning_{lang}"] = said
        else:
            entry.pop(f"meaning_{lang}", None)


def _pool_compound_dict(run: list, entry: dict) -> dict:
    """_compound_dict for a run the JMdict pool holds as one word
    (card_lookup.resolve_pool_compound, plan 148): 桃源 + 郷 as 桃源郷."""
    surface = "".join(m.surface for m in run)
    reading = entry.get("kana") or "".join(m.reading for m in run)
    if any(c.isascii() and c.isalpha() for c in surface):
        reading = _latin_reading(entry)    # Uターン ゆーたーん (plan 272)
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": entry.get("kanji") or surface, "reading": reading, "pos": "noun",
        "furigana": align_deck(surface, reading),
        "vocab_match": _pool_match(entry),
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
    }


def _only_negative(morphemes: list, k: int, grammar: list[dict] | None) -> bool:
    """Whether the one point written on morphemes[k] is the plain negative
    (ない形): たまらない, a word of the deck's, is that and nothing else."""
    on = {g.get("pattern") for g in grammar or []
          if g.get("start", 0) <= morphemes[k].start and morphemes[k].end <= g.get("end", 0)}
    return on == {"ない形 〜ない"}


def _written_reading(run: list) -> str:
    """A run's reading as the page writes it: a particle by its letter
    (気をつけ, きをつけ), never its sound (きおつけ, plan 272)."""
    return "".join(m.surface if m.pos == "particle" else m.reading for m in run)


def _in_grammar(morphemes: list, grammar: list[dict]) -> set[int]:
    """The indices of the morphemes a grammar point is written on (its
    `segments`, as _attach_grammar reads them)."""
    return {
        j for j, m in enumerate(morphemes)
        if any(s < m.end and m.start < e for g in grammar for s, e in g["segments"])
    }


_COUNTERS = "助数詞 〜つ／〜人／〜枚"

# The points that are a word's own forms, not a construction around it.
_OWN_FORM_POINTS = frozenset({"い形容詞／な形容詞", "〜く／〜に（副詞形）", "ない形 〜ない", "た形 〜た", "可能形 〜(ら)れる",
                              "意向形 〜(よ)う", "命令形 〜ろ／〜え", "〜ます／〜ません", "〜ました／〜ませんでした",
                              # (a compound verb the pool holds whole is its word
                              # too: もつれ込む, 振り込む, 駆け出す, plan 272)
                              "〜こむ", "〜出す", "〜かける", "〜きる", "〜直す", "〜かねる",
                              "〜はじめる／〜おわる／〜つづける"})

_MONTHS_EN = ("January", "February", "March", "April", "May", "June", "July", "August", "September",
              "October", "November", "December")
_MONTHS_FR = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
              "octobre", "novembre", "décembre")
_MONTHS_ES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
              "octubre", "noviembre", "diciembre")
_SLASHES = ("/", "／")


def _date_run(morphemes: list, i: int) -> tuple[int, int] | None:
    """(month, day) where morphemes[i:i + 3] print a date as month/day,
    10/24, or None: never a fraction or a longer date (2024/10/24), and
    never a month or a day that is none."""
    from study.furigana import _is_number_token

    if i + 2 >= len(morphemes) or morphemes[i + 1].surface not in _SLASHES:
        return None
    a, b = morphemes[i], morphemes[i + 2]
    if not (_is_number_token(a.surface) and _is_number_token(b.surface)):
        return None
    if (i > 0 and morphemes[i - 1].surface in _SLASHES) or (i + 3 < len(morphemes) and morphemes[i + 3].surface in _SLASHES):
        return None
    month, day = (int(x.surface.translate(_FULLWIDTH_DIGITS)) for x in (a, b))
    if not (1 <= month <= 12 and 1 <= day <= _DAYS_IN[month - 1]):
        return None
    if month < day <= 10 and not _dated(morphemes, i + 3):
        # 1/3, 2/3, 3/10 are fractions as often as days: 全体の1/3が水です.
        # A date there says so, with its weekday (1/3（金）) or a range.
        return None
    return month, day


# The days of each month, the 29th of February counted.
_DAYS_IN = (31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
_WEEKDAYS = frozenset("月火水木金土日祝")


def _dated(morphemes: list, k: int) -> bool:
    """Whether what follows a month/day at morphemes[k] says it is one:
    its weekday in brackets, （金）, or the start of a range, 〜1/5."""
    from study.furigana import _is_number_token

    if k + 1 < len(morphemes) and morphemes[k].surface in ("（", "(") and morphemes[k + 1].surface[:1] in _WEEKDAYS:
        return True
    return (k + 1 < len(morphemes) and morphemes[k].surface in ("〜", "～", "-", "－", "−")
            and _is_number_token(morphemes[k + 1].surface))


def _date_dict(run: list, month: int, day: int) -> dict:
    """One token for a date printed 10/24, read as it is said --
    じゅうがつにじゅうよっか -- and glossed with the date (plan 272)."""
    from study.reading_context import numeral_furigana

    month_reading = (numeral_furigana(str(month), "月", "がつ", "noun")[0] or "") + "がつ"
    if day == 1:
        day_reading = "ついたち"
    else:
        number, counter = numeral_furigana(str(day), "日", "にち", "suffix")
        day_reading = (number or "") + (counter or "にち")
    token = _token_dict(_merged_morpheme(run), None)
    token["pos"] = "noun"
    token["reading"] = month_reading + day_reading
    token["furigana"] = [{"text": token["surface"], "reading": token["reading"]}]
    token["gloss"] = {"en": f"{_MONTHS_EN[month - 1]} {day} (month/day)",
                      "fr": f"{day} {_MONTHS_FR[month - 1]} (mois/jour)",
                      "es": f"{day} de {_MONTHS_ES[month - 1]} (mes/día)"}
    return token

# The catalogue's conjunctions, each a point written as the word itself.
_CONJUNCTION_POINTS = frozenset({"そして", "それから", "しかし", "だから", "それで", "それに", "ところで",
                                 "または", "ところが", "つまり"})


def _conjunction_runs(morphemes: list, grammar: list[dict]) -> dict[int, int]:
    """{start: n} for each conjunction point the tokenizer cut into `n`
    morphemes (plan 272): それ + に is それに, "moreover", one word with
    its card beside its point, never それ, "that one", and a particle;
    ところ + が is no "place"."""
    runs = {}
    for g in grammar:
        if g.get("pattern") not in _CONJUNCTION_POINTS or len(g["segments"]) != 1:
            continue
        s, e = g["segments"][0]
        inside = [j for j, m in enumerate(morphemes) if s <= m.start and m.end <= e]
        if len(inside) >= 2 and morphemes[inside[0]].start == s and morphemes[inside[-1]].end == e \
                and "".join(morphemes[j].surface for j in inside) == g["pattern"]:
            runs[inside[0]] = len(inside)
    return runs


# The な-adjectives of manner that take と as an adverb does (plan 272):
# 意外と優しい, 平然と嘘をつく.
TO_MANNER = frozenset({"意外", "案外", "平然", "漠然", "毅然", "呆然", "唖然", "悠然", "颯爽", "歴然", "断然",
                          "公然", "決然", "整然", "雑然", "騒然", "愕然", "泰然", "超然", "敢然", "漫然", "黙然",
                          "茫然", "憤然", "釈然", "厳然", "粛然", "猛然", "忽然"})


def _adverbs_to(morphemes: list, i: int) -> bool:
    """Whether morphemes[i] is an adverb said with its と (plan 272):
    しっかりと, はっきりと, 次々と, 黙々と -- the と is the adverb's own and
    says nothing apart from it. Not そう, こう, ああ, どう, whose と quotes
    (そうとは限らない)."""
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    after = morphemes[i + 2] if i + 2 < len(morphemes) else None
    return (nxt is not None and nxt.surface == "と" and nxt.pos == "particle"
            and (m.pos == "adverb" or (m.pos == "other" and (m.surface.endswith("々") or m.surface in TO_MANNER)))
            and m.surface not in ("そう", "こう", "ああ", "どう")
            # (A と before a verb of saying or thinking quotes: 当然と感じる,
            # いよいよという時, 社よりという名前; one before なる names what
            # it becomes.)
            and not (after is not None and after.pos == "verb" and after.lemma not in ("為る", "する")
                     and (after.lemma in grammar_detect._SAYING_VERBS
                          or after.lemma in ("感ずる", "成る", "なる", "見なす", "見做す"))))


def _adverb_to_length(morphemes: list, i: int) -> int:
    """How many morphemes from i an adverb said with its と spans: 2, or
    4 with the する a kanji adverb is said with (堂々とした, 依然として,
    plan 272) -- never the ている it may go on to."""
    m = morphemes[i]
    if (i + 3 < len(morphemes) and all(_is_kanji_char(c) for c in m.surface.replace("々", ""))
            and morphemes[i + 2].lemma in ("為る", "する") and morphemes[i + 2].cform.startswith("連用形")
            and morphemes[i + 3].surface in ("た", "て")
            and not (i + 4 < len(morphemes) and morphemes[i + 4].lemma in ("居る", "いる", "おる", "居る"))):
        return 4
    return 2


def _is_kanji_char(c: str) -> bool:
    return "\u4e00" <= c <= "\u9fff"


def _name_or_word(token: dict, m, row: dict, called: bool = False) -> None:
    """A word in katakana UniDic tags as a person's name and JMdict holds
    as a common word is either one (plan 272): ジャック、よく来てくれたね is
    Jack, ヒューズが飛んだ a fuse, and nothing on the page says which. Its
    line names both -- never a guess -- unless JMdict's row is the person
    itself (Mozart, Napoleon). So is a word in katakana JMdict holds as a
    colloquial short form, where it is called to (`called`): 安心しろ、
    ケンタ。 is Kenta, the row Kentucky Fried Chicken."""
    import re

    import content.vocab_jmdict_data as jmdict_db

    senses = jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
    katakana = bool(m.surface) and all("\u30a0" <= c <= "\u30ff" for c in m.surface)
    short = called and katakana and any(t in ("col", "abbr") for sense in senses for t in sense.get("tags") or ())
    place = m.proper and m.name_kind == "place" and not m.unknown and bool(m.surface)
    if not place and not short and not (m.proper and m.name_kind in ("person", "given", "family") and not m.unknown
                                        and katakana):
        return
    if not short and any(re.sub(r"^\([^)]*\)\s*", "", g)[:1].isupper()
                         for sense in senses for g in sense.get("glossary") or ()):
        return
    entry = token["vocab_match"]["entry"]
    # (A place UniDic names that JMdict holds as a word, as either one:
    # 築地で食べ歩き is Tsukiji, its row "reclaimed land", plan 272.)
    entry["meaning"] = ("a place name, or: " if place else "a person's name, or: ") + entry.get("meaning", "")
    if entry.get("meaning_fr"):
        entry["meaning_fr"] = ("un nom de lieu, ou : " if place else "un nom de personne, ou : ") + entry["meaning_fr"]
    if entry.get("meaning_es"):
        entry["meaning_es"] = ("un nombre de lugar, o: " if place else "un nombre de persona, o: ") + entry["meaning_es"]


def _called_to(morphemes: list, i: int) -> bool:
    """Whether morphemes[i] stands alone as whoever is spoken to: after
    a comma and closing the sentence (安心しろ、ケンタ。), or opening it
    before a comma (ケンタ、早く！) -- plan 272."""
    before = morphemes[i - 1].surface if i > 0 else "「"
    after = morphemes[i + 1].surface if i + 1 < len(morphemes) else "。"
    return (before in ("、", "，") and after in ("。", "！", "？", "!", "?", "」")) or (
        before in ("「", "『", "。", "！", "？") and after in ("、", "，"))


def _numeral_kanji(surface: str) -> bool:
    return bool(surface) and all(c in "一二三四五六七八九十百千万" for c in surface)


def _point_on_second_half(m, parts, grammar: list[dict]) -> bool:
    """Whether no point is written on a compound verb's first verb (plan
    272): 消えかけた is 消える and 〜かける, the point's own half; 走り出す's
    出す is 〜出す's, and 走る keeps its card."""
    cut = m.start + len(parts[0][0])
    return not any(s < cut and m.start < e for g in grammar for s, e in g["segments"])


def _compounds_apart(morphemes: list, grammar: list[dict] | None = None) -> list:
    """The morphemes with a compound no dictionary holds cut into the two
    deck words it is (card_lookup.split_unknown_compound, plan 272): 右ひざ
    as 右 and ひざ, each with its card, where it said nothing; a compound
    verb too (回し入れる, split_unknown_verb), never where a point is
    written on it (走り出す's 〜出す)."""
    out = []
    hits = None
    for j, m in enumerate(morphemes):
        parts = None
        if m.pos in ("noun", "verb") and len(m.surface) >= 2 and resolve_morpheme(morphemes, j) is None \
                and resolve_pool_morpheme(morphemes, j) is None:
            parts = split_unknown_compound(m) if m.pos == "noun" else split_unknown_verb(m)
            if parts and m.pos == "verb" and not _point_on_second_half(m, parts, grammar or []):
                parts = None
        if parts:
            # (Not where it opens a word the pool holds whole: 小中学 + 生
            # is 小中学生, "pupils", plan 272.)
            hits = hits or [resolve_morpheme(morphemes, k) for k in range(len(morphemes))]
            if resolve_pool_compound(morphemes, j, hits):
                parts = None
        if not parts:
            out.append(m)
            continue
        start = m.start
        for surface, reading, (_level, entry, _raw) in parts:
            out.append(replace(m, surface=surface, start=start, end=start + len(surface),
                               lemma=entry.get("kanji") or surface, reading=reading, lemma_reading=reading,
                               kana="".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in reading)))
            start += len(surface)
    return out


def _tokens(morphemes: list, grammar: list[dict] | None = None) -> list[dict]:
    """The morphemes as tokens, a deck compound folded into one.

    UniDic's short unit cuts 日曜日 into 日曜 + 日, and per-morpheme
    lookup then matched each half to a card of its own -- Sunday at N3
    and day at N4 under a sentence written to teach the N5 word. The
    reading-badge scanner (card_lookup._find_segments_morphological)
    has merged such runs since it was written; the breakdown never
    did. Longest run first, so お母さん is one word and not お + 母さん.

    The deck answers first, the JMdict pool after (plan 148): a run the
    pool holds as one word where the deck has no card for one of its
    nouns (桃源 + 郷), then each word the deck has no card for, looked
    up alone. So every word the app holds a card for -- in the course or
    past it -- carries its meaning and can be put in a deck.

    Never a word a grammar point is written on (`grammar`, the
    sentence's detected points): the しれ of かもしれない is 知れる in the
    pool, ござい is 御座い, 際し is 際する, and a row with no deck word
    in it opens its point (frontend rows) -- a pool gloss there would
    trade the lesson for a dictionary line about one of its letters.
    """
    # (Cut first: a number's indices are read off the list it is in, and
    # a cut after them moved 35万's reading onto 約, plan 272.)
    morphemes = _compounds_apart(morphemes, grammar)
    morphemes, numbers = _printed_numbers(morphemes)
    deck_hits = [resolve_morpheme(morphemes, j) for j in range(len(morphemes))]
    ruled = _in_grammar(morphemes, grammar or [])
    # Every point but the adverbial form, which a deck word may carry
    # whole (非常に, plan 272).
    strict = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") != "〜く／〜に（副詞形）"])
    # A counter the counters' point lights is that point's to explain:
    # 三本's 本 is no "book" (plan 151). A card that is itself the
    # counter (冊, 匹) stays, and so does a word (二人, "two people").
    counted = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") == _COUNTERS])
    deck_hits = [None if (j in counted and hit and morphemes[j].pos == "suffix"
                          and "counter" not in (hit[1].get("meaning") or "")) else hit
                 for j, hit in enumerate(deck_hits)]
    # The verb of a compound particle is the point's, not a word of its
    # own: について's つい is no 着く "to arrive", において's おい no 置く
    # "to put", にたいして no 大して "not very" (plan 152). Its row opens
    # the point.
    compounds = compound_particles()
    bound = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") in compounds])
    deck_hits = [None if j in bound and morphemes[j].pos in ("verb", "adverb") else hit
                 for j, hit in enumerate(deck_hits)]
    # So is the negated verb of a "must" or a "must not": 〜てはいけません's
    # いけ is no 行く "to go", 〜なければならない's なら no 成る "to become"
    # (plan 160). Its row is the point's.
    held = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") in no_good_points()])
    deck_hits = [None if j in held and morphemes[j].pos == "verb" and morphemes[j].lemma in NO_GOOD_VERBS else hit
                 for j, hit in enumerate(deck_hits)]
    # A name before an honorific is the name, never the card its letters
    # spell (plan 266): ゆきさん is no "snow".
    deck_hits = [None if _named(morphemes, j) else hit for j, hit in enumerate(deck_hits)]
    # The もん that closes a sentence on its reason is no "thing", the 草
    # of 草www no "grass" (plan 272).
    deck_hits = [None if particle_glosses.gives_a_reason(morphemes, j) or particle_glosses.net_laughter(morphemes, j)
                 or particle_glosses.no_card_here(morphemes, j)
                 else hit for j, hit in enumerate(deck_hits)]
    # Nor is the verb a lit point is made of a word: 洗いなさい's なさい is
    # 〜なさい, 団長である's ある the copula (plan 272). Nor 〜あまり's
    # あまり, no "not very", nor the いる of 見失ってはいない.
    deck_hits = [None if j in ruled and a_points_own_verb(morphemes, j) else hit for j, hit in enumerate(deck_hits)]
    own_words = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") in ("〜あまり", "〜ています")])
    deck_hits = [None if j in own_words and (morphemes[j].surface in ("あまり", "余り") or (
        morphemes[j].lemma in ("居る", "いる", "おる") and j >= 2 and morphemes[j - 1].surface in ("は", "も")
        and morphemes[j - 2].conjunctive)) else hit for j, hit in enumerate(deck_hits)]
    # Two deck words read as the word they make: 腕 + 時計 is うでどけい,
    # 時計 read どけい there (plan 272).
    for j, reading in compound_tail_readings(morphemes, deck_hits).items():
        morphemes[j] = replace(morphemes[j], reading=reading)
    # A pool run may not take in a morpheme a point is written on; a
    # deck hit stands in for "has a card" there, which is all
    # resolve_pool_compound asks of it.
    pool_hits = [hit or (j in ruled) for j, hit in enumerate(deck_hits)]
    # What explains each morpheme before any fold: its card or a point.
    explained = [bool(hit) or j in ruled for j, hit in enumerate(deck_hits)]
    conjunctions = _conjunction_runs(morphemes, grammar or [])
    # A word whose only points are its own forms -- エモくない, the
    # adjective's -- is still the pool's word (plan 272); one inside a
    # construction (かもしれない's しれ) is the construction's.
    own_forms = {j for j in ruled if morphemes[j].pos in ("adjective", "verb")} - _in_grammar(
        morphemes, [g for g in grammar or [] if g.get("pattern") not in _OWN_FORM_POINTS])
    tokens = []
    i = 0
    while i < len(morphemes):
        if i in conjunctions:
            n = conjunctions[i]
            run = morphemes[i:i + n]
            card = kana_card("".join(m.surface for m in run))
            token = _compound_dict(run, *card) if card else _joined_dict(run, "conjunction")
            token["pos"] = "conjunction"
            tokens.append(token)
            i += n
            continue
        saying = resolve_saying(morphemes, i, pool_hits) if i not in ruled and morphemes[i].pos == "noun" \
            and _numeral_kanji(morphemes[i].surface) else None
        if saying:
            # (A saying with a number in it is the saying, never a date or
            # a count: 三日坊主, "a quitter"; 一石二鳥, plan 272.)
            entry, n = saying
            tokens.append(_pool_compound_dict(morphemes[i:i + n], entry))
            i += n
            continue
        date = _date_run(morphemes, i)
        if date:
            tokens.append(_date_dict(morphemes[i:i + 3], *date))
            i += 3
            continue
        ordinal = _ordinal_run(morphemes, i, numbers)
        if ordinal:
            tokens.append(_ordinal_dict(morphemes[i:i + ordinal], numbers, i))
            i += ordinal
            continue
        aged = _age_run(morphemes, i, numbers)
        if aged:
            tokens.append(_age_dict(morphemes[i:i + aged], numbers, i))
            i += aged
            continue
        phrase = resolve_phrase(morphemes, i)
        if phrase:
            level, entry, raw_id, n = phrase
            token = _compound_dict(morphemes[i:i + n], level, entry, raw_id)
            token["pos"] = "interjection"
            tokens.append(token)
            i += n
            continue
        # The breakdown's own folds (plan 266, card_lookup's "words that
        # hold a sentence together"): a set phrase the pool holds as one
        # expression (どういたしまして), a conjunction cut into particles
        # where it opens a sentence (でも、), a deck idiom (気をつける)
        # and a deck word cut into a verb and an ending (知らせる).
        said = resolve_pool_phrase(morphemes, i, deck_hits, explained)
        if said:
            entry, n = said
            token = _pool_compound_dict(morphemes[i:i + n], entry)
            token["pos"] = "interjection"
            tokens.append(token)
            i += n
            continue
        opening = resolve_opening(morphemes, i)
        if opening:
            level, entry, raw_id, n = opening
            token = _compound_dict(morphemes[i:i + n], level, entry, raw_id)
            token["pos"] = "conjunction"
            tokens.append(token)
            i += n
            continue
        pooled = resolve_pool_opening(morphemes, i)
        if pooled:
            # なのに、 and だったら、 opening a sentence (plan 272).
            row, n = pooled
            token = _pool_compound_dict(morphemes[i:i + n], row)
            token["pos"] = "conjunction"
            tokens.append(token)
            i += n
            continue
        errand = resolve_humble_errand(morphemes, i) if i not in ruled else None
        if errand:
            # お返しに参りました: the verb's stem said politely, 返す, no
            # "return gift" (plan 272).
            token = _compound_dict(morphemes[i:i + 2], *errand)
            token["pos"] = "noun"
            token["reading"] = morphology.kata_to_hira("".join(m.reading for m in morphemes[i:i + 2]))
            token["furigana"] = align_deck(token["surface"], token["reading"])
            tokens.append(token)
            i += 2
            continue
        hit = resolve_compound(morphemes, i)
        if hit:
            level, entry, raw_id, n = hit
            token = _compound_dict(morphemes[i:i + n], level, entry, raw_id)
            if i in numbers and numbers[i][0] == i + 1:
                # ３つ, 2人: the deck's word, its reading over its digits.
                token["furigana"] = _printed_furigana(morphemes[i:i + n], 1, numbers[i], token["reading"])
            tokens.append(token)
            i += n
            continue
        # (Never a word cut from an ending a point is written on: そう
        # 思わずにはいられない is 思う and 〜ずにはいられない, no 思わず.)
        hit = resolve_idiom(morphemes, i) or (None if i + 1 in ruled and not _only_negative(morphemes, i + 1, grammar)
                                              else resolve_split_word(morphemes, i))
        if hit:
            level, entry, raw_id, n = hit
            run = morphemes[i:i + n]
            token = _compound_dict(run, level, entry, raw_id)
            # Read as the page writes it, 気をつけ and 知らせ: the entry's
            # dictionary reading is another form's. A verb's endings
            # follow it as a verb's do (frontend rows.js).
            token["reading"] = _written_reading(run)
            token["furigana"] = align_deck(token["surface"], token["reading"])
            token["pos"] = "adverb" if run[-1].lemma == "ず" else "verb"
            tokens.append(token)
            i += n
            continue
        joined = morphology._compound_verb_at(morphemes[i], morphemes[i + 1] if i + 1 < len(morphemes) else None)
        if joined is not None and _of_another_field(joined, morphemes):
            joined = None
        if joined is not None:
            # 言い出す, 疲れきる, 見つめ直す, 値する: one verb the deck or the
            # dictionary holds, which UniDic cut in two -- no 切る "to cut",
            # 直す "to fix" under it (plan 272). The detector reads the two
            # pieces still, so 〜すぎる and 〜直す stay on it.
            run = morphemes[i:i + 2]
            lemma, said = joined
            from study.card_lookup import _VOCAB_BY_LEMMA
            from content.vocab_data import vocab_to_id
            deck = next(((lv, e) for lv, e in _VOCAB_BY_LEMMA.get(lemma, ())
                         if (e.get("kanji") or "") == lemma and said in morphology.kata_to_hira(e.get("kana") or "")), None)
            if deck is not None:
                token = _compound_dict(run, deck[0], deck[1], vocab_to_id(deck[1], deck[0]))
            else:
                token = _pool_compound_dict(run, jmdict_db.get_by_key(lemma, said) or {"kanji": lemma, "kana": said})
            token["reading"] = _written_reading(run)
            token["furigana"] = align_deck(token["surface"], token["reading"])
            token["pos"] = "verb"
            token["lemma"] = lemma
            token["parts"] = [{"surface": morphemes[k].surface, "lemma": morphemes[k].lemma, "pos": morphemes[k].pos,
                               "vocab_match": _deck_match(*deck_hits[k]) if deck_hits[k] else None}
                              for k in range(i, i + 2)]
            tokens.append(token)
            i += 2
            continue
        saying = resolve_pool_saying(morphemes, i)
        if saying and not any(j in strict and j not in own_forms for j in range(i, i + saying[1])):
            # 顔から火が出る, 猫の手も借りたい, 火の車: one saying, whose cards
            # say none of it (plan 272), read as the page writes it
            row, n = saying
            run = morphemes[i:i + n]
            token = _pool_compound_dict(run, row)
            token["reading"] = _written_reading(run)
            said, ending = morphology.kata_to_hira(row.get("kana") or ""), morphology.kata_to_hira(run[-1].lemma_reading)
            if said and said != token["reading"]:
                # (as the row reads it, where UniDic misread a word of it:
                # 兜の緒を締めよ is お, no いとぐち; 憂い うれい, plan 272)
                if token["surface"] == row.get("kanji"):
                    token["reading"] = said
                elif said.endswith(ending):
                    token["reading"] = said[:-len(ending)] + morphology.kata_to_hira(run[-1].reading)
            token["furigana"] = align_deck(token["surface"], token["reading"])
            token["pos"] = {"verb": "verb", "adjective": "adjective"}.get(run[-1].pos, "noun")
            _as_its_idiom(token, row)
            token["parts"] = [{"surface": morphemes[k].surface, "lemma": morphemes[k].lemma, "pos": morphemes[k].pos,
                               "vocab_match": _deck_match(*deck_hits[k]) if deck_hits[k] else None}
                              for k in range(i, i + n) if morphemes[k].pos not in ("particle", "auxiliary")]
            tokens.append(token)
            i += n
            continue
        pooled = resolve_pool_idiom(morphemes, i)
        if pooled and not any(j in strict and j not in own_forms for j in range(i, i + pooled[1])):
            # 気になる, "to weigh on one's mind" (plan 272), read as written;
            # its verb's own form (本題に入ろう) is still the form's point.
            row, n = pooled
            run = morphemes[i:i + n]
            token = _pool_compound_dict(run, row)
            token["reading"] = _written_reading(run)
            said = morphology.kata_to_hira(row.get("kana") or "")
            verb_said = morphology.kata_to_hira(run[-1].lemma_reading)
            if said.endswith(verb_said) and said[:-len(verb_said)] != _written_reading(run[:-1]):
                # (音を上げる: ね, as the expression reads it, plan 272)
                token["reading"] = said[:-len(verb_said)] + run[-1].reading
            token["furigana"] = align_deck(token["surface"], token["reading"])
            token["pos"] = "adjective" if run[-1].pos == "adjective" else "verb"     # (息の長い, plan 272)
            # The words it is made of, with their deck cards (手, 入れる),
            # which a sentence written for a level still counts
            # (level_mix.words_at_level, reading_sentences.off_deck_words).
            token["parts"] = [{"surface": morphemes[k].surface, "lemma": morphemes[k].lemma, "pos": morphemes[k].pos,
                               "vocab_match": _deck_match(*deck_hits[k]) if deck_hits[k] else None}
                              for k in range(i, i + n) if morphemes[k].pos != "particle"]
            tokens.append(token)
            i += n
            continue
        pooled = resolve_pool_whole_word(morphemes, i)
        if pooled and not any(j in strict for j in range(i, i + pooled[1])):
            # A pool word UniDic cut into a word and its particles (plan
            # 272): なぜか, "for some reason", never "why" and a question.
            row, n = pooled
            token = _pool_compound_dict(morphemes[i:i + n], row)
            token["reading"] = _written_reading(morphemes[i:i + n])     # (なんぼなんでも, as said, plan 272)
            token["furigana"] = align_deck(token["surface"], token["reading"])
            token["pos"] = "adverb"
            tokens.append(token)
            i += n
            continue
        numerals, counted = _counted_run(morphemes, i)
        token = _counted_dict(morphemes[i:i + counted], numerals, numbers.get(i)) if counted else None
        if token is not None:
            tokens.append(token)
            i += counted
            continue
        if i in numbers:
            end, printed, reading = numbers[i]
            if end == i + 1 and deck_hits[i]:
                # A figure the deck has a card for keeps it: 5 is 五.
                token = _token_dict(morphemes[i], deck_hits[i])
                token["reading"] = reading
                token["furigana"] = [{"text": morphemes[i].surface, "reading": reading}]
            else:
                token = _digits_dict(morphemes[i:end], printed, reading)
            tokens.append(token)
            i = end
            continue
        counted_run = _numeral_run(morphemes, i, deck_hits)
        if counted_run:
            run = morphemes[i:i + counted_run]
            tokens.append(_number_dict(run, numeral_value("".join(m.surface for m in run))))
            i += counted_run
            continue
        pooled = None if i in ruled else resolve_pool_compound(morphemes, i, pool_hits)
        while pooled and pooled[1] > 2 and any(j in ruled for j in range(i, i + pooled[1])):
            # (a word over a point is the point's; a shorter one may still
            # stand before it: 数年 + 前, 〜まえに's, where 数年前 would
            # take the point's 前, plan 280)
            pooled = resolve_pool_compound(morphemes, i, pool_hits, max_len=pooled[1] - 1)
        if pooled and not any(j in ruled for j in range(i, i + pooled[1])):
            entry, n = pooled
            token = _pool_compound_dict(morphemes[i:i + n], entry)
            nouns = [k for k in range(i, i + n) if morphemes[k].pos == "noun"]
            if nouns and all(deck_hits[k] for k in nouns):
                # A pool word folded over the deck's own nouns (観光地,
                # 取引先, plan 272) keeps them, as an idiom does: a
                # sentence written for a level still counts its cards.
                token["parts"] = [{"surface": morphemes[k].surface, "lemma": morphemes[k].lemma,
                                   "pos": morphemes[k].pos,
                                   "vocab_match": _deck_match(*deck_hits[k]) if deck_hits[k] else None}
                                  for k in range(i, i + n)]
            tokens.append(token)
            i += n
            continue
        fragments = resolve_name_fragments(morphemes, i)
        if fragments and not any(j in ruled for j in range(i, i + fragments[1])):
            # A word in kana UniDic cut into names (plan 272): しゅうまつ.
            (kind, hit), n = fragments
            token = _compound_dict(morphemes[i:i + n], *hit) if kind == "deck" \
                else _pool_compound_dict(morphemes[i:i + n], hit)
            token["pos"] = "noun"
            tokens.append(token)
            i += n
            continue
        te_noun = resolve_te_noun(morphemes, i)
        if te_noun and not any(j in ruled for j in range(i, i + 2)):
            # A noun in kana read as a て form (plan 272): きってを, 切手.
            token = _compound_dict(morphemes[i:i + 2], *te_noun[:3])
            token["pos"] = "noun"
            tokens.append(token)
            i += 2
            continue
        polite = resolve_polite_noun(morphemes, i)
        if polite and not any(j in ruled for j in range(i, i + 2)):
            # お + a verb's stem, a noun (plan 272): おすすめ, "a recommendation".
            (kind, hit), n = polite
            token = _compound_dict(morphemes[i:i + n], *hit) if kind == "deck" \
                else _pool_compound_dict(morphemes[i:i + n], hit)
            token["pos"] = "noun"
            # (Read as the page says it, おむかえ, never the verb's むかえる.)
            token["reading"] = morphology.kata_to_hira("".join(m.reading for m in morphemes[i:i + n]))
            token["furigana"] = align_deck(token["surface"], token["reading"])
            tokens.append(token)
            i += n
            continue
        whole = resolve_whole_word(morphemes, i)
        if whole and not any(j in strict for j in range(i, i + whole[3])):
            # A deck word the tokenizer wrote as a word and its particles
            # (plan 272): いつも is no "when" and "also", 実は no "truth" and
            # a topic. (The adverbial form's に stays lit on 非常に: the
            # card's word and the lesson's.)
            level, entry, raw_id, n = whole
            token = _compound_dict(morphemes[i:i + n], level, entry, raw_id)
            token["pos"] = "adverb"
            tokens.append(token)
            i += n
            continue
        deck = deck_hits[i]
        if i + 1 not in ruled and resolve_adverb_tail(morphemes, i, deck):
            token = _compound_dict(morphemes[i:i + 2], *deck)
            token["pos"] = "adverb"
            tokens.append(token)
            i += 2
            continue
        whole = None if (i in ruled or i + 1 in ruled) else resolve_adverb_whole(morphemes, i)
        if whole:
            # A sound word and its と, one word (plan 272): さっと, ガシッと.
            kind, hit = whole
            token = _compound_dict(morphemes[i:i + 2], *hit) if kind == "deck" \
                else _pool_compound_dict(morphemes[i:i + 2], hit)
            token["pos"] = "adverb"
            tokens.append(token)
            i += 2
            continue
        clock = _clock_time(morphemes, i)
        if clock:
            tokens.append(_clock_dict(morphemes[i:i + clock]))
            i += clock
            continue
        figures = _score_dict(morphemes, i) or _fraction_dict(morphemes, i)
        if figures is not None:
            tokens.append(figures)          # 26-24, 1/2 (plan 272)
            i += 3
            continue
        if i not in ruled and i + 1 not in ruled and _adverbs_to(morphemes, i):
            # しっかりと, 次々と: the adverb's card, its と read with it
            # (plan 272).
            n = _adverb_to_length(morphemes, i)
            run = morphemes[i:i + n]
            row = None if deck else resolve_pool_morpheme(morphemes, i)
            if deck or row:
                token = _compound_dict(run, *deck) if deck else _pool_compound_dict(run, row)
                token["pos"] = "adverb"
                token["reading"] = "".join(morphology.kata_to_hira(m.reading) for m in run)
                token["furigana"] = align_deck(token["surface"], token["reading"])
                tokens.append(token)
                i += n
                continue
        if deck is None and (i not in ruled or morphemes[i].pos in ("conjunction", "adnominal")):
            # (A conjunction is a word with its card beside the point that
            # is it, as しかし is: そして, its card and its point, plan 272;
            # an adnominal too, as この is: その.)
            deck = resolve_function_word(morphemes, i)
        if (morphemes[i].surface == "って" and i + 1 < len(morphemes) and morphemes[i + 1].surface == "ば"
                and morphemes[i + 1].pos == "particle" and i + 1 not in ruled
                and particle_glosses.closes_sentence(morphemes, i + 1)):
            # ってば, "I told you!": one particle, never って and a
            # conditional ば (plan 272).
            token = _joined_dict(morphemes[i:i + 2], "particle")
            token["gloss"] = particle_glosses.gloss([_merged_morpheme(morphemes[i:i + 2])], 0)
            tokens.append(token)
            i += 2
            continue
        said = resolve_interjection(morphemes[i]) if i not in ruled and not particle_glosses.answering_yes(
            morphemes, i) else None
        if said and said[0] == "deck":
            # An exclamation by the spelling it is said as (plan 272):
            # あのー is the filler あのう, never あの, "that over there".
            deck = said[1]
        elif said and morphemes[i].surface[-1:] in "ーっッぁぃぅぇぉ〜～":
            # ...and drawn out or cut short, by the pool's row for it
            # over the card UniDic's lemma reaches: えーっ, "eh?!", is no
            # ええ, "yes".
            deck = None
        home = resolve_home(morphemes, i) if i not in ruled else None
        if home is not None:
            # うち, "home", where the deck's うち is "inside, while" (plan 272).
            deck, said = None, ("pool", home)
        sense = _affix_sense(morphemes, i, numbers) if i not in ruled else None
        affix = sense is not None
        if affix:
            deck, said = None, None
        named = _named(morphemes, i)
        span = deck is None and morphemes[i].surface in _SPAN_COUNTERS and _after_a_number(morphemes, i, numbers)
        pool = None if deck or (i in ruled and i not in own_forms) or named or span or affix \
            or particle_glosses.gives_a_reason(morphemes, i) or particle_glosses.net_laughter(morphemes, i) \
            or particle_glosses.no_card_here(morphemes, i) \
            else (said[1] if said else resolve_pool_morpheme(morphemes, i))
        token = _token_dict(morphemes[i], deck, pool, named)
        if pool and not deck:
            _name_or_word(token, morphemes[i], pool, called=_called_to(morphemes, i))
        if span:
            token["gloss"] = dict(_SPAN_COUNTERS[morphemes[i].surface])
        elif affix:
            token["gloss"] = dict(sense)
        elif deck is None and pool is None and _latin_sense(morphemes, i) is not None:
            said, token["gloss"] = _latin_sense(morphemes, i)
            token["reading"], token["furigana"] = said, [{"text": morphemes[i].surface, "reading": said}]
        elif deck is None and pool is None and morphemes[i].pos == "prefix" and morphemes[i].surface in _PREFIX_GLOSSES \
                and (morphemes[i].surface != "長" or morphemes[i].reading == "ちょう"):
            token["gloss"] = dict(_PREFIX_GLOSSES[morphemes[i].surface])
        elif deck is None and pool is None and i not in ruled and not named and "gloss" not in token:
            # A word of speech the course has no lesson for (plan 272):
            # ぞ, かしら, the negative ん, the って that quotes.
            said = particle_glosses.gloss(morphemes, i)
            if said:
                token["gloss"] = said
        tokens.append(token)
        i += 1
    return tokens


# The local tier's revision. Its answer is made again on every request,
# except where a caller keeps one: a video session stores the analysis
# of every line it was built with (routes/video.py), and would go on
# showing a line as it was first read for as long as the session is
# kept. Bump this when a change makes the local tier answer differently
# for a sentence it has already answered -- the tokenizer, the grammar
# detector, the lookups -- and a stored session analysed under another
# revision (or before there was one) is analysed again when next opened.
# 1: offsets past a space (every particle after a subtitle's first
# space was lost) and the plain copula after a noun (2026-09-25).
# 2: the JMdict pool after the deck -- a word the course does not teach
# carries its meaning and its card (plan 148).
# 3: the grammar detector reads what a point attaches to by kind of
# word, the copula's and a pattern's final word's forms, and the plain
# past and negative (plan 149).
# 4: no false key and no false meaning (plan 150) -- the particles the
# tokenizer cannot tell apart (でも, とは, とか), a multi-part point's
# tightest reading, 何でも／誰でも as its own point; and no card for a
# word that only sounds like the token (郷 is not 号, センス not 扇子),
# the N5 する／なる／いい over their N3 and N1 twins.
# 5: what eight reviewers found (plan 151) -- each point's homographs
# refused (obligation is no prohibition, the volitional of 〜ようとする
# no "let's", a compound particle's に no moment), 〜も（強調） and the
# mixed "must" halves found, a counter after a number; no card read
# otherwise than the token (彼ら's ら is not 等), a suffix folded into
# its word (参加者) or given its affix sense, a pool word's first senses.
# 6: readings spelled rather than pronounced (大きい おおきい, not
# おうきい) and put right in context (お母さん's 母 かあ, 一本 いっぽん;
# study/reading_context.py), which is every row's reading and furigana
# -- 2 on main while plans 148-151 were open on their branch.
# 7: what the detector could not see (plan 152) -- the embedded
# question, polite hearsay, a point in its other spelling (に従って,
# 事が出来る, 時 read とき); and no card for the verb of a compound
# particle (について's つい is no 着く).
# 8: no card for the negated verb of a "must" or a "must not" (plan
# 160: 〜てはいけません's いけ is no 行く "to go"), a word a point is
# written on and has no card not counted off-deck, and every deck
# card's French gloss beside its English one (`meaning_fr`).
# 9: a sentence's level no longer set by a kanji the kanji deck files
# above the word it is written in (離さないで was N1 over 離; its word
# 離す is N3) -- difficulty._word_kanji_levels.
# 10: the greetings a first lesson teaches (plan 186d) -- an
# interjection reaches its kana-only card (おはよう, ありがとう), and a
# set phrase standing as a clause is one word (すみません is no 済む).
# 11: 一月 read ひとつき, "one month", where what follows measures it
# (一月かかる, 一月前, 一月の間, 一月も before a verb's negative or a
# verb of time spent), so it
# reaches that card and not January's
# (study/reading_context.py's span rule).
# 12: what the tours found (plan 188) -- a point read after the kinds of
# word its structure line names (若いくせに) and never after a verb in a
# form the line rules out (読みこと, 乗るっこない), a point in the other
# register (はずだ, わけです) and the spoken contractions (じゃ, てる), a
# compound's second half (乗りこもう, 書き直し, やりがい), the volitional
# that opens 〜ようとする and its kin, and 〜ものを, 〜か〜か with one か.
# 13: what the reading bank's drafters met (plan 193) -- a lexical
# causative (知らせる) no 使役形, the short causative passive (行かされる),
# いらっしゃる／おっしゃる／なさる in every form, 〜ようと思う, 一日中,
# 致す after お〜, 〜ばかりに after ん, 〜っぽい, 〜ずくめ, 〜手前, 〜どころ;
# まま no ママ nor 間々; すぐ, ゆっくり, 良い, 赤ちゃん, 何も and 世論 their
# lower or right cards; 〜不足 after a noun read ぶそく.
# 14: no card for a verb in kana another deck verb is spelled as there
# (plan 213): おきます no 置く, ふりました no 振る, はれる no 腫れる.
# 15: French beside the English (plan 215) -- a JMdict pool word's
# `meaning_fr` from the pool's French layer, and a grammar point's
# `structure_fr`, so a stored breakdown is rebuilt to carry them.
# 16: a quotation's と is the particle, never the first kana of a word
# (plan 236): 「…」と博 is と and the name 博, no と博 (賭博, "gambling");
# and a name takes no pool row read otherwise (博 read ひろし is no 博
# read はく, "doctor").
# 17: the content audit's second placement run (#360) -- そして, 取引,
# 追いかける and とりあえず reach their cards, which wrote them 然して (at
# N1), 取り引き, 追い掛ける and 取りあえず before.
# 18: plan 260 -- 95 cards down to the level two signals agree on (枚,
# 冊, さん at N5, not N1), so a stored breakdown's badges read the new
# levels, and また reaches its kana card, which wrote it 又 before.
# 19: plan 266 -- every part of a sentence says what it is: the function
# words reach their kana cards (さん, その, ほど, じゃあ), a sentence's
# opening でも and では, a set phrase said alone (どういたしまして), a deck
# idiom (気をつける) and a word the tokenizer cut (知らせる) are one word;
# a number carries its figure and a name says it is one; and the
# detector reads 〜ております, the な of 休みなので, a quotation without
# brackets, につきまして and the ません of ありませんが.
# 20: plan 272 -- the deck's words written in kana read whole (としょかん,
# きっさてん: study/kana_lexicon.py), a stretch of kana no dictionary has
# one word (ぷらそにか, a name: no ぷ, ら, そ and two particles' points),
# それでは and それでも one conjunction each and そして its card after a
# particle, １つ the deck's 一つ, and a line read inside the lines either
# side of it (この一回のテイクで's で the particle "with"); a figure read
# in Japanese (３日 みっか, ２０歳 はたち, 3曲目 an ordinal), 何分 by what
# follows it; the words of speech said (ぞ, かしら, the three って, ん, ぬ,
# へん) and an exclamation as the word it draws out (あのー, ただいまー);
# a kana verb's card by the word it takes (雨がふる 降る, 東京にすむ 住む,
# 風がふく 吹く, 二十分たつ 経つ); a deck word the tokenizer writes as a
# word and its particles one word (いつも, 実は, 急に, 今にも), a sound
# word and its と one (さっと, ガシッと), and すみませんでした and
# すいません the set phrase.
# 21: plan 274 -- a shop written in kana is the shop (パンや パン屋, くつや
# 靴屋, 本や 本屋), no noun and the particle や, where a particle, さん or
# the copula follows it rather than a second noun.
# 22: plan 272, the last silent parts -- a verb after て that is 〜ている's
# or 〜てしまう's no card of its own, a word the pool spells otherwise
# (気合い 気合, ごみ袋 ゴミ袋), お探し, 習わせる and 断ち切れる by the verb
# they are made of, a surname read alone, the senses of 入り, 屋, たち and
# ごと, こんな／そんな before a noun, words cut or joined (お知らせ, 嫌がる,
# しろ 白, どうして); and the detector's 〜て（理由）, 〜上で, そんなに,
# 〜たらどうですか, 〜ぶりに and the と of what is known or vowed. And what
# a fourth review found: a date's weekday （木）, 17日 じゅうしちにち, 4球目,
# set words and Kansai speech one word (それとも, そのもの, 父上, 通行止め,
# あかん, ありえん, やん), the formal より "from", にて, 〜先, 〜超, お忙しい
# ところ; short forms (に伴い, もんじゃ, はずがなかろう, ご注意ください) lit,
# and lookalikes refused (割に合わない, 今か今か, ので's で). And what a
# fifth review found: Latin letters by JMdict's full-width rows (SNS, AI,
# Uターン), units after a figure (600W, 400ml), scores and fractions,
# sizes and JLPT levels; a card by what the sentence says (キロ, そら, かめ,
# おごる, はれる) and a katakana word only its own lemma's (ワン no 湾);
# two loanwords JMdict holds as one (ツーアウト); old speech, net slang and
# dialect glossed (ござる, それがし, 笑, けえ, がね, っぺ); short forms lit
# (により, に限り, まだ…ていない, ことはある) and lookalikes refused. And
# what a sixth review found: the request on a call or 〜とく, short forms
# (だろ, はずな, とこ, ちゃだめ), a point across a picture book's spaces,
# sayings whole (三日坊主), a picture book's animal named, a number's
# reading kept on its own token, and cards by the sentence (ほん 本, せい).
# 23: what an eighth review found -- forms the lessons do not write
# (とたん without に, おそれあり, こととなる, ありながら, ひとつせず), a fused
# particle left to its construction (が早いか's か), cards by what the verb
# takes (ひと息つく 吐く, 鼻をつく 突く, 返しに行く 返す), a compound verb as
# its two verbs, and the west's and the north's speech glossed (やで, かて,
# ちゃう, しよる, べ, なして).
# 24: 113 cards given the senses the app's sentences use (うち "one's
# home", 気 "attention (as in 気にする)"), the cards those sentences took
# wrong (来月の一日 ついたち, お金をかける 掛ける, 電車がはやい 速い, a shop's
# name in kana), のように as 〜ような, and an idiom judged by its card's
# senses less those written by their own phrase.
# 25: a ninth review's 160 lines (drama, announcements, recipes, business
# mail, regional speech, picture books): words kept whole (熱中症,
# 住民票, 保育園 in kana), kana verbs by their objects (ながぐつをはく,
# 金魚をかう), a person's or a firm's name for no word (中島, みどり商事,
# ハルノ企画), readings (1回表 おもて, 3割1分 ぶ, お持ちの方 かた), the west's
# and the north's speech glossed (はる, てえや, とう, でけろ, たろか), and
# the points a business letter or a recipe uses (お〜申し上げる, 〜すぎる).
# 26: held to text it was never tuned on (plan 272) -- each narrow rule
# tried on sentences written to break it: a kana noun's partners read in
# its own clause (かぜ… 、かぜをひいた), 方 ほう after a plain verb (見える
# 方を選んだ), はやい of a runner, 〜のに before any verb, an adjective's
# idiom whole (息の長い, 気が長い), a deed's place (勤務地, 連絡先), the
# west's and Kyoto's speech by its frame (おこしやす, 何しよると？), and
# キロ, 額, 数, 等 by what their sentence says.
# 27: segmentation and grammar (plan 272) -- a compound verb the deck or
# the dictionary holds read as one (降り出す, 疲れきる, 跳ね回る) where
# its sentence fits the word's field, a saying its cards cannot say read
# whole (顔から火が出る, 猫の手も借りたい, 賽は投げられた) and never over a
# construction the catalogue teaches (昼夜を問わず), a て before no deed
# as its reason (ほえてうるさい), a pattern on its written stem (に先立ち,
# につれ), a particle fused into its construction left without a point
# of its own (にもかかわらず's も), the tokenizer's misreadings of 重そう,
# なくして, 出さん and ぶっちゃけ, and 今日, 数, 〜山 read by their neighbours.
# 28: a run of the deck's own nouns the dictionary writes as one word is
# that word (plan 280, the owner's choice): 電話番号, 観光客, 記者会見, read
# as the dictionary reads them (うでどけい), their cards kept as parts --
# where the French layer has the word, never over a point, a count (五年後,
# 何分) or a person said of several (人たち).
# 29: the French layer gains the 8,258 compounds of deck nouns that stayed
# two for want of a line (plan 280): 電気料金, 洗濯物, 自由貿易 now fold;
# 第 with its number folds only before a noun (第三者, never 第三 + 章).
# 30: the French layer gains the 11,326 rarer compounds of deck nouns,
# past JMdict's rank 100,000 (plan 280): 業務委託, 夏野菜 fold in any text
# that writes them; none of the app's own sentences does.
# 31: sixteen cards the course's sentences use (体重, 主人, もしもし,
# ただいま...) and ten usually-kana words as kana cards (#360, #439).
# 32: a point's gloss and formation line in Spanish (plan 291): `meaning`
# gains its `es` and the point its `structure_es`, and a deck card's
# match its `meaning_es`.
# 33: every gloss the breakdown writes itself gains its `es` (plan 291):
# a word of speech, a prefix or suffix, a name's kind, a unit, a size, a
# figure, a time, a date, an ordinal, an age.
# 34: a pool word, a chosen sense and an idiom gain their `meaning_es`
# from the Spanish layer over JMdict (plan 291), as `meaning_fr`.
LOCAL_REV = 34


def analyze_local(text: str, level: str | None = None, before: str = "", after: str = "") -> dict:
    """Everything about a Sentence that needs no language model. Pure and
    user-independent, therefore cacheable and shareable across learners.

    `level` is the level to grade against; when omitted, grading uses the
    sentence's own estimated level (falling back to N5 if the sentence
    fits no level at all -- report() needs *some* level to grade against
    even for a sentence that fits nothing).

    `before` and `after` are the text either side where `text` is one
    line of a longer text -- a subtitle's line, a piece of a cut cue or
    of a typed sentence (plan 272): it is read in its context
    (morphology.tokenize), and the result is still the line's alone.
    """
    morphemes = (morphology.tokenize(text, before=before, after=after) if before or after
                 else morphology.tokenize(text))
    if morphemes is None:
        # No fallback to a worse analysis here -- see the module
        # docstring. A caller renders "analysis unavailable", not a
        # silently degraded one.
        return {
            "text": text, "tokens": [], "grammar": [],
            "level": None, "grade": None, "available": False,
        }

    grammar = _grammar_entries(text, morphemes)
    tokens = _tokens(morphemes, grammar)
    _senses_by_sentence(tokens)
    grammar = _outside_set_phrases(tokens, grammar)
    _attach_grammar(tokens, grammar)
    # Segmented once for both: left to them, estimate_level and report
    # each segment the sentence again for every level they try.
    segments = find_segments_in_text(text)
    estimated = difficulty.estimate_level(text, segments)
    grade_level = level or estimated or "N5"

    return {
        "text": text,
        "tokens": tokens,
        "grammar": grammar,
        "level": estimated,
        "grade": difficulty.report(text, grade_level, segments),
        "available": True,
    }


def attach_user_state(analysis: dict, states: dict, user_id: str) -> dict:
    """Add per-learner SRS stats to an analyze_local result. Returns a
    NEW dict -- analyze_local's result is cacheable and shared, so this
    must never mutate its argument."""
    if not analysis.get("available"):
        return dict(analysis)

    tokens = []
    unknown_count = 0
    off_deck_count = 0

    for tok in analysis["tokens"]:
        new_tok = dict(tok)
        vocab_match = tok.get("vocab_match")
        kanji_matches = tok.get("kanji_matches") or []
        is_content_word = tok.get("pos") in _CONTENT_POS

        if vocab_match:
            new_tok["vocab_match"] = {
                **vocab_match,
                "stats": card_stats(states, user_id, vocab_match["raw_id"], VOCAB_STATUS_MODES),
            }
        if kanji_matches:
            new_tok["kanji_matches"] = [
                {**k, "stats": card_stats(states, user_id, k["raw_id"], KANJI_STATUS_MODES)}
                for k in kanji_matches
            ]

        # Off-deck (no card anywhere) vs. unknown (a card that isn't
        # learned yet) are counted separately and are NEVER the same
        # bucket: an off-deck word is something the app cannot teach,
        # not something the learner failed to learn. Merging the two
        # would make every real-world sentence -- every OCR'd photo,
        # every video caption -- look impossible, and would make the
        # i+1 signal (exactly one unknown word) permanently false on
        # exactly the input this feature exists to handle.
        #
        # A JMdict pool word (plan 148) the learner has never taken up
        # is still off-deck in that sense -- the course does not teach
        # it, the learner simply CAN now -- so it counts where it always
        # did. Once it is in the learner's SRS it is a word of theirs
        # like any other and counts the way a deck word does.
        # A word a construction is written on, with no card of its own,
        # is the construction's (〜てはいけません's いけ, について's つい;
        # plans 152 and 160): no word the app cannot teach.
        ruled = not vocab_match and any(g.get("kind") != "marker" for g in tok.get("grammar") or [])
        if is_content_word and not ruled:
            status = new_tok["vocab_match"]["stats"]["status"] if vocab_match else None
            if vocab_match and not (vocab_match.get("pool") and status == "not_started"):
                if status in ("not_started", "new"):
                    unknown_count += 1
            elif not kanji_matches:
                off_deck_count += 1

        tokens.append(new_tok)

    grammar = [
        {**g, "stats": card_stats(states, user_id, g["raw_id"], GRAMMAR_STATUS_MODES)}
        for g in analysis["grammar"]
    ]
    # The stats onto the token's own copy, which keeps its occurrence
    # (its offsets) rather than taking the sentence-level entry's: a
    # point found twice has one card and two places.
    stats_by_id = {g["raw_id"]: g["stats"] for g in grammar}
    for tok in tokens:
        if tok.get("grammar"):
            tok["grammar"] = [
                {**g, "stats": stats_by_id[g["raw_id"]]} if g["raw_id"] in stats_by_id else g
                for g in tok["grammar"]
            ]

    return {
        **analysis,
        "tokens": tokens,
        "grammar": grammar,
        "unknown_count": unknown_count,
        "off_deck_count": off_deck_count,
    }


def merge_deep(analysis: dict, llm_words: list[dict], explanation: str,
               llm_grammar: list[dict] | None = None, translation: str = "") -> dict:
    """Fold the deep tier's per-word glosses and prose explanation onto
    Tokens the local tier already verified -- and its per-point notes
    onto the grammar the local tier found (plan 095), and the sentence's
    translation beside the explanation (plan 161).

    The tokenizer is the authority on segmentation: only `meaning` is
    copied from an LLM word onto its matched Token. Everything else --
    surface, reading, pos, offsets, vocab_match, kanji_matches -- comes
    from the local tier and wins. An LLM word matching no Token is a
    hallucinated boundary and is DROPPED rather than shown; the count of
    drops is returned as "deep_dropped" so a caller can see it happened
    (see docs/adr/0001-two-tier-sentence-analysis.md).

    Matching walks both lists forward by surface text, so a repeated
    word (e.g. two occurrences of は) binds to occurrences in order
    rather than every occurrence binding to the first match.

    A word may bind to a RUN of consecutive Tokens whose surfaces
    concatenate to it. A model cuts words the way a dictionary does
    (会いました) where the tokenizer cuts morphemes (会い / まし / た),
    and matching exact surfaces alone dropped the gloss of every
    conjugated verb and adjective -- the words a learner most needs
    glossed. The run's first Token carries the meaning and a `span_end`
    (the index of the run's last Token) so a renderer can show the run
    as the one word it is; the segmentation itself is still the
    tokenizer's, and every other field on every Token in the run is
    untouched.

    `llm_grammar` is the model's [{pattern, note}], one line per point
    the caller listed for it (routes/phrase._deep_points): what the
    pattern does IN THIS SENTENCE, which is the one thing the
    catalogue's gloss cannot say. The local tier is the authority on
    which points are there: a note lands on the entry -- and on every
    token's copy of it -- whose pattern it names, and a note for a
    pattern the sentence does not use is dropped, exactly as a word the
    tokenizer does not confirm is. A model may echo the pattern with
    its spaces trimmed; nothing looser is matched.

    Returns a NEW dict; does not mutate `analysis` -- the local analysis
    is cacheable and may be shared with a caller that never buys the
    deep tier.
    """
    tokens = [dict(t) for t in analysis.get("tokens", [])]
    used = [False] * len(tokens)
    dropped = 0

    notes: dict[str, str] = {}
    for item in llm_grammar or []:
        if not isinstance(item, dict):
            continue
        pattern, note = item.get("pattern"), item.get("note")
        if isinstance(pattern, str) and isinstance(note, str) and pattern.strip() and note.strip():
            notes.setdefault(pattern.strip(), note.strip())
    grammar = [
        {**g, "note": notes[g["pattern"]]} if g.get("pattern") in notes else dict(g)
        for g in analysis.get("grammar", [])
    ]
    if notes and not any("note" in g for g in grammar):
        logger.debug("deep tier noted %d point(s) the sentence does not use", len(notes))
    for tok in tokens:
        if tok.get("grammar"):
            tok["grammar"] = [
                {**g, "note": notes[g["pattern"]]} if g.get("pattern") in notes else g
                for g in tok["grammar"]
            ]

    for word in llm_words:
        surface = word.get("surface", "")
        meaning = word.get("meaning")
        span = _find_run(tokens, used, surface) if surface else None
        if span is None:
            dropped += 1
            continue
        start, end = span
        if meaning:
            tokens[start]["meaning"] = meaning
        if end > start:
            tokens[start]["span_end"] = end
        for i in range(start, end + 1):
            used[i] = True

    return {
        **analysis,
        "tokens": tokens,
        "grammar": grammar,
        "explanation": explanation,
        "translation": translation.strip() if isinstance(translation, str) else "",
        "deep_dropped": dropped,
    }


def _find_run(tokens: list[dict], used: list[bool], surface: str) -> tuple[int, int] | None:
    """(start, end) of the first unused run of Tokens whose surfaces
    concatenate to `surface`, or None. Forward, first match wins, so
    repeated words bind in order."""
    for start in range(len(tokens)):
        if used[start]:
            continue
        built = ""
        for end in range(start, len(tokens)):
            if used[end]:
                break
            built += tokens[end]["surface"]
            if built == surface:
                return start, end
            if not surface.startswith(built):
                break
    return None


def analyze_with_glosses(text: str, words: list[dict] | None, level: str | None = None) -> dict:
    """analyze_local(text, level) with a model's per-word glosses folded
    on, and no prose explanation. Pure, like both halves: the reading
    comprehension generator has the glosses in hand from the same call
    that wrote the text, so no second model call is bought for them."""
    return merge_deep(analyze_local(text, level), words or [], "")
