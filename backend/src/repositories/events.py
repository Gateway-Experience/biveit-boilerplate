# Intentions: data access for `events` -- a generic, append-only activity log. One row per thing that
# happened; nothing is ever updated in place, so this is the STREAM half of the table/stream duality
# (the collapsed state lives in whatever domain collection the event was about).
#
# The shape is the type-ID combo applied throughout: each participant in an event is a (type, ref)
# pair -- subject (who did it), direct object (what they did it to), indirect object (what they did it
# with), grouping (what bucket it belongs to). Recording a new kind of event means inventing new type
# values, not migrating the collection. `value` is the event's own payload, free-form.
#
# NO CONSUMER YET -- carried into the boilerplate ahead of need, because retrofitting an activity log
# after the fact means the history you wanted is exactly the history you don't have.

from typing import Any

from pymongo import ASCENDING, IndexModel

from src.utils import mongo
from src.utils.common import utc_now

COLLECTION = "events"

# Every index ends in created_at: these are all "the events matching X, in time order" reads, and a
# trailing time key lets one index serve both the filter and the sort.
INDEXES = {
    COLLECTION: [
        IndexModel(
            [("type", ASCENDING), ("subject_type", ASCENDING), ("subject_ref", ASCENDING), ("created_at", ASCENDING)]
        ),
        IndexModel([("subject_ref", ASCENDING), ("created_at", ASCENDING)]),
        IndexModel([("type", ASCENDING), ("created_at", ASCENDING)]),
        IndexModel(
            [
                ("type", ASCENDING),
                ("direct_object_type", ASCENDING),
                ("direct_object_ref", ASCENDING),
                ("created_at", ASCENDING),
            ]
        ),
    ]
}


def _collection():
    return mongo.collection(COLLECTION)


async def get(event_id: str) -> dict | None:
    object_id = mongo.to_object_id(event_id)
    if object_id is None:
        return None
    return mongo.from_document(await _collection().find_one({"_id": object_id}))


async def find(criteria: dict | None = None, *, sort: list | None = None, limit: int = 0) -> list[dict]:
    """Events matching `criteria`, oldest-first by default (the natural order for a log). `limit` of 0
    means no limit, matching the driver's own convention."""
    cursor = _collection().find(criteria or {}).sort(sort or [("created_at", ASCENDING)])
    if limit:
        cursor = cursor.limit(limit)
    return mongo.from_documents(await cursor.to_list(length=None))


async def count(criteria: dict | None = None) -> int:
    return await _collection().count_documents(criteria or {})


async def insert(event: dict[str, Any]) -> dict:
    """Append one event."""
    document = {**event, "created_at": utc_now()}
    result = await _collection().insert_one(document)
    return mongo.from_document({**document, "_id": result.inserted_id})


async def insert_many(events: list[dict[str, Any]]) -> int:
    """Append several events in ONE round trip, returning how many landed. For a caller producing a
    batch -- doing it one insert at a time is the thing this exists to avoid."""
    if not events:
        return 0
    now = utc_now()
    result = await _collection().insert_many([{**event, "created_at": now} for event in events])
    return len(result.inserted_ids)


async def aggregate(pipeline: list[dict]) -> list[dict]:
    """Run an aggregation pipeline. The escape hatch for the reporting-shaped reads an activity log
    attracts (counts per type per day, and so on) that the find/count verbs above can't express."""
    return mongo.from_documents(await _collection().aggregate(pipeline).to_list(length=None))
