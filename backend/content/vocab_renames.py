"""
What became of every vocab card id the deck used to serve (plan 091).

A vocab card id is `vocab_{level}_{kanji}_{kana}`
(content/vocab_data.vocab_to_id), so BOTH surface fields are part of the
learner's progress: correct one of them and every row keyed by the old id
is orphaned. 34 entries needed correcting, all of them residue of one
spreadsheet export that landed in the deck:

  * 17 entries carried the word in `kanji` and a part-of-speech or sense
    note in `kana` — `{"kanji": "すみません", "kana": "（感）"}`. The note is
    not a reading, so `vocab.word_reading` quizzed the learner on it and
    graded the real answer wrong.
  * 15 entries carried the word in BOTH fields —
    `{"kanji": "この", "kana": "この"}`. Prompt equalled answer under
    `word_reading`, the case study/modes.eligible_for exists to exclude
    (it tests the `kanji` field for emptiness, which these defeat).
  * 2 more parked a note where the reading belongs: an okurigana bracket
    (`あたたか(い)`) and a synonym gloss (`あげる (=やる)`).

All 34 now follow the convention the other 1,097 kana-only entries
already use: `kanji` is empty and `kana` holds the word. No level moved
and no id collides with one the deck already served, so every rename is
one hop onto an id that was new.

MOVES maps old raw id -> new raw id, and scripts/migrate_vocab_ids.py
renames the learner's rows. KEY_MOVES is the same 34 entries as
"{kanji}::{kana}" deck keys, which is what frequency_overrides.item_key
holds for domain='vocab' (see content/frequency_data.py's resolve()).

A card that has nowhere to go is RETIRED instead: it leaves the deck, and
the migration drops its schedule and whatever names it, but not the
learner's review history (see RETIRED below). That is for residue that
was never a word. A real word leaving the deck always has a card to move
to. A row whose id is in none of the live deck, MOVES and RETIRED is
content drift from before this table existed; the migration reports it
and leaves it exactly as it is, the way migrate_jmdict_card_ids.py does.
"""

# old raw id -> new raw id
MOVES: dict[str, str] = {
    # ── The word in `kanji`, a （...）note in `kana` ──────────────
    "vocab_N3_すみません_（感）": "vocab_N5__すみません",
    "vocab_N3_しまい_（終わり）": "vocab_N3__しまい",
    "vocab_N3_しまう_（終わる）": "vocab_N3__しまう",
    "vocab_N3_ね_（感）": "vocab_N3__ね",
    # The note was truncated mid-cell by the export's own comma split
    # ("（1000" with no closing bracket) — the clearest fingerprint of
    # the whole family.
    "vocab_N3_とん_（1000": "vocab_N3__トン",
    "vocab_N3_できる_（可能。出現。発生）": "vocab_N5__できる",
    "vocab_N3_はい_（感）": "vocab_N5__はい",
    "vocab_N3_どう_（接。副）": "vocab_N5__どう",
    "vocab_N3_それ_（接。感）": "vocab_N5__それ",
    "vocab_N3_しまった_（感）": "vocab_N3__しまった",
    "vocab_N3_うん_（感）": "vocab_N4__うん",
    "vocab_N3_よろしく_（感）": "vocab_N3__よろしく",
    "vocab_N3_ふと_（副）": "vocab_N3__ふと",
    "vocab_N2_だいいち_（副）": "vocab_N2__だいいち",
    "vocab_N2_じゅうたん_（カーペット）": "vocab_N2__じゅうたん",
    "vocab_N2_しいんと_（する）": "vocab_N2__しいんと",
    "vocab_N2_ミリ_（メートル）": "vocab_N2__ミリ",
    # ── The word in both fields ──────────────────────────────────
    "vocab_N3_したがって_したがって": "vocab_N3__したがって",
    "vocab_N3_すると_すると": "vocab_N4__すると",
    "vocab_N3_この_この": "vocab_N5__この",
    "vocab_N3_どれ_どれ": "vocab_N5__どれ",
    "vocab_N3_だから_だから": "vocab_N4__だから",
    "vocab_N3_そこ_そこ": "vocab_N5__そこ",
    "vocab_N3_では_では": "vocab_N5__では",
    "vocab_N3_うまい_うまい": "vocab_N4__うまい",
    "vocab_N3_いつも_いつも": "vocab_N5__いつも",
    "vocab_N3_その_その": "vocab_N5__その",
    "vocab_N3_そう_そう": "vocab_N4__そう",
    "vocab_N3_ここ_ここ": "vocab_N5__ここ",
    "vocab_N3_いえ_いえ": "vocab_N3__いえ",
    "vocab_N3_でも_でも": "vocab_N5__でも",
    "vocab_N2_こうして_こうして": "vocab_N2__こうして",
    # ── A note where the reading belongs ─────────────────────────
    "vocab_N3_暖かい_あたたか(い)": "vocab_N5_暖かい_あたたかい",
    "vocab_N2__あげる (=やる)": "vocab_N5_上げる_あげる",
    # ── Plan 106: one spelling, one reading field, no する in it ─
    # The N5 掃除 carried its する in the reading; the N5 見る had two
    # spellings in one written-form field, so its lemma key was neither
    # and every 見る badged as the N3 card; the N5 十 joined its two
    # readings with a space, which nothing splits.
    "vocab_N5_掃除_そうじする": "vocab_N5_掃除_そうじ",
    "vocab_N5_見る 観る_みる": "vocab_N5_見る_みる",
    "vocab_N5_十_じゅう とお": "vocab_N5_十_じゅう/とお",
    # ── Plan 108: a mojibake in a written form ───────────────────
    # The N2 たいりつ was exported as "Ͼ立", a Greek letter where 対
    # belongs. Same level; the N1 対立 is a different card and stays.
    "vocab_N2_Ͼ立_たいりつ": "vocab_N2_対立_たいりつ",
    # ── Plan 106b: one card per (form, reading), at the lower level ─
    # Nineteen of plan 091's lines above (この, その, どう, できる...) used
    # to land on the N3 and N2 ids merged here, and a MOVE is one hop,
    # never a chain: they now point straight at the lower card, the same
    # place two hops would have reached.
    # 26 entries were the same word twice, at two levels (この at N5 and
    # N3, できる, いつも, 掃除 after 106, 対立 after 108...), so a learner
    # met the card again as "new" at the higher level. The lower card
    # stays, its gloss the union of both; the higher one's rows merge
    # into it. These are the first MOVES that change a level, which is
    # why scripts/migrate_vocab_ids.py now rewrites deck_cards.level
    # from the target id.
    "vocab_N3__どう": "vocab_N5__どう",
    "vocab_N3_掃除_そうじ": "vocab_N5_掃除_そうじ",
    "vocab_N3__でも": "vocab_N5__でも",
    "vocab_N3__はい": "vocab_N5__はい",
    "vocab_N3__この": "vocab_N5__この",
    "vocab_N3__その": "vocab_N5__その",
    "vocab_N3__ここ": "vocab_N5__ここ",
    "vocab_N3__いつも": "vocab_N5__いつも",
    "vocab_N3__できる": "vocab_N5__できる",
    "vocab_N3__どれ": "vocab_N5__どれ",
    "vocab_N3_見る_みる": "vocab_N5_見る_みる",
    "vocab_N3__では": "vocab_N5__では",
    "vocab_N3__そこ": "vocab_N5__そこ",
    "vocab_N3_暖かい_あたたかい": "vocab_N5_暖かい_あたたかい",
    "vocab_N3__それ": "vocab_N5__それ",
    "vocab_N2__けれど/けれども": "vocab_N4__けれど/けれども",
    "vocab_N3__だから": "vocab_N4__だから",
    "vocab_N3__すると": "vocab_N4__すると",
    "vocab_N2__あげる": "vocab_N5_上げる_あげる",
    "vocab_N3__うん": "vocab_N4__うん",
    "vocab_N3__うまい": "vocab_N4__うまい",
    "vocab_N3__そう": "vocab_N4__そう",
    "vocab_N1__しまった": "vocab_N3__しまった",
    "vocab_N1__しいんと": "vocab_N2__しいんと",
    "vocab_N1_対立_たいりつ": "vocab_N2_対立_たいりつ",
    "vocab_N1__ミリ": "vocab_N2__ミリ",
    # ── Plan 112: one word, one card, whatever its spelling ─────
    # 106b merged the pairs that shared both fields. These share the
    # word and not the fields, so nothing caught them, and a learner met
    # the word again as "new" at the higher level -- 十 twice, 終わる
    # twice, 此れ after これ. Same rule as 106b: one card, at the lower
    # level, its gloss the union where the union reads as a gloss, the
    # other ids moved onto it. Two cards that write one reading with
    # DIFFERENT kanji (会う/遭う, 計る/量る/測る, 川/河) are different
    # written words and stay; so, for now, does a kana card below a kanji
    # card JMdict does not mark as usually kana (いす N5 / 椅子 N3).
    # scripts/audit_vocab_deck's spelling_pairs is the guard.
    # A reading the lower card already packs: the N3 十 read じゅう and
    # the N3 十 read とお beside the N5 十 read じゅう/とお.
    "vocab_N3_十_とお": "vocab_N5_十_じゅう/とお",
    "vocab_N3_十_じゅう": "vocab_N5_十_じゅう/とお",
    "vocab_N3_何_なん": "vocab_N5_何_なん/なに",
    "vocab_N3_何_なに": "vocab_N5_何_なん/なに",
    "vocab_N3_二十_はたち": "vocab_N5_二十歳_はたち",
    # The same kana word twice: いい and よい beside いい/よい, やはり and
    # やっぱり beside やはり/やっぱり, a variant katakana spelling (インキ,
    # ウェートレス) beside the card that holds the word.
    "vocab_N3__いい": "vocab_N5__いい/よい",
    "vocab_N3__よい": "vocab_N5__いい/よい",
    "vocab_N3__じゃあ": "vocab_N5__じゃ/じゃあ",
    "vocab_N3__キロ": "vocab_N5__キロ/キログラム",
    "vocab_N3__コンピューター": "vocab_N4__コンピュータ/コンピューター",
    "vocab_N1__けれど": "vocab_N4__けれど/けれども",
    "vocab_N2__リポート": "vocab_N4__レポート/リポート",
    "vocab_N3__レポート": "vocab_N4__レポート/リポート",
    "vocab_N1_矢っ張り_やっぱり": "vocab_N4__やはり/やっぱり",
    "vocab_N2__やっぱり": "vocab_N4__やはり/やっぱり",
    "vocab_N3__やはり": "vocab_N4__やはり/やっぱり",
    "vocab_N2__インキ": "vocab_N3__インク",
    "vocab_N1__アイデア": "vocab_N2__アイデア/アイディア",
    "vocab_N1__ウェートレス": "vocab_N2__ウエートレス",
    "vocab_N2__レクリェーション": "vocab_N2__レクリエーション",
    "vocab_N1__レクリエーション": "vocab_N2__レクリエーション",
    # One word in two kanji spellings -- okurigana (終る/終わる), 御/ご,
    # 々, a kanji written out in kana (見付かる/見つかる, 再来年/さ来年).
    # The survivor keeps the lower card's spelling unless that spelling
    # is the nonstandard okurigana of the two (the N5 終る, the N4 落る),
    # when it takes the one JMdict lists first -- so the lower id moves
    # too and KEY_MOVES carries its pin. 御馳走 keeps 御: UniDic's lemma
    # for ご + ちそう is 御馳走, which is what the compound fold looks up.
    "vocab_N3_曇_くもり": "vocab_N5_曇り_くもり",
    "vocab_N1_終わる_おわる": "vocab_N5_終わる_おわる",
    "vocab_N5_終る_おわる": "vocab_N5_終わる_おわる",
    "vocab_N1_御手洗い_おてあらい": "vocab_N5_お手洗い_おてあらい",
    "vocab_N5_曲る_まがる": "vocab_N5_曲がる_まがる",
    "vocab_N1_曲がる_まがる": "vocab_N5_曲がる_まがる",
    "vocab_N3_後_うしろ": "vocab_N5_後ろ_うしろ",
    "vocab_N5_明い_あかるい": "vocab_N5_明るい_あかるい",
    "vocab_N1_明るい_あかるい": "vocab_N5_明るい_あかるい",
    "vocab_N2_分る_わかる": "vocab_N5_分かる_わかる",
    "vocab_N2_再来年_さらいねん": "vocab_N5_さ来年_さらいねん",
    "vocab_N2_再来月_さらいげつ": "vocab_N4_さ来月_さらいげつ",
    "vocab_N2_再来週_さらいしゅう": "vocab_N4_さ来週_さらいしゅう",
    "vocab_N2_出掛ける_でかける": "vocab_N5_出かける_でかける",
    "vocab_N1_身体_からだ": "vocab_N5_体_からだ",
    "vocab_N4_落る_おちる": "vocab_N4_落ちる_おちる",
    "vocab_N1_落ちる_おちる": "vocab_N4_落ちる_おちる",
    "vocab_N4_落す_おとす": "vocab_N4_落とす_おとす",
    "vocab_N1_落とす_おとす": "vocab_N4_落とす_おとす",
    "vocab_N2_引出す_ひきだす": "vocab_N4_引き出す_ひきだす",
    "vocab_N4_楽む_たのしむ": "vocab_N4_楽しむ_たのしむ",
    "vocab_N1_楽しむ_たのしむ": "vocab_N4_楽しむ_たのしむ",
    "vocab_N1_決まる_きまる": "vocab_N4_決まる_きまる",
    "vocab_N4_決る_きまる": "vocab_N4_決まる_きまる",
    "vocab_N4_起す_おこす": "vocab_N4_起こす_おこす",
    "vocab_N1_起こす_おこす": "vocab_N4_起こす_おこす",
    "vocab_N3_終_おわり": "vocab_N4_終わり_おわり",
    "vocab_N1_上がる_あがる": "vocab_N4_上がる_あがる",
    "vocab_N4_上る_あがる": "vocab_N4_上がる_あがる",
    "vocab_N4_集る_あつまる": "vocab_N4_集まる_あつまる",
    "vocab_N1_集まる_あつまる": "vocab_N4_集まる_あつまる",
    "vocab_N1_答え_こたえ": "vocab_N4_答え_こたえ",
    "vocab_N4_答_こたえ": "vocab_N4_答え_こたえ",
    "vocab_N2_向う_むかう": "vocab_N4_向かう_むかう",
    "vocab_N1_下がる_さがる": "vocab_N4_下がる_さがる",
    "vocab_N4_下る_さがる": "vocab_N4_下がる_さがる",
    "vocab_N1_久し振り_ひさしぶり": "vocab_N4_久しぶり_ひさしぶり",
    "vocab_N3_彼等_かれら": "vocab_N4_彼ら_かれら",
    "vocab_N2_見付かる_みつかる": "vocab_N4_見つかる_みつかる",
    "vocab_N2_見付ける_みつける": "vocab_N4_見つける_みつける",
    "vocab_N3_或_ある": "vocab_N3_或る_ある",
    "vocab_N1_或る_ある": "vocab_N3_或る_ある",
    "vocab_N1_見舞_みまい": "vocab_N3_見舞い_みまい",
    "vocab_N1_係り_かかり": "vocab_N3_係_かかり",
    "vocab_N1_現われ_あらわれ": "vocab_N3_現れ_あらわれ",
    "vocab_N1_現われる_あらわれる": "vocab_N3_現れる_あらわれる",
    "vocab_N1_釣り_つり": "vocab_N3_釣り_つり",
    "vocab_N3_釣_つり": "vocab_N3_釣り_つり",
    "vocab_N3_年寄_としより": "vocab_N3_年寄り_としより",
    "vocab_N1_年寄り_としより": "vocab_N3_年寄り_としより",
    "vocab_N1_ご馳走_ごちそう": "vocab_N2_御馳走_ごちそう",
    "vocab_N1_ご無沙汰_ごぶさた": "vocab_N2_御無沙汰_ごぶさた",
    "vocab_N2_押える_おさえる": "vocab_N2_押さえる_おさえる",
    "vocab_N1_押さえる_おさえる": "vocab_N2_押さえる_おさえる",
    "vocab_N1_浮かぶ_うかぶ": "vocab_N2_浮かぶ_うかぶ",
    "vocab_N2_浮ぶ_うかぶ": "vocab_N2_浮かぶ_うかぶ",
    "vocab_N2_受取_うけとり": "vocab_N2_受け取り_うけとり",
    "vocab_N1_受け取り_うけとり": "vocab_N2_受け取り_うけとり",
    "vocab_N1_剥がす_はがす": "vocab_N2_剥がす_はがす",
    "vocab_N2_剥す_はがす": "vocab_N2_剥がす_はがす",
    "vocab_N2_打合せ_うちあわせ": "vocab_N2_打ち合わせ_うちあわせ",
    "vocab_N1_打ち合わせ_うちあわせ": "vocab_N2_打ち合わせ_うちあわせ",
    "vocab_N1_締め切り_しめきり": "vocab_N2_締め切り_しめきり",
    "vocab_N2_締切_しめきり": "vocab_N2_締め切り_しめきり",
    "vocab_N1_知り合い_しりあい": "vocab_N2_知り合い_しりあい",
    "vocab_N2_知合い_しりあい": "vocab_N2_知り合い_しりあい",
    "vocab_N1_果たして_はたして": "vocab_N2_果たして_はたして",
    "vocab_N2_果して_はたして": "vocab_N2_果たして_はたして",
    "vocab_N1_物置き_ものおき": "vocab_N2_物置_ものおき",
    "vocab_N2_乗換_のりかえ": "vocab_N2_乗り換え_のりかえ",
    "vocab_N1_乗り換え_のりかえ": "vocab_N2_乗り換え_のりかえ",
    "vocab_N2_代る_かわる": "vocab_N2_代わる_かわる",
    "vocab_N1_代わる_かわる": "vocab_N2_代わる_かわる",
    "vocab_N1_組み合わせ_くみあわせ": "vocab_N2_組み合わせ_くみあわせ",
    "vocab_N2_組合せ_くみあわせ": "vocab_N2_組み合わせ_くみあわせ",
    "vocab_N1_錆び_さび": "vocab_N2_錆_さび",
    "vocab_N2_引分け_ひきわけ": "vocab_N2_引き分け_ひきわけ",
    "vocab_N1_引き分け_ひきわけ": "vocab_N2_引き分け_ひきわけ",
    "vocab_N1_歯磨_はみがき": "vocab_N2_歯磨き_はみがき",
    "vocab_N2_出入口_でいりぐち": "vocab_N2_出入り口_でいりぐち",
    "vocab_N1_出入り口_でいりぐち": "vocab_N2_出入り口_でいりぐち",
    "vocab_N2_話合い_はなしあい": "vocab_N2_話し合い_はなしあい",
    "vocab_N1_話し合い_はなしあい": "vocab_N2_話し合い_はなしあい",
    "vocab_N1_付き合う_つきあう": "vocab_N2_付き合う_つきあう",
    "vocab_N2_付合う_つきあう": "vocab_N2_付き合う_つきあう",
    "vocab_N1_俄か_にわか": "vocab_N2_俄_にわか",
    "vocab_N1_先先月_せんせんげつ": "vocab_N2_先々月_せんせんげつ",
    "vocab_N2_割算_わりざん": "vocab_N2_割り算_わりざん",
    "vocab_N1_割り算_わりざん": "vocab_N2_割り算_わりざん",
    "vocab_N1_書き取り_かきとり": "vocab_N2_書き取り_かきとり",
    "vocab_N2_書取_かきとり": "vocab_N2_書き取り_かきとり",
    "vocab_N2_坊っちゃん_ぼっちゃん": "vocab_N2_坊ちゃん_ぼっちゃん",
    "vocab_N1_坊ちゃん_ぼっちゃん": "vocab_N2_坊ちゃん_ぼっちゃん",
    "vocab_N1_売れ行き_うれゆき": "vocab_N2_売れ行き_うれゆき",
    "vocab_N2_売行き_うれゆき": "vocab_N2_売れ行き_うれゆき",
    "vocab_N2_引受る_ひきうける": "vocab_N2_引き受ける_ひきうける",
    "vocab_N1_引き受ける_ひきうける": "vocab_N2_引き受ける_ひきうける",
    "vocab_N1_吊るす_つるす": "vocab_N2_吊るす_つるす",
    "vocab_N2_吊す_つるす": "vocab_N2_吊るす_つるす",
    "vocab_N2_捕える_とらえる": "vocab_N2_捕らえる_とらえる",
    "vocab_N1_捕らえる_とらえる": "vocab_N2_捕らえる_とらえる",
    "vocab_N1_割引き_わりびき": "vocab_N2_割引_わりびき",
    "vocab_N1_通りかかる_とおりかかる": "vocab_N2_通り掛かる_とおりかかる",
    "vocab_N1_間もなく_まもなく": "vocab_N2_間も無く_まもなく",
    "vocab_N1_各_おのおの": "vocab_N2_各々_おのおの",
    "vocab_N1_兆_きざし": "vocab_N1_兆し_きざし",
    "vocab_N4_真中_まんなか": "vocab_N4_真ん中_まんなか",
    "vocab_N1_真ん中_まんなか": "vocab_N4_真ん中_まんなか",
    # A written form that does not spell its reading: the N5 誰 read
    # だれか is 誰か, and the N4 お・金持ち carried a ・ in the field. The
    # card takes the spelling of the higher card that had it right, and
    # that card folds in.
    "vocab_N3_誰か_だれか": "vocab_N5_誰か_だれか",
    "vocab_N5_誰_だれか": "vocab_N5_誰か_だれか",
    "vocab_N4_お・金持ち_かねもち/おかねもち": "vocab_N4_金持ち_かねもち",
    "vocab_N3_金持ち_かねもち": "vocab_N4_金持ち_かねもち",
    # Two spellings packed into one written-form field (川/河, 丸い/円い,
    # 作る/造る): the lemma index keys on the whole field, so 川 in a
    # sentence never met the N5 card and badged the N3 川 instead --
    # plan 106's 見る 観る, eight more times. The card keeps its first
    # spelling and the higher card with that spelling folds in; the card
    # with the other kanji (河, 円い, 造る, 始め, 叔母さん, 叔父さん) is a
    # written word of its own and stays. Two of the eight held the kanji
    # of おじ on another word: 伯父/叔父 read おじさん is 伯父さん, and
    # 伯父/叔父 read おじいさん -- grandfather -- is the kana word.
    "vocab_N3_川_かわ": "vocab_N5_川_かわ",
    "vocab_N5_川/河_かわ": "vocab_N5_川_かわ",
    "vocab_N5_丸い/円い_まるい": "vocab_N5_丸い_まるい",
    "vocab_N3_丸い_まるい": "vocab_N5_丸い_まるい",
    "vocab_N5_初め/始め_はじめ": "vocab_N5_初め_はじめ",
    "vocab_N2_伯母さん_おばさん": "vocab_N5_伯母さん_おばさん",
    "vocab_N5_伯母さん/叔母さん_おばさん": "vocab_N5_伯母さん_おばさん",
    "vocab_N5_伯父/叔父_おじさん": "vocab_N5_伯父さん_おじさん",
    "vocab_N2_伯父さん_おじさん": "vocab_N5_伯父さん_おじさん",
    "vocab_N5_伯父/叔父_おじいさん": "vocab_N5__おじいさん",
    "vocab_N1_お祖父さん_おじいさん": "vocab_N5__おじいさん",
    "vocab_N3__おじいさん": "vocab_N5__おじいさん",
    "vocab_N2_固い_かたい": "vocab_N4_固い_かたい",
    "vocab_N4_堅/硬/固い_かたい": "vocab_N4_固い_かたい",
    "vocab_N2_作る/造る_つくる": "vocab_N5_作る_つくる",
    # Two cards for ただ at N3, one of them spelled 唯, which JMdict
    # marks as usually written in kana.
    "vocab_N3_唯_ただ": "vocab_N3__ただ",
    "vocab_N2_只_ただ": "vocab_N3__ただ",
    # A kana card above the kanji card of its own word (あした at N3,
    # 明日 at N5): the lower card stays as it is written, and its reading
    # was always the kana one. The N4 あげる goes into the N5 上げる this
    # way, which is why plan 091's two あげる lines above point at 上げる
    # now: a move is one hop.
    "vocab_N3__うるさい": "vocab_N5_煩い_うるさい",
    "vocab_N1_五月蝿い_うるさい": "vocab_N5_煩い_うるさい",
    "vocab_N2__おととし": "vocab_N5_一昨年_おととし",
    "vocab_N2__おくさん": "vocab_N5_奥さん_おくさん",
    "vocab_N4__あげる": "vocab_N5_上げる_あげる",
    "vocab_N3__あした": "vocab_N5_明日_あした",
    "vocab_N2__おととい": "vocab_N5_一昨日_おととい",
    "vocab_N3__すごい": "vocab_N4_凄い_すごい",
    "vocab_N3__おや": "vocab_N4_親_おや",
    "vocab_N2__あかんぼう": "vocab_N4_赤ん坊_あかんぼう",
    "vocab_N3__なかなか": "vocab_N4_中々_なかなか",
    "vocab_N2__へる": "vocab_N3_減る_へる",
    # A kanji spelling JMdict marks "usually written in kana", a level or
    # more above the kana card of the same word: 此れ at N1 beside これ
    # at N5, 美味しい at N1 beside おいしい at N5 -- the old level-1 list
    # spelling out the N5 words in kanji nobody writes. The kana card
    # stays; the dictionary and the breakdown still find the kanji
    # spelling through FOLDED_FORMS below. こと (N4) and 事 (N3) are left
    # apart on purpose: resolve_kana never resolves a bare こと (the
    # nominaliser), so the fold would take every 事's badge with it.
    "vocab_N3_皆_みんな": "vocab_N5__みんな",
    "vocab_N1_何故_なぜ": "vocab_N5__なぜ",
    "vocab_N3_成る_なる": "vocab_N5__なる",
    "vocab_N1_恰度_ちょうど": "vocab_N5__ちょうど",
    "vocab_N3_未だ_まだ": "vocab_N5__まだ",
    "vocab_N1_然し_しかし": "vocab_N5__しかし",
    "vocab_N2_点ける_つける": "vocab_N5__つける",
    "vocab_N1_彼処_あそこ": "vocab_N5__あそこ",
    "vocab_N1_彼方_あちら": "vocab_N5__あちら",
    "vocab_N3_余り_あまり": "vocab_N5__あまり",
    "vocab_N1_余り_あんまり": "vocab_N3__あんまり",
    "vocab_N1_何時_いつ": "vocab_N5__いつ",
    "vocab_N1_遣る_やる": "vocab_N5__やる",
    "vocab_N1_美味しい_おいしい": "vocab_N5__おいしい",
    "vocab_N1_如何して_どうして": "vocab_N5__どうして",
    "vocab_N1_彼の_あの": "vocab_N5__あの",
    "vocab_N1_何処_どこ": "vocab_N5__どこ",
    "vocab_N1_此の_この": "vocab_N5__この",
    "vocab_N1_可愛い_かわいい": "vocab_N5__かわいい",
    "vocab_N1_其方_そちら": "vocab_N5__そちら",
    "vocab_N1_段々_だんだん": "vocab_N5__だんだん",
    "vocab_N1_何時も_いつも": "vocab_N5__いつも",
    "vocab_N1_何の_どの": "vocab_N5__どの",
    "vocab_N1_此れ_これ": "vocab_N5__これ",
    "vocab_N1_何れ_どれ": "vocab_N5__どれ",
    "vocab_N1_色々_いろいろ": "vocab_N5__いろいろ",
    "vocab_N1_迚も_とても": "vocab_N5__とても",
    "vocab_N1_如何_いかが": "vocab_N5__いかが",
    "vocab_N1_お祖母さん_おばあさん": "vocab_N5__おばあさん",
    "vocab_N3_等_など": "vocab_N5__など",
    "vocab_N1_其処_そこ": "vocab_N5__そこ",
    "vocab_N1_一寸_ちょっと": "vocab_N5__ちょっと",
    "vocab_N1_不味い_まずい": "vocab_N5__まずい",
    "vocab_N3_有る_ある": "vocab_N5__ある",
    "vocab_N2_在る_ある": "vocab_N5__ある",
    "vocab_N3_幾つ_いくつ": "vocab_N5__いくつ",
    "vocab_N1_貴女_あなた": "vocab_N5__あなた",
    "vocab_N1_詰らない_つまらない": "vocab_N5__つまらない",
    "vocab_N1_其れ_それ": "vocab_N5__それ",
    "vocab_N1_沢山_たくさん": "vocab_N5__たくさん",
    "vocab_N3_真っ直ぐ_まっすぐ": "vocab_N5__まっすぐ",
    "vocab_N3_幾ら_いくら": "vocab_N5__いくら",
    "vocab_N1_煙草_たばこ": "vocab_N5__たばこ",
    "vocab_N2_又は_または": "vocab_N4__または",
    "vocab_N1_為さる_なさる": "vocab_N4__なさる",
    "vocab_N1_屹度_きっと": "vocab_N4__きっと",
    "vocab_N1_若し_もし": "vocab_N4__もし",
    "vocab_N3_宜しい_よろしい": "vocab_N4__よろしい",
    "vocab_N1_筈_はず": "vocab_N4__はず",
    "vocab_N1_苛める_いじめる": "vocab_N4__いじめる",
    "vocab_N1_其れに_それに": "vocab_N4__それに",
    "vocab_N1_玩具_おもちゃ": "vocab_N4__おもちゃ",
    "vocab_N2_掏摸_すり": "vocab_N4__すり",
    "vocab_N3_貰う_もらう": "vocab_N4__もらう",
    "vocab_N3_程_ほど": "vocab_N4__ほど",
    "vocab_N3_大抵_たいてい": "vocab_N4__たいてい",
    "vocab_N1_殆ど_ほとんど": "vocab_N4__ほとんど",
    "vocab_N1_積もり_つもり": "vocab_N4__つもり",
    "vocab_N1_偶に_たまに": "vocab_N4__たまに",
    "vocab_N1_成るべく_なるべく": "vocab_N4__なるべく",
    "vocab_N3_勿論_もちろん": "vocab_N4__もちろん",
    "vocab_N3_頂く_いただく": "vocab_N4__いただく",
    "vocab_N1_呉れる_くれる": "vocab_N4__くれる",
    "vocab_N3_駄目_だめ": "vocab_N4__だめ",
    "vocab_N1_些とも_ちっとも": "vocab_N4__ちっとも",
    "vocab_N1_お出でになる_おいでになる": "vocab_N4__おいでになる",
    "vocab_N1_確り_しっかり": "vocab_N4__しっかり",
    "vocab_N3_随分_ずいぶん": "vocab_N4__ずいぶん",
    "vocab_N1_酷い_ひどい": "vocab_N4__ひどい",
    "vocab_N1_甘い_うまい": "vocab_N4__うまい",
    "vocab_N2_髭_ひげ": "vocab_N4__ひげ",
    "vocab_N1_暫く_しばらく": "vocab_N4__しばらく",
    "vocab_N3_下さる_くださる": "vocab_N4__くださる",
    "vocab_N1_其れで_それで": "vocab_N4__それで",
    "vocab_N1_何時までも_いつまでも": "vocab_N3__いつまでも",
    "vocab_N1_何時か_いつか": "vocab_N3__いつか",
    "vocab_N1_済みません_すみません": "vocab_N5__すみません",
    "vocab_N1_詰まり_つまり": "vocab_N3__つまり",
    "vocab_N1_屡_しばしば": "vocab_N3__しばしば",
    "vocab_N1_仕舞う_しまう": "vocab_N3__しまう",
    "vocab_N1_従って_したがって": "vocab_N3__したがって",
    "vocab_N1_其れでも_それでも": "vocab_N3__それでも",
    "vocab_N1_兎に角_とにかく": "vocab_N3__とにかく",
    "vocab_N1_吃驚_びっくり": "vocab_N4__びっくり",
    "vocab_N1_凡ゆる_あらゆる": "vocab_N3__あらゆる",
    "vocab_N1_即ち_すなわち": "vocab_N3__すなわち",
    "vocab_N1_其れ共_それとも": "vocab_N3__それとも",
    "vocab_N1_彼方此方_あちこち": "vocab_N3__あちこち",
    "vocab_N1_彼方此方_あちらこちら": "vocab_N2__あちらこちら",
    "vocab_N1_丸で_まるで": "vocab_N3__まるで",
    "vocab_N1_益々_ますます": "vocab_N3__ますます",
    "vocab_N1_偖_さて": "vocab_N3__さて",
    "vocab_N1_喋る_しゃべる": "vocab_N3__しゃべる",
    "vocab_N1_所が_ところが": "vocab_N3__ところが",
    "vocab_N1_正に_まさに": "vocab_N3__まさに",
    "vocab_N1_苛々_いらいら": "vocab_N3__いらいら",
    "vocab_N1_若しも_もしも": "vocab_N3__もしも",
    "vocab_N1_可哀想_かわいそう": "vocab_N3__かわいそう",
    "vocab_N1_何れ_いずれ": "vocab_N3__いずれ",
    "vocab_N1_かも知れない_かもしれない": "vocab_N3__かもしれない",
    "vocab_N1_何処か_どこか": "vocab_N3__どこか",
    "vocab_N1_鋏_はさみ": "vocab_N3__はさみ",
    "vocab_N1_恐らく_おそらく": "vocab_N3__おそらく",
    "vocab_N1_御免なさい_ごめんなさい": "vocab_N3__ごめんなさい",
    "vocab_N1_その内_そのうち": "vocab_N3__そのうち",
    "vocab_N1_或いは_あるいは": "vocab_N3__あるいは",
    "vocab_N1_軈て_やがて": "vocab_N3__やがて",
    "vocab_N1_有難う_ありがとう": "vocab_N5__ありがとう",
    "vocab_N1_何故なら_なぜなら": "vocab_N3__なぜなら",
    "vocab_N1_何時でも_いつでも": "vocab_N3__いつでも",
    "vocab_N1_宜しく_よろしく": "vocab_N3__よろしく",
    "vocab_N1_而も_しかも": "vocab_N3__しかも",
    "vocab_N1_今日は_こんにちは": "vocab_N5__こんにちは",
    "vocab_N1_所謂_いわゆる": "vocab_N3__いわゆる",
    "vocab_N1_所で_ところで": "vocab_N3__ところで",
    "vocab_N1_態と_わざと": "vocab_N3__わざと",
    "vocab_N1_此れ等_これら": "vocab_N3__これら",
    "vocab_N1_我がまま_わがまま": "vocab_N3__わがまま",
    "vocab_N1_頻りに_しきりに": "vocab_N3__しきりに",
    "vocab_N1_稍_やや": "vocab_N3__やや",
    "vocab_N1_度々_たびたび": "vocab_N3__たびたび",
    "vocab_N1_如何しても_どうしても": "vocab_N3__どうしても",
    "vocab_N1_悪戯_いたずら": "vocab_N3__いたずら",
    "vocab_N1_凡そ_およそ": "vocab_N3__およそ",
    "vocab_N1_其処で_そこで": "vocab_N3__そこで",
    "vocab_N1_堪らない_たまらない": "vocab_N3__たまらない",
    "vocab_N1_其の儘_そのまま": "vocab_N3__そのまま",
    "vocab_N1_お喋り_おしゃべり": "vocab_N3__おしゃべり",
    "vocab_N1_不図_ふと": "vocab_N3__ふと",
    "vocab_N1_その為_そのため": "vocab_N2__そのため",
    "vocab_N1_お蔭様で_おかげさまで": "vocab_N2__おかげさまで",
    "vocab_N1_やっ付ける_やっつける": "vocab_N2__やっつける",
    "vocab_N1_鋸_のこぎり": "vocab_N2__のこぎり",
    "vocab_N1_解く_ほどく": "vocab_N2__ほどく",
    "vocab_N1_お八_おやつ": "vocab_N2__おやつ",
    "vocab_N1_ご馳走さま_ごちそうさま": "vocab_N2__ごちそうさま",
    "vocab_N1_痒い_かゆい": "vocab_N2__かゆい",
    "vocab_N1_お洒落_おしゃれ": "vocab_N2__おしゃれ",
    "vocab_N1_切っ掛け_きっかけ": "vocab_N2__きっかけ",
    "vocab_N1_じゃん拳_じゃんけん": "vocab_N2__じゃんけん",
    "vocab_N1_今晩は_こんばんは": "vocab_N2__こんばんは",
    "vocab_N1_呉れ呉れも_くれぐれも": "vocab_N2__くれぐれも",
    "vocab_N1_兎も角_ともかく": "vocab_N2__ともかく",
    "vocab_N1_填める_はめる": "vocab_N2__はめる",
    "vocab_N1_出鱈目_でたらめ": "vocab_N2__でたらめ",
    "vocab_N1_躊躇う_ためらう": "vocab_N2__ためらう",
    "vocab_N1_若しかしたら_もしかしたら": "vocab_N2__もしかしたら",
    "vocab_N1_一人でに_ひとりでに": "vocab_N2__ひとりでに",
    "vocab_N1_堪える_こらえる": "vocab_N2__こらえる",
    "vocab_N1_発条_ばね": "vocab_N2__ばね",
    "vocab_N1_喧しい_やかましい": "vocab_N2__やかましい",
    "vocab_N1_何となく_なんとなく": "vocab_N2__なんとなく",
    "vocab_N1_疾っくに_とっくに": "vocab_N2__とっくに",
    "vocab_N1_粗筋_あらすじ": "vocab_N2__あらすじ",
    "vocab_N1_吃逆_しゃっくり": "vocab_N2__しゃっくり",
    "vocab_N1_零れる_こぼれる": "vocab_N2__こぼれる",
    "vocab_N1_零す_こぼす": "vocab_N2__こぼす",
    "vocab_N1_饂飩_うどん": "vocab_N2__うどん",
    "vocab_N1_打付ける_ぶつける": "vocab_N2__ぶつける",
    "vocab_N1_箪笥_たんす": "vocab_N2__たんす",
    "vocab_N1_行き成り_いきなり": "vocab_N2__いきなり",
    "vocab_N1_加留多_かるた": "vocab_N2__かるた",
    "vocab_N1_凭れる_もたれる": "vocab_N2__もたれる",
    "vocab_N1_臍_へそ": "vocab_N2__へそ",
    "vocab_N1_お菜_おかず": "vocab_N2__おかず",
    "vocab_N1_揶揄う_からかう": "vocab_N2__からかう",
    "vocab_N1_溢れる_あふれる": "vocab_N2__あふれる",
    "vocab_N1_始めまして_はじめまして": "vocab_N2__はじめまして",
    "vocab_N1_嚏_くしゃみ": "vocab_N2__くしゃみ",
    "vocab_N1_若しかすると_もしかすると": "vocab_N2__もしかすると",
    "vocab_N1_拵える_こしらえる": "vocab_N2__こしらえる",
    "vocab_N1_包む_くるむ": "vocab_N2__くるむ",
    "vocab_N1_躓く_つまずく": "vocab_N2__つまずく",
    "vocab_N1_泌み泌み_しみじみ": "vocab_N2__しみじみ",
    "vocab_N1_済まない_すまない": "vocab_N2__すまない",
    "vocab_N1_痺れる_しびれる": "vocab_N2__しびれる",
    "vocab_N1_忽ち_たちまち": "vocab_N2__たちまち",
    "vocab_N1_見っともない_みっともない": "vocab_N2__みっともない",
    "vocab_N1_萎む_しぼむ": "vocab_N2__しぼむ",
    "vocab_N1_どうぞ宜しく_どうぞよろしく": "vocab_N2__どうぞよろしく",
    "vocab_N1_お早う_おはよう": "vocab_N5__おはよう",
    "vocab_N1_愈々_いよいよ": "vocab_N2__いよいよ",
    "vocab_N1_一々_いちいち": "vocab_N2__いちいち",
    "vocab_N1_彼此_あれこれ": "vocab_N2__あれこれ",
    "vocab_N1_左様なら_さようなら": "vocab_N5__さようなら",
    "vocab_N1_捻子_ねじ": "vocab_N2__ねじ",
    "vocab_N1_滅茶苦茶_めちゃくちゃ": "vocab_N2__めちゃくちゃ",
    "vocab_N1_炙る_あぶる": "vocab_N2__あぶる",
    "vocab_N1_大人しい_おとなしい": "vocab_N2__おとなしい",
    "vocab_N1_噛る_かじる": "vocab_N2__かじる",
    "vocab_N1_草臥れる_くたびれる": "vocab_N2__くたびれる",
    "vocab_N1_畏まりました_かしこまりました": "vocab_N2__かしこまりました",
    "vocab_N1_くっ付ける_くっつける": "vocab_N2__くっつける",
    "vocab_N1_跨ぐ_またぐ": "vocab_N2__またぐ",
    "vocab_N1_一まず_ひとまず": "vocab_N2__ひとまず",
    "vocab_N1_くっ付く_くっつく": "vocab_N2__くっつく",
    "vocab_N1_目眩_めまい": "vocab_N2__めまい",
    "vocab_N1_諄い_くどい": "vocab_N2__くどい",
    "vocab_N1_下らない_くだらない": "vocab_N2__くだらない",
    # ── The content audit's first vocab run (#154) ───────────────
    # 十分 "ten minutes" taught only じっぷん, the traditional reading;
    # the 2010 常用漢字表 gives 十 ジュッ as well, and it is what a learner
    # hears -- the app's own dictation bank reads 10分 じゅっぷん. Packed,
    # modern reading first, so the lookups index both.
    "vocab_N1_十分_じっぷん": "vocab_N1_十分_じゅっぷん/じっぷん",
    # 頃 read けい is no word: the reading lives in 頃日 and 頃刻, and
    # JMdict's only 頃【けい】 is a Chinese unit of land. The card taught
    # ころ's meaning, KANJIDIC's for the character, so what a learner
    # drilled on it is the N3 ころ card's -- which takes the rows, and
    # (NOT_FOLDED below) not the pair.
    "vocab_N1_頃_けい": "vocab_N3_頃_ころ",
    # ── A reading that is not the word's ─────────────────────────
    # Found while looking into example words in the kanji entry panel
    # that did not light their kanji. Each was checked against the JMdict match the deck's senses were
    # built from (vocab_meanings.json before plan 108's optimisation
    # recorded exact_reading or term_only per card), the two JLPT lists
    # of datas/vocab/sources and UniDic's reading of the word.
    # The N3 賛成 was exported as "Uӣ[い", a mojibake of さんせい, which is
    # why 106b's exact-pair merge never met the N1 賛成::さんせい. The N3
    # card takes its reading back and the N1 one folds in.
    "vocab_N3_賛成_Uӣ[い": "vocab_N3_賛成_さんせい",
    "vocab_N1_賛成_さんせい": "vocab_N3_賛成_さんせい",
    # No reading of the form (JMdict matched the written form only), and
    # the gloss is the lower card's: 途中 read つちゅう, 三日月 みかずき (a
    # ず for づ), 平均 ならし (均し's reading), 徐々 そろそろ (glossed with
    # JMdict's そろそろ senses, on a form its export does not give that
    # word). The lower card takes the rows.
    "vocab_N1_途中_つちゅう": "vocab_N4_途中_とちゅう",
    "vocab_N1_三日月_みかずき": "vocab_N2_三日月_みかづき",
    "vocab_N1_平均_ならし": "vocab_N3_平均_へいきん",
    "vocab_N1_徐々_そろそろ": "vocab_N4__そろそろ",
    # No reading of the form either, and no lower card to fold into: the
    # N1 list has 一筋 ひとすじ and 真実 しんじつ, and so does UniDic.
    "vocab_N1_一筋_ひとすき": "vocab_N1_一筋_ひとすじ",
    "vocab_N1_真実_さな": "vocab_N1_真実_しんじつ",
    # Real readings, JMdict's later and archaic ones (すめらぎ and かねごと
    # tagged arch, あだびと an outdated form), on the gloss of the
    # everyday reading: neither JLPT list has any of them, and
    # word_reading answered 天皇 with すめらぎ. The word goes to its card; where
    # there is none, the card takes the reading both lists and UniDic
    # give. These stay in FOLDED_FORMS -- すめらぎ is 天皇, so the
    # dictionary may answer it with the 天皇 card.
    "vocab_N1_天皇_すめらぎ": "vocab_N2_天皇_てんのう",
    "vocab_N1_他人_あだびと": "vocab_N3_他人_たにん",
    "vocab_N1_少女_おとめ": "vocab_N3_少女_しょうじょ",
    "vocab_N1_予言_かねごと": "vocab_N1_予言_よげん",
    "vocab_N1_旧事_くじ": "vocab_N1_旧事_きゅうじ",
    # ── " / " and "・する" in the reading field ──────────────────
    # Two readings joined with " / " (plan 106 fixed 十's space; these
    # three and ラジカセ kept theirs). The spaces also hid 四, 九 and 七
    # from 112's reading pairs, since "し " is no reading: the N3 cards
    # read し and よん are the N5 card's two readings again, and fold
    # into it as the N3 十 cards did.
    "vocab_N5_四_し / よん": "vocab_N5_四_し/よん",
    "vocab_N3_四_し": "vocab_N5_四_し/よん",
    "vocab_N3_四_よん": "vocab_N5_四_し/よん",
    "vocab_N5_九_きゅう / く": "vocab_N5_九_きゅう/く",
    "vocab_N3_九_きゅう": "vocab_N5_九_きゅう/く",
    "vocab_N3_九_く": "vocab_N5_九_きゅう/く",
    "vocab_N5_七_しち / なな": "vocab_N5_七_しち/なな",
    "vocab_N3_七_しち": "vocab_N5_七_しち/なな",
    "vocab_N3_七_なな": "vocab_N5_七_しち/なな",
    "vocab_N5__ラジカセ / ラジオカセット": "vocab_N5__ラジカセ/ラジオカセット",
    # "・する" in the reading, plan 106's 掃除 そうじする 31 more times:
    # word_reading answered 案内 with "あんない・する". Each N4
    # card now reads the noun, as 掃除 does, and takes the noun's gloss
    # (the verb is the noun + する, the entry's vs tag). 26 of them were
    # the N3 or N2 noun card again, which folds DOWN into the N4 one,
    # 106b's rule -- so the N3 びっくり takes plan 112's 吃驚 line with
    # it. The five with no noun card (けが, けんか, あいさつ, チェック,
    # 生活) get the noun's gloss from JMdict.
    "vocab_N4__けが・する": "vocab_N4__けが",
    "vocab_N4__けんか・する": "vocab_N4__けんか",
    "vocab_N4__あいさつ・する": "vocab_N4__あいさつ",
    "vocab_N4__チェック・する": "vocab_N4__チェック",
    "vocab_N4_生活_せいかつ・する": "vocab_N4_生活_せいかつ",
    "vocab_N4__びっくり・する": "vocab_N4__びっくり",
    "vocab_N3__びっくり": "vocab_N4__びっくり",
    "vocab_N4_経験_けいけん・する": "vocab_N4_経験_けいけん",
    "vocab_N3_経験_けいけん": "vocab_N4_経験_けいけん",
    "vocab_N4_故障_こしょう・する": "vocab_N4_故障_こしょう",
    "vocab_N3_故障_こしょう": "vocab_N4_故障_こしょう",
    "vocab_N4_拝見_はいけん・する": "vocab_N4_拝見_はいけん",
    "vocab_N2_拝見_はいけん": "vocab_N4_拝見_はいけん",
    "vocab_N4_放送_ほうそう・する": "vocab_N4_放送_ほうそう",
    "vocab_N3_放送_ほうそう": "vocab_N4_放送_ほうそう",
    "vocab_N4_案内_あんない・する": "vocab_N4_案内_あんない",
    "vocab_N3_案内_あんない": "vocab_N4_案内_あんない",
    "vocab_N4_入院_にゅういん・する": "vocab_N4_入院_にゅういん",
    "vocab_N3_入院_にゅういん": "vocab_N4_入院_にゅういん",
    "vocab_N4_遠慮_えんりょ・する": "vocab_N4_遠慮_えんりょ",
    "vocab_N3_遠慮_えんりょ": "vocab_N4_遠慮_えんりょ",
    "vocab_N4_支度_したく・する": "vocab_N4_支度_したく",
    "vocab_N3_支度_したく": "vocab_N4_支度_したく",
    "vocab_N4_相談_そうだん・する": "vocab_N4_相談_そうだん",
    "vocab_N3_相談_そうだん": "vocab_N4_相談_そうだん",
    "vocab_N4_輸入_ゆにゅう・する": "vocab_N4_輸入_ゆにゅう",
    "vocab_N3_輸入_ゆにゅう": "vocab_N4_輸入_ゆにゅう",
    "vocab_N4_輸出_ゆしゅつ・する": "vocab_N4_輸出_ゆしゅつ",
    "vocab_N3_輸出_ゆしゅつ": "vocab_N4_輸出_ゆしゅつ",
    "vocab_N4_運動_うんどう・する": "vocab_N4_運動_うんどう",
    "vocab_N3_運動_うんどう": "vocab_N4_運動_うんどう",
    "vocab_N4_心配_しんぱい・する": "vocab_N4_心配_しんぱい",
    "vocab_N3_心配_しんぱい": "vocab_N4_心配_しんぱい",
    "vocab_N4_準備_じゅんび・する": "vocab_N4_準備_じゅんび",
    "vocab_N3_準備_じゅんび": "vocab_N4_準備_じゅんび",
    "vocab_N4_招待_しょうたい・する": "vocab_N4_招待_しょうたい",
    "vocab_N3_招待_しょうたい": "vocab_N4_招待_しょうたい",
    "vocab_N4_出発_しゅっぱつ・する": "vocab_N4_出発_しゅっぱつ",
    "vocab_N3_出発_しゅっぱつ": "vocab_N4_出発_しゅっぱつ",
    "vocab_N4_運転_うんてん・する": "vocab_N4_運転_うんてん",
    "vocab_N3_運転_うんてん": "vocab_N4_運転_うんてん",
    "vocab_N4_生産_せいさん・する": "vocab_N4_生産_せいさん",
    "vocab_N3_生産_せいさん": "vocab_N4_生産_せいさん",
    "vocab_N4_承知_しょうち・する": "vocab_N4_承知_しょうち",
    "vocab_N3_承知_しょうち": "vocab_N4_承知_しょうち",
    "vocab_N4_計画_けいかく・する": "vocab_N4_計画_けいかく",
    "vocab_N3_計画_けいかく": "vocab_N4_計画_けいかく",
    "vocab_N4_入学_にゅうがく・する": "vocab_N4_入学_にゅうがく",
    "vocab_N3_入学_にゅうがく": "vocab_N4_入学_にゅうがく",
    "vocab_N4_世話_せわ・する": "vocab_N4_世話_せわ",
    "vocab_N3_世話_せわ": "vocab_N4_世話_せわ",
    "vocab_N4_退院_たいいん・する": "vocab_N4_退院_たいいん",
    "vocab_N2_退院_たいいん": "vocab_N4_退院_たいいん",
    "vocab_N4_食事_しょくじ・する": "vocab_N4_食事_しょくじ",
    "vocab_N3_食事_しょくじ": "vocab_N4_食事_しょくじ",
    "vocab_N4_出席_しゅっせき・する": "vocab_N4_出席_しゅっせき",
    "vocab_N3_出席_しゅっせき": "vocab_N4_出席_しゅっせき",
    # And the four with no ・, 掃除's own shape: each N5 card reads the
    # noun and takes the N3 noun card's gloss, and that card folds into
    # it. furigana.written_reading is the guard now (test_vocab_deck).
    "vocab_N5_練習_れんしゅうする": "vocab_N5_練習_れんしゅう",
    "vocab_N3_練習_れんしゅう": "vocab_N5_練習_れんしゅう",
    "vocab_N5_散歩_さんぽする": "vocab_N5_散歩_さんぽ",
    "vocab_N3_散歩_さんぽ": "vocab_N5_散歩_さんぽ",
    "vocab_N5_勉強_べんきょうする": "vocab_N5_勉強_べんきょう",
    "vocab_N3_勉強_べんきょう": "vocab_N5_勉強_べんきょう",
    "vocab_N5__コピーする": "vocab_N5__コピー",
    "vocab_N3__コピー": "vocab_N5__コピー",
    # ── Plan 186c: the basics a first lesson teaches, at N5 ───────
    # The words a novice meets on day one -- the greetings, the yen,
    # the minute, Japan, the week -- were cards at N3, N2 and even N1
    # (分 read ふん), the levels the community lists give them, so the
    # level rule held their reviews back from an N5 learner and the
    # basics course (plan 186) could not teach them. Every textbook's
    # first lessons do; they move down, their glosses cleaned of the
    # export's part-of-speech notes. 椅子 stays: the N5 いす is the card.
    # The older lines that pointed at these ids point straight here,
    # since a move is one hop.
    "vocab_N3_円_えん": "vocab_N5_円_えん",
    "vocab_N1_分_ふん": "vocab_N5_分_ふん",
    # 日本 is one word read two ways, so one card packs both, as 何 does
    # (plan 112): the tokenizer reads it にっぽん, which reached the N3 card.
    "vocab_N3_日本_にほん": "vocab_N5_日本_にほん/にっぽん",
    "vocab_N3_日本_にっぽん": "vocab_N5_日本_にほん/にっぽん",
    "vocab_N3_週_しゅう": "vocab_N5_週_しゅう",
    "vocab_N3_週間_しゅうかん": "vocab_N5_週間_しゅうかん",
    "vocab_N3__こんにちは": "vocab_N5__こんにちは",
    "vocab_N3__ありがとう": "vocab_N5__ありがとう",
    "vocab_N3__すみません": "vocab_N5__すみません",
    "vocab_N2__おはよう": "vocab_N5__おはよう",
    "vocab_N2__さようなら": "vocab_N5__さようなら",

    # ── The content audit's placement run (#256) ─────────────────
    # 出合い and 出合う are the 合 spellings of the N3 出会い and 出会う:
    # one JMdict entry each, the same senses and the same example
    # sentence (written 会), and 13 of the subtitles' 919 for the word.
    # Unlike 会う/遭う, nothing tells the second card apart -- the N1
    # 出合う's gloss was the N3 card's string with two senses more, now
    # on the N3 card -- so they fold, 112's rule, onto the lower card.
    "vocab_N2_出合い_であい": "vocab_N3_出会い_であい",
    "vocab_N1_出合う_であう": "vocab_N3_出会う_であう",
    # Everyday words the N1 shelf held two levels above the JLPT lists,
    # each in the subtitle ranking's first 1,500 on its own spelling
    # once the ranking reads words rather than morphemes: down to the
    # lists' N3. 予想 is in the N3 lesson of 〜通りに (予想通り). Left at
    # N1: 捜査 (its rank is the corpus's police dramas) and 振り, 片付け
    # and 怒り, whose counts are their verbs' 連用形.
    "vocab_N1_携帯_けいたい": "vocab_N3_携帯_けいたい",
    "vocab_N1_治療_ちりょう": "vocab_N3_治療_ちりょう",
    "vocab_N1_保護_ほご": "vocab_N3_保護_ほご",
    "vocab_N1__メッセージ": "vocab_N3__メッセージ",
    "vocab_N1_脳_のう": "vocab_N3_脳_のう",
    "vocab_N1__データ": "vocab_N3__データ",
    "vocab_N1__ルール": "vocab_N3__ルール",
    "vocab_N1_癌_がん": "vocab_N3_癌_がん",
    "vocab_N1_後悔_こうかい": "vocab_N3_後悔_こうかい",
    "vocab_N1_指揮_しき": "vocab_N3_指揮_しき",
    "vocab_N1_興奮_こうふん": "vocab_N3_興奮_こうふん",
    "vocab_N1_自己_じこ": "vocab_N3_自己_じこ",
    "vocab_N1_予想_よそう": "vocab_N3_予想_よそう",
    "vocab_N1_上司_じょうし": "vocab_N3_上司_じょうし",

    # ── A reading the character does not have ───────────────────
    # The N1 card read 前 as せん, which is 先's on-reading: the
    # 常用漢字表 and datas/kanji/kanji.sqlite3 both give 前 ゼン and
    # まえ and nothing else, and no JMdict row pairs 前 with せん
    # (the pool has 前::さき and 前::ぜん only). The card kept its
    # gloss, "before", which is JMdict's own third and fourth sense
    # for 前::ぜん -- a dropped dakuten, not a different word.
    "vocab_N1_前_せん": "vocab_N1_前_ぜん",

    # ── Plan 193: what the reading bank's drafters met ───────────
    # Words of the first lessons that the deck held a second time, far
    # above the card a learner had already learned: the N1 直ぐ beside
    # the N5 すぐに, the N3 ゆっくり beside the N5 ゆっくりと, the N1 良い
    # and 好い beside the N5 いい/よい, the N1 赤ちゃん beside the N4
    # あかちゃん, the N1 何も beside the N3 なにも. The JLPT lists put
    # each at the lower card's level (Tanos: すぐに and ゆっくりと N5,
    # 赤ちゃん N4), and an N4 sentence about a baby was graded N1. Plan
    # 112's rule, one card at the lower level. A word with and without
    # its particle is one card packing both, as けれど/けれども does,
    # since a breakdown reads すぐ and ゆっくり without it; a kana card
    # whose word is written in kanji the level teaches (赤, N4; 何, N5)
    # takes the spelling, as 日本 did in plan 186c.
    "vocab_N5__すぐに": "vocab_N5__すぐ/すぐに",
    "vocab_N1_直ぐ_すぐ": "vocab_N5__すぐ/すぐに",
    "vocab_N5__ゆっくりと": "vocab_N5__ゆっくり/ゆっくりと",
    "vocab_N3__ゆっくり": "vocab_N5__ゆっくり/ゆっくりと",
    "vocab_N1_良い_いい": "vocab_N5__いい/よい",
    "vocab_N1_好い_よい": "vocab_N5__いい/よい",
    "vocab_N4__あかちゃん": "vocab_N4_赤ちゃん_あかちゃん",
    "vocab_N1_赤ちゃん_あかちゃん": "vocab_N4_赤ちゃん_あかちゃん",
    "vocab_N3__なにも": "vocab_N3_何も_なにも",
    "vocab_N1_何も_なにも": "vocab_N3_何も_なにも",
    # 世論 is read よろん first (the tokenizer's reading, and the 常用
    # one since 2010) and せろん still; the card read せろん alone, so
    # the breakdown's 世論 reached the pool's row and never the card.
    "vocab_N1_世論_せろん": "vocab_N1_世論_よろん/せろん",
    # ── Plan 227: what plan 227's reviewers found ────────────────
    # One word, one card, as plan 112: a rare or broken spelling (位地,
    # 逆上る, 藍褸, 擽ぐったい), a kana card that duplicated a kanji card
    # (いく, ぺん), the same word at two levels (タイア/タイヤ, 卒直/率直,
    # 唯 read たった). A kana card filed under another word's gloss takes
    # that word's spelling (で glossed as 出, いち as 市, あと as 跡,
    # もっとも as 最も, とん as トン), and NOT_FOLDED keeps its kana out of
    # the fold: kana で is the particle, not 出.
    "vocab_N1__えい": "vocab_N1__エイ",
    "vocab_N3__とん": "vocab_N3__トン",
    "vocab_N1_一向_ひたすら": "vocab_N1__ひたすら",
    "vocab_N1_厭やらしい_いやらしい": "vocab_N1__いやらしい",
    "vocab_N1_擽ぐったい_くすぐったい": "vocab_N1__くすぐったい",
    "vocab_N1_辺り_ほとり": "vocab_N1__ほとり",
    "vocab_N1_不便_ふびん": "vocab_N1_不憫_ふびん",
    "vocab_N1_灰_あく": "vocab_N1_灰汁_あく",
    "vocab_N1_何々_どれどれ": "vocab_N1__どれどれ",
    "vocab_N1_明白_あからさま": "vocab_N1__あからさま",
    "vocab_N2_田ぼ_たんぼ": "vocab_N2_田んぼ_たんぼ",
    "vocab_N3__で": "vocab_N3_出_で",
    "vocab_N1_転転_てんてん": "vocab_N1_転々_てんてん",
    "vocab_N2__タイア": "vocab_N2__タイヤ",
    "vocab_N2_卒直_そっちょく": "vocab_N2_率直_そっちょく",
    "vocab_N3_唯_たった": "vocab_N3__たった",
    "vocab_N4__もっとも": "vocab_N4_最も_もっとも",
    "vocab_N3__いち": "vocab_N3_市_いち",
    "vocab_N3_行き_いき": "vocab_N3_行き_いき/ゆき",
    "vocab_N1__タイヤ": "vocab_N2__タイヤ",
    "vocab_N1_率直_そっちょく": "vocab_N2_率直_そっちょく",
    "vocab_N1__たった": "vocab_N3__たった",
    "vocab_N3_最も_もっとも": "vocab_N4_最も_もっとも",
    "vocab_N1_市_いち": "vocab_N3_市_いち",
    "vocab_N3_行き_ゆき": "vocab_N3_行き_いき/ゆき",
    "vocab_N1__いく": "vocab_N5_行く_いく",
    "vocab_N2__ぺん": "vocab_N5__ペン",
    "vocab_N1_位地_いち": "vocab_N3_位置_いち",
    "vocab_N1_逆上る_さかのぼる": "vocab_N2_遡る_さかのぼる",
    "vocab_N1_物体ない_もったいない": "vocab_N2__もったいない",
    "vocab_N1_藍褸_ぼろ": "vocab_N2__ぼろ",
    "vocab_N1_仕舞_しまい": "vocab_N3__しまい",
    "vocab_N1_各々_それぞれ": "vocab_N3__それぞれ",
    "vocab_N3__あと": "vocab_N3_跡_あと",
    "vocab_N2_適確_てきかく": "vocab_N2_的確_てきかく",
    "vocab_N2_御手洗_おてあらい": "vocab_N5_お手洗い_おてあらい",
    # Two kana cards that carried another word's gloss: the N3 たとえ
    # read "simile" (例え) and is the list's "even if", the N1 仮令's word;
    # the N4 おかげ is the N1 お蔭. Each kanji card folds into the kana one.
    "vocab_N1_仮令_たとえ": "vocab_N3__たとえ",
    "vocab_N1_お蔭_おかげ": "vocab_N4__おかげ",
    "vocab_N1_百科辞典_ひゃっかじてん": "vocab_N1_百科事典_ひゃっかじてん",

    # ── The content audit's second placement run (#360) ──────────
    # そして was the N1 然して, a spelling JMdict marks rare for a word
    # it marks usually kana, and the N5 lesson of そして teaches it beside
    # それから and しかし, both N5 kana cards: down to N5 in kana, as
    # 然し went to しかし in plan 112. 其れから, 其れでは, 可成 and
    # お目出度う were second cards, at N1, for kana cards the deck already
    # has lower; JMdict's row for each is a redirect to the kana word.
    # (嗚呼 stays: the N4 ああ is the adverb "like that", not the "ah!".)
    "vocab_N1_然して_そして": "vocab_N5__そして",
    "vocab_N1_其れから_それから": "vocab_N5__それから",
    "vocab_N1_其れでは_それでは": "vocab_N5__それでは",
    "vocab_N1_可成_かなり": "vocab_N3__かなり",
    "vocab_N1_お目出度う_おめでとう": "vocab_N3__おめでとう",
    # The spelling a learner meets: 取引 is JMdict's first form and the
    # one the reading bank writes, four times out of four; 追いかける is
    # 448 of the subtitles' 457; とりあえず is usually kana in JMdict and
    # the course's own sentences write it so.
    "vocab_N1_取り引き_とりひき": "vocab_N1_取引_とりひき",
    "vocab_N2_追い掛ける_おいかける": "vocab_N2_追いかける_おいかける",
    "vocab_N1_取りあえず_とりあえず": "vocab_N1__とりあえず",
}

# MOVES keys that are not a spelling of their target. The move carries
# the learner's rows; the pair stays out of FOLDED_FORMS, or the
# dictionary would answer けい with ころ as it answers 終る with 終わる --
# and the breakdown would badge every 徐々 in a text as そろそろ.
NOT_FOLDED: frozenset[str] = frozenset({
    "vocab_N1_頃_けい",
    "vocab_N3_賛成_Uӣ[い",
    "vocab_N1_途中_つちゅう",
    "vocab_N1_三日月_みかずき",
    "vocab_N1_平均_ならし",
    "vocab_N1_徐々_そろそろ",
    "vocab_N1_一筋_ひとすき",
    "vocab_N1_真実_さな",
    "vocab_N1_前_せん",
    "vocab_N1_不便_ふびん",
    "vocab_N1_何々_どれどれ",
    "vocab_N1_各々_それぞれ",
    "vocab_N1_藍褸_ぼろ",
    "vocab_N1_辺り_ほとり",
    "vocab_N3_唯_たった",
    "vocab_N1_灰_あく",
    "vocab_N1_明白_あからさま",
    "vocab_N1_一向_ひたすら",
    "vocab_N3__あと",
    "vocab_N3__いち",
    "vocab_N3__で",
    "vocab_N4__もっとも",
    "vocab_N1__えい",
    "vocab_N3__とん",
    "vocab_N1_厭やらしい_いやらしい",
    "vocab_N1_擽ぐったい_くすぐったい",
})

# Ids that left the deck with nowhere to go. MOVES needs a card to carry
# the rows to, and for these there is none: nothing at or below the
# card's level teaches what it stood for, and a move UP a level would
# take the card out of a lower-level learner's deck
# (test_a_rename_that_changes_the_level_moves_down_never_up). And, since
# plan 153, the ids the owner chose to delete rather than move: a card
# whose reading was put right leaves, and the corrected card starts new.
#
# scripts/migrate_vocab_ids.py drops what schedules a retired card (its
# `cards` row, and its `card_modes` by cascade) and what names it: deck
# rows, frequency pins, favourites. It keeps the card's review_log and
# card_first_review rows. XP, the level, the streak, the 番付 standing and
# the daily-new budget are sums over those two tables, and retiring a
# card the learner never chose to lose must not change any of them.
#
# id -> why it went, printed by the migration's report.
RETIRED: dict[str, str] = {
    # The export's residue of the N5 grammar point 〜より〜のほうが,
    # filed as a vocab card: no word in the reading field, "used for
    # comparison." for a gloss, and neither より nor ほう on the N5
    # list for it to fold into. The N5 grammar deck teaches the pattern.
    "vocab_N5__より、ほう": "the N5 grammar point 〜より〜のほうが, not a word",
    # ── Plan 153: what plan 151's word reviewers found ───────────
    # Readings put right, each checked against the JMdict match the
    # deck's senses were built from (term_only or exact_reading in
    # vocab_meanings.json before plan 108) and the JLPT lists of
    # datas/vocab/sources. Deleted, not moved (the owner's call): the
    # corrected card is new to every learner.
    "vocab_N1_割_かつ": "plan 153: かつ is the on-reading, on 割る's senses; now 割 read わり",
    "vocab_N1_共_きょう": "plan 153: きょう is the on-reading, on 共【とも】's senses; now 共 read とも",
    "vocab_N1_愛憎_あいにく": "plan 153: あいにく is 生憎's reading; now 愛憎 read あいぞう",
    "vocab_N1_音色_おんいろ": "plan 153: おんいろ is no reading of 音色; now 音色 read ねいろ",
    "vocab_N1_復旧_ふくきゅう": "plan 153: ふくきゅう is no reading of 復旧; now 復旧 read ふっきゅう",
    "vocab_N1_地形_じぎょう": "plan 153: a rare reading on ちけい's gloss; now 地形 read ちけい",
    "vocab_N1_統治_とうじ": "plan 153: a rare reading on とうち's gloss; now 統治 read とうち",
    "vocab_N1_施行_しぎょう": "plan 153: a rare reading on しこう's gloss; now 施行 read しこう",
    "vocab_N3_下す_おろす": "plan 153: 下す read おろす is 下ろす's irregular okurigana; now 下ろす",
    "vocab_N1_否_いいえ": "plan 153: JMdict gives 否 no reading いいえ; the N5 いいえ is the word",
    # ── Plan 176: archaic readings and words ─────────────────────
    # Every sense tagged arch, obs or dated in the deck's JMdict
    # senses, and the pair (spelling, reading) on none of the Tanos
    # JLPT lists. Dropped rather than moved: the common word these
    # spell has its own card (弟 おとうと, 銃 じゅう, 長 ちょう ...).
    "vocab_N1_弟_おと": "plan 176: archaic reading; おとうと is the word",
    "vocab_N1_女子_おなご": "plan 176: archaic reading; じょし is the word",
    "vocab_N1_捕吏_ほり": "plan 176: archaic; no list has it",
    "vocab_N1_保母_ほぼ": "plan 176: dated; 保育士 is the word, no list has ほぼ",
    "vocab_N1_銃_つつ": "plan 176: archaic reading; じゅう is the word",
    "vocab_N1_長_おさ": "plan 176: archaic reading; no list has おさ",
    "vocab_N1_悪口_あっこう": "plan 176: archaic reading; わるぐち is the word",
    "vocab_N1_種々_くさぐさ": "plan 176: archaic reading; しゅじゅ is the word",
    "vocab_N1_一定_いちじょう": "plan 176: archaic reading; いってい is the word",
    "vocab_N1_末_うら": "plan 176: archaic reading; すえ and まつ are the words",
    "vocab_N1_哉_や": "plan 176: archaic particle, not a word to learn",
    "vocab_N1_会_え": "plan 176: archaic reading; かい is the word",
    # ── Plan 227: what plan 227's reviewers found ────────────────
    # Most from the old N1 list, which took every reading of a written
    # form: a reading the word does not have (墓地 はかち, 歪む いがむ),
    # a rare one beside the card that has the word's (梯子 ていし beside
    # はしご), a kanji alone that is no word (佐, 働 read どう, 伊井).
    # Deleted, not moved, as plan 153: a card whose reading was wrong
    # leaves, and the corrected card (墓地 ぼち) starts new.
    "vocab_N1_伊井_いい": "plan 227: a surname, not a word; its sentences were 良い's",
    "vocab_N1_働_どう": "plan 227: 働 is not a word read どう; its sentences were どう 'how'",
    "vocab_N1_佐_さ": "plan 227: 佐 alone is not a word (補佐, 大佐); it matched every kana さ",
    "vocab_N1_伐_ばつ": "plan 227: 伐 alone is not a word read ばつ",
    "vocab_N1_依_い": "plan 227: 依 alone is not a word read い",
    "vocab_N1_倣_ほう": "plan 227: 倣 alone is not a word read ほう; 倣う is the N2 card",
    "vocab_N1_尉_じょう": "plan 227: 尉 alone is not a learner's word (an old court rank, a noh role)",
    "vocab_N1_僅_きん": "plan 227: 僅 alone is not a word read きん; 僅か is the word",
    "vocab_N1_於_お": "plan 227: 於 alone is not a word read お",
    "vocab_N1_傾_けい": "plan 227: 傾 alone is not a word read けい",
    "vocab_N1_優_やさ": "plan 227: 優 read やさ is only a prefix (優男)",
    "vocab_N1_出切る_できる": "plan 227: an obscure 出切る, homophone of 出来る",
    "vocab_N1_副_とりわけ": "plan 227: 副 is not read とりわけ; 取り分 is the とりわけ card",
    "vocab_N1_巨_こ": "plan 227: 巨 alone is not a word read こ",
    "vocab_N2_佚_いつ": "plan 227: 佚 is a rare kanji, not a word a learner meets",
    "vocab_N1_供_きょう": "plan 227: 供 alone is not a word read きょう (供する); お供 is the card",
    "vocab_N1_悪い_にくい": "plan 227: 悪い is not read にくい; 憎い is the N2 card",
    "vocab_N1_重なる_おもなる": "plan 227: 重なる is not read おもなる (主なる, rare)",
    "vocab_N1_何卒_どうぞ": "plan 227: 何卒 is read なにとぞ (the N1 card); どうぞ is the N5 card",
    "vocab_N1_次_し": "plan 227: 次 alone is not a word read し; 次 つぎ is the N5 card",
    "vocab_N1_卯_ぼう": "plan 227: ぼう is no reading of 卯 alone (う)",
    "vocab_N1_著_ちゃく": "plan 227: ちゃく is 着's reading; 著 alone is ちょ",
    "vocab_N1_仮_か": "plan 227: 仮 alone is read かり; か only in compounds",
    "vocab_N1_悪日_あくび": "plan 227: a rare word, mostly read あくにち",
    "vocab_N1_梯子_ていし": "plan 227: a rare reading; the word is はしご (N2)",
    "vocab_N1_一言_いちげん": "plan 227: a rare reading; the word is ひとこと (N3)",
    "vocab_N1_鼠_ねず": "plan 227: a rare reading; the word is ねずみ (N3)",
    "vocab_N1_背負う_しょう": "plan 227: a rare reading; the word is せおう (N2)",
    "vocab_N1_中指_ちゅうし": "plan 227: a rare reading; the word is なかゆび (N2)",
    "vocab_N1_姉妹_きょうだい": "plan 227: a rare reading; the word is しまい (N3)",
    "vocab_N1_商人_あきうど": "plan 227: a rare reading; the word is しょうにん (N3)",
    "vocab_N1_日付_かづけ": "plan 227: a rare reading; the word is ひづけ (N3)",
    "vocab_N1_夜中_やちゅう": "plan 227: a rare reading; the word is よなか (N3)",
    "vocab_N1_乗客_じょうかく": "plan 227: a rare reading; the word is じょうきゃく (N3)",
    "vocab_N1_剃る_する": "plan 227: a rare reading; the word is そる (N2)",
    "vocab_N1_傾く_かたぶく": "plan 227: a rare reading; the word is かたむく (N2)",
    "vocab_N1_眼鏡_がんきょう": "plan 227: a rare reading; the word is めがね (N5)",
    "vocab_N1_所々_しょしょ": "plan 227: a rare reading; the word is ところどころ (N2)",
    "vocab_N1_近々_きんきん": "plan 227: a rare reading; the word is ちかぢか (N2)",
    "vocab_N1_現場_げんじょう": "plan 227: a rare reading; the word is げんば (N3)",
    "vocab_N1_夜行_やぎょう": "plan 227: a rare reading; the word is やこう (N2)",
    "vocab_N1_二人_ににん": "plan 227: a rare reading; the word is ふたり (N5)",
    "vocab_N1_蓋_がい": "plan 227: a rare reading; the word is ふた (N2)",
    "vocab_N1_七日_なぬか": "plan 227: a rare reading; the word is なのか (N5)",
    "vocab_N1_下品_かひん": "plan 227: a rare reading; the word is げひん (N2)",
    "vocab_N1_地方_じかた": "plan 227: a rare reading; the word is ちほう (N3)",
    "vocab_N1_黄色_おうしょく": "plan 227: a rare reading; the word is きいろ (N5)",
    "vocab_N1_傷_しょう": "plan 227: a rare reading; the word is きず (N3)",
    "vocab_N1_重役_おもやく": "plan 227: a rare reading; the word is じゅうやく (N2)",
    "vocab_N1_金庫_かねぐら": "plan 227: a rare reading; the word is きんこ (N3)",
    "vocab_N1_役_えき": "plan 227: a rare reading; the word is やく (N3)",
    "vocab_N1_幕_とばり": "plan 227: a rare reading; the word is まく (N3)",
    "vocab_N1_誰_たれ": "plan 227: a rare reading; the word is だれ (N5)",
    "vocab_N1_気配_きはい": "plan 227: a rare reading; the word is けはい (N2)",
    "vocab_N1_丈夫_じょうふ": "plan 227: a rare reading; the word is じょうぶ (N5)",
    "vocab_N1_国境_くにざかい": "plan 227: a rare reading; the word is こっきょう (N3)",
    "vocab_N1_強気_ごうぎ": "plan 227: a rare reading; the word is つよき (N2)",
    "vocab_N1_一人_いちにん": "plan 227: a rare reading; the word is ひとり (N5)",
    "vocab_N1_土産_どさん": "plan 227: a rare reading; the word is みやげ (N3)",
    "vocab_N1_昼間_ちゅうかん": "plan 227: a rare reading; the word is ひるま (N4)",
    "vocab_N1_木綿_きわた": "plan 227: a rare reading; the word is もめん (N4)",
    "vocab_N1_消耗_しょうこう": "plan 227: a rare reading; the word is しょうもう (N2)",
    "vocab_N1_墓地_はかち": "plan 227: はかち is a rare or wrong reading; the word is 墓地 read ぼち",
    "vocab_N1_歪む_いがむ": "plan 227: いがむ is a rare or wrong reading; the word is 歪む read ゆがむ",
    "vocab_N1_中腹_ちゅうっぱら": "plan 227: ちゅうっぱら is a rare or wrong reading; the word is 中腹 read ちゅうふく",
    "vocab_N1_昼飯_ちゅうはん": "plan 227: ちゅうはん is a rare or wrong reading; the word is 昼飯 read ひるめし",
    "vocab_N1_修行_しゅうぎょう": "plan 227: しゅうぎょう is a rare or wrong reading; the word is 修行 read しゅぎょう",
    "vocab_N1_幹_かん": "plan 227: かん is a rare or wrong reading; the word is 幹 read みき",
    "vocab_N1_魂_こん": "plan 227: こん is a rare or wrong reading; the word is 魂 read たましい",
    "vocab_N1_立方_たちかた": "plan 227: たちかた is a rare or wrong reading; the word is 立方 read りっぽう",
    "vocab_N1_溝_こう": "plan 227: こう is a rare or wrong reading; the word is 溝 read みぞ",
    "vocab_N1_桟橋_さんきょう": "plan 227: さんきょう is a rare or wrong reading; the word is 桟橋 read さんばし",
    "vocab_N1_相対_あいたい": "plan 227: あいたい is a rare or wrong reading; the word is 相対 read そうたい",
    "vocab_N1_寄贈_きそう": "plan 227: きそう is a rare or wrong reading; the word is 寄贈 read きぞう",
    "vocab_N1_人目_じんもく": "plan 227: じんもく is a rare or wrong reading; the word is 人目 read ひとめ",
    "vocab_N1_問屋_といや": "plan 227: といや is a rare or wrong reading; the word is 問屋 read とんや",
    "vocab_N1_重宝_じゅうほう": "plan 227: じゅうほう is a rare or wrong reading; the word is 重宝 read ちょうほう",
    "vocab_N1_鉄棒_かなぼう": "plan 227: かなぼう is a rare or wrong reading; the word is 鉄棒 read てつぼう",
    "vocab_N1_天_あまつ": "plan 227: あまつ is a rare or wrong reading; the word is 天 read てん",
    "vocab_N1_執着_しゅうじゃく": "plan 227: しゅうじゃく is a rare or wrong reading; the word is 執着 read しゅうちゃく",
    "vocab_N1_情緒_じょうしょ": "plan 227: じょうしょ is a rare or wrong reading; the word is 情緒 read じょうちょ",
    "vocab_N1_伝言_つてごと": "plan 227: つてごと is a rare or wrong reading; the word is 伝言 read でんごん",
    "vocab_N1_一見_いちげん": "plan 227: いちげん is a rare or wrong reading; the word is 一見 read いっけん",
    "vocab_N1_水気_すいき": "plan 227: すいき is a rare or wrong reading; the word is 水気 read みずけ",
    "vocab_N1_仲人_ちゅうにん": "plan 227: ちゅうにん is a rare or wrong reading; the word is 仲人 read なこうど",
    "vocab_N1_華奢_かしゃ": "plan 227: かしゃ is a rare or wrong reading; the word is 華奢 read きゃしゃ",
    "vocab_N1_空間_あきま": "plan 227: あきま is a rare or wrong reading; the word is 空間 read くうかん",
    "vocab_N1_天地_あめつち": "plan 227: あめつち is a rare or wrong reading; the word is 天地 read てんち",
    "vocab_N1_甲_きのえ": "plan 227: きのえ is a rare or wrong reading; the word is 甲 read こう",
    "vocab_N1_奴_やっこ": "plan 227: やっこ is a rare or wrong reading; the word is 奴 read やつ",
    "vocab_N1_凝らす_こごらす": "plan 227: こごらす is a rare or wrong reading; the word is 凝らす read こらす",
    "vocab_N1_画期_かっき": "plan 227: かっき is a rare or wrong reading; the word is 画期的 read かっきてき",
    "vocab_N2_反る_かえる": "plan 227: かえる is a rare or wrong reading; the word is 反る read そる",
}


def _fields_of(raw_id: str) -> tuple[str, str]:
    """
    vocab_{level}_{kanji}_{kana} -> (kanji, kana). The kanji field can be
    empty and the kana field can itself contain "_" (none does today), so
    the split is bounded from the left and the LAST separator wins.
    """
    _, _, rest = raw_id.split("_", 2)
    kanji, _, kana = rest.rpartition("_")
    return kanji, kana


def key_moves() -> dict[str, str]:
    """
    old "{kanji}::{kana}" -> new, for the places that store the deck key
    rather than the card id: frequency_overrides.item_key for
    domain='vocab' (frequency_data.resolve()).
    """
    out: dict[str, str] = {}
    for old, new in MOVES.items():
        okj, okn = _fields_of(old)
        nkj, nkn = _fields_of(new)
        old_key, new_key = f"{okj}::{okn}", f"{nkj}::{nkn}"
        if old_key == new_key:
            # A level move (plan 106b) changes the id and not the deck
            # key: the pin already reads the surviving card. Listed, it
            # would be a rename onto itself, which migrate_vocab_ids
            # applies as an UPDATE that matches nothing followed by a
            # DELETE of the pin -- so the pin is not listed at all.
            continue
        out[old_key] = new_key
    return out


KEY_MOVES: dict[str, str] = key_moves()


def retired_keys() -> frozenset[str]:
    """RETIRED as "{kanji}::{kana}" deck keys, for the tables that store
    the key rather than the id: frequency_overrides.item_key and
    dictionary_favorites.key. A deck key is level-free, so a retired
    card's key is only droppable while no served card still carries it;
    tests/test_vocab_deck.py holds that."""
    return frozenset(
        f"{kanji}::{kana}" for kanji, kana in (_fields_of(raw) for raw in RETIRED)
    )


RETIRED_KEYS: frozenset[str] = retired_keys()


# The characters that mark a MOVES key's field as export residue rather
# than a spelling (plan 091's "（感）", "あたたか(い)", "あげる (=やる)")
# or as two spellings packed into one field ("川/河", "見る 観る").
_NOT_A_SPELLING = set("（）() =/・")


def folded_forms() -> dict[str, tuple[tuple[str, str], ...]]:
    """
    card id -> the (kanji, kana) spellings MOVES folded into it (plan 112).

    A merge keeps one spelling on the card and the other leaves the deck,
    but not the language: a learner still meets 美味しい in a text and
    types 終る into the search, and before the merge each of those found
    a card of its own. This is what lets them find the card that took the
    word in -- the dictionary's search and exact lookup, the breakdown's
    lemma and kana indexes and the placement report all read it, and each
    only ever ADDS a way to reach a card, where the card it took in used
    to be reached -- so a token read からだ and written 身体 finds 体, and
    one read しんたい still finds 身体.

    Left out: a move that changed only the level (the fields are the
    target's own), a key whose field is export residue or a packed pair
    rather than one spelling (see _NOT_A_SPELLING), plan 091's word
    in both fields (この in `kanji`), which is the kana word again, and
    a card that left as no word at all (NOT_FOLDED).
    """
    out: dict[str, list[tuple[str, str]]] = {}
    for old, new in MOVES.items():
        if old in NOT_FOLDED:
            continue
        pair = _fields_of(old)
        kanji, _ = pair
        if pair == _fields_of(new):
            continue
        if any(ch in _NOT_A_SPELLING for ch in "".join(pair)):
            continue
        if kanji and not any("\u4e00" <= ch <= "\u9fff" for ch in kanji):
            continue
        pairs = out.setdefault(new, [])
        if pair not in pairs:
            pairs.append(pair)
    return {card: tuple(pairs) for card, pairs in out.items()}


# Spellings a card answers for with no MOVES line behind them: the old
# card was RETIRED rather than moved (plan 153, the owner's call), and
# its spelling is still this card's word -- the N3 list writes 下ろす as
# 下す, JMdict's irregular okurigana for it.
#
# And a folded spelling's other reading, where the card packs both: the
# N1 良い was read いい and the N1 好い よい (plan 193), but each spelling
# is read either way, and the page's 良い is mostly よい.
FOLDED_ONLY: dict[str, tuple[tuple[str, str], ...]] = {
    "vocab_N3_下ろす_おろす": (("下す", "おろす"),),
    "vocab_N5__いい/よい": (("良い", "よい"), ("好い", "いい")),
}


def _with_folded_only(forms: dict[str, tuple[tuple[str, str], ...]]) -> dict[str, tuple[tuple[str, str], ...]]:
    out = dict(forms)
    for card, pairs in FOLDED_ONLY.items():
        out[card] = tuple(dict.fromkeys(out.get(card, ()) + pairs))
    return out


FOLDED_FORMS: dict[str, tuple[tuple[str, str], ...]] = _with_folded_only(folded_forms())
