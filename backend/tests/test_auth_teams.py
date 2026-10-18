from app.models import User

def register_user(
    client,
    name="Test User",
    email="testuser@example.com",
    password="TestPassword123",
):
    return client.post(
        "/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
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

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

def create_team(client, token, name="Engineering"):
    response = client.post(
        "/teams/",
        json={"name": name},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return response.json()

def make_account_admin(client, email="testuser@example.com"):
    """Promote a user in the isolated test database."""
    from app.database import get_db
    from backend.app.main import app

    override_get_db = app.dependency_overrides.get(get_db)
    if override_get_db is None:
        raise RuntimeError("Test database override is not configured.")

    db_generator = override_get_db()
    db = next(db_generator)

    try:
        user = db.query(User).filter(User.email == email).one()
        user.account_role = "admin"
        db.commit()
    finally:
        try:
            next(db_generator)
        except StopIteration:
            pass

def test_register_login_and_profile(client):
    response = register_user(client)
    assert response.status_code == 201
    assert response.json()["email"] == "testuser@example.com"
    assert response.json()["account_role"] == "member"

    token = login_user(client)
    profile = client.get("/auth/me", headers=auth_headers(token))

    assert profile.status_code == 200
    assert profile.json()["name"] == "Test User"
    assert profile.json()["account_role"] == "member"

def test_duplicate_registration_is_rejected(client):
    assert register_user(client).status_code == 201
    assert register_user(client).status_code == 409

def test_invalid_login_is_rejected(client):
    register_user(client)

    response = client.post(
        "/auth/login",
        data={
            "username": "testuser@example.com",
            "password": "WrongPassword123",
        },
    )
    assert response.status_code == 401

def test_protected_endpoints_require_authentication(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/teams/").status_code == 401

    response = client.post(
        "/teams/",
        json={"name": "Unauthorized Team"},
    )
    assert response.status_code == 401

def test_team_creation_and_membership_listing(client):
    register_user(client)
    token = login_user(client)
    team = create_team(client, token)

    assert team["name"] == "Engineering"
    assert team["role"] == "owner"

    response = client.get("/teams/", headers=auth_headers(token))
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == team["id"]

def test_account_admin_can_add_member_and_duplicate_is_rejected(client):
    register_user(client)
    login_user(client)

    make_account_admin(client)
    admin_token = login_user(client)

    team = create_team(client, admin_token)

    second = register_user(
        client,
        name="Second User",
        email="seconduser@example.com",
    )
    assert second.status_code == 201

    payload = {
        "email": "seconduser@example.com",
        "role": "member",
    }
    url = f"/teams/{team['id']}/members"

    response = client.post(
        url, json=payload, headers=auth_headers(admin_token)
    )
    assert response.status_code == 201
    assert response.json()["role"] == "member"

    duplicate = client.post(
        url, json=payload, headers=auth_headers(admin_token)
    )
    assert duplicate.status_code == 409

def test_users_only_see_teams_they_belong_to(client):
    register_user(client)
    owner_token = login_user(client)
    create_team(client, owner_token, "Private Team")

    register_user(
        client,
        name="Outside User",
        email="outside@example.com",
    )
    outside_token = login_user(
        client, email="outside@example.com"
    )

    response = client.get(
        "/teams/", headers=auth_headers(outside_token)
    )
    assert response.status_code == 200
    assert response.json() == []

def test_regular_account_member_cannot_add_other_members(client):
    register_user(client)
    owner_token = login_user(client)
    team = create_team(client, owner_token)

    register_user(
        client, name="Member One", email="member1@example.com"
    )
    member_token = login_user(client, email="member1@example.com")

    register_user(
        client, name="Member Two", email="member2@example.com"
    )
    response = client.post(
        f"/teams/{team['id']}/members",
        json={"email": "member2@example.com", "role": "member"},
        headers=auth_headers(member_token),
    )
    assert response.status_code == 403

def test_only_team_owner_can_assign_team_admin_role(client):
    register_user(
        client,
        name="Team Owner",
        email="owner@example.com",
    )
    owner_token = login_user(client, email="owner@example.com")
    team = create_team(client, owner_token, "Owner Team")

    register_user(
        client,
        name="Account Admin",
        email="testuser@example.com",
    )
    make_account_admin(client)
    admin_token = login_user(client)

    register_user(
        client,
        name="Target User",
        email="target@example.com",
    )

    member_response = client.post(
        f"/teams/{team['id']}/members",
        json={"email": "target@example.com", "role": "member"},
        headers=auth_headers(admin_token),
    )
    assert member_response.status_code == 201

    admin_response = client.post(
        f"/teams/{team['id']}/members",
        json={"email": "target@example.com", "role": "admin"},
        headers=auth_headers(admin_token),
    )
    assert admin_response.status_code in (403, 404)

def test_invalid_team_role_is_rejected(client):
    register_user(client)
    owner_token = login_user(client)
    team = create_team(client, owner_token)

    register_user(
        client, name="Second User", email="seconduser@example.com"
    )
    response = client.post(
        f"/teams/{team['id']}/members",
        json={"email": "seconduser@example.com", "role": "owner"},
        headers=auth_headers(owner_token),
    )
    assert response.status_code == 422
