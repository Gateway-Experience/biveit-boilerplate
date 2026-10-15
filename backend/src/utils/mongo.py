# Intentions: low-level async MongoDB access (shared client + the collection handle + index bootstrap).
# Infra plumbing in utils/; repositories call collection(), never manage the client.
#
# Connection-module convention (shared by mongo / redis / http):
#   - connect(): create the singleton ONCE at service startup, before serving. No lock needed --
#     startup is sequential, so there's no concurrent-first-caller race to guard.
#   - db()/collection(): return the live handle (asserts connect() ran).
#   - close(): graceful shutdown.
#
# ID CONVENTION -- the one piece of real translation this module owns. Mongo's `_id` is an ObjectId,
# which is not JSON-serializable and is awkward for callers to compare against a string from a URL or
# a JWT. So the boundary here is: repositories hand UP plain dicts whose `_id` is a STRING, and take
# DOWN ids as strings. to_object_id/from_document do that conversion; nothing above this module should
# ever import bson. References: src/repositories/* (every repo goes through these).

from typing import Any

from bson import ObjectId
from bson.codec_options import CodecOptions
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo import IndexModel

from src.config import settings

# BSON has no timezone: a datetime goes in aware (we always write UTC) and comes back NAIVE unless the
# driver is told otherwise, which silently breaks the "everything is UTC" convention the moment a read
# value meets an aware one (subtracting them is a TypeError). tz_aware makes every datetime the driver
# decodes UTC-aware, so what you read is what you wrote. Applied at the DATABASE handle, so it covers
# every collection.
_CODEC_OPTIONS = CodecOptions(tz_aware=True)

_client: AsyncIOMotorClient | None = None


# ci:trivial
async def connect() -> None:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri)


# ci:trivial
def db() -> AsyncIOMotorDatabase:
    assert _client is not None, "mongo not connected; call connect() at startup"
    return _client.get_database(settings.mongo_db, codec_options=_CODEC_OPTIONS)


# ci:trivial
def collection(name: str) -> AsyncIOMotorCollection:
    """The live handle for one collection -- what every repository builds on."""
    return db()[name]


# ci:trivial
async def close() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def ping() -> bool:
    """Whether the server answers. The health endpoint's actual check -- unlike a driver-side
    'connected' flag, this proves a round trip. Raises if the server is unreachable."""
    await db().command("ping")
    return True


# --- Id + document conversion ---------------------------------------------------------------------


def to_object_id(value: Any) -> ObjectId | None:
    """[Pure] A string (or ObjectId) -> ObjectId, or None if it isn't a valid one. Returning None
    rather than raising lets a lookup treat a malformed id as simply "no such document" -- which is
    what a garbage id from a URL path means anyway."""
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def from_document(document: dict | None) -> dict | None:
    """[Pure] A raw Mongo document -> the dict shape the rest of the codebase reads: `_id` stringified
    so it's JSON-serializable and directly comparable to ids coming off a URL or a JWT claim."""
    if document is None:
        return None
    return {**document, "_id": str(document["_id"])}


def from_documents(documents: list[dict]) -> list[dict]:
    """[Pure] from_document over a list."""
    return [d for d in (from_document(doc) for doc in documents) if d is not None]


# --- Index bootstrap ------------------------------------------------------------------------------
# Mongo is schemaless, so a repository's only structural declaration is its INDEXES. Each repo module
# exports `INDEXES: dict[collection_name, list[IndexModel]]` and ensure_indexes() applies them all at
# startup -- the replacement for Mongoose's implicit ensureIndex on model definition.
# create_indexes is idempotent: an index that already matches is a no-op.


async def ensure_indexes(index_specs: dict[str, list[IndexModel]]) -> None:
    """Create every declared index (idempotent). Called once at startup with the merged specs from
    every repository."""
    for collection_name, models in index_specs.items():
        if models:
            await collection(collection_name).create_indexes(models)
