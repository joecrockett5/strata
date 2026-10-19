#!/usr/bin/env bash
# Playwright end-to-end tests against a freshly reset e2e database.
# Playwright's webServer config starts the API and the editor itself.
source "$(dirname "$0")/lib.sh"
require docker dotnet pnpm

start_db

step "Resetting the strata_e2e database"
docker compose -f "$ROOT/compose.yaml" exec -T db psql -v ON_ERROR_STOP=1 -U strata -d postgres \
  -c "DROP DATABASE IF EXISTS strata_e2e WITH (FORCE);" -c "CREATE DATABASE strata_e2e OWNER strata;"
rm -rf "$ROOT/.data/e2e-media"

cd "$ROOT"
pnpm install --frozen-lockfile
dotnet build src/Strata.Api --nologo

step "Playwright"
pnpm --filter @strata/e2e exec playwright test "$@"
