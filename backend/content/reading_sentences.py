"""
Hand-written reading-practice sentences, one bank per JLPT level.

── Why this file exists ──────────────────────────────────────
Reading practice drew its sentences from the JMdict/Tatoeba examples
attached to each vocab word, filtered only by "does this sentence use
kanji above the level". Measured over ~650 candidate sentences per level
with study/difficulty's full gate (kanji + grammar + length):

    N5   24 of 666 usable   (3.6%)
    N4   61 of 642          (9.5%)
    N3  244 of 628          (39%)
    N2  288 of 568          (51%)
    N1  511 of 565          (90%)

Tatoeba is a bilingual corpus, not a syllabus. Its sentences are written
by adults for adults, so the further down the levels you go the less of
it is reachable -- and with 24 usable sentences the N5 picker had no
choice but to keep serving the ones that only LOOKED N5 because they
happened to be spelled in easy kanji (〜ようとする, 〜んです, and a
memorable one about an itch).

These are written for the syllabus instead. Every entry names the grammar
point it demonstrates, and the point is checked against
content/grammar_points.json at import (see validate()) rather than
trusted -- a sentence claiming a point it does not use would teach the
wrong thing to anyone reading the label.

── The rules each sentence follows ───────────────────────────
Enforced by tests/test_reading_sentences.py, which runs the whole bank
through study/difficulty.report:

  * every kanji is in the level's cumulative set
  * no grammar point above the level appears
  * every word the app's vocab deck knows is learnable at or below it
  * within the level's length cap (N5 26 chars, up to N1 80)
  * `grammar` names a real point AT that level, and the sentence
    verifiably contains it

── Shape ─────────────────────────────────────────────────────
    {"jp": ..., "en": ..., "grammar": "<pattern>", "focus": "<word>"}

`focus` is the word the sentence is built around -- reading.py reports it
as the phrase's headword so the "look this up" affordance has something
to look up, the same field a Tatoeba-sourced phrase gets from the vocab
entry it hung off.
"""
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL

# ── N5 ────────────────────────────────────────────────────────
# 103 kanji, present/past polite, the core particles, and the first
# conditional-free half of the syllabus. Sentences stay concrete and
# everyday: at this level a reader is decoding, and an abstract sentence
# costs them the whole working-memory budget before the grammar lands.
N5 = [
    {"jp": "わたしは学生です。", "en": "I am a student.", "grammar": "です／だ", "focus": "学生"},
    {"jp": "毎日、水を飲みます。", "en": "I drink water every day.", "grammar": "を", "focus": "毎日"},
    {"jp": "七時に学校へ行きます。", "en": "I go to school at seven.", "grammar": "に", "focus": "学校"},
    {"jp": "駅で友だちに会います。", "en": "I meet a friend at the station.", "grammar": "で", "focus": "駅"},
    {"jp": "父と母は今、外にいます。", "en": "My father and mother are outside right now.", "grammar": "と", "focus": "外"},
    {"jp": "わたしも魚を買います。", "en": "I, too, will buy fish.", "grammar": "も", "focus": "魚"},
    {"jp": "これはわたしの本です。", "en": "This is my book.", "grammar": "の", "focus": "本"},
    {"jp": "九時から五時まで会社にいます。", "en": "I am at the office from nine to five.", "grammar": "から〜まで", "focus": "会社"},
    {"jp": "今日は学校へ行きません。", "en": "I am not going to school today.", "grammar": "〜ます／〜ません", "focus": "今日"},
    {"jp": "きのう、新しい車を買いました。", "en": "I bought a new car yesterday.", "grammar": "〜ました／〜ませんでした", "focus": "車"},
    {"jp": "きれいな花を見たいです。", "en": "I want to see the pretty flowers.", "grammar": "〜たいです", "focus": "花"},
    {"jp": "この本を読んでください。", "en": "Please read this book.", "grammar": "〜てください", "focus": "読む"},
    {"jp": "母は今、テレビを見ています。", "en": "My mother is watching television right now.", "grammar": "〜ています", "focus": "母"},
    {"jp": "少し休んでもいいですか。", "en": "May I rest a little?", "grammar": "〜てもいいです", "focus": "休む"},
    {"jp": "ここで話してはいけません。", "en": "You must not talk here.", "grammar": "〜てはいけません", "focus": "話す"},
    {"jp": "日よう日に来ることができます。", "en": "I can come on Sunday.", "grammar": "〜ことができます", "focus": "来る"},
    {"jp": "ここに車を入れないでください。", "en": "Please do not bring a car in here.", "grammar": "〜ないでください", "focus": "入れる"},
    {"jp": "毎日、名前を書かなければなりません。", "en": "I have to write my name every day.", "grammar": "〜なければなりません", "focus": "名前"},
    {"jp": "本や新聞を買いました。", "en": "I bought books, newspapers and so on.", "grammar": "や", "focus": "新聞"},
    {"jp": "今日はいい天気ですね。", "en": "The weather is nice today, isn't it?", "grammar": "ね", "focus": "天気"},
    {"jp": "あの店は安いですよ。", "en": "That shop is cheap, you know.", "grammar": "よ", "focus": "店"},
    {"jp": "時間がないから、行きません。", "en": "I am not going, because there is no time.", "grammar": "〜から", "focus": "時間"},
    {"jp": "いっしょに魚を食べませんか。", "en": "Won't you eat fish with me?", "grammar": "〜ませんか", "focus": "食べる"},
    {"jp": "五時に駅の前で会いましょう。", "en": "Let's meet in front of the station at five.", "grammar": "〜ましょう", "focus": "前"},
    {"jp": "電気をつけましょうか。", "en": "Shall I turn on the light?", "grammar": "〜ましょうか", "focus": "電気"},
    {"jp": "山の上に大きい木があります。", "en": "There is a big tree on top of the mountain.", "grammar": "〜があります／います", "focus": "木"},
    {"jp": "この店は新しくて安いです。", "en": "This shop is new and cheap.", "grammar": "〜くて／〜で", "focus": "新しい"},
    {"jp": "子どもは大きくなりました。", "en": "The children have grown big.", "grammar": "〜くなる／〜になる", "focus": "子ども"},
    {"jp": "車より電車のほうが安いです。", "en": "The train is cheaper than the car.", "grammar": "〜より〜のほうが", "focus": "電車"},
    {"jp": "この店で、この本がいちばん高いです。", "en": "In this shop, this book is the most expensive.", "grammar": "〜で〜がいちばん", "focus": "高い"},
    {"jp": "今日は休んだほうがいいです。", "en": "You had better rest today.", "grammar": "〜ほうがいいです", "focus": "休む"},
    {"jp": "今日は来なくてもいいです。", "en": "You don't have to come today.", "grammar": "〜なくてもいいです", "focus": "来る"},
    {"jp": "ごはんを食べてから、本を読みます。", "en": "After eating, I read a book.", "grammar": "〜てから", "focus": "ごはん"},
    {"jp": "休むまえに、水を飲みます。", "en": "Before resting, I drink water.", "grammar": "〜まえに", "focus": "水"},
    {"jp": "学校のあとで、友だちと会います。", "en": "After school, I meet a friend.", "grammar": "〜あとで", "focus": "友だち"},
    {"jp": "小さいとき、山によく行きました。", "en": "When I was small, I often went to the mountains.", "grammar": "〜とき", "focus": "小さい"},
    {"jp": "わたしは毎週、電車で来ます。", "en": "I come by train every week.", "grammar": "で", "focus": "毎週"},
    {"jp": "その白い花はきれいですね。", "en": "That white flower is pretty, isn't it?", "grammar": "ね", "focus": "白い"},
    {"jp": "男の人が三人、店の中にいます。", "en": "There are three men inside the shop.", "grammar": "〜があります／います", "focus": "人"},
    {"jp": "先生の話を聞きました。", "en": "I listened to the teacher's talk.", "grammar": "〜ました／〜ませんでした", "focus": "先生"},
    {"jp": "この道をまっすぐ行ってください。", "en": "Please go straight along this road.", "grammar": "〜てください", "focus": "道"},
    {"jp": "土よう日に友だちと山へ行きます。", "en": "On Saturday I go to the mountains with a friend.", "grammar": "へ", "focus": "山"},
    {"jp": "何を買いたいですか。", "en": "What do you want to buy?", "grammar": "〜たいです", "focus": "買う"},
    {"jp": "外は雨です。今日は出ません。", "en": "It is raining outside. I am not going out today.", "grammar": "〜ます／〜ません", "focus": "雨"},
    {"jp": "六時に会社を出ました。", "en": "I left the office at six.", "grammar": "を", "focus": "出る"},
    {"jp": "ここで少し休みましょう。", "en": "Let's rest here a little.", "grammar": "〜ましょう", "focus": "休む"},
    {"jp": "女の人が本を読んでいます。", "en": "A woman is reading a book.", "grammar": "〜ています", "focus": "女"},
    {"jp": "父は毎日、新聞を読みます。", "en": "My father reads the newspaper every day.", "grammar": "を", "focus": "父"},
    {"jp": "母は日よう日に買いものをします。", "en": "My mother does the shopping on Sunday.", "grammar": "に", "focus": "買いもの"},
    {"jp": "この魚は大きくて安いです。", "en": "This fish is big and cheap.", "grammar": "〜くて／〜で", "focus": "魚"},
    {"jp": "先生に手をあげて聞きました。", "en": "I raised my hand and asked the teacher.", "grammar": "〜ました／〜ませんでした", "focus": "手"},
    {"jp": "午後から雨がふりますか。", "en": "Will it rain from the afternoon?", "grammar": "か", "focus": "午後"},
    {"jp": "あの人は目が大きいですね。", "en": "That person has big eyes, doesn't she?", "grammar": "ね", "focus": "目"},
    {"jp": "百円の花を十本買いました。", "en": "I bought ten flowers at a hundred yen each.", "grammar": "を", "focus": "百円"},
    {"jp": "小さい子が耳をすましています。", "en": "The little child is listening carefully.", "grammar": "が", "focus": "耳"},
    # ── Plan 111: one sentence per point the bank did not yet demonstrate,
    # written so a new learner's first sittings meet the whole syllabus
    # rather than the same thirty points. Same rules as the rows above.
    {"jp": "わたしはりんごが好きです。", "en": "I like apples.", "grammar": "〜が好きです", "focus": "りんご"},
    {"jp": "わたしは雨の日がきらいです。", "en": "I dislike rainy days.", "grammar": "〜がきらいです", "focus": "雨"},
    {"jp": "母はりょうりが上手です。", "en": "My mother is good at cooking.", "grammar": "〜が上手です／下手です", "focus": "りょうり"},
    {"jp": "新しい車がほしいです。", "en": "I want a new car.", "grammar": "〜がほしいです", "focus": "車"},
    {"jp": "わたしはえいごが分かります。", "en": "I understand English.", "grammar": "〜が分かります", "focus": "えいご"},
    {"jp": "父は車のうんてんができます。", "en": "My father can drive a car.", "grammar": "〜ができます", "focus": "父"},
    {"jp": "駅まで五分ぐらいかかります。", "en": "It takes about five minutes to the station.", "grammar": "〜くらい／〜ぐらい", "focus": "駅"},
    {"jp": "この店は高いけど、おいしいです。", "en": "This restaurant is expensive, but the food is good.", "grammar": "〜けど", "focus": "店"},
    {"jp": "七時ごろ学校へ行きます。", "en": "I go to school at around seven.", "grammar": "〜ごろ", "focus": "学校"},
    {"jp": "毎日、かんじを三つずつおぼえます。", "en": "I memorise three kanji a day.", "grammar": "〜ずつ", "focus": "毎日"},
    {"jp": "今日はどこにも行きたくないです。", "en": "I do not want to go anywhere today.", "grammar": "〜たくないです", "focus": "今日"},
    {"jp": "きのうは水だけ飲みました。", "en": "Yesterday I drank only water.", "grammar": "〜だけ", "focus": "水"},
    {"jp": "あさおきて、ごはんを食べて、学校へ行きます。", "en": "I get up in the morning, eat, and go to school.", "grammar": "〜て、〜て", "focus": "学校"},
    {"jp": "あしたは雨でしょう。", "en": "It will probably rain tomorrow.", "grammar": "〜でしょう", "focus": "雨"},
    {"jp": "コーヒーでも飲みませんか。", "en": "Won't you have a coffee or something?", "grammar": "〜でも", "focus": "コーヒー"},
    {"jp": "魚とにくとどちらがおいしいですか。", "en": "Which is tastier, fish or meat?", "grammar": "〜と〜とどちらが", "focus": "魚"},
    {"jp": "わたしのかばんは友だちのと同じです。", "en": "My bag is the same as my friend's.", "grammar": "〜と同じ", "focus": "かばん"},
    {"jp": "あしたは雨だと思います。", "en": "I think it will rain tomorrow.", "grammar": "〜と思います", "focus": "雨"},
    {"jp": "友だちは「また来ます」と言いました。", "en": "My friend said, \"I will come again.\"", "grammar": "〜と言います", "focus": "友だち"},
    {"jp": "あさごはんを食べないで学校へ行きました。", "en": "I went to school without eating breakfast.", "grammar": "〜ないで", "focus": "学校"},
    {"jp": "店で花や本などを買いました。", "en": "I bought flowers, books and so on at the shop.", "grammar": "〜など", "focus": "店"},
    {"jp": "わたしはコーヒーにします。", "en": "I will have coffee.", "grammar": "〜にします", "focus": "コーヒー"},
    {"jp": "駅へ友だちに会いに行きます。", "en": "I am going to the station to meet a friend.", "grammar": "〜に行きます", "focus": "駅"},
    {"jp": "わたしは本を読むのが好きです。", "en": "I like reading books.", "grammar": "〜のが好きです", "focus": "本"},
    {"jp": "スポーツの中でサッカーがいちばんおもしろいです。", "en": "Among sports, football is the most fun.", "grammar": "〜の中で", "focus": "スポーツ"},
    {"jp": "あしたはどうですか。", "en": "How about tomorrow?", "grammar": "〜はどうですか", "focus": "あした"},
    {"jp": "すみません、水をください。", "en": "Excuse me, water please.", "grammar": "〜をください", "focus": "水"},
    {"jp": "この本はあまりおもしろくないです。", "en": "This book is not very interesting.", "grammar": "あまり〜ない", "focus": "本"},
    {"jp": "あの人はだれですか。", "en": "Who is that person?", "grammar": "この／その／あの／どの", "focus": "人"},
    {"jp": "それは何ですか。", "en": "What is that?", "grammar": "これ／それ／あれ／どれ", "focus": "何"},
    {"jp": "雨がふりました。しかし、学校へ行きました。", "en": "It rained. However, I went to school.", "grammar": "しかし", "focus": "雨"},
    {"jp": "わたしはお金がぜんぜんありません。", "en": "I have no money at all.", "grammar": "ぜんぜん〜ない", "focus": "お金"},
    {"jp": "ごはんを食べました。そして、ねました。", "en": "I ate. And then I went to bed.", "grammar": "そして", "focus": "ごはん"},
    {"jp": "本を読みました。それから、テレビを見ました。", "en": "I read a book. After that, I watched television.", "grammar": "それから", "focus": "本"},
    {"jp": "あしたはテストです。だから、今日はべんきょうします。", "en": "There is a test tomorrow. So I will study today.", "grammar": "だから", "focus": "テスト"},
    {"jp": "まだひるごはんを食べていません。", "en": "I have not eaten lunch yet.", "grammar": "まだ〜ていません", "focus": "ひるごはん"},
    {"jp": "もうその本を読みました。", "en": "I have already read that book.", "grammar": "もう〜ました", "focus": "本"},
    {"jp": "もうお金がありません。", "en": "I have no money any more.", "grammar": "もう〜ない", "focus": "お金"},
    {"jp": "どこかへ行きましたか。", "en": "Did you go somewhere?", "grammar": "何か／誰か／どこか", "focus": "どこか"},
    {"jp": "きのうは誰も来ませんでした。", "en": "Nobody came yesterday.", "grammar": "何も／誰も〜ない", "focus": "昨日"},
    # ── Plan 170 (入門): the one sentence the six introduction screens
    # hang on -- frontend/src/domain/nyumon.js's INTRO_SENTENCE, which
    # tests/test_nyumon.py holds to this row (ADR 0017: a lesson is fed
    # from the bank the real thing draws on). Reword it here and the
    # introduction has to be redrawn with it.
    {"jp": "駅でコーヒーを飲みます。", "en": "I drink a coffee at the station.", "grammar": "で", "focus": "駅"},
]

# ── N4 ────────────────────────────────────────────────────────
# The conditionals, giving and receiving, causative and passive. Longer
# than N5 and allowed a subordinate clause, but still one idea per
# sentence -- N4's difficulty is the grammar, and burying it under a
# second clause tests reading stamina instead.
N4 = [
    {"jp": "あした雨がふったら、家にいます。", "en": "If it rains tomorrow, I will stay home.", "grammar": "〜たら", "focus": "家"},
    {"jp": "この本を読めば、よくわかりますよ。", "en": "If you read this book, you will understand.", "grammar": "〜ば", "focus": "本"},
    {"jp": "漢字の本なら、あの店にあります。", "en": "If it is kanji books you want, they are at that shop.", "grammar": "〜なら", "focus": "漢字"},
    {"jp": "重い仕事があるので、早く起きました。", "en": "I got up early because I have heavy work.", "grammar": "〜ので", "focus": "仕事"},
    {"jp": "早く休んだのに、まだ元気になりません。", "en": "Even though I rested early, I still do not feel well.", "grammar": "〜のに", "focus": "元気"},
    {"jp": "友だちが重い物を持ってくれました。", "en": "My friend carried the heavy things for me.", "grammar": "〜てあげる／てくれる／てもらう", "focus": "物"},
    {"jp": "空が黒いので、雨がふりそうです。", "en": "The sky is dark, so it looks like it will rain.", "grammar": "〜そうです", "focus": "空"},
    {"jp": "先生はいそがしいようです。", "en": "The teacher seems to be busy.", "grammar": "〜ようです", "focus": "先生"},
    {"jp": "母は妹に手紙を書かせました。", "en": "My mother made my little sister write a letter.", "grammar": "使役形 〜させる", "focus": "手紙"},
    {"jp": "大切な肉を犬に食べられました。", "en": "The dog ate the meat I had set aside.", "grammar": "受身形 〜られる", "focus": "犬"},
    {"jp": "その本はもう読んでしまいました。", "en": "I have already finished reading that book.", "grammar": "〜てしまう", "focus": "本"},
    {"jp": "旅行の前に、地図を買っておきます。", "en": "I will buy a map in advance, before the trip.", "grammar": "〜ておく", "focus": "旅行"},
    {"jp": "古い町を歩いたことがあります。", "en": "I have walked through an old town.", "grammar": "〜ことがある", "focus": "町"},
    {"jp": "毎日習って、字が書けるようになりました。", "en": "I studied every day and came to be able to write.", "grammar": "〜ようになる", "focus": "字"},
    {"jp": "来年から一人で住むことにしました。", "en": "I have decided to live alone from next year.", "grammar": "〜ことにする", "focus": "来年"},
    {"jp": "夏に海へ行くつもりです。", "en": "I intend to go to the sea in summer.", "grammar": "〜つもりです", "focus": "海"},
    {"jp": "これは「さくら」という花です。", "en": "This is a flower called sakura.", "grammar": "〜という", "focus": "花"},
    {"jp": "映画は三時に始まるはずです。", "en": "The film should start at three.", "grammar": "〜はずです", "focus": "映画"},
    {"jp": "駅までは歩いて三十分かかるかもしれません。", "en": "It might take thirty minutes on foot to the station.", "grammar": "〜かもしれません", "focus": "歩く"},
    {"jp": "つかれて、服を着たまま休みました。", "en": "I was tired and rested with my clothes on.", "grammar": "〜まま", "focus": "服"},
    {"jp": "弟は今、漢字が読めます。", "en": "My little brother can read kanji now.", "grammar": "可能形 〜(ら)れる", "focus": "弟"},
    {"jp": "来週、海を見ようと思います。", "en": "I am thinking of going to see the sea next week.", "grammar": "〜ようと思う", "focus": "海"},
    {"jp": "春になると、花が開きます。", "en": "When spring comes, the flowers open.", "grammar": "〜と", "focus": "春"},
    {"jp": "音楽を聞きながら、料理を作ります。", "en": "I cook while listening to music.", "grammar": "〜ながら", "focus": "音楽"},
    {"jp": "日曜日は本を読んだり、歌ったりします。", "en": "On Sunday I read books, sing, and so on.", "grammar": "〜たり〜たり", "focus": "日曜日"},
    {"jp": "ゆうべは少し飲みすぎました。", "en": "I drank a little too much last night.", "grammar": "〜すぎる", "focus": "飲む"},
    {"jp": "この赤いペンはとても書きやすいです。", "en": "This red pen is very easy to write with.", "grammar": "〜やすい／〜にくい", "focus": "赤い"},
    {"jp": "十時から歌を習いはじめます。", "en": "I start learning to sing at ten.", "grammar": "〜はじめる／〜おわる／〜つづける", "focus": "歌"},
    {"jp": "だんだん明るくなっていきますね。", "en": "It is gradually getting brighter, is it not?", "grammar": "〜ていく／〜てくる", "focus": "明るい"},
    {"jp": "この洋食を作ってみます。", "en": "I will try making this western dish.", "grammar": "〜てみる", "focus": "洋食"},
    {"jp": "赤い紙に名前が書いてあります。", "en": "A name is written on the red paper.", "grammar": "〜てある", "focus": "紙"},
    {"jp": "あの茶色の犬はまだ子犬らしいです。", "en": "That brown dog is apparently still a puppy.", "grammar": "〜らしい", "focus": "茶色"},
    {"jp": "外は雨がふっているみたいです。", "en": "It looks like it is raining outside.", "grammar": "〜みたいだ", "focus": "雨"},
    {"jp": "来月から病院で仕事をすることになりました。", "en": "It has been decided that I will work at the hospital from next month.", "grammar": "〜ことになる", "focus": "病院"},
    {"jp": "毎朝、早く起きるようにしています。", "en": "I make a point of getting up early every morning.", "grammar": "〜ようにする", "focus": "毎朝"},
    {"jp": "あした来るかどうか、まだ知りません。", "en": "I still do not know whether he is coming tomorrow.", "grammar": "〜かどうか", "focus": "知る"},
    {"jp": "私には百円しかありません。", "en": "I have only a hundred yen.", "grammar": "〜しか〜ない", "focus": "私"},
    {"jp": "雨がふっても、試験はあります。", "en": "Even if it rains, the exam will go ahead.", "grammar": "〜ても", "focus": "試験"},
    {"jp": "友だちに写真を見せてもらいました。", "en": "My friend showed me the photographs.", "grammar": "〜てあげる／てくれる／てもらう", "focus": "写真"},
    {"jp": "この字は小さくて読みにくいです。", "en": "These characters are small and hard to read.", "grammar": "〜やすい／〜にくい", "focus": "小さい"},
    {"jp": "兄は私に日本語を教えてくれます。", "en": "My older brother teaches me Japanese.", "grammar": "〜てあげる／てくれる／てもらう", "focus": "兄"},
    {"jp": "新しい店の料理を食べてみました。", "en": "I tried the food at the new restaurant.", "grammar": "〜てみる", "focus": "料理"},
    {"jp": "この魚は特別においしそうです。", "en": "This fish looks especially delicious.", "grammar": "〜そうです", "focus": "特別"},
    {"jp": "歌を歌いながら、銀行まで歩きました。", "en": "I walked to the bank while singing.", "grammar": "〜ながら", "focus": "銀行"},
    {"jp": "バスが駅へ走っていきました。", "en": "The bus went off towards the station.", "grammar": "〜ていく／〜てくる", "focus": "バス"},
    # ── Plan 111: one sentence per point the bank did not yet demonstrate,
    # written so a new learner's first sittings meet the whole syllabus
    # rather than the same thirty points. Same rules as the rows above.
    {"jp": "夏休みのあいだ、毎日図書館へ行きました。", "en": "During the summer holidays I went to the library every day.", "grammar": "〜あいだ", "focus": "夏休み"},
    {"jp": "母が出かけているあいだに、へやをそうじした。", "en": "While my mother was out, I cleaned the room.", "grammar": "〜あいだに", "focus": "へや"},
    {"jp": "このバスは十分おきに来ます。", "en": "This bus comes every ten minutes.", "grammar": "〜おきに", "focus": "バス"},
    {"jp": "明日ははれるかな。", "en": "I wonder if it will be sunny tomorrow.", "grammar": "〜かな", "focus": "明日"},
    {"jp": "花のいいにおいがする。", "en": "The flowers smell nice.", "grammar": "〜がする", "focus": "花"},
    {"jp": "弟はいつも新しいゲームをほしがる。", "en": "My little brother always wants new games.", "grammar": "〜がる", "focus": "弟"},
    {"jp": "まどから海が見える。", "en": "You can see the sea from the window.", "grammar": "〜が見える／〜が聞こえる", "focus": "海"},
    {"jp": "テレビの音を小さくする。", "en": "I turn the television down.", "grammar": "〜くする／〜にする", "focus": "音"},
    {"jp": "私のしゅみは映画を見ることです。", "en": "My hobby is watching films.", "grammar": "〜こと", "focus": "映画"},
    {"jp": "私にも話させてください。", "en": "Please let me speak too.", "grammar": "〜させてください", "focus": "話す"},
    {"jp": "それはいい考えじゃないか。", "en": "Isn't that a good idea?", "grammar": "〜じゃないか", "focus": "考え"},
    {"jp": "朝ご飯を食べずに会社へ行った。", "en": "I went to the office without eating breakfast.", "grammar": "〜ずに", "focus": "会社"},
    {"jp": "友だちの話では、あの店はおいしいそうだ。", "en": "According to my friend, that restaurant is good.", "grammar": "〜そうだ（伝聞）", "focus": "店"},
    {"jp": "雨は止みそうにない。", "en": "The rain shows no sign of stopping.", "grammar": "〜そうにない", "focus": "雨"},
    {"jp": "弟は私のかばんの中を見たがる。", "en": "My little brother wants to look inside my bag.", "grammar": "〜たがる", "focus": "かばん"},
    {"jp": "さっき昼ご飯を食べたばかりです。", "en": "I have only just eaten lunch.", "grammar": "〜たばかり", "focus": "昼ご飯"},
    {"jp": "日本ではたらくために、日本語を勉強している。", "en": "I am studying Japanese in order to work in Japan.", "grammar": "〜ために", "focus": "日本"},
    {"jp": "医者に行ったらどうですか。", "en": "How about going to the doctor?", "grammar": "〜たらどうですか", "focus": "医者"},
    {"jp": "明日はさむくなるだろう。", "en": "It will probably get cold tomorrow.", "grammar": "〜だろう", "focus": "明日"},
    {"jp": "ここであそんじゃいけないよ。", "en": "You mustn't play here.", "grammar": "〜ちゃいけない／〜じゃいけない", "focus": "あそぶ"},
    {"jp": "写真をとっていただけませんか。", "en": "Could you possibly take a photo for us?", "grammar": "〜ていただけませんか", "focus": "写真"},
    {"jp": "先生が本を貸してくださった。", "en": "The teacher kindly lent me a book.", "grammar": "〜てくださる／〜ていただく", "focus": "先生"},
    {"jp": "もっとゆっくり話してほしい。", "en": "I want you to speak more slowly.", "grammar": "〜てほしい", "focus": "話す"},
    {"jp": "道を教えてもらえませんか。", "en": "Could you tell me the way?", "grammar": "〜てもらえませんか", "focus": "道"},
    {"jp": "この映画を見てよかった。", "en": "I am glad I watched this film.", "grammar": "〜てよかった", "focus": "映画"},
    {"jp": "ぜんぶで三千円でございます。", "en": "That comes to three thousand yen in all.", "grammar": "〜でございます", "focus": "全部"},
    {"jp": "この電車は東京へ行くでしょうか。", "en": "Does this train go to Tokyo, I wonder?", "grammar": "〜でしょうか", "focus": "電車"},
    {"jp": "早く春が来るといい。", "en": "I hope spring comes soon.", "grammar": "〜といい／〜たらいい／〜ばいい", "focus": "春"},
    {"jp": "今から昼ご飯を食べるところです。", "en": "I am just about to eat lunch.", "grammar": "〜ところだ", "focus": "昼ご飯"},
    {"jp": "今日中にくすりを飲まないといけない。", "en": "I have to take the medicine today.", "grammar": "〜ないといけない", "focus": "くすり"},
    {"jp": "夜おそくまで起きていないほうがいい。", "en": "You had better not stay up late.", "grammar": "〜ないほうがいい", "focus": "夜"},
    {"jp": "もう帰らなくちゃ。", "en": "I've got to go home now.", "grammar": "〜なきゃ／〜なくちゃ", "focus": "帰る"},
    {"jp": "お金がなくて、旅行に行けなかった。", "en": "I had no money, so I could not go on the trip.", "grammar": "〜なくて", "focus": "旅行"},
    {"jp": "毎日れんしゅうしなくてはいけない。", "en": "I have to practise every day.", "grammar": "〜なくてはいけない", "focus": "毎日"},
    {"jp": "早くねなさい。", "en": "Go to bed early.", "grammar": "〜なさい", "focus": "早い"},
    {"jp": "あの人は学生に見える。", "en": "That person looks like a student.", "grammar": "〜に見える", "focus": "学生"},
    {"jp": "私が行きたいのは海だ。", "en": "Where I want to go is the sea.", "grammar": "〜のは〜だ", "focus": "海"},
    {"jp": "もっと勉強すればよかった。", "en": "I should have studied more.", "grammar": "〜ばよかった", "focus": "勉強"},
    {"jp": "みんなが元気でいますように。", "en": "May everyone stay well.", "grammar": "〜ますように", "focus": "元気"},
    {"jp": "五時までに帰ってきてください。", "en": "Please come home by five.", "grammar": "〜までに", "focus": "帰る"},
    {"jp": "先生のような人になりたい。", "en": "I want to become a person like my teacher.", "grammar": "〜ような", "focus": "先生"},
    {"jp": "わすれないように、メモを書いた。", "en": "I wrote a note so as not to forget.", "grammar": "〜ように", "focus": "メモ"},
    {"jp": "母は私に早く帰るように言った。", "en": "My mother told me to come home early.", "grammar": "〜ように言う", "focus": "母"},
    {"jp": "どうしておくれたんですか。", "en": "Why were you late?", "grammar": "〜んです／〜のです", "focus": "おくれる"},
    {"jp": "来月、日本へ行く予定だ。", "en": "I am due to go to Japan next month.", "grammar": "〜予定だ", "focus": "来月"},
    {"jp": "雨の場合は、家で映画を見ます。", "en": "If it rains, we will watch a film at home.", "grammar": "〜場合", "focus": "雨"},
    {"jp": "もっと運動する必要がある。", "en": "I need to exercise more.", "grammar": "〜必要がある", "focus": "運動"},
    {"jp": "先生は今、教室にいらっしゃいます。", "en": "The teacher is in the classroom now.", "grammar": "いらっしゃる／おっしゃる／なさる", "focus": "先生"},
    {"jp": "こちらでお待ちください。", "en": "Please wait here.", "grammar": "お〜ください", "focus": "待つ"},
    {"jp": "こんなに大きい魚ははじめて見た。", "en": "I have never seen such a big fish.", "grammar": "こんなに／そんなに／あんなに", "focus": "魚"},
    {"jp": "どんな仕事をしていますか。", "en": "What kind of work do you do?", "grammar": "こんな／そんな／あんな／どんな", "focus": "仕事"},
    {"jp": "きのうはねつがあった。それで、学校を休んだ。", "en": "I had a fever yesterday. That is why I missed school.", "grammar": "それで", "focus": "学校"},
    {"jp": "この店は安い。それに、おいしい。", "en": "This restaurant is cheap. What's more, it is good.", "grammar": "それに", "focus": "店"},
    {"jp": "ところで、来週の旅行はどうしますか。", "en": "By the way, what about next week's trip?", "grammar": "ところで", "focus": "旅行"},
    {"jp": "私は田中ともうします。", "en": "My name is Tanaka.", "grammar": "まいる／もうす／いたす", "focus": "私"},
    {"jp": "電話またはメールで知らせてください。", "en": "Please let me know by phone or by email.", "grammar": "または", "focus": "電話"},
]

# ── N3 ────────────────────────────────────────────────────────
# Where the syllabus turns abstract: reasons, tendencies, degrees. Two
# clauses are normal here, and the sentences start describing situations
# rather than naming objects.
N3 = [
    {"jp": "うちの子は本ばかり読んでいます。", "en": "My child does nothing but read books.", "grammar": "〜ばかり", "focus": "本"},
    {"jp": "先生のおかげで、試験に受かりました。", "en": "Thanks to my teacher, I passed the exam.", "grammar": "〜おかげで", "focus": "試験"},
    {"jp": "大雨のせいで、電車が止まりました。", "en": "Because of the heavy rain, the trains stopped.", "grammar": "〜せいで", "focus": "大雨"},
    {"jp": "高い店の料理がいつもおいしいわけではない。", "en": "Food at an expensive restaurant is not always delicious.", "grammar": "〜わけではない", "focus": "料理"},
    {"jp": "彼がそんな失礼なことを言うわけがない。", "en": "There is no way he would say something so rude.", "grammar": "〜わけがない", "focus": "失礼"},
    {"jp": "この字を見れば、彼が書いたに違いない。", "en": "Looking at this handwriting, he must have written it.", "grammar": "〜に違いない", "focus": "字"},
    {"jp": "約束したのだから、守るべきだ。", "en": "You made a promise, so you ought to keep it.", "grammar": "〜べきだ", "focus": "約束"},
    {"jp": "その問題を説明しようとして、うまくいかなかった。", "en": "I tried to explain the problem and it did not go well.", "grammar": "〜ようとする", "focus": "問題"},
    {"jp": "家を出たとたんに、雨がふり始めた。", "en": "The moment I left the house, it started to rain.", "grammar": "〜たとたんに", "focus": "家"},
    {"jp": "その計画に対して、反対の意見が多い。", "en": "There are many opinions against that plan.", "grammar": "〜に対して", "focus": "意見"},
    {"jp": "彼は医者として、この町で働いている。", "en": "He works in this town as a doctor.", "grammar": "〜として", "focus": "医者"},
    {"jp": "この計画に関して、意見を聞きたい。", "en": "I would like to hear opinions regarding this plan.", "grammar": "〜に関して", "focus": "計画"},
    {"jp": "先生が言った通りに、書いてみました。", "en": "I tried writing it just as the teacher said.", "grammar": "〜通りに", "focus": "先生"},
    {"jp": "この道を通るたびに、昔を思い出す。", "en": "Every time I pass along this road, I remember the old days.", "grammar": "〜たびに", "focus": "昔"},
    {"jp": "この町は静かな一方で、少し不便だ。", "en": "This town is quiet, while also being a little inconvenient.", "grammar": "〜一方で", "focus": "不便"},
    {"jp": "約束はしたものの、まだ始めていない。", "en": "Although I made a promise, I have not started yet.", "grammar": "〜ものの", "focus": "約束"},
    {"jp": "大雨が続くと、川があふれるおそれがある。", "en": "If the heavy rain continues, there is a risk the river will overflow.", "grammar": "〜おそれがある", "focus": "川"},
    {"jp": "子どものころ、母に長い手紙を書かせられた。", "en": "As a child, I was made to write long letters by my mother.", "grammar": "使役受身形 〜させられる", "focus": "手紙"},
    {"jp": "天気予報によると、明日は雪が降るそうだ。", "en": "According to the forecast, it will snow tomorrow.", "grammar": "〜によると", "focus": "予報"},
    {"jp": "日本の文化について研究しています。", "en": "I am doing research about Japanese culture.", "grammar": "〜について", "focus": "文化"},
    {"jp": "この作品は有名な作家によって書かれた。", "en": "This work was written by a famous author.", "grammar": "〜によって", "focus": "作品"},
    {"jp": "会議は本社において行われます。", "en": "The meeting will be held at the head office.", "grammar": "〜において", "focus": "会議"},
    {"jp": "私にとって、家族が一番大切です。", "en": "For me, family is the most important thing.", "grammar": "〜にとって", "focus": "家族"},
    {"jp": "年をとるにつれて、目が悪くなる。", "en": "As you grow older, your eyesight gets worse.", "grammar": "〜につれて", "focus": "目"},
    {"jp": "説明書にしたがって、料理を作った。", "en": "I cooked following the instructions.", "grammar": "〜にしたがって", "focus": "説明書"},
    {"jp": "家族とともに、新しい町へ引っこした。", "en": "I moved to a new town together with my family.", "grammar": "〜とともに", "focus": "家族"},
    {"jp": "暗くならないうちに、家へ帰りましょう。", "en": "Let us go home before it gets dark.", "grammar": "〜うちに", "focus": "暗い"},
    {"jp": "食事の最中に、電話が鳴った。", "en": "The phone rang right in the middle of the meal.", "grammar": "〜最中に", "focus": "食事"},
    {"jp": "お帰りの際に、この紙をお出しください。", "en": "Please hand in this form when you leave.", "grammar": "〜際に", "focus": "紙"},
    {"jp": "自分でやると言ったくせに、いつも人にたのむ。", "en": "He says he will do it himself, yet he always asks others.", "grammar": "〜くせに", "focus": "自分"},
    {"jp": "値段のわりに、この品物は質がいい。", "en": "For the price, this item is good quality.", "grammar": "〜わりに", "focus": "値段"},
    {"jp": "子どもの服はよごれだらけだった。", "en": "The child's clothes were covered in dirt.", "grammar": "〜だらけ", "focus": "服"},
    {"jp": "最近、忘れがちなので気をつけている。", "en": "I have been forgetful lately, so I am being careful.", "grammar": "〜がち", "focus": "最近"},
    {"jp": "その言い方は少し子どもっぽいですね。", "en": "That way of speaking is a little childish, is it not?", "grammar": "〜っぽい", "focus": "言い方"},
    {"jp": "勉強すればするほど、上手になります。", "en": "The more you study, the better you get.", "grammar": "〜ば〜ほど", "focus": "勉強"},
    {"jp": "いそがしくて、食事をする時間さえない。", "en": "I am so busy I do not even have time to eat.", "grammar": "〜さえ", "focus": "時間"},
    {"jp": "こうなったら、自分でやるしかない。", "en": "Now that it has come to this, there is nothing for it but to do it myself.", "grammar": "〜しかない", "focus": "自分"},
    {"jp": "電車が止まった。それで遅れたわけだ。", "en": "The train stopped. That is why he was late, then.", "grammar": "〜わけだ", "focus": "遅れる"},
    {"jp": "自分で作ってはじめて、料理の大変さが分かった。", "en": "Only after cooking myself did I understand how hard it is.", "grammar": "〜てはじめて", "focus": "大変"},
    {"jp": "去年に比べて、今年は雪が少ない。", "en": "Compared with last year, there is little snow this year.", "grammar": "〜に比べて", "focus": "雪"},
    {"jp": "せっかく作ったのに、だれも食べなかった。", "en": "I went to the trouble of cooking, but nobody ate.", "grammar": "せっかく", "focus": "作る"},
    # ── Plan 111: one sentence per point the bank did not yet demonstrate,
    # written so a new learner's first sittings meet the whole syllabus
    # rather than the same thirty points. Same rules as the rows above.
    {"jp": "困ったときは、友だちと助けあうことが大切だ。", "en": "When in trouble, it is important to help one another as friends.", "grammar": "〜あう", "focus": "大切"},
    {"jp": "読みかけの本がつくえの上にある。", "en": "There is a half-read book on the desk.", "grammar": "〜かける", "focus": "本"},
    {"jp": "君のことを思うからこそ、注意するんだ。", "en": "It is precisely because I care about you that I warn you.", "grammar": "〜からこそ", "focus": "注意"},
    {"jp": "コーヒーか何か飲みますか。", "en": "Would you like coffee or something?", "grammar": "〜か何か", "focus": "コーヒー"},
    {"jp": "マラソンを最後まで走りきるつもりだ。", "en": "I intend to run the marathon right to the end.", "grammar": "〜きる", "focus": "マラソン"},
    {"jp": "今度こそ試験に合格したい。", "en": "This time for sure I want to pass the exam.", "grammar": "〜こそ", "focus": "試験"},
    {"jp": "毎朝、六時に起きることにしている。", "en": "I make it a rule to get up at six every morning.", "grammar": "〜ことにしている", "focus": "毎朝"},
    {"jp": "会議は月曜日に行うことになっている。", "en": "The meeting is to be held on Monday.", "grammar": "〜ことになっている", "focus": "会議"},
    {"jp": "この料理はおいしいことはおいしいが、高すぎる。", "en": "This dish is tasty, all right, but it is too expensive.", "grammar": "〜ことは〜が", "focus": "料理"},
    {"jp": "急いで電車に乗りこむ人が多い。", "en": "Many people rush onto the train.", "grammar": "〜こむ", "focus": "電車"},
    {"jp": "三か月ごとに歯医者に行っている。", "en": "I go to the dentist every three months.", "grammar": "〜ごとに", "focus": "歯医者"},
    {"jp": "時間さえあれば、もっと本が読めるのに。", "en": "If only I had time, I could read more books.", "grammar": "〜さえ〜ば", "focus": "時間"},
    {"jp": "私から説明させていただきます。", "en": "Allow me to explain.", "grammar": "〜させていただく", "focus": "説明"},
    {"jp": "疲れているせいか、頭が痛い。", "en": "Perhaps because I am tired, my head hurts.", "grammar": "〜せいか", "focus": "頭"},
    {"jp": "彼は英語だけでなく、中国語も話せる。", "en": "He speaks not only English but Chinese too.", "grammar": "〜だけでなく", "focus": "英語"},
    {"jp": "私だって一人で行けるよ。", "en": "Even I can go on my own, you know.", "grammar": "〜だって", "focus": "一人"},
    {"jp": "明日の会議は何時からだっけ。", "en": "What time was tomorrow's meeting again?", "grammar": "〜っけ", "focus": "会議"},
    {"jp": "電気をつけっぱなしで寝てしまった。", "en": "I fell asleep with the light left on.", "grammar": "〜っぱなし", "focus": "電気"},
    {"jp": "この薬は苦くて飲みづらい。", "en": "This medicine is bitter and hard to swallow.", "grammar": "〜づらい", "focus": "薬"},
    {"jp": "先生は今、電話で話していらっしゃる。", "en": "The teacher is on the phone right now.", "grammar": "〜ていらっしゃる", "focus": "先生"},
    {"jp": "この本、読んでごらん。", "en": "Try reading this book.", "grammar": "〜てごらん", "focus": "本"},
    {"jp": "昨日から眠くてしかたがない。", "en": "I have been unbearably sleepy since yesterday.", "grammar": "〜てしかたがない", "focus": "眠い"},
    {"jp": "新しいゲームがほしくてたまらない。", "en": "I want the new game so badly I can't stand it.", "grammar": "〜てたまらない", "focus": "ゲーム"},
    {"jp": "忙しくて、休んではいられない。", "en": "I am too busy to afford a rest.", "grammar": "〜てはいられない", "focus": "忙しい"},
    {"jp": "弟は一日中ゲームをしてばかりいる。", "en": "My little brother does nothing but play games all day.", "grammar": "〜てばかりいる", "focus": "弟"},
    {"jp": "明日は少し遅れてもかまわない。", "en": "It is fine if you are a little late tomorrow.", "grammar": "〜てもかまわない", "focus": "明日"},
    {"jp": "問題は値段ではなく、質だ。", "en": "The problem is not the price but the quality.", "grammar": "〜ではなく", "focus": "値段"},
    {"jp": "「ことわざ」というのは、昔からあるみじかい言葉だ。", "en": "A proverb is a short saying from long ago.", "grammar": "〜というのは", "focus": "ことわざ"},
    {"jp": "休みの日は、映画とか買い物とかをします。", "en": "On days off I do things like films and shopping.", "grammar": "〜とか", "focus": "映画"},
    {"jp": "もし百万円あるとしたら、何をしますか。", "en": "Supposing you had a million yen, what would you do?", "grammar": "〜としたら", "focus": "何"},
    {"jp": "行くとすれば、来週の土曜日だ。", "en": "If we go at all, it will be next Saturday.", "grammar": "〜とすれば", "focus": "土曜日"},
    {"jp": "高ければいいとは限らない。", "en": "Expensive does not necessarily mean good.", "grammar": "〜とは限らない", "focus": "高い"},
    {"jp": "からいものは食べられないことはないが、苦手だ。", "en": "It's not that I can't eat spicy food, but I am not fond of it.", "grammar": "〜ないことはない", "focus": "苦手"},
    {"jp": "私なんか、まだ下手です。", "en": "Someone like me is still no good at it.", "grammar": "〜なんか／〜なんて", "focus": "下手"},
    {"jp": "彼は子どもにしては、難しい本を読んでいる。", "en": "For a child, he reads difficult books.", "grammar": "〜にしては", "focus": "難しい"},
    {"jp": "行くにしても、早めに知らせてください。", "en": "Even if you do go, please let me know early.", "grammar": "〜にしても", "focus": "知らせる"},
    {"jp": "部長に代わって、私が説明します。", "en": "I will explain on behalf of the manager.", "grammar": "〜に代わって", "focus": "部長"},
    {"jp": "どんなに苦しくても、最後まで走りぬく。", "en": "However hard it gets, I will run through to the end.", "grammar": "〜ぬく", "focus": "最後"},
    {"jp": "彼がそんなことを言うはずがない。", "en": "There is no way he would say such a thing.", "grammar": "〜はずがない", "focus": "彼"},
    {"jp": "月曜日はもちろん、日曜日も働いている。", "en": "I work on Sundays, not to mention Mondays.", "grammar": "〜はもちろん", "focus": "日曜日"},
    {"jp": "彼は勉強ばかりでなく、スポーツも得意だ。", "en": "He is good not only at studying but at sports too.", "grammar": "〜ばかりでなく", "focus": "スポーツ"},
    {"jp": "寝ているふりをして、話を聞いていた。", "en": "Pretending to be asleep, I listened to the conversation.", "grammar": "〜ふりをする", "focus": "寝る"},
    {"jp": "英語のほかに、フランス語も勉強している。", "en": "Besides English, I am also studying French.", "grammar": "〜ほかに", "focus": "英語"},
    {"jp": "急いでいたものだから、あいさつもしなかった。", "en": "I was in such a hurry that I did not even say hello.", "grammar": "〜ものだから", "focus": "あいさつ"},
    {"jp": "道がこんでいたもので、遅れました。", "en": "The roads were busy, so I was late.", "grammar": "〜もので", "focus": "道"},
    {"jp": "れんらく先が分からないので、知らせようがない。", "en": "I do not know how to contact them, so there is no way to let them know.", "grammar": "〜ようがない", "focus": "知らせる"},
    {"jp": "明日も熱が下がらないようなら、病院に行こう。", "en": "If the fever has not gone down tomorrow either, let's go to the hospital.", "grammar": "〜ようなら", "focus": "熱"},
    {"jp": "今日は春らしいあたたかい日だ。", "en": "Today is a warm day, just as spring should be.", "grammar": "〜らしい（典型）", "focus": "春"},
    {"jp": "父の代わりに、私が会議に出た。", "en": "I attended the meeting in place of my father.", "grammar": "〜代わりに", "focus": "会議"},
    {"jp": "約束した以上、守らなければならない。", "en": "Now that I have promised, I have to keep it.", "grammar": "〜以上", "focus": "約束"},
    {"jp": "日曜日以外は毎日働いている。", "en": "I work every day except Sunday.", "grammar": "〜以外", "focus": "日曜日"},
    {"jp": "だれかに見られている気がする。", "en": "I have the feeling someone is watching me.", "grammar": "〜気がする", "focus": "見る"},
    {"jp": "最近、少し太り気味だ。", "en": "Lately I have been putting on a bit of weight.", "grammar": "〜気味", "focus": "太る"},
    {"jp": "学校に行く途中で、さいふを落とした。", "en": "On the way to school I dropped my wallet.", "grammar": "〜途中で", "focus": "さいふ"},
    {"jp": "この本を一晩で読み通すつもりだ。", "en": "I intend to read this book right through in one night.", "grammar": "〜通す", "focus": "本"},
    {"jp": "私が知っている限り、彼は正直な人だ。", "en": "As far as I know, he is an honest person.", "grammar": "〜限り", "focus": "正直"},
    {"jp": "いくら考えても、答えが分からない。", "en": "No matter how much I think, I cannot work out the answer.", "grammar": "いくら〜ても／どんなに〜ても", "focus": "答え"},
    {"jp": "今夜から明日の朝にかけて、雪が降るでしょう。", "en": "From tonight through tomorrow morning, it will probably snow.", "grammar": "から〜にかけて", "focus": "雪"},
    {"jp": "たとえ雨が降っても、試合は行われる。", "en": "Even if it rains, the match will go ahead.", "grammar": "たとえ〜ても", "focus": "試合"},
    {"jp": "この本はちっとも面白くない。", "en": "This book is not the least bit interesting.", "grammar": "ちっとも〜ない", "focus": "本"},
    {"jp": "彼は母の兄、つまり私のおじだ。", "en": "He is my mother's older brother, in other words my uncle.", "grammar": "つまり", "focus": "母"},
    {"jp": "晴れると思っていた。ところが、大雨になった。", "en": "I thought it would be sunny. But then it poured.", "grammar": "ところが", "focus": "大雨"},
    {"jp": "バスがなかなか来ない。", "en": "The bus just won't come.", "grammar": "なかなか〜ない", "focus": "バス"},
]

# ── N2 ────────────────────────────────────────────────────────
N2 = [
    {"jp": "長い会議の末に、答えが決まった。", "en": "After a long meeting, the answer was decided.", "grammar": "〜末に", "focus": "会議"},
    {"jp": "町の様子は少しずつ変わりつつある。", "en": "The look of the town is gradually changing.", "grammar": "〜つつある", "focus": "様子"},
    {"jp": "用意ができ次第、出発します。", "en": "We will set off as soon as everything is ready.", "grammar": "〜次第だ", "focus": "用意"},
    {"jp": "何度も注意したにもかかわらず、彼は同じ失敗をくり返した。", "en": "Despite being warned many times, he repeated the same mistake.", "grammar": "〜にもかかわらず", "focus": "失敗"},
    {"jp": "台風が近づいているので、旅行を中止せざるを得ない。", "en": "With a typhoon approaching, we have no choice but to call off the trip.", "grammar": "〜ざるを得ない", "focus": "台風"},
    {"jp": "だめだと知りつつも、彼は最後まで続けた。", "en": "Knowing it was hopeless, he still kept going to the end.", "grammar": "〜つつも", "focus": "最後"},
    {"jp": "長時間議論したあげくに、答えは出なかった。", "en": "After all that long discussion, no answer was reached.", "grammar": "〜あげくに", "focus": "議論"},
    {"jp": "人口の増加に伴って、緑が減ってきた。", "en": "As the population has grown, greenery has decreased.", "grammar": "〜に伴って", "focus": "人口"},
    {"jp": "実験のデータに基づいて、新しい方法を考えた。", "en": "We devised a new method based on the experimental data.", "grammar": "〜に基づいて", "focus": "実験"},
    {"jp": "安いからといって、たくさん買う必要はない。", "en": "Just because it is cheap does not mean you need to buy a lot.", "grammar": "〜からといって", "focus": "必要"},
    {"jp": "彼は漢字どころか、ひらがなも読めない。", "en": "Far from kanji, he cannot even read hiragana.", "grammar": "〜どころか", "focus": "漢字"},
    {"jp": "それは単なるうわさにすぎない。", "en": "That is nothing more than a rumour.", "grammar": "〜にすぎない", "focus": "うわさ"},
    {"jp": "この店は年齢を問わず、だれでも入れます。", "en": "This shop is open to anyone, regardless of age.", "grammar": "〜を問わず", "focus": "年齢"},
    {"jp": "彼は英語はもとより、中国語も話せる。", "en": "Not to mention English, he can also speak Chinese.", "grammar": "〜はもとより", "focus": "英語"},
    {"jp": "学生のころは、よく夜通し話したものだ。", "en": "Back in my student days, we used to talk all night.", "grammar": "〜ものだ", "focus": "学生"},
    {"jp": "手を洗ってからでないと、食事をしてはいけない。", "en": "You must not eat until after you have washed your hands.", "grammar": "〜てからでないと", "focus": "食事"},
    {"jp": "彼の気持ちは想像しがたい。", "en": "His feelings are hard to imagine.", "grammar": "〜がたい", "focus": "想像"},
    {"jp": "その運転では大きな問題を起こしかねない。", "en": "Driving like that might well cause a serious problem.", "grammar": "〜かねない", "focus": "運転"},
    {"jp": "去年会ったきり、彼とは連絡していない。", "en": "I have not been in touch with him since we met last year.", "grammar": "〜きり", "focus": "連絡"},
    {"jp": "この料理は肉ぬきで作ることもできます。", "en": "This dish can also be made without meat.", "grammar": "〜ぬきで", "focus": "料理"},
    {"jp": "引き受けたからには、最後まで責任を持つ。", "en": "Now that I have taken it on, I will see it through.", "grammar": "〜からには", "focus": "責任"},
    {"jp": "あの写真を見ると、昔を思い出さずにはいられない。", "en": "Seeing that photograph, I cannot help remembering the old days.", "grammar": "〜ずにはいられない", "focus": "写真"},
    {"jp": "彼女は英語ばかりか、フランス語も上手だ。", "en": "Not only English, she is good at French too.", "grammar": "〜ばかりか", "focus": "英語"},
    {"jp": "一言多かったばかりに、話がこじれてしまった。", "en": "Simply because he said one word too many, things got complicated.", "grammar": "〜ばかりに", "focus": "一言"},
    {"jp": "この薬は効果が高いのみならず、値段も安い。", "en": "This medicine is not only effective but also cheap.", "grammar": "〜のみならず", "focus": "効果"},
    {"jp": "気温に応じて、服を変えたほうがいい。", "en": "You should change your clothes in response to the temperature.", "grammar": "〜に応じて", "focus": "気温"},
    {"jp": "天気にかかわらず、試合は行われます。", "en": "The match will be held regardless of the weather.", "grammar": "〜にかかわらず", "focus": "試合"},
    {"jp": "この問題は日本に限らず、世界中で起きている。", "en": "This problem is not limited to Japan; it happens worldwide.", "grammar": "〜に限らず", "focus": "世界"},
    {"jp": "計算にかけては、彼にかなう人はいない。", "en": "When it comes to calculation, no one can match him.", "grammar": "〜にかけては", "focus": "計算"},
    {"jp": "給料に加えて、交通費も支給されます。", "en": "In addition to a salary, travel expenses are also paid.", "grammar": "〜に加えて", "focus": "給料"},
    {"jp": "出発に先立って、全員の荷物を確認した。", "en": "Prior to departure, everyone's luggage was checked.", "grammar": "〜に先立って", "focus": "出発"},
    {"jp": "期待に反して、今年の夏は涼しかった。", "en": "Contrary to expectations, this summer was cool.", "grammar": "〜に反して", "focus": "期待"},
    {"jp": "この点数は努力にほかならない。", "en": "This score is nothing other than the result of effort.", "grammar": "〜にほかならない", "focus": "点数"},
    {"jp": "その件については、今は答えかねます。", "en": "I am unable to answer about that matter at present.", "grammar": "〜かねる", "focus": "件"},
    {"jp": "彼は一度も休むことなく、最後まで走った。", "en": "He ran to the end without ever resting.", "grammar": "〜ことなく", "focus": "休む"},
    {"jp": "返事がないということは、参加しないということだ。", "en": "No reply amounts to saying they will not take part.", "grammar": "〜ということだ", "focus": "返事"},
    {"jp": "彼の説明は分かりにくいというより、間違っている。", "en": "His explanation is not so much hard to follow as simply wrong.", "grammar": "〜というより", "focus": "説明"},
    {"jp": "実際に見ないことには、良し悪しは判断できない。", "en": "Without actually seeing it, I cannot judge whether it is good.", "grammar": "〜ないことには", "focus": "判断"},
    {"jp": "約束したので、今さらやめるわけにはいかない。", "en": "I promised, so I cannot very well back out now.", "grammar": "〜わけにはいかない", "focus": "約束"},
    {"jp": "この地方は温泉をはじめ、見所がたくさんある。", "en": "This region has many attractions, starting with its hot springs.", "grammar": "〜をはじめ", "focus": "温泉"},
    {"jp": "その土地をめぐって、長い議論が続いている。", "en": "A long argument continues over that land.", "grammar": "〜をめぐって", "focus": "土地"},
    {"jp": "この物語は実話をもとに書かれている。", "en": "This story is written on the basis of a true account.", "grammar": "〜をもとに", "focus": "物語"},
    {"jp": "友人を通じて、その会社を知りました。", "en": "I learned of that company through a friend.", "grammar": "〜を通じて", "focus": "友人"},
    {"jp": "その計画は失敗もあり得ると考えている。", "en": "I think that plan could possibly fail as well.", "grammar": "〜得る／〜得ない", "focus": "失敗"},
    # ── Plan 111: one sentence per point the bank did not yet demonstrate,
    # written so a new learner's first sittings meet the whole syllabus
    # rather than the same thirty points. Same rules as the rows above.
    {"jp": "彼は家に着くか着かないかのうちに、また出かけた。", "en": "No sooner had he got home than he went out again.", "grammar": "〜か〜ないかのうちに", "focus": "家"},
    {"jp": "空が暗くなったかと思うと、大雨が降り出した。", "en": "The sky had barely darkened when heavy rain began to fall.", "grammar": "〜かと思うと", "focus": "大雨"},
    {"jp": "彼はまるで知らないかのように話した。", "en": "He spoke just as though he did not know.", "grammar": "〜かのようだ", "focus": "話す"},
    {"jp": "話し方からして、彼は東京の人ではないようだ。", "en": "Judging even from the way he speaks, he does not seem to be from Tokyo.", "grammar": "〜からして", "focus": "話す"},
    {"jp": "彼の表情からすると、試験はうまくいかなかったらしい。", "en": "Going by his expression, the exam apparently did not go well.", "grammar": "〜からすると", "focus": "表情"},
    {"jp": "外国人から見ると、日本の習慣は不思議に思えるかもしれない。", "en": "Seen from a foreigner's point of view, Japanese customs may seem strange.", "grammar": "〜から見ると", "focus": "習慣"},
    {"jp": "教えがいのある学生が多い。", "en": "There are many students who are rewarding to teach.", "grammar": "〜がい", "focus": "学生"},
    {"jp": "途中でやめるくらいなら、最初から始めないほうがいい。", "en": "Rather than give up halfway, it is better not to start at all.", "grammar": "〜くらいなら", "focus": "途中"},
    {"jp": "この日をどれほど待ったことか。", "en": "How long I have waited for this day!", "grammar": "〜ことか", "focus": "待つ"},
    {"jp": "道に迷ったことから、新しい店を見つけた。", "en": "Because I got lost, I found a new shop.", "grammar": "〜ことから", "focus": "店"},
    {"jp": "合格したければ、毎日勉強することだ。", "en": "If you want to pass, you should study every day.", "grammar": "〜ことだ", "focus": "勉強"},
    {"jp": "彼のことだから、きっと時間通りに来るだろう。", "en": "Knowing him, he will surely come on time.", "grammar": "〜ことだから", "focus": "時間"},
    {"jp": "残念なことに、試合は中止になった。", "en": "Regrettably, the match was cancelled.", "grammar": "〜ことに", "focus": "試合"},
    {"jp": "そんなに心配することはない。", "en": "There is no need to worry that much.", "grammar": "〜ことはない", "focus": "心配"},
    {"jp": "かさを持っていたので、ぬれずに済んだ。", "en": "Because I had an umbrella, I got by without getting wet.", "grammar": "〜ずに済む", "focus": "かさ"},
    {"jp": "先生に相談したところ、いい方法を教えてくれた。", "en": "When I consulted my teacher, they told me a good method.", "grammar": "〜たところ", "focus": "相談"},
    {"jp": "今さら急いだところで、間に合わない。", "en": "Hurrying now would not get us there in time anyway.", "grammar": "〜たところで", "focus": "急ぐ"},
    {"jp": "彼はプロだけあって、説明がとても分かりやすい。", "en": "As you would expect of a professional, his explanations are very clear.", "grammar": "〜だけあって", "focus": "プロ"},
    {"jp": "期待が大きかっただけに、失望も大きかった。", "en": "Precisely because the expectations were high, the disappointment was great too.", "grammar": "〜だけに", "focus": "期待"},
    {"jp": "熱はあるが、せきが出ないだけましだ。", "en": "I have a fever, but at least I am not coughing.", "grammar": "〜だけましだ", "focus": "熱"},
    {"jp": "そんな難しい問題、私に解けっこない。", "en": "There is no way I could solve such a hard problem.", "grammar": "〜っこない", "focus": "問題"},
    {"jp": "苦労してこそ、本当の喜びが分かる。", "en": "Only through hardship do you understand real joy.", "grammar": "〜てこそ", "focus": "苦労"},
    {"jp": "遠くに住む家族のことが心配でならない。", "en": "I cannot help worrying about my family living far away.", "grammar": "〜てならない", "focus": "家族"},
    {"jp": "この部屋に勝手に入ってはならない。", "en": "You must not enter this room without permission.", "grammar": "〜てはならない", "focus": "部屋"},
    {"jp": "困っている人を助けるのが人間というものだ。", "en": "Helping people in trouble is what being human is.", "grammar": "〜というものだ", "focus": "人間"},
    {"jp": "安ければいいというものではない。", "en": "It is not the case that cheaper is always better.", "grammar": "〜というものではない", "focus": "安い"},
    {"jp": "日本語が話せるといっても、簡単な会話だけだ。", "en": "I can speak Japanese, but only simple conversation.", "grammar": "〜といっても", "focus": "会話"},
    {"jp": "危うく電車に乗り遅れるところだった。", "en": "I very nearly missed the train.", "grammar": "〜ところだった", "focus": "電車"},
    {"jp": "出かけようとしたところに、電話がかかってきた。", "en": "Just as I was about to go out, the phone rang.", "grammar": "〜ところに", "focus": "電話"},
    {"jp": "たとえ雨が降ったとしても、旅行には行く。", "en": "Even supposing it rains, I am going on the trip.", "grammar": "〜としても", "focus": "旅行"},
    {"jp": "彼は大学を卒業すると同時に、会社を作った。", "en": "He founded a company at the same time as graduating from university.", "grammar": "〜と同時に", "focus": "卒業"},
    {"jp": "仕事が忙しくて、旅行どころではない。", "en": "Work is so busy that a trip is out of the question.", "grammar": "〜どころではない", "focus": "旅行"},
    {"jp": "貧しいながらも、彼らは幸せに暮らしていた。", "en": "Poor though they were, they lived happily.", "grammar": "〜ながらも", "focus": "貧しい"},
    {"jp": "新しい仕事を始めるにあたって、計画を立てた。", "en": "On starting the new job, I made a plan.", "grammar": "〜にあたって", "focus": "計画"},
    {"jp": "ファンの期待にこたえて、彼は再び舞台に立った。", "en": "In response to his fans' hopes, he took the stage again.", "grammar": "〜にこたえて", "focus": "舞台"},
    {"jp": "子どもにしたら、毎日の勉強はつまらないかもしれない。", "en": "From a child's point of view, daily study may be boring.", "grammar": "〜にしたら", "focus": "勉強"},
    {"jp": "行くにしろ行かないにしろ、早く決めてください。", "en": "Whether you go or not, please decide quickly.", "grammar": "〜にしろ〜にしろ", "focus": "決める"},
    {"jp": "本日は定休日につき、休業いたします。", "en": "Closed today, being our regular day off.", "grammar": "〜につき", "focus": "定休日"},
    {"jp": "この歌を聞くにつけ、学生時代を思い出す。", "en": "Whenever I hear this song, I remember my student days.", "grammar": "〜につけ", "focus": "歌"},
    {"jp": "工事は三か月にわたって行われた。", "en": "The construction work went on for three months.", "grammar": "〜にわたって", "focus": "工事"},
    {"jp": "あんな高い店、おいしいに決まっている。", "en": "A restaurant that expensive is bound to be good.", "grammar": "〜に決まっている", "focus": "店"},
    {"jp": "川に沿って、木が植えられている。", "en": "Trees are planted along the river.", "grammar": "〜に沿って", "focus": "川"},
    {"jp": "この手紙は彼が書いたものに相違ない。", "en": "There is no doubt that he wrote this letter.", "grammar": "〜に相違ない", "focus": "手紙"},
    {"jp": "急いでいるときに限って、バスが来ない。", "en": "It is only when I am in a hurry that the bus does not come.", "grammar": "〜に限って", "focus": "バス"},
    {"jp": "入学に際して、必要な書類を出した。", "en": "On entering the school, I handed in the required documents.", "grammar": "〜に際して", "focus": "書類"},
    {"jp": "会員のみ、この部屋を利用できる。", "en": "Only members may use this room.", "grammar": "〜のみ", "focus": "会員"},
    {"jp": "有名な先生のもとで、音楽を学んだ。", "en": "I studied music under a famous teacher.", "grammar": "〜のもとで", "focus": "音楽"},
    {"jp": "味はともかく、見た目はきれいだ。", "en": "Never mind the taste, it looks beautiful.", "grammar": "〜はともかく", "focus": "味"},
    {"jp": "毎日、仕事は増えるばかりだ。", "en": "Every day the work just keeps piling up.", "grammar": "〜ばかりだ", "focus": "仕事"},
    {"jp": "十年ぶりに生まれた町に帰った。", "en": "I went back to the town where I was born for the first time in ten years.", "grammar": "〜ぶりに", "focus": "町"},
    {"jp": "あんな店には二度と行くまい。", "en": "I shall never go to that shop again.", "grammar": "〜まい", "focus": "店"},
    {"jp": "借金までして、車を買う必要はない。", "en": "There is no need to go as far as borrowing money to buy a car.", "grammar": "〜までして", "focus": "借金"},
    {"jp": "あんな人に二度と頼むものか。", "en": "As if I would ever ask that person again!", "grammar": "〜ものか", "focus": "頼む"},
    {"jp": "彼の歌には人を引きつけるものがある。", "en": "There is something in his singing that draws people in.", "grammar": "〜ものがある", "focus": "歌"},
    {"jp": "できるものなら、もう一度学生に戻りたい。", "en": "If it were possible, I would like to be a student again.", "grammar": "〜ものなら", "focus": "学生"},
    {"jp": "引っ越しの準備やら手続きやらで、毎日忙しい。", "en": "What with packing for the move and the paperwork, every day is busy.", "grammar": "〜やら〜やら", "focus": "準備"},
    {"jp": "こんな簡単な問題が解けないようでは、合格は難しい。", "en": "If you cannot solve a problem this simple, passing will be hard.", "grammar": "〜ようでは", "focus": "問題"},
    {"jp": "留学をきっかけに、日本の文化が好きになった。", "en": "Studying abroad is what made me love Japanese culture.", "grammar": "〜をきっかけに", "focus": "留学"},
    {"jp": "心をこめて、手紙を書いた。", "en": "I wrote the letter with all my heart.", "grammar": "〜をこめて", "focus": "手紙"},
    {"jp": "本日をもって、この店は閉めます。", "en": "As of today, this shop is closing.", "grammar": "〜をもって", "focus": "店"},
    {"jp": "東京を中心に、その店は全国に広がった。", "en": "Centred on Tokyo, the chain spread nationwide.", "grammar": "〜を中心に", "focus": "中心"},
    {"jp": "町の人口は減る一方だ。", "en": "The town's population is only going down.", "grammar": "〜一方だ", "focus": "人口"},
    {"jp": "約束した上は、最後までやりとげる。", "en": "Now that I have promised, I will see it through to the end.", "grammar": "〜上は", "focus": "約束"},
    {"jp": "卒業して以来、彼に会っていない。", "en": "I have not seen him since graduation.", "grammar": "〜以来", "focus": "卒業"},
    {"jp": "この仕事は給料がいい反面、休みが少ない。", "en": "This job pays well, but on the other hand there is little time off.", "grammar": "〜反面", "focus": "給料"},
    {"jp": "彼は家族も同然の友人だ。", "en": "He is a friend who is as good as family.", "grammar": "〜同然", "focus": "友人"},
    {"jp": "これは子ども向けの本だ。", "en": "This is a book intended for children.", "grammar": "〜向け", "focus": "本"},
]

# ── N1 ────────────────────────────────────────────────────────
N1 = [
    {"jp": "彼は今にも泣き出さんばかりに顔をゆがめた。", "en": "His face twisted as if he were about to burst into tears.", "grammar": "〜んばかりに", "focus": "顔"},
    {"jp": "館内では、写真を撮るべからず。", "en": "Photography is prohibited inside the building.", "grammar": "〜べからず", "focus": "館内"},
    {"jp": "資金が不足しているゆえに、計画は延期された。", "en": "The plan was postponed on account of a shortage of funds.", "grammar": "〜ゆえに", "focus": "資金"},
    {"jp": "皆さまの支援なくしては、この成果はあり得なかった。", "en": "Without everyone's support, this achievement would not have been possible.", "grammar": "〜なくして(は)", "focus": "支援"},
    {"jp": "彼の態度は失礼極まりないものだった。", "en": "His attitude was rude in the extreme.", "grammar": "〜極まりない", "focus": "態度"},
    {"jp": "彼は物事を悪いほうへ考えるきらいがある。", "en": "He tends to look on the dark side of things.", "grammar": "〜きらいがある", "focus": "物事"},
    {"jp": "その光景は見るにたえないものだった。", "en": "That scene was more than one could bear to watch.", "grammar": "〜にたえない", "focus": "光景"},
    {"jp": "ご家族の健康を願ってやまない。", "en": "I never cease to wish your family good health.", "grammar": "〜てやまない", "focus": "健康"},
    {"jp": "作業を終えた彼は、汗まみれになっていた。", "en": "Having finished the work, he was covered in sweat.", "grammar": "〜まみれ", "focus": "汗"},
    {"jp": "そんな結果は想像だにしなかった。", "en": "I never even imagined such a result.", "grammar": "〜だに", "focus": "結果"},
    {"jp": "この店はお客様あってのものだ。", "en": "This shop exists only thanks to its customers.", "grammar": "〜あっての", "focus": "お客様"},
    {"jp": "彼は断りなしに、私の部屋に入ってきた。", "en": "He came into my room without asking.", "grammar": "〜なしに", "focus": "部屋"},
    {"jp": "理由のいかんによらず、遅刻は認められない。", "en": "Regardless of the reason, lateness is not accepted.", "grammar": "〜いかんによらず", "focus": "理由"},
    {"jp": "この仕事を任せられるのは、彼をおいて他にいない。", "en": "There is no one other than him to whom this work can be entrusted.", "grammar": "〜をおいて", "focus": "仕事"},
    {"jp": "一分たりともむだにはできない。", "en": "We cannot waste even a single minute.", "grammar": "〜たりとも", "focus": "むだ"},
    {"jp": "完成しないまでも、大部分は仕上げておきたい。", "en": "Even if we cannot finish it, I want most of it done.", "grammar": "〜ないまでも", "focus": "完成"},
    {"jp": "結局、その本は読まずじまいだった。", "en": "In the end, I never did get around to reading that book.", "grammar": "〜ずじまい", "focus": "結局"},
    {"jp": "ベルが鳴るが早いか、子どもたちは外へ飛び出した。", "en": "No sooner had the bell rung than the children rushed outside.", "grammar": "〜が早いか", "focus": "ベル"},
    {"jp": "彼は席に着くや否や、話し始めた。", "en": "As soon as he sat down, he began to talk.", "grammar": "〜や否や", "focus": "席"},
    {"jp": "かたづけるそばから、子どもが散らかしてしまう。", "en": "No sooner do I tidy up than the children make a mess again.", "grammar": "〜そばから", "focus": "子ども"},
    {"jp": "彼は家に帰るなり、部屋に閉じこもった。", "en": "The moment he got home, he shut himself in his room.", "grammar": "〜なり", "focus": "部屋"},
    {"jp": "散歩がてら、郵便局に寄ってきます。", "en": "I will drop by the post office while I am out for a walk.", "grammar": "〜がてら", "focus": "散歩"},
    {"jp": "彼は教師のかたわら、小説も書いている。", "en": "Alongside his teaching, he also writes novels.", "grammar": "〜かたわら", "focus": "小説"},
    {"jp": "彼のごとき人物には、二度と会えないだろう。", "en": "I doubt I shall ever meet a person like him again.", "grammar": "〜ごとき／〜ごとく", "focus": "人物"},
    {"jp": "その日の彼女は黒ずくめの服装だった。", "en": "That day she was dressed entirely in black.", "grammar": "〜ずくめ", "focus": "服装"},
    {"jp": "ようやく春めく季節になりました。", "en": "The season has finally begun to feel like spring.", "grammar": "〜めく", "focus": "季節"},
    {"jp": "それは教師にあるまじき発言だ。", "en": "That is a remark unbecoming of a teacher.", "grammar": "〜まじき", "focus": "教師"},
    {"jp": "真実を確かめるべく、現地へ向かった。", "en": "He set out for the site in order to establish the truth.", "grammar": "〜べく", "focus": "真実"},
    {"jp": "彼の努力は評価されてしかるべきだ。", "en": "His efforts ought properly to be recognised.", "grammar": "〜てしかるべきだ", "focus": "努力"},
    {"jp": "この味は、この土地ならではのものだ。", "en": "This flavour is unique to this region.", "grammar": "〜ならでは", "focus": "土地"},
    {"jp": "子どもといえども、約束は守るべきだ。", "en": "Even though they are children, they should keep their promises.", "grammar": "〜といえども", "focus": "約束"},
    {"jp": "便利とはいえ、使いすぎるのはよくない。", "en": "Convenient as it is, using it too much is not good.", "grammar": "〜とはいえ", "focus": "便利"},
    {"jp": "彼は早く帰れとばかりに、時計を見た。", "en": "He looked at his watch as if to say I should go home.", "grammar": "〜とばかりに", "focus": "時計"},
    {"jp": "専門家ならいざ知らず、私には分からない。", "en": "I could not say about a specialist, but I do not understand it.", "grammar": "〜ならいざ知らず", "focus": "専門家"},
    {"jp": "長い調査の末、ようやく結論に至った。", "en": "After a long investigation, we finally reached a conclusion.", "grammar": "〜に至る", "focus": "結論"},
    {"jp": "その景色の美しさは感動の極みだった。", "en": "The beauty of that scenery was the height of moving.", "grammar": "〜の極み", "focus": "景色"},
    {"jp": "彼は漢字はおろか、ひらがなも書けない。", "en": "Let alone kanji, he cannot even write hiragana.", "grammar": "〜はおろか", "focus": "漢字"},
    {"jp": "味もさることながら、この店は雰囲気がいい。", "en": "The taste goes without saying, but this place also has a good atmosphere.", "grammar": "〜もさることながら", "focus": "雰囲気"},
    {"jp": "彼は周囲の反対をものともせず、計画を進めた。", "en": "Undaunted by the opposition around him, he pushed the plan forward.", "grammar": "〜をものともせず", "focus": "反対"},
    {"jp": "大雨のため、試合は中止を余儀なくされた。", "en": "Because of the heavy rain, the match was forced to be cancelled.", "grammar": "〜を余儀なくされる", "focus": "中止"},
    {"jp": "東京を皮切りに、全国で公演が行われる。", "en": "Starting with Tokyo, performances will be held nationwide.", "grammar": "〜を皮切りに", "focus": "公演"},
    # ── Plan 111: one sentence per point the bank did not yet demonstrate,
    # written so a new learner's first sittings meet the whole syllabus
    # rather than the same thirty points. Same rules as the rows above.
    {"jp": "お礼かたがた、ご報告に伺いました。", "en": "I have come to report, and to thank you at the same time.", "grammar": "〜かたがた", "focus": "お礼"},
    {"jp": "彼は業界きっての実力者だ。", "en": "He is the most capable person in the industry.", "grammar": "〜きっての", "focus": "実力"},
    {"jp": "慣れないこととて、ご迷惑をおかけしました。", "en": "Being unused to it, I caused you trouble.", "grammar": "〜こととて", "focus": "迷惑"},
    {"jp": "借金を重ね、ついには家まで売るしまつだ。", "en": "He piled up debts and in the end it came to selling even the house.", "grammar": "〜しまつだ", "focus": "借金"},
    {"jp": "連絡先が分からず、知らせるすべがない。", "en": "Not knowing their contact details, I have no way to let them know.", "grammar": "〜すべがない", "focus": "連絡"},
    {"jp": "疲れて、立ち上がることすらできなかった。", "en": "I was so tired I could not even stand up.", "grammar": "〜すら", "focus": "疲れる"},
    {"jp": "戦わずして勝つのが最善の策だ。", "en": "Winning without fighting is the best strategy.", "grammar": "〜ずして", "focus": "勝つ"},
    {"jp": "その映画は見る者を感動させずにはおかない。", "en": "That film cannot fail to move whoever sees it.", "grammar": "〜ずにはおかない", "focus": "映画"},
    {"jp": "これだけの失敗をしたのだから、謝らずにはすまない。", "en": "After a failure this big, I cannot get away without apologising.", "grammar": "〜ずにはすまない", "focus": "失敗"},
    {"jp": "彼に秘密を話したが最後、次の日には皆が知っている。", "en": "Once you tell him a secret, everyone knows it the next day.", "grammar": "〜たが最後", "focus": "秘密"},
    {"jp": "教師たるもの、常に学び続けるべきだ。", "en": "A teacher, as a teacher, should always keep learning.", "grammar": "〜たるもの", "focus": "教師"},
    {"jp": "子どもが生まれてからというもの、生活が一変した。", "en": "Ever since the child was born, life has completely changed.", "grammar": "〜てからというもの", "focus": "生活"},
    {"jp": "彼は自分が天才だと言ってはばからない。", "en": "He says without a qualm that he is a genius.", "grammar": "〜てはばからない", "focus": "天才"},
    {"jp": "明日は休んでもさしつかえない。", "en": "There is no harm in taking tomorrow off.", "grammar": "〜てもさしつかえない", "focus": "休む"},
    {"jp": "理由が何であれ、暴力は許されない。", "en": "Whatever the reason, violence is not permitted.", "grammar": "〜であれ", "focus": "暴力"},
    {"jp": "これが愛でなくてなんだろう。", "en": "If this is not love, what is?", "grammar": "〜でなくてなんだろう", "focus": "愛"},
    {"jp": "彼は何か隠しているのではあるまいか。", "en": "Might he not be hiding something?", "grammar": "〜ではあるまいか", "focus": "隠す"},
    {"jp": "子どもではあるまいし、自分で決めなさい。", "en": "You are not a child; decide for yourself.", "grammar": "〜ではあるまいし", "focus": "決める"},
    {"jp": "謝るだけではすまない問題だ。", "en": "This is a problem that an apology alone will not settle.", "grammar": "〜ではすまない", "focus": "問題"},
    {"jp": "連休とあって、観光地はどこも混んでいた。", "en": "It being the long weekend, every tourist spot was crowded.", "grammar": "〜とあって", "focus": "連休"},
    {"jp": "家族のためとあれば、どんな苦労もいとわない。", "en": "If it is for my family, I do not mind any hardship.", "grammar": "〜とあれば", "focus": "家族"},
    {"jp": "味といい香りといい、この茶は最高だ。", "en": "In taste and in aroma alike, this tea is the best.", "grammar": "〜といい〜といい", "focus": "茶"},
    {"jp": "参加者は多くても二十人といったところだ。", "en": "The participants number twenty at the very most.", "grammar": "〜といったところだ", "focus": "参加"},
    {"jp": "試験に落ちたときの悔しさといったらなかった。", "en": "The frustration when I failed the exam was beyond words.", "grammar": "〜といったらない", "focus": "試験"},
    {"jp": "彼は日本一の職人だといっても過言ではない。", "en": "It is no exaggeration to say he is the finest craftsman in Japan.", "grammar": "〜といっても過言ではない", "focus": "職人"},
    {"jp": "顔といわず手といわず、泥だらけになった。", "en": "Face and hands and all, I was covered in mud.", "grammar": "〜といわず〜といわず", "focus": "泥"},
    {"jp": "うちの犬ときたら、寝てばかりいる。", "en": "As for our dog, all it does is sleep.", "grammar": "〜ときたら", "focus": "犬"},
    {"jp": "専門家とて、間違えることはある。", "en": "Even an expert makes mistakes sometimes.", "grammar": "〜とて", "focus": "専門家"},
    {"jp": "あの彼が医者になるとは、思いもしなかった。", "en": "To think that he of all people became a doctor!", "grammar": "〜とは", "focus": "医者"},
    {"jp": "彼は窓の外を見るともなく見ていた。", "en": "He was gazing absently out of the window.", "grammar": "〜ともなく", "focus": "窓"},
    {"jp": "社長ともなると、自由な時間はほとんどない。", "en": "Once you are company president, you have almost no free time.", "grammar": "〜ともなると", "focus": "社長"},
    {"jp": "晴れると思いきや、午後から大雨になった。", "en": "I thought it would be sunny, but it poured from the afternoon.", "grammar": "〜と思いきや", "focus": "大雨"},
    {"jp": "美しい音楽が映像と相まって、観客を感動させた。", "en": "The beautiful music, combined with the images, moved the audience.", "grammar": "〜と相まって", "focus": "音楽"},
    {"jp": "事故が起きないとも限らないので、保険に入った。", "en": "An accident might just happen, so I took out insurance.", "grammar": "〜ないとも限らない", "focus": "保険"},
    {"jp": "何とか安く手に入らないものか。", "en": "Isn't there some way to get it cheaply?", "grammar": "〜ないものか", "focus": "安い"},
    {"jp": "頼まれれば、手伝わないものでもない。", "en": "If asked, I might just help.", "grammar": "〜ないものでもない", "focus": "手伝う"},
    {"jp": "彼女は涙ながらに事情を語った。", "en": "In tears, she told what had happened.", "grammar": "〜ながらに", "focus": "涙"},
    {"jp": "一度ならまだしも、三度も遅刻するとは。", "en": "Once would be one thing, but being late three times!", "grammar": "〜ならまだしも", "focus": "遅刻"},
    {"jp": "電話なりメールなりで、連絡してください。", "en": "Please get in touch by phone or by email or something.", "grammar": "〜なり〜なり", "focus": "連絡"},
    {"jp": "子どもなりに、一生懸命考えたのだろう。", "en": "In their own childish way, they must have thought hard.", "grammar": "〜なりに", "focus": "子ども"},
    {"jp": "これは会社の信用にかかわる問題だ。", "en": "This is a matter that affects the company's credibility.", "grammar": "〜にかかわる", "focus": "信用"},
    {"jp": "彼の悲しみは想像にかたくない。", "en": "His grief is not hard to imagine.", "grammar": "〜にかたくない", "focus": "想像"},
    {"jp": "専門家にしたところで、正確な予測は難しい。", "en": "Even for an expert, an accurate prediction is difficult.", "grammar": "〜にしたところで", "focus": "予測"},
    {"jp": "被害は都市部にとどまらず、農村にも及んだ。", "en": "The damage was not confined to the cities but reached the villages too.", "grammar": "〜にとどまらず", "focus": "被害"},
    {"jp": "彼が合格したのは、驚くにはあたらない。", "en": "That he passed is nothing to be surprised at.", "grammar": "〜にはあたらない", "focus": "合格"},
    {"jp": "わざわざ来ていただくには及ばない。", "en": "There is no need for you to go to the trouble of coming.", "grammar": "〜には及ばない", "focus": "わざわざ"},
    {"jp": "兄が勤勉なのにひきかえ、弟は怠け者だ。", "en": "In contrast to the diligent older brother, the younger is lazy.", "grammar": "〜にひきかえ", "focus": "兄"},
    {"jp": "今年は去年にもまして暑い。", "en": "This year is even hotter than last year.", "grammar": "〜にもまして", "focus": "去年"},
    {"jp": "事実に即して、報告書を書いてください。", "en": "Please write the report in line with the facts.", "grammar": "〜に即して", "focus": "事実"},
    {"jp": "用心するに越したことはない。", "en": "Nothing beats being careful.", "grammar": "〜に越したことはない", "focus": "用心"},
    {"jp": "彼は信頼に足る人物だ。", "en": "He is a person worthy of trust.", "grammar": "〜に足る", "focus": "信頼"},
    {"jp": "遅刻は彼に限ったことではない。", "en": "Being late is not something limited to him.", "grammar": "〜に限ったことではない", "focus": "遅刻"},
    {"jp": "その料理の辛いのなんのって、水を三杯も飲んだ。", "en": "That dish was so incredibly spicy that I drank three glasses of water.", "grammar": "〜のなんのって", "focus": "辛い"},
    {"jp": "若気の至りで、ずいぶん失礼なことをした。", "en": "In the folly of youth, I was terribly rude.", "grammar": "〜の至り", "focus": "失礼"},
    {"jp": "冗談はさておき、本題に入りましょう。", "en": "Joking aside, let us get down to business.", "grammar": "〜はさておき", "focus": "冗談"},
    {"jp": "君の将来を思えばこそ、厳しく言うのだ。", "en": "It is precisely because I care about your future that I am strict.", "grammar": "〜ばこそ", "focus": "将来"},
    {"jp": "どんなに準備しても、当日休めばそれまでだ。", "en": "However much you prepare, if you are absent on the day that is the end of it.", "grammar": "〜ばそれまでだ", "focus": "準備"},
    {"jp": "素人の私が、プロに勝てるべくもない。", "en": "An amateur like me has no chance of beating a professional.", "grammar": "〜べくもない", "focus": "素人"},
    {"jp": "断られたら、他を当たるまでのことだ。", "en": "If they refuse, I will simply try elsewhere.", "grammar": "〜までのことだ", "focus": "断る"},
    {"jp": "言うまでもなく、健康が一番大切だ。", "en": "It goes without saying that health matters most.", "grammar": "〜までもない", "focus": "健康"},
    {"jp": "上司に言われるままに、書類を作った。", "en": "I made the documents just as my boss told me to.", "grammar": "〜ままに", "focus": "書類"},
    {"jp": "彼が来ようが来まいが、会議は始める。", "en": "Whether he comes or not, the meeting will start.", "grammar": "〜ようが〜まいが", "focus": "会議"},
    {"jp": "熱があって、起きようにも起きられない。", "en": "With a fever, I could not get up even if I tried.", "grammar": "〜ようにも〜ない", "focus": "熱"},
    {"jp": "少しでも遅れようものなら、すぐに怒られる。", "en": "If you dare be even a little late, you get told off at once.", "grammar": "〜ようものなら", "focus": "遅れる"},
    {"jp": "親がいないのをいいことに、夜中まで遊んだ。", "en": "Taking advantage of the parents being away, they played until midnight.", "grammar": "〜をいいことに", "focus": "夜中"},
    {"jp": "周囲の心配をよそに、彼は一人で旅に出た。", "en": "Ignoring the worries of those around him, he set off travelling alone.", "grammar": "〜をよそに", "focus": "旅"},
    {"jp": "彼の話には涙を禁じ得なかった。", "en": "I could not hold back my tears at his story.", "grammar": "〜を禁じ得ない", "focus": "涙"},
    {"jp": "前回の反省を踏まえて、計画を立て直した。", "en": "Taking the lessons of last time into account, we redrew the plan.", "grammar": "〜を踏まえて", "focus": "反省"},
    {"jp": "今日を限りに、たばこをやめる。", "en": "As of today, I am giving up smoking.", "grammar": "〜を限りに", "focus": "たばこ"},
    {"jp": "勝たんがために、彼は手段を選ばなかった。", "en": "In order to win, he did not care what means he used.", "grammar": "〜んがため", "focus": "手段"},
    {"jp": "部屋にはごみ一つ落ちていない。", "en": "There is not a single piece of rubbish on the floor of the room.", "grammar": "〜一つ〜ない", "focus": "ごみ"},
    {"jp": "自分で言い出した手前、途中でやめるわけにはいかない。", "en": "Having proposed it myself, I cannot very well quit halfway.", "grammar": "〜手前", "focus": "途中"},
]

BY_LEVEL: dict[str, list[dict]] = {"N5": N5, "N4": N4, "N3": N3, "N2": N2, "N1": N1}


def patterns_for(level: str) -> set[str]:
    """Every grammar pattern the catalogue teaches at `level`."""
    return {p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL.get(level, [])}


def problems() -> list[str]:
    """Everything wrong with the bank, as human-readable lines.

    Lives here rather than only in the test so the bank can be checked
    from a shell while it is being written -- which is how it was
    written. Empty means every sentence passes every rule in the module
    docstring.
    """
    from study import difficulty as D
    from study.grammar_match import contains_pattern, verifiable

    out: list[str] = []
    for level, rows in BY_LEVEL.items():
        catalogue = patterns_for(level)
        for i, row in enumerate(rows):
            jp, en, pattern = row["jp"], row.get("en", ""), row.get("grammar", "")
            where = f"{level}[{i}] {jp}"
            if not en.strip():
                out.append(f"{where}: no translation")
            if pattern not in catalogue:
                out.append(f"{where}: {pattern!r} is not a {level} point")
            elif verifiable(pattern) and not contains_pattern(jp, pattern):
                out.append(f"{where}: does not contain {pattern!r}")
            # The point's own characters are exempt from the kanji gate --
            # see difficulty.report's allow_kanji.
            verdict = D.report(jp, level, allow_kanji=pattern)
            for key in ("kanji", "grammar", "vocab"):
                if verdict[key]:
                    out.append(f"{where}: {key} above {level}: {verdict[key]}")
            if verdict["too_long"]:
                out.append(f"{where}: {verdict['too_long']} chars, cap is {D.MAX_CHARS[level]}")
    return out
