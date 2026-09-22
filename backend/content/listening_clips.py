"""
The listening collection — the lines 書取 (dictation) plays, one bank per
JLPT level.

── Why this is its own bank ──────────────────────────────────
content/reading_sentences.py already holds a curated, level-checked
sentence bank, and dictation could in principle have drawn from it. It
does not, because the two banks are written for different organs.

A reading sentence is written for the EYE: it may lean on kanji to carry
meaning (漢字 tells you what 感じ does not), it may be as long as the
level's cap allows, and a reader can go back over it as many times as
they like. A dictation line is written for the EAR and heard at most
twice (see study/dictation.py): it has to be holdable in working memory
in one pass, it must not turn on a homophone the ear cannot resolve
without the writing, and its rhythm matters — a line that reads well and
scans badly is a bad clip.

So these are short, spoken, everyday lines: the sort of thing said at a
counter, on a platform, or across a desk. They get longer per level the
way a real 聴解 section does, never past what one listen can hold.

── Shape ─────────────────────────────────────────────────────
    {"jp": ..., "kana": ..., "romaji": ..., "en": ...}

`jp`   the written form. This is the transcription the learner is aiming
       at, and it is also the text handed to the synthesizer — edge-tts
       reads kanji with the right segmentation and pitch, where a
       kana-only string comes out flat and occasionally mis-parsed.
`kana` the same line with every kanji replaced by its reading, katakana
       left as katakana. An accepted answer in its own right: a learner
       who hears the line and writes it in kana has done the exercise.
       It is also what the furigana is built from, and what the romaji
       below was written from.
`romaji`
       the line as it is SAID, word-spaced, with the particles by sound
       (は wa, へ e, を o). This is the form most learners will answer
       in — a Japanese keyboard is a separate install on a laptop and a
       separate keyboard on a phone, and a beginner has not got that far
       — so it is the reference the screen shows and the accuracy figure
       measures against.

       Hand-written rather than generated, for the reason to_romaji's
       own docstring gives: pykakasi reads kanji without context and
       gets 21 of these 92 lines wrong (十時 as "totoki", 人 as "nin").
       Generating from `kana` fixes the readings but writes the
       particles as spelled rather than as said and cannot space the
       words. problems() checks every one of these against the kana
       mechanically, so a typo here cannot go unnoticed.
`en`   an English gloss, shown with the answer. English only, like the
       reading bank — this app has no French translation layer for its
       sentence data, and the frontend labels it as English rather than
       implying otherwise (see routes/reading.py's `translation_lang`).

── The rules each line follows ───────────────────────────────
Enforced by tests/test_listening_clips.py through problems() below:

  * every kanji is in the level's cumulative set (study/difficulty)
  * `kana` is kana and punctuation, nothing else
  * every non-kanji character of `jp` appears in `kana`, in order — the
    one automatic check that catches a mistyped reading
  * `romaji` says what `kana` says, allowing only the particle
    substitutions above
  * the line is within the level's spoken-length cap
  * no line appears twice, at any level

The kanji check is the same gate content/reading_sentences.py passes.
The subsequence check is this bank's own: a reading is data nothing else
can verify, and a wrong one silently marks a correct answer wrong.
"""
import re

from study.difficulty import kanji_over_level
from study.romaji import fold, to_romaji

# How many kana one listen may have to hold. Not a style preference: the
# whole exercise is transcription from memory, so the cap is the working
# -memory budget, and it is the reason these are shorter than the
# reading bank's sentences at the same level (N5 26 chars there).
LENGTH_CAP = {"N5": 24, "N4": 30, "N3": 36, "N2": 44, "N1": 52}

# ── N5 ────────────────────────────────────────────────────────
# Counter Japanese: times, prices, directions, the sentences a first
# week actually needs to catch. Nothing here turns on a particle a
# beginner cannot hear.
N5 = [
    {"jp": "学校は九時からです。",
     "kana": "がっこうはくじからです。",
     "romaji": "gakkou wa kuji kara desu",
     "en": "School starts at nine."},
    {"jp": "毎日、日本語を話します。",
     "kana": "まいにち、にほんごをはなします。",
     "romaji": "mainichi, nihongo o hanashimasu",
     "en": "I speak Japanese every day."},
    {"jp": "駅の前で友だちに会います。",
     "kana": "えきのまえでともだちにあいます。",
     "romaji": "eki no mae de tomodachi ni aimasu",
     "en": "I'm meeting a friend in front of the station."},
    {"jp": "あしたの天気は雨です。",
     "kana": "あしたのてんきはあめです。",
     "romaji": "ashita no tenki wa ame desu",
     "en": "Tomorrow's weather is rain."},
    {"jp": "電車は十時半に出ます。",
     "kana": "でんしゃはじゅうじはんにでます。",
     "romaji": "densha wa juuji han ni demasu",
     "en": "The train leaves at half past ten."},
    {"jp": "この魚はとても大きいです。",
     "kana": "このさかなはとてもおおきいです。",
     "romaji": "kono sakana wa totemo ookii desu",
     "en": "This fish is very big."},
    {"jp": "あした本を買いに行きます。",
     "kana": "あしたほんをかいにいきます。",
     "romaji": "ashita hon o kai ni ikimasu",
     "en": "I'm going to buy a book tomorrow."},
    {"jp": "白いくつが安かったです。",
     "kana": "しろいくつがやすかったです。",
     "romaji": "shiroi kutsu ga yasukatta desu",
     "en": "The white shoes were cheap."},
    {"jp": "六時にごはんを食べます。",
     "kana": "ろくじにごはんをたべます。",
     "romaji": "rokuji ni gohan o tabemasu",
     "en": "I eat dinner at six."},
    {"jp": "先生は今、学校にいます。",
     "kana": "せんせいはいま、がっこうにいます。",
     "romaji": "sensei wa ima, gakkou ni imasu",
     "en": "The teacher is at school now."},
    {"jp": "休みの日に山へ行きます。",
     "kana": "やすみのひにやまへいきます。",
     "romaji": "yasumi no hi ni yama e ikimasu",
     "en": "I go to the mountains on my days off."},
    {"jp": "たくさん水を飲んでください。",
     "kana": "たくさんみずをのんでください。",
     "romaji": "takusan mizu o nonde kudasai",
     "en": "Please drink plenty of water."},
    {"jp": "この道を右に行ってください。",
     "kana": "このみちをみぎにいってください。",
     "romaji": "kono michi o migi ni itte kudasai",
     "en": "Please go right along this street."},
    {"jp": "新しい店で花を買いました。",
     "kana": "あたらしいみせではなをかいました。",
     "romaji": "atarashii mise de hana o kaimashita",
     "en": "I bought flowers at the new shop."},
    {"jp": "父は車で会社へ行きます。",
     "kana": "ちちはくるまでかいしゃへいきます。",
     "romaji": "chichi wa kuruma de kaisha e ikimasu",
     "en": "My father goes to the office by car."},
    {"jp": "小さい子どもが三人います。",
     "kana": "ちいさいこどもがさんにんいます。",
     "romaji": "chiisai kodomo ga sannin imasu",
     "en": "There are three small children."},
    {"jp": "あの人は何と言いましたか。",
     "kana": "あのひとはなんといいましたか。",
     "romaji": "ano hito wa nan to iimashita ka",
     "en": "What did that person say?"},
    {"jp": "来週、友だちが来ます。",
     "kana": "らいしゅう、ともだちがきます。",
     "romaji": "raishuu, tomodachi ga kimasu",
     "en": "A friend is coming next week."},
    {"jp": "大学の名前を書いてください。",
     "kana": "だいがくのなまえをかいてください。",
     "romaji": "daigaku no namae o kaite kudasai",
     "en": "Please write the name of your university."},
    {"jp": "あの高い山が見えますか。",
     "kana": "あのたかいやまがみえますか。",
     "romaji": "ano takai yama ga miemasu ka",
     "en": "Can you see that tall mountain?"},
    # ── Plan 111: a second sitting's worth, same rules as the lines above. ──
    {"jp": "水を一本ください。",
     "kana": "みずをいっぽんください。",
     "romaji": "mizu o ippon kudasai",
     "en": "One bottle of water, please."},
    {"jp": "今日は何よう日ですか。",
     "kana": "きょうはなんようびですか。",
     "romaji": "kyou wa nan youbi desu ka",
     "en": "What day of the week is it today?"},
    {"jp": "トイレはどこですか。",
     "kana": "トイレはどこですか。",
     "romaji": "toire wa doko desu ka",
     "en": "Where is the toilet?"},
    {"jp": "この本は五百円です。",
     "kana": "このほんはごひゃくえんです。",
     "romaji": "kono hon wa gohyaku en desu",
     "en": "This book is five hundred yen."},
    {"jp": "毎日、六時におきます。",
     "kana": "まいにち、ろくじにおきます。",
     "romaji": "mainichi, rokuji ni okimasu",
     "en": "I get up at six every day."},
    {"jp": "日本語の本を読みます。",
     "kana": "にほんごのほんをよみます。",
     "romaji": "nihongo no hon o yomimasu",
     "en": "I read Japanese books."},
    {"jp": "父は会社にいます。",
     "kana": "ちちはかいしゃにいます。",
     "romaji": "chichi wa kaisha ni imasu",
     "en": "My father is at the office."},
    {"jp": "駅までバスで十分です。",
     "kana": "えきまでバスでじゅっぷんです。",
     "romaji": "eki made basu de juppun desu",
     "en": "It is ten minutes to the station by bus."},
    {"jp": "山の上はさむいです。",
     "kana": "やまのうえはさむいです。",
     "romaji": "yama no ue wa samui desu",
     "en": "It is cold on top of the mountain."},
    {"jp": "友だちと電話で話します。",
     "kana": "ともだちとでんわではなします。",
     "romaji": "tomodachi to denwa de hanashimasu",
     "en": "I talk with my friend on the phone."},
    {"jp": "新しい先生は男の人です。",
     "kana": "あたらしいせんせいはおとこのひとです。",
     "romaji": "atarashii sensei wa otoko no hito desu",
     "en": "The new teacher is a man."},
    {"jp": "今、何時ですか。",
     "kana": "いま、なんじですか。",
     "romaji": "ima, nanji desu ka",
     "en": "What time is it now?"},
]

# ── N4 ────────────────────────────────────────────────────────
# Two clauses now, and the て-form joins them — which is where a
# listener starts having to hold the first half while the second
# arrives.
N4 = [
    {"jp": "昼ごはんの後で、映画を見に行きませんか。",
     "kana": "ひるごはんのあとで、えいがをみにいきませんか。",
     "romaji": "hirugohan no ato de, eiga o mi ni ikimasen ka",
     "en": "Shall we go see a film after lunch?"},
    {"jp": "駅の近くに新しい病院ができました。",
     "kana": "えきのちかくにあたらしいびょういんができました。",
     "romaji": "eki no chikaku ni atarashii byouin ga dekimashita",
     "en": "A new hospital has opened near the station."},
    {"jp": "わたしは毎朝、犬と歩きます。",
     "kana": "わたしはまいあさ、いぬとあるきます。",
     "romaji": "watashi wa maiasa, inu to arukimasu",
     "en": "I walk with my dog every morning."},
    {"jp": "旅行に行きたいと思っています。",
     "kana": "りょこうにいきたいとおもっています。",
     "romaji": "ryokou ni ikitai to omotte imasu",
     "en": "I'm thinking I'd like to go on a trip."},
    {"jp": "夏休みには家族と海へ行きます。",
     "kana": "なつやすみにはかぞくとうみへいきます。",
     "romaji": "natsuyasumi ni wa kazoku to umi e ikimasu",
     "en": "Over the summer holidays I go to the sea with my family."},
    {"jp": "この漢字の読み方を教えてください。",
     "kana": "このかんじのよみかたをおしえてください。",
     "romaji": "kono kanji no yomikata o oshiete kudasai",
     "en": "Please teach me how to read this kanji."},
    {"jp": "妹は英語がとても上手です。",
     "kana": "いもうとはえいごがとてもじょうずです。",
     "romaji": "imouto wa eigo ga totemo jouzu desu",
     "en": "My younger sister is very good at English."},
    {"jp": "朝早く起きて、勉強を始めました。",
     "kana": "あさはやくおきて、べんきょうをはじめました。",
     "romaji": "asa hayaku okite, benkyou o hajimemashita",
     "en": "I got up early and started studying."},
    {"jp": "この赤い服は少し高いと思います。",
     "kana": "このあかいふくはすこしたかいとおもいます。",
     "romaji": "kono akai fuku wa sukoshi takai to omoimasu",
     "en": "I think these red clothes are a little expensive."},
    {"jp": "先週、あの店で写真をたくさん写しました。",
     "kana": "せんしゅう、あのみせでしゃしんをたくさんうつしました。",
     "romaji": "senshuu, ano mise de shashin o takusan utsushimashita",
     "en": "Last week I took a lot of photos at that shop."},
    {"jp": "地図を見ながら、駅まで歩きました。",
     "kana": "ちずをみながら、えきまであるきました。",
     "romaji": "chizu o minagara, eki made arukimashita",
     "en": "I walked to the station while looking at a map."},
    {"jp": "銀行は何時に開きますか。",
     "kana": "ぎんこうはなんじにひらきますか。",
     "romaji": "ginkou wa nanji ni hirakimasu ka",
     "en": "What time does the bank open?"},
    {"jp": "弟は音楽を聞きながら、料理を作ります。",
     "kana": "おとうとはおんがくをききながら、りょうりをつくります。",
     "romaji": "otouto wa ongaku o kikinagara, ryouri o tsukurimasu",
     "en": "My younger brother cooks while listening to music."},
    {"jp": "秋になると、山がきれいになります。",
     "kana": "あきになると、やまがきれいになります。",
     "romaji": "aki ni naru to, yama ga kirei ni narimasu",
     "en": "When autumn comes, the mountains become beautiful."},
    {"jp": "あの人は世界中を旅しています。",
     "kana": "あのひとはせかいじゅうをたびしています。",
     "romaji": "ano hito wa sekaijuu o tabi shite imasu",
     "en": "That person is travelling all over the world."},
    {"jp": "試験の前に、たくさん勉強しました。",
     "kana": "しけんのまえに、たくさんべんきょうしました。",
     "romaji": "shiken no mae ni, takusan benkyou shimashita",
     "en": "I studied a lot before the exam."},
    {"jp": "体が悪いので、今日は休みます。",
     "kana": "からだがわるいので、きょうはやすみます。",
     "romaji": "karada ga warui node, kyou wa yasumimasu",
     "en": "I'm not feeling well, so I'm taking today off."},
    {"jp": "田中さんは親切な人だと思います。",
     "kana": "たなかさんはしんせつなひとだとおもいます。",
     "romaji": "tanaka-san wa shinsetsu na hito da to omoimasu",
     "en": "I think Tanaka is a kind person."},
    # ── Plan 111: a second sitting's worth, same rules as the lines above. ──
    {"jp": "来週の集まりは三時に始まります。",
     "kana": "らいしゅうのあつまりはさんじにはじまります。",
     "romaji": "raishuu no atsumari wa sanji ni hajimarimasu",
     "en": "Next week's gathering starts at three."},
    {"jp": "母に電話するのをわすれました。",
     "kana": "ははにでんわするのをわすれました。",
     "romaji": "haha ni denwa suru no o wasuremashita",
     "en": "I forgot to call my mother."},
    {"jp": "この道をまっすぐ行くと、銀行があります。",
     "kana": "このみちをまっすぐいくと、ぎんこうがあります。",
     "romaji": "kono michi o massugu iku to, ginkou ga arimasu",
     "en": "Go straight along this road and there is a bank."},
    {"jp": "図書館で本を借りました。",
     "kana": "としょかんでほんをかりました。",
     "romaji": "toshokan de hon o karimashita",
     "en": "I borrowed a book from the library."},
    {"jp": "雨がやんだら、買い物に行きましょう。",
     "kana": "あめがやんだら、かいものにいきましょう。",
     "romaji": "ame ga yandara, kaimono ni ikimashou",
     "en": "When the rain stops, let's go shopping."},
    {"jp": "夏休みに家族と旅行しました。",
     "kana": "なつやすみにかぞくとりょこうしました。",
     "romaji": "natsuyasumi ni kazoku to ryokou shimashita",
     "en": "I travelled with my family in the summer holidays."},
    {"jp": "明日の朝、駅で待っています。",
     "kana": "あしたのあさ、えきでまっています。",
     "romaji": "ashita no asa, eki de matte imasu",
     "en": "I will be waiting at the station tomorrow morning."},
    {"jp": "田中さんは今、電話中です。",
     "kana": "たなかさんはいま、でんわちゅうです。",
     "romaji": "tanaka san wa ima, denwa chuu desu",
     "en": "Mr Tanaka is on the phone right now."},
    {"jp": "医者にくすりをもらいました。",
     "kana": "いしゃにくすりをもらいました。",
     "romaji": "isha ni kusuri o moraimashita",
     "en": "I got some medicine from the doctor."},
    {"jp": "音楽を聞きながら勉強します。",
     "kana": "おんがくをききながらべんきょうします。",
     "romaji": "ongaku o kikinagara benkyou shimasu",
     "en": "I study while listening to music."},
    {"jp": "映画は何時に終わりますか。",
     "kana": "えいがはなんじにおわりますか。",
     "romaji": "eiga wa nanji ni owarimasu ka",
     "en": "What time does the film end?"},
    {"jp": "日曜日は天気が悪くなるそうです。",
     "kana": "にちようびはてんきがわるくなるそうです。",
     "romaji": "nichiyoubi wa tenki ga waruku naru sou desu",
     "en": "I hear the weather will turn bad on Sunday."},
]

# ── N3 ────────────────────────────────────────────────────────
# Reported speech, reasons, and the polite hedges — the register of an
# announcement or an apology, where the verb that decides the meaning
# arrives last.
N3 = [
    {"jp": "電車が遅れたので、待ち合わせの時間に間に合いませんでした。",
     "kana": "でんしゃがおくれたので、まちあわせのじかんにまにあいませんでした。",
     "romaji": "densha ga okureta node, machiawase no jikan ni ma ni aimasen deshita",
     "en": "The train was late, so I didn't make it in time for our meeting."},
    {"jp": "彼は経験が多いので、この仕事に向いていると思います。",
     "kana": "かれはけいけんがおおいので、このしごとにむいているとおもいます。",
     "romaji": "kare wa keiken ga ooi node, kono shigoto ni muite iru to omoimasu",
     "en": "He has a lot of experience, so I think he's suited to this job."},
    {"jp": "天気予報によると、明日は雪が降るそうです。",
     "kana": "てんきよほうによると、あしたはゆきがふるそうです。",
     "romaji": "tenki yohou ni yoru to, ashita wa yuki ga furu sou desu",
     "en": "According to the forecast, it will snow tomorrow."},
    {"jp": "この道は工事中なので、通れません。",
     "kana": "このみちはこうじちゅうなので、とおれません。",
     "romaji": "kono michi wa kouji chuu na node, tooremasen",
     "en": "This street is under construction, so you can't get through."},
    {"jp": "大学を出てから、東京で働くつもりです。",
     "kana": "だいがくをでてから、とうきょうではたらくつもりです。",
     "romaji": "daigaku o dete kara, toukyou de hataraku tsumori desu",
     "en": "After I finish university I intend to work in Tokyo."},
    {"jp": "さいふを落として、とても困っています。",
     "kana": "さいふをおとして、とてもこまっています。",
     "romaji": "saifu o otoshite, totemo komatte imasu",
     "en": "I dropped my wallet and I'm in real trouble."},
    {"jp": "約束の時間に遅れて、本当にすみませんでした。",
     "kana": "やくそくのじかんにおくれて、ほんとうにすみませんでした。",
     "romaji": "yakusoku no jikan ni okurete, hontou ni sumimasen deshita",
     "en": "I'm truly sorry for being late for our appointment."},
    {"jp": "熱があるようなので、今日は早く帰ります。",
     "kana": "ねつがあるようなので、きょうははやくかえります。",
     "romaji": "netsu ga aru you na node, kyou wa hayaku kaerimasu",
     "en": "I seem to have a fever, so I'm going home early today."},
    {"jp": "会議は三時から始まる予定です。",
     "kana": "かいぎはさんじからはじまるよていです。",
     "romaji": "kaigi wa sanji kara hajimaru yotei desu",
     "en": "The meeting is scheduled to start at three."},
    {"jp": "必要な書類を全部そろえてください。",
     "kana": "ひつようなしょるいをぜんぶそろえてください。",
     "romaji": "hitsuyou na shorui o zenbu soroete kudasai",
     "en": "Please gather all the necessary documents."},
    {"jp": "来月の引っ越しの日がやっと決まりました。",
     "kana": "らいげつのひっこしのひがやっときまりました。",
     "romaji": "raigetsu no hikkoshi no hi ga yatto kimarimashita",
     "en": "The date of next month's move has finally been decided."},
    {"jp": "この道具の使い方が分かりません。",
     "kana": "このどうぐのつかいかたがわかりません。",
     "romaji": "kono dougu no tsukaikata ga wakarimasen",
     "en": "I don't know how to use this tool."},
    {"jp": "彼女は歌が上手で、みんなに人気があります。",
     "kana": "かのじょはうたがじょうずで、みんなににんきがあります。",
     "romaji": "kanojo wa uta ga jouzu de, minna ni ninki ga arimasu",
     "en": "She sings well and is popular with everyone."},
    {"jp": "たばこを吸ってもいいか、店の人に聞いてみます。",
     "kana": "たばこをすってもいいか、みせのひとにきいてみます。",
     "romaji": "tabako o suttemo ii ka, mise no hito ni kiite mimasu",
     "en": "I'll ask the shop staff whether smoking is allowed."},
    {"jp": "最近、仕事が忙しくて、なかなか休めません。",
     "kana": "さいきん、しごとがいそがしくて、なかなかやすめません。",
     "romaji": "saikin, shigoto ga isogashikute, nakanaka yasumemasen",
     "en": "Work has been busy lately and I can hardly take a break."},
    {"jp": "その説明は分かりやすくて、とても助かりました。",
     "kana": "そのせつめいはわかりやすくて、とてもたすかりました。",
     "romaji": "sono setsumei wa wakariyasukute, totemo tasukarimashita",
     "en": "That explanation was easy to follow and a real help."},
    {"jp": "窓を閉めてから、部屋を出てください。",
     "kana": "まどをしめてから、へやをでてください。",
     "romaji": "mado o shimete kara, heya o dete kudasai",
     "en": "Please close the window before leaving the room."},
    {"jp": "この店は値段が安くて、味もいいです。",
     "kana": "このみせはねだんがやすくて、あじもいいです。",
     "romaji": "kono mise wa nedan ga yasukute, aji mo ii desu",
     "en": "This place is cheap and the food is good too."},
    # ── Plan 111: a second sitting's worth, same rules as the lines above. ──
    {"jp": "会議の資料を明日までに送ってください。",
     "kana": "かいぎのしりょうをあしたまでにおくってください。",
     "romaji": "kaigi no shiryou o ashita made ni okutte kudasai",
     "en": "Please send the meeting documents by tomorrow."},
    {"jp": "電車が遅れて、約束の時間に間に合いませんでした。",
     "kana": "でんしゃがおくれて、やくそくのじかんにまにあいませんでした。",
     "romaji": "densha ga okurete, yakusoku no jikan ni maniaimasen deshita",
     "en": "The train was late and I did not make it in time for the appointment."},
    {"jp": "この店は、日曜日になると必ず人でいっぱいです。",
     "kana": "このみせは、にちようびになるとかならずひとでいっぱいです。",
     "romaji": "kono mise wa, nichiyoubi ni naru to kanarazu hito de ippai desu",
     "en": "This shop is always packed on Sundays."},
    {"jp": "台風のため、今日の試合は中止になりました。",
     "kana": "たいふうのため、きょうのしあいはちゅうしになりました。",
     "romaji": "taifuu no tame, kyou no shiai wa chuushi ni narimashita",
     "en": "Because of the typhoon, today's match has been cancelled."},
    {"jp": "新しい部長は、とても親切な人だそうです。",
     "kana": "あたらしいぶちょうは、とてもしんせつなひとだそうです。",
     "romaji": "atarashii buchou wa, totemo shinsetsu na hito da sou desu",
     "en": "I hear the new manager is a very kind person."},
    {"jp": "駅前に大きな病院ができるらしいです。",
     "kana": "えきまえにおおきなびょういんができるらしいです。",
     "romaji": "ekimae ni ookina byouin ga dekiru rashii desu",
     "en": "Apparently a big hospital is being built in front of the station."},
    {"jp": "困ったときは、一人で考えないで相談してください。",
     "kana": "こまったときは、ひとりでかんがえないでそうだんしてください。",
     "romaji": "komatta toki wa, hitori de kangaenaide soudan shite kudasai",
     "en": "When you are in trouble, don't brood alone; ask for advice."},
    {"jp": "体のために、毎朝三十分歩いています。",
     "kana": "からだのために、まいあささんじゅっぷんあるいています。",
     "romaji": "karada no tame ni, maiasa sanjuppun aruite imasu",
     "en": "For my health I walk thirty minutes every morning."},
    {"jp": "この問題は難しすぎて、だれにも解けません。",
     "kana": "このもんだいはむずかしすぎて、だれにもとけません。",
     "romaji": "kono mondai wa muzukashisugite, dare ni mo tokemasen",
     "en": "This problem is too hard for anyone to solve."},
    {"jp": "京都では古い建物をたくさん見ることができます。",
     "kana": "きょうとではふるいたてものをたくさんみることができます。",
     "romaji": "kyouto de wa furui tatemono o takusan miru koto ga dekimasu",
     "en": "In Kyoto you can see many old buildings."},
    {"jp": "会社を辞めて、自分の店を開くつもりです。",
     "kana": "かいしゃをやめて、じぶんのみせをひらくつもりです。",
     "romaji": "kaisha o yamete, jibun no mise o hiraku tsumori desu",
     "en": "I plan to leave the company and open my own shop."},
    {"jp": "最近、休みの日も働く人が増えています。",
     "kana": "さいきん、やすみのひもはたらくひとがふえています。",
     "romaji": "saikin, yasumi no hi mo hataraku hito ga fuete imasu",
     "en": "Lately more and more people work on their days off too."},
]

# ── N2 ────────────────────────────────────────────────────────
# The register of the news and the workplace: passives, compound nouns,
# and a subject that is often a thing rather than a person.
N2 = [
    {"jp": "来月から新しい制度が導入されることになりました。",
     "kana": "らいげつからあたらしいせいどがどうにゅうされることになりました。",
     "romaji": "raigetsu kara atarashii seido ga dounyuu sareru koto ni narimashita",
     "en": "A new system will be introduced from next month."},
    {"jp": "駅前の再開発が進んで、町の様子が変わりました。",
     "kana": "えきまえのさいかいはつがすすんで、まちのようすがかわりました。",
     "romaji": "ekimae no saikaihatsu ga susunde, machi no yousu ga kawarimashita",
     "en": "Redevelopment by the station has progressed and the town looks different."},
    {"jp": "この資料は会議の前に全員に配っておいてください。",
     "kana": "このしりょうはかいぎのまえにぜんいんにくばっておいてください。",
     "romaji": "kono shiryou wa kaigi no mae ni zen'in ni kubatte oite kudasai",
     "en": "Please hand these documents out to everyone before the meeting."},
    {"jp": "気温が下がると道路が凍るので、注意してください。",
     "kana": "きおんがさがるとどうろがこおるので、ちゅういしてください。",
     "romaji": "kion ga sagaru to douro ga kooru node, chuui shite kudasai",
     "en": "The roads freeze when the temperature drops, so please take care."},
    {"jp": "先週の台風で、この地域の農業に大きな被害が出ました。",
     "kana": "せんしゅうのたいふうで、このちいきののうぎょうにおおきなひがいがでました。",
     "romaji": "senshuu no taifuu de, kono chiiki no nougyou ni ookina higai ga demashita",
     "en": "Last week's typhoon did great damage to farming in this area."},
    {"jp": "予約の変更は前日までにお願いいたします。",
     "kana": "よやくのへんこうはぜんじつまでにおねがいいたします。",
     "romaji": "yoyaku no henkou wa zenjitsu made ni onegai itashimasu",
     "en": "Please make any change to your booking by the day before."},
    {"jp": "彼の説明は分かりやすく、質問する必要もありませんでした。",
     "kana": "かれのせつめいはわかりやすく、しつもんするひつようもありませんでした。",
     "romaji": "kare no setsumei wa wakariyasuku, shitsumon suru hitsuyou mo arimasen deshita",
     "en": "His explanation was clear; there was no need to ask anything."},
    {"jp": "税金の計算が複雑なので、係の人に相談しました。",
     "kana": "ぜいきんのけいさんがふくざつなので、かかりのひとにそうだんしました。",
     "romaji": "zeikin no keisan ga fukuzatsu na node, kakari no hito ni soudan shimashita",
     "en": "The tax calculation is complicated, so I consulted the clerk."},
    {"jp": "工場の機械が動かなくなって、生産が止まりました。",
     "kana": "こうじょうのきかいがうごかなくなって、せいさんがとまりました。",
     "romaji": "koujou no kikai ga ugokanaku natte, seisan ga tomarimashita",
     "en": "The factory machinery stopped working and production halted."},
    {"jp": "森や川を守るために、みんなで協力しましょう。",
     "kana": "もりやかわをまもるために、みんなできょうりょくしましょう。",
     "romaji": "mori ya kawa o mamoru tame ni, minna de kyouryoku shimashou",
     "en": "Let's all work together to protect the forests and rivers."},
    {"jp": "この薬は食後に飲むように、医者に言われました。",
     "kana": "このくすりはしょくごにのむように、いしゃにいわれました。",
     "romaji": "kono kusuri wa shokugo ni nomu you ni, isha ni iwaremashita",
     "en": "The doctor told me to take this medicine after meals."},
    {"jp": "輸入された果物の値段が、去年より上がっています。",
     "kana": "ゆにゅうされたくだもののねだんが、きょねんよりあがっています。",
     "romaji": "yunyuu sareta kudamono no nedan ga, kyonen yori agatte imasu",
     "en": "The price of imported fruit is higher than last year."},
    {"jp": "今度の日曜日、近所の公園で祭りが行われるそうです。",
     "kana": "こんどのにちようび、きんじょのこうえんでまつりがおこなわれるそうです。",
     "romaji": "kondo no nichiyoubi, kinjo no kouen de matsuri ga okonawareru sou desu",
     "en": "They say a festival will be held in the local park this Sunday."},
    {"jp": "部長は今、旅行中なので、来週まで会社に戻りません。",
     "kana": "ぶちょうはいま、りょこうちゅうなので、らいしゅうまでかいしゃにもどりません。",
     "romaji": "buchou wa ima, ryokou chuu na node, raishuu made kaisha ni modorimasen",
     "en": "The manager is travelling, so he won't be back at the office until next week."},
    {"jp": "郵便局で荷物を送るとき、住所を確かめてください。",
     "kana": "ゆうびんきょくでにもつをおくるとき、じゅうしょをたしかめてください。",
     "romaji": "yuubinkyoku de nimotsu o okuru toki, juusho o tashikamete kudasai",
     "en": "When you send a parcel at the post office, please check the address."},
    {"jp": "景気が悪くなって、失業する人が増えています。",
     "kana": "けいきがわるくなって、しつぎょうするひとがふえています。",
     "romaji": "keiki ga waruku natte, shitsugyou suru hito ga fuete imasu",
     "en": "The economy has worsened and more people are losing their jobs."},
    {"jp": "線路に人が入ったため、電車が一時停止しました。",
     "kana": "せんろにひとがはいったため、でんしゃがいちじていししました。",
     "romaji": "senro ni hito ga haitta tame, densha ga ichiji teishi shimashita",
     "en": "Someone entered the tracks, so the train stopped temporarily."},
    {"jp": "この機会に、自分の将来について真面目に考えたいと思います。",
     "kana": "このきかいに、じぶんのしょうらいについてまじめにかんがえたいとおもいます。",
     "romaji": "kono kikai ni, jibun no shourai ni tsuite majime ni kangaetai to omoimasu",
     "en": "I'd like to take this chance to think seriously about my future."},
    # ── Plan 111: a second sitting's worth, same rules as the lines above. ──
    {"jp": "もうしわけありませんが、本日は休みでございます。",
     "kana": "もうしわけありませんが、ほんじつはやすみでございます。",
     "romaji": "moushiwake arimasen ga, honjitsu wa yasumi de gozaimasu",
     "en": "We are sorry, but we are closed today."},
    {"jp": "この商品は、かんきょうのことを考えて作られています。",
     "kana": "このしょうひんは、かんきょうのことをかんがえてつくられています。",
     "romaji": "kono shouhin wa, kankyou no koto o kangaete tsukurarete imasu",
     "en": "This product is made with the environment in mind."},
    {"jp": "会議の内容については、明日ご報告いたします。",
     "kana": "かいぎのないようについては、あしたごほうこくいたします。",
     "romaji": "kaigi no naiyou ni tsuite wa, ashita go-houkoku itashimasu",
     "en": "I will report on the content of the meeting tomorrow."},
    {"jp": "天気予報によると、明日は全国でよく晴れるでしょう。",
     "kana": "てんきよほうによると、あしたはぜんこくでよくはれるでしょう。",
     "romaji": "tenki yohou ni yoru to, ashita wa zenkoku de yoku hareru deshou",
     "en": "According to the forecast, it will be sunny nationwide tomorrow."},
    {"jp": "彼は失敗を恐れず、新しいことに取り組み続けた。",
     "kana": "かれはしっぱいをおそれず、あたらしいことにとりくみつづけた。",
     "romaji": "kare wa shippai o osorezu, atarashii koto ni torikumi tsuzuketa",
     "en": "Unafraid of failure, he kept taking on new things."},
    {"jp": "駅周辺の再開発が来年から始まる予定です。",
     "kana": "えきしゅうへんのさいかいはつがらいねんからはじまるよていです。",
     "romaji": "eki shuuhen no saikaihatsu ga rainen kara hajimaru yotei desu",
     "en": "Redevelopment around the station is due to begin next year."},
    {"jp": "お客様のご意見を参考に、サービスの向上を進めています。",
     "kana": "おきゃくさまのごいけんをさんこうに、サービスのこうじょうをすすめています。",
     "romaji": "okyakusama no go-iken o sankou ni, saabisu no koujou o susumete imasu",
     "en": "We are improving our service, drawing on our customers' feedback."},
    {"jp": "この地域では、お年寄りの割合が急速に増えている。",
     "kana": "このちいきでは、おとしよりのわりあいがきゅうそくにふえている。",
     "romaji": "kono chiiki de wa, otoshiyori no wariai ga kyuusoku ni fuete iru",
     "en": "In this area the proportion of elderly people is rising rapidly."},
    {"jp": "期限が近いので、今週は残業が続きそうだ。",
     "kana": "きげんがちかいので、こんしゅうはざんぎょうがつづきそうだ。",
     "romaji": "kigen ga chikai node, konshuu wa zangyou ga tsuzuki sou da",
     "en": "The deadline is close, so overtime looks set to continue this week."},
    {"jp": "事件については、現在も調査が続いているとのことです。",
     "kana": "じけんについては、げんざいもちょうさがつづいているとのことです。",
     "romaji": "jiken ni tsuite wa, genzai mo chousa ga tsuzuite iru to no koto desu",
     "en": "As for the incident, the investigation is said to be still ongoing."},
    {"jp": "新しい制度は、多くの人に受け入れられている。",
     "kana": "あたらしいせいどは、おおくのひとにうけいれられている。",
     "romaji": "atarashii seido wa, ooku no hito ni ukeirerarete iru",
     "en": "The new system has been accepted by many people."},
    {"jp": "面接では、自分の長所をくわしく話してください。",
     "kana": "めんせつでは、じぶんのちょうしょをくわしくはなしてください。",
     "romaji": "mensetsu de wa, jibun no chousho o kuwashiku hanashite kudasai",
     "en": "In the interview, describe your strengths in detail."},
]

# ── N1 ────────────────────────────────────────────────────────
# 敬語 and the written register read aloud: the long nominal phrase, the
# humble auxiliary, the sentence that does not commit until its final
# verb.
N1 = [
    {"jp": "本日は貴重なお時間をいただき、誠にありがとうございます。",
     "kana": "ほんじつはきちょうなおじかんをいただき、まことにありがとうございます。",
     "romaji": "honjitsu wa kichou na o-jikan o itadaki, makoto ni arigatou gozaimasu",
     "en": "Thank you sincerely for giving us your valuable time today."},
    {"jp": "政府は来年度から、新しい制度を導入する方針を示しました。",
     "kana": "せいふはらいねんどから、あたらしいせいどをどうにゅうするほうしんをしめしました。",
     "romaji": "seifu wa rainendo kara, atarashii seido o dounyuu suru houshin o shimeshimashita",
     "en": "The government has indicated it will introduce a new system from next year."},
    {"jp": "この地域では、昔からの祭りが今も大切に受け継がれています。",
     "kana": "このちいきでは、むかしからのまつりがいまもたいせつにうけつがれています。",
     "romaji": "kono chiiki de wa, mukashi kara no matsuri ga ima mo taisetsu ni uketsugarete imasu",
     "en": "In this region, the festival of old is still carefully passed down."},
    {"jp": "実験の結果は、我々の予想を大きく上回るものでした。",
     "kana": "じっけんのけっかは、われわれのよそうをおおきくうわまわるものでした。",
     "romaji": "jikken no kekka wa, wareware no yosou o ookiku uwamawaru mono deshita",
     "en": "The results of the experiment far exceeded our expectations."},
    {"jp": "厳しい状況が続いておりますが、力を尽くしております。",
     "kana": "きびしいじょうきょうがつづいておりますが、ちからをつくしております。",
     "romaji": "kibishii joukyou ga tsuzuite orimasu ga, chikara o tsukushite orimasu",
     "en": "The situation remains difficult, but we are doing everything we can."},
    {"jp": "その提案については、慎重に検討させていただきます。",
     "kana": "そのていあんについては、しんちょうにけんとうさせていただきます。",
     "romaji": "sono teian ni tsuite wa, shinchou ni kentou sasete itadakimasu",
     "en": "We will consider that proposal carefully."},
    {"jp": "経済の回復には、まだしばらく時間がかかると見られています。",
     "kana": "けいざいのかいふくには、まだしばらくじかんがかかるとみられています。",
     "romaji": "keizai no kaifuku ni wa, mada shibaraku jikan ga kakaru to mirarete imasu",
     "en": "The economy is expected to take some time yet to recover."},
    {"jp": "彼女は幼いころから、絵を描くことに強い関心を持っていました。",
     "kana": "かのじょはおさないころから、えをかくことにつよいかんしんをもっていました。",
     "romaji": "kanojo wa osanai koro kara, e o kaku koto ni tsuyoi kanshin o motte imashita",
     "en": "She has had a strong interest in drawing since she was small."},
    {"jp": "災害に備えて、非常用の食料を用意しておく必要があります。",
     "kana": "さいがいにそなえて、ひじょうようのしょくりょうをよういしておくひつようがあります。",
     "romaji": "saigai ni sonaete, hijouyou no shokuryou o youi shite oku hitsuyou ga arimasu",
     "en": "You need to keep emergency food ready in case of a disaster."},
    {"jp": "この作品は、当時の社会の様子を実に生き生きと描いています。",
     "kana": "このさくひんは、とうじのしゃかいのようすをじつにいきいきとえがいています。",
     "romaji": "kono sakuhin wa, touji no shakai no yousu o jitsu ni ikiiki to egaite imasu",
     "en": "This work depicts the society of the time most vividly."},
    {"jp": "長年の努力が実を結び、ついに目標を達成することができました。",
     "kana": "ながねんのどりょくがみをむすび、ついにもくひょうをたっせいすることができました。",
     "romaji": "naganen no doryoku ga mi o musubi, tsui ni mokuhyou o tassei suru koto ga dekimashita",
     "en": "Years of effort bore fruit and we finally reached our goal."},
    {"jp": "詳しい内容につきましては、担当者からご説明いたします。",
     "kana": "くわしいないようにつきましては、たんとうしゃからごせつめいいたします。",
     "romaji": "kuwashii naiyou ni tsukimashite wa, tantousha kara go-setsumei itashimasu",
     "en": "The person in charge will explain the details."},
    {"jp": "その事件をきっかけに、社会の関心が一気に高まりました。",
     "kana": "そのじけんをきっかけに、しゃかいのかんしんがいっきにたかまりました。",
     "romaji": "sono jiken o kikkake ni, shakai no kanshin ga ikki ni takamarimashita",
     "en": "That incident sharply raised public interest."},
    {"jp": "先方のご都合を伺った上で、日程を決めたいと思います。",
     "kana": "せんぽうのごつごうをうかがったうえで、にっていをきめたいとおもいます。",
     "romaji": "senpou no go-tsugou o ukagatta ue de, nittei o kimetai to omoimasu",
     "en": "I'd like to set the schedule after asking the other party's availability."},
    {"jp": "技術の進歩によって、私たちの暮らしは大きく変わりました。",
     "kana": "ぎじゅつのしんぽによって、わたしたちのくらしはおおきくかわりました。",
     "romaji": "gijutsu no shinpo ni yotte, watashitachi no kurashi wa ookiku kawarimashita",
     "en": "Advances in technology have greatly changed the way we live."},
    {"jp": "余計なことを言ってしまい、後で深く反省しました。",
     "kana": "よけいなことをいってしまい、あとでふかくはんせいしました。",
     "romaji": "yokei na koto o itte shimai, ato de fukaku hansei shimashita",
     "en": "I said more than I should have, and regretted it deeply afterwards."},
    {"jp": "この問題については、専門家の間でも意見が分かれています。",
     "kana": "このもんだいについては、せんもんかのあいだでもいけんがわかれています。",
     "romaji": "kono mondai ni tsuite wa, senmonka no aida de mo iken ga wakarete imasu",
     "en": "Even the experts are divided on this issue."},
    {"jp": "あいにくの天気でしたが、大会は予定どおり行われました。",
     "kana": "あいにくのてんきでしたが、たいかいはよていどおりおこなわれました。",
     "romaji": "ainiku no tenki deshita ga, taikai wa yotei doori okonawaremashita",
     "en": "The weather was poor, but the event went ahead as planned."},
    # ── Plan 111: a second sitting's worth, same rules as the lines above. ──
    {"jp": "ご多忙のところ恐縮ですが、ご確認いただけますと幸いです。",
     "kana": "ごたぼうのところきょうしゅくですが、ごかくにんいただけますとさいわいです。",
     "romaji": "go-tabou no tokoro kyoushuku desu ga, go-kakunin itadakemasu to saiwai desu",
     "en": "I am sorry to trouble you when you are busy, but I would be grateful if you could check this."},
    {"jp": "人口の減少は、日本社会が直面する大きな課題の一つである。",
     "kana": "じんこうのげんしょうは、にほんしゃかいがちょくめんするおおきなかだいのひとつである。",
     "romaji": "jinkou no genshou wa, nihon shakai ga chokumen suru ookina kadai no hitotsu de aru",
     "en": "Population decline is one of the big challenges facing Japanese society."},
    {"jp": "委員会は、来月中に最終報告書をまとめる見通しです。",
     "kana": "いいんかいは、らいげつちゅうにさいしゅうほうこくしょをまとめるみとおしです。",
     "romaji": "iinkai wa, raigetsu chuu ni saishuu houkokusho o matomeru mitooshi desu",
     "en": "The committee is expected to finalise its report within next month."},
    {"jp": "相次ぐ問題を受け、社長は会社を去ることを決めた。",
     "kana": "あいつぐもんだいをうけ、しゃちょうはかいしゃをさることをきめた。",
     "romaji": "aitsugu mondai o uke, shachou wa kaisha o saru koto o kimeta",
     "en": "In the wake of one problem after another, the president decided to leave the company."},
    {"jp": "この件につきましては、改めてご連絡差し上げます。",
     "kana": "このけんにつきましては、あらためてごれんらくさしあげます。",
     "romaji": "kono ken ni tsukimashite wa, aratamete go-renraku sashiagemasu",
     "en": "Regarding this matter, we will contact you again."},
    {"jp": "彼の発言は、多くの人の共感を呼んだ。",
     "kana": "かれのはつげんは、おおくのひとのきょうかんをよんだ。",
     "romaji": "kare no hatsugen wa, ooku no hito no kyoukan o yonda",
     "en": "His remarks struck a chord with many people."},
    {"jp": "気候変動への対策は、今すぐ始めなければならない段階に来ている。",
     "kana": "きこうへんどうへのたいさくは、いますぐはじめなければならないだんかいにきている。",
     "romaji": "kikou hendou e no taisaku wa, ima sugu hajimenakereba naranai dankai ni kite iru",
     "en": "Measures against climate change have reached a stage where they must begin right now."},
    {"jp": "誠に勝手ながら、本日は臨時休業とさせていただきます。",
     "kana": "まことにかってながら、ほんじつはりんじきゅうぎょうとさせていただきます。",
     "romaji": "makoto ni katte nagara, honjitsu wa rinji kyuugyou to sasete itadakimasu",
     "en": "We apologise for the inconvenience, but we are closed today."},
    {"jp": "歴史を学ぶことは、現在を理解する手がかりとなる。",
     "kana": "れきしをまなぶことは、げんざいをりかいするてがかりとなる。",
     "romaji": "rekishi o manabu koto wa, genzai o rikai suru tegakari to naru",
     "en": "Studying history gives us clues to understanding the present."},
    {"jp": "皆様のご協力なくしては、この事業は成し得ませんでした。",
     "kana": "みなさまのごきょうりょくなくしては、このじぎょうはなしえませんでした。",
     "romaji": "minasama no go-kyouryoku nakushite wa, kono jigyou wa nashiemasen deshita",
     "en": "Without everyone's cooperation, this project could not have been achieved."},
    {"jp": "彼女は多くの困難に耐え、ついに夢を実現した。",
     "kana": "かのじょはおおくのこんなんにたえ、ついにゆめをじつげんした。",
     "romaji": "kanojo wa ooku no konnan ni tae, tsui ni yume o jitsugen shita",
     "en": "She endured many difficulties and finally made her dream come true."},
    {"jp": "専門家の間でも、この問題については意見が分かれている。",
     "kana": "せんもんかのあいだでも、このもんだいについてはいけんがわかれている。",
     "romaji": "senmonka no aida de mo, kono mondai ni tsuite wa iken ga wakarete iru",
     "en": "Even among experts, opinion on this question is divided."},
]

BY_LEVEL: dict[str, list[dict]] = {"N5": N5, "N4": N4, "N3": N3, "N2": N2, "N1": N1}

LEVELS: tuple[str, ...] = ("N5", "N4", "N3", "N2", "N1")

# Everything a `kana` field may hold besides kana: the two Japanese
# marks these lines use, plus the katakana長音符 (which is kana's own
# and not punctuation, but sits outside both blocks).
_PUNCTUATION = "、。"


def _is_kana(c: str) -> bool:
    return "ぁ" <= c <= "ゟ" or "ァ" <= c <= "ヿ"


def _writes_a_reading(c: str) -> bool:
    """A character the `kana` field spells out rather than repeats: a
    kanji, or 々, which stands for the kanji before it and is read like
    one. Everything else in `jp` — kana, 、 and 。 — must survive into
    the reading unchanged, which is what the subsequence check below
    depends on."""
    return "一" <= c <= "鿿" or c == "々"


def all_clips() -> list[dict]:
    """Every line in the collection, each carrying the level it belongs
    to. The order is the banks' own — the build script synthesizes in
    it, so a partial run is a prefix rather than a scatter."""
    return [dict(row, level=level) for level in LEVELS for row in BY_LEVEL[level]]


def problems() -> list[str]:
    """Every rule violation in the whole collection, as readable lines.
    Empty means the bank is sound. tests/test_listening_clips.py asserts
    exactly that; this lives here so the bank carries its own rules."""
    found: list[str] = []
    seen: dict[str, str] = {}

    for level in LEVELS:
        cap = LENGTH_CAP[level]
        for row in BY_LEVEL[level]:
            jp, kana = row["jp"], row["kana"]
            where = f"{level} {jp}"

            if jp in seen:
                found.append(f"{where}: also appears at {seen[jp]}")
            seen[jp] = level

            over = kanji_over_level(jp, level)
            if over:
                found.append(f"{where}: kanji above {level}: {''.join(over)}")

            stray = sorted({c for c in kana if not _is_kana(c) and c not in _PUNCTUATION})
            if stray:
                found.append(f"{where}: reading holds non-kana {''.join(stray)}")

            # The reading must contain the line's own kana, in order:
            # anything the writing spells out loud (okurigana, particles,
            # katakana words) has to survive into it untouched. This is
            # what catches a reading typed for the wrong sentence, or one
            # that quietly drops a も.
            it = iter(kana)
            missing = [c for c in jp if not _writes_a_reading(c) and not _advance(it, c)]
            if missing:
                found.append(f"{where}: reading does not carry {''.join(missing)} in order")

            spoken = [c for c in kana if c not in _PUNCTUATION]
            if len(spoken) > cap:
                found.append(f"{where}: {len(spoken)} kana, over {level}'s cap of {cap}")

            if not row.get("en", "").strip():
                found.append(f"{where}: no English gloss")

            problem = _romaji_problem(row)
            if problem:
                found.append(f"{where}: {problem}")

    return found


def _advance(it, target: str) -> bool:
    """Consume `it` until `target` comes out. False if it never does."""
    return any(c == target for c in it)


def _romaji_problem(row: dict) -> str | None:
    """Whether `romaji` is a faithful romanization of `kana`, or a note
    on how it is not.

    The two cannot simply be compared: this bank writes the particles as
    they are SAID (wa, e, o) and a machine romanization of the kana
    writes them as they are SPELLED (ha, he, wo). So the kana's own
    romanization becomes a pattern in which every ha may also be wa and
    every he may also be e — nothing else is allowed to differ, which is
    what makes this a real check on a hand-written field rather than a
    formality. (`wo`/`o` needs no clause: study/romaji.fold settles it
    for both sides.)"""
    written = row.get("romaji", "").strip()
    if not written:
        return "no romaji"
    expected = fold(to_romaji(row["kana"]))
    # str.replace does not rescan what it inserts, so the `ha` inside
    # the first alternation is not matched again by the second pass.
    pattern = expected.replace("ha", "(?:ha|wa)").replace("he", "(?:he|e)")
    if not re.fullmatch(pattern, fold(written)):
        return f"romaji {written!r} does not read as {row['kana']} (expected {expected})"
    return None
