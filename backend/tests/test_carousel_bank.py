"""The carousel bank's cut of a sentence into rows (plan 248,
scripts/carousel_bank.py): a word the page writes in kana is read as the
word it spells, a number, でも and an honorific prefix stay whole, and a
katakana word is romanised as it is written."""
import json
import pytest

from scripts import carousel_bank as cb


def rows(jp: str, level: str = "N5") -> list[dict]:
    return cb.rows_of(cb._analyze(jp, level)["tokens"])


def row(jp: str, t: str, level: str = "N5") -> dict:
    return next(r for r in rows(jp, level) if r["t"] == t)


def test_a_kana_word_is_read_as_the_word_it_spells():
    r = row("としょかんで本を読みました。", "としょかん")
    assert r["ro"] == "toshokan"
    assert r["en"] == ["library"]
    # Positions are the page's own: the line is rebuilt from its rows.
    analysis = cb._analyze("としょかんで本を読みました。", "N5")
    assert analysis["text"] == "としょかんで本を読みました。"
    assert "".join(t["surface"] for t in analysis["tokens"]) == analysis["text"]
    for tok in analysis["tokens"]:
        assert analysis["text"][tok["start"]:tok["end"]] == tok["surface"]


def test_a_verb_is_respelled_only_where_a_word_starts():
    assert row("はやくねます。", "ねます")["en"][0].startswith("to go to bed")
    # かねます is 兼ねる, never 寝る: no token starts at its ね.
    assert all("sleep" not in " ".join(r.get("en") or []) for r in rows("わかりかねます。"))


def test_a_number_demo_and_an_honorific_stay_whole():
    assert [r["t"] for r in rows("二十五歳です。")][0] == "二十五歳"
    assert row("七万円です。", "七万円")["ro"].startswith("nanaman")
    assert row("でも、行きます。", "でも")["ro"] == "demo"
    # でも after a word is で and も, each its own.
    assert [r["t"] for r in rows("駅でも待ちます。")][:3] == ["駅", "で", "も"]
    assert row("お茶をください。", "お茶")["ro"] == "ocha"
    assert row("ご家族はお元気ですか。", "ご家族", "N4")["ro"] == "gokazoku"


def test_a_katakana_word_is_romanised_as_written():
    assert row("コーヒーを飲みます。", "コーヒー")["ro"] == "koohii"


def test_a_row_that_ends_on_its_small_tsu_is_said_into_the_next():
    # にじゅっ + さい was "nijutsu" + "sai": the っ doubles what follows.
    assert [(r["t"], r.get("ro")) for r in rows("あには二十さいの大学生です。")][2:4] == [("二十", "nijus"), ("さい", "sai")]
    assert row("ねこが一ぴきいます。", "一")["ro"] == "ip"
    assert row("雨だった。", "だっ")["ro"] == "dat"
    assert row("まっちゃを飲みます。", "まっちゃ")["ro"] == "matcha"   # inside a row, as before
    # Before nothing, or a stop, the っ is not written, as the app has it.
    assert row("あっ、雨だ。", "あっ")["ro"] == "a"
    assert cb._row_romaji("いっ", "ちょう") == "it"
    assert cb._row_romaji("あっ") == "a"
    # A line read over its own kana (the conversations) is held the same.
    rows_ = cb._by_kana([["十", "w", "juu", [["十", "じゅう"]]], ["パーセント", "w", "paasento"]],
                        {"jp": "十パーセント", "kana": "じゅっパーセント"})
    assert rows_[0][2] == "jup"


# ── Read it's bonus and its own sentences (plan 254) ──────────────


def test_a_sentence_is_said_the_other_way_by_the_apps_own_reading():
    v = cb.version("頭が痛い。", "N5", rows("頭が痛い。"))
    assert v["to"] == "polite"
    assert "".join(r["t"] for r in v["rows"]) == "頭が痛いです。"
    # An adjective takes です and nothing else changes.
    assert v["from"] == ["", ""] and v["into"] == ["です", "です"]
    v = cb.version("水を飲む。", "N5", rows("水を飲む。"))
    assert (v["from"], v["into"]) == (["飲む", "のむ"], ["飲みます", "のみます"])
    v = cb.version("お金がない。", "N5", rows("お金がない。"))
    assert v["into"][0] == "ありません"
    # Polite to plain, the final よ kept out of what changed.
    v = cb.version("あの店は安いですよ。", "N5", rows("あの店は安いですよ。"))
    assert v["to"] == "plain" and v["from"][0] == "です" and v["into"] == ["", ""]
    # A question reads one way only: 行きますか is no 行くか.
    assert cb.version("明日、行きますか。", "N5", rows("明日、行きますか。")) is None


def test_a_card_says_the_sense_the_sentence_picked_from_the_decks_own():
    assert cb._card_gloss(["tall, high, expensive"], "high") == ["high", "tall"]
    assert cb._card_gloss(["spacious, wide"], None) == ["spacious", "wide"]
    # A bracket's commas are no gloss's end, and a bracket is left off the card.
    assert cb._card_gloss(["to play (have fun, not sports/instruments), to make a visit"], "have fun") == ["have fun", "to play"]
    assert cb._card_gloss(["to take a photo or record a film"], "to take a photo") == ["to take a photo", ""]


def test_every_short_sentence_is_a_noun_a_particle_and_a_word_said_politely():
    out = cb.shorts()["sentences"]
    assert len(out) >= 40
    for s in out:
        words = [r for r in s["rows"] if r["k"] != "punct"]
        assert [r["k"] for r in words] == ["word", "particle", "word"], s["id"]
        assert all(r["lv"] == "N5" for r in (words[0], words[2])), s["id"]
        assert all(r["gen"][0] and r["gfr"][0] for r in words), s["id"]
        assert s["v"]["to"] == "polite" and s["v"]["when"]["en"] and s["v"]["when"]["fr"], s["id"]


def test_a_picture_names_a_word_and_a_file_there(tmp_path, monkeypatch):
    """Plan 257: a picture on no word, or a word with no file, stops the build."""
    words = {"N5": {"words": [{"t": "店", "r": "みせ"}]}}
    themes = {"themes": {"food": {"words": [{"t": "りんご", "r": "りんご"}]}}}
    (tmp_path / "pictures").mkdir()
    (tmp_path / "pictures" / "mise.webp").write_bytes(b"x")
    monkeypatch.setattr(cb, "CONTENT", tmp_path)
    spec = tmp_path / "pictures" / "pictures.json"
    spec.write_text('{"店::みせ": "mise.webp"}', encoding="utf-8")
    assert cb.pictures(words, themes)["pictures"] == {"店::みせ": "content/pictures/mise.webp"}
    for bad in ('{"店::てん": "mise.webp"}', '{"りんご::りんご": "ringo.webp"}'):
        spec.write_text(bad, encoding="utf-8")
        with pytest.raises(SystemExit):
            cb.pictures(words, themes)


def test_a_scenes_pictures_name_its_turns_and_files_there(tmp_path, monkeypatch):
    """Plan 269: every turn of a pictured scene has its two pictures, asked
    and answered; a scene the bank lacks, a turn short or a file missing
    stops the build."""
    scenes = {"scenes": [{"id": "first-class", "turns": [{}, {}]}]}
    (tmp_path / "pictures" / "scenes").mkdir(parents=True)
    for name in ("a1.webp", "b1.webp", "a2.webp", "b2.webp"):
        (tmp_path / "pictures" / "scenes" / name).write_bytes(b"x")
    monkeypatch.setattr(cb, "CONTENT", tmp_path)
    spec = tmp_path / "pictures" / "scenes" / "scenes.json"
    good = [{"ask": "a1.webp", "answer": "b1.webp"}, {"ask": "a2.webp", "answer": "b2.webp"}]
    spec.write_text(json.dumps({"first-class": good}), encoding="utf-8")
    assert cb.scene_pictures(scenes)["first-class"][1] == {
        "ask": "content/pictures/scenes/a2.webp", "answer": "content/pictures/scenes/b2.webp"}
    for bad in ({"no-scene": good}, {"first-class": good[:1]}, {"first-class": [good[0], {"ask": "a2.webp"}]},
                {"first-class": [good[0], {"ask": "a2.webp", "answer": "c2.webp"}]}):
        spec.write_text(json.dumps(bad), encoding="utf-8")
        with pytest.raises(SystemExit):
            cb.scene_pictures(scenes)


def test_the_bank_pictures_its_scenes_whole():
    """Plan 269: the bank's pictured scenes are the 会話 bank's, every turn pictured."""
    bank = json.loads((cb.OUT / "pictures.json").read_text(encoding="utf-8"))
    turns = {sc["id"]: len(sc["turns"]) for sc in json.loads((cb.OUT / "conversation.json").read_text(encoding="utf-8"))["scenes"]}
    assert bank["scenes"], "no scene is pictured"
    for sid, rows in bank["scenes"].items():
        assert len(rows) == turns[sid], sid
        for row in rows:
            for src in row.values():
                assert (cb.CONTENT.parent / src).is_file(), src


def test_the_stations_scenes_join_the_carousels_conversations():
    # Plan 268: the 会話 station's scenes, the ones the reply videos ask,
    # are answered as carousels too, beside the carousel's own.
    own = {"rev": 3, "dialogues": [
        {"id": "pharmacy", "lv": "N4", "turns": ["a"]},
        {"id": "cafe", "lv": "N5", "turns": ["b"]},
    ]}
    scenes = {"rev": 3, "scenes": [
        {"id": "pharmacy", "lv": "N4", "turns": ["c", "d"]},
        {"id": "konbini", "lv": "N5", "turns": ["e"]},
    ]}
    out = cb.with_scenes(own, scenes)
    # Level by level, the carousel's own first; a scene's id the station's, clear of a hand-written one.
    assert [d["id"] for d in out["dialogues"]] == ["cafe", "kaiwa-konbini", "pharmacy", "kaiwa-pharmacy"]
    assert [d.get("kaiwa", False) for d in out["dialogues"]] == [False, True, False, True]
    assert out["dialogues"][3]["turns"] == ["c", "d"]
    assert out["rev"] == 3
    # The scenes as the reply videos read them are left as they were.
    assert scenes["scenes"][0]["id"] == "pharmacy"


def test_the_feature_videos_are_answered_as_the_backend_answers():
    """Plan 270: bank/promo.json is what promo() writes now (the app's own
    answers for the banks' own content), and each video's exercise ends as
    its script says: the slips marked, the right picks right."""
    built = json.loads(cb.dump(cb.promo()))
    assert json.loads((cb.OUT / "promo.json").read_text(encoding="utf-8")) == built, \
        "bank/promo.json is stale: run python -m scripts.carousel_bank --only promo.json"
    features = built["features"]
    assert set(features) == {"reading", "comprehension", "translation", "dictation", "composition", "exam", "conversation"}
    for name, langs in features.items():
        assert set(langs) == {"en", "fr"}, name
        for lang, f in langs.items():
            # The shell's boot first: a learner who boarded, on the free plan.
            assert f["mocks"]["GET /api/profile"]["onboardedAt"], (name, lang)
            assert f["mocks"]["GET /api/credits"]["pending"] == 0, (name, lang)
            if name == "reading":
                assert f["mocks"]["POST /api/reading/check"]["accuracy"] == 100
            if name == "dictation":
                assert 0 < f["mocks"]["POST /api/dictation/check"]["accuracy"] < 100
            if name in ("translation", "composition"):
                review = f["mocks"][f"POST /api/{name}/{'analyze' if name == 'translation' else 'review'}"]["review"]
                assert review["verdict"] == "partial" and review["fix"], (name, lang)
            if name == "comprehension":
                result = f["mocks"]["POST /api/reading/comprehension/result"]
                assert result["score"] == result["total"] - 1
                assert not result["results"][f["wrong"]]["is_correct"]
            if name == "exam":
                attempt = f["mocks"][f"POST /api/exams/{f['exam']}/attempts"]
                assert attempt["correct"] == attempt["total"] - len(f["wrong"])
                # The three questions the video shows are answered right.
                assert all(r["isCorrect"] for r in attempt["review"][:3])
            if name == "conversation":
                turns = f["mocks"][f"GET /api/conversation/scenario/{f['scenario']}"]["turns"]
                assert all(t["choices"][k]["right"] for t, k in zip(turns, f["picks"]))


def test_the_highlights_scenes_are_answered_as_the_backend_answers():
    """Plan 331: each scene a highlight films is answered by the routes'
    own functions, and what it shows holds together: a new card due its
    tour, a video's and a song's lines timed and translated one to one,
    the photo's lines what its OCR read, the transfer's counts the
    matcher's, and an export that is a file."""
    scenes = json.loads(cb.dump(cb.promo()))["scenes"]
    assert set(scenes) == {"kana", "tour", "video", "photo", "song", "transfer", "account"}
    for name, langs in scenes.items():
        assert set(langs) == {"en", "fr"}, name
        for lang, f in langs.items():
            at = (name, lang)
            assert f["mocks"]["GET /api/profile"]["onboardedAt"], at
            if name == "kana":
                card = f["mocks"]["GET /api/kana/cards"]["cards"][0]
                assert card["stage"] == "new" and card["tutorial"] and card["glyph_tour"]["strokes"] == f["strokes"], at
                assert f["clip"] == f"kana-{card['sound']}", at
            if name == "tour":
                card = f["mocks"]["GET /api/grammar/cards"]["cards"][0]
                tour = card["lesson"]["tour"]
                assert card["stage"] == "new" and card["tutorial"], at
                assert tour["guesses"][f["guess"]]["correct"], at
            if name in ("video", "song"):
                sid = cb.PROMO_VIDEO_SESSION if name == "video" else cb.PROMO_SONG_SESSION
                session = f["mocks"][f"GET /api/video/session/{sid}"]
                lines = session["sentences"]
                said = f["mocks"][f"POST /api/video/session/{sid}/translations"]["lines"]
                assert session["status"] == "ready" and len(said) == len(lines) and all(said), at
                assert all(a["cue_end"] <= b["cue_start"] for a, b in zip(lines, lines[1:])), at
                assert all(s["tokens"] for s in lines), at
                assert session["source"] == ("youtube" if name == "video" else "song"), at
            if name == "video":
                # A picture for every turn's two lines, each a file of the owner's.
                assert len(f["frames"]) == 2 * cb._promo_spec()["scenes"]["video"]["turns"], at
                for frame in f["frames"]:
                    assert (cb.CONTENT / "pictures" / frame["picture"]).exists(), (at, frame)
            if name == "song":
                assert lines[-1]["cue_end"] <= f["length"], at
            if name == "photo":
                read = f["mocks"]["POST /api/ocr"]["text"]
                assert read.split("\n") == f["lines"], at
                analysed = f["mocks"]["POST /api/phrase/analyze"]["sentences"]
                assert "".join(s["text"] for s in analysed) == read.replace("\n", ""), at
            if name == "transfer":
                preview = f["mocks"]["POST /api/transfer/preview"]
                assert preview["notes"] == len(f["anki"]["notes"]), at
                assert preview["cards"] + preview["unmatched"] == preview["notes"], at
                assert preview["bySource"]["kanji"] and preview["bySource"]["vocab"], at
                assert f["mocks"]["POST /api/transfer/import"]["written"] == preview["write"], at
            if name == "account":
                exported = f["mocks"]["GET /api/profile/export"]["$file"]
                assert exported["contentType"] == "text/csv", at
                assert exported["body"].split("\n")[0] == "card_id,mode,interval_days,next_review,total_reviews,correct_reviews", at
