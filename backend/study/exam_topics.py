# ── Topic catalog for free-form generated content ─────────────
# The catalog exam_reading_gen.py, exam_listening_gen.py and
# exam_grammar_gen.py's cloze mondai interpolate into their prompts, the
# same way exam_grammar_gen.py's fill/star prompts already interpolate
# {points_block} and exam_vocab_gen.py's interpolate {words_block}.
#
# Why this exists: those three prompts were the only LLM prompts in the
# project with nothing item-specific in them. The listening prompt named
# three example scenarios inline ("deciding what to buy, arranging
# when/where to meet, or working out what to do next") and asked the
# model to "vary the topic" — which varies topics WITHIN one batch of
# four and not at all between batches or between papers, because the
# prompt string is byte-identical every time. Live-diagnosed 2026-08:
# essentially every N5 listening item came back as either arranging a
# meeting time or a scene at a station. The reading prompt named no
# topic at all, with the same result.
#
# Entries are short ENGLISH scene descriptions because the prompts are
# English; the model writes the Japanese. They are deliberately not
# level-gated — "a note left on the fridge" is a fine subject at N5 and
# at N1, the difference being the Japanese used to express it, which the
# prompt's own level/kanji constraints already handle. Keeping one pool
# per shape (rather than one per level) is also what makes a pool big
# enough that a paper's worth of draws barely dents it.
#
# The over-used scenarios are NOT banned — a JLPT listening section
# genuinely does test train times and meeting arrangements. They are
# just two entries among forty instead of the only examples the model is
# shown.
import random

# Things a learner might plausibly READ: notices, letters, diary
# entries, short descriptive pieces. Skewed toward the concrete and the
# everyday, since a passage has to be answerable from its own text.
READING_TOPICS = [
    "a notice on a classroom wall about a change to next week's schedule",
    "a postcard from a friend who has moved to another town",
    "a diary entry about the weather changing with the season",
    "a note left on the fridge for a family member",
    "a flyer for a library's new opening hours",
    "a short piece about a neighbour's cat",
    "a message left for a classmate who was absent",
    "an announcement about a school sports day",
    "a description of the writer's morning routine",
    "a letter thanking someone for a present",
    "a short piece about a favourite food and how it is made",
    "a notice at a swimming pool about the rules",
    "an email to a teacher about a missing textbook",
    "a description of the writer's room and what is in it",
    "a short piece about a bicycle that keeps breaking",
    "a notice about a lost umbrella at a community centre",
    "a description of a walk taken on a day off",
    "a short piece about learning to cook a new dish",
    "an announcement about a bus route that has changed",
    "a letter to a grandparent about how school is going",
    "a description of a small shop the writer likes",
    "a short piece about a plant the writer is growing",
    "a notice about when the rubbish is collected",
    "a description of the writer's family and what they do",
    "a short piece about a photograph the writer found",
    "an invitation to a small birthday gathering",
    "a description of a park in the early morning",
    "a short piece about a book the writer read recently",
    "a notice about a swimming class for beginners",
    "a description of what the writer does on rainy days",
    "a short piece about a pen pal in another country",
    "an announcement about a shop closing for the holidays",
    "a description of a market on a busy weekend",
    "a short piece about a hobby the writer started this year",
    "a note about feeding a friend's pet while they are away",
    "a description of the writer's journey to school or work",
    "a short piece about a festival held every summer",
    "a notice about a room that cannot be used this week",
    "a description of a meal shared with family",
    "a short piece about an old clock in the writer's house",
]

# For 主張理解 mondai, whose passages must express an OPINION rather
# than narrate events (see exam_reading_gen._STYLE_OPINION). Framed as
# positions rather than scenes, so the model has something to argue.
OPINION_TOPICS = [
    "why the writer thinks reading on paper beats reading on a screen",
    "the writer's view on whether children should have mobile phones",
    "why the writer believes walking is better than taking the train",
    "the writer's argument that cities need more small parks",
    "why the writer thinks cooking at home is worth the time",
    "the writer's view on studying a language alone versus in a class",
    "why the writer believes people should keep handwritten letters",
    "the writer's argument that shops should close earlier",
    "why the writer thinks working in silence is more productive",
    "the writer's view on whether travel really teaches you anything",
    "why the writer believes old buildings should be kept, not replaced",
    "the writer's argument that people buy far more clothes than they need",
    "why the writer thinks morning is the best time to study",
    "the writer's view on whether photographs help or harm memory",
    "why the writer believes libraries matter more than ever",
    "the writer's argument that everyone should learn to fix things",
    "why the writer thinks eating together as a family is important",
    "the writer's view on whether machines should replace shop staff",
    "why the writer believes sleep matters more than extra study hours",
    "the writer's argument that a hobby should not become a job",
]

# Dialogue scenes for listening items: two people working something
# out, so the item can ask a concrete "what does she have to do / what
# will they buy / when will it happen" question.
LISTENING_TOPICS = [
    "choosing a size and colour while shopping for clothes",
    "working out who brings what to a picnic",
    "asking a teacher about a homework deadline",
    "a phone call about a delivery that has not arrived",
    "deciding what to cook for a guest with a dislike",
    "reporting a lost umbrella at a front desk",
    "choosing seats at a cinema",
    "arranging what time and where to meet",
    "asking for directions and which exit to use at a station",
    "deciding which of two restaurants to go to",
    "sorting out who will clean which part of the classroom",
    "asking a shop assistant whether something is in stock",
    "planning what to pack for a two-day trip",
    "deciding what present to buy for a colleague",
    "booking a table and changing the number of people",
    "asking a doctor's receptionist about an appointment",
    "working out how to split a bill",
    "deciding whether to go out given the weather forecast",
    "asking a neighbour to take in a parcel",
    "choosing which class to sign up for",
    "sorting out a mistake on a receipt",
    "deciding who will look after a pet during a holiday",
    "asking about the price and how long a repair will take",
    "planning the order of jobs before guests arrive",
    "deciding which bus or route to take",
    "asking a librarian whether a book can be renewed",
    "working out why a friend is late and what to do",
    "choosing a photograph to use for something",
    "asking about opening hours over the phone",
    "deciding what to do with leftover food",
    "sorting out who sits where at a small event",
    "asking a colleague to swap a shift",
    "deciding which room to hold a meeting in",
    "asking about the rules at a swimming pool",
    "working out what to buy for a camping trip",
    "deciding what to wear for a formal occasion",
    "asking a friend to help move some furniture",
    "choosing a course of study or a club to join",
    "sorting out a problem with a bicycle",
    "deciding when to visit someone in hospital",
]


def pick_topics(pool: list[str], n: int, rng: random.Random) -> list[str]:
    """`n` topics drawn from `pool`, all distinct as long as the pool is
    big enough. Asking for more than the pool holds reshuffles and keeps
    going rather than raising, so a caller never has to know a pool's
    size — a repeat inside one very long paper is a far smaller problem
    than a paper that fails to generate.

    Takes the caller's own rng so topic choice rides on the paper seed
    (routes/exams.py's _seed_for, which now varies per revision) — two
    revisions of the same exam id draw different topics, and the same
    revision always draws the same ones."""
    if n <= 0:
        return []
    picked: list[str] = []
    while len(picked) < n:
        remaining = n - len(picked)
        if remaining >= len(pool):
            shuffled = list(pool)
            rng.shuffle(shuffled)
            picked.extend(shuffled)
        else:
            picked.extend(rng.sample(pool, remaining))
    return picked[:n]
