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
    # Katakana-only foreign sound combinations
    {"kana": "ファ", "romaji": "fa",  "group": "foreign"},
    {"kana": "フィ", "romaji": "fi",  "group": "foreign"},
    {"kana": "フェ", "romaji": "fe",  "group": "foreign"},
    {"kana": "フォ", "romaji": "fo",  "group": "foreign"},
    {"kana": "ティ", "romaji": "ti",  "group": "foreign"},
    {"kana": "ディ", "romaji": "di",  "group": "foreign"},
    {"kana": "トゥ", "romaji": "tu",  "group": "foreign"},
    {"kana": "ドゥ", "romaji": "du",  "group": "foreign"},
    {"kana": "ウィ", "romaji": "wi",  "group": "foreign"},
    {"kana": "ウェ", "romaji": "we",  "group": "foreign"},
    {"kana": "ウォ", "romaji": "wo",  "group": "foreign"},
    {"kana": "ヴァ", "romaji": "va",  "group": "foreign"},
    {"kana": "ヴィ", "romaji": "vi",  "group": "foreign"},
    {"kana": "ヴ",   "romaji": "vu",  "group": "foreign"},
    {"kana": "ヴェ", "romaji": "ve",  "group": "foreign"},
    {"kana": "ヴォ", "romaji": "vo",  "group": "foreign"},
]

# ─────────────────────────────────────────────
# Accessors
# ─────────────────────────────────────────────

ALL_KANA = {
    "hiragana_basic":       HIRAGANA_BASIC,
    "hiragana_combos":      HIRAGANA_COMBINATIONS,
    "katakana_basic":       KATAKANA_BASIC,
    "katakana_combos":      KATAKANA_COMBINATIONS,
}

KANA_SETS = {
    "Hiragana (de base)":       HIRAGANA_BASIC,
    "Hiragana (combinaisons)":  HIRAGANA_COMBINATIONS,
    "Katakana (de base)":       KATAKANA_BASIC,
    "Katakana (combinaisons)":  KATAKANA_COMBINATIONS,
}

def get_all_kana() -> list[dict]:
    result = []
    for items in ALL_KANA.values():
        result.extend(items)
    return result

def get_kana_by_set(set_name: str) -> list[dict]:
    return KANA_SETS.get(set_name, [])

def kana_to_id(kana_entry: dict) -> str:
    return f"kana_{kana_entry['kana']}"