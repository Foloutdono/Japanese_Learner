"""A typed or photographed Passage read as a video's lines are (plan 235).

The analyser's Passage is held to the line width (routes/phrase.py's
passage_sentences, `lines`), each sentence translated a block at a time
and kept on its history row (/api/phrase/history/{id}/translations),
and explained where it stands (/api/phrase/history/{id}/sentence/{i}/
explain, passage_context). Nothing of it reaches the other callers of
/api/phrase/analyze, which take their sentences whole.
"""
import json
import re
import uuid

import pytest

import routes.phrase as phrase
from study import line_translate, morphology
from tests.conftest import acting_as

needs_tokenizer = pytest.mark.skipif(not morphology.MORPHOLOGY_AVAILABLE, reason="needs the tokenizer")

LONG = "私は毎朝早く起きて公園を散歩してから朝ご飯を食べて会社に行きます。"


def _analyze(client, text, **extra):
    response = client.post("/api/phrase/analyze", json={"phrase": text, "lang": "fr", **extra})
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def plenty(monkeypatch):
    monkeypatch.setattr(line_translate, "LINE_TRANSLATION_DAILY_LIMIT", 10 ** 6)


def _fake_translator(monkeypatch, calls):
    def chat(messages, **kwargs):
        calls.append(messages)
        numbered = re.findall(r"^(\d+)\. (.+)$", messages[1]["content"], flags=re.MULTILINE)
        return json.dumps({"lines": {n: f"<{text}>" for n, text in numbered}}, ensure_ascii=False)

    monkeypatch.setattr(line_translate, "chat", chat)


# ── The cut ──────────────────────────────────────────────────────
@needs_tokenizer
def test_the_analyser_s_passage_is_held_to_the_line_width(client):
    data = _analyze(client, LONG + "猫が好き。", lines=True, save=False)
    assert [s["text"] for s in data["sentences"]] == [
        "私は毎朝早く起きて公園を散歩してから", "朝ご飯を食べて会社に行きます。", "猫が好き。",
    ]


@needs_tokenizer
def test_every_other_caller_keeps_its_sentences_whole(client):
    assert [s["text"] for s in _analyze(client, LONG, save=False)["sentences"]] == [LONG]
    # A practice run's one exercise, and its top-level breakdown.
    whole = _analyze(client, LONG, whole=True, lines=True, save=False)
    assert [s["text"] for s in whole["sentences"]] == [LONG]
    assert whole["tokens"]


@needs_tokenizer
def test_a_reopened_passage_comes_back_in_its_lines_with_its_source(client):
    saved = _analyze(client, LONG, lines=True, source="image")
    entry = client.get(f"/api/phrase/history/{saved['id']}?lang=fr").json()
    assert [s["text"] for s in entry["sentences"]] == [s["text"] for s in saved["sentences"]]
    assert len(entry["sentences"]) == 2
    assert entry["source"] == "image"


# ── The translations ─────────────────────────────────────────────
@needs_tokenizer
def test_a_typed_passage_s_sentences_are_translated_once_and_kept(client, monkeypatch, plenty):
    saved = _analyze(client, LONG + "Hello there friend.", lines=True)
    calls: list = []
    _fake_translator(monkeypatch, calls)

    path = f"/api/phrase/history/{saved['id']}/translations"
    body = client.post(path, json={"lang": "fr", "index": 1}).json()
    assert body == {"start": 0, "lines": [
        "<私は毎朝早く起きて公園を散歩してから>", "<朝ご飯を食べて会社に行きます。>", None,
    ]}
    (messages,) = calls
    # Told it is a text, not a video's subtitles.
    assert "a Japanese text" in messages[0]["content"]
    assert "Hello there" not in messages[1]["content"]

    assert client.post(path, json={"lang": "fr", "index": 0}).json() == body
    assert len(calls) == 1, "a block the row holds is not asked again"


def test_another_learner_s_passage_is_not_found(client, other_user, plenty):
    saved = _analyze(client, "猫が好き。犬も好き。", lines=True)
    with acting_as(other_user):
        assert client.post(f"/api/phrase/history/{saved['id']}/translations",
                           json={"lang": "fr", "index": 0}).status_code == 404
        assert client.post(f"/api/phrase/history/{saved['id']}/sentence/0/explain",
                           json={"lang": "fr"}).status_code == 404


def test_the_ceiling_is_the_video_s_one(client, monkeypatch):
    saved = _analyze(client, "猫が好き。犬も好き。", lines=True)
    calls: list = []
    _fake_translator(monkeypatch, calls)
    monkeypatch.setattr(line_translate, "LINE_TRANSLATION_DAILY_LIMIT", 0)
    response = client.post(f"/api/phrase/history/{saved['id']}/translations", json={"lang": "fr", "index": 0})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "translation_limit"
    assert calls == []


# ── Explain, where the sentence stands ───────────────────────────
def _fake_explainer(monkeypatch, seen, explanation="Une raison."):
    def chat(messages, **kwargs):
        seen.append(messages[1]["content"])
        return json.dumps({"words": [], "translation": "T", "explanation": explanation})

    monkeypatch.setattr("routes.phrase.chat", chat)


def test_a_sentence_is_explained_with_its_neighbours_and_found_again_on_reopening(client, monkeypatch):
    tag = uuid.uuid4().hex[:6]  # a context of its own on every run
    text = f"雨が降りました。だから家にいました。{tag}は楽しかったです。"
    saved = _analyze(client, text, lines=True)
    seen: list = []
    _fake_explainer(monkeypatch, seen)

    body = client.post(f"/api/phrase/history/{saved['id']}/sentence/1/explain", json={"lang": "fr"}).json()
    assert body["text"] == "だから家にいました。"
    assert body["explanation"] == "Une raison."
    (message,) = seen
    assert message.startswith("だから家にいました。")
    assert "From a Japanese text the learner is reading." in message
    assert "Sentence 2 of 3." in message
    assert "Before it: 雨が降りました。" in message
    assert f"After it: {tag}は楽しかったです。" in message

    reopened = client.get(f"/api/phrase/history/{saved['id']}?lang=fr").json()
    assert reopened["sentences"][1]["explanation"] == "Une raison."
    assert len(seen) == 1, "reopening never calls the model"


def test_a_passage_of_one_sentence_is_explained_as_the_sentence_alone(client, monkeypatch):
    text = f"今日は{uuid.uuid4().hex[:6]}を読みました。"
    saved = _analyze(client, text, lines=True)
    seen: list = []
    _fake_explainer(monkeypatch, seen)
    client.post(f"/api/phrase/history/{saved['id']}/sentence/0/explain", json={"lang": "fr"})
    (message,) = seen
    assert phrase.CONTEXT_INSTRUCTION not in message
    # ...under the key every other caller shares.
    assert phrase._cached_analysis(text, "fr") is not None


def test_an_explanation_bought_before_the_context_is_still_found_on_reopening(client):
    tag = uuid.uuid4().hex[:6]
    first, second = f"{tag}は猫です。", f"{tag}はとても可愛いです。"
    phrase._store_analysis(second, "fr", {"words": [], "explanation": "Bought before."})
    saved = _analyze(client, first + second, lines=True)
    reopened = client.get(f"/api/phrase/history/{saved['id']}?lang=fr").json()
    assert reopened["sentences"][1]["explanation"] == "Bought before."


def test_explain_s_index_is_the_reopened_passage_s(client):
    saved = _analyze(client, "猫が好き。犬も好き。", lines=True)
    assert client.post(f"/api/phrase/history/{saved['id']}/sentence/2/explain",
                       json={"lang": "fr"}).status_code == 404
