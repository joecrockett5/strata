#!/usr/bin/env bash
# Shared helpers for the scripts in this directory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT

# Pick up user-local SDK installs (e.g. ~/.dotnet, ~/.local/node) when they are not on PATH.
for dir in "$HOME/.dotnet" "$HOME/.dotnet/tools" "$HOME/.local/node/bin"; do
  if [[ -d "$dir" && ":$PATH:" != *":$dir:"* ]]; then
    PATH="$dir:$PATH"
  fi
done
[[ -d "$HOME/.dotnet" ]] && export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0

require() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "error: '$cmd' is required but not installed" >&2; exit 1; }
  done
}

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

start_db() {
  step "Starting Postgres (docker compose up db)"
  docker compose -f "$ROOT/compose.yaml" up -d --wait db
}
