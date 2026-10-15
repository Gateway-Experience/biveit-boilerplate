# Intentions: data access for the `users` collection -- the app's accounts, both credentialed (USER)
# and anonymous (GUEST). Covers the auth lookups (by username, by google id), the profile reads, and
# the writes behind registration/promotion.
#
# PASSWORD HANDLING is the one thing to be careful about here: `password` (a bcrypt hash) is stored on
# the document but PROJECTED OUT of every read, so the User interface genuinely never carries it. The
# single exception is get_auth_by_username, which exists precisely to hand the hash to the auth service
# and is named so its call sites are greppable. Never widen a normal read to include it.

from typing import Any, cast

from pymongo import ASCENDING, IndexModel, ReturnDocument
from pymongo.errors import DuplicateKeyError

from src.constants import UserType
from src.dto.users import User
from src.utils import mongo
from src.utils.common import utc_now

COLLECTION = "users"

# Sparse uniques: a GUEST has neither username nor google_id, and a plain unique index would let only
# ONE document hold null. Sparse skips documents missing the field entirely, so any number of guests
# coexist while real usernames stay unique.
INDEXES = {
    COLLECTION: [
        IndexModel([("username", ASCENDING)], unique=True, sparse=True),
        IndexModel([("google_id", ASCENDING)], unique=True, sparse=True),
    ]
}

# Everything a caller may see. `password` is absent on purpose -- see the module note.
_PROJECTION = {"password": 0}


class DuplicateUser(Exception):
    """A write collided with a unique index. Carries {"keys": [...]} naming which field(s) clashed, so
    the controller can tell "username taken" from "google account already linked" without re-querying.
    Raised instead of leaking pymongo's DuplicateKeyError past this layer."""


def _collection():
    return mongo.collection(COLLECTION)


def _raise_duplicate(error: DuplicateKeyError) -> None:
    """Translate pymongo's duplicate-key error into our own, naming the offending field(s). The key
    names live in the driver's error details; fall back to an empty list if the shape surprises us --
    a vaguer error still beats a 500."""
    key_pattern = (error.details or {}).get("keyPattern") or {}
    raise DuplicateUser("duplicate key", {"keys": list(key_pattern)}) from error


async def get(user_id: str) -> User | None:
    """One user by id. A malformed id yields None rather than raising -- garbage in a URL path means
    "no such user", which is what the caller does about it anyway."""
    object_id = mongo.to_object_id(user_id)
    if object_id is None:
        return None
    document = await _collection().find_one({"_id": object_id, "deleted": False}, _PROJECTION)
    return cast("User | None", mongo.from_document(document))


async def get_by_username(username: str) -> User | None:
    document = await _collection().find_one({"username": username, "deleted": False}, _PROJECTION)
    return cast("User | None", mongo.from_document(document))


async def get_by_google_id(google_id: str) -> User | None:
    document = await _collection().find_one({"google_id": google_id, "deleted": False}, _PROJECTION)
    return cast("User | None", mongo.from_document(document))


async def get_auth_by_username(username: str) -> dict | None:
    """The LOGIN lookup -- deliberately OUTSIDE the User interface: it selects `password`, which User
    never exposes. Returns just what the auth service needs to verify a credential (_id + the hash), or
    None if no such user. Keep the result inside the auth service; never let the hash travel upward."""
    document = await _collection().find_one(
        {"username": username, "deleted": False},
        {"_id": 1, "password": 1},
    )
    return mongo.from_document(document)


async def find(criteria: dict | None = None) -> list[User]:
    """Users matching `criteria` (deleted ones are always excluded)."""
    cursor = _collection().find({**(criteria or {}), "deleted": False}, _PROJECTION)
    return cast("list[User]", mongo.from_documents(await cursor.to_list(length=None)))


async def insert(data: dict[str, Any]) -> User:
    """Create a user and return it (without the password). The caller supplies an ALREADY-HASHED
    `password` if the account has one -- hashing is the auth service's job, never this layer's."""
    now = utc_now()
    document = {
        "user_type": UserType.USER,
        "deleted": False,
        **data,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await _collection().insert_one(document)
    except DuplicateKeyError as error:
        _raise_duplicate(error)
    # Build the return value from what we just wrote rather than re-reading it, minus the password --
    # the projection that keeps it out of every other read has to be applied by hand here.
    inserted = {**document, "_id": result.inserted_id}
    inserted.pop("password", None)
    return cast("User", mongo.from_document(inserted))


async def update(user_id: str, updates: dict[str, Any]) -> User | None:
    """Apply `updates` to a user and return the NEW document, or None if there's no such user. Only the
    given fields change (a $set), so a partial update can't blank out what it didn't mention."""
    object_id = mongo.to_object_id(user_id)
    if object_id is None:
        return None
    try:
        document = await _collection().find_one_and_update(
            {"_id": object_id, "deleted": False},
            {"$set": {**updates, "updated_at": utc_now()}},
            projection=_PROJECTION,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError as error:
        _raise_duplicate(error)
    return cast("User | None", mongo.from_document(document))
