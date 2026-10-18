def register_user(
    client,
    name="Test User",
    email="testuser@example.com",
    password="TestPassword123",
):
    return client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": password},
    )

def login_user(
    client,
    email="testuser@example.com",
    password="TestPassword123",
):
    response = client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]

def headers(token):
    return {"Authorization": f"Bearer {token}"}

def setup_team(client):
    register = register_user(client)
    assert register.status_code == 201

    token = login_user(client)
    response = client.post(
        "/teams/",
        json={"name": "Engineering"},
        headers=headers(token),
    )
    assert response.status_code == 201

    return token, response.json()["id"]

def create_item(client, token, team_id, **overrides):
    payload = {
        "title": "Investigate API failure",
        "description": "Investigate intermittent server errors",
        "team_id": team_id,
        "status": "open",
        "priority": "high",
    }
    payload.update(overrides)

    return client.post(
        "/work-items/",
        json=payload,
        headers=headers(token),
    )

def test_create_work_item_and_record_activity(client):
    token, team_id = setup_team(client)

    response = create_item(client, token, team_id)

    assert response.status_code == 201
    item = response.json()
    assert item["title"] == "Investigate API failure"
    assert item["team_id"] == team_id
    assert item["created_by_id"] == 1
    assert item["status"] == "open"
    assert item["priority"] == "high"
    assert item["version"] == 1

    activity = client.get(
        f"/work-items/{item['id']}/activity",
        headers=headers(token),
    )
    assert activity.status_code == 200
    assert len(activity.json()) == 1
    assert activity.json()[0]["action"] == "created"

def test_list_search_filter_and_pagination(client):
    token, team_id = setup_team(client)

    first = create_item(
        client, token, team_id,
        title="Investigate payment failure",
        priority="high",
    )
    second = create_item(
        client, token, team_id,
        title="Update documentation",
        priority="low",
    )
    third = create_item(
        client, token, team_id,
        title="Resolve API timeout",
        status="in_progress",
        priority="high",
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert third.status_code == 201

    base_url = f"/work-items/?team_id={team_id}"

    response = client.get(base_url, headers=headers(token))
    assert response.status_code == 200
    assert response.json()["total"] == 3
    assert len(response.json()["items"]) == 3

    response = client.get(
        base_url + "&search=payment",
        headers=headers(token),
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["title"] == (
        "Investigate payment failure"
    )

    response = client.get(
        base_url + "&status=in_progress",
        headers=headers(token),
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["title"] == (
        "Resolve API timeout"
    )

    response = client.get(
        base_url + "&priority=high&page=1&page_size=1",
        headers=headers(token),
    )
    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert len(response.json()["items"]) == 1
    assert response.json()["page"] == 1
    assert response.json()["page_size"] == 1

def test_get_single_work_item(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item_id = created.json()["id"]

    response = client.get(
        f"/work-items/{item_id}",
        headers=headers(token),
    )

    assert response.status_code == 200
    assert response.json()["id"] == item_id

def test_update_increments_version_and_records_activity(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item = created.json()

    response = client.patch(
        f"/work-items/{item['id']}",
        json={
            "version": 1,
            "status": "in_progress",
            "priority": "urgent",
        },
        headers=headers(token),
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["status"] == "in_progress"
    assert updated["priority"] == "urgent"
    assert updated["version"] == 2

    activity = client.get(
        f"/work-items/{item['id']}/activity",
        headers=headers(token),
    )
    assert activity.status_code == 200
    assert len(activity.json()) == 2
    assert activity.json()[0]["action"] == "updated"


def test_stale_update_is_rejected(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item_id = created.json()["id"]

    first_update = client.patch(
        f"/work-items/{item_id}",
        json={"version": 1, "title": "First update"},
        headers=headers(token),
    )
    assert first_update.status_code == 200
    assert first_update.json()["version"] == 2

    stale_update = client.patch(
        f"/work-items/{item_id}",
        json={"version": 1, "title": "Stale update"},
        headers=headers(token),
    )

    assert stale_update.status_code == 409
    assert stale_update.json()["detail"]["current_version"] == 2

def test_non_member_cannot_access_team_work_items(client):
    owner_token, team_id = setup_team(client)
    created = create_item(client, owner_token, team_id)
    item_id = created.json()["id"]

    registration = register_user(
        client,
        name="Outside User",
        email="outside@example.com",
    )
    assert registration.status_code == 201

    outside_token = login_user(
        client,
        email="outside@example.com",
    )

    response = client.get(
        f"/work-items/{item_id}",
        headers=headers(outside_token),
    )
    assert response.status_code == 404

    response = client.get(
        f"/work-items/?team_id={team_id}",
        headers=headers(outside_token),
    )
    assert response.status_code == 404

    response = create_item(
        client,
        outside_token,
        team_id,
        title="Unauthorized item",
    )
    assert response.status_code == 404

def test_assignee_must_belong_to_team(client):
    token, team_id = setup_team(client)

    registration = register_user(
        client,
        name="Outside User",
        email="outside@example.com",
    )
    assert registration.status_code == 201

    response = create_item(
        client,
        token,
        team_id,
        assignee_id=2,
    )
    assert response.status_code == 422
    assert "team" in response.json()["detail"].lower()

def test_work_item_endpoints_require_authentication(client):
    response = client.get("/work-items/?team_id=1")
    assert response.status_code == 401

    response = client.post(
        "/work-items/",
        json={
            "title": "Unauthenticated item",
            "team_id": 1,
        },
    )
    assert response.status_code == 401

def test_missing_work_item_returns_404(client):
    token, _ = setup_team(client)

    response = client.get(
        "/work-items/9999",
        headers=headers(token),
    )
    assert response.status_code == 404

def test_create_comment_and_record_activity(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item_id = created.json()["id"]

    response = client.post(
        f"/work-items/{item_id}/comments",
        json={"body": "Investigating this issue"},
        headers=headers(token),
    )

    assert response.status_code == 201
    assert response.json()["body"] == "Investigating this issue"
    assert response.json()["work_item_id"] == item_id

    comments = client.get(
        f"/work-items/{item_id}/comments",
        headers=headers(token),
    )
    assert comments.status_code == 200
    assert len(comments.json()) == 1

    activity = client.get(
        f"/work-items/{item_id}/activity",
        headers=headers(token),
    )
    assert activity.status_code == 200
    assert any(
        entry["action"] == "comment_added"
        for entry in activity.json()
    )

def test_list_comments_in_creation_order(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item_id = created.json()["id"]

    for body in ["First comment", "Second comment"]:
        response = client.post(
            f"/work-items/{item_id}/comments",
            json={"body": body},
            headers=headers(token),
        )
        assert response.status_code == 201

    response = client.get(
        f"/work-items/{item_id}/comments",
        headers=headers(token),
    )

    assert response.status_code == 200
    assert [comment["body"] for comment in response.json()] == [
        "First comment",
        "Second comment",
    ]

def test_empty_comment_is_rejected(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item_id = created.json()["id"]

    response = client.post(
        f"/work-items/{item_id}/comments",
        json={"body": "   "},
        headers=headers(token),
    )

    assert response.status_code == 422

def test_non_member_cannot_access_comments(client):
    token, team_id = setup_team(client)
    created = create_item(client, token, team_id)
    item_id = created.json()["id"]

    outsider_email = "outsider@example.com"

    registration = register_user(
        client,
        name="Outsider",
        email=outsider_email,
        password="OutsiderPassword123",
    )
    assert registration.status_code == 201

    outsider_token = login_user(
        client,
        email=outsider_email,
        password="OutsiderPassword123",
    )

    response = client.get(
        f"/work-items/{item_id}/comments",
        headers=headers(outsider_token),
    )
    assert response.status_code == 403

    response = client.post(
        f"/work-items/{item_id}/comments",
        json={"body": "Unauthorized comment"},
        headers=headers(outsider_token),
    )
    assert response.status_code == 403
