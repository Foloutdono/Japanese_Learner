# ── What a question's choices give away by how they look (plan 254) ──
# A choice is told apart from the others by understanding, never by the
# eye. The papers the generators wrote broke that two ways, and both are
# read here from the choices alone, so the gate (study/exam_seed.py) and
# the builders of the 漢字読み / 表記 items (study/exam_kanji_choices.py)
# share one definition:
#
#   * a minimal pair -- two choices one character apart (たいです /
#     たくです, 午前 / 午後) -- with the other two far from both. The
#     distractor was made by editing the answer, so the answer is one of
#     the pair: picking the pair halves the field before a word is read.
#
#   * a star -- every distractor one edit from the answer and so two from
#     each other (ぱじめ / ばじめ / はしめ around はじめ). The answer is
#     the choice nearest to all the others, and picking it, without
#     knowing the kanji, was right on 96% of the 漢字読み items and 60% of
#     the 表記 ones.
#
# What is not a tell is symmetry: four choices that share a frame and
# differ in one slot (がください / をください / にください / でください),
# or the voicing x length grid the real paper uses (せんしゅう /
# ぜんしゅう / せんしゅ / ぜんしゅ), where every choice has two
# neighbours and one opposite and none is the centre.
import itertools
import re

_FULLWIDTH = str.maketrans("０１２３４５６７８９", "0123456789")
_DIGITS = re.compile(r"[0-9０-９]+")


def _units(text: str) -> str:
    """The text with each run of digits as ONE unit: 10時 and 9時 are one
    small difference apart, not two."""
    return _DIGITS.sub(lambda m: chr(0xE000 + int(m.group().translate(_FULLWIDTH)) % 6000), text)


def distance(a: str, b: str) -> int:
    """Edit distance between two choices, a run of digits counted once."""
    a, b = _units(a), _units(b)
    if a == b:
        return 0
    if not a or not b:
        return max(len(a), len(b))
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def is_minimal_pair(a: str, b: str) -> bool:
    """One small difference: a single edit between strings of two or more
    characters (so が / を, which share nothing, are not), or two edits
    inside a long line."""
    size = max(len(_units(a)), len(_units(b)))
    d = distance(a, b)
    return size >= 2 and (d <= 1 or (d == 2 and size >= 10))


def structure(choices: list[str]) -> str:
    """How the choices stand beside each other, from the minimal pairs
    among them: none, clique (all of them, a shared frame), ring (a 2x2
    grid), pairs (two separate pairs), pair, triple, star, chain."""
    n = len(choices)
    edges = [(i, j) for i, j in itertools.combinations(range(n), 2) if is_minimal_pair(choices[i], choices[j])]
    if not edges:
        return "none"
    if len(edges) == n * (n - 1) // 2:
        return "clique"
    degree = [sum(1 for e in edges if i in e) for i in range(n)]
    parent = list(range(n))

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i, j in edges:
        parent[root(i)] = root(j)
    sizes = sorted((sum(1 for i in range(n) if root(i) == r) for r in {root(i) for i in range(n)}), reverse=True)
    if n == 4:
        if sizes == [2, 1, 1]:
            return "pair"
        if sizes == [2, 2]:
            return "pairs"
        if sizes == [3, 1]:
            return "triple"
        if sizes == [4]:
            return "ring" if all(d == 2 for d in degree) else ("star" if max(degree) == 3 else "chain")
    return "other"


# Structures the eye can use. clique, ring, pairs and none are symmetric.
TELLING = {"pair": "two choices are one small difference apart and the other two are not",
           "triple": "three choices are one small difference apart and the fourth is not",
           "star": "every choice is one small difference from the same one, which is then the answer",
           "chain": "the choices are a chain of one-character changes"}


def tell(choices: list[str]) -> str | None:
    """Why the choices give an answer away by their look, or None."""
    if len(choices) != 4:
        return None
    return TELLING.get(structure(choices))


def distance_sums(choices: list[str]) -> list[int]:
    """For each choice, its total distance to the other three: the
    smallest is the choice most like all the rest."""
    return [sum(distance(a, b) for j, b in enumerate(choices) if j != i) for i, a in enumerate(choices)]


def centre(choices: list[str]) -> int | None:
    """The one choice nearest to all the others, or None when two tie --
    the answer of a star, and nothing in a grid, where every sum is equal."""
    sums = distance_sums(choices)
    low = min(sums)
    return sums.index(low) if sums.count(low) == 1 else None


def outlier(choices: list[str]) -> int | None:
    """The one choice farthest from all the others, or None when two tie."""
    sums = distance_sums(choices)
    high = max(sums)
    return sums.index(high) if sums.count(high) == 1 else None
