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
             _generate_probe_image) as an image_url content part, and
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
import re
import sys

import requests

import scripts._env  # noqa: F401  -- must precede the study import, which
#                       reads the provider API keys at module scope.
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


# The exact text drawn into the probe image -- what a vision-capable
# model is expected to echo back (loosely; see _vision_verdict).
_VISION_PROBE_TEXT = "日本語"

# Windows system fonts with real CJK glyph coverage, tried in order.
# MS Gothic is present on every Windows install; the others are
# fallbacks for environments where it isn't. If none is found, the
# probe is skipped entirely with an explanation rather than silently
# testing with tofu-box glyphs, which would prove nothing.
_CJK_FONT_CANDIDATES = (
    r"C:\Windows\Fonts\msgothic.ttc",
    r"C:\Windows\Fonts\meiryo.ttc",
    r"C:\Windows\Fonts\YuGothM.ttc",
)


def _generate_probe_image() -> str | None:
    """A small PNG (real rendered Japanese glyphs, not a stock photo or
    a remote fetch) as a base64 data URI, or None if no CJK-capable font
    could be found to render it with."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("  ! Pillow is not installed -- cannot generate a probe image")
        return None

    font = None
    for path in _CJK_FONT_CANDIDATES:
        try:
            font = ImageFont.truetype(path, 36)
            break
        except OSError:
            continue
    if font is None:
        print(f"  ! no CJK font found among {_CJK_FONT_CANDIDATES} -- cannot generate a probe image")
        return None

    img = Image.new("RGB", (200, 80), "white")
    ImageDraw.Draw(img).text((10, 20), _VISION_PROBE_TEXT, font=font, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def _vision_verdict(response) -> str:
    if response.status_code == 400:
        return "NOT-VISION (400)"
    if response.status_code == 404 and "image input" in response.text.lower():
        # OpenRouter's own way of saying the same thing NVIDIA says with
        # a 400 -- confirmed live: {"error":{"message":"No endpoints
        # found that support image input","code":404}}.
        return "NOT-VISION (404)"
    if not response.ok:
        return f"HTTP {response.status_code}: {response.text[:150]}"
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError):
        return "BAD-BODY"
    if not content:
        return "NULL"
    if _VISION_PROBE_TEXT in content:
        return f"OK (echoed): {content[:80]!r}"
    if re.search(r"[ぁ-んァ-ン一-龯]", content):
        return f"OK (some JP, not exact): {content[:80]!r}"
    return f"UNCLEAR: {content[:80]!r}"


def _check_vision(provider, data_uri: str) -> int:
    """One request per model with an image_url content part. Returns
    the number that did NOT look vision-capable."""
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What Japanese text is written in this image? Reply with only the text."},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        }
    ]
    failed = 0
    for model in provider.models:
        body = {"model": model, "messages": messages, "max_tokens": 100, **provider.body_for(False)}
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

        verdict = _vision_verdict(response)
        if not verdict.startswith("OK"):
            failed += 1
        print(f"    {verdict}  {model}")
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

    vision_data_uri = None
    if args.vision:
        vision_data_uri = _generate_probe_image()
        if vision_data_uri is None:
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
            print("  vision probe (one image request each):")
            problems += _check_vision(provider, vision_data_uri)

    print()
    if problems:
        print(f"{problems} problem(s) found - see above.")
        return 1
    print("All configured models present and usable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
