# Paying for the model: what to run Tsuji on once it sells

Written 2026-09-20. Prices are September 2026 and move; re-check before
committing. The arithmetic is `backend/scripts/llm_cost_model.py`, which
takes the same numbers as arguments so it can be re-run rather than
re-argued.

## 1. The premise is right: nothing we call today is sellable

`study/llm_shared.py` is free-tools-only, and says so. Both providers
break in a different way the moment money changes hands.

**NVIDIA (`integrate.api.nvidia.com`) — the harder blocker.** The hosted
catalogue at build.nvidia.com is a trial: 1,000 API credits on signup,
5,000 with a business address, under the NVIDIA Developer Program for
research and prototyping. Production use is NVIDIA AI Enterprise, from
about $4,500 per GPU-year. This is not a rate limit to route around; it
is the wrong product. It is also our *default primary* today
(`_DEFAULT_PROVIDER_ORDER = "nvidia,openrouter"`), which means the text
path — exam generation, comprehension, phrase analysis, translation
review — sits on it.

**OpenRouter `:free` — softer, but not a business.** The `:free`
endpoints are not licence-barred from commercial use, but three things
make them unusable as paid infrastructure: a hard 20 requests/minute
ceiling and 1,000 requests/day per account; looser data-handling terms
than the paid endpoints (free traffic can be used by the upstream
provider); and no availability guarantee at all. We have already been
bitten by the last one twice, and the code carries the scars — the
402-for-every-model outage in 2026-08 that added NVIDIA as a second
provider, and two vision models that reached end-of-life *hours* after
being benchmarked.

Note the arithmetic on that daily cap: **one** N3 exam paper is roughly
35 calls. 1,000 requests/day is about 28 exams, for the entire user
base, before everything stops.

The good news is that none of this is an architecture problem.
`Provider` in `llm_shared.py` is already "any OpenAI-compatible endpoint
plus the models to try on it", the fallback and dead-model bookkeeping
are provider-agnostic, and the model lists are the only thing that has
to change. Adding a paid provider is a config entry, not a rewrite.

## 2. What we actually spend tokens on

Every LLM feature is already behind `require_pass` (`core/credits.py`),
so **a free learner costs nothing in inference.** This is the single
most important fact for the projection: LLM spend is a cost of goods on
the subscription, not a cost of having users.

Per paying learner, in a typical month:

| Feature | Calls | Input tok | Output tok | Cached? |
|---|---:|---:|---:|---|
| Reading comprehension | 34 | 91,800 | 102,000 | **no** |
| Exam paper generation (amortized) | 52 | 67,600 | 104,000 | shared papers |
| Translation review | 60 | 36,000 | 24,000 | no (contains the learner's answer) |
| Phrase / sentence analysis | 50 | 20,000 | 25,000 | yes, ~75% hit |
| OCR (photo input) | 20 | 28,000 | 8,000 | no |
| **Total** | **216** | **243,400** | **263,000** | |

Two things fall out of that table.

**Reading comprehension is the most expensive thing we do**, and the
only big one with no cache. One call writes a passage, ten questions, a
per-sentence translation *and* a glossed word list, at
`max_tokens=12000`, up to three times if the checks reject it
(`routes/reading.py`, `_call_llm_comprehension`).

**Exam generation is already the cheapest thing we do per learner**, and
it does not look like it. ~35 calls per paper is a lot, but
`exam_papers` rows are picked per revision across the whole user base
(`_select_paper`), so the cost divides by everyone who sits that paper.
It is also entirely off the request path — which makes it the one
workload that can go through a Batch API at half price.

## 3. The recommendation

**Gemini 3.1 Flash-Lite ($0.25 / $1.50 per 1M) as the primary, GPT-5-mini
($0.25 / $2.00) as the paid fallback, and the existing free tier kept
last as a free-fallback rather than deleted.**

Why not simply the cheapest row in the table:

- **Qwen3.7 Flash ($0.03/$0.13) and GPT-5-nano ($0.05/$0.40)** are five
  to ten times cheaper and would land the whole fleet under $0.10 a
  user. They are the right answer for the *bounded-JSON batch work* —
  `call_llm_json_batch`, the vocab and grammar item generators — where
  the output is four choices and a sentence, and a bad answer is caught
  by `exam_validation.py` anyway. They are not the right answer for the
  comprehension exercise, which has to satisfy a kanji gate, a level
  gate, a seed-coverage check and a reproduce-the-text check *at once*;
  the retry that a weak model triggers costs a whole 12k-token call and
  wipes out the saving.
- **Gemini's Flash family is the strongest cheap option on Japanese
  specifically**, including vertical (tategaki) text, which the vision
  work already discovered the hard way: every NVIDIA vision model in
  `llm_shared.py` scores 0/3 on tategaki, and our own benchmark notes
  record `qwen3-vl` and `qwen2.5-vl` at 3/3 for ~$0.0002 an image. Manga
  and novels are vertical; OCR has to handle them.
- **Claude Haiku 4.5 ($1/$5)** is ~3.4x Flash-Lite. It was the original
  primary here before the 2026-08 switch to free models. It is worth
  keeping in mind as the escalation target if the level gates start
  rejecting Flash-Lite output often — a model that gets it right first
  time at 3x the price is cheaper than one that needs three attempts.
  That is a measurement to make, not a guess to act on now.

Concretely, a three-tier assignment rather than one model everywhere:

| Work | Model | Why |
|---|---|---|
| Reading comprehension, translation review, phrase analysis | Gemini 3.1 Flash-Lite | Quality-sensitive, gated, retries are expensive |
| Exam item batches (`call_llm_json_batch`), grammar sentences | GPT-5-nano or Qwen3.7 Flash | Bounded JSON, validated downstream, offline |
| OCR / vision | Gemini Flash (vision) | The only cheap tier that reads tategaki |

This is four lines of `_PROVIDER_CATALOG` and one `reasoning_body`
lambda per provider. Nothing above `chat()` changes.

## 4. The projection

At Gemini 3.1 Flash-Lite, per paying learner per month:

| Intensity | As-is | With caching + batch |
|---|---:|---:|
| Light (2 sessions/week) | $0.14 | $0.10 |
| Typical (daily-ish) | $0.46 | $0.32 |
| Heavy (power user) | $1.37 | $0.97 |
| **Abuse ceiling at today's limits** | **$6.41** | **$4.44** |

Blended at 70% light / 25% typical / 5% heavy: **$0.20–0.23 per paying
subscriber per month.**

| Paying subscribers | Monthly inference |
|---:|---:|
| 100 | ~$23 |
| 1,000 | ~$228 |
| 10,000 | ~$2,280 |

Against a subscription in the ¥500–1,000 / €5–8 range, inference is
**3–5% of revenue** — comfortably inside payment-processing noise. On
the two cheap models it is under 1%; on Claude Sonnet 5 it would be
~25%, which is the real reason not to reach for a frontier model here.

The number to watch is not the blended average, it is the last row of
the first table. `OCR_DAILY_LIMIT` is 60 images a day and reading
comprehension has no cap at all, so a single determined user can spend
20x the typical subscriber. That is survivable at these prices, but it
should be a deliberate decision rather than an accident.

## 5. What to do, in order

Free wins first — these cost quality nothing, and two of them are
already half-built here.

1. **Log `usage` from every response.** We have never had a reason to
   count tokens, so every figure above is an estimate from prompt
   lengths. One extra column in the existing logging, and the model in
   `scripts/llm_cost_model.py` becomes measurement.
2. **Prompt-cache the stable prefix.** Every exam-generation call
   re-sends the allowed-kanji list — 613 characters at N3, **2,212 at
   N1** — plus a fixed template. That is ~60% of input tokens, and it is
   byte-identical across calls if the volatile part (seeds, topic,
   feedback) goes last. Cached input bills at ~10%.
3. **Cache the comprehension exercise.** `phrase_analysis_cache` already
   proves the pattern in this codebase. An exercise is a function of
   (level, lang, grammar seeds, word seeds) — not of who asked. It
   cannot be shared as aggressively as a phrase (the seeds are drawn
   from the learner's own recent history), but a pool of pre-generated
   exercises per (level, lang), served round-robin and topped up in the
   background, turns the most expensive call we make into an amortized
   one. This is the single biggest lever in the list.
4. **Batch the offline work.** Exam papers and
   `scripts/generate_grammar_sentences.py` are not on the request path.
   Both Anthropic and OpenAI price a batch queue at 50%.
5. **Then, and only then, cap the tails.** Drop `OCR_DAILY_LIMIT` from
   60 to something a human actually needs (10–15), and give reading
   comprehension a daily ceiling of its own. Both are already the right
   shape — the OCR one is a counted daily slot with a 429.
6. **Keep the free tier as a fallback, not the primary.** Put the paid
   provider first in `LLM_PROVIDER_ORDER` and leave OpenRouter `:free`
   last. It costs nothing to keep, and the day the paid account 402s,
   the app degrades instead of stopping. The existing dead-provider
   bookkeeping already does exactly this.

## 6. Measure, then re-run this

```bash
cd backend
python -m scripts.llm_cost_model                    # the table above
python -m scripts.llm_cost_model --fleet 5000       # a fleet projection
python -m scripts.llm_cost_model --model "GPT-5-mini"
```

The CALLS / IN / OUT columns in that script are the assumptions. Replace
them with logged `usage` figures once step 1 is done, and the projection
stops being an argument.

## Sources

Prices and terms, September 2026:

- [OpenRouter Terms of Service](https://openrouter.ai/terms) and
  [free models](https://openrouter.ai/collections/free-models)
- [OpenRouter free tier limits](https://pricepertoken.com/endpoints/openrouter/free)
- [NVIDIA NIM free plan limits](https://costbench.com/software/llm-api-providers/nvidia-nim/free-plan/)
  and [NVIDIA Build free credits](https://yangmao.ai/en/providers/nvidia-build/free-api/)
- [Gemini API pricing](https://www.morphllm.com/gemini-api-pricing),
  [Gemini 3.1 Flash-Lite](https://devtk.ai/en/models/gemini-3-1-flash-lite/)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing),
  [per-model table](https://www.morphllm.com/openai-api-pricing)
- [Cross-provider comparison](https://benchlm.ai/llm-pricing)
- Claude model prices are the first-party API rates for
  `claude-haiku-4-5` ($1/$5) and `claude-sonnet-5` ($2/$10).
