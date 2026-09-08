"""
Complete Kana Data - All modern Japanese kana currently in use.
Includes: Hiragana, Katakana, Yōon (combinations), and special characters.
"""

# ─────────────────────────────────────────────
# HIRAGANA - Basic (gojūon + dakuten + handakuten)
# ─────────────────────────────────────────────

HIRAGANA_BASIC = [
    # Vowels
    {"kana": "あ", "romaji": "a",   "group": "vowels"},
    {"kana": "い", "romaji": "i",   "group": "vowels"},
    {"kana": "う", "romaji": "u",   "group": "vowels"},
    {"kana": "え", "romaji": "e",   "group": "vowels"},
    {"kana": "お", "romaji": "o",   "group": "vowels"},
    # K-row
    {"kana": "か", "romaji": "ka",  "group": "k"},
    {"kana": "き", "romaji": "ki",  "group": "k"},
    {"kana": "く", "romaji": "ku",  "group": "k"},
    {"kana": "け", "romaji": "ke",  "group": "k"},
    {"kana": "こ", "romaji": "ko",  "group": "k"},
    # S-row
    {"kana": "さ", "romaji": "sa",  "group": "s"},
    {"kana": "し", "romaji": "shi", "group": "s"},
    {"kana": "す", "romaji": "su",  "group": "s"},
    {"kana": "せ", "romaji": "se",  "group": "s"},
    {"kana": "そ", "romaji": "so",  "group": "s"},
    # T-row
    {"kana": "た", "romaji": "ta",  "group": "t"},
    {"kana": "ち", "romaji": "chi", "group": "t"},
    {"kana": "つ", "romaji": "tsu", "group": "t"},
    {"kana": "て", "romaji": "te",  "group": "t"},
    {"kana": "と", "romaji": "to",  "group": "t"},
    # N-row
    {"kana": "な", "romaji": "na",  "group": "n"},
    {"kana": "に", "romaji": "ni",  "group": "n"},
    {"kana": "ぬ", "romaji": "nu",  "group": "n"},
    {"kana": "ね", "romaji": "ne",  "group": "n"},
    {"kana": "の", "romaji": "no",  "group": "n"},
    # H-row
    {"kana": "は", "romaji": "ha",  "group": "h"},
    {"kana": "ひ", "romaji": "hi",  "group": "h"},
    {"kana": "ふ", "romaji": "fu",  "group": "h"},
    {"kana": "へ", "romaji": "he",  "group": "h"},
    {"kana": "ほ", "romaji": "ho",  "group": "h"},
    # M-row
    {"kana": "ま", "romaji": "ma",  "group": "m"},
    {"kana": "み", "romaji": "mi",  "group": "m"},
    {"kana": "む", "romaji": "mu",  "group": "m"},
    {"kana": "め", "romaji": "me",  "group": "m"},
    {"kana": "も", "romaji": "mo",  "group": "m"},
    # Y-row
    {"kana": "や", "romaji": "ya",  "group": "y"},
    {"kana": "ゆ", "romaji": "yu",  "group": "y"},
    {"kana": "よ", "romaji": "yo",  "group": "y"},
    # R-row
    {"kana": "ら", "romaji": "ra",  "group": "r"},
    {"kana": "り", "romaji": "ri",  "group": "r"},
    {"kana": "る", "romaji": "ru",  "group": "r"},
    {"kana": "れ", "romaji": "re",  "group": "r"},
    {"kana": "ろ", "romaji": "ro",  "group": "r"},
    # W-row
    {"kana": "わ", "romaji": "wa",  "group": "w"},
    {"kana": "を", "romaji": "wo",  "group": "w"},
    # N
    {"kana": "ん", "romaji": "n",   "group": "n_solo"},
    # G-row (voiced k)
    {"kana": "が", "romaji": "ga",  "group": "g"},
    {"kana": "ぎ", "romaji": "gi",  "group": "g"},
    {"kana": "ぐ", "romaji": "gu",  "group": "g"},
    {"kana": "げ", "romaji": "ge",  "group": "g"},
    {"kana": "ご", "romaji": "go",  "group": "g"},
    # Z-row (voiced s)
    {"kana": "ざ", "romaji": "za",  "group": "z"},
    {"kana": "じ", "romaji": "ji",  "group": "z"},
    {"kana": "ず", "romaji": "zu",  "group": "z"},
    {"kana": "ぜ", "romaji": "ze",  "group": "z"},
    {"kana": "ぞ", "romaji": "zo",  "group": "z"},
    # D-row (voiced t)
    {"kana": "だ", "romaji": "da",  "group": "d"},
    {"kana": "ぢ", "romaji": "ji",  "group": "d"},
    {"kana": "づ", "romaji": "zu",  "group": "d"},
    {"kana": "で", "romaji": "de",  "group": "d"},
    {"kana": "ど", "romaji": "do",  "group": "d"},
    # B-row (voiced h)
    {"kana": "ば", "romaji": "ba",  "group": "b"},
    {"kana": "び", "romaji": "bi",  "group": "b"},
    {"kana": "ぶ", "romaji": "bu",  "group": "b"},
    {"kana": "べ", "romaji": "be",  "group": "b"},
    {"kana": "ぼ", "romaji": "bo",  "group": "b"},
    # P-row (half-voiced h)
    {"kana": "ぱ", "romaji": "pa",  "group": "p"},
    {"kana": "ぴ", "romaji": "pi",  "group": "p"},
    {"kana": "ぷ", "romaji": "pu",  "group": "p"},
    {"kana": "ぺ", "romaji": "pe",  "group": "p"},
    {"kana": "ぽ", "romaji": "po",  "group": "p"},
]

HIRAGANA_COMBINATIONS = [
    # Ki + ya/yu/yo
    {"kana": "きゃ", "romaji": "kya", "group": "k_combo"},
    {"kana": "きゅ", "romaji": "kyu", "group": "k_combo"},
    {"kana": "きょ", "romaji": "kyo", "group": "k_combo"},
    # Shi + ya/yu/yo
    {"kana": "しゃ", "romaji": "sha", "group": "s_combo"},
    {"kana": "しゅ", "romaji": "shu", "group": "s_combo"},
    {"kana": "しょ", "romaji": "sho", "group": "s_combo"},
    # Chi + ya/yu/yo
    {"kana": "ちゃ", "romaji": "cha", "group": "t_combo"},
    {"kana": "ちゅ", "romaji": "chu", "group": "t_combo"},
    {"kana": "ちょ", "romaji": "cho", "group": "t_combo"},
    # Ni + ya/yu/yo
    {"kana": "にゃ", "romaji": "nya", "group": "n_combo"},
    {"kana": "にゅ", "romaji": "nyu", "group": "n_combo"},
    {"kana": "にょ", "romaji": "nyo", "group": "n_combo"},
    # Hi + ya/yu/yo
    {"kana": "ひゃ", "romaji": "hya", "group": "h_combo"},
    {"kana": "ひゅ", "romaji": "hyu", "group": "h_combo"},
    {"kana": "ひょ", "romaji": "hyo", "group": "h_combo"},
    # Mi + ya/yu/yo
    {"kana": "みゃ", "romaji": "mya", "group": "m_combo"},
    {"kana": "みゅ", "romaji": "myu", "group": "m_combo"},
    {"kana": "みょ", "romaji": "myo", "group": "m_combo"},
    # Ri + ya/yu/yo
    {"kana": "りゃ", "romaji": "rya", "group": "r_combo"},
    {"kana": "りゅ", "romaji": "ryu", "group": "r_combo"},
    {"kana": "りょ", "romaji": "ryo", "group": "r_combo"},
    # Gi + ya/yu/yo
    {"kana": "ぎゃ", "romaji": "gya", "group": "g_combo"},
    {"kana": "ぎゅ", "romaji": "gyu", "group": "g_combo"},
    {"kana": "ぎょ", "romaji": "gyo", "group": "g_combo"},
    # Ji + ya/yu/yo
    {"kana": "じゃ", "romaji": "ja",  "group": "z_combo"},
    {"kana": "じゅ", "romaji": "ju",  "group": "z_combo"},
    {"kana": "じょ", "romaji": "jo",  "group": "z_combo"},
    # Bi + ya/yu/yo
    {"kana": "びゃ", "romaji": "bya", "group": "b_combo"},
    {"kana": "びゅ", "romaji": "byu", "group": "b_combo"},
    {"kana": "びょ", "romaji": "byo", "group": "b_combo"},
    # Pi + ya/yu/yo
    {"kana": "ぴゃ", "romaji": "pya", "group": "p_combo"},
    {"kana": "ぴゅ", "romaji": "pyu", "group": "p_combo"},
    {"kana": "ぴょ", "romaji": "pyo", "group": "p_combo"},
]

# ─────────────────────────────────────────────
# KATAKANA - Basic
# ─────────────────────────────────────────────

KATAKANA_BASIC = [
    # Vowels
    {"kana": "ア", "romaji": "a",   "group": "vowels"},
    {"kana": "イ", "romaji": "i",   "group": "vowels"},
    {"kana": "ウ", "romaji": "u",   "group": "vowels"},
    {"kana": "エ", "romaji": "e",   "group": "vowels"},
    {"kana": "オ", "romaji": "o",   "group": "vowels"},
    # K-row
    {"kana": "カ", "romaji": "ka",  "group": "k"},
    {"kana": "キ", "romaji": "ki",  "group": "k"},
    {"kana": "ク", "romaji": "ku",  "group": "k"},
    {"kana": "ケ", "romaji": "ke",  "group": "k"},
    {"kana": "コ", "romaji": "ko",  "group": "k"},
    # S-row
    {"kana": "サ", "romaji": "sa",  "group": "s"},
    {"kana": "シ", "romaji": "shi", "group": "s"},
    {"kana": "ス", "romaji": "su",  "group": "s"},
    {"kana": "セ", "romaji": "se",  "group": "s"},
    {"kana": "ソ", "romaji": "so",  "group": "s"},
    # T-row
    {"kana": "タ", "romaji": "ta",  "group": "t"},
    {"kana": "チ", "romaji": "chi", "group": "t"},
    {"kana": "ツ", "romaji": "tsu", "group": "t"},
    {"kana": "テ", "romaji": "te",  "group": "t"},
    {"kana": "ト", "romaji": "to",  "group": "t"},
    # N-row
    {"kana": "ナ", "romaji": "na",  "group": "n"},
    {"kana": "ニ", "romaji": "ni",  "group": "n"},
    {"kana": "ヌ", "romaji": "nu",  "group": "n"},
    {"kana": "ネ", "romaji": "ne",  "group": "n"},
    {"kana": "ノ", "romaji": "no",  "group": "n"},
    # H-row
    {"kana": "ハ", "romaji": "ha",  "group": "h"},
    {"kana": "ヒ", "romaji": "hi",  "group": "h"},
    {"kana": "フ", "romaji": "fu",  "group": "h"},
    {"kana": "ヘ", "romaji": "he",  "group": "h"},
    {"kana": "ホ", "romaji": "ho",  "group": "h"},
    # M-row
    {"kana": "マ", "romaji": "ma",  "group": "m"},
    {"kana": "ミ", "romaji": "mi",  "group": "m"},
    {"kana": "ム", "romaji": "mu",  "group": "m"},
    {"kana": "メ", "romaji": "me",  "group": "m"},
    {"kana": "モ", "romaji": "mo",  "group": "m"},
    # Y-row
    {"kana": "ヤ", "romaji": "ya",  "group": "y"},
    {"kana": "ユ", "romaji": "yu",  "group": "y"},
    {"kana": "ヨ", "romaji": "yo",  "group": "y"},
    # R-row
    {"kana": "ラ", "romaji": "ra",  "group": "r"},
    {"kana": "リ", "romaji": "ri",  "group": "r"},
    {"kana": "ル", "romaji": "ru",  "group": "r"},
    {"kana": "レ", "romaji": "re",  "group": "r"},
    {"kana": "ロ", "romaji": "ro",  "group": "r"},
    # W-row
    {"kana": "ワ", "romaji": "wa",  "group": "w"},
    {"kana": "ヲ", "romaji": "wo",  "group": "w"},
    # N
    {"kana": "ン", "romaji": "n",   "group": "n_solo"},
    # G-row
    {"kana": "ガ", "romaji": "ga",  "group": "g"},
    {"kana": "ギ", "romaji": "gi",  "group": "g"},
    {"kana": "グ", "romaji": "gu",  "group": "g"},
    {"kana": "ゲ", "romaji": "ge",  "group": "g"},
    {"kana": "ゴ", "romaji": "go",  "group": "g"},
    # Z-row
    {"kana": "ザ", "romaji": "za",  "group": "z"},
    {"kana": "ジ", "romaji": "ji",  "group": "z"},
    {"kana": "ズ", "romaji": "zu",  "group": "z"},
    {"kana": "ゼ", "romaji": "ze",  "group": "z"},
    {"kana": "ゾ", "romaji": "zo",  "group": "z"},
    # D-row
    {"kana": "ダ", "romaji": "da",  "group": "d"},
    {"kana": "ヂ", "romaji": "ji",  "group": "d"},
    {"kana": "ヅ", "romaji": "zu",  "group": "d"},
    {"kana": "デ", "romaji": "de",  "group": "d"},
    {"kana": "ド", "romaji": "do",  "group": "d"},
    # B-row
    {"kana": "バ", "romaji": "ba",  "group": "b"},
    {"kana": "ビ", "romaji": "bi",  "group": "b"},
    {"kana": "ブ", "romaji": "bu",  "group": "b"},
    {"kana": "ベ", "romaji": "be",  "group": "b"},
    {"kana": "ボ", "romaji": "bo",  "group": "b"},
    # P-row
    {"kana": "パ", "romaji": "pa",  "group": "p"},
    {"kana": "ピ", "romaji": "pi",  "group": "p"},
    {"kana": "プ", "romaji": "pu",  "group": "p"},
    {"kana": "ペ", "romaji": "pe",  "group": "p"},
    {"kana": "ポ", "romaji": "po",  "group": "p"},
]

KATAKANA_COMBINATIONS = [
    {"kana": "キャ", "romaji": "kya", "group": "k_combo"},
    {"kana": "キュ", "romaji": "kyu", "group": "k_combo"},
    {"kana": "キョ", "romaji": "kyo", "group": "k_combo"},
    {"kana": "シャ", "romaji": "sha", "group": "s_combo"},
    {"kana": "シュ", "romaji": "shu", "group": "s_combo"},
    {"kana": "ショ", "romaji": "sho", "group": "s_combo"},
    {"kana": "チャ", "romaji": "cha", "group": "t_combo"},
    {"kana": "チュ", "romaji": "chu", "group": "t_combo"},
    {"kana": "チョ", "romaji": "cho", "group": "t_combo"},
    {"kana": "ニャ", "romaji": "nya", "group": "n_combo"},
    {"kana": "ニュ", "romaji": "nyu", "group": "n_combo"},
    {"kana": "ニョ", "romaji": "nyo", "group": "n_combo"},
    {"kana": "ヒャ", "romaji": "hya", "group": "h_combo"},
    {"kana": "ヒュ", "romaji": "hyu", "group": "h_combo"},
    {"kana": "ヒョ", "romaji": "hyo", "group": "h_combo"},
    {"kana": "ミャ", "romaji": "mya", "group": "m_combo"},
    {"kana": "ミュ", "romaji": "myu", "group": "m_combo"},
    {"kana": "ミョ", "romaji": "myo", "group": "m_combo"},
    {"kana": "リャ", "romaji": "rya", "group": "r_combo"},
    {"kana": "リュ", "romaji": "ryu", "group": "r_combo"},
    {"kana": "リョ", "romaji": "ryo", "group": "r_combo"},
    {"kana": "ギャ", "romaji": "gya", "group": "g_combo"},
    {"kana": "ギュ", "romaji": "gyu", "group": "g_combo"},
    {"kana": "ギョ", "romaji": "gyo", "group": "g_combo"},
    {"kana": "ジャ", "romaji": "ja",  "group": "z_combo"},
    {"kana": "ジュ", "romaji": "ju",  "group": "z_combo"},
    {"kana": "ジョ", "romaji": "jo",  "group": "z_combo"},
    {"kana": "ビャ", "romaji": "bya", "group": "b_combo"},
    {"kana": "ビュ", "romaji": "byu", "group": "b_combo"},
    {"kana": "ビョ", "romaji": "byo", "group": "b_combo"},
    {"kana": "ピャ", "romaji": "pya", "group": "p_combo"},
    {"kana": "ピュ", "romaji": "pyu", "group": "p_combo"},
    {"kana": "ピョ", "romaji": "pyo", "group": "p_combo"},
    # 外来音 — the katakana-only sounds, borrowed with the words that
    # needed them. Grouped by the BASE kana rather than all together in
    # one "foreign" bucket: the chart lays a group out as a row and
    # would keep only the first entry per column, so ファ フィ フェ フォ
    # and ヴァ ヴィ ヴ ヴェ ヴォ collided into a single line of four.
    # One group per base kana also makes the row名 honest — テ is the
    # row ティ is in, ト the row トゥ is in — which is the whole lesson
    # here: a full-size kana with a small vowel after it.
    {"kana": "ファ", "romaji": "fa",  "group": "f_foreign"},
    {"kana": "フィ", "romaji": "fi",  "group": "f_foreign"},
    {"kana": "フェ", "romaji": "fe",  "group": "f_foreign"},
    {"kana": "フォ", "romaji": "fo",  "group": "f_foreign"},
    {"kana": "ティ", "romaji": "ti",  "group": "ti_foreign"},
    {"kana": "トゥ", "romaji": "tu",  "group": "tu_foreign"},
    {"kana": "ディ", "romaji": "di",  "group": "di_foreign"},
    {"kana": "ドゥ", "romaji": "du",  "group": "du_foreign"},
    {"kana": "ウィ", "romaji": "wi",  "group": "w_foreign"},
    {"kana": "ウェ", "romaji": "we",  "group": "w_foreign"},
    {"kana": "ウォ", "romaji": "wo",  "group": "w_foreign"},
    {"kana": "ヴァ", "romaji": "va",  "group": "v_foreign"},
    {"kana": "ヴィ", "romaji": "vi",  "group": "v_foreign"},
    {"kana": "ヴ",   "romaji": "vu",  "group": "v_foreign"},
    {"kana": "ヴェ", "romaji": "ve",  "group": "v_foreign"},
    {"kana": "ヴォ", "romaji": "vo",  "group": "v_foreign"},
]

# ─────────────────────────────────────────────
# 長音 — the vowel combinations
# ─────────────────────────────────────────────
# Two kana, one sound held twice as long — and the first thing a
# learner meets that the gojūon chart does not explain: せんせい is not
# "sen-se-i", とうきょう is not "to-u-kyo-u". They are read as ē and ō,
# and the spelling is what has to be recognised.
#
# Grouped by the FIRST vowel, so the chart lays them out the way the
# gojūon table already lays out everything else: the row is what the
# pair starts with, the column is what it ends with (the frontend reads
# the column off the romaji's last letter). Most of that matrix does
# not occur in Japanese and stays empty, which is the useful half of
# drawing it as a matrix.
#
# The nine below are the ones a beginner actually reads: the five
# doubled vowels, the two long spellings that change kana (えい for ē,
# おう for ō), and the two -i diphthongs every adjective ends in (たかい,
# おおい). The romaji is the SPELLING, not the sound — "ou", not "ō" —
# because the spelling is what the card is asking about, and it is
# what a learner types.
HIRAGANA_LONG = [
    {"kana": "ああ", "romaji": "aa", "group": "a_long"},
    {"kana": "あい", "romaji": "ai", "group": "a_long"},
    {"kana": "いい", "romaji": "ii", "group": "i_long"},
    {"kana": "うう", "romaji": "uu", "group": "u_long"},
    {"kana": "えい", "romaji": "ei", "group": "e_long"},
    {"kana": "ええ", "romaji": "ee", "group": "e_long"},
    {"kana": "おい", "romaji": "oi", "group": "o_long"},
    {"kana": "おう", "romaji": "ou", "group": "o_long"},
    {"kana": "おお", "romaji": "oo", "group": "o_long"},
]

# Katakana spells every long vowel with one mark instead — 長音符, the
# bar — so this is one row of five rather than a matrix, and the lesson
# is the bar itself. The romaji doubles the vowel to match the
# hiragana set above, and so the chart can read the column off it.
KATAKANA_LONG = [
    {"kana": "アー", "romaji": "aa", "group": "long"},
    {"kana": "イー", "romaji": "ii", "group": "long"},
    {"kana": "ウー", "romaji": "uu", "group": "long"},
    {"kana": "エー", "romaji": "ee", "group": "long"},
    {"kana": "オー", "romaji": "oo", "group": "long"},
]

# ─────────────────────────────────────────────
# Accessors
# ─────────────────────────────────────────────

# Every set the app knows, in teaching order per syllabary. A set added
# here is a deck (routes/kana.py serves any key in this map), a page of
# the dictionary's own chart (routes/dictionary.py walks the syllabary
# through SYLLABARY_SETS below), and a card in the index
# (study/card_index.py) — all three from this one entry.
KANA_SETS = {
    "hiragana_basic":       HIRAGANA_BASIC,
    "hiragana_combos":      HIRAGANA_COMBINATIONS,
    "hiragana_long":        HIRAGANA_LONG,
    "katakana_basic":       KATAKANA_BASIC,
    "katakana_combos":      KATAKANA_COMBINATIONS,
    "katakana_long":        KATAKANA_LONG,
}

# The sets that make up one syllabary, in chart order. The dictionary
# reads a whole syllabary through this rather than naming BASIC alone,
# which is why きゃ and えい could not be looked up at all before.
SYLLABARY_SETS = {
    "hiragana": ("hiragana_basic", "hiragana_combos", "hiragana_long"),
    "katakana": ("katakana_basic", "katakana_combos", "katakana_long"),
}


def get_syllabary(name: str) -> list[dict]:
    """Every kana of one syllabary — basic, yōon, and the long vowels."""
    out: list[dict] = []
    for key in SYLLABARY_SETS.get(name, ()):
        out.extend(KANA_SETS[key])
    return out

def get_all_kana() -> list[dict]:
    result = []
    for items in KANA_SETS.values():
        result.extend(items)
    return result

def get_kana_by_set(set_name: str) -> list[dict]:
    return KANA_SETS.get(set_name, [])

def kana_to_id(kana_entry: dict) -> str:
    return f"kana_{kana_entry['kana']}"