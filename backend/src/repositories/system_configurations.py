# Intentions: data access for `system_configurations` -- runtime, operator-tunable settings (name ->
# value) that change behaviour without a redeploy. Read-mostly; writes happen out-of-band (a console,
# a script), not through the app's own endpoints.
#
# TWO INDEPENDENT GATES on a row, which are easy to conflate:
#   - `status` (ENABLED/DISABLED) -- whether the value is IN EFFECT. A disabled row is treated as
#     absent, so callers fall back to their code default.
#   - `meta.is_private` -- who may READ it. Private settings are served only to a super user; the
#     public ones are what the browser is allowed to see.
# They're orthogonal: a row can be in effect but invisible to the FE (a secret threshold), or visible
# but disabled. Every read here takes `status` into account; VISIBILITY is the caller's filter to pass,
# since only the controller knows who's asking.

from typing import Any

from pymongo import ASCENDING, IndexModel, ReturnDocument

from src.constants import ConfigStatus
from src.utils import mongo
from src.utils.common import utc_now

COLLECTION = "system_configurations"

INDEXES = {COLLECTION: [IndexModel([("name", ASCENDING)], unique=True)]}

# The filter fragment every read carries: only rows that are in effect.
_ENABLED = {"status": ConfigStatus.ENABLED, "deleted": False}


def _collection():
    return mongo.collection(COLLECTION)


async def get_all_enabled() -> dict[str, Any]:
    """Every ENABLED setting as {name: value} -- what the service's cache is built from. DISABLED rows
    are excluded, so an absent key means "use your default" whichever gate excluded it."""
    cursor = _collection().find(_ENABLED, {"name": 1, "value": 1})
    return {document["name"]: document.get("value") for document in await cursor.to_list(length=None)}


async def find(criteria: dict | None = None) -> list[dict]:
    """Enabled settings matching `criteria` -- the visibility filter is the caller's to supply (e.g.
    {"meta.is_private": False} for a non-super-user)."""
    cursor = _collection().find({**_ENABLED, **(criteria or {})})
    return mongo.from_documents(await cursor.to_list(length=None))


async def find_one(criteria: dict) -> dict | None:
    """One enabled setting matching `criteria`, or None."""
    return mongo.from_document(await _collection().find_one({**_ENABLED, **criteria}))


async def insert(name: str, value: Any, *, is_private: bool = True, meta: dict | None = None) -> dict:
    """Create a setting. Defaults to PRIVATE: a new setting shouldn't become browser-visible just
    because whoever added it didn't think about visibility -- opt in to public explicitly."""
    now = utc_now()
    document = {
        "name": name,
        "value": value,
        "status": ConfigStatus.ENABLED,
        "meta": {"is_private": is_private, **(meta or {})},
        "deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await _collection().insert_one(document)
    return mongo.from_document({**document, "_id": result.inserted_id})


async def update(name: str, updates: dict[str, Any]) -> dict | None:
    """Apply `updates` to the setting called `name`, returning the new document (or None if absent).
    Matches regardless of status, so a DISABLED row can be re-enabled through here."""
    return mongo.from_document(
        await _collection().find_one_and_update(
            {"name": name, "deleted": False},
            {"$set": {**updates, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
    )
