#!/usr/bin/env bash
# Scaffold a new frontend project from this boilerplate.
#
#   ./scaffold.sh /abs/path/to/new-project [--name my-app] [--install] [--force]
#
# Copies the tracked source of truth (src/, configs, public/) into the target, along with
# node_modules so the new project runs without touching the network. That copy is ~479MB /
# 34k files, so it's the slow part by far — `--install` runs `npm ci` instead (~3s on a warm
# cache) and is worth using if the two projects might drift onto different dependencies.

set -euo pipefail

_die() { echo "error: $*" >&2; exit 1; }

_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Everything the new project needs. Mirrors what's tracked in git, minus the
# boilerplate's own history and the things a new project should start fresh with.
_ITEMS_TO_COPY=(
  src
  public
  index.html
  package.json
  package-lock.json
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vite.config.ts
  eslint.config.js
  components.json
  .gitignore
  .env
  CLAUDE.md
)

_target=""
_project_name=""
_copy_modules=true
_force=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)          _project_name="${2:-}"; shift 2 ;;
    --install)       _copy_modules=false; shift ;;
    --force)         _force=true; shift ;;
    -h|--help)       sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)              _die "unknown option: $1" ;;
    *)               [[ -n "$_target" ]] && _die "target given twice"; _target="$1"; shift ;;
  esac
done

[[ -n "$_target" ]] || _die "usage: $0 /abs/path/to/new-project [--name my-app] [--install] [--force]"
[[ "$_target" = /* ]] || _die "target must be an absolute path (got: $_target)"
[[ "$_target" != "$_SOURCE_DIR" ]] || _die "target is the boilerplate itself"

# Refuse to scribble into a non-empty directory unless asked to.
if [[ -e "$_target" ]]; then
  [[ -d "$_target" ]] || _die "target exists and is not a directory: $_target"
  if [[ -n "$(ls -A "$_target" 2>/dev/null)" ]] && [[ "$_force" != true ]]; then
    _die "target is not empty: $_target (pass --force to copy into it anyway)"
  fi
fi

# Default the package name to the target folder, normalised to what npm accepts.
if [[ -z "$_project_name" ]]; then
  _project_name="$(basename "$_target" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9._-' '-' | sed 's/^-*//; s/-*$//')"
fi

mkdir -p "$_target"

echo "scaffolding $_project_name"
echo "  from: $_SOURCE_DIR"
echo "  to:   $_target"
echo

for _item in "${_ITEMS_TO_COPY[@]}"; do
  if [[ -e "$_SOURCE_DIR/$_item" ]]; then
    cp -R "$_SOURCE_DIR/$_item" "$_target/"
    echo "  + $_item"
  else
    echo "  ! missing, skipped: $_item" >&2
  fi
done

# Build artefacts and incremental caches should never carry over.
rm -rf "$_target/dist" "$_target/node_modules/.vite"
find "$_target" -maxdepth 1 -name '*.tsbuildinfo' -delete

# Name the package after the new project rather than leaving it as "frontend".
node -e '
  const fs = require("fs");
  const path = process.argv[1];
  const name = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  pkg.name = name;
  pkg.version = "0.0.0";
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
' "$_target/package.json" "$_project_name"
echo "  ~ package.json name -> $_project_name"

if [[ "$_copy_modules" == true ]]; then
  echo
  echo "copying node_modules ($(du -sh "$_SOURCE_DIR/node_modules" 2>/dev/null | cut -f1))..."
  cp -R "$_SOURCE_DIR/node_modules" "$_target/"
  # The copy brings the source's vite cache with it, which is keyed to the old path.
  rm -rf "$_target/node_modules/.vite"
else
  echo
  echo "installing dependencies..."
  (cd "$_target" && npm ci --no-audit --no-fund)
fi

echo
echo "done. next:"
echo "  cd $_target"
echo "  git init                 # this is a fresh project, not a fork of the boilerplate"
echo "  npm run dev"
echo
echo "then set VITE_API_BASE_URL (and VITE_GOOGLE_CLIENT_ID if using Google SSO), and VITE_MIXPANEL_TOKEN in .env,"
echo "and recolor the theme tokens in src/styles/index.css if you want to customize the color scheme."
