# ── Official JLPT blueprint ───────────────────────────────────
# Sourced from jlpt.jp's public guideline pages (mondai counts, section
# timing, scoring structure — the test's FORMAT) plus the two official
# revision notices that superseded the 2009 guidebook for N4/N5 (Dec
# 2020) and N1 listening (Dec 2022). This is the non-copyrightable
# layer: a mondai's official name, its item count, how long a section
# runs, how the exam is scored — these are facts about a test, the
# same way "20 questions in 45 minutes" is a fact and not anyone's
# expression. No test content (passages, items, transcripts) lives
# here or anywhere in this module; that's what backend/study/
# exam_*_gen.py generates from data this project actually owns.
#
# `type` on a mondai spec is the GENERATION kind (e.g. "kanji-reading")
# — a separate thing from the QuestionRenderer schema's own `type`
# field (e.g. "mcq-text") that a generator produces from this spec.
# Don't confuse the two: this file never emits a renderable question.
#
# Item counts below the 2009 guidebook's own table (N2/N3, never
# officially revised) are known to drift by roughly ±1-2 against real
# papers — see the N1 case, whose 即時応答/統合理解 counts moved
# between the 2009 guidebook and the 2022 notice with no public
# announcement. Treat every count here as the generator's TARGET, not
# a promise that every real paper matches it to the item.
#
# `official_number` is stored literally rather than derived, because
# N1/N2 number their 大問 continuously 1-14 across the whole booklet
# (vocab/grammar/reading share one number line) while N3-N5 restart
# numbering at each administered section.

# 得点区分 (scoring sections) — NOT the same grouping as the
# administered TIMING sections in LEVEL_BLUEPRINT below. N1-N3 score
# vocabulary/grammar+reading/listening separately despite vocabulary
# and grammar+reading sharing one undivided time block; N4/N5 score
# vocabulary+grammar+reading together despite timing vocabulary
# separately. A mondai's `scoring_section` field is what actually
# decides which bucket its points fall into — never derive it from
# which timing section it's administered under.
SCORING_SECTIONS = {
    "N5": ["vocabulary_grammar_reading", "listening"],
    "N4": ["vocabulary_grammar_reading", "listening"],
    "N3": ["vocabulary", "grammar_reading", "listening"],
    "N2": ["vocabulary", "grammar_reading", "listening"],
    "N1": ["vocabulary", "grammar_reading", "listening"],
}

# total_min/total_max out of 180. section_mins are the per-section
# 基準点 a candidate must clear — missing ANY ONE fails the whole
# exam regardless of total score (N3's overall minimum, 95, is
# genuinely higher than N2's 90 despite N3 being the easier level;
# get this table wrong and a mock exam lies about what passing means).
PASS_THRESHOLDS = {
    "N1": {"total_min": 100, "total_max": 180, "section_mins": {"vocabulary": 19, "grammar_reading": 19, "listening": 19}},
    "N2": {"total_min": 90,  "total_max": 180, "section_mins": {"vocabulary": 19, "grammar_reading": 19, "listening": 19}},
    "N3": {"total_min": 95,  "total_max": 180, "section_mins": {"vocabulary": 19, "grammar_reading": 19, "listening": 19}},
    "N4": {"total_min": 90,  "total_max": 180, "section_mins": {"vocabulary_grammar_reading": 38, "listening": 19}},
    "N5": {"total_min": 80,  "total_max": 180, "section_mins": {"vocabulary_grammar_reading": 38, "listening": 19}},
}

# The official score is an IRT-based 尺度得点 (scaled score) computed
# from the examinee's full response PATTERN against official item
# parameters — not a raw-correct count. No mock exam can reproduce
# this without those parameters. Anything derived from PASS_THRESHOLDS
# above is a raw-percentage estimate and must be labeled as one; see
# exam_scoring.py.

LEVEL_BLUEPRINT = {
    "N5": {
        "sections": [
            {"id": "vocabulary", "labelJp": "言語知識（文字・語彙）", "timeLimitMin": 20, "mondai": [
                {"id": "moji_1", "official_number": 1, "name_jp": "漢字読み",     "type": "kanji-reading",     "count": 7, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_2", "official_number": 2, "name_jp": "表記",         "type": "kanji-orthography", "count": 5, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_3", "official_number": 3, "name_jp": "文脈規定",     "type": "vocab-context",     "count": 6, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_4", "official_number": 4, "name_jp": "言い換え類義", "type": "vocab-paraphrase",  "count": 3, "scoring_section": "vocabulary_grammar_reading"},
            ]},
            {"id": "grammar_reading", "labelJp": "言語知識（文法）・読解", "timeLimitMin": 40, "mondai": [
                {"id": "bunpou_1", "official_number": 1, "name_jp": "文の文法1",       "type": "grammar-fill",    "count": 9, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "bunpou_2", "official_number": 2, "name_jp": "文の文法2",       "type": "sentence-order",  "count": 4, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "bunpou_3", "official_number": 3, "name_jp": "文章の文法",       "type": "cloze-passage",   "count": 4, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "dokkai_4", "official_number": 4, "name_jp": "内容理解（短文）", "type": "reading-passage", "count": 2, "scoring_section": "vocabulary_grammar_reading", "passage_chars": 80},
                {"id": "dokkai_5", "official_number": 5, "name_jp": "内容理解（中文）", "type": "reading-passage", "count": 2, "scoring_section": "vocabulary_grammar_reading", "passage_chars": 250},
                {"id": "dokkai_6", "official_number": 6, "name_jp": "情報検索",        "type": "table-reading",   "count": 1, "scoring_section": "vocabulary_grammar_reading", "passage_chars": 250},
            ]},
            {"id": "listening", "labelJp": "聴解", "timeLimitMin": 30, "mondai": [
                {"id": "choukai_1", "official_number": 1, "name_jp": "課題理解",   "type": "listening-mcq",         "count": 7, "scoring_section": "listening"},
                {"id": "choukai_2", "official_number": 2, "name_jp": "ポイント理解", "type": "listening-mcq",       "count": 6, "scoring_section": "listening"},
                {"id": "choukai_3", "official_number": 3, "name_jp": "発話表現",   "type": "listening-situational", "count": 5, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_4", "official_number": 4, "name_jp": "即時応答",   "type": "listening-response",    "count": 6, "scoring_section": "listening", "choice_mode": "audio-only"},
            ]},
        ],
    },
    "N4": {
        "sections": [
            {"id": "vocabulary", "labelJp": "言語知識（文字・語彙）", "timeLimitMin": 25, "mondai": [
                {"id": "moji_1", "official_number": 1, "name_jp": "漢字読み",     "type": "kanji-reading",     "count": 7, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_2", "official_number": 2, "name_jp": "表記",         "type": "kanji-orthography", "count": 5, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_3", "official_number": 3, "name_jp": "文脈規定",     "type": "vocab-context",     "count": 8, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_4", "official_number": 4, "name_jp": "言い換え類義", "type": "vocab-paraphrase",  "count": 4, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "moji_5", "official_number": 5, "name_jp": "用法",         "type": "vocab-usage",       "count": 4, "scoring_section": "vocabulary_grammar_reading"},
            ]},
            {"id": "grammar_reading", "labelJp": "言語知識（文法）・読解", "timeLimitMin": 55, "mondai": [
                {"id": "bunpou_1", "official_number": 1, "name_jp": "文の文法1",       "type": "grammar-fill",    "count": 13, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "bunpou_2", "official_number": 2, "name_jp": "文の文法2",       "type": "sentence-order",  "count": 4, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "bunpou_3", "official_number": 3, "name_jp": "文章の文法",       "type": "cloze-passage",   "count": 4, "scoring_section": "vocabulary_grammar_reading"},
                {"id": "dokkai_4", "official_number": 4, "name_jp": "内容理解（短文）", "type": "reading-passage", "count": 3, "scoring_section": "vocabulary_grammar_reading", "passage_chars": 150},
                {"id": "dokkai_5", "official_number": 5, "name_jp": "内容理解（中文）", "type": "reading-passage", "count": 3, "scoring_section": "vocabulary_grammar_reading", "passage_chars": 450},
                {"id": "dokkai_6", "official_number": 6, "name_jp": "情報検索",        "type": "table-reading",   "count": 2, "scoring_section": "vocabulary_grammar_reading", "passage_chars": 400},
            ]},
            {"id": "listening", "labelJp": "聴解", "timeLimitMin": 35, "mondai": [
                {"id": "choukai_1", "official_number": 1, "name_jp": "課題理解",   "type": "listening-mcq",         "count": 8, "scoring_section": "listening"},
                {"id": "choukai_2", "official_number": 2, "name_jp": "ポイント理解", "type": "listening-mcq",       "count": 7, "scoring_section": "listening"},
                {"id": "choukai_3", "official_number": 3, "name_jp": "発話表現",   "type": "listening-situational", "count": 5, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_4", "official_number": 4, "name_jp": "即時応答",   "type": "listening-response",    "count": 8, "scoring_section": "listening", "choice_mode": "audio-only"},
            ]},
        ],
    },
    "N3": {
        "sections": [
            {"id": "vocabulary", "labelJp": "言語知識（文字・語彙）", "timeLimitMin": 30, "mondai": [
                {"id": "moji_1", "official_number": 1, "name_jp": "漢字読み",     "type": "kanji-reading",     "count": 8, "scoring_section": "vocabulary"},
                {"id": "moji_2", "official_number": 2, "name_jp": "表記",         "type": "kanji-orthography", "count": 6, "scoring_section": "vocabulary"},
                {"id": "moji_3", "official_number": 3, "name_jp": "文脈規定",     "type": "vocab-context",     "count": 11, "scoring_section": "vocabulary"},
                {"id": "moji_4", "official_number": 4, "name_jp": "言い換え類義", "type": "vocab-paraphrase",  "count": 5, "scoring_section": "vocabulary"},
                {"id": "moji_5", "official_number": 5, "name_jp": "用法",         "type": "vocab-usage",       "count": 5, "scoring_section": "vocabulary"},
            ]},
            {"id": "grammar_reading", "labelJp": "言語知識（文法）・読解", "timeLimitMin": 70, "mondai": [
                {"id": "bunpou_1", "official_number": 1, "name_jp": "文の文法1",       "type": "grammar-fill",    "count": 13, "scoring_section": "grammar_reading"},
                {"id": "bunpou_2", "official_number": 2, "name_jp": "文の文法2",       "type": "sentence-order",  "count": 5, "scoring_section": "grammar_reading"},
                {"id": "bunpou_3", "official_number": 3, "name_jp": "文章の文法",       "type": "cloze-passage",   "count": 5, "scoring_section": "grammar_reading"},
                {"id": "dokkai_4", "official_number": 4, "name_jp": "内容理解（短文）", "type": "reading-passage", "count": 4, "scoring_section": "grammar_reading", "passage_chars": 175},
                {"id": "dokkai_5", "official_number": 5, "name_jp": "内容理解（中文）", "type": "reading-passage", "count": 6, "scoring_section": "grammar_reading", "passage_chars": 350},
                {"id": "dokkai_6", "official_number": 6, "name_jp": "内容理解（長文）", "type": "reading-passage", "count": 4, "scoring_section": "grammar_reading", "passage_chars": 550},
                {"id": "dokkai_7", "official_number": 7, "name_jp": "情報検索",        "type": "table-reading",   "count": 2, "scoring_section": "grammar_reading", "passage_chars": 600},
            ]},
            {"id": "listening", "labelJp": "聴解", "timeLimitMin": 40, "mondai": [
                {"id": "choukai_1", "official_number": 1, "name_jp": "課題理解",   "type": "listening-mcq",         "count": 6, "scoring_section": "listening"},
                {"id": "choukai_2", "official_number": 2, "name_jp": "ポイント理解", "type": "listening-mcq",       "count": 6, "scoring_section": "listening"},
                {"id": "choukai_3", "official_number": 3, "name_jp": "概要理解",   "type": "listening-gist",        "count": 3, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_4", "official_number": 4, "name_jp": "発話表現",   "type": "listening-situational", "count": 4, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_5", "official_number": 5, "name_jp": "即時応答",   "type": "listening-response",    "count": 9, "scoring_section": "listening", "choice_mode": "audio-only"},
            ]},
        ],
    },
    "N2": {
        "sections": [
            {"id": "vocabulary_grammar_reading", "labelJp": "言語知識（文字・語彙・文法）・読解", "timeLimitMin": 105, "mondai": [
                {"id": "moji_1", "official_number": 1,  "name_jp": "漢字読み",       "type": "kanji-reading",     "count": 5, "scoring_section": "vocabulary"},
                {"id": "moji_2", "official_number": 2,  "name_jp": "表記",           "type": "kanji-orthography", "count": 5, "scoring_section": "vocabulary"},
                {"id": "moji_3", "official_number": 3,  "name_jp": "語形成",         "type": "word-formation",    "count": 5, "scoring_section": "vocabulary"},
                {"id": "moji_4", "official_number": 4,  "name_jp": "文脈規定",       "type": "vocab-context",     "count": 7, "scoring_section": "vocabulary"},
                {"id": "moji_5", "official_number": 5,  "name_jp": "言い換え類義",   "type": "vocab-paraphrase",  "count": 5, "scoring_section": "vocabulary"},
                {"id": "moji_6", "official_number": 6,  "name_jp": "用法",           "type": "vocab-usage",       "count": 5, "scoring_section": "vocabulary"},
                {"id": "bunpou_7", "official_number": 7, "name_jp": "文の文法1",     "type": "grammar-fill",      "count": 12, "scoring_section": "grammar_reading"},
                {"id": "bunpou_8", "official_number": 8, "name_jp": "文の文法2",     "type": "sentence-order",    "count": 5, "scoring_section": "grammar_reading"},
                {"id": "bunpou_9", "official_number": 9, "name_jp": "文章の文法",    "type": "cloze-passage",     "count": 5, "scoring_section": "grammar_reading"},
                {"id": "dokkai_10", "official_number": 10, "name_jp": "内容理解（短文）", "type": "reading-passage",       "count": 5, "scoring_section": "grammar_reading", "passage_chars": 200},
                {"id": "dokkai_11", "official_number": 11, "name_jp": "内容理解（中文）", "type": "reading-passage",       "count": 9, "scoring_section": "grammar_reading", "passage_chars": 500},
                {"id": "dokkai_12", "official_number": 12, "name_jp": "統合理解",       "type": "integrated-comparison",  "count": 2, "scoring_section": "grammar_reading", "passage_chars": 600},
                {"id": "dokkai_13", "official_number": 13, "name_jp": "主張理解（長文）", "type": "reading-passage",       "count": 3, "scoring_section": "grammar_reading", "passage_chars": 900},
                {"id": "dokkai_14", "official_number": 14, "name_jp": "情報検索",       "type": "table-reading",          "count": 2, "scoring_section": "grammar_reading", "passage_chars": 700},
            ]},
            {"id": "listening", "labelJp": "聴解", "timeLimitMin": 50, "mondai": [
                {"id": "choukai_1", "official_number": 1, "name_jp": "課題理解",   "type": "listening-mcq",         "count": 5, "scoring_section": "listening"},
                {"id": "choukai_2", "official_number": 2, "name_jp": "ポイント理解", "type": "listening-mcq",       "count": 6, "scoring_section": "listening"},
                {"id": "choukai_3", "official_number": 3, "name_jp": "概要理解",   "type": "listening-gist",        "count": 5, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_4", "official_number": 4, "name_jp": "即時応答",   "type": "listening-response",    "count": 12, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_5", "official_number": 5, "name_jp": "統合理解",   "type": "listening-integrated",  "count": 4, "scoring_section": "listening"},
            ]},
        ],
    },
    "N1": {
        "sections": [
            {"id": "vocabulary_grammar_reading", "labelJp": "言語知識（文字・語彙・文法）・読解", "timeLimitMin": 110, "mondai": [
                {"id": "moji_1", "official_number": 1,  "name_jp": "漢字読み",       "type": "kanji-reading",     "count": 6, "scoring_section": "vocabulary"},
                {"id": "moji_2", "official_number": 2,  "name_jp": "文脈規定",       "type": "vocab-context",     "count": 7, "scoring_section": "vocabulary"},
                {"id": "moji_3", "official_number": 3,  "name_jp": "言い換え類義",   "type": "vocab-paraphrase",  "count": 6, "scoring_section": "vocabulary"},
                {"id": "moji_4", "official_number": 4,  "name_jp": "用法",           "type": "vocab-usage",       "count": 6, "scoring_section": "vocabulary"},
                {"id": "bunpou_5", "official_number": 5, "name_jp": "文の文法1",     "type": "grammar-fill",      "count": 10, "scoring_section": "grammar_reading"},
                {"id": "bunpou_6", "official_number": 6, "name_jp": "文の文法2",     "type": "sentence-order",    "count": 5, "scoring_section": "grammar_reading"},
                {"id": "bunpou_7", "official_number": 7, "name_jp": "文章の文法",    "type": "cloze-passage",     "count": 5, "scoring_section": "grammar_reading"},
                {"id": "dokkai_8", "official_number": 8, "name_jp": "内容理解（短文）", "type": "reading-passage",       "count": 4, "scoring_section": "grammar_reading", "passage_chars": 200},
                {"id": "dokkai_9", "official_number": 9, "name_jp": "内容理解（中文）", "type": "reading-passage",       "count": 9, "scoring_section": "grammar_reading", "passage_chars": 500},
                {"id": "dokkai_10", "official_number": 10, "name_jp": "内容理解（長文）", "type": "reading-passage",      "count": 4, "scoring_section": "grammar_reading", "passage_chars": 1000},
                {"id": "dokkai_11", "official_number": 11, "name_jp": "統合理解",       "type": "integrated-comparison", "count": 3, "scoring_section": "grammar_reading", "passage_chars": 600},
                {"id": "dokkai_12", "official_number": 12, "name_jp": "主張理解（長文）", "type": "reading-passage",      "count": 4, "scoring_section": "grammar_reading", "passage_chars": 1000},
                {"id": "dokkai_13", "official_number": 13, "name_jp": "情報検索",       "type": "table-reading",         "count": 2, "scoring_section": "grammar_reading", "passage_chars": 700},
            ]},
            {"id": "listening", "labelJp": "聴解", "timeLimitMin": 55, "mondai": [
                {"id": "choukai_1", "official_number": 1, "name_jp": "課題理解",   "type": "listening-mcq",         "count": 5, "scoring_section": "listening"},
                {"id": "choukai_2", "official_number": 2, "name_jp": "ポイント理解", "type": "listening-mcq",       "count": 6, "scoring_section": "listening"},
                {"id": "choukai_3", "official_number": 3, "name_jp": "概要理解",   "type": "listening-gist",        "count": 5, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_4", "official_number": 4, "name_jp": "即時応答",   "type": "listening-response",    "count": 11, "scoring_section": "listening", "choice_mode": "audio-only"},
                {"id": "choukai_5", "official_number": 5, "name_jp": "統合理解",   "type": "listening-integrated",  "count": 3, "scoring_section": "listening"},
            ]},
        ],
    },
}


def mondai_spec(level: str, mondai_id: str) -> dict | None:
    for section in LEVEL_BLUEPRINT[level]["sections"]:
        for mondai in section["mondai"]:
            if mondai["id"] == mondai_id:
                return mondai
    return None
