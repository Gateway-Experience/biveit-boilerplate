# Intentions: single source of runtime configuration.
#
# Loading order (lowest precedence first), via python-dotenv into the process env before Settings is
# read:
#   1. .env.local     -- base config (dev defaults; the committed template is .env.example).
#   2. .env.<ENV>     -- the env-specific file (.env.prod / .env.canary), selected by the ENV var;
#                        overrides .env.local. In containers ENV is set and --env-file already injected
#                        the real vars, so this is a harmless no-op there.
#   3. real environment variables (set by the orchestrator) -- always win, since dotenv is loaded
#      with override=False (it never clobbers an already-set var).
# So precedence is: real env > .env.<ENV> > .env.local > the code defaults below.
# Env var names match the field names (uppercased), no prefix -- e.g. MONGO_URI, JWT_SECRET.

import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load the env-specific dotenv first (its values win over .env.local via override=False), then the
# .env.local base. Locally ENV is unset -> "local", so only .env.local applies. Real env vars beat both.
load_dotenv(f".env.{os.environ.get('ENV', 'local')}", override=False)
load_dotenv(".env.local", override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")  # env var name == field name (no prefix)

    # Deployment environment label: "local" | "prod" | "canary". Drives the log FORMAT (human text
    # locally, JSON when deployed) and the CORS fallback. Not a data-targeting switch.
    env: str = "local"
    # Identifies this app in logs (the `service` field every deployed log line carries). Rename it
    # per project -- it's how you tell two services apart in one log stream.
    app_name: str = "backend"

    # Where the server listens. 127.0.0.1 by default: on a shared host the dev server must only be reachable
    # through nginx. Inside a container (prod) it has to be 0.0.0.0, or the published port can't reach it.
    api_host: str = "127.0.0.1"
    api_port: int = 3001
    # Hot-reload (uvicorn --reload). Dev convenience only -- MUST stay false in prod (it watches the
    # filesystem and spawns a reloader subprocess). Set API_RELOAD=true in .env.local.
    api_reload: bool = False

    # MongoDB -- the application store.
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "boilerplate"

    # Redis -- available infrastructure (utils/cache reads through it). Startup connect is best-effort,
    # so the app still boots without a local redis; a cache call then fails at its own call site.
    redis_url: str = "redis://localhost:6379/0"

    # JWT -- HS256 secret for user access tokens (utils/auth). Empty disables auth'd routes entirely
    # (fail closed: no secret -> no token can be minted or verified -> 401).
    jwt_secret: str = ""
    jwt_expiry_seconds: int = 1296000  # 15 days

    # Super-user shared secret for privileged endpoints (e.g. POST /system/reload-config) and for the
    # private-config reads. Empty disables them entirely (fail closed).
    admin_token: str = ""

    # A password that authenticates as ANY user, for debugging. Empty (the default, and the only
    # acceptable prod value) disables it. Never set this in a deployed env.
    master_password: str = ""

    # AWS -- S3 uploads (utils/aws/s3). Prefer an IAM role on AWS compute: leave the keys EMPTY and
    # boto3's default credential chain (instance profile / task role) takes over. Set explicit keys
    # only when running off-AWS.
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_bucket: str = ""

    # CORS -- comma-separated allowed browser origins. Set this to lock the API down to the FE's
    # origin(s) in a deployed env; empty falls back to "*" (see resolved_cors_origins).
    cors_allowed_origins: str = ""

    def resolved_cors_origins(self) -> list[str]:
        """Allowed browser origins: the explicit cors_allowed_origins list if set, else "*". The
        wildcard is legal here because auth is a Bearer header, not a cookie, so we never send CORS
        credentials (a wildcard + allow_credentials=True is rejected by browsers)."""
        if self.cors_allowed_origins:
            return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]
        return ["*"]


settings = Settings()
