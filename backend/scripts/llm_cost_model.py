"""What the LLM features cost per paying learner, per month.

Read-only, no database, no network, no .env -- it is arithmetic over the
call sites in study/llm_shared.py's callers, so it runs in a fresh clone
and can be re-run whenever a price, a prompt or a limit moves.

    python -m scripts.llm_cost_model            # the table
    python -m scripts.llm_cost_model --fleet 5000
    python -m scripts.llm_cost_model --model "GPT-5-mini"

Every number below is an ESTIMATE with its reasoning attached, not a
measurement: nothing in this app records token counts today, because
every provider it has ever called was free. The first thing to do after
moving to a paid provider is to log `usage` from each response and
replace the CALLS/IN/OUT columns here with what actually happened --
see docs/llm-commercial-plan.md, "Measure, then re-run this".

Prices are $ per 1M tokens, as published in September 2026. They move;
the table is the one thing here with a short shelf life.
"""
import argparse

# name -> (input $/1M, output $/1M)
PRICES = {
    "Qwen3.7 Flash":         (0.03, 0.13),
    "GPT-5-nano":            (0.05, 0.40),
    "Gemini 2.5 Flash-Lite": (0.10, 0.40),
    "GPT-5.6 Luna":          (0.20, 1.20),
    "Gemini 3.1 Flash-Lite": (0.25, 1.50),
    "GPT-5-mini":            (0.25, 2.00),
    "Gemini 3.5 Flash-Lite": (0.30, 2.50),
    "DeepSeek V4 Flash":     (0.44, 1.32),
    "Claude Haiku 4.5":      (1.00, 5.00),
    "Claude Sonnet 5":       (2.00, 10.00),
}

# The API model id a provider bills under -> the PRICES row above.
# Only ids this project can actually be configured with, and only where
# a published price was found: scripts/llm_usage_report.py totals an
# unknown id's tokens and declines to guess what they cost, which is the
# correct answer until someone reads the invoice.
MODEL_IDS = {
    "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
    "gpt-5-mini": "GPT-5-mini",
    "gpt-5-nano": "GPT-5-nano",
    "claude-haiku-4-5": "Claude Haiku 4.5",
    "claude-sonnet-5": "Claude Sonnet 5",
}

# feature -> (calls/month, input tokens/call, output tokens/call, why)
#
# The token figures come from the prompts themselves. An English prompt
# is ~4 characters to the token; Japanese is close to one token per
# character, which is why the OUTPUT column dominates everywhere and why
# the allowed-kanji list (N5 103 chars ... N1 2,212) is worth caching.
FEATURES = {
    "reading_comprehension": (
        34, 2700, 3000,
        "26 exercises/mo x 1.3 attempts (_COMPREHENSION_ATTEMPTS=3, most "
        "pass first). In: 6.5k-char template + kanji list + seeds. Out: a "
        "250-char passage, 10 questions, a per-sentence breakdown. UNCACHED "
        "-- one call per learner per exercise, forever.",
    ),
    "translation_review": (
        60, 600, 400,
        "3 reviewed attempts a session, 20 sessions. One call each, uncached "
        "(the learner's own answer is in the prompt, so it cannot be shared).",
    ),
    "phrase_analysis": (
        50, 400, 500,
        "200 breakdowns/mo, ~75% served from phrase_analysis_cache (reading "
        "practice draws on ~220 fixed sentences). Only the misses bill.",
    ),
    "ocr_vision": (
        20, 1400, 400,
        "20 photos/mo. An image is ~1.1k tokens plus OCR_PROMPT. The daily "
        "cap is 60 (OCR_DAILY_LIMIT), which is the abuse ceiling, not this.",
    ),
    "exam_generation": (
        52, 1300, 2000,
        "~35 calls build one N3 exam set (vocab 6, grammar+reading ~19, "
        "listening ~10, batched 4-8 items a call). Papers are SHARED -- "
        "exam_papers rows are picked per revision, not per user -- so the "
        "cost amortizes. 52 = 1.5 papers a month per user before sharing.",
    ),
}

# What the free wins are worth. Both are provider features, not rewrites.
CACHED_INPUT_SHARE = 0.60   # template + kanji list are a stable prefix
CACHE_READ_RATE = 0.10      # cached input bills at ~10%
BATCHABLE_SHARE = 0.25      # exam papers + prewarm are offline: batch is -50%


def totals():
    tin = sum(c * i for c, i, _, _ in FEATURES.values())
    tout = sum(c * o for c, _, o, _ in FEATURES.values())
    return tin, tout


def cost(tin, tout, pin, pout, optimized=True):
    if not optimized:
        return (tin * pin + tout * pout) / 1e6
    uncached = tin * (1 - CACHED_INPUT_SHARE) * pin
    cached = tin * CACHED_INPUT_SHARE * pin * CACHE_READ_RATE
    out = tout * pout * (1 - BATCHABLE_SHARE * 0.5)
    return (uncached + cached + out) / 1e6


# Share of paying learners at each intensity, as a multiple of the
# typical month above. Adjust once there is real usage data.
MIX = {"light": (0.70, 0.3), "typical": (0.25, 1.0), "heavy": (0.05, 3.0)}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fleet", type=int, help="paying subscribers to project for")
    ap.add_argument("--model", help="price one model instead of the whole table")
    args = ap.parse_args()

    tin, tout = totals()
    print(f"Per paying learner, a typical month: {tin:,} input / {tout:,} output tokens\n")
    for name, (c, i, o, _why) in FEATURES.items():
        print(f"  {name:24s} {c:4d} calls  {c * i:8,} in  {c * o:8,} out")

    names = [args.model] if args.model else list(PRICES)
    print(f"\n{'model':24s} {'as-is':>9s} {'+cache/batch':>13s}")
    for name in names:
        if name not in PRICES:
            raise SystemExit(f"unknown model {name!r}; known: {', '.join(PRICES)}")
        pin, pout = PRICES[name]
        print(f"{name:24s} {cost(tin, tout, pin, pout, False):9.3f} "
              f"{cost(tin, tout, pin, pout):13.3f}")

    if args.fleet:
        name = args.model or "Gemini 3.1 Flash-Lite"
        pin, pout = PRICES[name]
        blended = sum(
            share * cost(tin * mult, tout * mult, pin, pout)
            for share, mult in MIX.values()
        )
        print(f"\n{name}, {args.fleet:,} paying subscribers "
              f"({', '.join(f'{int(s * 100)}% {k}' for k, (s, _) in MIX.items())}):")
        print(f"  ${blended:.3f}/user/mo -> ${blended * args.fleet:,.0f}/mo")


if __name__ == "__main__":
    main()
