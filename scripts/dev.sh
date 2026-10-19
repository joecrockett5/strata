#!/usr/bin/env bash
# Development loop: Postgres in Docker, API with `dotnet watch`, editor with Vite.
source "$(dirname "$0")/lib.sh"
require docker dotnet pnpm

start_db

cd "$ROOT"
pnpm install --frozen-lockfile

pids=()
cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

step "API on http://localhost:5080 (dotnet watch)"
dotnet watch --project src/Strata.Api --non-interactive run --launch-profile http &
pids+=($!)

step "Editor on http://localhost:5173 (vite)"
pnpm dev &
pids+=($!)

wait -n
