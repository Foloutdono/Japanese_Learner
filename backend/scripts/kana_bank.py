"""
The kana deck from a recorded voicebank (plan 113b, docs/adr/0019).

scripts/build_kana_audio.py --from-bank DIR uses this module to turn an
UTAU single-syllable bank -- 小春音アミ's 単独音 bank from
あみたろの声素材工房 (https://amitaro.net/utau/), which its author
recommends for exactly this ("日本語五十音読み上げ音声") -- into the
deck's 127 clips.

-- What a bank looks like ----------------------------------------
A folder of WAVs, one sung syllable each, usually named by the syllable
in hiragana (あ.wav, きゃ.wav, ふぁ.wav) and often one sub-folder per
pitch (C4/ E4/ G4/ ...), each with an oto.ini: UTAU's table of where
each sample's sound starts (`file=alias,offset,consonant,cutoff,
preutterance,overlap`, in milliseconds, and in Shift_JIS as often as
not). A bank that names its files in romaji names the syllable in the
oto.ini alias instead, and that is read too. `--pitch` keeps the one
folder asked for; the author's recommendation for read-aloud is G4
("「あー」「いー」など日本語五十音読み上げ音声は…「単独音3.0」の「G4(ソ)」",
https://amitaro.net/voice/yomiage_01/).

Her manual (https://amitaro.net/utau/tips_t_normal.html) names the
rest of what such a bank holds, and the index takes it into account:
a pitch suffix on an alias (あ_G4) is not part of the syllable; a
long tone (あー, いー...) is a syllable of its own, recorded to be
held; katakana ガ行 are her nasal variants, and the hiragana ones
the plain sounds the deck teaches, so only hiragana names are read;
and her other variants (あR, ら舌, 息...) lose to the plain sample.

-- What is made from it --------------------------------------------
Every sound the deck teaches, by recipe (recipe_for), from the bank's
own syllables:

  - a syllable is its sample, cut short -- the samples are sung and
    held, and a learner hears a syllable, not a note;
  - a long vowel (ああ, アー, and えい/おう, which the lesson teaches as ē
    and ō) is the bank's long tone (あー), or the vowel's sample held
    longer where it has none;
  - あい and おい are two samples, the second joined to the first in
    phase (see _in_phase);
  - を is お's sample, because を is said "o" (ウォ, the "wo" sound, is
    うぉ's);
  - ぢ/づ share じ/ず's clip, as they share the deck's sound name;
  - the ヴ row is ゔぁ… if the bank has it, and the バ row otherwise --
    which is how most speakers say it; the import reports when it
    happens.

No new dependency: the stdlib `wave` module and `array` do the cutting,
build_kana_audio.finish() the trim and loudness it gives every clip, and
LAME (study/voice_engine.encode_mp3) resamples the bank's 44.1 kHz to
the set's 48 kHz on the way out.

-- The terms ------------------------------------------------------
あみたろ's terms (https://amitaro.net/voice/voice_rule/,
https://amitaro.net/utau/licence01.html) allow commercial use on
conditions: the credit 「あみたろの声素材工房」 with a link (the app's
Credits page and THIRD_PARTY_NOTICES.md), an email to her after release,
and no distributing or selling the voice files themselves as material.
That last one is why the bank is read from backend/datas/kana_source/,
which is gitignored: only the processed clips are committed.
"""
import io
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
# How far the join may slide to meet the first vowel in phase: a pitch
# period at C4 (the lowest folder a bank like this has) is 3.8 ms.
PHASE_SEARCH_S = 0.005
FADE_OUT_S = 0.070
FADE_OUT_LONG_S = 0.090
# The onset is where the sample first rises within this much of its own
# peak (after the oto offset, when there is one), less PRE_ROLL_S so a
# soft consonant -- the breath of は, the hiss of さ -- is kept whole.
# The silence that comes with it is build_kana_audio.finish()'s to trim.
ONSET_BELOW_PEAK_DB = -36
ONSET_FLOOR = 32768 * 10 ** (-60 / 20)
PRE_ROLL_S = 0.060

# A syllable in a file name or an alias: hiragana, and ー for a long tone.
_SYLLABLE = re.compile(r"[ぁ-ゖー]+")


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

def _key(path: Path) -> str:
    # A bank unzipped from a Mac archive can name が as か + ゛ (NFD):
    # every path is compared composed.
    return unicodedata.normalize("NFC", str(path))


@dataclass
class Bank:
    samples: dict[str, Path] = field(default_factory=dict)   # syllable -> wav
    offsets_ms: dict[str, float] = field(default_factory=dict)   # _key(wav) -> oto offset

    def pick(self, choices: tuple[str, ...]) -> str | None:
        return next((c for c in choices if c in self.samples), None)

    def offset_ms(self, path: Path) -> float:
        return self.offsets_ms.get(_key(path), 0.0)


def _read_oto(path: Path) -> list[tuple[str, str, float]]:
    """(file, alias, offset ms) per line of one oto.ini."""
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
        fields = rest.split(",")
        if not sep or len(fields) < 2:
            continue
        try:
            lines.append((name.strip(), fields[0].strip(), float(fields[1] or 0)))
        except ValueError:
            continue
    return lines


def _syllable(*names: str) -> str | None:
    """The syllable a sample is of: the longest hiragana run in the first
    of `names` that has one ("きゃ", "_きゃ", "きゃ_G4" and "きゃ↑" are all
    きゃ; "あー" is あー)."""
    for name in names:
        runs = _SYLLABLE.findall(unicodedata.normalize("NFC", name))
        if runs:
            return max(runs, key=len)
    return None


def index_bank(root: Path, pitch: str | None = None) -> Bank:
    """Every syllable sample under `root`, keyed by its hiragana. With
    `pitch` ("G4"), only the files whose path names it. Where two files
    claim one syllable, the one named exactly by it wins, then the
    shortest name: a bank's variants (あ2.wav, あ↑.wav) lose to あ.wav."""
    bank = Bank()
    aliases: dict[str, str] = {}
    for oto in sorted(root.rglob("oto.ini")):
        for name, alias, offset in _read_oto(oto):
            key = _key(oto.parent / name)
            bank.offsets_ms.setdefault(key, offset)
            aliases.setdefault(key, alias)

    ranked: dict[str, tuple[int, int, str, Path]] = {}
    for wav_path in sorted(root.rglob("*.wav")):
        relative = unicodedata.normalize("NFC", wav_path.relative_to(root).as_posix())
        if pitch and pitch.casefold() not in relative.casefold():
            continue
        stem = unicodedata.normalize("NFC", wav_path.stem)
        syllable = _syllable(stem, aliases.get(_key(wav_path), ""))
        if syllable is None:
            continue
        rank = (0 if stem == syllable else 1, len(stem), relative, wav_path)
        if syllable not in ranked or rank < ranked[syllable]:
            ranked[syllable] = rank
    bank.samples = {syllable: rank[-1] for syllable, rank in ranked.items()}
    return bank


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


def onset(samples: array, rate: int, offset_ms: float = 0.0) -> int:
    """Where the syllable starts: the first sample, from the oto offset
    on, that rises within ONSET_BELOW_PEAK_DB of the sample's peak. The
    offset alone is not trusted -- a bank tuned for singing sets it, but
    one that left it at 0 would otherwise hand over its leading silence
    as the syllable."""
    begin = min(int(offset_ms / 1000 * rate), len(samples))
    rest = samples[begin:]
    peak = max(max(rest), -min(rest)) if rest else 0
    gate = max(ONSET_FLOOR, peak * 10 ** (ONSET_BELOW_PEAK_DB / 20))
    return next((i for i in range(begin, len(samples)) if abs(samples[i]) >= gate), begin)


def _cut(bank: Bank, syllable: str, seconds: float, *, fade_s: float, pre_roll_s: float = PRE_ROLL_S,
         skip_s: float = 0.0, extra: int = 0) -> tuple[list[float], int]:
    """`seconds` of a syllable from its onset (+ `skip_s`), with
    `pre_roll_s` before it and `extra` samples after, as floats, the
    last `fade_s` faded out."""
    path = bank.samples[syllable]
    pcm = load(path)
    samples = array("h", pcm.frames)
    start = onset(samples, pcm.rate, bank.offset_ms(path)) + int(skip_s * pcm.rate)
    begin = max(0, start - int(pre_roll_s * pcm.rate))
    piece = [s / 32768 for s in samples[begin:start + int(seconds * pcm.rate) + extra]]
    if not piece:
        raise BankError(f"{path.name}: nothing after the onset")
    fade = min(int(fade_s * pcm.rate), len(piece))
    for i in range(fade):
        piece[-1 - i] *= i / fade
    return piece, pcm.rate


def _in_phase(tail: list[float], follow: list[float], search: int) -> int:
    """How far into `follow` to begin so it lines up in phase with
    `tail` (the shift of highest correlation over the crossfade). Two
    vowels at one pitch, blended half a period apart, cancel -- a dip in
    the middle of the glide that sounds like a hiccup."""
    n = len(tail)
    scores = [sum(a * b for a, b in zip(tail, follow[shift:shift + n])) for shift in range(search + 1)]
    return max(range(len(scores)), key=scores.__getitem__)


def make(bank: Bank, recipe: Recipe) -> tuple[voice_engine.Pcm, list[str]]:
    """The clip a recipe describes, as 16-bit mono at the bank's rate,
    and the bank syllables it was made from."""
    used = [bank.pick(choices) for choices in recipe.parts]
    if None in used:
        raise BankError(f"the bank has none of {' / '.join(' or '.join(c) for c in recipe.parts)}")
    if recipe.shape == "short":
        signal, rate = _cut(bank, used[0], SHORT_S, fade_s=FADE_OUT_S)
    elif recipe.shape == "long":
        signal, rate = _cut(bank, used[0], LONG_S, fade_s=FADE_OUT_LONG_S)
    elif recipe.shape == "diphthong":
        first, rate = _cut(bank, used[0], DIPHTHONG_FIRST_S, fade_s=0.0)
        search = int(PHASE_SEARCH_S * rate)
        second, second_rate = _cut(bank, used[1], DIPHTHONG_SECOND_S, fade_s=FADE_OUT_S,
                                   pre_roll_s=0.0, skip_s=SECOND_SKIP_S, extra=search)
        if second_rate != rate:
            raise BankError(f"{used[0]} and {used[1]} are recorded at different rates")
        overlap = min(int(CROSSFADE_S * rate), len(first), len(second) - search)
        head, tail = first[:len(first) - overlap], first[len(first) - overlap:]
        second = second[_in_phase(tail, second, search):]
        glide = [a * (1 - i / overlap) + b * (i / overlap) for i, (a, b) in enumerate(zip(tail, second))]
        signal = head + glide + second[overlap:]
    else:
        raise ValueError(f"unknown shape {recipe.shape!r}")
    frames = array("h", (max(-32768, min(32767, round(x * 32768))) for x in signal))
    return voice_engine.Pcm(frames.tobytes(), rate), used
