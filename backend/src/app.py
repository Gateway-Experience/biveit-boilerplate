# Intentions: the FastAPI app -- wire up the connections this process needs at startup, mount the
# routers, tear the connections down on shutdown.
#
# STARTUP POLICY: Mongo is REQUIRED (it's the store; booting without it just means every request 500s,
# so fail loudly at startup instead). Redis and the config snapshot are BEST-EFFORT -- the app is
# useful without either (nothing caches yet, and settings fall back to code defaults), so a missing
# local redis shouldn't stop you from running the API.

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.controllers.system import router as system_router
from src.controllers.system_configurations import router as system_configurations_router
from src.controllers.users import router as users_router
from src.repositories import INDEX_SPECS
from src.services import system_config
from src.utils import http, mongo, redis
from src.utils.logging import configure_logging, log_error

# Every route lives under /api so a host nginx has a single rule (/api/ -> this container) and nothing
# is served bare at the root.
_API_PREFIX = "/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # configure_logging runs here, not only in main(): under `uvicorn --reload` the app is imported by
    # a subprocess that never runs main(), and uvicorn's own logging config sets up only the uvicorn*
    # loggers (root gets no handler). Without this our own log lines would silently vanish there.
    # Idempotent.
    configure_logging()

    await mongo.connect()
    # Indexes are Mongo's only structural declaration, so applying them IS the schema migration.
    # Idempotent -- an index that already matches is a no-op.
    await mongo.ensure_indexes(INDEX_SPECS)
    await http.connect()

    try:
        await redis.connect()
    except Exception as error:
        log_error(error, "redis connect failed at startup; cache calls will error until it's up")

    # Warm the runtime-settings snapshot so the first request doesn't pay for the load. Best-effort:
    # an empty or missing collection just means everything falls back to its code default.
    try:
        await system_config.force_load()
    except Exception as error:
        log_error(error, "system config load failed at startup; running on defaults")

    yield

    await http.close()
    await redis.close()
    await mongo.close()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    # CORS for the browser FE. Auth is a Bearer header, not a cookie, so we DON'T allow credentials --
    # which is also what makes a "*" origin legal (wildcard + allow_credentials=True is rejected by
    # browsers). Lock the origins down per env via CORS_ALLOWED_ORIGINS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.resolved_cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(users_router, prefix=_API_PREFIX)
    app.include_router(system_configurations_router, prefix=_API_PREFIX)
    app.include_router(system_router, prefix=_API_PREFIX)
    return app


app = create_app()
