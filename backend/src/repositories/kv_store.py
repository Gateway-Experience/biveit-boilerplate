# Intentions: data access for `kv_store` -- a generic durable key-value collection. One document per
# key; `value` is an opaque blob owned by whoever owns the key's namespace. Keys are namespaced
# strings, e.g. "<domain>:<id>:<scope>" (a sync watermark, a checkpoint, a cursor).
#
# WHY THIS AND NOT REDIS: persistence. Redis (utils/cache) holds derived data that may vanish -- if
# the cache is cold you recompute and get the same answer. What goes here is state you CANNOT rebuild:
# how far a job got, what you've already processed. Losing it means redoing or skipping real work.
# That's the whole distinction; if a value fails it, it belongs in the cache instead.
#
# System-wide by design (no tenant/user scoping): the KEY encodes whatever scope it needs.
# NO CONSUMER YET -- carried in ahead of need, for the first flow that needs durable progress state.

from typing import Any

from pymongo import ASCENDING, IndexModel

from src.utils import mongo
from src.utils.common import utc_now

COLLECTION = "kv_store"

INDEXES = {COLLECTION: [IndexModel([("key", ASCENDING)], unique=True)]}


def _collection():
    return mongo.collection(COLLECTION)


async def get(key: str) -> Any | None:
    """The value stored under `key`, or None if the key doesn't exist."""
    document = await _collection().find_one({"key": key}, {"value": 1})
    return document.get("value") if document else None


async def set(key: str, value: Any) -> None:
    """Upsert `value` under `key`. Idempotent -- writing the same key twice just overwrites, which is
    what a watermark or checkpoint wants."""
    await _collection().update_one(
        {"key": key},
        {"$set": {"value": value, "updated_at": utc_now()}, "$setOnInsert": {"created_at": utc_now()}},
        upsert=True,
    )


async def delete(key: str) -> None:
    """Drop `key` (no-op if absent)."""
    await _collection().delete_one({"key": key})
