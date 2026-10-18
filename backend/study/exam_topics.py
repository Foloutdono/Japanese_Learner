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
# enough for ten papers of the level that asks the most of it to deal
# no subject twice (TopicDeck, plan 247): N4's fifteen listening items a
# paper, N1's and N2's eight comprehension passages.
#
# The over-used scenarios are NOT banned — a JLPT listening section
# genuinely does test train times and meeting arrangements. They are
# just two entries among a hundred and sixty instead of the only
# examples the model is shown. Two entries that would make one story
# are one entry too many: what the deck keeps apart is the subject,
# not the story a model makes of it.
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
    "an email from a company moving the date of a job interview",
    "a notice in a block of flats about the water being turned off for repairs",
    "a short piece about the first time the writer went camping",
    "a museum's guide to what visitors may and may not do",
    "a letter from a host family to a student who is about to arrive",
    "a short piece about a part-time job at a bakery",
    "a memo to staff about a new way of booking meeting rooms",
    "a short piece about a slow train journey through the mountains",
    "an advert on a noticeboard for second-hand furniture",
    "a short piece about getting lost in a new city",
    "a dentist's notice about appointments that have to move",
    "a short piece about a habit the writer gave up and why",
    "an email to a hotel asking about luggage and check-in time",
    "a short piece about an elderly neighbour who grows vegetables",
    "a school newsletter item about a class visit to a factory",
    "a short piece about a wrong number that turned into a friendship",
    "instructions for using a coin laundry",
    "a short piece about a snowy day when the trains stopped",
    "a customer's review of a small café",
    "a short piece about the writer's first day at a new job",
    "a notice about a cooking class for parents and children",
    "a short piece about a sports team that kept losing",
    "a letter apologising for returning a borrowed book late",
    "a short piece about a town's old public bath",
    "an announcement of a talk at the city hall about saving energy",
    "a short piece about a dog the writer's family took in",
    "a notice about bicycles left too long in a parking area",
    "a short piece about a mistake the writer made speaking a foreign language",
    "a short piece about what the writer learned from a grandparent's work",
    "an email inviting colleagues to a farewell party",
    "a short piece about a volunteer clean-up of a beach",
    "a notice about the rules of a shared kitchen in a dormitory",
    "a short piece about a lost wallet that came back",
    "a short piece about a craftsman who repairs shoes",
    "a guide to borrowing equipment from a sports centre",
    "a short piece about moving to a smaller flat",
    "a short piece about the writer's first night alone at home",
    "a notice about a fire drill in an office building",
    "a short piece about a forgotten birthday and how it was made up for",
    "an email from a language school about a placement test",
    "a short piece about a vending machine that sells unusual things",
    "a short piece about a day spent helping on a relative's farm",
    "a notice about a free health check for local residents",
    "a short piece about taking up drawing after retiring",
    "a letter from a teacher to parents about homework",
    "a short piece about an evening when the power went out",
    "a short piece about a long queue outside a new shop",
    "a short piece about a visitor from abroad trying Japanese food for the first time",
    "a description of a day at a small post office",
    "a short piece about a radio programme the writer listens to every week",
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
    "returning a shirt that turned out to be the wrong size",
    "choosing bread for tomorrow's breakfast at a bakery",
    "buying a train ticket and choosing between the express and the local",
    "asking a pharmacist how to take a medicine",
    "having a key copied and asking when it will be ready",
    "choosing a bed at a furniture shop",
    "telling a hairdresser how to cut your hair",
    "collecting dry cleaning without the ticket",
    "ordering a group's lunch by phone",
    "sending a parcel abroad at a post office",
    "changing money at a bank counter",
    "choosing frames at an optician's",
    "asking a shop to take up the length of some trousers",
    "asking a supermarket worker where to find something",
    "asking a shop to keep an item until the weekend",
    "asking a fishmonger how to cook a fish",
    "deciding who will make dinner tonight",
    "a parent and child deciding when the child must be home in the evening",
    "deciding where to put a new sofa",
    "a parent arranging after-school lessons for a child",
    "a couple choosing between two flats to rent",
    "calling a repair company about a broken washing machine",
    "deciding what to plant in a small garden",
    "a family choosing where to go for the summer holidays",
    "dealing with rain leaking through the ceiling",
    "agreeing the house rules with a new flatmate",
    "a child asking to stay the night at a friend's house",
    "deciding who will meet a grandparent at the station",
    "planning a surprise for a parent's birthday",
    "packing boxes for a move and labelling them",
    "two flatmates deciding how to share the cost of a new fridge",
    "choosing curtains for a new room",
    "a student asking to move the date of a presentation",
    "two students dividing up the work for a group project",
    "borrowing a classmate's notes from a missed lesson",
    "a teacher explaining what to bring on a school trip",
    "choosing a subject for a class presentation",
    "asking the school office about a lost student card",
    "deciding where to study together before an exam",
    "a club deciding what to do at the school festival",
    "a student asking a teacher about a mark on a test",
    "a student asking an older student for advice about part-time jobs",
    "a manager asking a new employee to prepare papers for a meeting",
    "rearranging a meeting because a client will be late",
    "deciding what to order for a working lunch",
    "asking a colleague how to use the new photocopier",
    "choosing a place for the end-of-year party at work",
    "a customer calling to change a delivery address",
    "deciding who will show a visitor round the factory",
    "a part-time worker asking for a day off",
    "a boss and an employee getting ready for a business trip",
    "choosing which printer to buy for the office",
    "a shop owner telling a new worker what to do first",
    "catching a mistake in an order before it is sent",
    "checking in at a hotel and asking about breakfast",
    "asking a tourist office what to see in half a day",
    "telling a taxi driver the way to an address",
    "missing the last train and deciding what to do",
    "renting bicycles at a sightseeing spot",
    "asking to change seats on a plane",
    "booking a room at a traditional inn by phone",
    "deciding what souvenirs to bring back for the office",
    "losing a passport while travelling and what to do next",
    "choosing between a bus tour and walking around a town",
    "a tour guide explaining where to meet after free time",
    "a passenger whose suitcase did not arrive at the airport",
    "deciding whether to stay one night or two at a hot spring",
    "asking a ticket office about a refund for a cancelled trip",
    "finding a good time to call family abroad, given the time difference",
    "a patient describing symptoms to a doctor",
    "deciding whether to go to work with a cold",
    "a gym instructor explaining a training plan",
    "asking a friend to go running together in the mornings",
    "a dentist explaining what to avoid after treatment",
    "a guest with an allergy asking about a dish",
    "choosing a film to watch at home",
    "two friends deciding which concert tickets to buy",
    "joining a tennis club and asking about lessons",
    "planning an evening of karaoke",
    "booking a cooking class for two",
    "deciding what to take to a friend's new home",
    "asking at a museum about a special exhibition",
    "two friends deciding to learn a musical instrument",
    "choosing a book to give a child",
    "planning a day's fishing and what to bring",
    "deciding whether to watch a match at the stadium or on television",
    "booking a sports hall and choosing a time",
    "signing up for a city marathon",
    "a ski instructor explaining what to do on the first morning",
    "asking a friend to teach you how to make sushi",
    "a neighbour complaining about noise at night",
    "asking the building manager whether pets are allowed",
    "volunteering at a community event and choosing a job",
    "a new resident asking how the rubbish is sorted here",
    "a neighbour asking to borrow a ladder",
    "deciding where a visitor can park a car",
    "registering a new address at the city office",
    "joining a neighbourhood clean-up and what to bring",
    "applying for a library card",
    "asking when a bill has to be paid",
    "a friend helping set up a new smartphone",
    "reporting a broken internet connection to the provider",
    "a computer that will not start the day before a deadline",
    "deciding how to send large files to a client",
    "learning to use a ticket machine for the first time",
    "deciding what to order at a ramen shop",
    "finding something to use instead of a missing ingredient",
    "a café customer whose order came out wrong",
    "sorting out a double booking at a restaurant",
    "choosing a lunch box for a long train journey",
    "staff helping a child who is lost in a shopping centre",
    "choosing a name for a new pet",
    "arranging to give back things that were borrowed",
    "planning the order of speeches at a wedding party",
    "a friend asking to borrow a car for the weekend",
    "a hotel guest who left something in the room after checking out",
    "a driving instructor deciding what to practise next",
    "choosing a present for a new baby",
    "a florist helping choose flowers for a teacher who is leaving",
    "deciding how to share the driving on a long car trip",
]


# ── What a paper is written on, dealt (plan 247) ─────────────
# Each part of a paper used to draw its subjects on its own, from the
# paper's rng, with no memory of the rest of the paper or of the papers
# before it: two parts of one paper could draw one scene, and with
# forty listening scenes and fifteen items a paper, ten papers told each
# scene about four times. A model given one scene four times writes much
# the same dialogue four times: the seed papers had 171 texts retelling
# another (study/exam_seed.retold_stories). The grammar points and the
# deck words were drawn the same way, so か何か was asked four times in
# ten N3 papers while twelve N3 points were never asked, and 両側 was
# the word of three N2 papers.
#
# So an exam (its kind and level) walks each list it draws from in one
# rotation, a shuffle of the list seeded by name, shuffled anew each
# time round, and paper k takes its share from position (k - 1) * share,
# share being what one of the exam's papers asks of the list: a paper
# meets nothing twice, and papers in a row meet what none of the others
# did until the list is spent. k is the paper's place among its exam's
# (a revision, a seed's number). A paper that asks for more than its
# share (a retry, an item the checks refused) takes the next paper's
# first: rare, and better than a paper that fails to generate.


def _rotation(exam: str, name: str, turn: int, size: int) -> list[int]:
    """Turn `turn` of an exam's walk through a list of `size`: the
    indices in the order it deals them. Seeded by name, never by the
    paper's rng, so every paper of an exam, in any process, walks one."""
    order = list(range(size))
    random.Random(f"{exam}:{name}:{turn}").shuffle(order)
    return order


def dealt_order(items: list, exam: str, name: str, paper: int | None, share: int,
                rng: random.Random) -> list:
    """Every one of `items`, once, in the order paper `paper` of `exam`
    is to try them: its share of the walk first, then on round. With
    no place (None) the rng shuffles them, which leaves the paper no
    memory of the others."""
    if paper is None:
        out = list(items)
        rng.shuffle(out)
        return out
    size = len(items)
    position = max(0, paper - 1) * max(1, share)
    seen: set[int] = set()
    out = []
    while len(out) < size:
        turn, start = divmod(position, size)
        for index in _rotation(exam, name, turn, size)[start:]:
            if index not in seen:
                seen.add(index)
                out.append(items[index])
        position = (turn + 1) * size
    return out


# The topic pools by the name a deck deals them under.
POOLS = {"reading": READING_TOPICS, "opinion": OPINION_TOPICS, "listening": LISTENING_TOPICS}


class TopicDeck:
    """The subjects one paper is written on, dealt from the exam's walk
    through each pool: `draws` is the paper's share of each, the subjects
    its passages or items ask for. Unlike a grammar point or a word, a
    subject is asked for part by part, so the deck deals on demand; a
    paper never deals one twice while the pool has any left. A pool is
    sized for ten papers of the exam that asks the most of it. With no
    place (None) the deck starts where the rng says."""

    def __init__(self, exam: str, paper: int | None, rng: random.Random, draws: dict[str, int]):
        self._exam = exam
        self._next = {
            name: (rng.randrange(len(pool)) if paper is None
                   else max(0, paper - 1) * max(1, draws.get(name, 1)))
            for name, pool in POOLS.items()
        }
        self._dealt: dict[str, set[str]] = {name: set() for name in POOLS}
        self._turns: dict[tuple[str, int], list[int]] = {}

    def _at(self, name: str, position: int) -> str:
        pool = POOLS[name]
        turn, i = divmod(position, len(pool))
        if (name, turn) not in self._turns:
            self._turns[(name, turn)] = _rotation(self._exam, name, turn, len(pool))
        return pool[self._turns[(name, turn)][i]]

    def deal(self, name: str, n: int) -> list[str]:
        """The next `n` subjects of pool `name`, none this paper has
        dealt before while the pool has any left."""
        pool, dealt = POOLS[name], self._dealt[name]
        out: list[str] = []
        while len(out) < n:
            if len(dealt) == len(pool):
                dealt.clear()
            topic = self._at(name, self._next[name])
            self._next[name] += 1
            if topic in dealt:
                continue
            dealt.add(topic)
            out.append(topic)
        return out
