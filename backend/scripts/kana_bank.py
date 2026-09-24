"""
The kana deck from a recorded voicebank (plans 113b and 113c,
docs/adr/0019).

scripts/build_kana_audio.py --from-bank DIR uses this module to turn an
UTAU voicebank into the deck's 127 clips. The deck is cut from 波音リツ
(カノン, https://www.canon-voice.com/voicebanks/), whom the owner chose
for his terms (below). The module reads both layouts UTAU banks come in,
so 小春音アミ's single-syllable bank -- the first choice, set aside for
her terms (ADR 0019) -- reads as well.

-- What a bank looks like ----------------------------------------
A folder of WAVs, often one sub-folder per pitch (A3/ F4/, or C4/ ...
G4/), each with an oto.ini: UTAU's table of the sounds in its folder,
`file=alias,offset,consonant,cutoff,preutterance,overlap` in
milliseconds, and in Shift_JIS as often as not.

  - A single-syllable (単独音) bank records one syllable a file, usually
    named by it (あ.wav, きゃ.wav); its alias, where there is one, names
    the same syllable, perhaps with a pitch (あ_G4).
  - A joined (連続音) bank records strings -- _かかきかくかけかこ.wav --
    and its oto.ini names every sound in each: "- か" is the か that
    opens the string, from silence; "a か" is a か sung after a vowel.
    Only a "- " one is a syllable on its own, which is what a learner
    hears, so only those are taken; the next sound in the same string
    marks where the syllable ends (its offset + preutterance, where it
    is heard). 波音リツ's 強連続音 bank is this layout, at A3 and F4.

Every alias is read one way (parse_alias): its last token's kana,
without the pitch (A3, _G4) or the marks of a variant (か↑, あR, ら舌 --
a variant loses to the plain sample). ヴ is read as ゔ and ン as ん;
katakana ガ行 are not read, being 小春音アミ's nasal variants. A file
the oto.ini does not name is read by its own name, as one syllable.

-- What is made from it --------------------------------------------
Every sound the deck teaches, by recipe (recipe_for):

  - a syllable is its sample cut to a spoken length (SHORT_S), never
    past the next sound in its string;
  - a long vowel (ああ, アー, and えい/おう, which the lesson teaches as ē
    and ō) is the bank's long tone (あー) where it has one; else the
    vowel's own attack joined into the longest note the singer held on
    that vowel -- in a joined bank, the note that ends a string
    (_sustained); a looped steady end (_hold) only for a bank with
    neither, since a loop is heard as the vowel said again;
  - あい and おい are the singer's own move from one vowel to the other
    ("a い", from whichever string sings it), entered from the first
    vowel's word-initial attack (_glide); two samples joined in phase
    only where no string makes the move -- two takes butted together
    are heard as あ, then い;
  - を is お's sample, because を is said "o" (ウォ, the "wo" sound, is
    うぉ's);
  - ぢ/づ share じ/ず's clip, as they share the deck's sound name;
  - the ヴ row is the bank's own (波音リツ has it), and the バ row where a
    bank has none -- which is how most speakers say it; the import
    reports when that happens.

No new dependency: the stdlib `wave` module and `array` do the cutting,
build_kana_audio.finish() the trim and loudness it gives every clip, and
LAME (study/voice_engine.encode_mp3) resamples the bank's 44.1 kHz to
the set's 48 kHz on the way out.

-- The terms ------------------------------------------------------
波音リツ's (https://www.canon-voice.com/terms/, read on the site
2026-09-24): 「商用利用可です。」「音源の転載、再配布可」「原音を加工しての
転載、再配布可」「クレジット表記不要」. He may ask for a work he judges
inappropriate to be taken down (第8条2). The app credits him all the
same, as provenance: sources.json names the voice of every clip, and
tests/test_kana_audio.py holds each voice named there to its Credits
row. The bank itself stays out of the repository
(backend/datas/kana_source/ is gitignored): nothing needs it there, and
小春音アミ's terms -- the other bank this reads -- forbid distributing
hers.
"""
import io
import math
import re
import unicodedata
import wave
from array import array
from dataclasses import dataclass, field
from pathlib import Path

from study import voice_engine

# How long each shape is, counted from the syllable's onset.
SHORT_S = 0.40
LONG_S = 0.70
DIPHTHONG_FIRST_S = 0.28
DIPHTHONG_SECOND_S = 0.30
# The glide from the first vowel to the second. A spoken あい moves in
# about this long; much shorter clicks, much longer sounds like a third
# vowel in between.
CROSSFADE_S = 0.060
# The second vowel is joined from this far past its own onset, where
# it is steady, rather than at its attack.
SECOND_SKIP_S = 0.040
# How far a join may slide to meet what it follows in phase: a pitch
# period at 133 Hz, below any folder these banks have (A3 is 220 Hz).
PHASE_SEARCH_S = 0.0075
# A long vowel is the vowel's own attack, LONG_HEAD_S of it, joined into
# a note the singer held on that vowel, from STEADY_SKIP_S after that note
# is heard (past his move into it).
LONG_HEAD_S = 0.250
STEADY_SKIP_S = 0.120
# あい enters his move from あ into い this long before い is heard, while
# it is still あ -- where the two takes are joined.
GLIDE_LEAD_S = 0.150
# Two takes of one vowel are seldom sung at one level: the second is
# brought to the first's over LEVEL_MATCH_S either side of the join, by
# LEVEL_MATCH_LIMIT_DB at most.
LEVEL_MATCH_S = 0.040
LEVEL_MATCH_LIMIT_DB = 6
# The last resort for a bank with no note held long enough: repeat this
# much of the vowel's steady end at a time -- after dropping its last
# HOLD_GUARD_S, where a sung vowel already bends toward the consonant
# that follows it in the string.
HOLD_LOOP_S = 0.200
HOLD_GUARD_S = 0.050
# A syllable in a joined string stops this far short of the next sound,
# so none of that sound's consonant is heard.
END_MARGIN_S = 0.020
# Less than this between a syllable's onset and the next sound in its
# string is not a syllable a learner can hear.
MIN_SYLLABLE_S = 0.100
FADE_OUT_S = 0.070
FADE_OUT_LONG_S = 0.090
# The onset (see onset()) is read off the voice's envelope: its level
# over ONSET_WINDOW_S, every ONSET_HOP_S -- a window long enough that a
# low hum in the room reads as the steady level it is. The vowel has
# arrived at the first window within ONSET_ARRIVAL_DB of the loudest, and
# the syllable began where the sound running back from there does,
# stopping at ONSET_GAP_S of windows in a row below the gate, and never
# more than ONSET_MAX_LEAD_S before the vowel (no consonant is that
# long). The gate is ONSET_BELOW_PEAK_DB under the loudest, or, in a
# noisy room, ONSET_ABOVE_NOISE_DB over the noise (the median of what
# comes before the vowel) -- but never more than ONSET_MOST_BELOW_PEAK_DB
# under the loudest, which a syllable opening straight on its consonant
# would otherwise lose the soft start of. The cut then starts PRE_ROLL_S
# earlier still, so a soft consonant -- the breath of は, the hiss of さ --
# is kept whole; the silence that comes with it is
# build_kana_audio.finish()'s to trim.
ONSET_WINDOW_S = 0.020
ONSET_HOP_S = 0.005
ONSET_ARRIVAL_DB = -6
ONSET_BELOW_PEAK_DB = -40
ONSET_ABOVE_NOISE_DB = 6
ONSET_MOST_BELOW_PEAK_DB = -26
ONSET_GAP_S = 0.020
ONSET_MAX_LEAD_S = 0.350
ONSET_FLOOR = 32768 * 10 ** (-60 / 20)
PRE_ROLL_S = 0.060

# A syllable in an alias or a file name: hiragana, and ー for a long
# tone; ヴ and ン read as their hiragana (a joined bank writes them in
# katakana), other katakana not at all (小春音アミ's ガ行 are her nasal
# variants). A pitch (A3, G#4) is not part of what an alias says.
_SYLLABLE = re.compile(r"[ぁ-ゖー]+")
_READ_AS = str.maketrans({"ヴ": "ゔ", "ン": "ん"})
_PITCH = re.compile(r"[A-G][#b]?\d")
# A joined bank names the sound a syllable is sung after by its vowel:
# "a い" is い entered from あ.
_AFTER = {"a": "あ", "i": "い", "u": "う", "e": "え", "o": "お", "n": "ん"}
_VOWELS = set("あいうえお")


class BankError(Exception):
    """A bank the importer cannot use, or a sample in it."""


def to_hiragana(text: str) -> str:
    return "".join(chr(ord(ch) - 0x60) if "ァ" <= ch <= "ヶ" else ch for ch in text)


# ── Recipes ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class Recipe:
    """How one clip is made: a shape ("short", "long", "diphthong") and,
    per part, the bank syllables that may supply it, in preference
    order -- the first one the bank has is used."""

    shape: str
    parts: tuple[tuple[str, ...], ...]
    note: str = ""


_LONG = {"ああ": "あ", "いい": "い", "うう": "う", "ええ": "え", "えい": "え", "おお": "お", "おう": "お"}
_DIPHTHONG = {"あい": ("あ", "い"), "おい": ("お", "い")}
_V_ROW = {"ゔぁ": "ば", "ゔぃ": "び", "ゔ": "ぶ", "ゔぇ": "べ", "ゔぉ": "ぼ"}
# Kana said as another: を is "o"; ぢ and づ are じ and ず, and a bank
# that recorded them apart recorded the same sound twice.
_SAID_AS = {"を": ("お",), "ぢ": ("じ", "ぢ"), "づ": ("ず", "づ")}


def recipe_for(kana: str) -> Recipe:
    """The recipe for one deck entry's kana (hiragana or katakana)."""
    hira = to_hiragana(kana)
    if len(hira) == 2 and hira[1] == "ー":               # アー -> ああ
        hira = hira[0] * 2
    if hira in _LONG:
        vowel = _LONG[hira]
        return Recipe("long", ((vowel + "ー", vowel),))
    if hira in _DIPHTHONG:
        first, second = _DIPHTHONG[hira]
        return Recipe("diphthong", ((first,), (second,)))
    if hira in _V_ROW:
        return Recipe("short", ((hira, _V_ROW[hira]),),
                      note=f"no {hira} in the bank: said as {_V_ROW[hira]}, the バ row")
    if hira in _SAID_AS:
        return Recipe("short", (_SAID_AS[hira],))
    return Recipe("short", ((hira,),))


def recipes(sounds: dict[str, dict]) -> dict[str, Recipe]:
    """sound name -> Recipe, over build_kana_audio.plan()'s grouping.
    The first entry filed under a name decides: the deck lists hiragana
    first, so じ, not ぢ, makes "ji"."""
    return {name: recipe_for(slot["kana"][0]) for name, slot in sounds.items()}


# ── The bank ─────────────────────────────────────────────────────

def parse_alias(alias: str) -> tuple[str | None, bool, bool]:
    """What an alias -- or a file's name -- says: (syllable, whether it
    opens a string, whether it is the plain sample rather than a
    variant). "- かA3" is (か, True, True); "a きゃF4" (きゃ, False,
    True); "あ_G4" and "あ" (あ, True, True); "- か↑A3" and "あR" are
    variants; "ガ" and "息" say no syllable."""
    tokens = unicodedata.normalize("NFC", alias).split()
    if not tokens:
        return None, True, False
    opens = len(tokens) == 1 or tokens[0] == "-"
    token = tokens[-1].translate(_READ_AS)
    runs = _SYLLABLE.findall(token)
    if not runs:
        return None, opens, False
    syllable = max(runs, key=len)
    rest = _PITCH.sub("", token.replace(syllable, "", 1)).strip("_- ")
    return syllable, opens, not rest


def _key(path: Path) -> str:
    # A bank unzipped from a Mac archive can name が as か + ゛ (NFD):
    # every path is compared composed.
    return unicodedata.normalize("NFC", str(path))


@dataclass(frozen=True)
class Sample:
    """One sound in a recording, and where it has to end."""

    path: Path
    alias: str                       # as the oto.ini names it, or the file's name
    syllable: str | None
    plain: bool = True
    start_ms: float = 0.0            # the oto offset: the onset is looked for from here
    heard_ms: float = 0.0            # offset + preutterance: where the sound is heard
    blank_ms: float | None = None    # the oto cutoff, which ends the last sound in a file
    after: "Sample | None" = None    # the next sound in the same string

    def end_ms(self, duration_ms: float) -> float:
        """Where the sound ends: where the next one in its string is
        heard; else the oto cutoff (UTAU's rule: a positive one counts
        from the end of the file, a negative one from the offset); else
        the end of the file."""
        if self.after is not None:
            return min(self.after.heard_ms, duration_ms)
        if self.blank_ms is not None:
            end = duration_ms - self.blank_ms if self.blank_ms >= 0 else self.start_ms - self.blank_ms
            return max(self.start_ms, min(end, duration_ms))
        return duration_ms

    def room_ms(self) -> float:
        """How long the sound runs, as far as the oto.ini says without
        opening the file (a sound that runs to the file's end: forever)."""
        if self.after is not None:
            return self.after.heard_ms - self.start_ms
        if self.blank_ms is not None and self.blank_ms < 0:
            return -self.blank_ms
        return float("inf")


@dataclass
class Bank:
    samples: dict[str, Sample] = field(default_factory=dict)   # syllable -> its word-initial sample
    # (from, to) -> a sound sung straight out of the vowel `from` ("a い"
    # is (あ, い)): the moves a joined bank records between its syllables.
    transitions: dict[tuple[str, str], Sample] = field(default_factory=dict)
    # vowel -> the longest note held on it, anywhere in the bank.
    steady: dict[str, Sample] = field(default_factory=dict)
    # Every folder a syllable was found in. More than one is usually one
    # per pitch, and the best sample of each syllable across them would
    # sing the set in several keys.
    folders: list[str] = field(default_factory=list)

    def pick(self, choices: tuple[str, ...]) -> str | None:
        return next((c for c in choices if c in self.samples), None)


def _read_oto(path: Path) -> list[tuple[str, str, float, float | None, float]]:
    """(file, alias, offset, cutoff, preutterance) per line of one
    oto.ini, in milliseconds; cutoff is None on a line without one."""
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp932"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise BankError(f"{path}: neither UTF-8 nor Shift_JIS")
    lines = []
    for line in text.splitlines():
        name, sep, rest = line.partition("=")
        fields = [f.strip() for f in rest.split(",")]
        if not sep or len(fields) < 2:
            continue
        try:
            numbers = [float(f) if f else 0.0 for f in fields[1:6]]
        except ValueError:
            continue
        if not all(math.isfinite(n) for n in numbers):
            continue
        offset, _consonant, cutoff, preutterance = (numbers + [0.0] * 4)[:4]
        lines.append((name.strip(), fields[0], offset, cutoff if len(fields) > 3 else None, preutterance))
    return lines


def _sounds_in(wav_path: Path, lines: list[tuple[str, float, float | None, float]] | None
               ) -> list[tuple[Sample, bool]]:
    """Every sound the oto.ini names in one recording, in order, each
    linked to the next, with whether it opens its string -- or, for a
    file the oto.ini does not name, the file as one syllable."""
    stem = unicodedata.normalize("NFC", wav_path.stem)
    if not lines:
        syllable, opens, plain = parse_alias(stem)
        return [(Sample(wav_path, stem, syllable, plain), True)] if syllable else []
    named = []
    for alias, offset, cutoff, preutterance in lines:
        syllable, opens, plain = parse_alias(alias or stem)
        named.append((offset, not plain, alias or stem, syllable, opens, plain, cutoff, preutterance))
    named.sort(key=lambda n: n[:2])
    # Two aliases at one offset are two names for one sound (a variant
    # of the plain one): the plain one stands for it.
    by_offset = {}
    for n in named:
        by_offset.setdefault(n[0], n)
    ordered = list(by_offset.values())
    sounds, after = [], None
    for i in range(len(ordered) - 1, -1, -1):
        offset, _variant, alias, syllable, opens, plain, cutoff, preutterance = ordered[i]
        after = Sample(wav_path, alias, syllable, plain, offset, offset + preutterance, cutoff, after)
        # "- か" opens a string wherever it is; a bare "か" only as the
        # first sound in its file -- a joined bank that also names its
        # sounds bare names them in the middle of a string, after a vowel.
        marked = unicodedata.normalize("NFC", alias).lstrip().startswith("-")
        sounds.append((after, opens and (marked or i == 0)))
    return sounds[::-1]


def index_bank(root: Path, pitch: str | None = None) -> Bank:
    """Every syllable under `root` that is sung on its own -- a
    single-syllable file, or the sound opening a joined string -- keyed
    by its hiragana. With `pitch` ("A3"), only the files in a folder of
    exactly that name: 何かがキレ keeps A4, A4弱 and A4強 side by side, and
    A4 is not A4弱. Where several claim one syllable, the plain sample
    wins, then the one with the most room before the next sound, then
    the shortest name: a variant (あ2, か↑) loses to the plain あ, か."""
    lines: dict[str, list] = {}
    for oto in sorted(root.rglob("oto.ini")):
        for name, alias, offset, cutoff, preutterance in _read_oto(oto):
            lines.setdefault(_key(oto.parent / name), []).append((alias, offset, cutoff, preutterance))

    best: dict[str, tuple] = {}
    moves: dict[tuple[str, str], tuple] = {}
    held: dict[str, tuple] = {}
    folders: set[str] = set()
    wanted = unicodedata.normalize("NFC", pitch).casefold() if pitch else None

    def keep(table: dict, key, rank: tuple, sample: Sample) -> None:
        if key not in table or rank < table[key][0]:
            table[key] = (rank, sample)

    for wav_path in sorted(root.rglob("*.wav")):
        relative = unicodedata.normalize("NFC", wav_path.relative_to(root).as_posix())
        if wanted and wanted not in relative.casefold().split("/")[:-1]:
            continue
        duration = _duration_ms(wav_path)
        for sample, opens in _sounds_in(wav_path, lines.get(_key(wav_path))):
            if sample.syllable is None:
                continue
            run = sample.end_ms(duration) - sample.heard_ms     # how long it is heard for
            if sample.syllable in _VOWELS:
                keep(held, sample.syllable, (not sample.plain, -run, relative), sample)
            tokens = unicodedata.normalize("NFC", sample.alias).split()
            if len(tokens) == 2 and tokens[0].casefold() in _AFTER:
                keep(moves, (_AFTER[tokens[0].casefold()], sample.syllable), (not sample.plain, -run, relative), sample)
            if opens:
                folders.add(wav_path.parent.name)
                keep(best, sample.syllable, (not sample.plain, -sample.room_ms(), len(sample.alias), relative), sample)
    return Bank({s: ranked[1] for s, ranked in best.items()}, {k: ranked[1] for k, ranked in moves.items()},
                {v: ranked[1] for v, ranked in held.items()}, sorted(folders))


def _duration_ms(path: Path) -> float:
    """A WAV's length from its header, without reading its samples (one
    the stdlib cannot open counts as endless: the cut finds its end)."""
    try:
        with wave.open(str(path)) as clip:
            return clip.getnframes() / clip.getframerate() * 1000
    except (wave.Error, EOFError, OSError):
        return float("inf")


def missing(bank: Bank, plan: dict[str, Recipe]) -> list[str]:
    """Every sound the bank cannot make, with the syllables it lacks."""
    gaps = []
    for name, recipe in sorted(plan.items()):
        lacking = [" or ".join(choices) for choices in recipe.parts if bank.pick(choices) is None]
        if lacking:
            gaps.append(f"{name}: needs {', '.join(lacking)}")
    return gaps


# ── Cutting ──────────────────────────────────────────────────────

def load(path: Path) -> voice_engine.Pcm:
    """A bank sample as 16-bit mono: a 24- or 32-bit one keeps its top
    16 bits (her studio records at 24), a stereo one is folded to mono."""
    try:
        with wave.open(io.BytesIO(path.read_bytes())) as clip:
            channels, width, rate = clip.getnchannels(), clip.getsampwidth(), clip.getframerate()
            frames = clip.readframes(clip.getnframes())
    except (wave.Error, EOFError) as e:
        raise BankError(f"{path.name}: not a PCM WAV the importer reads ({e})") from e
    if width not in (2, 3, 4):
        raise BankError(f"{path.name}: {8 * width}-bit audio; the importer reads 16, 24 or 32")
    if width > 2:
        # Little-endian: a sample's top two bytes are its last two.
        top = bytearray(2 * (len(frames) // width))
        top[0::2], top[1::2] = frames[width - 2::width], frames[width - 1::width]
        frames = bytes(top)
    samples = array("h", frames)
    if channels > 1:
        samples = array("h", (sum(samples[i:i + channels]) // channels
                              for i in range(0, len(samples), channels)))
    return voice_engine.Pcm(samples.tobytes(), rate)


def onset(samples: array, rate: int, offset_ms: float = 0.0, end: int | None = None) -> int:
    """Where the syllable starts, between the oto offset and `end` (the
    next sound in its string): found from the vowel backwards, not from
    the offset forwards. An offset is only a floor -- one bank leaves it
    at 0, and 波音リツ's 通常 bank opens every "- " region some 300 ms
    early, over room noise louder than a soft consonant. Whatever is
    heard before a gap of silence is not the syllable; so the onset is
    where the sound that runs unbroken into the vowel begins, refined
    to its first sample loud enough."""
    begin = min(int(offset_ms / 1000 * rate), len(samples))
    stop = len(samples) if end is None else max(begin, min(end, len(samples)))
    width, hop = max(1, int(ONSET_WINDOW_S * rate)), max(1, int(ONSET_HOP_S * rate))
    energy = [0.0]                                   # running sum of squares, for any window's level
    for x in samples[begin:stop]:
        energy.append(energy[-1] + x * x)
    starts = range(begin, stop, hop)
    levels = [math.sqrt((energy[min(i - begin + width, stop - begin)] - energy[i - begin])
                        / (min(i - begin + width, stop - begin) - (i - begin))) for i in starts]
    top = max(levels, default=0.0)
    if top <= 0:
        return begin
    arrival = next(k for k, level in enumerate(levels) if level >= top * 10 ** (ONSET_ARRIVAL_DB / 20))
    gate = max(ONSET_FLOOR, top * 10 ** (ONSET_BELOW_PEAK_DB / 20))
    if arrival >= 4:
        noise = sorted(levels[:arrival])[arrival // 2]
        gate = max(gate, min(noise * 10 ** (ONSET_ABOVE_NOISE_DB / 20), top * 10 ** (ONSET_MOST_BELOW_PEAK_DB / 20)))
    first, quiet = arrival, 0
    for k in range(arrival - 1, max(-1, arrival - round(ONSET_MAX_LEAD_S / ONSET_HOP_S) - 1), -1):
        if levels[k] >= gate:
            first, quiet = k, 0
        else:
            quiet += 1
            if quiet >= round(ONSET_GAP_S / ONSET_HOP_S):
                break
    window = starts[first]
    return next((i for i in range(window, min(window + width, stop)) if abs(samples[i]) >= gate), window)


def _recording(sample: Sample) -> tuple[array, int, int, int]:
    """The recording a sample is in, its rate, and where the sample's
    sound begins (its offset) and ends, in frames."""
    pcm = load(sample.path)
    samples = array("h", pcm.frames)
    to_frames = pcm.rate / 1000
    duration_ms = len(samples) / to_frames
    begin = min(int(sample.start_ms * to_frames), len(samples))
    end = int(sample.end_ms(duration_ms) * to_frames)
    if sample.after is not None:
        end -= int(END_MARGIN_S * pcm.rate)
    return samples, pcm.rate, begin, max(begin, min(end, len(samples)))


def _floats(samples: array, start: int, stop: int) -> list[float]:
    return [s / 32768 for s in samples[max(0, start):stop]]


def _fade(piece: list[float], rate: int, seconds: float) -> list[float]:
    fade = min(int(seconds * rate), len(piece))
    for i in range(fade):
        piece[-1 - i] *= i / fade
    return piece


def _spoken(sample: Sample, seconds: float) -> tuple[list[float], int, int]:
    """The syllable from PRE_ROLL_S before its onset: `seconds` of it,
    or as much as its recording has before the next sound. Returns the
    piece, its rate, and how many frames of it follow the onset."""
    samples, rate, begin, end = _recording(sample)
    start = onset(samples, rate, sample.start_ms, end)
    stop = min(start + int(seconds * rate), end)
    if stop - start < int(MIN_SYLLABLE_S * rate):
        raise BankError(f"{sample.path.name}: {sample.alias!r} is heard for "
                        f"{(stop - start) / rate * 1000:.0f} ms before the next sound")
    return _floats(samples, start - int(PRE_ROLL_S * rate), stop), rate, stop - start


def _steady(sample: Sample, seconds: float) -> tuple[list[float], int]:
    """`seconds` of a vowel from SECOND_SKIP_S past its onset, where it
    is steady, with the PHASE_SEARCH_S _join slides it by to spare."""
    samples, rate, begin, end = _recording(sample)
    start = onset(samples, rate, sample.start_ms, end) + int(SECOND_SKIP_S * rate)
    return _floats(samples, start, min(start + int((seconds + PHASE_SEARCH_S) * rate), end)), rate


def _in_phase(tail: list[float], follow: list[float], search: int) -> int:
    """How far into `follow` to begin so it lines up in phase with
    `tail` (the shift of highest correlation over the crossfade). Two
    vowels at one pitch, blended half a period apart, cancel -- a dip in
    the middle of the glide that sounds like a hiccup."""
    n = len(tail)
    scores = [sum(a * b for a, b in zip(tail, follow[shift:shift + n])) for shift in range(search + 1)]
    return max(range(len(scores)), key=scores.__getitem__)


def _join(first: list[float], second: list[float], rate: int) -> list[float]:
    """`first`, then `second` slid into phase with it (by up to
    PHASE_SEARCH_S, which `second` carries to spare) and crossfaded in
    over CROSSFADE_S."""
    search = int(PHASE_SEARCH_S * rate)
    overlap = min(int(CROSSFADE_S * rate), len(first), len(second) - search)
    if overlap <= 0:
        raise BankError("too little sound to join")
    head, tail = first[:len(first) - overlap], first[len(first) - overlap:]
    second = second[_in_phase(tail, second, search):]
    glide = [a * (1 - i / overlap) + b * (i / overlap) for i, (a, b) in enumerate(zip(tail, second))]
    return head + glide + second[overlap:]


def _match_level(tail: list[float], head: list[float], rate: int) -> list[float]:
    """`tail` scaled so its first LEVEL_MATCH_S is as loud as the last of
    `head`, which it is about to be joined to."""
    n = int(LEVEL_MATCH_S * rate)
    ends = [math.sqrt(sum(x * x for x in part) / len(part)) if part else 0.0 for part in (head[-n:], tail[:n])]
    if min(ends) <= 0:
        return tail
    limit = 10 ** (LEVEL_MATCH_LIMIT_DB / 20)
    gain = min(max(ends[0] / ends[1], 1 / limit), limit)
    return [x * gain for x in tail]


def _sustained(attack: Sample, note: Sample) -> tuple[list[float], int] | None:
    """A long vowel as he sang one: the vowel's word-initial attack
    (LONG_HEAD_S of it), then -- joined in phase, at the attack's level --
    the note he held on that vowel, from STEADY_SKIP_S after it is heard.
    None when the note is too short to fill LONG_S, or at another rate."""
    head, rate, heard = _spoken(attack, LONG_HEAD_S)
    samples, note_rate, _begin, end = _recording(note)
    if note_rate != rate:
        return None
    start = int((note.heard_ms / 1000 + STEADY_SKIP_S) * rate)
    need = int(LONG_S * rate) - heard + int((CROSSFADE_S + PHASE_SEARCH_S) * rate)
    if end - start < need:
        return None
    piece = _join(head, _match_level(_floats(samples, start, start + need), head, rate), rate)
    return piece[:len(head) - heard + int(LONG_S * rate)], rate


def _hold(piece: list[float], rate: int, length: int) -> list[float]:
    """A vowel held longer than its recording holds it: the last
    HOLD_LOOP_S of it, steady by then, repeated -- each repeat joined
    in phase with what came before -- until it is `length` frames long.
    A joined bank has no long tones; its vowel runs only until the next
    sound in the string."""
    held = piece[:max(len(piece) - int(HOLD_GUARD_S * rate), int(CROSSFADE_S * rate))]
    loop = held[-int((HOLD_LOOP_S + PHASE_SEARCH_S) * rate):]
    while len(held) < length:
        held = _join(held, list(loop), rate)
    return held[:length]


def _glide(attack: Sample, move: Sample) -> tuple[list[float], int]:
    """あい as he sang it: the first vowel's word-initial attack, then his
    own move into the second (`move`, "a い"), entered GLIDE_LEAD_S before
    the second vowel is heard -- still the first vowel, where the two takes
    are joined, in phase and at one level. The attack is cut so that the
    first vowel lasts DIPHTHONG_FIRST_S in all."""
    samples, rate, _begin, end = _recording(move)
    to_frames = rate / 1000
    heard = int(move.heard_ms * to_frames)
    enter = max(int(move.start_ms * to_frames), heard - int(GLIDE_LEAD_S * rate))
    stop = min(heard + int(DIPHTHONG_SECOND_S * rate), end)
    first = max(DIPHTHONG_FIRST_S - (heard - enter) / rate, MIN_SYLLABLE_S) + CROSSFADE_S
    head, head_rate, _heard = _spoken(attack, first)
    if head_rate != rate:
        raise BankError(f"{attack.alias} and {move.alias} are recorded at different rates")
    tail = _floats(samples, enter - int(PHASE_SEARCH_S * rate), stop)
    return _join(head, _match_level(tail, head, rate), rate), rate


def make(bank: Bank, recipe: Recipe) -> tuple[voice_engine.Pcm, str]:
    """The clip a recipe describes, as 16-bit mono at the bank's rate,
    and what it was cut from, for the report ("- かA3", "あー",
    "- あA3 → a いA3", "- えA3 (held)")."""
    used = [bank.pick(choices) for choices in recipe.parts]
    if None in used:
        raise BankError(f"the bank has none of {' / '.join(' or '.join(c) for c in recipe.parts)}")
    first = bank.samples[used[0]]
    if recipe.shape == "short":
        piece, rate, _heard = _spoken(first, SHORT_S)
        source, fade = first.alias, FADE_OUT_S
    elif recipe.shape == "long":
        piece, rate, heard = _spoken(first, LONG_S)
        source, fade = first.alias, FADE_OUT_LONG_S
        if heard < int(LONG_S * rate):
            note = None if used[0].endswith("ー") else bank.steady.get(used[0])
            sustained = _sustained(first, note) if note is not None else None
            if sustained is not None:
                (piece, rate), source = sustained, f"{first.alias} + {note.alias}"
            else:
                piece = _hold(piece, rate, len(piece) + int(LONG_S * rate) - heard)
                source += " (held)"
    elif recipe.shape == "diphthong":
        move, fade = bank.transitions.get((used[0], used[1])), FADE_OUT_S
        if move is not None:
            piece, rate = _glide(first, move)
            source = f"{first.alias} → {move.alias}"
        else:
            second = bank.samples[used[1]]
            head, rate, _heard = _spoken(first, DIPHTHONG_FIRST_S)
            follow, second_rate = _steady(second, DIPHTHONG_SECOND_S)
            if second_rate != rate:
                raise BankError(f"{first.alias} and {second.alias} are recorded at different rates")
            piece, source = _join(head, follow, rate), f"{first.alias} + {second.alias}"
    else:
        raise ValueError(f"unknown shape {recipe.shape!r}")
    _fade(piece, rate, fade)
    frames = array("h", (max(-32768, min(32767, round(x * 32768))) for x in piece))
    return voice_engine.Pcm(frames.tobytes(), rate), source
