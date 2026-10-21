#!/bin/sh
# Install (or bring up to date) this app's dependencies. The platform runs it at every setup, inside the
# project's container; run it yourself after changing dependencies (pyproject.toml). Safe to re-run any
# time: uv sync is quick when nothing changed, and locks the environment while it works.
set -eu
cd "$(dirname "$0")"
uv sync
