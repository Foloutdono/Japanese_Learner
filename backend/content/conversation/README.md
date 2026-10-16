# The conversation bank (会話, plan 217)

One JSON file per JLPT level, `N5.json` … `N1.json`, each a list of
**scenarios**: a place, someone who speaks to the learner there, and the
exchange that follows, turn by turn. It is the whole of what the 会話
platform (`/practice/conversation`) knows. Nothing here is generated at
request time: every line was drafted with an AI model, in both of the
app's languages, is checked in code before it can ship
(`study/conversation.problems`), and is the content audit's to attack like
the rest of what the app teaches (`docs/content-audit/PLAYBOOK.md`).

```
cd backend
python -m scripts.check_conversation             # every problem, or "sound"
python -m scripts.check_conversation --level N4  # one level
python -m pytest tests/test_conversation.py
```

A scenario is ridden three ways, all from the same turns:

- **Choose** (選ぶ): the other person speaks, and the learner picks their
  reply among three — `me` and the two `wrong`. Graded by the pick.
- **Translate** (訳す): the other person speaks, and the learner is told
  what they want to say (`me.en` / `me.fr`) and writes it in Japanese.
  Measured against `me` and its `alt`s, read by the tutor when the day
  allows, graded by the learner (ADR 0013).
- **Free** (自由): the other person opens with the first `them` line and
  the learner answers however they like; a model plays the other person
  from then on, reacting to what was actually said, and reads every line
  back like the tutor does. The turns are its script to stay near, the
  `goal` what the learner is there to do. Rationed by the day.

## A scenario

```jsonc
{
  "id": "konbini-lunch",            // unique across all five files: [a-z0-9-], 40 at most. The key of every log row: never renamed
  "place": {"jp": "コンビニ", "kana": "コンビニ", "en": "Convenience store", "fr": "Supérette"},
  "title": {"en": "Lunch at the konbini", "fr": "Le déjeuner à la supérette"},
  "situation": {"en": "…", "fr": "…"},  // where you are, who speaks to you, why: two short sentences at most
  "goal": {"en": "…", "fr": "…"},       // the errand, one sentence: what the free talk is for
  "them": {"en": "Clerk", "fr": "Vendeur"},  // who speaks to you, as a role
  "register": "polite",                 // how the LEARNER speaks here: casual | polite | formal
  "turns": [                            // four to seven
    {
      "them": {"jp": "…", "kana": "…", "en": "…", "fr": "…"},
      "me": {
        "jp": "…", "kana": "…", "romaji": "…", "en": "…", "fr": "…",
        "note": {"en": "…", "fr": "…"},  // why this reply is the right one, naming its Japanese in 「」
        "alt": [{"jp": "…", "kana": "…", "romaji": "…"}]  // optional: other replies as good as `me`
      },
      "wrong": [                         // exactly two
        {"jp": "…", "kana": "…", "en": "…", "fr": "…", "why": {"en": "…", "fr": "…"}}
      ]
    }
  ],
  "close": {"jp": "…", "kana": "…", "en": "…", "fr": "…"}  // optional: what they say after your last reply
}
```

| field | rule |
|---|---|
| `id` | unique across the bank, lowercase words joined by `-`. Never edit one: the learner's history is keyed on it. |
| `jp` | a line as a native writer would write it, ending in 。？ or ！. Numbers in kanji or kana, never in digits (the reading is hand-written, and a digit has none). No Latin letters. |
| `kana` | the same line with every kanji spelled in its reading **in this sentence**: hiragana for what is written in kanji, katakana left as katakana, every other character of `jp` (kana, 、 。 ？ ！ ー) carried over unchanged and in order. It is what the furigana is built from, so it is the reading the app teaches: 一人 is ひとり, 今日 is きょう, 何 is なん before で／です and なに elsewhere. |
| `romaji` | on `me` and each `alt`, and nowhere else: the line as it is SAID, word-spaced, the particles by sound (は wa, へ e, を o), long vowels as the kana writes them (おねがい onegai, どう dou, ラーメン raamen). Checked against `kana`. The romanizer the check runs (`study/romaji`) does not know every loan sound — ティ comes out `tei` and ジェ `jie` — so keep those out of the learner's lines (the clerk may say 「ティーシャツ」; the learner answers 「はい、そうです」). |
| `en`, `fr` | every line's translation, both languages, natural rather than word for word. The French addresses the learner as « tu » and the people in the scene as they would address each other (« vous » to a clerk). |
| `situation`, `goal`, `title` | in the learner's language only: no Japanese in them. |
| `them` | a role, not a name: Clerk, Station attendant, Classmate. |
| `register` | how the learner should speak to `them`: `polite` (です／ます) almost everywhere, `casual` with a friend, `formal` (敬語) at an interview, with a client, with a boss. Every `me` is in that register. |
| `turns` | four to seven. Each `them` line is something said TO the learner that wants an answer — a question, an offer, a request, news that needs a reaction — and the turns make one plausible exchange, start to end. |
| `me` | the reply a teacher would give as the model answer, in the scenario's register, at the level. Short: one sentence, two at most. |
| `note` | one sentence: what makes `me` right here, naming the Japanese that does it in 「」. |
| `alt` | only replies as natural and as complete as `me`, differently worded. The measure scores the learner against the closest of them. |
| `wrong` | two replies that are **certainly wrong in this exchange**, each for a reason a teacher would sign (below). |
| `why` | one sentence: why this reply fails here, naming its Japanese in 「」. |

## Writing the wrong replies

A wrong reply is the whole exercise in Choose, and the commonest defect
is a wrong reply that is not wrong — a second right answer. Before keeping
one, say it to the other person in the scene and ask whether a native
speaker would take it as a fine answer. If they would, it is not a wrong
reply. Make each fail for one clear reason:

- **It answers another question**: the clerk asked whether to heat the
  bento, and 「はい、温かいです」 says it is warm.
- **It confuses a pair the level teaches**: いる and ある (「はい、あります」
  to 「お箸はいりますか」), で and を, もう and まだ, あげる and くれる.
- **It contradicts itself**: 「いいえ、お願いします」 refuses and accepts at once.
- **It is the wrong set phrase**: 「いただきます」 at the till,
  「どういたしまして」 when nobody thanked you, 「失礼しました」 for 「失礼します」.
- **It breaks the register where the break is the error**: plain form to
  an interviewer, 「〜てくれる？」 to a client — only where any teacher would
  mark it wrong, never as a matter of taste.
- **It is grammatically broken** in a way the level should catch:
  「食べたいです」 written 「食べるたいです」 — sparingly; a reply a learner
  rejects at a glance teaches nothing.

Never: a wrong reply that differs from `me` only by politeness a clerk
would accept, a reply that is merely less common, two wrong replies that
fail the same way, or a wrong reply more careful than `me` (politer,
fuller of thanks and apology: the eye learns to pick the careful one).

**Length says nothing.** The eye learns to pick the longest reply just
as fast, and the first draft of this bank taught it to: written with
care, `me` was the longest of the three in two turns of three and the
shortest almost never. Across a level, `me` is the longest in about a
third of the turns, the shortest in about a third and in the middle in
the rest. A wrong reply is made longer with what keeps its fault — the
object, the time, the reason, a second clause — never with politeness.
`check_conversation` measures it: picking the longest reply, or the
shortest, must win a level's Choose between 25% and 42% of the time
(a blind pick wins a third; `LENGTH_TELL`).

## The level

The words and the grammar of every `me` and every `them` are the level's
or below it: an N5 clerk says 「袋に入れますか」, an N2 one may say
「レジ袋はご利用ですか」. Kanji are not held to the level — the furigana
is printed over every line — but a word a learner of the level would not
know does not belong in `me`, which is what they are asked to produce.
Above N4 the exchange may carry 敬語 on the other person's side as it
really would (an N3 clerk says 「少々お待ちください」); the learner's side
is the register the scenario names.

## The free talk

The model is handed the place, the two roles, the situation, the goal,
the register, the level and the turns as a script to stay near. So the
turns are also its picture of what this exchange sounds like: keep them
the exchange a real visit would have, in the order it would have it.
