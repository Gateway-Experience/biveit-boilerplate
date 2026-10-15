# Intentions: user-facing business logic -- registration, authentication, and the guest lifecycle.
# Protocol-agnostic: every failure is a domain exception the controller maps to HTTP.
#
# THE GUEST LIFECYCLE is the thing worth understanding here. A visitor gets a GUEST account on first
# visit (register_guest) with no username and no password, so whatever they do is already attached to
# a real document. When they sign up, we PROMOTE that same document in place -- same _id, credentials
# filled in, user_type flipped to USER -- rather than creating a new user and migrating. That's what
# keeps their accumulated data theirs. promote_guest (password) and promote_guest_google (OAuth) are
# the two ways in.
#
# The Google paths carry a wrinkle: the person may ALREADY have a Google-linked account from another
# device. Then there's nothing to promote -- we sign them into the existing account and the guest
# document is simply abandoned. `is_new` in the response tells the FE which happened.
#
# PASSWORD HASHING goes through asyncio.to_thread: bcrypt is deliberately slow and CPU-bound, so a
# direct call would block the event loop -- every other in-flight request stalls for the duration of
# one login. Don't remove the thread hop.

import asyncio
import hmac
from typing import Any

import bcrypt
import pydash

from src.config import settings
from src.constants import Charset, UserType
from src.dto.users import User
from src.repositories import users as users_repo
from src.repositories.users import DuplicateUser
from src.utils.auth import mint_access_token
from src.utils.common import generate_code

# Social payload fields that must never reach the browser -- they're the caller's live Google
# credentials, not profile data. Stripped on the way out of every response.
_SOCIAL_SECRET_FIELDS = ["social_data.access_token", "social_data.id_token"]


class InvalidCredentials(Exception):
    """Login failed -- unknown username, or wrong password. Deliberately undifferentiated (no user
    enumeration); maps to 401 at the controller."""


class UserNotFound(Exception):
    """A user the caller named doesn't exist -- a stale guest_id, or a master-password lookup that
    matched nothing. Maps to 404."""


def _hash_password(password: str) -> str:
    """[Pure-ish] bcrypt the password. Blocking and CPU-bound -- always call via asyncio.to_thread."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    """[Pure] Constant-time compare against a stored hash. Blocking -- call via asyncio.to_thread."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def censor(user: User | None) -> User | None:
    """[Pure] Strip the fields no client may see. The password never gets this far (the repo projects
    it out), so what's left is the OAuth tokens buried in social_data. Returns a copy."""
    return pydash.omit(user, *_SOCIAL_SECRET_FIELDS) if user else user


def _issue(user: User) -> dict:
    """[Pure] The standard auth response: the censored user plus a freshly minted token. Every entry
    point below ends here, so the shape the FE sees can't drift between them."""
    return {
        "user": censor(user),
        "token": mint_access_token(user["_id"], user.get("username"), user["user_type"]),
    }


async def register(username: str, password: str, user_data: dict[str, Any] | None = None) -> dict:
    """Create a credentialed USER and sign them in. Raises DuplicateUser if the username is taken."""
    password_hashed = await asyncio.to_thread(_hash_password, password)
    user = await users_repo.insert(
        {
            **(user_data or {}),
            "username": username,
            "password": password_hashed,
            "user_type": UserType.USER,
        }
    )
    return _issue(user)


async def register_guest(user_data: dict[str, Any] | None = None) -> dict:
    """Mint an anonymous GUEST and sign them in -- no username, no password. The token is a real one,
    so a guest is an ordinary authenticated caller everywhere downstream; only user_type says
    otherwise."""
    user = await users_repo.insert({**(user_data or {}), "user_type": UserType.GUEST})
    return _issue(user)


async def promote_guest(guest_id: str, username: str, password: str, user_data: dict[str, Any] | None = None) -> dict:
    """Turn an existing GUEST into a credentialed USER in place -- same document, so everything already
    attached to them survives. Raises UserNotFound for a stale guest_id, DuplicateUser if the username
    is taken."""
    password_hashed = await asyncio.to_thread(_hash_password, password)
    user = await users_repo.update(
        guest_id,
        {
            **(user_data or {}),
            "username": username,
            "password": password_hashed,
            "user_type": UserType.USER,
        },
    )
    if user is None:
        raise UserNotFound("no such guest", {"guest_id": guest_id})
    return _issue(user)


def _extract_google_profile(user_data: dict[str, Any]) -> dict[str, Any]:
    """[Pure] The first-class fields we lift out of the Google payload. `social_data.email` doubles as
    the google_id: it's the stable identifier the FE gets back, and using it as both keeps a person's
    account findable by either."""
    social_data = pydash.get(user_data, "social_data") or {}
    return {
        "google_id": pydash.get(social_data, "email"),
        "profile_picture": pydash.get(social_data, "picture"),
        "social_data": social_data,
    }


async def signin_google(user_data: dict[str, Any]) -> dict:
    """Sign in (or sign up) with Google, with no guest involved. An existing Google account has its
    profile refreshed from the payload; otherwise a new USER is created. `is_new` tells the FE which."""
    profile = _extract_google_profile(user_data)
    existing = await users_repo.get_by_google_id(profile["google_id"])
    if existing:
        user = await users_repo.update(
            existing["_id"],
            {"profile_picture": profile["profile_picture"], "social_data": profile["social_data"]},
        )
    else:
        user = await users_repo.insert(
            {
                **user_data,
                **profile,
                "tags": pydash.compact(["GOOGLE", *(pydash.get(user_data, "tags") or [])]),
                "user_type": UserType.USER,
                "username": profile["google_id"],
            }
        )
    return {**_issue(user), "is_new": not existing}


async def promote_guest_google(guest_id: str, user_data: dict[str, Any]) -> dict:
    """The Google flavour of promote_guest. If this Google account ALREADY exists (they signed up on
    another device), there's nothing to promote: we sign them into that account and abandon the guest
    document -- merging the two is a product decision, not something to do implicitly."""
    profile = _extract_google_profile(user_data)
    existing = await users_repo.get_by_google_id(profile["google_id"])
    if existing:
        user = await users_repo.update(
            existing["_id"],
            {"profile_picture": profile["profile_picture"], "social_data": profile["social_data"]},
        )
    else:
        user = await users_repo.update(
            guest_id,
            {
                **user_data,
                **profile,
                "tags": pydash.compact(["GOOGLE", *(pydash.get(user_data, "tags") or [])]),
                "user_type": UserType.USER,
                # A Google payload without an email leaves us no natural username, so mint one rather
                # than writing null into a unique index.
                "username": profile["google_id"] or generate_code(Charset.ALPHA_NUMERIC, 10),
            },
        )
        if user is None:
            raise UserNotFound("no such guest", {"guest_id": guest_id})
    return {**_issue(user), "is_new": not existing}


async def authenticate(username: str, password: str) -> dict:
    """Verify a username + password and sign the user in. Raises InvalidCredentials on either an
    unknown username or a wrong password -- the same error for both, so the endpoint can't be used to
    discover which usernames exist.

    The master password (settings.master_password, empty and therefore disabled unless explicitly
    configured) is a LOCAL DEBUGGING shortcut: it authenticates as any user without their password.
    Never set it in a deployed env."""
    # Constant-time compare, consistent with how the admin token is checked in utils/auth: a plain
    # == leaks the secret's length and a prefix-match position through timing. Both sides are encoded
    # first because compare_digest REJECTS non-ASCII str (a TypeError), and a password can contain
    # anything -- comparing bytes sidesteps that entirely.
    if settings.master_password and hmac.compare_digest(password.encode(), settings.master_password.encode()):
        user = await users_repo.get_by_username(username)
        # Convenience for debugging: fall back to treating the input as a user id.
        if user is None:
            user = await users_repo.get(username)
        if user is None:
            raise UserNotFound("no such user", {"username": username})
        return _issue(user)

    auth_row = await users_repo.get_auth_by_username(username)
    # No such user, or a user with no local password (a Google-only account) -> same opaque failure.
    if auth_row is None or not auth_row.get("password"):
        raise InvalidCredentials("invalid username or password")
    if not await asyncio.to_thread(_check_password, password, auth_row["password"]):
        raise InvalidCredentials("invalid username or password")

    user = await users_repo.get(auth_row["_id"])
    if user is None:
        raise UserNotFound("no such user", {"username": username})
    return _issue(user)


async def update(user_id: str, updates: dict[str, Any]) -> User:
    """Apply a self-service profile edit. The caller (controller) has already narrowed `updates` to the
    fields a user may change about themselves -- see dto.users.UpdateMeRequest."""
    user = await users_repo.update(user_id, updates)
    if user is None:
        raise UserNotFound("no such user", {"user_id": user_id})
    return censor(user)


__all__ = [
    "DuplicateUser",
    "InvalidCredentials",
    "UserNotFound",
    "authenticate",
    "censor",
    "promote_guest",
    "promote_guest_google",
    "register",
    "register_guest",
    "signin_google",
    "update",
]
