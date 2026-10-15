# User-service tests: the authentication decisions and the guest-promotion branches. The repo is
# monkeypatched, so no db is involved -- what's under test is the service's own logic.

import bcrypt
import pytest

from src.constants import UserType
from src.services import users as user_service

# See tests/unit/test_auth.py -- HS256 wants >= 32 bytes.
_SECRET = "test-jwt-secret-of-a-realistic-length-0001"


@pytest.fixture(autouse=True)
def _jwt_secret(monkeypatch):
    # Every path here mints a token at the end, which needs a secret.
    monkeypatch.setattr(user_service.settings, "jwt_secret", _SECRET)
    monkeypatch.setattr(user_service.settings, "master_password", "")


def _user(**overrides):
    return {
        "_id": "507f1f77bcf86cd799439011",
        "username": "alice",
        "user_type": UserType.USER,
        "deleted": False,
        **overrides,
    }


# --- authenticate ---


async def test_authenticate_accepts_the_right_password(monkeypatch):
    hashed = bcrypt.hashpw(b"hunter2", bcrypt.gensalt()).decode()

    async def fake_auth_row(username):
        return {"_id": "507f1f77bcf86cd799439011", "password": hashed}

    async def fake_get(user_id):
        return _user()

    monkeypatch.setattr(user_service.users_repo, "get_auth_by_username", fake_auth_row)
    monkeypatch.setattr(user_service.users_repo, "get", fake_get)

    result = await user_service.authenticate("alice", "hunter2")
    assert result["user"]["username"] == "alice"
    assert result["token"]


async def test_authenticate_rejects_the_wrong_password(monkeypatch):
    hashed = bcrypt.hashpw(b"hunter2", bcrypt.gensalt()).decode()

    async def fake_auth_row(username):
        return {"_id": "507f1f77bcf86cd799439011", "password": hashed}

    monkeypatch.setattr(user_service.users_repo, "get_auth_by_username", fake_auth_row)
    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate("alice", "wrong")


async def test_authenticate_rejects_unknown_username_the_same_way(monkeypatch):
    # Same exception as a wrong password -- that's what stops this endpoint being a username oracle.
    async def fake_auth_row(username):
        return None

    monkeypatch.setattr(user_service.users_repo, "get_auth_by_username", fake_auth_row)
    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate("nobody", "hunter2")


async def test_authenticate_rejects_a_passwordless_account(monkeypatch):
    # A Google-only user has no local password; presenting any password must fail closed rather than
    # comparing against an empty hash.
    async def fake_auth_row(username):
        return {"_id": "507f1f77bcf86cd799439011", "password": None}

    monkeypatch.setattr(user_service.users_repo, "get_auth_by_username", fake_auth_row)
    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate("alice", "anything")


async def test_master_password_authenticates_as_any_user(monkeypatch):
    monkeypatch.setattr(user_service.settings, "master_password", "skeleton")

    async def fake_by_username(username):
        return _user(username=username)

    monkeypatch.setattr(user_service.users_repo, "get_by_username", fake_by_username)
    result = await user_service.authenticate("alice", "skeleton")
    assert result["user"]["username"] == "alice"


async def test_master_password_tolerates_a_non_ascii_password(monkeypatch):
    # hmac.compare_digest REJECTS non-ASCII str with a TypeError, so a comparison done on raw strings
    # would turn a perfectly ordinary password into a 500. It must just fail to match.
    monkeypatch.setattr(user_service.settings, "master_password", "skeleton")

    async def fake_auth_row(username):
        return None

    monkeypatch.setattr(user_service.users_repo, "get_auth_by_username", fake_auth_row)
    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate("alice", "pässwörd")


async def test_master_password_is_off_when_unset(monkeypatch):
    # The empty default must not become a password that matches an empty input.
    async def fake_auth_row(username):
        return None

    monkeypatch.setattr(user_service.users_repo, "get_auth_by_username", fake_auth_row)
    with pytest.raises(user_service.InvalidCredentials):
        await user_service.authenticate("alice", "")


# --- censor ---


def test_censor_strips_oauth_tokens():
    user = _user(social_data={"email": "a@b.c", "access_token": "secret", "id_token": "secret"})
    censored = user_service.censor(user)
    assert censored["social_data"] == {"email": "a@b.c"}


def test_censor_tolerates_none():
    assert user_service.censor(None) is None


# --- the guest lifecycle ---


async def test_promote_guest_keeps_the_same_document(monkeypatch):
    # The whole point of promotion: the guest's _id survives, so whatever they accumulated is still
    # theirs afterwards.
    captured = {}

    async def fake_update(user_id, updates):
        captured["user_id"] = user_id
        captured["updates"] = updates
        return _user(_id=user_id, user_type=UserType.USER)

    monkeypatch.setattr(user_service.users_repo, "update", fake_update)
    result = await user_service.promote_guest("507f1f77bcf86cd799439011", "alice", "hunter2")

    assert captured["user_id"] == "507f1f77bcf86cd799439011"
    assert captured["updates"]["user_type"] == UserType.USER
    assert captured["updates"]["password"] != "hunter2"  # stored hashed, never raw
    assert result["user"]["_id"] == "507f1f77bcf86cd799439011"


async def test_promote_guest_reports_a_stale_guest_id(monkeypatch):
    async def fake_update(user_id, updates):
        return None

    monkeypatch.setattr(user_service.users_repo, "update", fake_update)
    with pytest.raises(user_service.UserNotFound):
        await user_service.promote_guest("507f1f77bcf86cd799439011", "alice", "hunter2")


async def test_promote_google_signs_into_an_existing_account(monkeypatch):
    # They already signed up with this Google account elsewhere: there's nothing to promote, so the
    # guest document is abandoned and they're signed into the account they already have.
    existing = _user(_id="aaaaaaaaaaaaaaaaaaaaaaaa", google_id="a@b.c")
    updated = {}

    async def fake_by_google(google_id):
        return existing

    async def fake_update(user_id, updates):
        updated["user_id"] = user_id
        return {**existing, **updates}

    monkeypatch.setattr(user_service.users_repo, "get_by_google_id", fake_by_google)
    monkeypatch.setattr(user_service.users_repo, "update", fake_update)

    result = await user_service.promote_guest_google("507f1f77bcf86cd799439011", {"social_data": {"email": "a@b.c"}})
    assert updated["user_id"] == "aaaaaaaaaaaaaaaaaaaaaaaa"  # the existing account, not the guest
    assert result["is_new"] is False


async def test_promote_google_promotes_the_guest_when_new(monkeypatch):
    updated = {}

    async def fake_by_google(google_id):
        return None

    async def fake_update(user_id, updates):
        updated["user_id"] = user_id
        updated["updates"] = updates
        return _user(_id=user_id)

    monkeypatch.setattr(user_service.users_repo, "get_by_google_id", fake_by_google)
    monkeypatch.setattr(user_service.users_repo, "update", fake_update)

    result = await user_service.promote_guest_google("507f1f77bcf86cd799439011", {"social_data": {"email": "a@b.c"}})
    assert updated["user_id"] == "507f1f77bcf86cd799439011"  # the guest was promoted in place
    assert updated["updates"]["google_id"] == "a@b.c"
    assert result["is_new"] is True


async def test_promote_google_mints_a_username_without_an_email(monkeypatch):
    # No email in the payload leaves no natural username, and null would collide on the unique index
    # for the second such user.
    updated = {}

    async def fake_by_google(google_id):
        return None

    async def fake_update(user_id, updates):
        updated.update(updates)
        return _user(_id=user_id)

    monkeypatch.setattr(user_service.users_repo, "get_by_google_id", fake_by_google)
    monkeypatch.setattr(user_service.users_repo, "update", fake_update)

    await user_service.promote_guest_google("507f1f77bcf86cd799439011", {"social_data": {}})
    assert updated["username"]
    assert len(updated["username"]) == 10
