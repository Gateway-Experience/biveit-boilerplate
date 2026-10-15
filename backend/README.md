# Backend

FastAPI + MongoDB (Motor), async throughout. Python 3.12, managed with [uv](https://docs.astral.sh/uv/).

## Setup

```bash
uv sync                  # install dependencies into .venv
cp .env.example .env.local
```

Then edit `.env.local`:

- `MONGO_URI` / `MONGO_DB` — your MongoDB connection.
- `JWT_SECRET` — anything long and random. **Empty means every authenticated route 401s**, so set it
  before you try to log in.
- `APP_NAME` — identifies this app in the logs. Rename it per project.
- `ADMIN_TOKEN` — the super-user secret, if you want the privileged endpoints. Empty disables them.

Run it:

```bash
uv run python main.py    # http://localhost:3001, reload on if API_RELOAD=true
```

## Layout

```
main.py              entry point (uvicorn)
src/
  app.py             the FastAPI app: lifespan (connections, indexes), CORS, routers
  config.py          all settings, from env / .env files
  constants.py       enums and constants
  controllers/       HTTP edge: parse, authenticate, delegate, map to a status
  services/          business logic, agnostic of both HTTP and the store
  repositories/      data access, one module per collection
  dto/               TypedDict interfaces + Pydantic request models
  utils/             connections (mongo/redis/http), logging, auth, cache, s3
tests/unit/
```

The layering is `controller -> service -> repository`, and a controller may call a repository directly
when there'd be no logic in between. Each layer's `__init__.py` documents what belongs in it — read
those first.

## Endpoints

Everything is under `/api`, so a host nginx needs one rule.

| | |
|---|---|
| `POST /api/user/register` | sign up with username + password |
| `POST /api/user/authenticate` | log in |
| `POST /api/user/register-guest` | mint an anonymous guest account |
| `POST /api/user/promote` | guest → credentialed user, keeping the same id |
| `POST /api/user/signin-google` | log in / sign up with Google |
| `POST /api/user/promote-google` | guest → Google-linked user |
| `GET /api/me` | the current user |
| `PATCH /api/me` | self-service profile edit |
| `GET /api/system-configuration` | runtime settings the caller may see |
| `GET /api/system-configuration/{name}` | one setting's value |
| `GET /api/debug/health` | liveness + db reachability |
| `POST /api/system/reload-config` | force a settings refresh (super user) |

Interactive docs at `/docs` while the server is running.

## A few things worth knowing

**Guests.** A visitor gets a real GUEST account on first visit, and signing up *promotes that same
document* rather than creating a new one — so whatever they accumulated stays theirs. See
`src/services/users.py`.

**Indexes are the schema.** Mongo is schemaless, so each repository declares its `INDEXES` and
`src/app.py` applies them all at startup. A new collection adds itself to `src/repositories/__init__.py`.

**Two gates on a runtime setting.** `status` (ENABLED/DISABLED) decides whether a setting is in
effect; `meta.is_private` decides who may read it. They're independent — see
`src/repositories/system_configurations.py`.

**Settings are cached for 15 minutes.** `src/services/system_config.py` keeps an in-memory snapshot
that refreshes lazily. `POST /api/system/reload-config` forces it if you don't want to wait.

**Errors are logged at the edge.** Inner layers raise and let it bubble; the controller catches, calls
`log_http_error`, and returns a status. The exception is an error something deliberately swallows —
that gets logged where it's swallowed. See `src/controllers/__init__.py`.

## Checks

```bash
uv run ruff check --fix
uv run ruff format
uv run pytest tests
```
