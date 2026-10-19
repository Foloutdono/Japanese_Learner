# ── Is what a paper shows the paper's level? (plan 257) ───────────────
# study/llm_shared.sentence_kanji_ok has gated the model-written text of
# every paper since the generators began: no kanji outside the level's
# cumulative set. The deck-built items never went through it -- 漢字読み
# and 表記 asked for the words the level's CARDS teach, whatever their
# kanji, so a N5 paper asked for 町, 窓 and 写真 (taught at N4 and N3 as
# characters) and offered 曇 and 燵 as wrong spellings; 文脈規定 printed
# 溺れて and 吠えて in a N3 paper. A paper shows only the kanji its
# level has been taught, everywhere it shows any.
#
# One exemption, the one difficulty.report(allow_kanji=) makes: a grammar
# point is spelled with the kanji it is spelled with (に伴って is N2, 伴
# is N1), so in a grammar paper the characters of the catalogue's patterns
# at or below the level are allowed.
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study.llm_shared import is_kanji, kanji_set_for_level

LEVELS = ("N5", "N4", "N3", "N2", "N1")


def paper_texts(paper: dict) -> list[tuple[str, str]]:
    """(where, text) for everything a learner reads or hears in a paper:
    stems, choices, pieces, passages and scripts. Not the mondai's
    instructions, which are the same words in every paper."""
    out: list[tuple[str, str]] = []

    def add(where, text):
        if isinstance(text, str) and text:
            out.append((where, text))

    def question(q, where):
        for key in ("promptJp", "contextJp", "questionPromptJp", "scriptJp"):
            add(f"{where} {key}", q.get(key))
        for c in q.get("choices") or []:
            add(f"{where} choice {c.get('id')}", c.get("textJp"))
        for p in q.get("pieces") or []:
            add(f"{where} piece {p.get('id')}", p.get("textJp"))

    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            for q in m.get("questions") or []:
                question(q, q.get("id"))
            for passage in m.get("passages") or []:
                pid = passage.get("id")
                add(f"{pid} title", passage.get("titleJp"))
                add(f"{pid} text", passage.get("textJp") or passage.get("textTemplateJp"))
                for b in passage.get("blanks") or []:
                    question(b, b.get("id"))
                for q in passage.get("questions") or []:
                    question(q, q.get("id"))
    return out


@lru_cache(maxsize=None)
def pattern_kanji(level: str) -> frozenset[str]:
    """The kanji the catalogue's grammar patterns at or below `level`
    are spelled with."""
    chars = set()
    for lv in LEVELS[: LEVELS.index(level) + 1]:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(lv, []):
            chars.update(c for c in point.get("pattern", "") if is_kanji(c))
    return frozenset(chars)


def kanji_outside(paper: dict, kind: str) -> list[tuple[str, str]]:
    """(where, characters) for every text of the paper written with kanji
    its level has not been taught."""
    level = paper.get("level")
    allowed = kanji_set_for_level(level)
    if kind == "grammar":
        allowed = allowed | pattern_kanji(level)
    out = []
    for where, text in paper_texts(paper):
        bad = "".join(dict.fromkeys(c for c in text if is_kanji(c) and c not in allowed))
        if bad:
            out.append((where, bad))
    return out


# ── Grammar above the level ────────────────────────────────────────────
# study/grammar_detect finds which catalogue points a text uses; a point
# the catalogue files above the paper's level is a point the learner has
# not been taught. The detector is built to teach (a false hit is a lesson
# about nothing), so it carries known misreadings of ordinary text, which
# are named here rather than hidden: a hit is not counted when the words
# around it are one of these.
_NOT_THE_POINT = (
    # (pattern, regex the text from the start of the hit must match)
    ("〜をもって", r"をもっ[てた]"),                                  # 持って, not "by means of"
    ("〜に足る", r"に足[をがはも]"),                                  # 足, the foot
    ("〜まい", r"まい(あさ|にち|しゅう|つき|ねん|とし|ばん|かい|ど)"),    # 毎
    ("〜のみ", r"のみ(もの|かい|すぎ|ほうだい|やすい)"),                  # 飲み
    ("いらっしゃる／おっしゃる／なさる", r"いらっしゃいませ"),           # the shop's greeting
    ("いらっしゃ", r"いらっしゃいませ"),
    ("〜はじめる／〜おわる／〜つづける", r"はじめまして"),                # the greeting
    ("こんな／そんな／あんな／どんな", r"どんな"),                      # どんな〜ですか is an N5 question
    ("それに", r"それに(し|なり|なっ)"),                              # それにします: that one, not "besides"
    ("それで", r"それで(おねがい|いい|けっこう|だいじょうぶ)"),          # それでおねがいします
    ("〜なら", r"なら[んびべぶ]"),                                    # ならんで: 並ぶ, not "if"
    ("〜ものがある", r"ものがあっ[たて]"),                             # ほしいものがあったら: a thing there is
)
# two sentences of the seeds the tokenizer misreads in a way no rule here can
# tell from the real thing: the pattern, and the words around it as printed
_READ_BY_HAND = (
    ("〜において", r"外においてねる"),        # 置いて: the phone put outside the room
    ("〜ものだ", r"買ってきたものだそうだ"),    # もの is the clock, a thing
)
# 持って来る, 連れて行く: verbs of their own in every N5 word list, not 〜ていく;
# どうやって行きますか is "how", not "go on doing"
_LEXICAL_COMING_GOING = ("もっ", "持っ", "つれ", "連れ", "のっ", "乗っ", "あるい", "歩い", "うやっ")
# a conditional と ends a verb or an adjective in its plain form (春になると,
# 安いと); the の that nominalises (本を読むのは) is followed by a particle or
# ends the utterance, where the genitive (本だなのいちばん上) is followed by a noun
_PLAIN_ENDINGS = tuple("うくぐすつぬぶむるいだ")
_NOMINALISER_TAIL = r"の([はがをにでともへ]|から|より|まで|です|だ|よ|ね|か|[？?。！!]|$)"
# the kana nouns the tokenizer reads as verbs (往ぬ, 因る), after the の that makes them nouns
_KANA_NOUNS_READ_AS_VERBS = ("のいぬ", "のよる")


def _is_not_the_point(pattern: str, text: str, start: int) -> bool:
    import re

    tail, head = text[start:start + 12], text[max(0, start - 4): start]
    if any(pattern == pat and re.search(rx, text[max(0, start - 8): start + 12]) for pat, rx in _READ_BY_HAND):
        return True
    if pattern == "受身形 〜られる":
        return head.endswith(("つか", "うか", "わか", "か"))              # 疲れ, 分かれ
    if pattern == "〜中":
        return head.endswith(("午前", "午後", "一日", "今日", "家", "世界", "一年", "夜", "毎日"))
    if pattern == "〜ていく／〜てくる":
        return head.endswith(_LEXICAL_COMING_GOING)
    if pattern == "〜うちに":
        return True            # 家に: judged by reading, never counted
    if pattern == "〜と":
        return head.endswith(_KANA_NOUNS_READ_AS_VERBS) or not head.endswith(_PLAIN_ENDINGS)
    if pattern == "〜の":
        return not re.match(_NOMINALISER_TAIL, tail)
    return any(pattern == pat and re.match(rx, tail) for pat, rx in _NOT_THE_POINT)


def grammar_above(text: str, level: str) -> list[tuple[str, str]]:
    """(pattern, its level) for each catalogue point the text visibly uses
    that the catalogue files above `level` and the detector can really find."""
    from study import difficulty, grammar_detect

    limit = difficulty.rank(level)
    out = []
    for pattern, point_level, start, _end in difficulty.points_in(text):
        if (difficulty.rank(point_level) > limit and grammar_detect.can_find(pattern)
                and not _is_not_the_point(pattern, text, start) and (pattern, point_level) not in out):
            out.append((pattern, point_level))
    return out


_BLANK = None
_SPACES = None


def paper_sentences(paper: dict, choices: bool = True) -> list[tuple[str, str]]:
    """(where, sentence) for what a learner reads or hears of a paper as
    running Japanese: the blank of a stem filled with the right choice,
    a passage with its blanks filled, the sentence a sentence-order
    question builds, every line of a script, and -- unless `choices` is
    False -- the choices of a question that are sentences themselves (not
    those of a blank, which are pieces of its stem). A fragment (は,
    たいです) or a single word is no sentence to find a grammar point
    in."""
    import re

    global _BLANK, _SPACES
    if _BLANK is None:
        _BLANK = re.compile(r"＿{2,}|（\s*＿+\s*）")
        _SPACES = re.compile(r"[ \u3000]+")
    out: list[tuple[str, str]] = []

    def right_of(q):
        return next((c.get("textJp") or "" for c in q.get("choices") or [] if c.get("id") == q.get("answer")), "")

    def question(q):
        qid = q.get("id")
        if q.get("scriptJp"):
            for i, line in enumerate(q["scriptJp"].split("\n"), 1):
                out.append((f"{qid} line {i}", line.partition(": ")[2]))
        elif q.get("pieces"):
            by = {p["id"]: p["textJp"] for p in q["pieces"]}
            out.append((qid, (q.get("contextJp") or "") + "".join(by[i] for i in q.get("order") or [])))
        elif q.get("promptJp"):
            stem = q["promptJp"]
            out.append((qid, _BLANK.sub(right_of(q), stem, count=1) if _BLANK.search(stem) else stem))
        # the choices of a blank are pieces of its stem (なくてもいいです alone
        # is not the sentence it is poured into): the right one is read there
        poured = bool(q.get("promptJp")) and bool(_BLANK.search(q["promptJp"]))
        for c in (q.get("choices") or []) if choices and not poured else []:
            if len(c.get("textJp") or "") >= 8:
                out.append((f"{qid} choice {c.get('id')}", c["textJp"]))

    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            for q in m.get("questions") or []:
                question(q)
            for passage in m.get("passages") or []:
                text = passage.get("textJp") or ""
                if passage.get("textTemplateJp"):
                    text = passage["textTemplateJp"]
                    for b in passage.get("blanks") or []:
                        text = text.replace(f"【{b.get('number')}】", right_of(b))
                out.append((passage.get("id"), text))
                for q in passage.get("questions") or []:
                    question(q)
    # the spaces of the N5/N4 stems mark phrases for the eye; the detector
    # reads the sentence without them (with one, ふると　おもいます is a
    # conditional と, and なければ　なりません a ば)
    out = [(w, _SPACES.sub("", t)) for w, t in out]
    return [(w, t) for w, t in out if len(t) >= 6]


def paper_grammar_above(paper: dict, kind: str = "") -> list[tuple[str, str, str]]:
    """(where, pattern, level) for every grammar point above the paper's
    level that its sentences use. A vocabulary paper's choices are the
    word under test used in four sentences (おかげで is an N4 word and an
    N3 point): they are not read."""
    level = paper.get("level")
    if level == "N1":
        return []
    out = []
    for where, text in paper_sentences(paper, choices=kind != "vocab"):
        for pattern, point_level in grammar_above(text, level):
            out.append((where, pattern, point_level))
    return out
