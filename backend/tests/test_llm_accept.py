"""chat(accept=...) walks on from a reply the caller cannot use.

A reasoning model that spends its token cap thinking out loud in
`content` answers 200 with a monologue and no answer (2026-10-12: a
learner was shown "We need to produce JSON..." as their review). The
reply is paid for, so it is logged `ok=0`, and the next model is asked
instead of the same one again. A tagged reasoning trace never reaches a
caller at all.
"""
import unittest
from unittest import mock

from study import llm_shared
from study.llm_shared import LLMUnavailable, Provider, chat, strip_reasoning


def _provider(models):
    return Provider(name="p", url="https://p.test/v1/chat/completions", api_key="k", models=models)


class _Resp:
    status_code = 200
    ok = True
    text = ""

    def __init__(self, content):
        self._content = content

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


def _run(replies, **kw):
    """chat() over one provider whose models answer `replies` in order;
    returns (result or the LLMUnavailable, models asked)."""
    asked = []
    models = tuple(f"m{i}" for i in range(len(replies)))

    def post(url, **kwargs):
        asked.append(kwargs["json"]["model"])
        return _Resp(replies[len(asked) - 1])

    with mock.patch.object(llm_shared, "PROVIDERS", [_provider(models)]), \
         mock.patch.object(llm_shared, "_DEAD_MODELS", set()), \
         mock.patch.object(llm_shared, "_DEAD_PROVIDERS", set()), \
         mock.patch.object(llm_shared.requests.Session, "post", side_effect=post):
        try:
            out = chat([{"role": "user", "content": "x"}], **kw)
        except LLMUnavailable as e:
            out = e
    return out, asked


class AcceptTests(unittest.TestCase):
    def test_a_refused_reply_moves_on_to_the_next_model(self) -> None:
        out, asked = _run(["We need to produce JSON...", '{"ok": 1}'], accept=lambda c: c.startswith("{"))
        self.assertEqual(out, '{"ok": 1}')
        self.assertEqual(asked, ["m0", "m1"])  # not m0 twice

    def test_every_model_refused_is_unavailable_with_a_clear_reason(self) -> None:
        out, asked = _run(["thinking...", "still thinking..."], accept=lambda c: False)
        self.assertIsInstance(out, LLMUnavailable)
        self.assertIn("no model gave a usable reply", str(out))
        self.assertEqual(asked, ["m0", "m1"])

    def test_no_accept_changes_nothing(self) -> None:
        out, asked = _run(["anything"])
        self.assertEqual(out, "anything")
        self.assertEqual(asked, ["m0"])

    def test_an_accept_that_raises_refuses_the_reply(self) -> None:
        def boom(_content):
            raise ValueError("bad parser")
        out, asked = _run(["a", "b"], accept=boom)
        self.assertIsInstance(out, LLMUnavailable)
        self.assertEqual(asked, ["m0", "m1"])


class StripReasoningTests(unittest.TestCase):
    def test_a_tagged_trace_is_removed(self) -> None:
        self.assertEqual(strip_reasoning("<think>hmm {draft}</think>\n{\"a\": 1}"), '{"a": 1}')
        self.assertEqual(strip_reasoning("<THINKING>x</THINKING>ok"), "ok")

    def test_a_trace_cut_off_by_the_cap_leaves_nothing(self) -> None:
        self.assertEqual(strip_reasoning("<think>We need to produce JSON and then"), "")

    def test_chat_never_returns_a_tagged_trace(self) -> None:
        out, _ = _run(["<think>draft</think>réponse"])
        self.assertEqual(out, "réponse")

    def test_a_cut_off_trace_is_an_unusable_body_not_an_answer(self) -> None:
        out, _ = _run(["<think>We need to", "réponse"])
        self.assertEqual(out, "réponse")


if __name__ == "__main__":
    unittest.main()
