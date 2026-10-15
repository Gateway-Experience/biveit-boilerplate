# User typing. Two kinds live here (see dto/__init__):
#  - The User INTERFACE (TypedDict) over the users-document dict the repo returns and auth/controllers
#    read by key (user["_id"], user["username"], ...). Notably `password` is NOT here -- the repo never
#    returns it except through the one deliberate auth lookup (users.get_auth_by_username).
#  - The request CONTRACTS (Pydantic) validating untrusted HTTP bodies.

from typing import Any, NotRequired, TypedDict

from pydantic import BaseModel


class User(TypedDict):
    """A users-document interface over the dict the repo returns. `_id` is a STRING (utils/mongo
    stringifies it at the boundary), not an ObjectId. `password` is deliberately absent -- it's
    projected out of every read but the auth lookup."""

    _id: str
    username: str | None
    user_type: str  # UserType -- USER | GUEST
    full_name: NotRequired[str | None]
    profile_picture: NotRequired[str | None]
    google_id: NotRequired[str | None]
    social_data: NotRequired[dict[str, Any]]
    tags: NotRequired[list[str]]
    meta: NotRequired[dict[str, Any]]
    deleted: bool
    created_at: Any  # datetime
    updated_at: Any  # datetime


class RegisterRequest(BaseModel):
    """POST /user/register body. `user_data` is the free-form profile blob the FE sends alongside the
    credentials (full_name, tags, ...); it's merged into the document, so keep it to profile fields."""

    username: str
    password: str
    user_data: dict[str, Any] = {}


class AuthenticateRequest(BaseModel):
    username: str
    password: str


class PromoteRequest(BaseModel):
    """POST /user/promote body: turn an existing GUEST into a credentialed USER in place, keeping the
    same _id (so whatever the guest accumulated stays attached to them)."""

    guest_id: str
    username: str
    password: str
    user_data: dict[str, Any] = {}


class GoogleSigninRequest(BaseModel):
    """POST /user/signin-google body. `user_data.social_data` carries the Google profile payload the FE
    got back from the Google SDK -- email and picture are lifted out of it into first-class fields."""

    user_data: dict[str, Any] = {}


class PromoteGoogleRequest(BaseModel):
    """POST /user/promote-google body: the Google flavour of PromoteRequest."""

    guest_id: str
    user_data: dict[str, Any] = {}


class UpdateMeRequest(BaseModel):
    """PATCH /me body. Deliberately NARROW -- this is a self-service edit from the browser, so it lists
    only the fields a user may change about themselves. Anything not listed is rejected (extra="forbid")
    rather than silently dropped, so a FE sending a field it thinks is being saved finds out. Widen this
    as the profile grows; never widen it to privileged fields (user_type, tags, deleted)."""

    model_config = {"extra": "forbid"}

    full_name: str | None = None
    profile_picture: str | None = None
