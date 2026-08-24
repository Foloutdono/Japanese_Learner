# Plain pytest-style functions rather than unittest.TestCase (the style
# used elsewhere in this suite): TestClient fixtures are awkward to wire
# into unittest.TestCase.setUp, and pytest fixtures work fine with plain
# functions, so this one file deviates for that reason.


def test_root_responds_ok(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_exams_resolves_via_dev_user_id(client):
    response = client.get("/api/exams")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) > 0
    for entry in body:
        assert "id" in entry
        assert "kind" in entry
        assert "level" in entry
        assert "title" in entry
        assert "generated" in entry


def test_dictionary_search_returns_paginated_shape(client):
    response = client.get("/api/dictionary", params={"q": "水", "limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert "results" in body
    assert "total" in body
    assert "page" in body
    assert "limit" in body
    assert "has_more" in body


def test_unknown_exam_id_returns_404_with_detail(client):
    response = client.get("/api/exams/not-a-real-exam-id")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


def test_today_queue_responds_for_fresh_user(client):
    response = client.get("/api/today")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)
