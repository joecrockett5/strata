#!/usr/bin/env bash
# Everything CI runs, except end-to-end tests: build, lint, typecheck, unit + integration tests.
source "$(dirname "$0")/lib.sh"
require docker dotnet pnpm

cd "$ROOT"

step "dotnet build (warnings are errors)"
dotnet build --nologo

step "dotnet test (integration tests use Testcontainers Postgres)"
dotnet test --no-build

step "pnpm install"
pnpm install --frozen-lockfile

step "Generated code is up to date"
pnpm gen:api >/dev/null
git diff --exit-code -- packages/api-client || { echo "error: regenerate with 'pnpm gen:api' and commit" >&2; exit 1; }

step "lint"
pnpm lint

step "typecheck"
pnpm typecheck

step "unit tests"
pnpm test
