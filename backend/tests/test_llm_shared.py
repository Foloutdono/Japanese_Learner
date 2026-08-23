# Covers the two failure-cost behaviours llm_shared.chat is responsible
# for, both live-diagnosed 2026-08 when one listening-exam click turned
# into hundreds of doomed OpenRouter requests:
#   - a model that fails PERMANENTLY is never asked again this process
#   - a failure no model can fix (auth, nothing reachable) surfaces as
#     LLMUnavailable so a caller's retry loop can decline to retry it
# plus soften_kanji, the salvage that replaced "reject the whole item"
# as the response to an out-of-level kanji in SPOKEN text.
import unittest
from unittest import mock

from study import llm_shared
from study.llm_shared import LLMUnavailable, sentence_kanji_ok, soften_kanji


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
    so a test can assert on how many requests were actually spent."""

    def __init__(self, by_model, default=None):
        self.by_model = by_model
        self.default = default or FakeResponse(500)
        self.calls = []

    def post(self, url, headers=None, json=None, timeout=None):
        model = json["model"]
        self.calls.append(model)
        return self.by_model.get(model, self.default)


class ChatDeadModelTest(unittest.TestCase):
    def setUp(self):
        # chat() reads these at call time, so patching is enough — but
        # _DEAD_MODELS is real module state that must not leak between
        # tests (or into the rest of the suite).
        self._saved_dead = set(llm_shared._DEAD_MODELS)
        llm_shared._DEAD_MODELS.clear()
        self.addCleanup(self._restore)

        p = mock.patch.object(llm_shared, "OPENROUTER_API_KEY", "test-key")
        p.start()
        self.addCleanup(p.stop)

        p = mock.patch.object(llm_shared, "MODELS", ["dead-model", "live-model"])
        p.start()
        self.addCleanup(p.stop)

    def _restore(self):
        llm_shared._DEAD_MODELS.clear()
        llm_shared._DEAD_MODELS.update(self._saved_dead)

    def _session(self, by_model):
        session = FakeSession(by_model)
        p = mock.patch.object(llm_shared.requests, "Session", return_value=session)
        p.start()
        self.addCleanup(p.stop)
        return session

    def test_permanent_failure_is_tried_once_then_never_again(self):
        # The real shape of the reported bug: OpenRouter answering 404
        # "This model is unavailable for free" for the configured
        # primary, on every single call.
        session = self._session({
            "dead-model": FakeResponse(404),
            "live-model": FakeResponse(200, "answer"),
        })

        self.assertEqual(llm_shared.chat([{"role": "user", "content": "x"}]), "answer")
        self.assertEqual(session.calls, ["dead-model", "live-model"])

        # Second call: the dead model is skipped outright.
        self.assertEqual(llm_shared.chat([{"role": "user", "content": "x"}]), "answer")
        self.assertEqual(session.calls, ["dead-model", "live-model", "live-model"])
        self.assertIn("dead-model", llm_shared._DEAD_MODELS)

    def test_retryable_status_does_not_kill_the_model(self):
        # A 429 is temporary — remembering it would take a model out of
        # rotation for the whole process over a momentary rate limit.
        session = self._session({
            "dead-model": FakeResponse(429),
            "live-model": FakeResponse(200, "answer"),
        })
        llm_shared.chat([{"role": "user", "content": "x"}])
        self.assertNotIn("dead-model", llm_shared._DEAD_MODELS)
        # 429 retries once against the same model before moving on.
        self.assertEqual(session.calls, ["dead-model", "dead-model", "live-model"])

    def test_auth_failure_aborts_immediately(self):
        session = self._session({
            "dead-model": FakeResponse(401),
            "live-model": FakeResponse(200, "answer"),
        })
        with self.assertRaises(LLMUnavailable):
            llm_shared.chat([{"role": "user", "content": "x"}])
        # Exactly one request: no model can fix an account-level
        # rejection, so walking the rest of the list is pure waste.
        self.assertEqual(session.calls, ["dead-model"])

    def test_all_models_dead_costs_no_request_at_all(self):
        session = self._session({
            "dead-model": FakeResponse(404),
            "live-model": FakeResponse(404),
        })
        with self.assertRaises(LLMUnavailable):
            llm_shared.chat([{"role": "user", "content": "x"}])
        self.assertEqual(session.calls, ["dead-model", "live-model"])

        with self.assertRaises(LLMUnavailable):
            llm_shared.chat([{"role": "user", "content": "x"}])
        self.assertEqual(len(session.calls), 2)  # unchanged — nothing was sent

    def test_missing_api_key_is_llm_unavailable(self):
        with mock.patch.object(llm_shared, "OPENROUTER_API_KEY", None):
            with self.assertRaises(LLMUnavailable):
                llm_shared.chat([{"role": "user", "content": "x"}])

    def test_llm_unavailable_is_a_runtime_error(self):
        # Existing `except RuntimeError` call sites must keep working.
        self.assertTrue(issubclass(LLMUnavailable, RuntimeError))


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


if __name__ == "__main__":
    unittest.main()
