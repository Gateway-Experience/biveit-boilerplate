# Intentions: request authentication. FastAPI dependencies a route declares to require (or merely
# detect) a caller's identity:
#
#   @router.get("/me")
#   async def me(user: User = Depends(get_current_user)) -> dict:
#       return {"id": user["_id"]}
#
# Two independent schemes live here:
#   - USER auth: an `Authorization: Bearer <jwt>` token (HS256, secret in settings.jwt_secret). The
#     JWT `sub` carries the user's _id, and the dependency RELOADS the user record -- the token is
#     proof of identity, the db row is the source of truth for everything else.
#   - SUPER-USER auth: a single shared secret (settings.admin_token) sent as the bearer credential.
#     Not a person, so there's no record to return.
#
# Each comes in a STRICT and a LENIENT flavour. Strict (get_current_user / require_superuser) raises
# 401/403 and the route never runs. Lenient (get_current_user_optional / get_maybe_superuser) returns
# None/False so the route can serve a degraded-but-valid response -- an anonymous visitor, or the
# public subset of a config list. References: src/repositories/users.

import hmac
import warnings
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.warnings import InsecureKeyLengthWarning

from src.config import settings
from src.dto.users import User
from src.repositories import users
from src.utils.common import utc_now

# PyJWT warns (not raises) on every encode/decode when the HS256 secret is < 32 bytes (RFC 7518). It's
# a real signal about secret strength, but it's a DEPLOYMENT/config concern (the secret is set per-env,
# not something this code can fix), and left unfiltered it fires on EVERY token verify -- flooding the
# logs. Silence it here, the sole jwt call site; secret strength is enforced by choosing a proper
# JWT_SECRET per env.
warnings.filterwarnings("ignore", category=InsecureKeyLengthWarning)

# auto_error=False so a missing/malformed header yields None (our own 401 below) rather than
# HTTPBearer's own 403 -- one consistent 401 for every auth failure, and it's what lets the lenient
# dependencies see "no credentials" instead of being short-circuited.
_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(status_code=401, detail="UNAUTHORIZED", headers={"WWW-Authenticate": "Bearer"})
_FORBIDDEN = HTTPException(status_code=403, detail="FORBIDDEN")


def mint_access_token(user_id: str, username: str | None, user_type: str) -> str:
    """Issue an HS256 access token for a user (the LOGIN side, symmetric with _decode_subject). `sub`
    is the user's _id. `username` and `user_type` ride along as convenience claims (e.g. for FE display
    without a round-trip) -- but they're NOT authoritative: get_current_user reloads the user record,
    which stays the source of truth for authz. Expires after settings.jwt_expiry_seconds. Raises if no
    jwt_secret is configured -- you can't mint what you can't later verify (fail closed at both ends)."""
    if not settings.jwt_secret:
        raise RuntimeError("jwt_secret not configured; cannot mint access tokens")
    now = utc_now()
    payload = {
        "sub": user_id,
        "username": username,
        "userType": user_type,
        "iat": now,
        "exp": now + timedelta(seconds=settings.jwt_expiry_seconds),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode_subject(token: str) -> str | None:
    """[Pure] Verify the HS256 token and return its subject (the user's _id), or None on any JWT problem
    (bad signature, expired, malformed, missing sub). Fail closed: no configured secret -> no token is
    ever valid. jwt.decode enforces exp by default."""
    if not settings.jwt_secret:
        return None
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"]).get("sub")
    except jwt.InvalidTokenError:
        return None


async def _resolve_user(creds: HTTPAuthorizationCredentials | None) -> User | None:
    """The shared lookup behind both user dependencies: credentials -> the live user record, or None if
    anything at all is wrong (no header, bad token, unknown or deleted user). Having ONE resolver is
    what keeps the strict and lenient flavours from drifting apart."""
    if creds is None:
        return None
    user_id = _decode_subject(creds.credentials)
    if user_id is None:
        return None
    return await users.get(user_id)


async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    """Route dependency: the authenticated user's record, or 401. Use this on anything that needs a
    logged-in caller."""
    user = await _resolve_user(creds)
    if user is None:
        raise _UNAUTHORIZED
    return user


async def get_current_user_optional(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User | None:
    """Route dependency: the authenticated user's record, or None when the caller is anonymous or their
    token doesn't check out. For endpoints that serve both -- the route decides what an absent user
    means. NOTE a bad token is indistinguishable from no token here (both -> None), deliberately: a
    lenient route has already said it doesn't care why."""
    return await _resolve_user(creds)


def require_superuser(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> None:
    """Route dependency gating super-user-only endpoints. Fail closed: no configured admin_token ->
    nobody is a super user. Constant-time compare avoids a token-timing leak. This secret isn't a
    person, so there's no record to return -- success yields None."""
    if not _is_superuser(creds):
        raise _FORBIDDEN


def get_maybe_superuser(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> bool:
    """Route dependency: WHETHER the caller presented the super-user secret, without requiring it. For
    endpoints whose response WIDENS for an operator rather than being gated outright -- the config
    reads, where a normal caller sees the public subset and a super user sees everything."""
    return _is_superuser(creds)


def _is_superuser(creds: HTTPAuthorizationCredentials | None) -> bool:
    """[Pure] The shared constant-time check behind both super-user dependencies."""
    expected = settings.admin_token
    return bool(expected and creds is not None and hmac.compare_digest(creds.credentials, expected))
