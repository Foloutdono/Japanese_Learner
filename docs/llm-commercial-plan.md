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
| Reading comprehension | 34 | 91,800 | 102,000 | **pooled** (§5.3) |
| Exam paper generation (amortized) | 52 | 67,600 | 104,000 | shared papers |
| Translation review | 60 | 36,000 | 24,000 | no (contains the learner's answer) |
| Phrase / sentence analysis | 50 | 20,000 | 25,000 | yes, ~75% hit |
| OCR (photo input) | 20 | 28,000 | 8,000 | no |
| **Total** | **216** | **243,400** | **263,000** | |

Two things fall out of that table.

**Reading comprehension is the most expensive thing we do**, and it was
the only big one with no cache. One call writes a passage, ten
questions, a per-sentence translation *and* a glossed word list, at
`max_tokens=12000`, up to three times if the checks reject it
(`routes/reading.py`, `_call_llm_comprehension`). It is pooled now — the
row above is the cold-pool worst case, a learner alone in their
(level, lang) bucket; §5.3 is what it becomes once the bucket is
shared.

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
| **Abuse ceiling at today's limits** | **$5.23** | **$3.67** |

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
the first table. A single determined user can still spend 15-20x the
typical subscriber. `OCR_DAILY_LIMIT` is 20 now (§5.5), which took that
ceiling from $4.44 to $3.67 — a smaller dent than it looks like it
should be, and the reason is worth stating plainly: **OCR was never
where the tail was.** Reading comprehension has no daily ceiling at all,
and at ~780 calls a month it is most of that row on its own. Capping it
is the remaining half of §5.5.

## 5. What to do, in order

Free wins first — these cost quality nothing, and two of them are
already half-built here.

1. ~~**Log `usage` from every response.**~~ **Done.** `chat()` writes one
   line per billed response to the logger `study.llm_shared.usage`,
   carrying the task, the model and the token counts the provider
   reported. `scripts/llm_usage_report.py` totals a log into the same
   shape `llm_cost_model.py` estimates, so the two can be compared
   directly. See §7.
2. ~~**Prompt-cache the stable prefix.**~~ **Done for the one prompt it
   can work on, and the measurement corrected two things I had wrong
   when I wrote this line.**

   First, there is no flag. Both configured providers cache
   automatically, and what they cache is the longest byte-identical
   *prefix* of a request. So the whole of "prompt caching" here is
   prompt structure: a volatile value early in the prompt does not cost
   a little of the cache, it costs all of it — and every prompt in this
   codebase had one. The comprehension seeds sat at character 87 of
   6,500.

   Second, both providers ignore prefixes under about 1,024 tokens, and
   **the exam-generation prompts are 250–470 tokens each** — two to four
   times under the threshold. No reordering can make them cacheable.
   The claim this line used to make ("~60% of input tokens", "2,212
   characters at N1") was wrong twice over: the full kanji list is only
   sent at N5–N3 (`exam_gen_utils._FULL_LIST_LEVELS`), so it is at most
   613 characters, and at N2–N1 it is a single sentence. The per-prompt
   measurements are recorded in `exam_gen_utils.py` so the next person
   does not re-derive them.

   What did work: the comprehension prompt, at ~6,700 characters, is the
   one above the threshold. It is now two messages — a block stable per
   (level, lang) rendered through an `lru_cache` so byte-identity is a
   property of the code, and the per-call seeds and retry feedback
   after it. Whether it *hits* is the provider's business; the
   `cached=` column of the usage log is the answer, and if it stays at
   0 on `task=comprehension` this bought nothing.
3. ~~**Cache the comprehension exercise.**~~ **Done**, and as a pool
   rather than a cache — the distinction is the whole design.
   `phrase_analysis_cache` can key on the phrase because the caller
   brings the phrase; nobody brings an exercise, and the seeds that
   would be the key are drawn per learner precisely to *avoid* repeats,
   so keying on them would hit almost never. The rule that works is
   `exam_papers`': serve this learner any exercise at their level and
   language they have not been served, and generate only when there is
   none. `comprehension_pool` holds the model's answer;
   `comprehension_served` records who has read which — on serve, not on
   completion, since an exercise opened and abandoned has still been
   read.

   What it changes: comprehension generation stops scaling with the
   number of learners and starts scaling with the *deepest* reader in
   each bucket. With N learners sharing a (level, lang) bucket and
   reading at similar rates, the per-learner comprehension bill falls
   by roughly N. At 40 a bucket, the blended figure in §4 goes from
   $0.23 to **$0.14** a subscriber — `llm_cost_model --pool-share 40`.
   The first reader at each level and language still pays full price,
   which is what every reader paid before, so no case got worse.
   `scripts/prewarm_comprehension_pool.py` moves even that cost off the
   learner's path.
4. **Batch the offline work.** Exam papers and
   `scripts/generate_grammar_sentences.py` are not on the request path.
   Both Anthropic and OpenAI price a batch queue at 50%.
5. **Cap the tails.** **Half done.** `OCR_DAILY_LIMIT` is 20, not 60
   — and 20 rather than the 10–15 this line first proposed, because 10
   stops being an abuse ceiling and starts being a product limit: a
   learner reading a manga chapter photographs it page by page, and a
   chapter is more than ten pages. The counter also moved to the
   learner's local day (`core/credits.local_today`), which the 60 never
   needed and 20 does: a learner in Tokyo crosses into the next UTC day
   at 09:00 local, so a UTC cap would refill them mid-morning and leave
   them nothing after dinner — and would make the screen's own "try
   again tomorrow" untrue.

   **Reading comprehension still has no ceiling**, and it is the bigger
   half: at ~780 calls a month it is most of the abuse row above on its
   own, where OCR at 20/day is about $1. The OCR cap moved that row by
   17%; a comprehension cap would move it far more. It needs a product
   decision rather than a number — a learner who reads ten exercises in
   an evening is the app working, not abuse — so it is left open
   deliberately.
6. ~~**Keep the free tier as a fallback, not the primary.**~~ **Done.**
   `_DEFAULT_PROVIDER_ORDER` is now `google,openai,openrouter`: paid
   first, OpenRouter `:free` last as the degradation path. NVIDIA is no
   longer in the default order at all, because its hosted catalogue is
   licensed for prototyping — it stays in the catalogue and
   `LLM_PROVIDER_ORDER=nvidia,openrouter` brings it back for local work.
   See §7.

## 6. What is wired, and what is not

Steps 1 and 6 shipped with this document. Three details are worth
knowing before the first deploy.

**The model ids are unverified.** Every other model id in
`study/llm_shared.py` was confirmed live against the provider's own
`GET /v1/models` before being adopted — twice, after being bitten by a
retired model. That could not be done here: these were chosen on
published pricing, without an account for either provider. Every id is
env-overridable for exactly that reason, and the first thing to do with
a real key is:

```bash
cd backend
python -m scripts.check_llm_models          # do the ids exist?
python -m scripts.check_llm_models --smoke  # do they write usable Japanese?
python -m scripts.check_llm_models --vision # can they read tategaki?
```

The `--smoke` run is the one that matters. A model can be in the
catalogue and still answer an N5 prompt in English, which is exactly
what `meta/llama-3.3-70b-instruct` did and why it is absent from the
NVIDIA list.

**One thing to watch on the first paid run:** whether Gemini spends the
completion budget on thinking. Neither paid provider is sent a reasoning
knob — the values are a closed set on both, a wrong top-level key is a
400, and `chat()` treats a 400 as permanent and retires the model for
the process. Saying nothing is the safe request. But this app has
already been bitten by a reasoning trace crowding out the answer in a
batched call (see the OpenRouter entry's comment), and if batched
generation comes back truncated, that is the first suspect; the fix is a
thinking config in `extra_body`, added once `--smoke` has shown it.

**The pool is retired by a version string, not a migration.** Bump
`routes/reading._POOL_VERSION` when the prompt, the checks or the served
shape change enough that a stored exercise would be wrong, and every one
of them stops being served in one edit — `exam_papers.generator_version`'s
trick. Do not bump it for a typo. The prewarm script refills against
whatever the current version is.

**A deployment carrying only `NVIDIA_API_KEY` loses its LLM features on
deploy.** That is the intended consequence of the licensing, and it
degrades correctly — `llm_configured()` goes false, generators skip and
routes answer 503 rather than crashing — but it would explain itself
nowhere, so `_build_providers()` now logs a warning at startup naming
any provider that has a key and is not in the order.

## 7. Measure, then re-run this

```bash
cd backend
python -m scripts.llm_cost_model                    # the table above
python -m scripts.llm_cost_model --fleet 5000       # a fleet projection
python -m scripts.llm_cost_model --model "GPT-5-mini"
python -m scripts.llm_cost_model --pool-share 40    # with a warm pool
```

`--pool-share` is the one number here that can be measured directly
rather than guessed, and it is worth measuring before it is trusted:

```sql
SELECT level, lang, COUNT(*) AS exercises FROM comprehension_pool
 WHERE generator_version = 'comprehension-1' GROUP BY level, lang;
SELECT COUNT(*) AS serves, COUNT(DISTINCT pool_id) AS exercises
  FROM comprehension_served;
```

Serves divided by exercises is the real share. If it stays near 1, the
pool is not being shared — either the buckets are too thinly populated
to help yet, or `_POOL_VERSION` is being bumped too often.

The CALLS / IN / OUT columns in that script are the assumptions. The log
is what replaces them:

```bash
python -m scripts.llm_usage_report app.log --days 30 --users 120
```

It reads any text stream (a file or stdin), ignores everything that is
not an `llm-usage` line, and totals by model and by task:

```
By task                          calls  failed        in       out    cached   $
  comprehension                    412      19   969,884 1,071,552   612,000  ...
```

Two columns deserve a second look every time. `failed` counts responses
that were paid for and could not be used — each one is a retry that
billed twice for one answer, and they are invisible in any other view.
`cached` is the prefix the provider served from its cache at about a
tenth of the price; if it stays at zero while `in` is large, step 2 has
not actually taken effect and the allowed-kanji list is being re-sent at
full price on every call.

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
