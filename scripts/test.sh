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

step "Generated code is up to date (schema types, OpenAPI document, API client)"
pnpm gen >/dev/null
git diff --exit-code -- packages/schema/src/generated.ts packages/api-client \
  || { echo "error: generated files changed; run 'pnpm gen' (after 'dotnet build') and commit" >&2; exit 1; }

step "lint"
pnpm lint

step "typecheck"
pnpm typecheck

step "unit tests"
pnpm test
