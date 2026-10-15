# The repository layer -- the ONLY place that knows about the concrete store (MongoDB). Services talk
# to repos in storage-neutral terms and never import motor/bson directly.
#
# Conventions in this layer:
#   - One module per collection, named after the collection. Structure stays FLAT -- it should mirror
#     the collection list in the db, not the app's feature tree.
#   - Functions are thin and REUSABLE: `get` for one document by id, `get_by_<field>` for one by some
#     other unique key, `find` for a filtered list, plus `insert`/`update`/`delete`. A repo function
#     over-fitted to one caller's exact field selection is a smell -- one generic `find` serving
#     several callers is the goal.
#   - Every module declares its INDEXES (Mongo is schemaless, so indexes are the only structural
#     declaration there is); INDEX_SPECS below merges them and app startup applies them.
#   - Documents come back as plain dicts with a STRING `_id` (utils/mongo.from_document). Nothing
#     above this layer should ever see an ObjectId.

from src.repositories import events, kv_store, system_configurations, users
from src.utils import mongo

# Every collection's indexes, merged for the startup bootstrap (utils/mongo.ensure_indexes). A new
# repository module adds itself here -- that's what makes its indexes real.
INDEX_SPECS = {
    **users.INDEXES,
    **system_configurations.INDEXES,
    **events.INDEXES,
    **kv_store.INDEXES,
}


async def check_store_reachable() -> bool:
    """Whether the store answers -- the health probe's actual check, expressed WITHOUT naming the
    engine. Lives here rather than in the controller so "which database is it" stays a fact only this
    layer knows. Raises if the store is unreachable."""
    return await mongo.ping()


__all__ = [
    "INDEX_SPECS",
    "check_store_reachable",
    "events",
    "kv_store",
    "system_configurations",
    "users",
]
