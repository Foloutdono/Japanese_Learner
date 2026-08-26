"""
Check every configured LLM model against its provider's live catalog.

    python -m scripts.check_llm_models
    python -m scripts.check_llm_models --smoke
    python -m scripts.check_llm_models --vision

Model catalogs drift. This project has been bitten by that twice now --
once when OpenRouter retired the primary and two of four fallbacks
(every call wasted a round trip on a 404 before reaching a live model),
and once when a stale OPENROUTER_MODEL in a shell environment pointed at
a model that had moved off the free tier. Both were only found by
reading server logs during an unrelated failure.

Run this after changing study/llm_shared.py's PROVIDERS, or when
generation starts failing for no obvious reason. It answers three
different questions:

  (no flag)  Does this model id still EXIST for this account?
             One GET /v1/models per provider, no completion tokens spent.

  --smoke    Does it still write USABLE JAPANESE? Sends one small
             N5-constrained prompt per model and checks the reply is
             parseable JSON containing Japanese that the kanji gate
             either passes or soften_kanji can salvage. Costs one
             completion per model, so it is opt-in.

  --vision   Can it read an IMAGE at all? Sends one request per model
             with a small generated PNG (real Japanese glyphs, rendered
             locally via Pillow + a system CJK font -- see
             _generate_probe_cases) as an image_url content part, and
             checks whether the model echoes back the pictured text
             rather than rejecting the request shape outright. This is
             plan 018 (photo/OCR input)'s Step 1: none of the models in
             PROVIDERS below were added for their vision ability, so
             nothing should be built on top of one until this has
             actually said yes.

A model can pass the first check and fail the second -- that is exactly
what happened with NVIDIA's Nemotron models, which are listed and
callable but return their reasoning trace instead of JSON unless
thinking is explicitly disabled.
"""
import argparse
import base64
import io
import json
import logging
import random
import re
import sys

import requests

import scripts._env  # noqa: F401  -- must precede the study import, which
#                       reads the provider API keys at module scope.
from study.ocr_prompt import OCR_PROMPT
from study.llm_shared import (
    PROVIDERS, allowed_kanji_for_level, sentence_kanji_ok, soften_kanji,
)

logging.basicConfig(level=logging.WARNING, format="%(message)s")
logger = logging.getLogger("check-llm-models")

# Deliberately tiny: this is a smoke test, not a generation run. Two
# rather than one, because every batched call in the app asks for at
# least two -- and asked for exactly one, some models reasonably answer
# with a bare object instead of a 1-element array, which would be
# reported as a failure the generators never actually meet.
_SMOKE_ITEMS = 2
_SMOKE_TIMEOUT = 120

_SMOKE_PROMPT = (
    "You are writing {n} JLPT N5 listening comprehension question(s). "
    "Write a short, natural Japanese dialogue between two people (A and B) "
    "about a plan or an errand, then ONE spoken comprehension question about "
    "it and exactly 4 short printed answer choices.\n"
    "Kanji you use MUST come from this list:\n{allowed_kanji}\n"
    "(use hiragana instead for anything else).\n"
    "Respond with ONLY JSON (no markdown fences, no commentary): a JSON array "
    'of exactly {n} objects, each matching:\n'
    '{{"contextJp": "...", '
    '"turns": [{{"speaker": "A", "textJp": "..."}}, {{"speaker": "B", "textJp": "..."}}], '
    '"questionJp": "...", "choices": ["..", "..", "..", ".."], "correctIndex": 0}}'
)


def _catalog(provider) -> set[str] | None:
    """Model ids the provider will admit to having, or None if the
    catalog itself could not be read (which is its own kind of finding:
    a bad key shows up here, before any completion is ever attempted)."""
    url = provider.url.replace("/chat/completions", "/models")
    try:
        response = requests.get(
            url, headers={"Authorization": f"Bearer {provider.api_key}"}, timeout=30
        )
    except requests.RequestException as e:
        print(f"  ! could not reach {url}: {e}")
        return None
    if not response.ok:
        print(f"  ! GET /models failed ({response.status_code}): {response.text[:200]}")
        return None
    try:
        return {m["id"] for m in response.json()["data"]}
    except (KeyError, TypeError, ValueError):
        print(f"  ! unexpected /models body: {response.text[:200]}")
        return None


def _check_catalog(provider) -> int:
    """Prints one line per configured model. Returns the number missing."""
    ids = _catalog(provider)
    if ids is None:
        return len(provider.models)

    print(f"  catalog: {len(ids)} models visible to this account")
    missing = 0
    for model in provider.models:
        if model in ids:
            print(f"    OK      {model}")
        else:
            missing += 1
            print(f"    MISSING {model}")
    return missing


def _smoke(provider) -> int:
    """One real completion per model, checked the way the exam
    generators actually consume it. Returns the number that failed."""
    prompt = _SMOKE_PROMPT.format(
        n=_SMOKE_ITEMS, allowed_kanji=allowed_kanji_for_level("N5")
    )
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the question."},
    ]

    failed = 0
    for model in provider.models:
        # chat() walks the whole provider list, which is not what we
        # want here -- each model has to be asked on its own, or a
        # working fallback would mask a broken primary. So this posts
        # directly, mirroring what chat() sends including the provider's
        # own reasoning-knob rendering.
        body = {
            "model": model, "messages": messages, "max_tokens": 1200,
            **provider.body_for(False),
        }
        try:
            response = requests.post(
                provider.url,
                headers={"Authorization": f"Bearer {provider.api_key}",
                         "Content-Type": "application/json"},
                json=body, timeout=_SMOKE_TIMEOUT,
            )
        except requests.RequestException as e:
            failed += 1
            print(f"    FAIL    {model}: {type(e).__name__}")
            continue

        verdict = _verdict(response)
        if verdict != "OK":
            failed += 1
        print(f"    {verdict:7s} {model}")
    return failed


def _verdict(response) -> str:
    if not response.ok:
        return f"HTTP {response.status_code}"
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError):
        return "BAD-BODY"
    if not content:
        return "NULL"

    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        items = json.loads(cleaned)
    except json.JSONDecodeError:
        # Overwhelmingly this is a reasoning model narrating its thinking
        # where the JSON should be -- worth naming, since the fix is a
        # provider-level flag rather than a different model.
        return "NO-JSON"
    if not isinstance(items, list) or not items:
        return "NOT-LIST"

    text = "".join(
        str(i.get("contextJp", ""))
        + "".join(str(t.get("textJp", "")) for t in i.get("turns", []))
        + str(i.get("questionJp", ""))
        for i in items if isinstance(i, dict)
    )
    if not re.search(r"[ぁ-んァ-ン]", text):
        return "NO-JP"
    # Matching what the generators accept: out-of-level kanji is fine so
    # long as soften_kanji can read it as kana (see its docstring).
    if not sentence_kanji_ok(text, "N5") and soften_kanji(text, "N5") is None:
        return "GATE"
    return "OK"


# ── Vision probe ──────────────────────────────────────────────────
# Rewritten 2026-08-26 after the 2026-08 run produced a FALSE NEGATIVE
# that cost the OCR feature a release. Three bugs, all fixed here:
#
#   1. It looped `provider.models` -- the TEXT models. It never asked
#      which models accept images, then reported "no vision capability
#      exists" when what it had measured was "the text models I tried
#      are text models". It now walks `provider.vision_models`.
#   2. It used its own short prompt. Probing with a prompt the app never
#      sends measures the wrong thing -- and for OCR_PROMPT that is not
#      a technicality: its orientation clauses are worth 0/3 -> 3/3 on
#      vertical text.
#   3. One clean image. Every candidate scores 3/3 on clean text; only
#      degraded and vertical images separate them.
#
# And the lesson that made the false negative stick: a 429, a 500 or a
# timeout are QUOTA and RELIABILITY signals, NEVER capability signals.
# Capability is disproved by a 400/404 on an image request, or by
# garbled output that survives a retry -- nothing else. The vision
# primary fails transiently about 1 call in 5, so a probe without a
# retry would keep re-deriving the same wrong conclusion.
_CJK_FONT_CANDIDATES = (
    r"C:\Windows\Fonts\msgothic.ttc",
    r"C:\Windows\Fonts\meiryo.ttc",
    r"C:\Windows\Fonts\YuGothM.ttc",
)

_VISION_RETRIES = 1


def _load_cjk_font(size: int):
    from PIL import ImageFont
    for path in _CJK_FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return None


def _data_uri(img, fmt="PNG", **save_kwargs) -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, **save_kwargs)
    mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


def _generate_probe_cases() -> list[tuple[str, str, list[str]]] | None:
    """(name, data_uri, expected_lines) for three images of increasing
    difficulty, or None if no CJK font is available to render them --
    in which case the probe is skipped with an explanation rather than
    silently testing tofu boxes, which would prove nothing."""
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        print("  ! Pillow is not installed -- cannot generate probe images")
        return None

    font = _load_cjk_font(34)
    if font is None:
        print(f"  ! no CJK font found among {_CJK_FONT_CANDIDATES} -- skipping vision probe")
        return None

    cases = []

    # 1. Clean. Everything passes this; it is the floor, not the test.
    clean_lines = ["猫が公園を歩いています。", "日本語の勉強は毎日続けます。"]
    img = Image.new("RGB", (700, 140), "white")
    d = ImageDraw.Draw(img)
    for i, line in enumerate(clean_lines):
        d.text((20, 20 + i * 55), line, font=font, fill="black")
    cases.append(("clean", _data_uri(img), clean_lines))

    # 2. Degraded: rotation, downscale, sensor noise, blur, JPEG
    # artifacts -- an approximation of a bad phone photo.
    hard_lines = ["図書館で新しい小説を借りました。"]
    img = Image.new("RGB", (900, 110), "white")
    d = ImageDraw.Draw(img)
    d.text((20, 25), hard_lines[0], font=font, fill=(40, 40, 40))
    img = img.rotate(-2.0, expand=True, fillcolor="white").resize((520, 80))
    px = img.load()
    rnd = random.Random(7)
    for _ in range(3000):
        x, y = rnd.randrange(img.width), rnd.randrange(img.height)
        v = rnd.randint(-60, 60)
        r, g, b = px[x, y]
        px[x, y] = (max(0, min(255, r + v)), max(0, min(255, g + v)), max(0, min(255, b + v)))
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    cases.append(("degraded", _data_uri(img, "JPEG", quality=35), hard_lines))

    # 3. Vertical (tategaki). THE case that separates the models, and the
    # one the orientation prompt exists for.
    vfont = _load_cjk_font(30)
    vertical_lines = ["吾輩は猫である", "名前はまだ無い"]
    img = Image.new("RGB", (300, 400), (250, 248, 242))
    d = ImageDraw.Draw(img)
    x = 230
    for col in vertical_lines:
        y = 25
        for ch in col:
            d.text((x, y), ch, font=vfont, fill=(20, 20, 20))
            y += 34
        x -= 70
    cases.append(("vertical", _data_uri(img, "JPEG", quality=50), vertical_lines))

    return cases


def _vision_call(provider, model, data_uri):
    """One request, retried once on a transient failure. Returns
    (content, note) -- content is None when the model could not be
    reached, and `note` explains why."""
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": OCR_PROMPT},
            {"type": "image_url", "image_url": {"url": data_uri}},
        ],
    }]
    body = {"model": model, "messages": messages, "max_tokens": 400,
            "temperature": 0.0, **provider.body_for(False)}

    for attempt in range(_VISION_RETRIES + 1):
        try:
            response = requests.post(
                provider.url,
                headers={"Authorization": f"Bearer {provider.api_key}",
                         "Content-Type": "application/json"},
                json=body, timeout=_SMOKE_TIMEOUT,
            )
        except requests.RequestException as e:
            if attempt < _VISION_RETRIES:
                continue
            return None, f"transient ({type(e).__name__}) -- NOT a capability result"

        if response.status_code == 400:
            return None, "NOT-VISION (400)"
        if response.status_code == 404 and "image input" in response.text.lower():
            return None, "NOT-VISION (404)"
        if response.status_code == 429:
            return None, "quota (429) -- NOT a capability result"
        if response.status_code >= 500 or not response.ok:
            if attempt < _VISION_RETRIES:
                continue
            return None, f"transient (HTTP {response.status_code}) -- NOT a capability result"
        try:
            return response.json()["choices"][0]["message"]["content"] or "", None
        except (KeyError, IndexError, ValueError):
            return None, "BAD-BODY"
    return None, "unreachable"


def _check_vision(provider, cases) -> int:
    """One request per (vision model, case). Returns the number of models
    that read NOTHING correctly anywhere -- a model that merely scored
    badly on the hard cases is reported, not counted as a failure."""
    if not provider.vision_models:
        print("    (no vision models listed for this provider -- skipped)")
        return 0

    failed = 0
    for model in provider.vision_models:
        scores = []
        for name, data_uri, expected in cases:
            content, note = _vision_call(provider, model, data_uri)
            if content is None:
                scores.append(f"{name}=--({note})")
                continue
            hits = sum(1 for line in expected if line in content)
            scores.append(f"{name}={hits}/{len(expected)}")
        exact_total = sum(
            int(s.split("=")[1].split("/")[0])
            for s in scores if "/" in s
        )
        if exact_total == 0:
            failed += 1
        print(f"    {'FAIL' if exact_total == 0 else ' OK '}  {model}: " + "  ".join(scores))
    return failed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true",
                        help="also send one real completion per model (costs tokens)")
    parser.add_argument("--vision", action="store_true",
                        help="probe each model with a generated image (costs tokens); "
                             "plan 018 Step 1 -- see this file's docstring")
    args = parser.parse_args()

    if not PROVIDERS:
        logger.error(
            "No LLM provider is configured. Set NVIDIA_API_KEY or "
            "OPENROUTER_API_KEY in backend/.env."
        )
        return 1

    vision_cases = None
    if args.vision:
        vision_cases = _generate_probe_cases()
        if vision_cases is None:
            logger.error("Cannot run --vision: no probe image could be generated (see above).")
            return 1

    problems = 0
    for provider in PROVIDERS:
        print(f"\n=== {provider.name} ({provider.url}) ===")
        problems += _check_catalog(provider)
        if args.smoke:
            print("  smoke test (one completion each):")
            problems += _smoke(provider)
        if args.vision:
            print("  vision probe (clean / degraded / vertical, one request each):")
            problems += _check_vision(provider, vision_cases)

    print()
    if problems:
        print(f"{problems} problem(s) found - see above.")
        return 1
    print("All configured models present and usable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
