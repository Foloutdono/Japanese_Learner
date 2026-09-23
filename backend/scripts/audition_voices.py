"""
Hear every voice the engine has, reading what the app will make it read,
before choosing study/voice_engine.DEFAULT_VOICES.

    python -m scripts.audition_voices                         # all voices
    python -m scripts.audition_voices --voices 女声1,男声2     # some
    python -m scripts.audition_voices --trio 女声1,女声2,男声1  # a dialogue, as the app would voice it

One file per voice goes into backend/datas/voice_audition/ (gitignored):
a narration line, a dialogue line, a dictation line at dictation's
speed, words, lone kana through the path /api/tts takes (は must say
"ha", not the particle "wa"), and a run of the kana deck's syllables the
way scripts/build_kana_audio.py makes them. `--trio` renders one
listening item through study/exam_tts.synthesize_dialogue itself --
narrator, then A (a woman) and B (a man), with the real pauses -- so
what is heard is what a learner will hear.

Choosing: the first name is the reader (every word, dictation line and
kana, and the exam narrator), the second and third are A and B. Put them
in DEFAULT_VOICES and bump VOICE_REV with them (and KANA_REV in
frontend/src/lib/audio/playback.js if the kana set is remade in the new
voice); TTS_VOICES in the environment is for trying a choice out
locally, not for production.

Needs the voice engine (VOICEVOX_URL) and nothing else: no database.
"""
import argparse
import logging
import os
import shutil
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

OUT_DIR = Path(__file__).resolve().parents[1] / "datas" / "voice_audition"

from scripts.build_kana_audio import notation  # noqa: E402
from study import voice_engine  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("audition-voices")

NARRATION = "女の人と男の人が話しています。女の人はこのあと何をしますか。"
DIALOGUE = "すみません、この電車は東京駅に止まりますか。"
DICTATION = "学校は九時からです。"
WORDS = ["まいげつ", "たべる", "はし", "シングルス", "こんにちは", "ありがとうございます"]
LONE_KANA = ["は", "へ", "を", "ん", "ド", "キャ", "ウォ"]
KANA_RUN = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "を", "ん",
            "きゃ", "しゅ", "ちょ", "ファ", "ティ", "ヴ", "ウォ", "ああ", "えい", "おう"]
TRIO = [
    {"speaker": "narrator", "textJp": "女の人と男の人が話しています。"},
    {"speaker": "A", "textJp": "あした、何時に会いましょうか。"},
    {"speaker": "B", "textJp": "午前十時はどうですか。"},
    {"speaker": "A", "textJp": "いいですよ。駅の前で待っています。"},
    {"speaker": "narrator", "textJp": "二人は何時に会いますか。"},
]


def _voice_sample(name: str) -> tuple[bytes, float, float]:
    style = voice_engine.style_named(name)
    rate = voice_engine.DIALOGUE_RATE
    gap = voice_engine.silence(0.6, rate)
    parts, started = [], time.time()
    for text, speed in [(NARRATION, 1.0), (DIALOGUE, 1.0),
                        (DICTATION, voice_engine.speed_scale("-10%"))]:
        parts += [voice_engine.say(text, style, speed=speed, sample_rate=rate), gap]
    for text in WORDS + LONE_KANA:
        parts += [voice_engine.say(text, style, sample_rate=rate), gap]
    for kana in KANA_RUN:
        parts += [voice_engine.say_kana(notation(kana), style, sample_rate=rate, level_pitch=True,
                                        hold=voice_engine.LONE_KANA_HOLD_S), gap]
    elapsed = time.time() - started
    pcm = voice_engine.join(parts)
    return voice_engine.encode_mp3(pcm), pcm.seconds, elapsed


def _trio(names: list[str]) -> Path:
    # Through synthesize_dialogue itself, into a scratch clip store, so
    # the slots and pauses are the app's own rather than a copy of them.
    os.environ["TTS_VOICES"] = ",".join(names)
    os.environ["EXAM_AUDIO_DIR"] = str(OUT_DIR / "trio-store")
    from study import exam_tts

    url = exam_tts.synthesize_dialogue(TRIO, force=True)
    target = OUT_DIR / f"trio-{'-'.join(names)}.mp3"
    shutil.copyfile(Path(exam_tts.audio_dir()) / url.rsplit("/", 1)[-1], target)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--voices", help="comma-separated voice names (default: every voice)")
    parser.add_argument("--trio", help="reader,A,B -- render one listening item with these three")
    args = parser.parse_args()

    if not voice_engine.configured():
        logger.error("No voice engine configured: set VOICEVOX_URL (see backend/.env.example).")
        return 1
    try:
        logger.info("Engine %s, version %s", voice_engine.base_url(), voice_engine.version())
        table = voice_engine._style_table()
    except voice_engine.TTSFailed as e:
        logger.error("%s", e)
        return 1
    every = sorted(name for name in table if "/" not in name)
    logger.info("Voices: %s", ", ".join(f"{n} ({table[n]})" for n in every))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.trio:
        names = [n.strip() for n in args.trio.split(",") if n.strip()]
        if len(names) != 3:
            logger.error("--trio takes three names: reader,A,B")
            return 1
        try:
            logger.info("Wrote %s", _trio(names))
        except voice_engine.TTSFailed as e:
            logger.error("%s", e)
            return 1
        return 0

    chosen = [n.strip() for n in args.voices.split(",")] if args.voices else every
    for name in chosen:
        try:
            data, seconds, elapsed = _voice_sample(name)
        except voice_engine.TTSFailed as e:
            logger.error("%s: %s", name, e)
            return 1
        path = OUT_DIR / f"{name}.mp3"
        path.write_bytes(data)
        logger.info("  %s: %.1fs of audio in %.1fs (%.2fx real time) -> %s",
                    name, seconds, elapsed, elapsed / seconds, path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
