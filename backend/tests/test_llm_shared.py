# Covers what llm_shared.chat is responsible for, all of it
# live-diagnosed 2026-08:
#   - a model that fails PERMANENTLY is never asked again this process
#   - a provider whose ACCOUNT is out (402 credit exhausted, 401/403
#     credentials rejected) is abandoned wholesale and failed over from,
#     rather than re-asked once per model
#   - the reasoning knob is rendered per provider, since sending
#     OpenRouter's field to NVIDIA (or vice versa) breaks every call
#   - a failure no provider can fix surfaces as LLMUnavailable so a
#     caller's retry loop can decline to retry it
# plus soften_kanji, the salvage that replaced "reject the whole item"
# as the response to an out-of-level kanji in SPOKEN text.
import unittest
from unittest import mock

from study import llm_shared
from study.llm_shared import (
    LLMUnavailable, Provider, offending_kanji, sentence_kanji_ok, soften_kanji,
)


class FakeResponse:
    def __init__(self, status_code, content=None):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self._content = content
        self.text = "" if content is None else "body"

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


class FakeSession:
    """Answers each model according to `by_model`, recording every POST
    (model and request body) so a test can assert both on how many
    requests were spent and on what was actually sent."""

    def __init__(self, by_model, default=None):
        self.by_model = by_model
        self.default = default or FakeResponse(500)
        self.calls = []
        self.bodies = []

    def post(self, url, headers=None, json=None, timeout=None):
        self.calls.append(json["model"])
        self.bodies.append(json)
        return self.by_model.get(json["model"], self.default)


def _provider(name, models, reasoning_body=None):
    return Provider(
        name=name, url=f"https://{name}.test/v1/chat/completions",
        api_key=f"{name}-key", models=tuple(models), reasoning_body=reasoning_body,
    )


class ChatProviderFallbackTest(unittest.TestCase):
    # Two providers so provider-level failover is actually exercised:
    # "alpha" holds two models, "beta" one.
    def setUp(self):
        self._saved_models = set(llm_shared._DEAD_MODELS)
        self._saved_providers = set(llm_shared._DEAD_PROVIDERS)
        llm_shared._DEAD_MODELS.clear()
        llm_shared._DEAD_PROVIDERS.clear()
        self.addCleanup(self._restore)

        p = mock.patch.object(llm_shared, "PROVIDERS", [
            _provider("alpha", ["a1", "a2"]),
            _provider("beta", ["b1"]),
        ])
        p.start()
        self.addCleanup(p.stop)

    def _restore(self):
        llm_shared._DEAD_MODELS.clear()
        llm_shared._DEAD_MODELS.update(self._saved_models)
        llm_shared._DEAD_PROVIDERS.clear()
        llm_shared._DEAD_PROVIDERS.update(self._saved_providers)

    def _session(self, by_model):
        session = FakeSession(by_model)
        p = mock.patch.object(llm_shared.requests, "Session", return_value=session)
        p.start()
        self.addCleanup(p.stop)
        return session

    def _chat(self):
        return llm_shared.chat([{"role": "user", "content": "x"}])

    # ── provider-level failures ──────────────────────────────────
    def test_credit_exhausted_abandons_the_whole_provider(self):
        # The exact 2026-08 outage: OpenRouter answering 402 for every
        # model. The first 402 already proves the ACCOUNT is out, so
        # alpha's second model must never be asked.
        session = self._session({
            "a1": FakeResponse(402),
            "a2": FakeResponse(200, "wrong-source"),
            "b1": FakeResponse(200, "answer"),
        })
        self.assertEqual(self._chat(), "answer")
        self.assertEqual(session.calls, ["a1", "b1"])
        self.assertIn("alpha", llm_shared._DEAD_PROVIDERS)

    def test_dead_provider_is_skipped_on_later_calls(self):
        session = self._session({
            "a1": FakeResponse(402),
            "b1": FakeResponse(200, "answer"),
        })
        self._chat()
        self._chat()
        # Second call goes straight to beta — nothing is spent on alpha.
        self.assertEqual(session.calls, ["a1", "b1", "b1"])

    def test_auth_rejection_is_also_provider_level(self):
        for status in (401, 403):
            with self.subTest(status=status):
                self._restore()
                llm_shared._DEAD_MODELS.clear()
                llm_shared._DEAD_PROVIDERS.clear()
                session = self._session({
                    "a1": FakeResponse(status),
                    "b1": FakeResponse(200, "answer"),
                })
                self.assertEqual(self._chat(), "answer")
                self.assertEqual(session.calls, ["a1", "b1"])

    # ── model-level failures ─────────────────────────────────────
    def test_permanent_model_error_keeps_the_provider_alive(self):
        # 404 is about the MODEL, not the account, so alpha's second
        # model must still be tried — the opposite of the 402 case.
        session = self._session({
            "a1": FakeResponse(404),
            "a2": FakeResponse(200, "answer"),
        })
        self.assertEqual(self._chat(), "answer")
        self.assertEqual(session.calls, ["a1", "a2"])
        self.assertIn(("alpha", "a1"), llm_shared._DEAD_MODELS)
        self.assertNotIn("alpha", llm_shared._DEAD_PROVIDERS)

    def test_dead_model_is_skipped_on_later_calls(self):
        session = self._session({
            "a1": FakeResponse(404),
            "a2": FakeResponse(200, "answer"),
        })
        self._chat()
        self._chat()
        self.assertEqual(session.calls, ["a1", "a2", "a2"])

    def test_retryable_status_is_never_remembered(self):
        # A 429 is temporary — remembering it would take a model out of
        # rotation for the whole process over a momentary rate limit.
        session = self._session({
            "a1": FakeResponse(429),
            "a2": FakeResponse(200, "answer"),
        })
        self._chat()
        self.assertEqual(llm_shared._DEAD_MODELS, set())
        self.assertEqual(llm_shared._DEAD_PROVIDERS, set())
        self.assertEqual(session.calls, ["a1", "a1", "a2"])  # retried once

    def test_null_content_is_treated_as_a_failure(self):
        # Observed live from minimaxai/minimax-m3: HTTP 200 with a null
        # content field. Returning it crashes the caller's .strip().
        # Retried once against the same model before moving on (a 2xx
        # with a useless body reads as a glitch, not as a permanent
        # fact about the model), then falls through.
        session = self._session({
            "a1": FakeResponse(200, None),
            "a2": FakeResponse(200, "answer"),
        })
        self.assertEqual(self._chat(), "answer")
        self.assertEqual(session.calls, ["a1", "a1", "a2"])
        # Nothing is remembered: unlike a 400/404 this is not a claim
        # that the model is unusable.
        self.assertEqual(llm_shared._DEAD_MODELS, set())

    # ── exhaustion ───────────────────────────────────────────────
    def test_llm_unavailable_only_after_every_provider_is_exhausted(self):
        session = self._session({
            "a1": FakeResponse(404), "a2": FakeResponse(404), "b1": FakeResponse(404),
        })
        with self.assertRaises(LLMUnavailable):
            self._chat()
        self.assertEqual(session.calls, ["a1", "a2", "b1"])

        # Everything is known-dead now, so the next call sends nothing.
        with self.assertRaises(LLMUnavailable):
            self._chat()
        self.assertEqual(len(session.calls), 3)

    def test_no_provider_configured_is_llm_unavailable(self):
        with mock.patch.object(llm_shared, "PROVIDERS", []):
            with self.assertRaises(LLMUnavailable):
                self._chat()

    def test_llm_unavailable_is_a_runtime_error(self):
        # Existing `except RuntimeError` call sites must keep working.
        self.assertTrue(issubclass(LLMUnavailable, RuntimeError))


class ReasoningBodyTest(unittest.TestCase):
    """The reasoning knob is spelled differently per provider, and
    sending the wrong one is not a subtle failure: OpenRouter's
    `reasoning` field is not understood by NVIDIA, and NVIDIA's Nemotron
    models prepend their thinking trace to `content` unless
    chat_template_kwargs.thinking is explicitly off — which makes every
    JSON response unparseable."""

    def test_openrouter_sends_its_reasoning_field(self):
        p = llm_shared._PROVIDER_CATALOG["openrouter"]
        self.assertEqual(p.body_for(True), {"reasoning": {"enabled": True}})
        self.assertEqual(p.body_for(False), {"reasoning": {"enabled": False}})

    def test_nvidia_always_disables_thinking(self):
        p = llm_shared._PROVIDER_CATALOG["nvidia"]
        for reasoning in (True, False):
            with self.subTest(reasoning=reasoning):
                self.assertEqual(
                    p.body_for(reasoning), {"chat_template_kwargs": {"thinking": False}}
                )
        self.assertNotIn("reasoning", p.body_for(True))

    def test_body_reaches_the_request(self):
        provider = _provider("openrouter-like", ["m1"],
                             reasoning_body=lambda r: {"reasoning": {"enabled": r}})
        session = FakeSession({"m1": FakeResponse(200, "answer")})
        with mock.patch.object(llm_shared, "PROVIDERS", [provider]), \
             mock.patch.object(llm_shared.requests, "Session", return_value=session):
            llm_shared.chat([{"role": "user", "content": "x"}], reasoning=False)
        self.assertEqual(session.bodies[0]["reasoning"], {"enabled": False})


class ProviderOrderTest(unittest.TestCase):
    def test_order_follows_the_env_var(self):
        env = {"LLM_PROVIDER_ORDER": "openrouter,nvidia",
               "OPENROUTER_API_KEY": "or-key", "NVIDIA_API_KEY": "nv-key"}
        with mock.patch.dict(llm_shared.os.environ, env, clear=False), \
             mock.patch.object(llm_shared, "_PROVIDER_CATALOG", {
                 "nvidia": _provider("nvidia", ["n1"]),
                 "openrouter": _provider("openrouter", ["o1"]),
             }):
            self.assertEqual([p.name for p in llm_shared._build_providers()],
                             ["openrouter", "nvidia"])

    def test_provider_without_a_key_is_dropped(self):
        with mock.patch.dict(llm_shared.os.environ,
                             {"LLM_PROVIDER_ORDER": "nvidia,openrouter"}, clear=False), \
             mock.patch.object(llm_shared, "_PROVIDER_CATALOG", {
                 "nvidia": Provider("nvidia", "u", None, ("n1",)),   # no key
                 "openrouter": _provider("openrouter", ["o1"]),
             }):
            self.assertEqual([p.name for p in llm_shared._build_providers()], ["openrouter"])

    def test_unknown_provider_name_is_ignored(self):
        with mock.patch.dict(llm_shared.os.environ,
                             {"LLM_PROVIDER_ORDER": "nope,openrouter"}, clear=False), \
             mock.patch.object(llm_shared, "_PROVIDER_CATALOG", {
                 "openrouter": _provider("openrouter", ["o1"]),
             }):
            self.assertEqual([p.name for p in llm_shared._build_providers()], ["openrouter"])

    def test_llm_configured_tracks_the_provider_list(self):
        with mock.patch.object(llm_shared, "PROVIDERS", [_provider("nvidia", ["n1"])]):
            self.assertTrue(llm_shared.llm_configured())
        with mock.patch.object(llm_shared, "PROVIDERS", []):
            self.assertFalse(llm_shared.llm_configured())


class SoftenKanjiTest(unittest.TestCase):
    def test_text_already_within_level_is_returned_unchanged(self):
        text = "本を読みます。"
        self.assertEqual(soften_kanji(text, "N5"), text)

    def test_out_of_level_kanji_becomes_kana(self):
        # 待/合 are outside N5's deck, so this whole dialogue line used
        # to be rejected — the reason N5 listening generation returned
        # "only found 0/7 valid listening-mcq items" every time.
        for text in ["待ち合わせは何時ですか。", "会議の準備をしてください。"]:
            with self.subTest(text=text):
                softened = soften_kanji(text, "N5")
                self.assertIsNotNone(softened)
                self.assertTrue(sentence_kanji_ok(softened, "N5"))

    def test_returns_none_when_the_analyzer_is_unavailable(self):
        # Callers must fall back to rejecting the item, exactly as
        # before — never to shipping half-softened text.
        with mock.patch.object(llm_shared, "tokenize", return_value=None):
            self.assertIsNone(soften_kanji("待ち合わせ", "N5"))

    def test_never_returns_text_that_still_fails_the_gate(self):
        result = soften_kanji("資料を印刷して配布する必要があります。", "N5")
        if result is not None:
            self.assertTrue(sentence_kanji_ok(result, "N5"))


class OffendingKanjiTest(unittest.TestCase):
    """What a rejection tells the model to fix. The allowed list is
    already in every prompt, so a retry that just repeats it carries no
    new information -- the characters it actually got wrong do."""

    def test_names_only_the_disallowed_characters(self):
        # 駅 and 見 are N5; 色 is not.
        self.assertEqual(offending_kanji("駅で色を見た", "N5"), "色")

    def test_empty_when_the_text_passes(self):
        self.assertEqual(offending_kanji("駅へ行く", "N5"), "")
        self.assertEqual(offending_kanji("ひらがなだけ", "N5"), "")

    def test_deduplicates_and_keeps_first_appearance_order(self):
        self.assertEqual(offending_kanji("教室で色、色、教室", "N5"), "教室色")

    def test_agrees_with_the_gate(self):
        for text in ("駅で色を見た", "駅へ行く", "資料を印刷する"):
            with self.subTest(text=text):
                self.assertEqual(bool(offending_kanji(text, "N5")),
                                 not sentence_kanji_ok(text, "N5"))


if __name__ == "__main__":
    unittest.main()
