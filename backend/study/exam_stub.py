# ── Stub paper ────────────────────────────────────────────────
# One hand-written, entirely original mondai — three ordinary N5-level
# sentences using common vocabulary, none of them copied from or
# matching any real exam. This exists to prove the generation pipe
# (routes/exams.py materialization, exam_scoring.py, the four exam
# screens) end to end before the real generator
# (backend/study/exam_kanji_gen.py and friends) exists. Once the real
# generator lands, this stops being registered in routes/exams.py's
# EXAM_SOURCES and can be deleted or kept only for local dev/testing.
STUB_EXAM_ID = "n5-stub-01"

STUB_PAPER = {
    "id": STUB_EXAM_ID,
    "level": "N5",
    "title": "N5 Practice Exam (preview)",
    "titleJp": "N5模擬試験（プレビュー）",
    "sections": [
        {
            "id": "vocabulary",
            "label": "Vocabulary",
            "labelJp": "言語知識（文字・語彙）",
            "timeLimitMin": 20,
            "mondai": [
                {
                    "id": "moji_1",
                    "number": 1,
                    "type": "mcq-text",
                    "instructionsJp": "＿＿＿＿の　ことばは　ひらがなで　どう　かきますか。1・2・3・4から　いちばん　いい　ものを　ひとつ　えらんで　ください。",
                    "instructions": "How do you write the underlined word in hiragana? Choose the best answer from 1-4.",
                    "questions": [
                        {
                            "id": "v1",
                            "number": 1,
                            "promptJp": "今日は　山に　のぼります。",
                            "underlineJp": "山",
                            "choices": [
                                {"id": "c1", "textJp": "かわ"},
                                {"id": "c2", "textJp": "やま"},
                                {"id": "c3", "textJp": "うみ"},
                                {"id": "c4", "textJp": "そら"},
                            ],
                            "answer": "c2",
                        },
                        {
                            "id": "v2",
                            "number": 2,
                            "promptJp": "毎朝　水を　のみます。",
                            "underlineJp": "水",
                            "choices": [
                                {"id": "c1", "textJp": "みず"},
                                {"id": "c2", "textJp": "ゆ"},
                                {"id": "c3", "textJp": "ちゃ"},
                                {"id": "c4", "textJp": "さけ"},
                            ],
                            "answer": "c1",
                        },
                        {
                            "id": "v3",
                            "number": 3,
                            "promptJp": "友達に　手紙を　書きました。",
                            "underlineJp": "友達",
                            "choices": [
                                {"id": "c1", "textJp": "かぞく"},
                                {"id": "c2", "textJp": "せんせい"},
                                {"id": "c3", "textJp": "ともだち"},
                                {"id": "c4", "textJp": "きょうだい"},
                            ],
                            "answer": "c3",
                        },
                    ],
                },
            ],
        },
    ],
}
