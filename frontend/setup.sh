#!/bin/sh
# Install (or bring up to date) this app's dependencies. The platform runs it at every setup, inside the
# project's container; run it yourself after changing dependencies (package.json). Safe to re-run any time.
#
# npm install only runs when needed: no finished install yet, or package.json / package-lock.json changed
# since. "Finished" is npm's own end-of-install lockfile, node_modules/.package-lock.json -- node_modules
# alone shows up as soon as an install starts, so an interrupted one would look done.
set -eu
cd "$(dirname "$0")"
finished=node_modules/.package-lock.json
if [ ! -f "$finished" ] || [ package.json -nt "$finished" ] || [ package-lock.json -nt "$finished" ]; then
    npm install
fi
