from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_home_contains_fate_loop():
    response = client.get("/v1/home/u_1001")

    assert response.status_code == 200
    body = response.json()
    assert body["fate_chart"]["pattern"] == "木火通明"
    assert [stage["name"] for stage in body["loop"]] == [
        "Bazi classification",
        "Smart recommendation",
        "Chat feedback",
        "Data iteration",
    ]


def test_square_returns_trends_and_posts():
    response = client.get("/v1/square")

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "分析广场"
    assert len(body["trends"]) >= 3
    assert len(body["posts"]) >= 3


def test_feedback_updates_recommendation_score():
    before = client.get("/v1/coordinates/u_1001").json()
    before_score = before["places"][0]["match_score"]

    response = client.post(
        "/v1/feedback",
        json={
            "user_id": "u_1001",
            "target_id": "place_moonwood",
            "signal": "meet",
            "context": "location",
            "weight": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["updated_score"] > before_score
